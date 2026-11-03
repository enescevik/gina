import { spawnSync } from 'node:child_process';
const result=spawnSync('pnpm',['audit','--json'],{encoding:'utf8',maxBuffer:8*1024*1024});
let report;try{report=JSON.parse(result.stdout);}catch{throw Error('Dependency audit unavailable; no clean result was established.');}
if(report.error||result.status===null||result.status>1||!report.metadata?.vulnerabilities||!report.advisories)throw Error('Dependency audit unavailable');
let blocked=0;
for(const advisory of Object.values(report.advisories??{})){
 console.log(`${advisory.severity}: ${advisory.module_name} ${advisory.url}`);
 if(['high','critical'].includes(advisory.severity))blocked++;
}
if(blocked)process.exitCode=1;
