import {unknownRatings,summarize,VERSION,type Report} from '../src/model.js';
import type {Collection,LedgerItem} from '../src/collector.js';
import type {Evaluation} from '../src/evaluate.js';
export function fixture(){
 const ledger:LedgerItem[]=Array.from({length:6},(_,i)=>({id:'e'+(i+1),task:'synthetic-task-'+Math.floor(i/2),date:'2026-10-01',actor:i%2?'agent':'human',instance:i<4?'codex':'default',text:i%2?'合成 agent 产出，已报告检查与限制。':'合成人类任务：明确目标、范围、验收，要求检查并保留控制。',untrusted:true}));
 const ratings=unknownRatings();const report:Report={schemaVersion:1,scoringVersion:VERSION,kind:'synthetic',ratings,evidence:[],summary:summarize(ratings)};
 const collection:Collection={report,ledger,stats:{files:3,bytes:1024,skipped:0,truncated:false}};
 const evaluation:Evaluation={decisions:Array.from({length:24},(_,i)=>({axis:Math.floor(i/4),indicator:i%4,value:[3,3,3,2,3,2][Math.floor(i/4)],quality:'medium',support:['e1','e3','e5','e2','e4','e6'],counterexamples:[],rationale:'合成案例仅演示评级与计算，不是用户真实证据。',humanContribution:'合成人类制定目标、判断边界并复核。',agentActivity:'合成 agent 按阶段产出并报告限制。',outcome:'合成结果已按验收标准检查。'})),narrative:{strengths:['样例体现目标与上下文清晰，能够把重复工作转化为可复用资产（e1/e3/e5）。'],gaps:['样例中独立验证与权限取舍仍需具体结果支撑；不要把 agent 自称完成视为可靠验收。'],workPatterns:['合成工作模式：先定义目标、逐步编排，再复核交付；跨任务复用已有流程。'],lifePatterns:['合成生活模式：在实际限制中使用 AI 进行规划，由人保留关键决策。'],actions:['下一周选择两项任务，在开始时写下验收标准，结束时保留独立核验结果与一次失败复盘。'],limitations:['这是合成展示，不能当作真实行为评估。']}};
 return {collection,evaluation};
}
