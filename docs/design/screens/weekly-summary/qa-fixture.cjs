// Synthetic network only. No family records, provider calls, or credits are used.
module.exports=async(page,base)=>{
 await base(page);
 const day=new Date(); day.setUTCHours(12,0,0,0); day.setUTCDate(day.getUTCDate()-((day.getUTCDay()+6)%7)-7);
 const weeks=Array.from({length:8},(_,i)=>{const d=new Date(day);d.setUTCDate(d.getUTCDate()-i*7);return d.toISOString().slice(0,10)});
 const state={calls:[],phase:'empty',lost:false,readFails:false,allow:true,remaining:5};
 const children=[{alias:'Çocuk A',name:'Ece',grade:2,stars_earned:12,tasks:[{status:'approved',count:4},{status:'done',count:1}]},{alias:'Çocuk B',name:'Can',grade:5,stars_earned:6,tasks:[{status:'approved',count:2},{status:'returned',count:1}]}];
 const summary={haftanin_ozeti:'Bu haftanın kayıtlarında altı görev onaylandı. Çocuk A’nın bir görevi onay bekliyor; Çocuk B’nin bir görevi birlikte yeniden ele alınabilir.',cocuk_basina:[{etiket:'Çocuk A',basarilar:['Dört görevi onaylandı; bu görevlerden 12 yıldız kazandı.'],zorlananlar:[],oneri:'Bu hafta keyif aldığı bir anı anlatması için söz verebilirsiniz.'},{etiket:'Çocuk B',basarilar:['İki görevi onaylandı; bu görevlerden 6 yıldız kazandı.'],zorlananlar:['Bir görevi yeniden ele alınmayı bekliyor.'],oneri:'Bu görevde hangi desteği istediğini sorabilirsiniz.'}],veliye_oneriler:['Gelecek hafta için birlikte tek, yapılabilir adım seçebilirsiniz.']};
 await page.route('https://ginaqa.supabase.co/rest/v1/rpc/get_family_weekly_review',async route=>{
  if(state.readFails)return route.abort('failed');
  const week=route.request().postDataJSON()?.p_week??weeks[0],phase=week===weeks[0]?state.phase:'empty';
  state.calls.push({kind:'read',week});
  const body={week_start:week,weeks,timezone:'Europe/Istanbul',state:phase,snapshot_at:phase==='empty'?null:new Date().toISOString(),children,
   summary:phase==='ready'?summary:null,remaining:state.remaining,can_generate:state.allow&&state.remaining>0&&['empty','failed'].includes(phase),access:!state.allow?'disabled':state.remaining===0?'quota':'available'};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.route('https://ginaqa.supabase.co/functions/v1/ai-weekly-summary',async route=>{
  state.calls.push({kind:'generate',body:route.request().postDataJSON()});state.phase='ready';state.remaining--;
  if(state.lost){state.lost=false;return route.abort('failed');}
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,summary})});
 });
 await page.goto('http://localhost:8098/parent/weekly-review');return state;
};
