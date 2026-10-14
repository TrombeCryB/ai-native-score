// Scan only explicit public source inputs. Never search the user's home or private reports.
import {readdir,readFile,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir} from 'node:os';
const roots=['README.md','LICENSE','THIRD_PARTY.md','package.json','package-lock.json','tsconfig.json','.gitignore','.github','src','scripts','schemas','skill','docs','examples','tests'];
const patterns=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\bsk-[A-Za-z0-9_-]{20,}\b/,/\bgh[pousr]_[A-Za-z0-9]{20,}\b/,/\bgithub_pat_[A-Za-z0-9_]{30,}\b/,/\bAKIA[A-Z0-9]{16}\b/,/https?:\/\/[^\s/'"]+:[^\s/'"]+@/];
let count=0;const findings=[];async function visit(p){const stat=await lstat(p);if(stat.isSymbolicLink())throw Error('Public source contains symlink');if(stat.isDirectory()){for(const e of await readdir(p))await visit(join(p,e));return;}count++;if(/\.(jpg|png|svg)$/.test(p))return;const text=await readFile(p,'utf8');for(const rule of patterns)if(rule.test(text)||text.includes(homedir()+'/'))findings.push({file:p,rule:'credential-or-private-path'});}
for(const p of roots)await visit(p);if(findings.length){console.log(JSON.stringify({passed:false,findings}));process.exitCode=1;}else console.log(JSON.stringify({passed:true,publicFiles:count,privateDirectoriesNotRead:true}));
