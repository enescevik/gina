// Explicit, unauthenticated deployment smoke check. Never invokes an authorized
// worker or supplies a purchase, child, account deletion, or generation payload.
import { spawnSync } from 'node:child_process';
const project=process.argv.find(v=>v.startsWith('--project-ref='))?.split('=')[1];
if(!/^[a-z]{20}$/.test(project??'')||!process.argv.includes('--run'))throw Error('Explicit project and --run required');
const cli=spawnSync('pnpm',['exec','supabase','projects','api-keys','--project-ref',project,'--output','json'],{encoding:'utf8'});
if(cli.status!==0)throw Error('Credential lookup failed; output withheld');
const anon=JSON.parse(cli.stdout).find(k=>k.name==='anon')?.api_key;
if(!anon)throw Error('Public project key unavailable');
const names=['ai-weekly-summary','apple-notifications','delete-account','google-rtdn','iap-reconcile','iap-verify','iap-operator-reconcile','prova-generate','prova-grade','prova-plan','push-send','setup-suggestions','learning-source','source-cleanup','timetable-import','learning-plan-import','prova-review','library-media','contribution-submit'];
const checks=[];
for(let i=0;i<names.length;i+=3){
  checks.push(...await Promise.all(names.slice(i,i+3).map(async name=>{
    try{
      const r=await fetch(`https://${project}.supabase.co/functions/v1/${name}`,{
        method:'POST',headers:{apikey:anon,authorization:`Bearer ${anon}`,'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(20000),
      });
      // Keep only the known non-sensitive configuration code; never a raw body.
      let code;try{code=(await r.json())?.error;}catch{}
      const configurationMissing=name==='google-rtdn'&&r.status===503&&code==='push_auth_not_configured';
      return {name,status:r.status,denied:r.status>=400&&r.status<500,configurationMissing};
    }catch{return {name,status:null,denied:false};}
  })));
}
console.log(JSON.stringify({project,checks,noAuthorizedBusinessOperation:true},null,2));
if(checks.some(c=>!c.denied))process.exitCode=1;
