import {readFile,writeFile,mkdir,chmod} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {collect,validateScope,scopeDigest,type Collection} from './collector.js';
import {publicScore,validateReport,AXES} from './model.js';
import {applyEvaluation,writtenReport} from './evaluate.js';
import {radarSvg} from './visual.js';
import {DEFAULT_SITE,publicationPlan,preparePublication,sendPublication,deletePublication,type Receipt} from './client.js';
const args=process.argv.slice(2);const command=args.shift();
const option=(name:string)=>{const i=args.indexOf('--'+name);return i===-1?undefined:args[i+1];};
async function load(path:string){const data=await readFile(path,'utf8');if(Buffer.byteLength(data)>12*1024**2)throw Error('输入文件过大');return JSON.parse(data);}
async function save(path:string,data:string){await writeFile(path,data,{mode:0o600,flag:'wx'});}
async function main(){
 if(command==='publish-plan'){
  const input=await load(option('score')??'reports/assessment/public-score.json');if(option('nickname')!==undefined)input.nickname=option('nickname');
  const plan=publicationPlan(input,option('site')??DEFAULT_SITE);console.log(JSON.stringify({publicFields:plan.score,target:plan.origin,confirmation:plan.confirmation},null,2));return;
 }
 if(command==='publish'){
  const input=await load(option('score')??'reports/assessment/public-score.json');if(option('nickname')!==undefined)input.nickname=option('nickname');
  const path=resolve(option('receipt')??'reports/submission.receipt.json');let existing:Receipt|undefined;
  try{existing=await load(path);}catch{}
  const prepared=preparePublication(input,option('site')??DEFAULT_SITE,option('confirm-public')??'',existing);
  if(!existing){await mkdir(dirname(path),{recursive:true,mode:0o700});await save(path,JSON.stringify(prepared.receipt,null,2));}
  const result=await sendPublication(prepared);console.log(JSON.stringify({submitted:true,url:result.url,notes:'私密删除凭据已保存在指定文件；不要分享凭据。'}));return;
 }
 if(command==='delete'){
  console.log(JSON.stringify(await deletePublication(await load(option('receipt')??'reports/submission.receipt.json'),option('confirm-delete')??'')));return;
 }
 if(command==='plan'){
  const scope=validateScope(await load(option('scope')??'scope.local.json'));
  console.log(JSON.stringify({scope,limits:{fileBytes:1048576,totalBytes:8388608,files:200,ledgerEntries:500,timeMs:20000},network:'none',confirmation:scopeDigest(scope)},null,2));return;
 }
 if(command==='scan'){
  const scope=validateScope(await load(option('scope')??'scope.local.json'));
  const result=await collect(scope,option('confirm-scope')??'');const out=resolve(option('out')??'reports/collection');await mkdir(dirname(out),{recursive:true});await mkdir(out,{mode:0o700});
  await save(join(out,'collection.private.json'),JSON.stringify(result,null,2));await save(join(out,'report.json'),JSON.stringify(result.report,null,2));await save(join(out,'report.md'),writtenReport(result.report,undefined,result.ledger));
  console.log(JSON.stringify({completed:true,files:result.stats.files,skipped:result.stats.skipped,truncated:result.stats.truncated,evidenceItems:result.ledger.length,coverage:0,notes:'私密结果已写入指定目录；未输出正文，未联网。'}));return;
 }
 if(command==='evaluate'){
  const collection=await load(option('collection')??'reports/collection/collection.private.json') as Collection;
  const result=applyEvaluation(collection,await load(option('evaluation')??'evaluation.private.json'));validateReport(result.report);
  const out=resolve(option('out')??'reports/assessment');await mkdir(dirname(out),{recursive:true});await mkdir(out,{mode:0o700});
  await save(join(out,'report.json'),JSON.stringify(result.report,null,2));await save(join(out,'report.md'),writtenReport(result.report,result.evaluation,collection.ledger));await save(join(out,'public-score.json'),JSON.stringify(publicScore(result.report),null,2));
  const svg=radarSvg(result.report.summary);await save(join(out,'report.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Agent Mirror 离线报告</title><style>body{max-width:880px;margin:3em auto;padding:1em;font:16px/1.8 system-ui;background:#f3f1e9;color:#153e36}svg{max-width:600px}pre{white-space:pre-wrap}</style>${svg}<pre>${escape(writtenReport(result.report,result.evaluation,collection.ledger))}</pre></html>`);
  console.log(JSON.stringify({completed:true,coverage:result.report.summary.coverage,confidence:result.report.summary.confidence,total:result.report.summary.total,notes:'本地文字、雷达与聚合文件已生成；未上传。'}));return;
 }
 if(command==='export'){
  const report=validateReport(await load(option('report')??'reports/assessment/report.json'));const score=publicScore(report,option('nickname')??'');
  if(option('confirm-public')!=='yes')throw Error('先检查聚合字段；仅明确同意公开昵称与分数后使用 --confirm-public yes 导出公开副本');
  await save(resolve(option('out')??'reports/public-score.json'),JSON.stringify(score,null,2));console.log('已导出聚合副本，尚未上传。');return;
 }
 console.log('AI Native Score\nplan --scope scope.local.json\nscan --scope scope.local.json --confirm-scope <plan摘要> --out reports/collection\nevaluate --collection <私密收集结果> --evaluation <agent生成决策> --out reports/assessment\npublish-plan --score <聚合分数> [--site <HTTPS站点>]\npublish --score <聚合分数> [--site <站点>] --confirm-public <计划摘要> --receipt <私密凭据>\ndelete --receipt <私密凭据> --confirm-delete <对应ID>\n所有收集与评估命令零网络；只有单独确认的publish/delete联网。');
}
function escape(s:string){return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');}
main().catch(()=>{console.error('操作未完成：请检查参数、范围确认、输入schema或路径权限。未输出私密错误细节。');process.exitCode=1;});
