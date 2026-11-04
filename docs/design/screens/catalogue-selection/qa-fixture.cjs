module.exports=async page=>{
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const user=id(1),family=id(2),child=id(3);
 const candidate={"key": "tr-2026-2027-t1-ilkmat2-g5-d6", "academic_year": "2026-2027", "term": 1, "exam": 1, "grade": 5, "subject": "İlköğretim Matematik", "source_url": "https://cdn.eba.gov.tr/yardimcikaynaklar/2026/09/KSDT/ilkmat2.xlsx", "source_sha256": "d5429b5962a08adc04acd71ceaae2d517bca507f8b4cf94354bcd55a9670aebf", "sheet": "5.sınıf", "header_cell": "D6", "question_count": 7, "blocks": [{"count": 1, "count_cell": "D7", "outcomes": [{"cell": "C7", "text": "MAT.5.3.1. Temel geometrik çizimler için matematiksel araç ve teknolojiden yararlanabilme", "code": "MAT.5.3.1"}]}, {"count": 1, "count_cell": "D8", "outcomes": [{"cell": "C8", "text": "MAT.5.3.2. Temel geometrik çizimlere dayalı deneyimlerini yansıtabilme", "code": "MAT.5.3.2"}]}, {"count": 1, "count_cell": "D9", "outcomes": [{"cell": "C9", "text": "MAT.5.3.3. Açıları ölçmek için matematiksel araç ve teknolojiden yararlanabilme", "code": "MAT.5.3.3"}]}, {"count": 1, "count_cell": "D10", "outcomes": [{"cell": "C10", "text": "MAT.5.3.4. Düzlemde iki veya üç doğrunun birbirine göre durumuna bağlı olarak oluşabilecek açılara dair çıkarım yapabilme", "code": "MAT.5.3.4"}]}, {"count": 1, "count_cell": "D11", "outcomes": [{"cell": "C11", "text": "MAT.5.3.5. Çokgenleri düzlemde ardışık olarak kesişen doğruların oluşturduğu kapalı şekiller olarak yorumlayabilme", "code": "MAT.5.3.5"}]}, {"count": 1, "count_cell": "D12", "outcomes": [{"cell": "C12", "text": "MAT.5.3.6. Çokgenlerin özellikleri ile ilgili edindiği deneyimleri yansıtabilme", "code": "MAT.5.3.6"}]}, {"count": 1, "count_cell": "D13", "outcomes": [{"cell": "C13", "text": "MAT.5.3.7. Matematiksel araç ve teknoloji yardımıyla düzlemde iki noktada kesişen çember çiftinin merkezleri ve kesişim noktalarından biri ile inşa edilen üçgenlerin kenar özelliklerine yönelik çıkarım yapabilme", "code": "MAT.5.3.7"}]}], "label": "Senaryo 1", "review_reasons": ["programme_and_school_scope_required", "source_review_required"]};
 const state={blueprints:[],blueprintSaves:[],loseSave:true,withdraw:false,failList:false};
 await page.context().route('https://ginaqa.supabase.co/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname,body=req.postDataJSON?.()??{};let data=[];
  if(path.endsWith('/families'))data={timezone:'Europe/Istanbul'};
  else if(path.endsWith('/children'))data=[{id:child,name:'Emre',grade:5,avatar:'avatar-curly'}];
  else if(path.endsWith('/school_timetables'))data={revision:1,lessons:[{id:'math',title:'Matematik',day:1,start:'09:00',end:'09:40'},{id:'science',title:'Fen',day:1,start:'10:00',end:'10:40'}],settings:{}};
  else if(path.endsWith('/rpc/get_curriculum_scenarios')&&state.failList)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'synthetic network error'})});
  else if(path.endsWith('/rpc/get_curriculum_scenarios'))data=state.withdraw||body.p_subject!=='Matematik'?[]:[{id:id(50),revision:2,content_hash:'a'.repeat(64),candidate,programme:'Türkiye Yüzyılı Maarif Modeli — test önizlemesi',school_scope:'5. sınıf Matematik. Bu inceleme kaydı yalnız arayüz testine aittir.',programme_url:'https://tymm.meb.gov.tr/ogretim-programlari'}];
  else if(path.endsWith('/rpc/save_catalog_blueprint')){
    state.blueprintSaves.push(body);let item=state.blueprints.find(x=>x.request===body.p_request_id);
    if(!item&&state.withdraw)return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'P0001',message:'curriculum_unavailable'})});
    if(!item){item={id:id(100+state.blueprints.length),...body.p_input,request:body.p_request_id};state.blueprints.push(item);}
    if(state.loseSave){state.loseSave=false;return route.abort('failed');}data=item.id;
  }
  else if(path.endsWith('/exam_blueprints'))data=state.blueprints;
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
 await page.goto('http://localhost:8098/parent/prova/catalog');
 return state;
};
