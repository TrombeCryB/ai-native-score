import {writeFile} from 'node:fs/promises';
import {fixture} from '../tests/fixtures.js';
import {applyEvaluation,writtenReport} from '../src/evaluate.js';
import {publicScore} from '../src/model.js';
import {reportHtml} from '../src/report.js';
import {radarSvg} from '../src/visual.js';
const {collection,evaluation}=fixture();const {report}=applyEvaluation(collection,evaluation);report.kind='synthetic';
await writeFile('examples/collection.synthetic.json',JSON.stringify(collection,null,2));
await writeFile('examples/evaluation.synthetic.json',JSON.stringify(evaluation,null,2));
await writeFile('examples/report.synthetic.json',JSON.stringify(report,null,2));
await writeFile('examples/public-score.synthetic.json',JSON.stringify(publicScore(report),null,2));
await writeFile('examples/report.synthetic.md',writtenReport(report,evaluation,collection.ledger,collection));
await writeFile('examples/radar.synthetic.svg',radarSvg(report.summary));
await writeFile('examples/scope.synthetic.json',JSON.stringify({mode:'structure',projects:['/absolute/selected/project'],agents:[],histories:[],from:'2026-10-01',to:'2026-10-14'},null,2));

await writeFile('examples/report.synthetic.html',reportHtml(report,evaluation,collection));
const incomplete=structuredClone(evaluation);incomplete.decisions[0].value=null;const pending=applyEvaluation(collection,incomplete);
await writeFile('examples/needs-evidence.synthetic.html',reportHtml(pending.report,pending.evaluation,collection));
await writeFile('examples/needs-evidence.synthetic.md',writtenReport(pending.report,pending.evaluation,collection.ledger,collection));
