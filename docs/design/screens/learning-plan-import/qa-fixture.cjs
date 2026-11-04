// Synthetic acceptance over the real Expo UI; never reaches a real family/database/provider.
module.exports=async(page,base)=>{
 const state=await base(page),id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const source={id:id(9101),name:'Haftanın çalışmaları.pdf',mime:'application/pdf'};
 const draft={items:[{kind:'homework',title:'Kesirleri pekiştirelim',subject:'Matematik',topic:'Birim kesirler',due_on:null,time:null,steps:['Kitaptaki iki örneği incele','5. sayfadaki üç soruyu çöz'],page:1,note:'Belgede “Cuma” yazıyor; kesin teslim tarihini kontrol edin.'},{kind:'study',title:'Ay’ın evrelerini gözlemle',subject:'Fen Bilimleri',topic:'Ay’ın evreleri',due_on:null,time:null,steps:['Evreleri sıraya koy','Gözlemini bir cümleyle yaz'],page:2,note:''}],warnings:['Teslim tarihi tam olarak yazılmadığı için boş bırakıldı.']};
 const view={id:id(9102),child_id:id(8903),source_id:source.id,locale:'tr',grade:5,status:'new',draft:null,applied:{}};
 state.importView=view;state.generations=0;state.importCalls=[];state.importLost=false;
 await page.route('https://ginaqa.supabase.co/**',async route=>{const path=new URL(route.request().url()).pathname,b=route.request().postDataJSON?.()??{};let data;
 if(path.endsWith('/learning_sources'))data=[source];
 else if(path.endsWith('/rpc/get_learning_plan_import'))data=view;
 else if(path.endsWith('/functions/v1/learning-plan-import')){state.generations++;view.status='done';view.draft=draft;data=view;}
 else if(path.endsWith('/rpc/apply_learning_plan_import')){
  if(state.rejectOnce){state.rejectOnce=false;return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({code:'P0001',message:'plan_date'})});}
  state.importCalls.push(b);data=state.receipts[b.p_request_id];if(!data){
   if(b.p_items.some(i=>view.applied[String(i.index)]))return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({code:'P0001',message:'plan_import_already_applied'})});
   for(const i of b.p_items){state.items.push({id:i.id,child_id:b.p_child_id,revision:1,content:i.content,updated_at:new Date().toISOString(),done_at:null,source});view.applied[String(i.index)]=i.id;}
   data={request:b.p_request_id,import:b.p_import_id,child:b.p_child_id,ids:b.p_items.map(i=>i.id)};state.receipts[b.p_request_id]=data;
  }
  if(state.importLost){state.importLost=false;return route.abort('failed');}
 }else return route.fallback();
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});});
 return state;
};
