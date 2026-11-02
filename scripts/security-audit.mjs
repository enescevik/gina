import { spawnSync } from 'node:child_process';
const result=spawnSync('pnpm',['audit','--json'],{encoding:'utf8',maxBuffer:8*1024*1024});
let report;try{report=JSON.parse(result.stdout);}catch{throw Error('Dependency audit unavailable; no clean result was established.');}
if(report.error||result.status===null||result.status>1||!report.metadata?.vulnerabilities||!report.advisories)throw Error('Dependency audit unavailable');
let blocked=0;
for(const advisory of Object.values(report.advisories??{})){
 const findings=advisory.findings??[];
 // Temporary, exact-path waiver: Expo CLI consumes Zod v3 APIs. A blanket v4
 // override is incompatible. No waiver for a runtime or newly introduced path.
 const cliOnly=String(advisory.id)==='1243066'&&Date.now()<Date.parse('2026-11-16T00:00:00Z')&&findings.length>0&&findings.every(f=>f.version==='3.25.76'&&f.paths.length>0&&f.paths.every(p=>p==='apps__mobile>expo>@expo/cli>zod'));
 console.log(`${advisory.severity}: ${advisory.module_name} ${advisory.url}${cliOnly?' — temporary Expo CLI waiver (2026-11-16)':''}`);
 if(['high','critical'].includes(advisory.severity)&&!cliOnly)blocked++;
}
if(blocked)process.exitCode=1;
