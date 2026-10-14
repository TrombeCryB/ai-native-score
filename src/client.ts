import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {validatePublic,type PublicScore} from './model.js';
export const DEFAULT_SITE='https://ai-native-score.laolv-wenxiang.workers.dev';
export type Receipt={origin:string;id:string;token:string;payloadDigest:string};
type Transport=(url:string,init:RequestInit)=>Promise<Response>;
export function siteOrigin(site:string){const u=new URL(site);if(u.username||u.password||u.search||u.hash||u.pathname!=='/'||(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname))))throw Error('目标需为HTTPS站点或本机测试地址');return u.origin;}
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
export function publicationPlan(input:unknown,site:string){const score=validatePublic(input);const origin=siteOrigin(site);if(score.coverage!==1||score.total===null)throw Error('缺证据结果只保留本地，不进入完整评分排行');return {score,origin,confirmation:digest(origin+'\n'+JSON.stringify(score))};}
export function preparePublication(input:unknown,site:string,confirmation:string,existing?:Receipt){
 const plan=publicationPlan(input,site);if(confirmation!==plan.confirmation)throw Error('上传前需明确确认准确聚合字段和目标');
 const receipt=existing??{origin:plan.origin,id:randomUUID(),token:randomBytes(32).toString('hex'),payloadDigest:plan.confirmation};
 if(receipt.origin!==plan.origin||receipt.payloadDigest!==plan.confirmation||!/^[a-f0-9]{64}$/.test(receipt.token)||!/^[a-f0-9-]{36}$/.test(receipt.id))throw Error('重试凭据与提交不匹配');
 return {plan,receipt};
}
export async function sendPublication(prepared:ReturnType<typeof preparePublication>,transport:Transport=fetch){
 const {plan,receipt}=prepared;
 async function call(path:string,init:RequestInit){const r=await transport(plan.origin+path,{...init,headers:{Origin:plan.origin,'Content-Type':'application/json',...init.headers},signal:AbortSignal.timeout(15000)});const data=await r.json();if(!r.ok)throw Error('提交未完成，请保留凭据后重试');return data as any;}
 const c=await call('/api/challenge',{method:'POST',body:'{}'});
 if(!/^[a-f0-9-]{36}$/.test(c.id)||c.difficulty!==4||typeof c.expiresAt!=='number')throw Error('服务校验格式无效');
 let nonce=0;while(!digest(c.id+':'+nonce).startsWith('0'.repeat(c.difficulty))){if(++nonce>5000000||Date.now()/1000>c.expiresAt)throw Error('防滥用校验超时');}
 const result=await call('/api/submissions',{method:'POST',headers:{Authorization:'Bearer '+receipt.token},body:JSON.stringify({score:plan.score,confirmed:true,requestId:receipt.id,challengeId:c.id,nonce})});
 if(result.id!==receipt.id)throw Error('服务返回与提交不匹配，保留凭据检查');
 return {id:receipt.id,url:plan.origin+'/#'+receipt.id};
}
export async function deletePublication(receipt:Receipt,confirmation:string,transport:Transport=fetch){
 if(confirmation!==receipt.id||!/^[a-f0-9-]{36}$/.test(receipt.id)||!/^[a-f0-9]{64}$/.test(receipt.token))throw Error('需要确认对应记录ID');
 const origin=siteOrigin(receipt.origin);const r=await transport(origin+'/api/submissions/'+receipt.id,{method:'DELETE',headers:{Origin:origin,Authorization:'Bearer '+receipt.token},signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('记录不存在或凭据不匹配');return {deleted:true};
}
