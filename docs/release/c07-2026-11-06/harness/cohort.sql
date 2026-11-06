-- Synthetic incelemeli Birlikte Prova (disposable gina_c07_* DB only); recipe from pgTAP 098 (copied from B03/B04 harness).
-- p1: bitti, açık uçlu cevap "okunamadı" · p2: bitti, puanlandı + açık itiraz · p3: bitmedi · p4: bitti, incelenmedi.
begin;
update public.plans set library_monthly=3,cohort_monthly=5,prova_monthly_exams=null where code='free';
update public.app_settings set value='true' where key in('library_packages.enabled','sources.enabled','question_groups.enabled','cohorts.enabled','contribution_sets.enabled');
-- {{bundle_functions}}
create temp table state(name text primary key,id uuid);grant all on state to authenticated,service_role;
create function pg_temp.id(n text) returns uuid language sql as $$select id from state where name=n$$;
create function pg_temp.as_admin() returns void language sql as $$select set_config('request.jwt.claims','{"sub":"{{admin}}","role":"authenticated","gina":{"admin":true}}',true)$$;
create function pg_temp.as_parent(u text,f text) returns void language sql as $$select set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','gina',jsonb_build_object('family_id',f,'role','parent'))::text,true)$$;
create function pg_temp.take(k text,g uuid,c uuid,finish boolean) returns void language plpgsql as $$
declare ex uuid; att uuid; qs uuid[];
begin
 ex:=public.enroll_reviewed_group_exam(g,c,true,true,true);
 att:=(public.start_exam_attempt(ex)).id;
 select question_ids into qs from public.exams where id=ex;
 perform public.submit_exam_answer(att,q,'A') from unnest(qs[1:3]) q;
 perform public.submit_exam_answer_v3(gen_random_uuid(),att,qs[4],0,null,'Cevabım: iki ucu noktalı olan doğru parçası.','{"version":1,"width":1000,"height":1400,"elements":[]}');
 if finish then perform public.finish_exam_attempt(att); end if;
 insert into state values(k,ex);
end$$;
grant execute on function pg_temp.take(text,uuid,uuid,boolean) to authenticated;

set local role authenticated;select pg_temp.as_admin();
insert into state select 'rev1',(public.admin_import_library_bundle(gen_random_uuid(),pg_temp.bundle())->>'id')::uuid;
select public.admin_review_library_question(gen_random_uuid(),pg_temp.id('rev1'),'question-'||n,1,0,'suitable','Sentetik kontrol') from generate_series(1,4) n;
reset role;select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.prepare_library_delivery_media('{{admin}}',pg_temp.id('rev1'),jsonb_build_array(jsonb_build_object('source_hash',pg_temp.bundle()#>>'{assets,0,sha256}','base64',pg_temp.bundle()#>>'{assets,0,base64}')));
set local role authenticated;select pg_temp.as_admin();
select public.admin_set_library_publication(gen_random_uuid(),pg_temp.id('rev1'),0,public.admin_library_publication(pg_temp.id('rev1'))#>>'{checks,review_fingerprint}','Geometri başlangıç','Sentetik',array['free']::public.plan_code[],'Sentetik program',true,'published');
select public.admin_create_reviewed_group_exam('b3450000-0000-4000-8000-000000000001',pg_temp.id('rev1'),1,'Birlikte Prova · 5. sınıf geometri',array['source:segments','question:question-4'],now()-interval '1 hour',now()+interval '1 hour',20,array['free']::public.plan_code[],true);
select pg_temp.as_parent('{{p1}}','b3400000-0000-4000-8000-000000000001');
select pg_temp.take('e1','b3450000-0000-4000-8000-000000000001','b3410000-0000-4000-8000-000000000001',true);
select pg_temp.as_parent('{{p2}}','b3400000-0000-4000-8000-000000000002');
select pg_temp.take('e2','b3450000-0000-4000-8000-000000000001','b3410000-0000-4000-8000-000000000002',true);
select pg_temp.as_parent('{{p3}}','b3400000-0000-4000-8000-000000000003');
select pg_temp.take('e3','b3450000-0000-4000-8000-000000000001','b3410000-0000-4000-8000-000000000003',false);
select pg_temp.as_parent('{{p4}}','b3400000-0000-4000-8000-000000000004');
select pg_temp.take('e4','b3450000-0000-4000-8000-000000000001','b3410000-0000-4000-8000-000000000004',true);
reset role;
update public.group_exams set ends_at=now()-interval '1 minute' where id='b3450000-0000-4000-8000-000000000001';
insert into state select 'entry1',id from public.group_exam_entries where exam_id=pg_temp.id('e1');
insert into state select 'entry2',id from public.group_exam_entries where exam_id=pg_temp.id('e2');
set local role authenticated;select pg_temp.as_admin();
select public.admin_save_cohort_review(gen_random_uuid(),pg_temp.id('entry1'),4,0,public.admin_cohort_review_detail(pg_temp.id('entry1'))#>>'{questions,3,answer_hash}','{"c1":0,"c2":0,"c3":0,"c4":0}','unreadable','Fotoğraf okunamıyor, lütfen yeniden çekin.');
select public.admin_save_cohort_review(gen_random_uuid(),pg_temp.id('entry2'),4,0,public.admin_cohort_review_detail(pg_temp.id('entry2'))#>>'{questions,3,answer_hash}','{"c1":1,"c2":1,"c3":0,"c4":0}','scored','İki ölçüt karşılandı.');
select pg_temp.as_parent('{{p2}}','b3400000-0000-4000-8000-000000000002');
select public.appeal_cohort_review(gen_random_uuid(),'b3450000-0000-4000-8000-000000000001','b3410000-0000-4000-8000-000000000002',4,1,'Lütfen ikinci açıklamayı yeniden kontrol eder misiniz?');
reset role;
commit;
