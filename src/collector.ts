import {lstat,realpath,open,readdir} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve,relative,join,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {VERSION,unknownRatings,summarize,type Report} from './model.js';
export type Scope={mode:'structure'|'deep'; projects:string[]; agents:string[]; histories:{adapter:'codex'|'hermes-json'|'hermes-sqlite';path:string;instance:string}[]; from:string; to:string};
export type LedgerItem={id:string;task:string;date:string;actor:'human'|'agent';instance:string;text:string;untrusted:true};
export type Collection={report:Report;ledger:LedgerItem[];stats:{files:number;bytes:number;skipped:number;truncated:boolean};diagnostics?:{target:string;reason:string}[]};
const MAX_FILE=1024*1024,MAX_TOTAL=8*1024*1024,MAX_FILES=200,MAX_ITEMS=500,MAX_TIME=20000;
const denied=/(^|\/)(\.env[^/]*|\.git|node_modules|auth[^/]*|credentials?[^/]*|secrets?[^/]*|\.ssh|\.aws|\.config|Library|Cookies|Login Data)(\/|$)/i;
export function validateScope(x:unknown):Scope{
 const s=x as Scope;
 if(!s||!['structure','deep'].includes(s.mode)||!Array.isArray(s.projects)||!Array.isArray(s.agents)||!Array.isArray(s.histories)||s.projects.length+s.agents.length+s.histories.length>12||![...s.projects,...s.agents].every(p=>typeof p==='string'&&p.length<1024))throw Error('范围配置无效');
 const validDate=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 if(!validDate(s.from)||!validDate(s.to)||s.from>s.to)throw Error('请提供有效日期范围');
 if(s.mode==='structure'&&s.histories.length)throw Error('历史记录需要 deep 模式');
 for(const h of s.histories)if(!h||!['codex','hermes-json','hermes-sqlite'].includes(h.adapter)||typeof h.instance!=='string'||! /^[A-Za-z0-9_.-]{1,64}$/.test(h.instance)||typeof h.path!=='string'||h.path.length>1024)throw Error('适配器配置无效');
 return s;
}
export const scopeDigest=(s:Scope)=>createHash('sha256').update(JSON.stringify(s)).digest('hex');
export function redact(input:string):string{
 return input
 .replace(/-----BEGIN[^\n]*PRIVATE KEY-----[\s\S]*?-----END[^\n]*PRIVATE KEY-----/g,'[SECRET]')
 .replace(/^.*(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|password|passwd|authorization|client[_ -]?secret|密钥|密码|验证码|secret.canary)[^\n]*$/gim,'[SECRET LINE]')
 .replace(/\b(?:sk-[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9]{8,}|AKIA[A-Z0-9]{16}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/g,'[SECRET]')
 .replace(/https?:\/\/[^\s)<>]+/g,'[URL]')
 .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[EMAIL]')
 .replace(/(?:\/Users\/|\/home\/|[A-Z]:\\)[^\s"'<>]+/g,'[LOCAL PATH]')
 .replace(/\b(?:\+?\d[\d -]{9,}\d)\b/g,'[NUMBER]')
 .replace(/\b[A-Za-z0-9_+/=-]{32,}\b/g,'[LONG IDENTIFIER]')
 .slice(0,3000);
}
async function safePath(path:string,root:string){
 const abs=resolve(path),base=resolve(root);
 if(denied.test(abs)||relative(base,abs).startsWith('..'))throw Error('禁止的扫描路径');
 const parts=abs.split('/').filter(Boolean);let current='/';
 for(const part of parts){current=join(current,part);if((await lstat(current)).isSymbolicLink())throw Error('不扫描符号链接');}
 const actual=await realpath(abs);if(actual!==abs)throw Error('路径发生变化');
 return abs;
}
export async function collect(scope:Scope,confirmation:string):Promise<Collection>{
 validateScope(scope);if(confirmation!==scopeDigest(scope))throw Error('扫描前需要确认范围摘要');
 const started=Date.now();const ledger:LedgerItem[]=[];const evidence:Report['evidence']=[];const diagnostics:NonNullable<Collection['diagnostics']>=[];
 const stats={files:0,bytes:0,skipped:0,truncated:false};const hashes=new Set<string>();
 const budget=()=>{if(Date.now()-started>MAX_TIME||stats.files>=MAX_FILES||stats.bytes>=MAX_TOTAL||ledger.length>=MAX_ITEMS){stats.truncated=true;return false;}return true;};
 async function read(path:string,root:string){
  if(!budget())return null;
  let handle;
  try{
   await safePath(path,root);const stat=await lstat(path);
   if(!stat.isFile()||Math.min(stat.size,MAX_FILE)+stats.bytes>MAX_TOTAL){stats.skipped++;stats.truncated=true;if(diagnostics.length<128)diagnostics.push({target:path,reason:stat.isFile()?'total-byte-limit':'not-regular-file'});return null;}
   handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
   const opened=await handle.stat();if(!opened.isFile()||opened.ino!==stat.ino||opened.dev!==stat.dev)throw Error('扫描期间文件改变');
   let text:string,used:number;
   if(stat.size>MAX_FILE){
    stats.truncated=true;const half=MAX_FILE/2,head=Buffer.alloc(half),tail=Buffer.alloc(half);
    const a=await handle.read(head,0,half,0),b=await handle.read(tail,0,half,stat.size-half);
    used=a.bytesRead+b.bytesRead;text=head.subarray(0,a.bytesRead).toString('utf8')+'\n'+tail.subarray(0,b.bytesRead).toString('utf8');
   }else{const buffer=Buffer.alloc(stat.size);const result=await handle.read(buffer,0,buffer.length,0);used=result.bytesRead;text=buffer.subarray(0,used).toString('utf8');}
   stats.files++;stats.bytes+=used;return text;
  }catch(error){stats.skipped++;if(diagnostics.length<128)diagnostics.push({target:path,reason:['EPERM','EACCES'].includes(String((error as any)?.code))?'permission-denied':(error as any)?.code==='ENOENT'?'missing-file':'unsafe-or-changed-path'});return null;}finally{await handle?.close();}
 }
 function add(task:string,date:string,actor:'human'|'agent',instance:string,text:string){
  if(!budget()||date.slice(0,10)<scope.from||date.slice(0,10)>scope.to)return;
  const clean=redact(text);if(!clean.trim())return;
  const key=createHash('sha256').update(task+'|'+actor+'|'+clean).digest('hex');if(hashes.has(key))return;hashes.add(key);
  ledger.push({id:'e'+(ledger.length+1),task:createHash('sha256').update(instance+'|'+task).digest('hex').slice(0,12),date:date.slice(0,10),actor,instance,text:clean,untrusted:true});
 }
 async function walk(root:string,exts:string[],callback:(p:string)=>Promise<void>,depth=0){
  if(depth>8||!budget())return;
  try{await safePath(root,root);const entries=await readdir(root,{withFileTypes:true});
   for(const e of entries.sort((a,b)=>a.name.localeCompare(b.name))){if(!budget())break;const p=join(root,e.name);if(denied.test(p)||e.isSymbolicLink())continue;if(e.isDirectory())await walk(p,exts,callback,depth+1);else if(e.isFile()&&exts.some(ext=>e.name.endsWith(ext)))await callback(p);else if(!e.isFile())stats.skipped++;}
  }catch{stats.skipped++;}
 }
 for(const root of scope.projects){
  for(const name of ['AGENTS.md','package.json','.github/workflows/ci.yml','.github/workflows/ci.yaml']){
   const raw=await read(join(root,name),root);if(raw!==null)evidence.push({id:'e'+(evidence.length+1),source:'project-structure',fact:name==='package.json'?'项目包含包清单（不证明完成质量）':name==='AGENTS.md'?'项目包含 agent 工作说明（不证明已遵守）':'项目包含持续集成配置（不证明检查通过）',strength:'structure'});
  }
 }
 for(const root of scope.agents){
  await walk(join(root,'skills'),['SKILL.md'],async p=>{const raw=await read(p,root);if(raw!==null&&evidence.length<128)evidence.push({id:'e'+(evidence.length+1),source:'agent-structure',fact:'存在技能元数据（不证明实际使用）',strength:'structure'});});
 }
 for(const h of scope.histories){
  if(h.adapter==='hermes-sqlite'){
   if(!budget())break;
   try{await safePath(h.path,h.path);const st=await lstat(h.path);if(!st.isFile()||st.size>2*1024**3)throw Error('数据库不支持');
    // Own fixed helper: no shell interpolation, read-only connection, timeout and maxBuffer.
    const r=await promisify(execFile)('python3',[join(import.meta.dirname,'../scripts/hermes_read.py'),h.path,scope.from,scope.to],{timeout:Math.min(15000,MAX_TIME-(Date.now()-started)),maxBuffer:MAX_TOTAL-stats.bytes});
    stats.files++;stats.bytes+=Buffer.byteLength(r.stdout);const rows=JSON.parse(r.stdout);if(!Array.isArray(rows))throw Error('数据库结构不支持');
    if(rows.length>=MAX_ITEMS)stats.truncated=true;
    for(const m of rows)add(String(m.task),String(m.date),m.role==='user'?'human':'agent',h.instance,String(m.text));
   }catch{stats.skipped++;if(diagnostics.length<128)diagnostics.push({target:h.path,reason:'unsupported-schema-or-read-denied-or-query-limit'});}
  }else{
   await walk(h.path,h.adapter==='codex'?['.jsonl']:['.json','.jsonl'],async p=>{
    const datePath=relative(h.path,p).match(/^(\d{4})\/(\d{2})\/(\d{2})\//);
    if(h.adapter==='codex'&&datePath){const d=datePath.slice(1).join('-');if(d<scope.from||d>scope.to)return;}
    const raw=await read(p,h.path);if(raw===null)return;
    let rows:unknown[];
    try{if(p.endsWith('.jsonl'))rows=raw.split('\n').filter(Boolean).map((l:string)=>{try{return JSON.parse(l);}catch{return null;}});else{const doc=JSON.parse(raw);rows=Array.isArray(doc)?doc:doc.messages??[];}}catch{stats.skipped++;return;}
    let sessionDate='',task=basename(p);
    for(const item of rows){
     const m=item as any;if(!m)continue;
     if(m.type==='session_meta'){sessionDate=m.payload?.timestamp??m.timestamp??'';task=m.payload?.source?.subagent?.thread_spawn?.parent_thread_id??m.payload?.forked_from_id??m.payload?.id??task;}
     const rawDate=m.timestamp??m.date??sessionDate;const date=typeof rawDate==='number'?new Date(rawDate*(rawDate<1e11?1000:1)).toISOString():rawDate;if(typeof date!=='string')continue;
     const payload=m.payload??m;const role=payload.role??(payload.type==='user_message'?'user':payload.type==='agent_message'?'assistant':null);
     if(!['user','assistant'].includes(role))continue;
     const content=payload.message??payload.content;
     const text=typeof content==='string'?content:Array.isArray(content)?content.filter(x=>['input_text','output_text','text'].includes(x.type)).map(x=>x.text??'').join('\n'):'';
     add(task,date,role==='user'?'human':'agent',h.instance,text);
    }
   });
  }
 }
 // Structural collection deliberately never awards competence points.
 const ratings=unknownRatings();
 return {report:{schemaVersion:1,scoringVersion:VERSION,kind:'local-assessment',ratings,evidence,summary:summarize(ratings)},ledger,stats,diagnostics};
}
