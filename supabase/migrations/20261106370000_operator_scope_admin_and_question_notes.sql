-- D3 — C07/C10 yönetim kalanları.
-- 1) Operatör kapsamı (gina.operations_member_scopes) artık SQL yerine yönetim ekranından verilir/kaldırılır:
--    yalnız tam yönetici; istek kimliğiyle idempotent; her gerçek değişiklik denetim kaydı yazar. Kapsam satırı
--    olmayan yayın operatörü "bütün bölgeler" yetkisine sahiptir (C10 kuralı); bu nedenle son kapsamı kaldırmak
--    yetkiyi genişletir ve ayrıca açık onay ister (scope_last_would_widen).
-- 2) Başarısız e-posta/SMS teslimleri: süzgeçli ve keyset sayfalı okuma (release_channel_failure_page).
--    Yeniden sıraya alma C10'daki release_requeue_channel ile aynıdır (en çok 3).
-- 3) Soru bazlı katkı ret notu: ret kararı soru anahtarı başına not taşıyabilir (question_notes). Not yalnız
--    retle yazılır, sonradan değişmez; kabul her zaman bütün grup içindir (atomik kabul değişmedi).
--    Veli görünümü contribution_review_trail → steps[].questions[].
-- 4) my_admin_access(): yönetici ekranlarının canlı "admins" kontrolü (Q00-A3-7 yönetici kısmı).
-- C07 kapıları korunur: yeniden tanımlanan iki gövde (admin_get_contribution_set, contribution_review_trail)
-- pg_get_functiondef ile aynen alınır ve yalnız tek bir alan eklenir; beklenen parça tam bir kez bulunmazsa durur.

-- 1. Operatör kapsamı yönetimi -------------------------------------------------------------------
create table gina.operations_scope_commands (
 request_id uuid primary key,
 actor_id uuid not null,
 payload_hash text not null,
 result jsonb not null,
 created_at timestamptz not null default now()
);
alter table gina.operations_scope_commands enable row level security;
revoke all on gina.operations_scope_commands from public,anon,authenticated,service_role;

create function public.admin_operator_scopes() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform gina.assert_admin();
 return jsonb_build_object(
  'operators',(select coalesce(jsonb_agg(o order by o->>'email',o->>'user_id'),'[]') from (
   select jsonb_build_object('user_id',u.id,'email',u.email,
    'role_active',coalesce(m.revoked_at is null and m.expires_at>now(),false),
    'expires_at',m.expires_at,'revoked_at',m.revoked_at,
    'scopes',(select coalesce(jsonb_agg(jsonb_build_object('place_id',s.place_id,'name',p.name,'kind',p.kind,'parent_id',p.parent_id,
       'active',p.active,'granted_at',s.created_at,'granted_by',g.email) order by p.name,s.place_id),'[]')
      from gina.operations_member_scopes s join gina.education_places p on p.id=s.place_id left join auth.users g on g.id=s.granted_by
      where s.user_id=u.id and s.role='release')) o
   from auth.users u left join public.operations_members m on m.user_id=u.id and m.role='release'
   where (m.user_id is not null or exists(select 1 from gina.operations_member_scopes s where s.user_id=u.id))
     and not exists(select 1 from public.admins a where a.user_id=u.id)) x),
  'places',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'kind',p.kind,'parent_id',p.parent_id,'name',p.name)
     order by case p.kind when 'country' then 0 when 'region' then 1 else 2 end,p.name),'[]')
   from gina.education_places p where p.active),
  'rule','no_scope_rows = all places; scope rows = only those places and their schools');
end;$$;

create function public.admin_set_operator_scope(p_request_id uuid,p_user_id uuid,p_place_id uuid,p_grant boolean,p_reason text,p_allow_global boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r gina.operations_scope_commands;h text;n int;existing boolean;outcome text;result jsonb;begin
 perform gina.assert_admin();
 if p_request_id is null or p_user_id is null or p_place_id is null or p_grant is null
  or length(trim(coalesce(p_reason,''))) not between 3 and 500 then raise exception 'invalid_input';end if;
 h:=encode(extensions.digest(jsonb_build_array(p_user_id,p_place_id,p_grant,trim(p_reason),coalesce(p_allow_global,false))::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,37));
 select * into r from gina.operations_scope_commands where request_id=p_request_id;
 if found then
  if r.actor_id<>auth.uid() or r.payload_hash<>h then raise exception 'request_conflict';end if;
  return r.result||jsonb_build_object('replayed',true);
 end if;
 -- Bir operatörün kapsam değişiklikleri sıralı: "son kapsam" kontrolü yarışta atlanamaz.
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,38));
 if exists(select 1 from public.admins where user_id=p_user_id) then raise exception 'operator_is_admin';end if;
 existing:=exists(select 1 from gina.operations_member_scopes where user_id=p_user_id and role='release' and place_id=p_place_id);
 if p_grant then
  if not exists(select 1 from public.operations_members where user_id=p_user_id and role='release' and revoked_at is null and expires_at>now()) then
   raise exception 'operator_role_required';end if;
  if not exists(select 1 from gina.education_places where id=p_place_id and active) then raise exception 'place_not_found';end if;
  if existing then outcome:='unchanged';
  else
   insert into gina.operations_member_scopes(user_id,role,place_id,granted_by) values(p_user_id,'release',p_place_id,auth.uid());
   outcome:='granted';
  end if;
 else
  if not existing then outcome:='unchanged';
  else
   select count(*) into n from gina.operations_member_scopes where user_id=p_user_id and role='release';
   if n=1 and not coalesce(p_allow_global,false) then raise exception 'scope_last_would_widen';end if;
   delete from gina.operations_member_scopes where user_id=p_user_id and role='release' and place_id=p_place_id;
   outcome:='removed';
  end if;
 end if;
 select count(*) into n from gina.operations_member_scopes where user_id=p_user_id and role='release';
 result:=jsonb_build_object('status',outcome,'user_id',p_user_id,'place_id',p_place_id,'scope_count',n,'effective',case when n=0 then 'all_places' else 'scoped' end);
 insert into gina.operations_scope_commands(request_id,actor_id,payload_hash,result) values(p_request_id,auth.uid(),h,result);
 if outcome<>'unchanged' then
  insert into public.audit_log(actor_id,action,target_table,target_id,reason,details)
  values(auth.uid(),'operations.scope.'||outcome,'operations_member_scopes',p_user_id::text,trim(p_reason),
   jsonb_build_object('role','release','place_id',p_place_id,'scope_count',n,'effective',result->'effective'));
 end if;
 return result;
end;$$;

-- 2. Başarısız teslimler: süzgeç + keyset sayfalama ------------------------------------------------
create function public.release_channel_failure_page(p_channel text default null,p_reason text default null,
 p_before timestamptz default null,p_before_id bigint default null,p_limit int default 25)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare lim int:=greatest(1,least(coalesce(p_limit,25),100));page jsonb;total int;begin
 if not gina.has_operation_role('release') then raise exception 'forbidden' using errcode='42501';end if;
 if p_channel is not null and p_channel not in('email','sms') then raise exception 'invalid_input';end if;
 if p_reason is not null and p_reason not in('failed','provider_unconfigured','duplicate_recipient','requeueable') then raise exception 'invalid_input';end if;
 if (p_before is null)<>(p_before_id is null) then raise exception 'cursor_invalid';end if;
 with base as (
  select o.*,
   o.kind='parent_announcement' and o.requeue_count<3 and (o.status='failed' or (o.status='skipped' and o.skip_reason='provider_unconfigured'))
    and exists(select 1 from gina.parent_announcements a where a.id::text=o.payload->>'announcement_id' and a.status='published' and a.expires_on>=current_date) requeueable
  from gina.channel_outbox o
  where (o.status='failed' or (o.status='skipped' and o.skip_reason in('provider_unconfigured','duplicate_recipient')))
   and o.created_at>now()-interval '30 days'
   and (p_channel is null or o.channel=p_channel)),
 filtered as (
  select * from base where p_reason is null or (p_reason='failed' and status='failed') or (p_reason='requeueable' and requeueable)
   or (p_reason in('provider_unconfigured','duplicate_recipient') and status='skipped' and skip_reason=p_reason))
 select (select count(*) from filtered),
  (select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'channel',f.channel,'kind',f.kind,'purpose',f.purpose,'status',f.status,'skip_reason',f.skip_reason,
    'last_error',f.last_error,'attempts',f.attempts,'requeue_count',f.requeue_count,'requeues_left',greatest(0,3-f.requeue_count),'created_at',f.created_at,
    'announcement_id',f.payload->>'announcement_id',
    'announcement_title',(select a.title from gina.parent_announcements a where a.id::text=f.payload->>'announcement_id'),
    'requeueable',f.requeueable) order by f.created_at desc,f.id desc),'[]')
   from (select * from filtered where p_before is null or (created_at,id)<(p_before,p_before_id) order by created_at desc,id desc limit lim+1) f)
 into total,page;
 return jsonb_build_object(
  'rows',(select coalesce(jsonb_agg(v order by n),'[]') from jsonb_array_elements(page) with ordinality x(v,n) where n<=lim),
  'next',case when jsonb_array_length(page)>lim then jsonb_build_object('before',page->(lim-1)->'created_at','before_id',page->(lim-1)->'id') end,
  'total',total,'limit',lim,'max_requeues',3,
  'readiness',gina.channel_readiness(),'note','accepted = provider accepted the message; not delivered, not read');
end;$$;

-- 3. Soru bazlı ret notu ------------------------------------------------------------------------
alter table gina.contribution_sets add column question_notes jsonb
 check(question_notes is null or (jsonb_typeof(question_notes)='object' and question_notes<>'{}'::jsonb));
create function gina.contribution_question_notes_guard() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.question_notes is distinct from old.question_notes then
  if old.question_notes is not null then raise exception 'contribution_notes_immutable';end if;
  if new.status<>'rejected' then raise exception 'question_notes_reject_only';end if;
 end if;
 return new;end;$$;
create trigger contribution_question_notes_guard before update of question_notes on gina.contribution_sets
 for each row execute function gina.contribution_question_notes_guard();

-- Soruların sırası, kısa kökü ve (varsa) notu. Not yoksa boş dizi: eski kararlarda yalnız genel not vardır.
create function gina.contribution_question_view(p_snapshot jsonb,p_notes jsonb) returns jsonb
language sql immutable set search_path='' as $$
 select case when p_notes is null then '[]'::jsonb else (
  select coalesce(jsonb_agg(jsonb_build_object('key',q->>'key','position',n,
    'excerpt',left(regexp_replace(coalesce(q->>'stem',''),'\s+',' ','g'),140),'note',p_notes->>(q->>'key')) order by n),'[]')
  from jsonb_array_elements(coalesce(p_snapshot->'questions','[]')) with ordinality x(q,n)) end;
$$;

-- Ret kararı + soru notları tek işlemde. Notsuz çağrı 6 parametreli kararla birebir aynıdır.
create function public.admin_decide_contribution_set(p_request_id uuid,p_id uuid,p_approve boolean,p_note text,p_teachers jsonb,p_confirmed boolean,p_question_notes jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s gina.contribution_sets;r gina.contribution_commands;notes jsonb:='{}';k text;v jsonb;keys text[];result jsonb;begin
 perform gina.assert_operation_role(array['content']);
 if p_question_notes is null or p_question_notes='{}'::jsonb then
  return public.admin_decide_contribution_set(p_request_id,p_id,p_approve,p_note,p_teachers,p_confirmed);
 end if;
 if p_approve is distinct from false then raise exception 'question_notes_reject_only';end if;
 if jsonb_typeof(p_question_notes)<>'object' or octet_length(p_question_notes::text)>20000 then raise exception 'question_notes_invalid';end if;
 select * into s from gina.contribution_sets where id=p_id;
 if not found then raise exception 'contribution_not_found';end if;
 select array_agg(q->>'key') into keys from jsonb_array_elements(s.snapshot->'questions') q;
 for k,v in select * from jsonb_each(p_question_notes) loop
  if not (k = any(coalesce(keys,'{}'))) or jsonb_typeof(v)<>'string' or length(trim(v#>>'{}')) not between 3 and 1000 then
   raise exception 'question_notes_invalid';end if;
  notes:=notes||jsonb_build_object(k,trim(v#>>'{}'));
 end loop;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,93));
 select * into r from gina.contribution_commands where request_id=p_request_id;
 if found then
  -- Aynı istek: karar ve notlar aynı olmalı; farklı not = çakışma.
  if s.question_notes is distinct from notes then raise exception 'request_conflict';end if;
  return public.admin_decide_contribution_set(p_request_id,p_id,p_approve,p_note,p_teachers,p_confirmed);
 end if;
 result:=public.admin_decide_contribution_set(p_request_id,p_id,p_approve,p_note,p_teachers,p_confirmed);
 update gina.contribution_sets set question_notes=notes where id=p_id;
 insert into public.audit_log(actor_id,action,target_table,target_id,family_id,reason,details)
 values(auth.uid(),'contribution_set.question_notes','gina.contribution_sets',p_id::text,s.family_id,trim(p_note),
  jsonb_build_object('questions',(select jsonb_agg(x order by x) from jsonb_object_keys(notes) x)));
 return result||jsonb_build_object('question_notes',(select count(*) from jsonb_object_keys(notes)));
end;$$;

-- Mevcut (C07 kapılı) gövdelere tek alan eklenir.
create function gina.d3_extend(p_sig regprocedure,p_from text,p_to text) returns void language plpgsql set search_path='' as $$
declare def text:=pg_get_functiondef(p_sig);begin
 if (length(def)-length(replace(def,p_from,'')))/length(p_from)<>1 then raise exception 'd3_extend_unexpected_body %',p_sig;end if;
 execute replace(def,p_from,p_to);
end;$$;
do $$begin
 perform gina.d3_extend('public.admin_get_contribution_set(uuid)'::regprocedure,
  $o$'review_note',s.review_note,$o$,
  $n$'review_note',s.review_note,'question_notes',s.question_notes,$n$);
 perform gina.d3_extend('public.contribution_review_trail(uuid)'::regprocedure,
  $o$'review_note',c.review_note,$o$,
  $n$'review_note',c.review_note,'questions',gina.contribution_question_view(c.snapshot,c.question_notes),$n$);
end$$;
drop function gina.d3_extend(regprocedure,text,text);

-- 4. Yönetici erişiminin canlı kontrolü ------------------------------------------------------------
create function public.my_admin_access() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(gina.is_admin_strict(),false);
$$;

revoke all on function public.admin_operator_scopes(),public.admin_set_operator_scope(uuid,uuid,uuid,boolean,text,boolean),
 public.release_channel_failure_page(text,text,timestamptz,bigint,int),
 public.admin_decide_contribution_set(uuid,uuid,boolean,text,jsonb,boolean,jsonb),public.my_admin_access() from public,anon,service_role;
grant execute on function public.admin_operator_scopes(),public.admin_set_operator_scope(uuid,uuid,uuid,boolean,text,boolean),
 public.release_channel_failure_page(text,text,timestamptz,bigint,int),
 public.admin_decide_contribution_set(uuid,uuid,boolean,text,jsonb,boolean,jsonb),public.my_admin_access() to authenticated;
revoke all on function gina.contribution_question_notes_guard(),gina.contribution_question_view(jsonb,jsonb) from public,anon,authenticated,service_role;
