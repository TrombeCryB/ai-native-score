import {lstat,readdir,realpath} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {homedir} from 'node:os';
export const TOOLS=['Codex','Hermes','WorkBuddy','OpenClaw','DeepSeek Harness','ZCode','Claude Code','GPT / ChatGPT'] as const;
export type DiscoverySource={tool:string;instance:string;path?:string;discovery:'found'|'not-found'|'denied'|'unknown';adapter:'codex'|'hermes-sqlite'|'hermes-json'|'normalized-export'|null;authorization:'not-granted';read:'not-read';exportRequired:boolean;note:string};
export type Discovery={sources:DiscoverySource[];limits:string[];network:'none';contentRead:false};
// Only documented Codex/Hermes roots are probed. Other products have no guessed storage paths.
export async function discover(options:{home?:string;roots?:{tool:string;path:string;instance:string}[]}={}):Promise<Discovery>{
 const home=resolve(options.home??homedir());const sources:DiscoverySource[]=[];
 async function probe(tool:string,path:string,instance:string,adapter:DiscoverySource['adapter']){
  const result:DiscoverySource={tool,instance,path,discovery:'unknown',adapter,authorization:'not-granted',read:'not-read',exportRequired:adapter===null,note:'仅检查路径元数据；未读取内容，也未获得历史读取授权。'};
  if(/(^|\/)(Library|\.ssh|\.aws|\.config|\.env[^/]*|auth[^/]*|credentials?[^/]*|secrets?[^/]*)(\/|$)/i.test(path)){result.discovery='denied';result.note='拒绝敏感或受限目录，不读取元数据或内容。';sources.push(result);return result;}
  try{let current='/';for(const part of resolve(path).split('/').filter(Boolean)){current=join(current,part);if((await lstat(current)).isSymbolicLink())throw Error('symlink');}if(await realpath(path)!==resolve(path))throw Error('changed');result.discovery='found';}catch(e){result.discovery=(e as any)?.code==='ENOENT'?'not-found':(e as any)?.code==='EACCES'||(e as any)?.code==='EPERM'?'denied':'unknown';}
  sources.push(result);return result;
 }
 await probe('Codex',join(home,'.codex','sessions'),'default','codex');
 if(!options.home&&process.env.CODEX_HOME&&resolve(process.env.CODEX_HOME)!==join(home,'.codex'))await probe('Codex',join(process.env.CODEX_HOME,'sessions'),'configured','codex');
 if(!options.home&&process.env.HERMES_HOME&&resolve(process.env.HERMES_HOME)!==join(home,'.hermes'))await probe('Hermes',join(process.env.HERMES_HOME,'state.db'),'configured','hermes-sqlite');
 await probe('Hermes',join(home,'.hermes','state.db'),'default','hermes-sqlite');
 const profiles=await probe('Hermes',join(home,'.hermes','profiles'),'profiles',null);
 if(profiles.discovery==='found')try{for(const entry of (await readdir(profiles.path!,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name)).slice(0,128)){if(entry.isDirectory()&&!entry.isSymbolicLink())await probe('Hermes',join(profiles.path!,entry.name,'state.db'),entry.name,'hermes-sqlite');}}catch{profiles.discovery='denied';}
 for(const root of options.roots??[]){if(!root||typeof root.tool!=='string'||typeof root.path!=='string'||typeof root.instance!=='string')throw Error('发现范围无效');await probe(root.tool,root.path,root.instance,root.tool==='Codex'?'codex':null);}
 for(const tool of TOOLS)if(!sources.some(s=>s.tool===tool))sources.push({tool,instance:'unresolved',discovery:'unknown',adapter:null,authorization:'not-granted',read:'not-read',exportRequired:true,note:'未实现原生格式读取；请在应用中导出所选日期的记录，或明确提供根目录与格式样本。未猜测路径。'});
 return {sources,limits:['发现只读已知根目录的元数据及 Hermes profile 名称，不读凭据、配置内容或会话正文。','仅这些明确入口可发现；沙箱、远程和自定义目录可能遗漏，补充根目录或导出以扩展。','发现、适配、授权和成功读取是不同状态；存在目录不代表适配成功。','拒读受限目录，不绕过权限；去敏及路径防护尽力而为，不能保证绝对安全。'],network:'none',contentRead:false};
}
