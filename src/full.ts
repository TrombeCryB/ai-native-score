import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join} from 'node:path';
import {VERSION,unknownRatings,summarize} from './model.js';
import type {Collection} from './collector.js';
import type {Evaluation} from './evaluate.js';
export type FullCoverage={events:number;reviewed:number;excluded:number;families:number;rootSha256:string;manifest:string;volumes:number;bytes:number;reviewSha256:string;evaluationSha256:string};
async function run(args:string[]){
 const request=promisify(execFile)('python3',[join(import.meta.dirname,'../scripts/full_evidence.py'),...args],{maxBuffer:32*1024*1024,timeout:10*60*1000});
 request.child.stderr?.on('data',data=>process.stderr.write(String(data)));const result=await request;return JSON.parse(result.stdout);
}
export async function packEvidence(source:string,out:string):Promise<{manifest:string;complete:boolean}>{return run(['pack',source,out]);}
export async function prepareFull(source:string,evaluation:string,out:string,manifest=false):Promise<{collection:Collection;evaluation:Evaluation;coverage:FullCoverage}>{
 const p=await run([manifest?'manifest':'prepare',source,out,evaluation]);
 const c=p.collection as Collection;
 if(!c.stats||typeof c.stats.truncated!=='boolean'||!Array.isArray(c.ledger)||!p.coverage||!Number.isSafeInteger(p.coverage.events)||p.coverage.events<0)throw Error('全量集合格式无效');
 const ratings=unknownRatings();c.report={schemaVersion:1,scoringVersion:VERSION,kind:'local-assessment',ratings,evidence:[],summary:summarize(ratings)};
 c.fullEvidence=p.coverage;return p;
}
