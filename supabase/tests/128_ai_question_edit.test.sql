-- D14 (20261106430000_ai_question_edit): veli AI sorusunu / AI ortak kaynak grubunu düzenler.
-- Özgün satır değişmez; düzenleme yeni satır (generator ai_edited, edited_from/edited_root, model/istem korunur);
-- kişi adı uyarısı yalnız işaretli adlar için yeniden denetlenir; grup düzenlemesi yeni grup sürümüdür ve üye sözleşmesini
-- sağlar; tekrar aynı sonucu döner; ikinci AI ücreti yok; aile/rol sınırları; yardımcılar hiçbir role açık değildir.
begin;
select plan(70);
update public.app_settings set value='true' where key='question_groups.enabled';
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000012801','d14-parent@test.local'),
 ('00000000-0000-4000-8000-000000012802','d14-other@test.local'),
 ('00000000-0000-4000-8000-000000012803','d14-device@test.local');
insert into public.families(id,name,created_by) values
 ('10000000-0000-4000-8000-000000012801','D14','00000000-0000-4000-8000-000000012801'),
 ('10000000-0000-4000-8000-000000012802','D14 diğer','00000000-0000-4000-8000-000000012802');
insert into public.family_members(family_id,user_id) values
 ('10000000-0000-4000-8000-000000012801','00000000-0000-4000-8000-000000012801'),
 ('10000000-0000-4000-8000-000000012802','00000000-0000-4000-8000-000000012802');
insert into public.children(id,family_id,name,grade) values ('20000000-0000-4000-8000-000000012801','10000000-0000-4000-8000-000000012801','Cocuk',6);
insert into public.devices(id,family_id,auth_user_id,active_child_id) values
 ('30000000-0000-4000-8000-000000012801','10000000-0000-4000-8000-000000012801','00000000-0000-4000-8000-000000012803','20000000-0000-4000-8000-000000012801');

create function pg_temp.parent() returns void language sql as $$select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000012801","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000012801","role":"parent"}}',true)$$;
create function pg_temp.other() returns void language sql as $$select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000012802","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000012802","role":"parent"}}',true)$$;
create function pg_temp.device() returns void language sql as $$select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000012803","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000012801","role":"device","device_id":"30000000-0000-4000-8000-000000012801","child_id":"20000000-0000-4000-8000-000000012801"}}',true)$$;
create function pg_temp.ai(extra jsonb default '{}') returns jsonb language sql as $$
 select jsonb_build_object('generator','ai','model','synthetic-model','prompt_version','prova-generate/v7-rubric-100',
  'prompt',jsonb_build_object('system','GİZLİ','user','{}'::jsonb),'draft_id','50000000-0000-4000-8000-000000012801')||extra$$;
create function pg_temp.mc(stem text) returns jsonb language sql as $$
 select jsonb_build_object('topic','Okuma','kind','multiple_choice','difficulty','orta','stem',stem,
  'choices',jsonb_build_array(jsonb_build_object('key','A','text','Bir'),jsonb_build_object('key','B','text','İki'),
   jsonb_build_object('key','C','text','Üç'),jsonb_build_object('key','D','text','Dört')),'correct_key','B','solution','İki doğru.')$$;

-- AI sorusu (açık uçlu, kişi adı uyarılı, küçük ölçekli AI rubriği, dönem izi) + elle soru + başka aile AI sorusu.
insert into public.question_bank(id,family_id,grade,subject,topic,kind,difficulty,stem,expected_answer,solution,source_urls,provenance) values
 ('40000000-0000-4000-8000-000000012801','10000000-0000-4000-8000-000000012801',6,'Türkçe','Okuma','open_ended','orta',
  'Elif ile Ali parkta yürüyor. Kim daha hızlıdır?','Ali','Ali koşuyor.',array['https://example.invalid/a'],
  pg_temp.ai(jsonb_build_object('rubric',jsonb_build_object('criteria',jsonb_build_array(jsonb_build_object('text','Doğru kişi','points',2)),'alternative_answers','[]'::jsonb),
   'content_review',jsonb_build_object('status','needs_review','detector','person-name/v1','flags',jsonb_build_array(
    jsonb_build_object('code','person_name','names',jsonb_build_array('Elif','Ali'),'fields',jsonb_build_array('stem'),'suggestion','Rol ifadesi kullanın.')))))),
 ('40000000-0000-4000-8000-000000012802','10000000-0000-4000-8000-000000012801',6,'Türkçe','Okuma','open_ended','orta',
  'Velinin yazdığı soru nedir?','Cevap','Çözüm',array[]::text[],'{"generator":"parent"}'),
 ('40000000-0000-4000-8000-000000012803','10000000-0000-4000-8000-000000012802',6,'Türkçe','Okuma','open_ended','orta',
  'Başka ailenin AI sorusu nedir?','Cevap','Çözüm',array[]::text[],pg_temp.ai());
insert into gina.question_period_tags(question_id,family_id,term,program,source)
values('40000000-0000-4000-8000-000000012801','10000000-0000-4000-8000-000000012801',1,'Maarif','draft');
select set_config('test.orig',(select to_jsonb(q) from public.question_bank q where id='40000000-0000-4000-8000-000000012801')::text,true);

-- AI ortak kaynak grubu (D1 biçimi): ortak metinde "Mert" işaretli.
insert into public.question_bank(id,family_id,grade,subject,topic,kind,difficulty,stem,expected_answer,solution,correct_key,choices,provenance) values
 ('40000000-0000-4000-8000-000000012811','10000000-0000-4000-8000-000000012801',6,'Türkçe','Okuma','open_ended','orta',
  E'Ortak metin\nMert sabah erkenden kalkıp okula yürüdü.\n\nMetne göre kim erken kalktı?','Mert','Metinde yazıyor.',null,null,
  pg_temp.ai(jsonb_build_object('shared_source_id','s1','shared_source_title','Ortak metin','shared_prompt','Metne göre kim erken kalktı?',
   'shared_source',jsonb_build_object('kind','text','content','Mert sabah erkenden kalkıp okula yürüdü.'),
   'content_review',jsonb_build_object('status','needs_review','detector','person-name/v1','flags',jsonb_build_array(
    jsonb_build_object('code','person_name','names',jsonb_build_array('Mert'),'fields',jsonb_build_array('shared_source'),'suggestion','Rol ifadesi.')))))),
 ('40000000-0000-4000-8000-000000012812','10000000-0000-4000-8000-000000012801',6,'Türkçe','Okuma','multiple_choice','orta',
  E'Ortak metin\nMert sabah erkenden kalkıp okula yürüdü.\n\nOkula nasıl gitti?',null,'Yürüdü.','B',
  '[{"key":"A","text":"Otobüsle"},{"key":"B","text":"Yürüyerek"},{"key":"C","text":"Arabayla"},{"key":"D","text":"Bisikletle"}]',
  pg_temp.ai(jsonb_build_object('shared_source_id','s1','shared_source_title','Ortak metin','shared_prompt','Okula nasıl gitti?',
   'shared_source',jsonb_build_object('kind','text','content','Mert sabah erkenden kalkıp okula yürüdü.'))));
insert into public.question_source_groups(id,family_id,series_id,version,title,body,grade,subject) values
 ('60000000-0000-4000-8000-000000012801','10000000-0000-4000-8000-000000012801','60000000-0000-4000-8000-000000012801',1,
  'Ortak metin','Mert sabah erkenden kalkıp okula yürüdü.',6,'Türkçe');
insert into public.question_source_members(group_id,question_id,position,prompt) values
 ('60000000-0000-4000-8000-000000012801','40000000-0000-4000-8000-000000012811',1,'Metne göre kim erken kalktı?'),
 ('60000000-0000-4000-8000-000000012801','40000000-0000-4000-8000-000000012812',2,'Okula nasıl gitti?');
update public.question_source_groups set finalized_at=now() where id='60000000-0000-4000-8000-000000012801';
select set_config('test.gorig',(select jsonb_agg(to_jsonb(q) order by q.id) from public.question_bank q where id in('40000000-0000-4000-8000-000000012811','40000000-0000-4000-8000-000000012812'))::text,true);

-- 1) Yetki hijyeni ----------------------------------------------------------------------------------------------
select ok(not has_function_privilege('anon','public.save_ai_question_edit(uuid,uuid,jsonb)','EXECUTE'),'save_ai_question_edit closed to anon');
select ok(not has_function_privilege('anon','public.save_ai_group_edit(uuid,uuid,jsonb,jsonb)','EXECUTE'),'save_ai_group_edit closed to anon');
select ok(has_function_privilege('authenticated','public.save_ai_question_edit(uuid,uuid,jsonb)','EXECUTE')
 and has_function_privilege('authenticated','public.save_ai_group_edit(uuid,uuid,jsonb,jsonb)','EXECUTE'),'both RPCs are callable by authenticated (role checked inside)');
select ok(not exists(select 1 from unnest(array['gina.ai_edit_question_fields(jsonb,integer,boolean)','gina.ai_edit_content_review(jsonb,jsonb)',
  'gina.ai_edit_texts(jsonb,text)','gina.ai_edit_insert(uuid,public.question_bank,jsonb,text,jsonb)',
  'gina.ai_edit_provenance(public.question_bank,jsonb,jsonb,jsonb)']) fn, unnest(array['anon','authenticated','service_role']) r
 where has_function_privilege(r,fn,'EXECUTE')),'internal helpers are executable by no API role');

-- 2) Tek soru düzenleme -------------------------------------------------------------------------------------------
set local role authenticated; select pg_temp.parent();
select set_config('test.e1',public.save_ai_question_edit('70000000-0000-4000-8000-000000012801','40000000-0000-4000-8000-000000012801',
 jsonb_build_object('topic','Okuma','kind','open_ended','difficulty','zor','stem','  Bir öğrenci ile Ali parkta yürüyor. Kim daha hızlıdır?  ',
  'expected_answer','Ali','solution','Ali koşuyor.','explanation','Açıklama',
  'rubric',jsonb_build_object('criteria',jsonb_build_array(jsonb_build_object('text','Doğru kişi','points',100)),'alternative_answers',jsonb_build_array('Ali koşan')),
  'grade',12,'subject','Matematik','family_id','10000000-0000-4000-8000-000000012802','provenance','{"generator":"parent"}'))::text,true);
reset role;
select set_config('test.e1id',current_setting('test.e1')::jsonb->>'id',true);
select isnt(current_setting('test.e1id'),'40000000-0000-4000-8000-000000012801','edit is a new question row');
select is((select to_jsonb(q) from public.question_bank q where id='40000000-0000-4000-8000-000000012801'),current_setting('test.orig')::jsonb,'original AI row is unchanged');
select is((select stem from public.question_bank where id=current_setting('test.e1id')::uuid),'Bir öğrenci ile Ali parkta yürüyor. Kim daha hızlıdır?','edited stem saved (trimmed)');
select is((select (family_id,grade,subject,difficulty)::text from public.question_bank where id=current_setting('test.e1id')::uuid),
 '(10000000-0000-4000-8000-000000012801,6,Türkçe,zor)','family/grade/subject come from the source (payload cannot move them); difficulty editable');
select is((select provenance->>'generator' from public.question_bank where id=current_setting('test.e1id')::uuid),'ai_edited','generator is ai_edited');
select is((select provenance->>'edited_from' from public.question_bank where id=current_setting('test.e1id')::uuid),'40000000-0000-4000-8000-000000012801','edited_from = original id');
select is((select provenance->>'edited_root' from public.question_bank where id=current_setting('test.e1id')::uuid),'40000000-0000-4000-8000-000000012801','edited_root = original id');
select is((select provenance->>'edited_by' from public.question_bank where id=current_setting('test.e1id')::uuid),'00000000-0000-4000-8000-000000012801','edited_by = parent');
select is((select (provenance->>'model')||'|'||(provenance->>'prompt_version')||'|'||(provenance->>'draft_id')||'|'||(provenance#>>'{prompt,system}') from public.question_bank where id=current_setting('test.e1id')::uuid),
 'synthetic-model|prova-generate/v7-rubric-100|50000000-0000-4000-8000-000000012801|GİZLİ','model / prompt provenance kept');
select is((select provenance->'rubric' from public.question_bank where id=current_setting('test.e1id')::uuid),
 '{"criteria":[{"text":"Doğru kişi","points":100}],"alternative_answers":["Ali koşan"]}'::jsonb,'parent rubric (100 scale) replaces the AI rubric');
select is((select source_urls from public.question_bank where id=current_setting('test.e1id')::uuid),array['https://example.invalid/a'],'source urls carried');
select is((select (term,program,source)::text from gina.question_period_tags where question_id=current_setting('test.e1id')::uuid),'(1,Maarif,draft)','period tag carried with its source');
select is(current_setting('test.e1')::jsonb->'content_review',
 '{"status":"needs_review","flags":[{"code":"person_name","names":["Ali"],"fields":["stem"],"suggestion":"Rol ifadesi kullanın."}]}'::jsonb,
 'remaining flagged name is re-checked server-side and returned as summary');
select is((select provenance#>>'{content_review,rechecked_by}' from public.question_bank where id=current_setting('test.e1id')::uuid),'parent_edit','row marks the re-check');
select is((select provenance->>'content_review' is not null and provenance#>>'{content_review,flags,0,names}'='["Ali"]' from public.question_bank where id=current_setting('test.e1id')::uuid),true,'Elif flag cleared, Ali kept');

-- Tekrar: aynı istek aynı sonucu döner, yeni satır yok; farklı içerik aynı istekle reddedilir.
select set_config('test.n',(select count(*)::text from public.question_bank where family_id='10000000-0000-4000-8000-000000012801'),true);
set local role authenticated; select pg_temp.parent();
select is(public.save_ai_question_edit('70000000-0000-4000-8000-000000012801','40000000-0000-4000-8000-000000012801',
 jsonb_build_object('topic','Okuma','kind','open_ended','difficulty','zor','stem','  Bir öğrenci ile Ali parkta yürüyor. Kim daha hızlıdır?  ',
  'expected_answer','Ali','solution','Ali koşuyor.','explanation','Açıklama',
  'rubric',jsonb_build_object('criteria',jsonb_build_array(jsonb_build_object('text','Doğru kişi','points',100)),'alternative_answers',jsonb_build_array('Ali koşan')),
  'grade',12,'subject','Matematik','family_id','10000000-0000-4000-8000-000000012802','provenance','{"generator":"parent"}'))::text,current_setting('test.e1'),'replay returns the same result');
select throws_ok($$select public.save_ai_question_edit('70000000-0000-4000-8000-000000012801','40000000-0000-4000-8000-000000012801',pg_temp.mc('Başka içerik nedir?'))$$,
 'P0001','request_conflict','same request with different content is rejected');
reset role;
select is((select count(*)::text from public.question_bank where family_id='10000000-0000-4000-8000-000000012801'),current_setting('test.n'),'replay inserts no rows');

-- Düzenlemenin düzenlemesi: kökü korur, adlar kalmadıysa uyarı çözülür.
set local role authenticated; select pg_temp.parent();
select set_config('test.e2',public.save_ai_question_edit('70000000-0000-4000-8000-000000012802',current_setting('test.e1id')::uuid,
 pg_temp.mc('İki öğrenci parkta yürüyor. Kaç öğrenci vardır?'))::text,true);
reset role;
select set_config('test.e2id',current_setting('test.e2')::jsonb->>'id',true);
select is((select provenance->>'edited_from' from public.question_bank where id=current_setting('test.e2id')::uuid),current_setting('test.e1id'),'second edit points to the first edit');
select is((select provenance->>'edited_root' from public.question_bank where id=current_setting('test.e2id')::uuid),'40000000-0000-4000-8000-000000012801','second edit keeps the AI root');
select is(current_setting('test.e2')::jsonb->'content_review','null'::jsonb,'no remaining name → no surfaced warning');
select is((select provenance#>>'{content_review,status}' from public.question_bank where id=current_setting('test.e2id')::uuid),'resolved','content_review marked resolved');
select is((select provenance#>>'{content_review,resolved_by}' from public.question_bank where id=current_setting('test.e2id')::uuid),'parent_edit','resolved by parent edit');
select is((select gina.question_content_review_summary(provenance) from public.question_bank where id=current_setting('test.e2id')::uuid),null,'D10 note no longer shows for the resolved edit');
select is((select (kind,correct_key,choices->1->>'text')::text from public.question_bank where id=current_setting('test.e2id')::uuid),'(multiple_choice,B,İki)','kind can change; choices normalised A–D');
select ok((select not (provenance ? 'rubric') from public.question_bank where id=current_setting('test.e2id')::uuid),'no rubric carried onto a multiple-choice edit');
select is((select count(*)::int from public.question_bank where id=current_setting('test.e1id')::uuid and stem='Bir öğrenci ile Ali parkta yürüyor. Kim daha hızlıdır?'),1,'first edit unchanged by the second');

-- Hatalar
set local role authenticated; select pg_temp.parent();
select throws_ok($$select public.save_ai_question_edit(gen_random_uuid(),'40000000-0000-4000-8000-000000012802',pg_temp.mc('Elle soru düzenlenir mi?'))$$,'P0001','ai_edit_not_ai','parent-written question is not an AI edit');
select throws_ok($$select public.save_ai_question_edit(gen_random_uuid(),'40000000-0000-4000-8000-000000012803',pg_temp.mc('Başka aile sorusu nedir?'))$$,'P0001','question_not_found','other family question is not found');
select throws_ok($$select public.save_ai_question_edit(gen_random_uuid(),'40000000-0000-4000-8000-000000012811',pg_temp.mc('Grup üyesi tek başına mı?'))$$,'P0001','ai_edit_group_member','group member must be edited at group level');
select throws_ok($$select public.save_ai_question_edit(gen_random_uuid(),'40000000-0000-4000-8000-000000012801',pg_temp.mc('Üç şıklı soru nedir?')#-'{choices,3}')$$,'P0001','question_incomplete','three choices rejected');
select throws_ok($$select public.save_ai_question_edit(gen_random_uuid(),'40000000-0000-4000-8000-000000012801',pg_temp.mc('Rubrikli çoktan seçmeli?')||'{"rubric":{"criteria":[],"alternative_answers":["x"]}}')$$,'P0001','question_rubric_invalid','rubric on multiple choice rejected');
select throws_ok($$select public.save_ai_question_edit(gen_random_uuid(),'40000000-0000-4000-8000-000000012801','{"topic":"Okuma","kind":"open_ended","difficulty":"orta","stem":"Beklenen cevapsız soru?"}')$$,'P0001','question_incomplete','open-ended without expected answer rejected');
select throws_ok($$select public.save_ai_question_edit(gen_random_uuid(),'40000000-0000-4000-8000-000000012801',pg_temp.mc('Puanı aşan rubrik?')||'{"kind":"open_ended","expected_answer":"x","rubric":{"criteria":[{"text":"a","points":101}],"alternative_answers":[]}}')$$,'P0001','question_rubric_invalid','rubric over 100 rejected');
select pg_temp.other();
select throws_ok($$select public.save_ai_question_edit(gen_random_uuid(),'40000000-0000-4000-8000-000000012801',pg_temp.mc('Yabancı veli düzenler mi?'))$$,'P0001','question_not_found','other family parent cannot edit');
select pg_temp.device();
select throws_ok($$select public.save_ai_question_edit(gen_random_uuid(),'40000000-0000-4000-8000-000000012801',pg_temp.mc('Cihaz düzenler mi?'))$$,'42501',null,'child device cannot edit');
select throws_ok($$select public.save_ai_group_edit(gen_random_uuid(),'60000000-0000-4000-8000-000000012801','{"title":"a","body":"b"}','[{},{}]')$$,'42501',null,'child device cannot edit groups');
select is((select count(*)::int from public.question_bank),0,'child device reads no question rows (edits included)');
reset role;
set local role anon;
select throws_ok($$select public.save_ai_question_edit(gen_random_uuid(),'40000000-0000-4000-8000-000000012801','{}')$$,'42501',null,'anon cannot execute');
reset role;

-- 3) Ad denetimi birimleri (Türkçe harf sınırı) --------------------------------------------------------------------
select is(gina.ai_edit_content_review('{"status":"needs_review","flags":[{"code":"person_name","names":["Şule"],"fields":["stem"]}]}',
 '{"stem":"Şule''nin kalemi nerede?"}')#>>'{flags,0,names,0}','Şule','apostrophe suffix still matches (Şule''nin)');
select is(gina.ai_edit_content_review('{"status":"needs_review","flags":[{"code":"person_name","names":["Elif"],"fields":["stem"]}]}',
 '{"stem":"Elifçe bir kelime değildir."}')->>'status','resolved','a longer word with Turkish letters does not match');
select is(gina.ai_edit_content_review('{"status":"needs_review","flags":[{"code":"person_name","names":["Can"],"fields":["stem"]}]}',
 '{"stem":"can sıkıcı bir gün"}')->>'status','resolved','case-sensitive: common lowercase word is not the name');
select is(gina.ai_edit_content_review('{"status":"needs_review","flags":[{"code":"person_name","names":["Ali"],"fields":["stem"]}]}',
 '{"stem":"Soru","choice_C":"Ali gelir"}')#>'{flags,0,fields}','["choice_C"]'::jsonb,'names in choices are found with their field');
select is(gina.ai_edit_content_review(null,'{"stem":"Ali"}'),null,'no original warning → no new warning (parent text is not scanned)');

-- 4) AI ortak kaynak grubu → yeni sürüm ---------------------------------------------------------------------------
set local role authenticated; select pg_temp.parent();
select set_config('test.g',public.save_ai_group_edit('70000000-0000-4000-8000-000000012811','60000000-0000-4000-8000-000000012801',
 '{"title":" Ortak metin ","body":" Bir öğrenci sabah erkenden kalkıp okula yürüdü. "}',
 jsonb_build_array(
  jsonb_build_object('source_id','40000000-0000-4000-8000-000000012811','topic','Okuma','kind','open_ended','difficulty','orta',
   'stem','Metne göre öğrenci ne zaman kalktı?','expected_answer','Sabah erkenden','solution','Metinde yazıyor.',
   'rubric',jsonb_build_object('criteria',jsonb_build_array(jsonb_build_object('text','Zaman','points',100)),'alternative_answers','[]'::jsonb)),
  jsonb_build_object('source_id','40000000-0000-4000-8000-000000012812')||pg_temp.mc('Okula nasıl gitti?')))::text,true);
reset role;
select set_config('test.gid',current_setting('test.g')::jsonb->>'id',true);
select is((select (series_id,version,previous_id,title,body,grade,subject)::text from public.question_source_groups where id=current_setting('test.gid')::uuid),
 '(60000000-0000-4000-8000-000000012801,2,60000000-0000-4000-8000-000000012801,"Ortak metin","Bir öğrenci sabah erkenden kalkıp okula yürüdü.",6,Türkçe)',
 'group edit is version 2 of the same series, previous = original');
select ok((select finalized_at is not null from public.question_source_groups where id=current_setting('test.gid')::uuid),'new version is finalized');
select is((select count(*)::int from public.question_source_members where group_id=current_setting('test.gid')::uuid),2,'new version has both members');
select ok(not exists(select 1 from public.question_source_members where group_id=current_setting('test.gid')::uuid
 and question_id in('40000000-0000-4000-8000-000000012811','40000000-0000-4000-8000-000000012812')),'members are new rows (originals stay in version 1)');
select is((select string_agg(q.stem,'|' order by m.position) from public.question_source_members m join public.question_bank q on q.id=m.question_id where m.group_id=current_setting('test.gid')::uuid),
 E'Ortak metin\nBir öğrenci sabah erkenden kalkıp okula yürüdü.\n\nMetne göre öğrenci ne zaman kalktı?|Ortak metin\nBir öğrenci sabah erkenden kalkıp okula yürüdü.\n\nOkula nasıl gitti?',
 'member stems satisfy the group body/prompt contract');
select is((select string_agg(q.provenance->>'generator'||':'||(q.provenance->>'edited_from')||':'||(q.provenance->>'edit_scope'),'|' order by m.position)
 from public.question_source_members m join public.question_bank q on q.id=m.question_id where m.group_id=current_setting('test.gid')::uuid),
 'ai_edited:40000000-0000-4000-8000-000000012811:group|ai_edited:40000000-0000-4000-8000-000000012812:group','member provenance: ai_edited from each original');
select is((select string_agg((q.provenance->>'shared_prompt')||'/'||(q.provenance#>>'{shared_source,content}')||'/'||(q.provenance->>'shared_source_id'),'|' order by m.position)
 from public.question_source_members m join public.question_bank q on q.id=m.question_id where m.group_id=current_setting('test.gid')::uuid),
 'Metne göre öğrenci ne zaman kalktı?/Bir öğrenci sabah erkenden kalkıp okula yürüdü./s1|Okula nasıl gitti?/Bir öğrenci sabah erkenden kalkıp okula yürüdü./s1',
 'shared prompt / content follow the edit; shared source id kept');
select is((select string_agg(q.provenance#>>'{content_review,status}','|' order by m.position) from public.question_source_members m join public.question_bank q on q.id=m.question_id where m.group_id=current_setting('test.gid')::uuid),
 'resolved',
 'flagged shared-text name removed → member warning resolved (unflagged member gets none)');
select is((select jsonb_agg(to_jsonb(q) order by q.id) from public.question_bank q where id in('40000000-0000-4000-8000-000000012811','40000000-0000-4000-8000-000000012812')),
 current_setting('test.gorig')::jsonb,'original members unchanged');
select is((select (version,body,finalized_at is not null)::text from public.question_source_groups where id='60000000-0000-4000-8000-000000012801'),
 '(1,"Mert sabah erkenden kalkıp okula yürüdü.",t)','original group version unchanged');
select ok(exists(select 1 from public.current_question_bank where id=(current_setting('test.g')::jsonb->'question_ids'->>0)::uuid)
 and not exists(select 1 from public.current_question_bank where id='40000000-0000-4000-8000-000000012811'),'library current view shows the new version only');
select is(cardinality(gina.prova_draft_questions('10000000-0000-4000-8000-000000012801',
 jsonb_build_object('blocks',jsonb_build_array(jsonb_build_object('kind','group','id',current_setting('test.gid'),'source','ai'),
  jsonb_build_object('kind','question','id',current_setting('test.e2id'),'source','ai'))))),3,'draft with edited group + edited question resolves to 3 questions');
set local role authenticated; select pg_temp.parent();
select is((select count(*)::int from jsonb_array_elements(public.get_question_context(array[(current_setting('test.g')::jsonb->'question_ids'->>0)::uuid,(current_setting('test.g')::jsonb->'question_ids'->>1)::uuid])) c
 where c->>'body'='Bir öğrenci sabah erkenden kalkıp okula yürüdü.' and (c->>'version')::int=2),2,'question context serves the edited shared text');
select is(public.save_ai_group_edit('70000000-0000-4000-8000-000000012811','60000000-0000-4000-8000-000000012801',
 '{"title":" Ortak metin ","body":" Bir öğrenci sabah erkenden kalkıp okula yürüdü. "}',
 jsonb_build_array(
  jsonb_build_object('source_id','40000000-0000-4000-8000-000000012811','topic','Okuma','kind','open_ended','difficulty','orta',
   'stem','Metne göre öğrenci ne zaman kalktı?','expected_answer','Sabah erkenden','solution','Metinde yazıyor.',
   'rubric',jsonb_build_object('criteria',jsonb_build_array(jsonb_build_object('text','Zaman','points',100)),'alternative_answers','[]'::jsonb)),
  jsonb_build_object('source_id','40000000-0000-4000-8000-000000012812')||pg_temp.mc('Okula nasıl gitti?')))::text,current_setting('test.g'),'group edit replay returns the same result');
select throws_ok($$select public.save_ai_group_edit(gen_random_uuid(),'60000000-0000-4000-8000-000000012801','{"title":"T","body":"Metin"}',
 jsonb_build_array(jsonb_build_object('source_id','40000000-0000-4000-8000-000000012811')||pg_temp.mc('Eski sürümden?'),jsonb_build_object('source_id','40000000-0000-4000-8000-000000012812')||pg_temp.mc('Eski sürümden?')))$$,
 'P0001','question_group_changed','editing a superseded version is rejected');
select throws_ok(format($$select public.save_ai_group_edit(gen_random_uuid(),%L,'{"title":"T","body":"Metin"}',
 jsonb_build_array(jsonb_build_object('source_id',%L)||pg_temp.mc('Sıra ters mi?'),jsonb_build_object('source_id',%L)||pg_temp.mc('Sıra ters mi?')))$$,
 current_setting('test.gid'),current_setting('test.g')::jsonb->'question_ids'->>1,current_setting('test.g')::jsonb->'question_ids'->>0),
 'P0001','question_group_mismatch','members must be sent in order');
select throws_ok(format($$select public.save_ai_group_edit(gen_random_uuid(),%L,'{"title":"T","body":"Metin"}',
 jsonb_build_array(jsonb_build_object('source_id',%L)||pg_temp.mc('Eksik üye mi?'),jsonb_build_object('source_id',%L)||pg_temp.mc('Eksik üye mi?'),jsonb_build_object('source_id',%L)||pg_temp.mc('Fazla üye mi?')))$$,
 current_setting('test.gid'),current_setting('test.g')::jsonb->'question_ids'->>0,current_setting('test.g')::jsonb->'question_ids'->>1,current_setting('test.g')::jsonb->'question_ids'->>1),
 'P0001','question_group_mismatch','member count must match');
select throws_ok(format($$select public.save_ai_group_edit(gen_random_uuid(),%L,'{"title":"T","body":"Metin"}',
 jsonb_build_array(jsonb_build_object('source_id',%L)||pg_temp.mc('Çözümsüz üye?')-'solution',jsonb_build_object('source_id',%L)||pg_temp.mc('İkinci üye?')))$$,
 current_setting('test.gid'),current_setting('test.g')::jsonb->'question_ids'->>0,current_setting('test.g')::jsonb->'question_ids'->>1),
 'P0001','question_incomplete','group member needs a solution');
select pg_temp.other();
select throws_ok(format($$select public.save_ai_group_edit(gen_random_uuid(),%L,'{"title":"T","body":"Metin"}','[{},{}]')$$,current_setting('test.gid')),
 'P0001','question_group_not_found','other family cannot edit the group');
reset role;
update public.app_settings set value='false' where key='question_groups.enabled';
set local role authenticated; select pg_temp.parent();
select throws_ok(format($$select public.save_ai_group_edit(gen_random_uuid(),%L,'{"title":"T","body":"Metin"}','[{},{}]')$$,current_setting('test.gid')),
 'P0001','question_groups_unavailable','group edit follows the rollout flag');
reset role;

-- 5) İkinci AI ücreti yok -------------------------------------------------------------------------------------------
select is((select count(*)::int from public.prova_generation_jobs where family_id='10000000-0000-4000-8000-000000012801'),0,'no generation job was created by edits');
select is((select count(*)::int from public.generation_credit_allocations a join public.prova_generation_jobs j on j.id=a.job_id where j.family_id='10000000-0000-4000-8000-000000012801'),0,'no credit allocation by edits');

select * from finish();
rollback;
