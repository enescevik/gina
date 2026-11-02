-- Catalog content is separate from the legacy free question bank. Paid answers
-- are never exposed by a catalogue SELECT; redeem copies an immutable version.
alter table public.plans add column library_monthly int not null default 0 check(library_monthly between 0 and 10000);
update public.plans set library_monthly=case code when 'free' then 5 when 'plus' then 40 else 120 end;
create table public.library_collections (
 id uuid primary key default gen_random_uuid(), title text not null check(length(trim(title)) between 3 and 160),
 description text not null default '', grade smallint not null check(grade between 1 and 12), subject text not null,
 curriculum_version text not null default '', status text not null default 'draft' check(status in('draft','published','archived')),
 plans public.plan_code[] not null default array['plus','pro']::public.plan_code[],
 created_at timestamptz not null default now()
);
create table public.library_items (
 id uuid primary key default gen_random_uuid(), collection_id uuid not null references public.library_collections(id),
 content jsonb not null, content_hash text not null unique, status text not null default 'draft' check(status in('draft','published','archived')),
 created_at timestamptz not null default now()
);
create table public.question_contributions (
 id uuid primary key, family_id uuid not null references public.families(id) on delete cascade,
 submitted_by uuid references auth.users(id) on delete set null,
 source_question_id uuid references public.question_bank(id) on delete set null,
 content jsonb not null, content_hash text not null,
 status text not null default 'pending' check(status in('pending','approved','rejected','withdrawn')),
 consent_version text not null, reviewed_by uuid references auth.users(id) on delete set null, review_note text,
 library_item_id uuid references public.library_items(id), created_at timestamptz not null default now(),reviewed_at timestamptz,
 unique(family_id,content_hash)
);
create table public.contribution_rewards (
 id uuid primary key default gen_random_uuid(),title text not null,
 threshold int not null check(threshold between 1 and 500),
 kind text not null check(kind in('library','ai_questions','plan')),
 amount int not null check(amount between 1 and 1000), plan public.plan_code,
 valid_days int not null check(valid_days between 1 and 365),enabled boolean not null default false,
 check((kind='plan' and plan is not null and plan in('plus','pro')) or (kind<>'plan' and plan is null))
);
-- Business parameters are visible/configurable; disabled until the operator publishes a policy.
insert into public.contribution_rewards(title,threshold,kind,amount,valid_days) values('5 kabul edilen soru için 20 kütüphane hakkı',5,'library',20,30);
create table public.learning_credit_grants (
 id uuid primary key default gen_random_uuid(),family_id uuid not null references public.families(id) on delete cascade,
 policy_id uuid references public.contribution_rewards(id),milestone int,
 kind text not null check(kind in('library','ai_questions','plan')),amount int not null check(amount>0),
 starts_at timestamptz not null default now(),ends_at timestamptz not null,reason text not null,
 unique(family_id,policy_id,milestone)
);
create table public.library_redemptions (
 family_id uuid not null references public.families(id) on delete cascade,
 item_id uuid not null references public.library_items(id),
 question_id uuid not null references public.question_bank(id) on delete no action deferrable initially deferred,
 credit_grant_id uuid references public.learning_credit_grants(id) on delete set null,
 created_at timestamptz not null default now(),primary key(family_id,item_id)
);
-- Source images will be referenced by validated asset IDs, never arbitrary URLs.
create function gina.library_question(p jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare q jsonb;
begin
 q:=jsonb_build_object('grade',p->'grade','subject',p->'subject','topic',p->'topic','kind',p->'kind','difficulty',p->'difficulty','stem',p->'stem','choices',p->'choices','correct_key',p->'correct_key','expected_answer',p->'expected_answer','solution',p->'solution','explanation',p->'explanation');
 if coalesce((q->>'grade')::int,0) not between 1 and 12 or length(trim(coalesce(q->>'subject',''))) not between 1 and 80
 or length(trim(coalesce(q->>'topic',''))) not between 1 and 200 or length(trim(coalesce(q->>'stem',''))) not between 5 and 10000
 or coalesce(q->>'kind','') not in('multiple_choice','open_ended') or coalesce(q->>'difficulty','') not in('kolay','orta','orta_ustu','zor')
 or length(trim(coalesce(q->>'solution',''))) not between 1 and 10000 then raise exception 'question_incomplete'; end if;
 if q->>'kind'='multiple_choice' then
  if coalesce(jsonb_typeof(q->'choices'),'null')<>'array' or jsonb_array_length(q->'choices')<>4
  or (select count(distinct x->>'key') from jsonb_array_elements(q->'choices') x where x->>'key' in('A','B','C','D') and length(trim(coalesce(x->>'text','')))>0)<>4
  or coalesce(q->>'correct_key','') not in('A','B','C','D') then raise exception 'question_incomplete'; end if;
 elsif length(trim(coalesce(q->>'expected_answer',''))) not between 1 and 10000 then raise exception 'question_incomplete'; end if;
 return q;
end; $$;
create function gina.library_hash(p jsonb) returns text language sql immutable set search_path='' as $$
 select encode(extensions.digest(lower(regexp_replace(jsonb_build_object('stem',p->'stem','choices',p->'choices','answer',coalesce(nullif(p->'correct_key','null'::jsonb),p->'expected_answer'))::text,'\s+',' ','g')),'sha256'),'hex');
$$;
revoke all on function gina.library_question(jsonb),gina.library_hash(jsonb) from public,anon,authenticated;

do $$ declare t text; begin
 foreach t in array array['library_collections','library_items','question_contributions','contribution_rewards','learning_credit_grants','library_redemptions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end; $$;
grant select on public.library_collections,public.contribution_rewards to authenticated;
create policy catalog_admin on public.library_collections for all to authenticated using(gina.is_admin_strict()) with check(gina.is_admin_strict());
create policy rewards_admin on public.contribution_rewards for all to authenticated using(gina.is_admin_strict()) with check(gina.is_admin_strict());
grant select on public.question_contributions,public.learning_credit_grants to authenticated;
create policy contribution_read on public.question_contributions for select to authenticated using(gina.is_admin_strict() or (gina.is_parent() and family_id=gina.family_id()));
create policy credit_read on public.learning_credit_grants for select to authenticated using(gina.is_admin_strict() or (gina.is_parent() and family_id=gina.family_id()));
create trigger audit_library_collections after insert or update on public.library_collections for each row execute function gina.audit_row('id');
create trigger audit_contribution_rewards after insert or update on public.contribution_rewards for each row execute function gina.audit_row('id');

create function public.submit_question_contribution(p_request_id uuid,p_question_id uuid,p_rights_confirmed boolean,p_no_personal_data boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare q public.question_bank; v jsonb; h text; existing public.question_contributions; f uuid:=gina.family_id();
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501'; end if;
 if p_rights_confirmed is not true or p_no_personal_data is not true or p_request_id is null then raise exception 'consent_required'; end if;
 select * into q from public.question_bank where id=p_question_id and family_id=f;
 if q.id is null then raise exception 'question_not_found'; end if;
 v:=gina.library_question(to_jsonb(q));h:=gina.library_hash(v);
 perform pg_advisory_xact_lock(hashtextextended(f::text,31));
 select * into existing from public.question_contributions where id=p_request_id;
 if found then
  if existing.family_id<>f or existing.submitted_by<>auth.uid() or existing.content<>v then raise exception 'request_conflict'; end if;
  return existing.id;
 end if;
 select * into existing from public.question_contributions where family_id=f and content_hash=h;
 if found then return existing.id; end if;
 insert into public.question_contributions(id,family_id,submitted_by,source_question_id,content,content_hash,consent_version)
 values(p_request_id,f,auth.uid(),p_question_id,v,h,'library-sharing-v1');
 return p_request_id;
end; $$;

create function public.admin_add_library_item(p_collection_id uuid,p_content jsonb,p_publish boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare q jsonb; c public.library_collections; v_id uuid; existing public.library_items; h text;
begin
 perform gina.assert_admin(); q:=gina.library_question(p_content);
 select * into c from public.library_collections where id=p_collection_id;
 if c.id is null or (q->>'grade')::int<>c.grade or q->>'subject'<>c.subject then raise exception 'collection_mismatch'; end if;
 h:=gina.library_hash(q);
 perform pg_advisory_xact_lock(hashtextextended(h,40));
 select * into existing from public.library_items where content_hash=h;
 if found then
  if existing.collection_id=c.id and existing.content=q then return existing.id; end if;
  raise exception 'duplicate_question';
 end if;
 insert into public.library_items(collection_id,content,content_hash,status)
 values(c.id,q,h,case when p_publish then 'published' else 'draft' end) returning id into v_id;
 insert into public.audit_log(actor_id,action,target_table,target_id) values(auth.uid(),'library_item.created','library_items',v_id::text);
 return v_id;
end; $$;

create function public.admin_review_contribution(p_id uuid,p_approve boolean,p_collection_id uuid,p_note text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.question_contributions; item uuid; pol public.contribution_rewards; n int; m int; grant_id uuid;
begin
 perform gina.assert_admin();
 if p_approve is null or length(trim(coalesce(p_note,'')))<3 then raise exception 'review_note_required'; end if;
 select * into s from public.question_contributions where id=p_id for update;
 if s.id is null then raise exception 'not_found'; end if;
 if s.status<>'pending' then
  if (s.status='approved' and p_approve) or (s.status='rejected' and not p_approve) then return jsonb_build_object('status',s.status,'item_id',s.library_item_id); end if;
  raise exception 'already_reviewed';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(s.family_id::text,31));
 if p_approve then
  perform pg_advisory_xact_lock(hashtextextended(s.content_hash,40));
  if exists(select 1 from public.library_items where content_hash=s.content_hash) then raise exception 'duplicate_question'; end if;
  -- Only a new original content item can earn a contribution reward.
  item:=public.admin_add_library_item(p_collection_id,s.content,false);
 end if;
 update public.question_contributions set status=case when p_approve then 'approved' else 'rejected' end,
 reviewed_by=auth.uid(),review_note=trim(p_note),reviewed_at=now(),library_item_id=item where id=s.id;
 if p_approve then
  perform pg_advisory_xact_lock(73491821);
  select count(*) into n from public.question_contributions where family_id=s.family_id and status='approved';
  for pol in select * from public.contribution_rewards where enabled loop
   if n%pol.threshold<>0 then continue; end if;
   m:=n/pol.threshold;
   insert into public.learning_credit_grants(family_id,policy_id,milestone,kind,amount,ends_at,reason)
   values(s.family_id,pol.id,m,pol.kind,pol.amount,now()+make_interval(days=>pol.valid_days),'Accepted library contribution milestone')
   on conflict(family_id,policy_id,milestone) do nothing returning id into grant_id;
   if grant_id is not null and pol.kind='plan' then
    insert into public.entitlement_overrides(family_id,plan,reason,granted_by,ends_at)
    values(s.family_id,pol.plan,'Library contribution: '||grant_id::text,auth.uid(),now()+make_interval(days=>least(pol.amount,pol.valid_days)));
   end if;
  end loop;
 end if;
 insert into public.audit_log(actor_id,action,target_table,target_id,family_id,reason)
 values(auth.uid(),'contribution.'||case when p_approve then 'approved' else 'rejected' end,'question_contributions',s.id::text,s.family_id,trim(p_note));
 return jsonb_build_object('status',case when p_approve then 'approved' else 'rejected' end,'item_id',item);
end; $$;

create function public.get_learning_library() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare f uuid:=gina.family_id(); p public.plans; used int; credits int;
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501'; end if;
 p:=gina.family_plan_of(f);
 select count(*) into used from public.library_redemptions where family_id=f and credit_grant_id is null and created_at>=gina.family_month_start(f);
 select coalesce(sum(greatest(0,g.amount-(select count(*) from public.library_redemptions r where r.credit_grant_id=g.id))),0)::int into credits
 from public.learning_credit_grants g where g.family_id=f and kind='library' and starts_at<=now() and ends_at>now();
 return jsonb_build_object('limit',p.library_monthly,'remaining',greatest(0,p.library_monthly-used),'bonus',credits,
 'contributions',(select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at desc),'[]') from(select id,status,review_note,created_at,content->>'topic' topic from public.question_contributions where family_id=f order by created_at desc limit 50)s),
 'grants',(select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'amount',amount,'ends_at',ends_at) order by ends_at),'[]') from public.learning_credit_grants where family_id=f and starts_at<=now() and ends_at>now()),
 'rewards',(select coalesce(jsonb_agg(jsonb_build_object('title',title,'threshold',threshold,'kind',kind,'amount',amount,'valid_days',valid_days)),'[]') from public.contribution_rewards where enabled),
 'collections',(select coalesce(jsonb_agg(to_jsonb(c)),'[]') from(
  select c.id,c.title,c.description,c.grade,c.subject,c.curriculum_version,(p.code=any(c.plans)) accessible,
  (select count(*) from public.library_items i where i.collection_id=c.id and i.status='published') item_count
  from public.library_collections c where c.status='published' order by c.grade,c.title)c));
end; $$;
create function public.get_library_items(p_collection_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare f uuid:=gina.family_id(); p public.plans;
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501'; end if;
 p:=gina.family_plan_of(f);
 if not exists(select 1 from public.library_collections where id=p_collection_id and status='published' and p.code=any(plans)) then raise exception 'library_plan_required'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'topic',i.content->>'topic','kind',i.content->>'kind','difficulty',i.content->>'difficulty','owned',r.question_id)),'[]')
 from public.library_items i left join public.library_redemptions r on r.item_id=i.id and r.family_id=f
 where i.collection_id=p_collection_id and i.status='published');
end; $$;
create function public.redeem_library_item(p_item_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id(); p public.plans; i public.library_items; c public.library_collections; q uuid; v public.question_bank; used int; bonus uuid;
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(f::text,32));
 select question_id into q from public.library_redemptions where family_id=f and item_id=p_item_id;
 if found then return q; end if;
 p:=gina.family_plan_of(f);
 select * into i from public.library_items where id=p_item_id and status='published';
 select * into c from public.library_collections where id=i.collection_id and status='published';
 if i.id is null or c.id is null or not(p.code=any(c.plans)) then raise exception 'library_plan_required'; end if;
 select count(*) into used from public.library_redemptions where family_id=f and credit_grant_id is null and created_at>=gina.family_month_start(f);
 if used>=p.library_monthly then
  select g.id into bonus from public.learning_credit_grants g where family_id=f and kind='library' and starts_at<=now() and ends_at>now()
  and g.amount>(select count(*) from public.library_redemptions r where r.credit_grant_id=g.id) order by ends_at,id limit 1 for update;
  if bonus is null then raise exception 'library_quota_exceeded'; end if;
 end if;
 v:=jsonb_populate_record(null::public.question_bank,i.content);
 insert into public.question_bank(family_id,grade,subject,topic,kind,difficulty,stem,choices,correct_key,expected_answer,solution,explanation,provenance,created_by)
 values(f,v.grade,v.subject,v.topic,v.kind,v.difficulty,v.stem,v.choices,v.correct_key,v.expected_answer,v.solution,v.explanation,jsonb_build_object('generator','gina-library','item_id',i.id,'curriculum_version',c.curriculum_version),auth.uid()) returning id into q;
 insert into public.library_redemptions(family_id,item_id,question_id,credit_grant_id) values(f,i.id,q,bonus);
 return q;
end; $$;

revoke all on function public.submit_question_contribution(uuid,uuid,boolean,boolean),public.admin_add_library_item(uuid,jsonb,boolean),public.admin_review_contribution(uuid,boolean,uuid,text),public.get_learning_library(),public.get_library_items(uuid),public.redeem_library_item(uuid) from public,anon;
grant execute on function public.submit_question_contribution(uuid,uuid,boolean,boolean),public.admin_add_library_item(uuid,jsonb,boolean),public.admin_review_contribution(uuid,boolean,uuid,text),public.get_learning_library(),public.get_library_items(uuid),public.redeem_library_item(uuid) to authenticated;
create function public.admin_learning_library() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform gina.assert_admin();
 return jsonb_build_object(
 'collections',(select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at desc),'[]') from public.library_collections c),
 'items',(select coalesce(jsonb_agg(to_jsonb(i)),'[]') from(select * from public.library_items order by created_at desc limit 200)i),
 'submissions',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from(select * from public.question_contributions order by created_at desc limit 100)s),
 'quotas',(select jsonb_agg(jsonb_build_object('plan',code,'monthly',library_monthly) order by sort_order) from public.plans),
 'rewards',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from public.contribution_rewards r));
end; $$;
create function public.admin_publish_library_item(p_id uuid,p_published boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 perform gina.assert_admin();
 update public.library_items set status=case when p_published then 'published' else 'archived' end where id=p_id;
 if not found then raise exception 'not_found'; end if;
 insert into public.audit_log(actor_id,action,target_table,target_id) values(auth.uid(),case when p_published then 'library_item.published' else 'library_item.archived' end,'library_items',p_id::text);
end; $$;
create function public.admin_save_library_collection(p_id uuid,p_title text,p_description text,p_grade int,p_subject text,p_curriculum text,p_plans public.plan_code[],p_status text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid:=coalesce(p_id,gen_random_uuid());
begin
 perform gina.assert_admin();
 if p_plans is null or cardinality(p_plans)<1 or length(trim(coalesce(p_subject,'')))<1 or (p_status='published' and length(trim(coalesce(p_curriculum,'')))<3) then raise exception 'collection_incomplete'; end if;
 if exists(select 1 from public.library_collections c where c.id=v_id and (c.grade<>p_grade or c.subject<>trim(p_subject)) and exists(select 1 from public.library_items i where i.collection_id=c.id)) then raise exception 'collection_identity_locked'; end if;
 insert into public.library_collections(id,title,description,grade,subject,curriculum_version,plans,status)
 values(v_id,trim(p_title),p_description,p_grade,trim(p_subject),trim(p_curriculum),p_plans,p_status)
 on conflict(id) do update set title=excluded.title,description=excluded.description,grade=excluded.grade,subject=excluded.subject,curriculum_version=excluded.curriculum_version,plans=excluded.plans,status=excluded.status;
 return v_id;
end; $$;
revoke all on function public.admin_learning_library(),public.admin_publish_library_item(uuid,boolean),public.admin_save_library_collection(uuid,text,text,int,text,text,public.plan_code[],text) from public,anon;
grant execute on function public.admin_learning_library(),public.admin_publish_library_item(uuid,boolean),public.admin_save_library_collection(uuid,text,text,int,text,text,public.plan_code[],text) to authenticated;
