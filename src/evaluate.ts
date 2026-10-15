import {AXES,INDICATORS,VERSION,summarize,unknownRatings,type Report} from './model.js';
import {redact,type LedgerItem,type Collection} from './collector.js';
export type Observation={behavior:string;result:string;verification:string;enactment:'decision'|'action'|'request-only';outcome:'verified'|'failure'|'claim-only';attribution:'human'|'agent'|'unknown';verificationMethod:'human-followup'|'independent-artifact';scope:string};
export type Decision={axis:number;indicator:number;value:number|null;quality:'low'|'medium'|'high';support:string[];counterexamples:string[];rationale:string;humanContribution:string;agentActivity:string;outcome:string;observations:Observation[];counterReview:string;uncertainty:string;nextLevelGap:string;improvement:{action:string;verify:string};conflict:'none-found'|'resolved'|'unresolved'};
export type Evaluation={review:{reviewedEvidence:string[];excludedEvidence:{id:string;reason:string}[];taskFamiliesFinalized:boolean;counterexampleSearchComplete:boolean};decisions:Decision[];taskGroups?:Record<string,string>;priorities:{action:string;verify:string;evidence:string[]}[];narrative:{strengths:string[];gaps:string[];workPatterns:string[];lifePatterns:string[];actions:string[];limitations:string[]}};
const text=(x:unknown)=>typeof x==='string'&&x.trim().length>0&&x.length<=2000;
export function applyEvaluation(collection:Collection,input:unknown):{report:Report;evaluation:Evaluation}{
 const e=structuredClone(input) as Evaluation;
 if(!e||!Array.isArray(e.decisions)||e.decisions.length!==24||!e.narrative||!Array.isArray(collection.ledger))throw Error('评估需要24项决策和文字评价');
 const lookup=new Map(collection.ledger.map(x=>[x.id,x]));if(lookup.size!==collection.ledger.length)throw Error('证据ID重复');
 const seen=new Set<string>();const ratings=unknownRatings();const knownTasks=new Set(collection.ledger.map(x=>x.task));
 if(e.taskGroups&&(typeof e.taskGroups!=='object'||Array.isArray(e.taskGroups)||Object.entries(e.taskGroups).some(([t,g])=>!knownTasks.has(t)||!text(g)||g.length>64)))throw Error('任务分组无效');
 const group=(x:LedgerItem)=>e.taskGroups?.[x.task]??x.task;
 const ids=(x:unknown):x is string[]=>Array.isArray(x)&&x.length<=500&&x.every(id=>typeof id==='string'&&lookup.has(id));
 const review=e.review;
 if(!review||!ids(review.reviewedEvidence)||!Array.isArray(review.excludedEvidence)||review.excludedEvidence.some(x=>!lookup.has(x.id)||!text(x.reason)))throw Error('缺少逐事件审阅与排除清单');
 const reviewed=new Set(review.reviewedEvidence),excluded=new Set(review.excludedEvidence.map(x=>x.id));
 if([...excluded].some(id=>reviewed.has(id))||reviewed.size!==review.reviewedEvidence.length||excluded.size!==review.excludedEvidence.length)throw Error('审阅与排除冲突');
 const reviewReady=review.taskFamiliesFinalized===true&&review.counterexampleSearchComplete===true&&lookup.size===reviewed.size+excluded.size;
 for(const d of e.decisions){
  if(!Number.isInteger(d.axis)||d.axis<0||d.axis>5||!Number.isInteger(d.indicator)||d.indicator<0||d.indicator>3||seen.has(`${d.axis}:${d.indicator}`)||!['low','medium','high'].includes(d.quality))throw Error('决策索引无效');seen.add(`${d.axis}:${d.indicator}`);
  if(!ids(d.support)||!ids(d.counterexamples)||[...d.support,...d.counterexamples].some(id=>!reviewed.has(id)))throw Error('证据ID不存在');
  for(const key of ['rationale','humanContribution','agentActivity','outcome','counterReview','uncertainty','nextLevelGap'] as const)if(!text(d[key]))throw Error('每项需要锚点、反例检索、不确定性和下一级差距');
  if(!d.improvement||!text(d.improvement.action)||!text(d.improvement.verify)||!['none-found','resolved','unresolved'].includes(d.conflict)||!Array.isArray(d.observations)||d.observations.length>128)throw Error('缺少可验证改进或冲突处置');
  if(d.support.some(id=>d.counterexamples.includes(id)))throw Error('正反证据不能混为一条');
  if(d.value!==null&&(!Number.isInteger(d.value)||d.value<0||d.value>4))throw Error('锚点无效');
  const tasks=new Set<string>();
  for(const o of d.observations){
   const b=lookup.get(o.behavior),r=lookup.get(o.result),v=lookup.get(o.verification);
   if(!b||!r||!v||![o.behavior,o.result,o.verification].every(id=>d.support.includes(id))||!text(o.scope))throw Error('行为链引用无效');
   if(!['decision','action','request-only'].includes(o.enactment)||!['verified','failure','claim-only'].includes(o.outcome)||!['human','agent','unknown'].includes(o.attribution)||!['human-followup','independent-artifact'].includes(o.verificationMethod))throw Error('行为链分类无效');
   // A delegated decision is behavior for relevant indicators, but an unfulfilled request is not a stable practice.
   if(o.enactment==='request-only'||o.outcome==='claim-only'||o.attribution!=='human'||b.actor!=='human'||new Set([o.behavior,o.result,o.verification]).size!==3)continue;
   if(Date.parse(b.date)>Date.parse(r.date)||Date.parse(r.date)>Date.parse(v.date)||!Number.isFinite(Date.parse(b.date))||!Number.isFinite(Date.parse(r.date))||!Number.isFinite(Date.parse(v.date)))continue;
   if(group(b)!==group(r)||group(b)!==group(v)||collection.ledger.indexOf(v)<=collection.ledger.indexOf(r)||collection.ledger.indexOf(r)<=collection.ledger.indexOf(b))continue;
   if(o.verificationMethod==='human-followup'?v.actor!=='human':!(v.actor==='thirdparty'&&v.type==='verifiedoutcome'))continue;
   if(d.value===0&&o.outcome!=='failure')continue;
   tasks.add(group(b));
  }
  const needed=d.value===4?3:d.value===3?2:1;
  const blocked=d.value!==null&&(!reviewReady||tasks.size<needed||d.quality==='low'||d.conflict==='unresolved'||collection.stats.truncated||collection.sources?.some(s=>s.read==='failed'));
  if(blocked){d.value=null;d.rationale=redact(d.rationale+'；证据门槛未满足：需要独立完整行为链、中高证据质量、冲突处置和未截断输入。');}
  if(d.value===null)continue;
  ratings[d.axis][d.indicator]={value:d.value,confidence:d.quality==='high'?0.9:0.6,evidence:[...new Set([...d.support,...d.counterexamples])],basis:'observed'};
 }
 if(!Array.isArray(e.priorities)||e.priorities.length<2||e.priorities.length>3||e.priorities.some(p=>!text(p.action)||!text(p.verify)||!ids(p.evidence)))throw Error('报告需要2–3项有验证方式的优先行动');
 for(const key of ['strengths','gaps','workPatterns','lifePatterns','actions','limitations'] as const){
  const a=e.narrative[key];if(!Array.isArray(a)||a.length>12||a.some(t=>!text(t)))throw Error('文字评价无效');
  if(['strengths','workPatterns','lifePatterns'].includes(key)&&a.some(t=>!Array.from(t.matchAll(/\be\d+\b/g)).some(m=>lookup.has(m[0]))))throw Error('模式与强项结论必须回链证据；无证据时留空');
  e.narrative[key]=a.map(redact);
 }
 const used=new Set(ratings.flat().flatMap(r=>r.evidence));
 const evidence=[...used].map(id=>({id,source:'workflow-record' as const,fact:'已授权去敏行为链；具体支持范围、反证与核验见私密评估文件',strength:'observation' as const}));
 return {report:{schemaVersion:1,scoringVersion:VERSION,kind:'local-assessment',ratings,evidence,summary:summarize(ratings),assessmentGate:{status:summarize(ratings).total===null?'blocked':'ready',reviewComplete:lookup.size===reviewed.size+excluded.size,familiesFinalized:review.taskFamiliesFinalized,counterexamplesReviewed:review.counterexampleSearchComplete}},evaluation:e};
}
export function writtenReport(report:Report,evaluation?:Evaluation,ledger:LedgerItem[]=[],collection?:Collection):string{
 const s=report.summary,ready=s.total!==null;const clean=(x:string)=>redact(x).replace(/[\r\n]+/g,' ').replace(/[。；]+$/g,'').replace(/。([。；])/g,'$1');
 const lines=['# AI Native Score 本地评价','',report.kind==='synthetic'||collection?.report.kind==='synthetic'?'合成示例：所有事件和分数仅用于展示协议与计算，不评价任何真实用户。':'私密评估：仅适用于本次明确选定的范围。',ready?`可以负责的结论：本次选定范围满足评分门槛，总分 ${s.total} / 100。`:'可以负责的结论：证据不足，暂不评分。当前只能说明观察到的行为与缺口；没有证据不代表能力低。','',`评分版本：${VERSION}。原创综合指标，非认证、未经测量效度验证。`,`指标证据覆盖：${Math.round(s.coverage*100)}%；证据质量：${({low:'低',medium:'中',high:'高',unknown:'未知'} as const)[s.confidence]}（不是概率）。记录数量和耗时不加分。`,''];
 lines.push('## 覆盖与遗漏','',`时间范围：${collection?.scope?collection.scope.from+' 至 '+collection.scope.to+'（UTC）':'未提供，不能推断完整时间覆盖'}。`,`读取文件：${collection?.stats.files??'未知'}；去敏记录：${ledger.length}；独立任务候选：${new Set(ledger.map(x=>evaluation?.taskGroups?.[x.task]??x.task)).size}。候选任务数不等于已核验有效任务数。`,`截断：${collection?.stats.truncated?'是，需缩小范围补查':'未报告截断'}；跳过：${collection?.stats.skipped??'未知'}。`,'');
 for(const source of collection?.sources??[])lines.push(`- ${clean(source.tool)} / ${clean(source.instance)}：适配 ${source.adapter}；授权 ${source.authorization}；读取 ${source.read}；去敏记录 ${source.records}。`);
 for(const source of collection?.discovery?.sources??[])lines.push(`- 发现 ${clean(source.tool)} / ${clean(source.instance)}：${source.discovery}；适配 ${source.adapter??'未适配'}；授权 ${source.authorization}；读取 ${source.read}${source.exportRequired?'；需选定导出或格式适配':''}。`);
 lines.push(...(collection?.diagnostics??[]).map(x=>`- 排除/遗漏：${clean(x.reason)}；具体路径保存在私密 collection 文件。`),'',collection?.discovery?'发现清单中的 not-granted/not-read 描述发现时状态；授权读取结果描述本轮收集状态。未知或不可访问来源不扣能力分。':'未执行真实环境发现，覆盖只限这里明确列出的来源；其它环境可能遗漏，不能据此推断能力低。','');
 if(evaluation)lines.push(`审阅闭合：已审事件 ${evaluation.review.reviewedEvidence.length}；明确排除 ${evaluation.review.excludedEvidence.length}；任务家族 ${evaluation.review.taskFamiliesFinalized?'已定稿':'未完成'}；反证检索 ${evaluation.review.counterexampleSearchComplete?'已完成':'未完成'}。清单保存在同目录 evaluation.private.json 的 review 字段。`,'',...evaluation.review.excludedEvidence.map(x=>`- 排除 ${x.id}：${clean(x.reason)}。`),'');
 const titles={strengths:'真实强项',gaps:'缺口与反例',workPatterns:'工作中的行为模式',lifePatterns:'生活中的行为模式'};
 for(const [key,title] of Object.entries(titles)){const entries=evaluation?.narrative[key as keyof Evaluation['narrative']]??[];lines.push(`## ${title}`,'',...(entries.length?entries.map(t=>'- '+clean(t)):['尚无足够可回链证据支持此类结论。']),'');}
 lines.push('## 优先行动与验证','');
 if(evaluation)for(const [i,p] of evaluation.priorities.entries())lines.push(`${i+1}. ${clean(p.action)} 验证：${clean(p.verify)}。依据：${p.evidence.join(', ')||'当前覆盖缺口，非能力缺陷'}。`);
 else lines.push('1. 选择一个明确日期范围和实际任务，补齐用户决策、执行结果与人类后续核验；验证：三类记录能回链到同一任务。','2. 对未读取工具导出所选任务的 JSON/JSONL，检查去敏后再授权收集；验证：来源、日期、角色与遗漏均有记录。');
 if(!ready)lines.push('','下一步：缩小日期范围补查或从未适配工具导出。未生成任何临时总分、维度分、分数区间、雷达或可上传聚合文件。');
 lines.push('','## 六维定性分析','');
 AXES.forEach((a,i)=>{lines.push(`### ${a}${ready?' · '+Math.round(s.dimensions[i]!)+'/100':''}`,'');INDICATORS[i].forEach((name,j)=>{const r=report.ratings[i][j],d=evaluation?.decisions.find(d=>d.axis===i&&d.indicator===j);lines.push(`- ${name}：${ready?r.value+' / 4':r.value===null?'待补证据':'已观察到相关行为，整体暂不评分'}。${d?clean(d.rationale):'结构元数据不足以证明实际能力。'}`);if(d)lines.push(`  人类贡献：${clean(d.humanContribution)}；agent 活动：${clean(d.agentActivity)}；结果：${clean(d.outcome)}。`,`  为何不足下一级：${clean(d.nextLevelGap)}；反证：${d.counterexamples.join(', ')||'未发现，不代表不存在'}；检索：${clean(d.counterReview)}；冲突：${({'none-found':'未发现','resolved':'已处置','unresolved':'未解决'} as const)[d.conflict]}。`,`  不确定性：${clean(d.uncertainty)}；改进：${clean(d.improvement.action)}；验证：${clean(d.improvement.verify)}；依据：${d.support.join(', ')||'无'}。`);if(d)for(const o of d.observations)lines.push(`  核验链：${o.behavior} → ${o.result} → ${o.verification}；方法 ${o.verificationMethod==='human-followup'?'用户后续复核':'独立产物核查'}；支持范围：${clean(o.scope)}。`);});lines.push('');});
 lines.push('评分停止条件：任一指标缺证、低质量、冲突未解决、行为链不完整、输入截断、读取失败，或材料审阅及任务家族未闭合，均不出整体数值。导入记录的“材料未外部认证”表示来源标签本身不证明真实性；评估核验链描述本次采用的后续复核证据，不能视为真实性认证。','','## 限制与来源','',...(evaluation?.narrative.limitations??['本次尚未完成行为核验。']).map(t=>'- '+clean(t)),'','公开标准提供概念启发；24项指标、锚点与计分由本项目原创综合。UNESCO、OECD、DigComp、NIST及Anthropic均未认证或背书本评分。具体来源、指标映射和许可边界见随包 THIRD_PARTY.md。','去敏尽力而为，不能保证绝对安全。收集器只读且零网络；若由云模型评估，去敏材料仍进入该服务商上下文。','','## 本地证据附录','');
 for(const x of ledger)lines.push(`- ${x.id}：${x.date} / ${clean(x.instance)} / 任务 ${x.task} / ${x.actor} / ${x.type??'unknown'} / 导入状态：${x.verification==='verified'?'材料声明已核验':'材料未外部认证'}；定位：${clean(x.locator??'未保留，需补查')}；事实：${clean(x.text)}。支持范围和反证见以上决策，原文仅作非可信材料。`);
 lines.push('','本报告、评估和账本仅供本地检查，可能包含个人信息。公开需另行确认准确聚合字段与目标。');return lines.join('\n');
}
