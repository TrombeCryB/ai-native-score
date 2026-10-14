import {AXES,INDICATORS,VERSION,summarize,unknownRatings,type Report} from './model.js';
import {redact,type LedgerItem,type Collection} from './collector.js';
export type Decision={axis:number;indicator:number;value:number|null;quality:'low'|'medium'|'high';support:string[];counterexamples:string[];rationale:string;humanContribution:string;agentActivity:string;outcome:string};
export type Evaluation={decisions:Decision[]; taskGroups?:Record<string,string>; narrative:{strengths:string[];gaps:string[];workPatterns:string[];lifePatterns:string[];actions:string[];limitations:string[]}};
export function applyEvaluation(collection:Collection,input:unknown):{report:Report;evaluation:Evaluation}{
 const e=input as Evaluation;
 if(!e||!Array.isArray(e.decisions)||e.decisions.length!==24||!e.narrative)throw Error('评估需要24项决策和文字评价');
 const lookup=new Map(collection.ledger.map(x=>[x.id,x]));const seen=new Set<string>();const ratings=unknownRatings();
 const knownTasks=new Set(collection.ledger.map(x=>x.task));
 if(e.taskGroups&&(typeof e.taskGroups!=='object'||Array.isArray(e.taskGroups)||Object.entries(e.taskGroups).some(([t,g])=>!knownTasks.has(t)||typeof g!=='string'||g.length>64)))throw Error('任务分组无效');
 for(const d of e.decisions){
  if(!Number.isInteger(d.axis)||d.axis<0||d.axis>5||!Number.isInteger(d.indicator)||d.indicator<0||d.indicator>3||seen.has(`${d.axis}:${d.indicator}`)||!['low','medium','high'].includes(d.quality))throw Error('决策索引无效');seen.add(`${d.axis}:${d.indicator}`);
  if(!Array.isArray(d.support)||!Array.isArray(d.counterexamples)||[...d.support,...d.counterexamples].some(id=>!lookup.has(id)))throw Error('证据ID不存在');
  for(const key of ['rationale','humanContribution','agentActivity','outcome'] as const)if(typeof d[key]!=='string'||d[key].length>2000)throw Error('决策说明无效');
  if(d.value===null)continue;
  if(!Number.isInteger(d.value)||d.value<0||d.value>4||!d.support.length||!d.rationale.trim()||!d.humanContribution.trim()||!d.outcome.trim())throw Error('已知评分需要行为和结果解释');
  const records=d.support.map(id=>lookup.get(id)!);const tasks=new Set(records.map(x=>e.taskGroups?.[x.task]??x.task));
  if(!records.some(x=>x.actor==='human'))throw Error('agent 活动不能直接当成人类能力');
  if(d.value>=3&&tasks.size<2)throw Error('3–4级需要多个独立任务的证据');
  if(d.value===4&&tasks.size<3)throw Error('4级需要至少三个任务并解释迁移与结果');
  ratings[d.axis][d.indicator]={value:d.value,confidence:d.quality==='high'?0.9:d.quality==='medium'?0.6:0.3,evidence:[...new Set([...d.support,...d.counterexamples])],basis:'observed'};
 }
 for(const key of ['strengths','gaps','workPatterns','lifePatterns','actions','limitations'] as const){
  const a=e.narrative[key];if(!Array.isArray(a)||a.length>12||a.some(t=>typeof t!=='string'||t.length>2000))throw Error('文字评价无效');
  e.narrative[key]=a.map(redact);
 }
 const used=new Set(ratings.flat().flatMap(r=>r.evidence));
 const evidence=[...used].map(id=>({id,source:'workflow-record' as const,fact:'已授权去敏行为记录；详见本地私密证据账本',strength:'observation' as const}));
 return {report:{schemaVersion:1,scoringVersion:VERSION,kind:'local-assessment',ratings,evidence,summary:summarize(ratings)},evaluation:e};
}
export function writtenReport(report:Report,evaluation?:Evaluation,ledger:LedgerItem[]=[]):string{
 const s=report.summary;const lines=['# AI Native Score 本地评价','',`评分版本：${VERSION}。原创综合指标，非认证。`, '',`总分：${s.total??'未知'}；缺证据下可能区间：${Math.floor(s.interval[0])}–${Math.ceil(s.interval[1])} / 100。`,`证据覆盖：${Math.round(s.coverage*100)}%；证据质量：${s.confidence}（不是概率）。`, '', '缺项保留未知，区间不是统计置信区间。维度值若有缺项，仅为已知部分的暂定轮廓。',''];
 AXES.forEach((a,i)=>{lines.push(`## ${a}`,`暂定维度：${s.dimensions[i]===null?'未知':Math.round(s.dimensions[i]!)}`, '');INDICATORS[i].forEach((name,j)=>{const r=report.ratings[i][j];const d=evaluation?.decisions.find(d=>d.axis===i&&d.indicator===j);lines.push(`- ${name}：${r.value??'未知'} / 4${d?`。${redact(d.rationale)} 人类贡献：${redact(d.humanContribution)}。agent 活动：${redact(d.agentActivity)}。结果：${redact(d.outcome)}。证据：${d.support.join(', ')||'无'}；反例：${d.counterexamples.join(', ')||'未观察到，不等于不存在'}`:'。结构元数据不足以证明实际能力。'}`);});lines.push('');});
 const titles={strengths:'有证据的强项',gaps:'短板与反例',workPatterns:'工作任务中的长期模式',lifePatterns:'生活任务中的长期模式',actions:'可执行改进建议',limitations:'覆盖限制与替代解释'};
 for(const [key,title] of Object.entries(titles)){lines.push(`## ${title}`,'');const entries=evaluation?.narrative[key as keyof Evaluation['narrative']]??[];lines.push(...(entries.length?entries.map(t=>'- '+redact(t)):['当前缺乏可支持此结论的行为证据；请选择日期范围开展深度评估。']),'');}
 lines.push('## 本地证据索引','',...ledger.map(x=>`- ${x.id}：${x.date} / ${x.instance} / 任务 ${x.task} / ${x.actor}；正文保留在私密账本。`),'','本报告和账本可能包含个人信息。仅上传 public-score.json 前请检查并明确确认。');
 return lines.join('\n');
}
