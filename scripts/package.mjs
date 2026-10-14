import {mkdir} from 'node:fs/promises';import {execFileSync} from 'node:child_process';
const identity=process.platform==='darwin'?['--uid','0','--gid','0','--uname','root','--gname','root']:['--owner=0','--group=0'];
await mkdir('release',{recursive:true});
const inputs=['README.md','LICENSE','THIRD_PARTY.md','package.json','package-lock.json','tsconfig.json','.gitignore','.github','src','scripts','schemas','skill','docs','examples','tests'];
execFileSync('tar',[...identity,'-czf','release/ai-native-score-source.tgz',...inputs]);execFileSync('tar',[...identity,'-czf','release/ai-native-score-skill.tgz','-C','skill','ai-native-score']);
const listing=execFileSync('tar',['-tzf','release/ai-native-score-source.tgz'],{encoding:'utf8'});
if(listing.split('\n').some(p=>/(^|\/)(public|migrations|reports|\.wrangler|node_modules|scope\.local\.json|.*\.receipt\.json|wrangler\.jsonc|worker\.ts|web\.ts)(\/|$)/.test(p)))throw Error('Private or website input entered skill package');
console.log(JSON.stringify({skillOnly:true,privateAndWebsiteInputsExcluded:true}));
