-- C13 — bütün `authenticated` RPC'leri için persona × fonksiyon sızıntı taraması (yalnız tek kullanımlık DB).
-- Sentetik A ailesi verisi nöbetçi metinler taşır (C13SECRETA1 = A'nın 1. çocuğuna özel, C13SECRETA2 = 2. çocuk,
-- C13SECRETAF = aile, C13PRIVATE = velinin özel notu). Her çağrı bir alt işlemde `authenticated` rolüyle ve
-- personanın JWT claim'leriyle yapılır, sonra alt işlem zorla geri alınır (yan etki kalmaz). Sonuç metninde,
-- personanın görmemesi gereken nöbetçi geçerse satır `leak` olarak işaretlenir. Çıktı: tek JSON satırı.
-- Argüman sentezi ad/tür tabanlıdır (p_child_id → A çocuğu 1 vb.); semantik tam matris değildir.
\set ON_ERROR_STOP 1
begin;
set local client_min_messages = warning;
-- Kullanıcılar: A velisi, A eş velisi, B velisi, cihaz kullanıcıları, operatörler, tam admin.
insert into auth.users(id,email,is_anonymous) values
 ('c13a0000-0000-4000-8000-0000000000a1','c13-a1@example.invalid',false),
 ('c13a0000-0000-4000-8000-0000000000a2','c13-a2@example.invalid',false),
 ('c13b0000-0000-4000-8000-0000000000b1','c13-b1@example.invalid',false),
 ('c13a0000-0000-4000-8000-0000000000d1',null,true),
 ('c13a0000-0000-4000-8000-0000000000d2',null,true),
 ('c13a0000-0000-4000-8000-0000000000d3',null,true),
 ('c13b0000-0000-4000-8000-0000000000d4',null,true),
 ('c1300000-0000-4000-8000-0000000000e1','c13-support@example.invalid',false),
 ('c1300000-0000-4000-8000-0000000000e2','c13-content@example.invalid',false),
 ('c1300000-0000-4000-8000-0000000000e3','c13-finance@example.invalid',false),
 ('c1300000-0000-4000-8000-0000000000e4','c13-release@example.invalid',false),
 ('c1300000-0000-4000-8000-0000000000e5','c13-admin@example.invalid',false);
insert into public.families(id,name,created_by) values
 ('c13a0000-0000-4000-8000-0000000000f1','C13SECRETAF','c13a0000-0000-4000-8000-0000000000a1'),
 ('c13b0000-0000-4000-8000-0000000000f2','C13 B','c13b0000-0000-4000-8000-0000000000b1');
insert into public.family_members(family_id,user_id) values
 ('c13a0000-0000-4000-8000-0000000000f1','c13a0000-0000-4000-8000-0000000000a1'),
 ('c13a0000-0000-4000-8000-0000000000f1','c13a0000-0000-4000-8000-0000000000a2'),
 ('c13b0000-0000-4000-8000-0000000000f2','c13b0000-0000-4000-8000-0000000000b1');
insert into public.children(id,family_id,name,grade) values
 ('c13a0000-0000-4000-8000-0000000000c1','c13a0000-0000-4000-8000-0000000000f1','C13SECRETA1 child',5),
 ('c13a0000-0000-4000-8000-0000000000c2','c13a0000-0000-4000-8000-0000000000f1','C13SECRETA2 child',3),
 ('c13b0000-0000-4000-8000-0000000000c3','c13b0000-0000-4000-8000-0000000000f2','C13 B child',5);
insert into public.devices(id,family_id,auth_user_id,active_child_id,access_mode,revoked_at) values
 ('c13a0000-0000-4000-8000-0000000000e1','c13a0000-0000-4000-8000-0000000000f1','c13a0000-0000-4000-8000-0000000000d1','c13a0000-0000-4000-8000-0000000000c1','selected',null),
 ('c13a0000-0000-4000-8000-0000000000e2','c13a0000-0000-4000-8000-0000000000f1','c13a0000-0000-4000-8000-0000000000d2','c13a0000-0000-4000-8000-0000000000c2','selected',null),
 ('c13a0000-0000-4000-8000-0000000000e3','c13a0000-0000-4000-8000-0000000000f1','c13a0000-0000-4000-8000-0000000000d3','c13a0000-0000-4000-8000-0000000000c1','selected',now()),
 ('c13b0000-0000-4000-8000-0000000000e4','c13b0000-0000-4000-8000-0000000000f2','c13b0000-0000-4000-8000-0000000000d4','c13b0000-0000-4000-8000-0000000000c3','selected',null);
insert into public.device_children(device_id,child_id) values
 ('c13a0000-0000-4000-8000-0000000000e1','c13a0000-0000-4000-8000-0000000000c1'),
 ('c13a0000-0000-4000-8000-0000000000e2','c13a0000-0000-4000-8000-0000000000c2'),
 ('c13a0000-0000-4000-8000-0000000000e3','c13a0000-0000-4000-8000-0000000000c1'),
 ('c13b0000-0000-4000-8000-0000000000e4','c13b0000-0000-4000-8000-0000000000c3');
insert into public.admins(user_id) values('c1300000-0000-4000-8000-0000000000e5');
insert into public.operations_members(user_id,role,expires_at) values
 ('c1300000-0000-4000-8000-0000000000e1','support',now()+interval '1 day'),
 ('c1300000-0000-4000-8000-0000000000e2','content',now()+interval '1 day'),
 ('c1300000-0000-4000-8000-0000000000e3','finance',now()+interval '1 day'),
 ('c1300000-0000-4000-8000-0000000000e4','release',now()+interval '1 day');
insert into public.task_templates(id,family_id,child_id,title,stars) values
 ('c13a0000-0000-4000-8000-0000000000b1','c13a0000-0000-4000-8000-0000000000f1','c13a0000-0000-4000-8000-0000000000c1','C13SECRETA1 task',2),
 ('c13a0000-0000-4000-8000-0000000000b2','c13a0000-0000-4000-8000-0000000000f1','c13a0000-0000-4000-8000-0000000000c2','C13SECRETA2 task',1);
insert into public.task_completions(id,family_id,child_id,template_id,due_date,client_id,status) values
 ('c13a0000-0000-4000-8000-0000000000b3','c13a0000-0000-4000-8000-0000000000f1','c13a0000-0000-4000-8000-0000000000c1','c13a0000-0000-4000-8000-0000000000b1',current_date,gen_random_uuid(),'done');
insert into public.star_events(family_id,child_id,delta,reason,created_by) values
 ('c13a0000-0000-4000-8000-0000000000f1','c13a0000-0000-4000-8000-0000000000c1',7,'bonus','c13a0000-0000-4000-8000-0000000000a1');
insert into public.notes(id,family_id,child_id,author_user_id,title,body,visibility) values
 ('c13a0000-0000-4000-8000-0000000000a5','c13a0000-0000-4000-8000-0000000000f1','c13a0000-0000-4000-8000-0000000000c1','c13a0000-0000-4000-8000-0000000000a1','C13PRIVATE title','C13PRIVATE body','private'),
 ('c13a0000-0000-4000-8000-0000000000a6','c13a0000-0000-4000-8000-0000000000f1','c13a0000-0000-4000-8000-0000000000c1','c13a0000-0000-4000-8000-0000000000a1','C13SECRETA1 note','C13SECRETA1 child note','child');
insert into public.family_rewards(id,family_id,title,cost_stars) values
 ('c13a0000-0000-4000-8000-0000000000a7','c13a0000-0000-4000-8000-0000000000f1','C13SECRETAF reward',2);
insert into public.events(id,family_id,child_id,title,starts_at,visible_to_child) values
 ('c13a0000-0000-4000-8000-0000000000a8','c13a0000-0000-4000-8000-0000000000f1','c13a0000-0000-4000-8000-0000000000c1','C13SECRETA1 event',now()+interval '1 day',true);
insert into public.school_timetables(child_id,family_id,lessons) values
 ('c13a0000-0000-4000-8000-0000000000c1','c13a0000-0000-4000-8000-0000000000f1','[{"day":1,"slot":1,"subject":"C13SECRETA1 lesson"}]');
insert into public.learning_sources(id,family_id,uploaded_by,kind,name,mime,bytes,sha256,object_path,status,storage_consent) values
 ('c13a0000-0000-4000-8000-0000000000a9','c13a0000-0000-4000-8000-0000000000f1','c13a0000-0000-4000-8000-0000000000a1','document','C13SECRETAF source.pdf','application/pdf',2048,repeat('a',64),'c13a0000-0000-4000-8000-0000000000f1/c13.pdf','ready','private_processing');
insert into public.help_tickets(id,family_id,created_by,kind,category,subject) values
 ('c13a0000-0000-4000-8000-0000000000aa','c13a0000-0000-4000-8000-0000000000f1','c13a0000-0000-4000-8000-0000000000a1','support','account','C13SECRETAF ticket');
insert into public.question_bank(id,family_id,grade,subject,topic,kind,stem,choices,correct_key) values
 ('c13a0000-0000-4000-8000-0000000000ab','c13a0000-0000-4000-8000-0000000000f1',5,'math','C13SECRETAF topic','multiple_choice','C13SECRETAF stem','[{"key":"A","text":"1"},{"key":"B","text":"2"}]','A');
insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,created_by) values
 ('c13a0000-0000-4000-8000-0000000000ac','c13a0000-0000-4000-8000-0000000000f1','c13a0000-0000-4000-8000-0000000000c1','C13SECRETA1 exam','math',5,array['c13a0000-0000-4000-8000-0000000000ab'::uuid],'c13a0000-0000-4000-8000-0000000000a1');
insert into public.exam_attempts(id,family_id,exam_id,child_id,status) values
 ('c13a0000-0000-4000-8000-0000000000ad','c13a0000-0000-4000-8000-0000000000f1','c13a0000-0000-4000-8000-0000000000ac','c13a0000-0000-4000-8000-0000000000c1','submitted');
insert into public.exam_answers(attempt_id,question_id,answer_text,answer_key) values
 ('c13a0000-0000-4000-8000-0000000000ad','c13a0000-0000-4000-8000-0000000000ab','C13SECRETA1 answer','A');

create function pg_temp.c13_val(n text, t regtype) returns text language plpgsql as $$
declare v text; begin
 n := lower(coalesce(n,''));
 if t in ('uuid'::regtype,'uuid[]'::regtype) then
  v := case
   when n ~ 'child' then 'c13a0000-0000-4000-8000-0000000000c1'
   when n ~ 'family' then 'c13a0000-0000-4000-8000-0000000000f1'
   when n ~ 'device' then 'c13a0000-0000-4000-8000-0000000000e1'
   when n ~ 'attempt' then 'c13a0000-0000-4000-8000-0000000000ad'
   when n ~ 'exam' then 'c13a0000-0000-4000-8000-0000000000ac'
   when n ~ 'completion' then 'c13a0000-0000-4000-8000-0000000000b3'
   when n ~ 'template|task|routine' then 'c13a0000-0000-4000-8000-0000000000b1'
   when n ~ 'note' then 'c13a0000-0000-4000-8000-0000000000a5'
   when n ~ 'ticket' then 'c13a0000-0000-4000-8000-0000000000aa'
   when n ~ 'source' then 'c13a0000-0000-4000-8000-0000000000a9'
   when n ~ 'question' then 'c13a0000-0000-4000-8000-0000000000ab'
   when n ~ 'reward' then 'c13a0000-0000-4000-8000-0000000000a7'
   when n ~ 'event' then 'c13a0000-0000-4000-8000-0000000000a8'
   when n ~ 'user|actor|assignee|parent|member' then 'c13a0000-0000-4000-8000-0000000000a1'
   else gen_random_uuid()::text end;
  return case when t='uuid[]'::regtype then format('array[%L]::uuid[]',v) else format('%L::uuid',v) end;
 elsif t = 'date'::regtype then return case when n ~ '(^|_)(to|end|until)' then 'current_date+6' else 'current_date' end;
 elsif t in ('timestamptz'::regtype,'timestamp'::regtype) then return 'now()';
 elsif t in ('integer'::regtype,'smallint'::regtype,'bigint'::regtype,'numeric'::regtype) then
  return case when n ~ 'limit|size' then '20' when n ~ 'offset' then '0' when n ~ 'year' then '2026' when n ~ 'grade' then '5' else '1' end || '::' || t::text;
 elsif t = 'text'::regtype then return case when n ~ 'code|pin' then '''123456''' when n ~ 'locale' then '''tr''' else '''x''' end;
 elsif t = 'boolean'::regtype then return 'false';
 elsif t in ('jsonb'::regtype,'json'::regtype) then return '''{}''::' || t::text;
 elsif t = 'text[]'::regtype then return '''{}''::text[]';
 elsif t = 'interval'::regtype then return '''1 day''::interval';
 else return 'null::' || t::text; end if;
end $$;

create function pg_temp.c13_claims(p text) returns text language sql as $$
 select case p
  when 'a_parent' then '{"sub":"c13a0000-0000-4000-8000-0000000000a1","role":"authenticated","gina":{"family_id":"c13a0000-0000-4000-8000-0000000000f1","role":"parent"}}'
  when 'b_parent' then '{"sub":"c13b0000-0000-4000-8000-0000000000b1","role":"authenticated","gina":{"family_id":"c13b0000-0000-4000-8000-0000000000f2","role":"parent"}}'
  when 'b_parent_forged_a' then '{"sub":"c13b0000-0000-4000-8000-0000000000b1","role":"authenticated","gina":{"family_id":"c13a0000-0000-4000-8000-0000000000f1","role":"parent"}}'
  when 'dev_a1' then '{"sub":"c13a0000-0000-4000-8000-0000000000d1","role":"authenticated","gina":{"family_id":"c13a0000-0000-4000-8000-0000000000f1","role":"device","device_id":"c13a0000-0000-4000-8000-0000000000e1","child_id":"c13a0000-0000-4000-8000-0000000000c1"}}'
  when 'dev_a2_sibling' then '{"sub":"c13a0000-0000-4000-8000-0000000000d2","role":"authenticated","gina":{"family_id":"c13a0000-0000-4000-8000-0000000000f1","role":"device","device_id":"c13a0000-0000-4000-8000-0000000000e2","child_id":"c13a0000-0000-4000-8000-0000000000c2"}}'
  when 'dev_a2_forged_child1' then '{"sub":"c13a0000-0000-4000-8000-0000000000d2","role":"authenticated","gina":{"family_id":"c13a0000-0000-4000-8000-0000000000f1","role":"device","device_id":"c13a0000-0000-4000-8000-0000000000e2","child_id":"c13a0000-0000-4000-8000-0000000000c1"}}'
  when 'dev_a_revoked' then '{"sub":"c13a0000-0000-4000-8000-0000000000d3","role":"authenticated","gina":{"family_id":"c13a0000-0000-4000-8000-0000000000f1","role":"device","device_id":"c13a0000-0000-4000-8000-0000000000e3","child_id":"c13a0000-0000-4000-8000-0000000000c1"}}'
  when 'dev_b' then '{"sub":"c13b0000-0000-4000-8000-0000000000d4","role":"authenticated","gina":{"family_id":"c13b0000-0000-4000-8000-0000000000f2","role":"device","device_id":"c13b0000-0000-4000-8000-0000000000e4","child_id":"c13b0000-0000-4000-8000-0000000000c3"}}'
  when 'op_support' then '{"sub":"c1300000-0000-4000-8000-0000000000e1","role":"authenticated","gina":{"role":"none"}}'
  when 'op_content' then '{"sub":"c1300000-0000-4000-8000-0000000000e2","role":"authenticated","gina":{"role":"none"}}'
  when 'op_finance' then '{"sub":"c1300000-0000-4000-8000-0000000000e3","role":"authenticated","gina":{"role":"none"}}'
  when 'op_release' then '{"sub":"c1300000-0000-4000-8000-0000000000e4","role":"authenticated","gina":{"role":"none"}}'
  when 'admin_forged_b' then '{"sub":"c13b0000-0000-4000-8000-0000000000b1","role":"authenticated","gina":{"family_id":"c13b0000-0000-4000-8000-0000000000f2","role":"parent","admin":true}}'
  when 'admin_full' then '{"sub":"c1300000-0000-4000-8000-0000000000e5","role":"authenticated","gina":{"role":"none","admin":true}}'
 end $$;

create temp table c13_results(persona text, fn text, outcome text, sqlstate text, leak text, detail text, saw_a boolean, saw_private boolean);
do $$
declare
 f record; p text; call text; res text; st text; msg text; i int; nm text; k int; outcome text; leak text;
 personas text[] := array['a_parent','b_parent','b_parent_forged_a','dev_a1','dev_a2_sibling','dev_a2_forged_child1','dev_a_revoked','dev_b','op_support','op_content','op_finance','op_release','admin_forged_b','admin_full'];
begin
 for f in
  select p.oid, p.proname, p.pronargs, p.proargtypes, p.proargnames, p.proargmodes, p.proretset
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prokind='f'
   and p.prorettype not in ('trigger'::regtype,'event_trigger'::regtype)
   and has_function_privilege('authenticated',p.oid,'execute')
   and p.proname not in ('custom_access_token_hook')
   and not exists (select 1 from unnest(p.proargtypes::oid[]) t where t in ('anyelement'::regtype,'anyarray'::regtype,'internal'::regtype))
  order by p.proname, p.oid
 loop
  call := '';
  for i in 0..f.pronargs-1 loop
   -- proargnames covers all args (incl. OUT/TABLE); take the i-th input argument name.
   nm := null;
   if f.proargnames is not null then
    if f.proargmodes is null then nm := f.proargnames[i+1];
    else
     k := 0;
     for j in 1..array_length(f.proargmodes,1) loop
      if f.proargmodes[j] in ('i','b','v') then
       if k = i then nm := f.proargnames[j]; exit; end if; k := k+1;
      end if;
     end loop;
    end if;
   end if;
   call := call || case when i>0 then ',' else '' end || pg_temp.c13_val(nm, f.proargtypes[i]::regtype);
  end loop;
  call := format('select coalesce(%s::text,''<null>'') from (select %s(%s) r) s', 'jsonb_agg(to_jsonb(r))', f.oid::regproc, call);
  foreach p in array personas loop
   res := null; st := null; msg := null;
   begin
    begin
     perform set_config('request.jwt.claims', pg_temp.c13_claims(p), true);
     perform set_config('request.jwt.claim.sub', (pg_temp.c13_claims(p)::jsonb->>'sub'), true);
     set local statement_timeout = '4s';
     set local role authenticated;
     execute call into res;
     raise exception using errcode = 'C1300', message = left(coalesce(res,'<null>'), 20000);
    exception when sqlstate 'C1300' then
     res := sqlerrm; st := null;
    when others then
     st := sqlstate; msg := left(sqlerrm, 160);
    end;
   end;
   outcome := case when st is null then 'ok' else 'error' end;
   leak := case
    when st is not null then null
    when p <> 'a_parent' and res like '%C13PRIVATE%' then 'private_note'
    when p in ('b_parent','b_parent_forged_a','dev_b','dev_a_revoked','admin_forged_b') and res like '%C13SECRETA%' then 'foreign_family'
    when p in ('dev_a2_sibling','dev_a2_forged_child1') and res like '%C13SECRETA1%' then 'sibling_child'
    when p like 'op_%' and res like '%C13SECRETA1%' then 'operator_child_content'
    when p like 'op_%' and res like '%C13SECRETA%' then 'operator_family_meta'
    when p = 'admin_full' and res like '%C13SECRETA1%' then 'admin_child_content'
    else null end;
   insert into c13_results values (p, f.oid::regprocedure::text, outcome, st, leak, case when leak is not null then left(res,300) else msg end,
    st is null and res like '%C13SECRETA%', st is null and res like '%C13PRIVATE%');
  end loop;
 end loop;
end $$;
-- REST tablo/görünüm okumaları: aynı personalarla her public tablo/görünümün tamamı (RLS + grant).
do $$
declare r record; p text; res text; st text; leak text;
 personas text[] := array['a_parent','b_parent','b_parent_forged_a','dev_a1','dev_a2_sibling','dev_a2_forged_child1','dev_a_revoked','dev_b','op_support','op_content','op_finance','op_release','admin_forged_b','admin_full'];
begin
 for r in select c.oid::regclass::text rel from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind in ('r','v','m','p') and has_table_privilege('authenticated',c.oid,'select') order by 1
 loop
  foreach p in array personas loop
   res := null; st := null;
   begin
    begin
     perform set_config('request.jwt.claims', pg_temp.c13_claims(p), true);
     set local statement_timeout = '4s';
     set local role authenticated;
     execute format('select coalesce(jsonb_agg(to_jsonb(t))::text,''[]'') from %s t', r.rel) into res;
     raise exception using errcode = 'C1300', message = left(res, 200000);
    exception when sqlstate 'C1300' then res := sqlerrm;
    when others then st := sqlstate;
    end;
   end;
   leak := case
    when st is not null then null
    when p <> 'a_parent' and res like '%C13PRIVATE%' then 'private_note'
    when p in ('b_parent','b_parent_forged_a','dev_b','dev_a_revoked','admin_forged_b') and res like '%C13SECRETA%' then 'foreign_family'
    when p in ('dev_a2_sibling','dev_a2_forged_child1') and res like '%C13SECRETA1%' then 'sibling_child'
    when p like 'op_%' and res like '%C13SECRETA%' then 'operator_table_read'
    when p = 'admin_full' and res like '%C13SECRETA%' then 'admin_table_read'
    else null end;
   insert into c13_results values (p, 'table:' || r.rel, case when st is null then 'ok' else 'error' end, st, leak, case when leak is not null then left(res,300) end,
    st is null and res like '%C13SECRETA%', st is null and res like '%C13PRIVATE%');
  end loop;
 end loop;
end $$;
select jsonb_build_object(
 'functions', (select count(distinct fn) from c13_results where fn not like 'table:%'),
 'tables', (select count(distinct fn) from c13_results where fn like 'table:%'),
 'calls', (select count(*) from c13_results),
 'by_persona', (select jsonb_object_agg(persona, x) from (select persona, jsonb_build_object('ok',count(*) filter (where outcome='ok'),'error',count(*) filter (where outcome='error')) x from c13_results group by persona) s),
 'ok_personas_by_function', (select jsonb_object_agg(fn, ps) from (select fn, jsonb_agg(persona order by persona) filter (where outcome='ok') ps from c13_results group by fn) s),
 -- Pozitif kontrol: dedektör çalışıyor mu? A velisinin kendi verisinde nöbetçiyi gördüğü fonksiyonlar.
 'positive_control_a_parent_sees_family_data', coalesce((select jsonb_agg(fn order by fn) from c13_results where persona='a_parent' and saw_a),'[]'),
 'positive_control_a_parent_sees_private_note', coalesce((select jsonb_agg(fn order by fn) from c13_results where persona='a_parent' and saw_private),'[]'),
 'positive_control_dev_a1_sees_child1_data', coalesce((select jsonb_agg(fn order by fn) from c13_results where persona='dev_a1' and saw_a),'[]'),
 'a_parent_ok_functions', (select count(*) from c13_results where persona='a_parent' and outcome='ok'),
 'leaks', coalesce((select jsonb_agg(jsonb_build_object('persona',persona,'fn',fn,'leak',leak,'detail',detail) order by leak,fn,persona) from c13_results where leak is not null),'[]'),
 'non_admin_ok_mutations', coalesce((select jsonb_agg(jsonb_build_object('persona',persona,'fn',fn) order by fn,persona) from c13_results
    where outcome='ok' and persona in ('b_parent','b_parent_forged_a','dev_a_revoked','dev_b','dev_a2_sibling','admin_forged_b')
      and fn ~ '^(public\.)?(save_|set_|admin_|delete_|archive_|apply_|change_|decide_|review_|accept_|assign_|submit_|cancel_|undo_|mark_|release_|record_|import_|publish_|transfer_|revoke_|create_|update_|add_|remove_|restore_|request_|complete_)'),'[]')
)::text;
rollback;
