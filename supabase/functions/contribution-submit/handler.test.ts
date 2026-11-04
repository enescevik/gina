import {createContributionHandler,type ContributionDeps} from './index.ts';
import {renderSvg} from '../_shared/review-renderer.ts';
import {inspectSource} from '../_shared/source-file.ts';
import {base64,canonicalLibraryPng} from '../library-media/png.ts';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNwcHAAAAGEAMGDX2mUAAAAAElFTkSuQmCC'),x=>x.charCodeAt(0));
const image={id:id(4),sha256:'890c8dc04fe5952ec0d0af6efac019b10bb3287d116b22adcca2e1bd5effdeb8',width:1,height:1,bytes:bytes.length,mime:'image/png'};
const input={id:id(3),question_id:id(5),rights:true,no_personal_data:true};
function fixture(){const calls:string[]=[];let media:unknown;const deps:ContributionDeps={parent:async()=>({familyId:id(1),userId:id(2)}),begin:async()=>{calls.push('begin');return{id:id(3),status:'preparing',snapshot:{images:[image]}};},image:async()=>{calls.push('image');return bytes;},render:async()=>{calls.push('render');return bytes;},finish:async(_p,_id,m)=>{calls.push('finish');media=m;return{id:id(3),status:'pending'};}};return{deps,calls,media:()=>media,run:(body:unknown=input)=>createContributionHandler(deps)(new Request('https://local/contribution-submit',{method:'POST',body:JSON.stringify(body)}))};}
function equal(a:unknown,b:unknown){if(JSON.stringify(a)!==JSON.stringify(b))throw Error(JSON.stringify({a,b}));}
Deno.test('parent and explicit sharing consent required before snapshot or download',async()=>{const f=fixture();equal((await f.run({...input,rights:false})).status,400);equal(f.calls,[]);f.deps.parent=async()=>null;equal((await f.run()).status,403);equal(f.calls,[]);});
Deno.test('caller cannot inject URL, actor or media',async()=>{for(const key of ['url','actor','media']){const f=fixture();equal((await f.run({...input,[key]:'bad'})).status,400);equal(f.calls,[]);}});
Deno.test('finished receipt skips source and rendering on retry',async()=>{const f=fixture();f.deps.begin=async()=>({id:id(3),status:'pending',snapshot:{images:[]}});equal((await f.run()).status,200);equal(f.calls,[]);});
Deno.test('source digest mismatch cannot produce a moderation copy',async()=>{const f=fixture();f.deps.begin=async()=>({id:id(3),status:'preparing',snapshot:{images:[{...image,sha256:'f'.repeat(64)}]}});equal((await f.run()).status,400);equal(f.calls,['image']);});
Deno.test('verified independent PNG completes without copying source path or identity',async()=>{const f=fixture();equal((await f.run()).status,200);equal(f.calls,['begin','image','render','finish']);equal(Object.keys(f.media() as object).sort(),['base64','height','sha256','width']);});
Deno.test('withdrawal during rendering remains rejected at commit',async()=>{const f=fixture();f.deps.finish=async()=>{throw Error('contribution_changed');};const r=await f.run();equal(r.status,400);equal(await r.json(),{error:'contribution_changed'});});
Deno.test('oversized rendered media fails instead of reducing reading detail',async()=>{const f=fixture();f.deps.render=async()=>new Uint8Array(524289);equal(await (await f.run()).json(),{error:'contribution_size'});equal(f.calls.includes('finish'),false);});
Deno.test('real renderer preserves two ordered images and the empty gap',async()=>{
 const f=fixture();f.deps.begin=async()=>({id:id(3),status:'preparing',snapshot:{images:[image,{...image,id:id(6)}]}});f.deps.render=renderSvg;
 const response=await f.run();equal(response.status,200);const media=f.media() as {base64:string;width:number;height:number};equal([media.width,media.height],[1,26]);
 const png=Uint8Array.from(atob(media.base64),x=>x.charCodeAt(0));const info=await inspectSource(png,'image/png');equal([info.width,info.height],[1,26]);
 // Compare to a separately rendered white image: an ignored image href must fail.
 const white=await renderSvg('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="26"><rect width="1" height="26" fill="white"/></svg>');
 if(base64(png)===base64(await canonicalLibraryPng(white)))throw Error('embedded images disappeared');
});
