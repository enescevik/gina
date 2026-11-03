// Use only with a Metro server configured for https://ginaqa.supabase.co.
module.exports=async page=>{
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const user=id(1),family=id(2),child=id(3),draftId=id(9),question=id(10),group=id(11);
 let record={id:draftId,version:1,exam_id:null,submitted_at:null,content:{childId:child,grade:5,title:'Birlikte tekrar edelim',purpose:'practice',format:'practice',subjects:['Matematik'],topics:[],target:3,minutes:null,difficulty:'orta',kind:'mixed',note:'',step:2,blocks:[]}};
 const requests=[];
 await page.route('https://ginaqa.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname,body=req.postDataJSON?.()??{};
  let data=[];
  if(path.endsWith('/rpc/get_prova_drafts'))data=[record];
  else if(path.endsWith('/rpc/save_prova_draft')){requests.push(body);record={...record,version:record.version+1,content:body.p_content};data=record;}
  else if(path.endsWith('/rpc/get_repeat_candidates'))data=[{kind:'question',id:question,title:'Bir üçgenin çevresini nasıl buluruz?',subject:'Matematik',affected:1,question_count:1,evidence:[{attempt_id:id(20),question_id:question,state:'wrong'}]},{kind:'group',id:group,title:'Okul bahçesinde ölçüm',subject:'Matematik',affected:1,question_count:2,evidence:[{attempt_id:id(20),question_id:id(12),state:'partial'}]}];
  else if(path.endsWith('/rpc/get_question_group_policy'))data=true;
  else if(path.endsWith('/rpc/get_prova_entitlement'))data={ai_generate_remaining:10,ai_generate_limit:10,scenarios:true};
  else if(path.endsWith('/question_bank'))data=[{id:question,family_id:family,grade:5,subject:'Matematik',topic:'Çevre',kind:'open_ended',stem:'Bir üçgenin çevresini nasıl buluruz?',expected_answer:'Kenarlarını toplarız.',choices:null,correct_key:null}];
  else if(path.endsWith('/children'))data=[{id:child,name:'Emre',grade:5,avatar:'avatar-boy-01'}];
  else if(path.endsWith('/auth/v1/user'))data={id:user};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.addInitScript(({user,family})=>{
  Object.defineProperty(navigator,'language',{get:()=> 'tr-TR',configurable:true});
  Object.defineProperty(navigator,'languages',{get:()=> ['tr-TR'],configurable:true});
  const token=btoa('{"alg":"none"}')+'.'+btoa(JSON.stringify({sub:user,exp:Math.floor(Date.now()/1000)+86400,gina:{family_id:family,role:'parent',device_id:null,child_id:null,admin:false}}))+'.synthetic';
  localStorage.setItem('sb-ginaqa-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user:{id:user,app_metadata:{},user_metadata:{},aud:'authenticated'}}));
 },{user,family});
 await page.setViewportSize({width:390,height:844});
 await page.goto(`http://localhost:8098/parent/prova/builder?draftId=${draftId}`);
 await page.getByRole('button',{name:'Soru ekle',exact:true}).click();
 await page.getByRole('button',{name:'Kütüphane',exact:true}).click();
 await page.getByRole('button',{name:'Tekrar çalışması için seç',exact:true}).click();
 await page.getByText('Okul bahçesinde ölçüm',{exact:true}).waitFor();
 return {requests};
};
