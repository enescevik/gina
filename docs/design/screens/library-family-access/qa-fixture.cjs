module.exports=async page=>{
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const user=id(1),family=id(2),draftId=id(9),pack=id(10);
 const state={owned:false,requests:[],loseResponse:false,mode:'ready',remaining:5};
 await page.route('https://ginaqa.supabase.co/**',async route=>{
  const url=new URL(route.request().url()),body=route.request().postDataJSON?.()??{},path=url.pathname;let data=[],status=200;
  if(path.endsWith('/rpc/get_learning_library'))data={limit:5,remaining:state.remaining,bonus:0,collections:[],contributions:[],rewards:[],grants:[]};
  else if(path.endsWith('/rpc/get_prova_drafts'))data=[{id:draftId,version:1,exam_id:null,submitted_at:null,content:{childId:id(3),grade:5,title:'Geometri çalışmam',purpose:'practice',format:'practice',subjects:['Matematik'],topics:[],target:4,minutes:null,difficulty:'orta',kind:'mixed',note:'',step:1,blocks:[]}}];
  else if(path.endsWith('/rpc/get_published_library_packages')){data=state.mode==='empty'?[]:[{id:pack,version:1,title:'Geometriyi keşfedelim',description:'Şekilleri incele, ortak çizimlerden yararlanarak düşünceni anlat.',grade:5,subject:'Matematik',curriculum_label:'5. sınıf · İncelenmiş geometri çalışmaları',accessible:state.mode!=='locked',question_count:4,source_count:1}];if(state.mode==='error'){status=503;data={message:'fixture_unavailable'}}}
  else if(path.endsWith('/rpc/get_library_package_units'))data=[{key:'source:segments',title:'Çizgiler ve uzunluklar',count:2,owned:state.owned},{key:'question:q3',title:'Üçgenin çevresi',count:1,owned:false},{key:'question:q4',title:'Dörtgenleri tanıyalım',count:1,owned:false}];
  else if(path.endsWith('/rpc/acquire_library_units')){state.requests.push(body);const charged=state.owned?0:2;state.owned=true;state.remaining=3;data={charged,blocks:[{kind:'group',id:id(99),source:'library'}],draft_id:draftId};if(state.loseResponse){state.loseResponse=false;return route.abort('failed');}}
  else if(path.endsWith('/children'))data=[{id:id(3),name:'Emre',grade:5,avatar:'avatar-boy-01'}];
  else if(path.endsWith('/auth/v1/user'))data={id:user};
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.addInitScript(({user,family})=>{const token=btoa('{"alg":"none"}')+'.'+btoa(JSON.stringify({sub:user,exp:Math.floor(Date.now()/1000)+86400,gina:{family_id:family,role:'parent',device_id:null,child_id:null,admin:false}}))+'.synthetic';localStorage.setItem('sb-ginaqa-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user:{id:user,app_metadata:{},user_metadata:{},aud:'authenticated'}}));},{user,family});
 await page.setViewportSize({width:1280,height:800});
 await page.goto(`http://localhost:8098/parent/prova/library?draftId=${draftId}`);
 await page.getByText('Geometriyi keşfedelim',{exact:true}).waitFor();
 return {state,draftId};
};
