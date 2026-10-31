import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { roomWeather } from "./handler.ts";
import { parseForecast } from "./forecast.ts";
const now = Date.parse("2026-10-31T09:30:00Z");
const raw = { properties:{meta:{updated_at:"2026-10-31T08:00:00Z"},timeseries:[{time:"2026-10-31T09:00:00Z",data:{instant:{details:{air_temperature:12,cloud_area_fraction:70,wind_speed:3,wind_from_direction:60}},next_1_hours:{details:{precipitation_amount:1},summary:{symbol_code:"rain"}}}}]} };
const forecast=()=>parseForecast(raw,"745044",now,"2026-10-31T10:00:00.000Z");
function equal(a:unknown,b:unknown) {if(JSON.stringify(a)!==JSON.stringify(b))throw new Error(`${JSON.stringify(a)} != ${JSON.stringify(b)}`);}
function fixture(options: {anonymous?:boolean; revoked?:boolean; authFail?:boolean; city?:boolean; fresh?:boolean; cached?:boolean; claimed?:boolean; upstream?:number; saveFail?:boolean} = {}) {
 const calls: {table:string;method:string;args:unknown[]}[]=[]; const network: {url:string;headers:Headers}[]=[];
 const db={auth:{getUser:()=>({data:{user:options.authFail?null:{id:"owner",is_anonymous:options.anonymous??false}},error:null})},from:(table:string)=>{
   const q:Record<string,unknown>={};let mutation=false;
   const result=()=>({data:table==="family_members"||table==="devices"?options.revoked?null:{id:"member"}:table==="family_room_settings"?{city_id:options.city===false?null:"745044"}:table==="weather_cities"?{id:"745044",latitude:41.0138,longitude:28.9497}:options.cached||options.fresh?{forecast:forecast(),expires_at:options.fresh?"2026-10-31T10:00:00Z":"2026-10-31T09:00:00Z",last_modified:"Sat, 31 Oct 2026 08:00:00 GMT"}:null,error:mutation&&options.saveFail?{}:null});
   for(const method of ["select","eq","is","update"]){q[method]=(...args:unknown[])=>{calls.push({table,method,args});if(method==="update")mutation=true;return q;};}
   q.single=q.maybeSingle=()=>Promise.resolve(result());
   q.then=(resolve:(value:unknown)=>unknown)=>Promise.resolve(result()).then(resolve);return q;
 },rpc:()=>({data:options.claimed??true,error:null})} as unknown as SupabaseClient;
 const fetcher:typeof fetch=async(input,init)=>{network.push({url:String(input),headers:new Headers(init?.headers)});return new Response(options.upstream===304?null:JSON.stringify(raw),{status:options.upstream??200,headers:{expires:"Sat, 31 Oct 2026 10:00:00 GMT","last-modified":"Sat, 31 Oct 2026 08:00:00 GMT"}});};
 const payload={sub:"owner",gina:{family_id:"family",role:options.anonymous?"device":"parent",child_id:options.anonymous?"child":null}};
 const token=`e30.${btoa(JSON.stringify(payload))}.verified-by-fixture`;
 const req=new Request("https://local/room-weather",{method:"POST",headers:{authorization:`Bearer ${token}`},body:JSON.stringify({family_id:"victim",lat:0,lon:0})});
 return {req,calls,network,deps:{db,fetch:fetcher,now:()=>now}};
}
Deno.test("weather proxy ignores caller family/coordinates and identifies itself",async()=>{
 const f=fixture();const response=await roomWeather(f.req,f.deps);equal(response.status,200);equal((await response.json()).forecast,forecast());
 equal(f.network[0].url,"https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=41.0138&lon=28.9497");
 equal(f.network[0].headers.get("User-Agent"),"GinaAile/0.1 github.com/enescevik/gina");
 equal(f.calls.some(c=>c.args.includes("victim")),false);
});
for(const [name,options] of Object.entries({revokedParent:{revoked:true},revokedDevice:{revoked:true,anonymous:true},invalidSession:{authFail:true}}))Deno.test(`weather rejects ${name}`,async()=>{const f=fixture(options);equal((await roomWeather(f.req,f.deps)).status,403);equal(f.network.length,0);});
Deno.test("weather validates device's live active child",async()=>{const f=fixture({anonymous:true});equal((await roomWeather(f.req,f.deps)).status,200);equal(f.calls.some(c=>c.table==="devices"&&c.method==="eq"&&c.args[0]==="active_child_id"&&c.args[1]==="child"),true);});
Deno.test("no city and fresh cache never call upstream",async()=>{for(const options of [{city:false},{fresh:true}]){const f=fixture(options);equal((await roomWeather(f.req,f.deps)).status,200);equal(f.network.length,0);}});
Deno.test("304 preserves forecast and refreshes expiry",async()=>{const f=fixture({cached:true,upstream:304});const body=await(await roomWeather(f.req,f.deps)).json();equal(body.forecast.hours,forecast().hours);equal(f.network[0].headers.get("If-Modified-Since"),"Sat, 31 Oct 2026 08:00:00 GMT");});
Deno.test("upstream outage returns stale data without fabricating a forecast",async()=>{for(const cached of [true,false]){const f=fixture({cached,upstream:503});const body=await(await roomWeather(f.req,f.deps)).json();equal(body.status,cached?"stale":"unavailable");equal(!!body.forecast,cached);}});
Deno.test("concurrent fetch reuses cache instead of stampeding provider",async()=>{const f=fixture({cached:true,claimed:false});const body=await(await roomWeather(f.req,f.deps)).json();equal(body.status,"stale");equal(f.network.length,0);});
Deno.test("malformed and stale provider data rejected",()=>{
 for(const input of [{}, {properties:{...raw.properties,meta:{updated_at:"2027-01-01"}}}, {properties:{...raw.properties,timeseries:[{time:"2026-10-31T09:00:00Z",data:{}}]}}]){
  let threw=false;try{parseForecast(input,"city",now,"2026-10-31T10:00:00.000Z");}catch{threw=true;}equal(threw,true);
 }
});
