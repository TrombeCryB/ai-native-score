export const VERSION = 'am-0.2';
export const AXES = ['目标与委派','上下文表达','工作流编排','评估与判断','学习与复用','安全与责任'] as const;
export const INDICATORS = [
 ['目标与验收标准','按能力限制选择工具','分配人机责任','约束、取舍和停止条件'],
 ['相关输入及来源','受众、格式、约束与示例','识别缺失、过期、矛盾','更新上下文并区分材料性质'],
 ['合理阶段与依赖','端到端集成产出','检查点、失败恢复与升级','复杂度、耗时、成本与维护权衡'],
 ['对实际验收标准检查','独立验证、负例与边界','识别错误、不确定性与偏差','修正并复核最终结果'],
 ['重复需要转为复用资产','跨任务适配','用失败反馈改进','维护版本、示例、评估与知识'],
 ['数据与秘密最小暴露','权限、审批、可逆性与监督','正确处理非可信内容','责任、来源、披露及权利影响']
] as const;
export type Rating = {value:number|null; confidence:number; evidence:string[]; basis:'declared'|'observed'|'self-report'|'unknown'};
export type Evidence = {id:string; source:'project-structure'|'agent-structure'|'workflow-record'; fact:string; strength:'structure'|'declaration'|'observation'};
export type Report = {schemaVersion:1; scoringVersion:string; kind:'local-assessment'|'synthetic'; ratings:Rating[][]; evidence:Evidence[]; summary:Summary;assessmentGate?:{status:'ready'|'blocked';reviewComplete:boolean;familiesFinalized:boolean;counterexamplesReviewed:boolean}};
export type Confidence='low'|'medium'|'high'|'unknown';
export type Summary = {dimensions:(number|null)[]; total:number|null; interval:[number,number]|null; coverage:number; confidence:Confidence};
export type PublicScore = {scoringVersion:string; kind:'local-assessment'|'self-report'; dimensions:(number|null)[]; total:number|null; interval:[number,number]|null; coverage:number; confidence:Confidence; nickname?:string};
export function summarize(ratings:Rating[][]):Summary {
 if(ratings.length!==6 || ratings.some(a=>a.length!==4)) throw Error('需要六轴、每轴四指标');
 let sum=0, known=0, conf=0;
 const dimensions = ratings.map(axis=>{
  let n=0,s=0;
  for(const r of axis){
   if(r.value===null){if(r.confidence!==0) throw Error('未知指标置信度必须为零');continue;}
   if(!Number.isInteger(r.value)||r.value<0||r.value>4||!Number.isFinite(r.confidence)||r.confidence<0||r.confidence>1)throw Error('指标无效');
   n++;s+=r.value;sum+=r.value;known++;conf+=r.confidence;
  }
  return n ? round(25*s/n) : null;
 });
 const ready=known===24&&ratings.flat().every(r=>r.basis==='observed'&&r.confidence>=0.5&&r.evidence.length>0);
 return {dimensions:ready?dimensions:AXES.map(()=>null),total:ready?Math.round(100*sum/96):null,interval:ready?[round(100*sum/96),round(100*sum/96)]:null,coverage:round(known/24),confidence:known?(conf/known>=0.8?'high':conf/known>=0.5?'medium':'low'):'unknown'};
}
export const round=(n:number)=>Math.round(n*1000)/1000;
export const unknownRatings=():Rating[][]=>AXES.map(()=>Array.from({length:4},()=>({value:null,confidence:0,evidence:[],basis:'unknown'})));
export function publicScore(report:Report,nickname=''):PublicScore {
 validateReport(report);
 const s=summarize(report.ratings);
 if(s.total===null)throw Error('证据不足：禁止导出或上传数值评分');
 const result:PublicScore={scoringVersion:report.scoringVersion,kind:'local-assessment',...s};
 if(nickname.trim())result.nickname=nickname.trim();
 return validatePublic(result);
}
const record=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const keys=(x:Record<string,unknown>,allowed:string[])=>Object.keys(x).every(k=>allowed.includes(k));
const num=(x:unknown,max=100)=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=max;
export function validatePublic(x:unknown):PublicScore {
 if(!record(x)||!keys(x,['scoringVersion','kind','dimensions','total','interval','coverage','confidence','nickname']))throw Error('仅允许聚合字段');
 if(x.scoringVersion!==VERSION||!['local-assessment','self-report'].includes(String(x.kind)))throw Error('评分版本或类型无效');
 if(!Array.isArray(x.dimensions)||x.dimensions.length!==6||!x.dimensions.every(v=>v===null||num(v)))throw Error('维度无效');
 if(!Array.isArray(x.interval)||x.interval.length!==2||!x.interval.every(v=>num(v))||x.interval[0]>x.interval[1])throw Error('区间无效');
 if(!num(x.coverage,1)||!['low','medium','high','unknown'].includes(String(x.confidence))||(x.total!==null&&!num(x.total)))throw Error('聚合值无效');
 if(x.coverage!==1||x.total===null||x.confidence==='low'||x.confidence==='unknown')throw Error('证据不足不允许公开评分');
 if(Number(x.coverage)<1&&x.total!==null)throw Error('证据不完整时总分必须为未知');
 if(x.coverage===1&&(x.dimensions.some(v=>v===null)||x.total===null||Math.round((x.dimensions as number[]).reduce((a,b)=>a+b,0)/6)!==x.total||x.interval.some(v=>Math.abs(v-(x.dimensions as number[]).reduce((a,b)=>a+b,0)/6)>0.002)))throw Error('总分不一致');

 if(x.nickname!==undefined&&(typeof x.nickname!=='string'||Array.from(x.nickname).length>24||/[\p{C}<>]/u.test(x.nickname)))throw Error('昵称限24字符且不能包含控制符或HTML');
 return x as PublicScore;
}
export function validateReport(x:unknown):Report {
 if(!record(x)||!keys(x,['schemaVersion','scoringVersion','kind','ratings','evidence','summary','assessmentGate'])||x.schemaVersion!==1||x.scoringVersion!==VERSION||!['local-assessment','synthetic'].includes(String(x.kind)))throw Error('本地报告版本无效');
 if(!Array.isArray(x.evidence))throw Error('证据无效');
 const ids=new Set<string>();
 for(const e of x.evidence){if(!record(e)||!keys(e,['id','source','fact','strength'])||typeof e.id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:@|/#=-]{0,255}$/.test(e.id)||ids.has(e.id)||typeof e.fact!=='string'||e.fact.length>160||!['project-structure','agent-structure','workflow-record'].includes(String(e.source))||!['structure','declaration','observation'].includes(String(e.strength)))throw Error('证据结构无效');ids.add(e.id);}
 if(!Array.isArray(x.ratings)||x.ratings.length!==6||x.ratings.some(a=>!Array.isArray(a)||a.length!==4))throw Error('指标结构无效');
 for(const a of x.ratings)for(const r of a){if(!record(r)||!keys(r,['value','confidence','evidence','basis'])||!['declared','observed','self-report','unknown'].includes(String(r.basis))||!Array.isArray(r.evidence)||!r.evidence.every(id=>typeof id==='string'&&ids.has(id))||typeof r.confidence!=='number')throw Error('指标证据无效');if(r.value!==null&&r.basis!=='self-report'&&!r.evidence.length)throw Error('已知指标必须有证据');if(r.value===null&&r.basis!=='unknown')throw Error('未知指标来源无效');}
 const summary=summarize(x.ratings as Rating[][]);
 if(summary.total!==null&&(!record(x.assessmentGate)||x.assessmentGate.status!=='ready'||x.assessmentGate.reviewComplete!==true||x.assessmentGate.familiesFinalized!==true||x.assessmentGate.counterexamplesReviewed!==true))throw Error('报告未通过审阅与任务家族就绪门槛');
 if(JSON.stringify(x.summary)!==JSON.stringify(summary))throw Error('汇总与指标不一致');
 return x as Report;
}

// Read-only compatibility for historical entries; never accepted for new publication.
export function validateHistoricalPublic(x:unknown):PublicScore {
 if(!record(x))throw Error('历史记录无效');
 if(x.scoringVersion===VERSION)return validatePublic(x);
 if(x.scoringVersion!=='am-0.1')throw Error('未知历史版本');
 validatePublic({...x,scoringVersion:VERSION});return x as PublicScore;
}
