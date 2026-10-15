import {build} from 'esbuild';
import {mkdir,copyFile} from 'node:fs/promises';
const root='skill/ai-native-score';
await mkdir(root+'/scripts',{recursive:true});await mkdir(root+'/references',{recursive:true});
await build({entryPoints:['src/cli.ts'],bundle:true,format:'esm',platform:'node',outfile:root+'/scripts/cli.mjs'});
for(const [source,target]of [['scripts/full_evidence.py','scripts/full_evidence.py'],['docs/full-evidence.md','references/full-evidence.md'],['scripts/hermes_read.py','scripts/hermes_read.py'],['docs/methodology.md','references/methodology.md'],['docs/privacy.md','references/privacy.md'],['docs/behavior-anchors.md','references/behavior-anchors.md'],['docs/report-guide.md','references/report-guide.md'],['schemas/evaluation.schema.json','references/evaluation.schema.json'],['THIRD_PARTY.md','THIRD_PARTY.md'],['LICENSE','LICENSE']])await copyFile(source,root+'/'+target);
