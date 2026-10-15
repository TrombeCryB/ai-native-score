import {packEvidence,prepareFull} from './full.js';
import {discover} from './discovery.js';
import {reportHtml} from './report.js';
import {readFile,writeFile,mkdir,chmod,stat} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {collect,validateScope,scopeDigest,type Collection} from './collector.js';
import {publicScore,validateReport,AXES} from './model.js';
import {applyEvaluation,writtenReport} from './evaluate.js';
import {radarSvg} from './visual.js';
import {DEFAULT_SITE,publicationPlan,preparePublication,sendPublication,deletePublication,type Receipt} from './client.js';
const args=process.argv.slice(2);const command=args.shift();
const option=(name:string)=>{const i=args.indexOf('--'+name);return i===-1?undefined:args[i+1];};
async function load(path:string,limit=12*1024**2){if((await stat(path)).size>limit)throw Error('控制文件过大；全量证据使用pack/evaluate流式入口');return JSON.parse(await readFile(path,'utf8'));}
async function save(path:string,data:string){await writeFile(path,data,{mode:0o600,flag:'wx'});}
async function main(){
 if(command==='pack'){const source=resolve(option('collection')??'collection.private.json');const out=resolve(option('out')??'reports/full-evidence');await mkdir(dirname(out),{recursive:true});console.error('流式封装完整证据：不丢事件，不按卷出分；可能持续较长时间。');console.log(JSON.stringify(await packEvidence(source,out)));return;}
 if(command==='discover'){console.log(JSON.stringify(await discover(option('roots')?{roots:await load(option('roots')!)}:{}),null,2));return;}
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
  console.log(JSON.stringify({discovery:await discover(),scope,readOnly:true,safety:'拒读凭据和受限目录；不绕过权限。去敏不能保证绝对安全。',duration:'评估可能持续较长时间；以来源、文件、任务链和遗漏报告进度，耗时不代表深度或真实性。',limits:{fileBytes:1048576,totalBytes:8388608,files:200,ledgerEntries:500,timeMs:20000},network:'none',confirmation:scopeDigest(scope)},null,2));return;
 }
 if(command==='scan'){
  const scope=validateScope(await load(option('scope')??'scope.local.json'));
  console.error('开始只读收集；可能持续较长时间。阶段：发现 → 授权范围读取 → 去敏；耗时不计分。');
  const result=await collect(scope,option('confirm-scope')??'');const out=resolve(option('out')??'reports/collection');await mkdir(dirname(out),{recursive:true});await mkdir(out,{mode:0o700});
  await save(join(out,'collection.private.json'),JSON.stringify(result,null,2));await save(join(out,'report.json'),JSON.stringify(result.report,null,2));await save(join(out,'report.md'),writtenReport(result.report,undefined,result.ledger,result));await save(join(out,'report.html'),reportHtml(result.report,undefined,result));
  console.log(JSON.stringify({completed:true,files:result.stats.files,skipped:result.stats.skipped,truncated:result.stats.truncated,evidenceItems:result.ledger.length,coverage:0,notes:'私密结果已写入指定目录；未输出正文，未联网。'}));return;
 }
 if(command==='evaluate'){
  const out=resolve(option('out')??'reports/assessment');await mkdir(dirname(out),{recursive:true});await mkdir(out,{mode:0o700});
  console.error('全量核验：流式读取/分卷完整性 → 磁盘索引主键及审阅 → 全局家族与评分门槛；不按卷评分。');
  const prepared=await prepareFull(resolve(option('manifest')??option('collection')??'reports/collection/collection.private.json'),resolve(option('evaluation')??'evaluation.private.json'),out,!!option('manifest'));
  const collection=prepared.collection;const result=applyEvaluation(collection,prepared.evaluation,prepared.coverage);validateReport(result.report);
  await save(join(out,'evidence-index.private.json'),JSON.stringify({coverage:prepared.coverage,collection},null,2));
  await save(join(out,'report.json'),JSON.stringify(result.report,null,2));await save(join(out,'evaluation.private.json'),JSON.stringify(result.evaluation,null,2));await save(join(out,'report.md'),writtenReport(result.report,result.evaluation,collection.ledger,collection));
  if(result.report.summary.total!==null)await save(join(out,'public-score.json'),JSON.stringify(publicScore(result.report),null,2));
  await save(join(out,'report.html'),reportHtml(result.report,result.evaluation,collection));
  console.log(JSON.stringify({completed:true,status:result.report.summary.total===null?'needs-evidence':'scored',coverage:result.report.summary.coverage,confidence:result.report.summary.confidence,notes:result.report.summary.total===null?'仅生成缺口与补查报告；无数值评分、雷达或公开文件。':'本地报告及聚合文件已生成；未上传。'}));return;
 }
 if(command==='export'){
  const report=validateReport(await load(option('report')??'reports/assessment/report.json',32*1024**2));const score=publicScore(report,option('nickname')??'');
  if(option('confirm-public')!=='yes')throw Error('先检查聚合字段；仅明确同意公开昵称与分数后使用 --confirm-public yes 导出公开副本');
  await save(resolve(option('out')??'reports/public-score.json'),JSON.stringify(score,null,2));console.log('已导出聚合副本，尚未上传。');return;
 }
 console.log('AI Native Score\npack --collection <完整私密JSON> --out <新分卷目录>\nevaluate --manifest <manifest.json> --evaluation <完整审阅JSON> --out <新私密报告目录>\ndiscover [--roots <已知根目录列表>]\nplan --scope scope.local.json\nscan --scope scope.local.json --confirm-scope <plan摘要> --out reports/collection\nevaluate --collection <私密收集结果> --evaluation <agent生成决策> --out reports/assessment\npublish-plan --score <聚合分数> [--site <HTTPS站点>]\npublish --score <聚合分数> [--site <站点>] --confirm-public <计划摘要> --receipt <私密凭据>\ndelete --receipt <私密凭据> --confirm-delete <对应ID>\n所有收集与评估命令零网络；只有单独确认的publish/delete联网。');
}
function escape(s:string){return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');}
main().catch(()=>{console.error('操作未完成：请检查参数、范围确认、输入schema或路径权限。未输出私密错误细节。');process.exitCode=1;});
