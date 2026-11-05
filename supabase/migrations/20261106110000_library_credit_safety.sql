-- P05/B02 (server): one read-only content lifecycle over the existing library tables,
-- credit (hak) safety, shared-source group integrity checks, the rejection → correction
-- → re-review chain for contributions, and the Birlikte Prova phase/ranking boundary.
-- No data is moved. Nothing here publishes content, opens a feature gate, grants a
-- credit or replaces the editorial (X06) / AI pre-review (E01) decisions.

-- 0. Correction chain columns (used by the view below). Existing copies start their own chain.
alter table gina.contribution_sets add column supersedes_id uuid references gina.contribution_sets(id),add column chain_id uuid;
update gina.contribution_sets set chain_id=id where chain_id is null;
create index contribution_sets_chain on gina.contribution_sets(chain_id,created_at);
create function gina.contribution_chain_default() returns trigger language plpgsql set search_path='' as $$
begin new.chain_id:=coalesce(new.chain_id,new.id);return new;end;$$;
revoke all on function gina.contribution_chain_default() from public,anon,authenticated,service_role;
create trigger contribution_chain_default before insert on gina.contribution_sets for each row execute function gina.contribution_chain_default();

-- 1. Unified lifecycle view -------------------------------------------------------------
-- status: draft | reviewed | approved | published | withdrawn. "approved" is never "published":
-- a package whose questions are all suitable but has no publication stays approved; a
-- publication whose review fingerprint went stale is reported with live=false.
create view gina.library_content_items as
with package_reviews as (
 select q.package_id,count(*) total,
  count(*) filter(where r.outcome='suitable') suitable,
  count(*) filter(where r.outcome is not null and r.outcome<>'unreviewed') reviewed,
  count(*) filter(where r.outcome='changes_requested') changes_requested
 from gina.library_import_questions q left join lateral
  (select outcome from gina.library_editorial_reviews where package_id=q.package_id and question_key=q.question_key order by review_revision desc limit 1) r on true
 group by q.package_id
)
select 'package'::text kind,p.id,p.title,p.grade::int grade,p.subject,
 case when pub.status='archived' then 'withdrawn' when pub.status='published' then 'published'
      when pr.total>0 and pr.suitable=pr.total then 'approved' when coalesce(pr.reviewed,0)>0 then 'reviewed' else 'draft' end status,
 p.revision version,pub.version publication_version,p.package_key series_key,p.previous_id,null::uuid parent_id,
 cs.family_id source_family_id,ai.prereview_status,
 case when pr.total>0 and pr.suitable=pr.total then 'suitable' when coalesce(pr.changes_requested,0)>0 then 'changes_requested' else null end admin_decision,
 coalesce(pub.status='published' and pub.review_fingerprint=gina.library_review_fingerprint(p.id) and pr.suitable=pr.total
  and not exists(select 1 from gina.library_import_sources s left join gina.library_delivery_assets a on a.source_hash=s.asset_hash where s.package_id=p.id and s.asset_hash is not null and a.source_hash is null),false) live,
 p.created_at,coalesce(pub.updated_at,p.created_at) updated_at
from gina.library_import_packages p
left join gina.library_publications pub on pub.package_id=p.id
left join package_reviews pr on pr.package_id=p.id
left join gina.content_prereviews ai on ai.target_kind='library_package' and ai.target_id=p.id
left join lateral (select family_id from gina.contribution_sets where package_id=p.id order by created_at limit 1) cs on true
union all
select 'contribution_set',c.id,c.snapshot->>'title',(c.snapshot->>'grade')::int,c.snapshot->>'subject',
 case c.status when 'approved' then 'approved' when 'rejected' then 'reviewed' when 'withdrawn' then 'withdrawn' else 'draft' end,
 (select count(*)::int from gina.contribution_sets o where o.chain_id=c.chain_id and (o.created_at,o.id)<=(c.created_at,c.id)),
 null,c.chain_id::text,c.supersedes_id,c.package_id,c.family_id,ai.prereview_status,
 case when c.status in('approved','rejected') then c.status end,false,c.created_at,coalesce(c.reviewed_at,c.created_at)
from gina.contribution_sets c left join gina.content_prereviews ai on ai.target_kind='contribution_set' and ai.target_id=c.id
union all
select 'legacy_item',i.id,coalesce(i.content->>'topic','?'),(i.content->>'grade')::int,i.content->>'subject',
 case i.status when 'published' then 'published' when 'archived' then 'withdrawn' else 'draft' end,
 1,null,i.content_hash,null,i.collection_id,null,null,null,
 i.status='published' and col.status='published',i.created_at,i.created_at
from public.library_items i join public.library_collections col on col.id=i.collection_id
union all
select 'collection',col.id,col.title,col.grade::int,col.subject,
 case col.status when 'published' then 'published' when 'archived' then 'withdrawn' else 'draft' end,
 1,null,null,null,null,null,null,null,col.status='published',col.created_at,col.created_at
from public.library_collections col
union all
select 'legacy_contribution',qc.id,coalesce(qc.content->>'topic','?'),(qc.content->>'grade')::int,qc.content->>'subject',
 case qc.status when 'approved' then 'approved' when 'rejected' then 'reviewed' when 'withdrawn' then 'withdrawn' else 'draft' end,
 1,null,qc.content_hash,null,qc.library_item_id,qc.family_id,null,
 case when qc.status in('approved','rejected') then qc.status end,false,qc.created_at,coalesce(qc.reviewed_at,qc.created_at)
from public.question_contributions qc;
revoke all on gina.library_content_items from public,anon,authenticated,service_role;

create function public.admin_library_content_items(p_kind text default null,p_status text default null,p_limit int default 100) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform gina.assert_admin();
 if p_limit is null or p_limit not between 1 and 500
 or (p_kind is not null and p_kind not in('package','contribution_set','legacy_item','collection','legacy_contribution'))
 or (p_status is not null and p_status not in('draft','reviewed','approved','published','withdrawn')) then raise exception 'invalid_input';end if;
 return (select coalesce(jsonb_agg(to_jsonb(v)),'[]') from (
  select * from gina.library_content_items i where (p_kind is null or i.kind=p_kind) and (p_status is null or i.status=p_status)
  order by i.updated_at desc,i.id limit p_limit)v);
end;$$;
revoke all on function public.admin_library_content_items(text,text,int) from public,anon,service_role;
grant execute on function public.admin_library_content_items(text,text,int) to authenticated;

-- 2. Assigned/published versions never change -------------------------------------------
-- Legacy catalogue items: content is frozen once published or copied into a family.
create function gina.guard_library_item() returns trigger language plpgsql security definer set search_path='' as $$
declare frozen boolean;begin
 frozen:=old.status<>'draft' or exists(select 1 from public.library_redemptions where item_id=old.id);
 if tg_op='DELETE' then
  if frozen then raise exception 'library_item_immutable';end if;return old;
 end if;
 if frozen and (new.content,new.content_hash,new.collection_id,new.created_at) is distinct from (old.content,old.content_hash,old.collection_id,old.created_at) then raise exception 'library_item_immutable';end if;
 return new;
end;$$;
revoke all on function gina.guard_library_item() from public,anon,authenticated,service_role;
create trigger library_item_frozen before update or delete on public.library_items for each row execute function gina.guard_library_item();

-- Publication decisions are versioned in place: every change must advance exactly one version.
create function gina.guard_library_publication() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'library_publication_immutable';end if;
 if new.package_id<>old.package_id or new.version<>old.version+1 then raise exception 'library_publication_immutable';end if;
 return new;
end;$$;
revoke all on function gina.guard_library_publication() from public,anon,authenticated,service_role;
create trigger library_publication_versioned before update or delete on gina.library_publications for each row execute function gina.guard_library_publication();

-- Frozen cohort question sets: once any family enrolled, the shared content cannot move.
create function gina.guard_group_exam_questions() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.group_exam_entries where group_id=old.group_id) then raise exception 'group_exam_locked';end if;
 if tg_op='DELETE' then return old;end if;return new;
end;$$;
revoke all on function gina.guard_group_exam_questions() from public,anon,authenticated,service_role;
create trigger group_exam_questions_frozen before update or delete on public.group_exam_questions for each row execute function gina.guard_group_exam_questions();

-- Accepted contribution copies keep their snapshot, package link and decision.
create function gina.guard_contribution_set() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.status='approved' and (new.status,new.snapshot,new.fingerprint,new.package_id,new.family_id,new.reviewed_at) is distinct from (old.status,old.snapshot,old.fingerprint,old.package_id,old.family_id,old.reviewed_at) then raise exception 'contribution_already_accepted';end if;
 if (new.chain_id,new.supersedes_id) is distinct from (old.chain_id,old.supersedes_id) then raise exception 'contribution_chain_immutable';end if;
 return new;
end;$$;
revoke all on function gina.guard_contribution_set() from public,anon,authenticated,service_role;

-- Acquisition rows are written once; the block is filled exactly once inside the acquiring transaction.
create function gina.guard_library_acquisition() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then
  if exists(select 1 from public.families where id=old.family_id) then raise exception 'library_acquisition_immutable';end if;return old;
 end if;
 if (new.id,new.family_id,new.package_id,new.unit_key,new.question_count,new.created_at) is distinct from (old.id,old.family_id,old.package_id,old.unit_key,old.question_count,old.created_at)
 or (new.block is distinct from old.block and old.block<>'{}'::jsonb) then raise exception 'library_acquisition_immutable';end if;
 return new;
end;$$;
revoke all on function gina.guard_library_acquisition() from public,anon,authenticated,service_role;
create trigger library_acquisition_frozen before update or delete on gina.library_acquisitions for each row execute function gina.guard_library_acquisition();
create function gina.guard_library_charge() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' or exists(select 1 from public.families where id=old.family_id) then raise exception 'library_charge_immutable';end if;
 return old;
end;$$;
revoke all on function gina.guard_library_charge() from public,anon,authenticated,service_role;
create trigger library_charge_frozen before update or delete on gina.library_acquisition_charges for each row execute function gina.guard_library_charge();
-- One family copy is charged by exactly one acquisition.
create unique index library_acquisition_charge_question on gina.library_acquisition_charges(question_id);

-- 3. Credits: earned / spent / remaining / renewal in one place ---------------------------
create function public.family_library_credits(p_family_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare f uuid;plan public.plans;used int;tz text;month_start timestamptz;accepted int;begin
 if gina.is_service() or gina.is_admin_strict() then
  f:=p_family_id;
  if f is null or not exists(select 1 from public.families where id=f) then raise exception 'invalid_input';end if;
 elsif coalesce(gina.is_parent(),false) then
  f:=gina.family_id();
  if p_family_id is not null and p_family_id<>f then raise exception 'forbidden' using errcode='42501';end if;
 else raise exception 'forbidden' using errcode='42501';end if;
 plan:=gina.family_plan_of(f);used:=gina.library_month_used(f);
 select coalesce(timezone,'Europe/Istanbul') into tz from public.families where id=f;
 month_start:=gina.family_month_start(f);
 select (select count(*) from public.question_contributions where family_id=f and status='approved')+(select count(*) from gina.contribution_question_credits where family_id=f) into accepted;
 return jsonb_build_object('family_id',f,'plan',plan.code,
  'monthly',jsonb_build_object('limit',plan.library_monthly,'used',used,'remaining',greatest(0,plan.library_monthly-used),
   'period_start',month_start,'renews_at',((month_start at time zone tz)+interval '1 month') at time zone tz),
  'bonus',(select jsonb_build_object('earned',coalesce(sum(g.amount),0),'used',coalesce(sum(gina.library_grant_used(g.id)),0),
    'remaining',coalesce(sum(greatest(0,g.amount-gina.library_grant_used(g.id))),0),
    'grants',coalesce(jsonb_agg(jsonb_build_object('id',g.id,'amount',g.amount,'used',gina.library_grant_used(g.id),'remaining',greatest(0,g.amount-gina.library_grant_used(g.id)),'starts_at',g.starts_at,'ends_at',g.ends_at,'policy_id',g.policy_id,'milestone',g.milestone,'reason',g.reason) order by g.ends_at,g.id),'[]'))
   from public.learning_credit_grants g where g.family_id=f and g.kind='library' and g.starts_at<=now() and g.ends_at>now()),
  'total_remaining',greatest(0,plan.library_monthly-used)+(select coalesce(sum(greatest(0,g.amount-gina.library_grant_used(g.id))),0) from public.learning_credit_grants g where g.family_id=f and g.kind='library' and g.starts_at<=now() and g.ends_at>now()),
  'expired_or_future_grants',(select count(*) from public.learning_credit_grants g where g.family_id=f and g.kind='library' and not(g.starts_at<=now() and g.ends_at>now())),
  'contributions',jsonb_build_object('accepted_questions',accepted,
   'credited_sets',(select count(distinct contribution_id) from gina.contribution_question_credits where family_id=f),
   'pending_sets',(select count(*) from gina.contribution_sets where family_id=f and status in('preparing','pending')),
   'next_milestones',(select coalesce(jsonb_agg(jsonb_build_object('policy_id',r.id,'title',r.title,'threshold',r.threshold,'kind',r.kind,'amount',r.amount,'valid_days',r.valid_days,
     'reached',accepted/r.threshold,'next_at',(accepted/r.threshold+1)*r.threshold,'remaining_to_next',(accepted/r.threshold+1)*r.threshold-accepted) order by (accepted/r.threshold+1)*r.threshold-accepted,r.id),'[]')
    from public.contribution_rewards r where r.enabled)));
end;$$;
revoke all on function public.family_library_credits(uuid) from public,anon;
grant execute on function public.family_library_credits(uuid) to authenticated,service_role;

-- Combined effect of overlapping reward rules for a given accepted count. Pure arithmetic over
-- the same milestone rule as gina.award_contribution_milestones; archive/note quotas are not here.
create function public.library_policy_preview(p_accepted_count int,p_rules jsonb default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare rules jsonb;r jsonb;i int:=0;out_rules jsonb:='[]';lib int:=0;ai int:=0;plan_days int:=0;stacking jsonb:='[]';
 a jsonb;b jsonb;ia int;ib int;common int;next_count int;next_grants jsonb;n int:=p_accepted_count;th int;am int;vd int;v_kind text;v_enabled boolean;begin
 if not(coalesce(gina.is_parent(),false) or gina.is_admin_strict() or gina.is_service()) then raise exception 'forbidden' using errcode='42501';end if;
 if n is null or n not between 0 and 100000 then raise exception 'invalid_input';end if;
 if p_rules is null then
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'threshold',threshold,'kind',kind,'amount',amount,'plan',plan,'valid_days',valid_days,'enabled',enabled) order by threshold,id),'[]') into rules from public.contribution_rewards where enabled;
 else
  if jsonb_typeof(p_rules) is distinct from 'array' or jsonb_array_length(p_rules)>20 then raise exception 'invalid_input';end if;
  rules:=p_rules;
 end if;
 for r in select value from jsonb_array_elements(rules) loop
  if jsonb_typeof(r) is distinct from 'object' then raise exception 'invalid_input';end if;
  begin th:=gina.import_int(r->'threshold',1,500);am:=gina.import_int(r->'amount',1,1000);vd:=gina.import_int(coalesce(r->'valid_days','30'::jsonb),1,365);
  exception when others then raise exception 'invalid_input';end;
  v_kind:=r->>'kind';v_enabled:=coalesce((r->>'enabled')::boolean,true);
  if v_kind not in('library','ai_questions','plan') or (v_kind='plan' and coalesce(r->>'plan','') not in('plus','pro')) then raise exception 'invalid_input';end if;
  out_rules:=out_rules||jsonb_build_array(jsonb_build_object('index',i,'id',r->'id','title',r->'title','threshold',th,'kind',v_kind,'amount',am,'plan',r->'plan','valid_days',vd,'enabled',v_enabled,
   'milestones',case when v_enabled then n/th else 0 end,'granted',case when v_enabled then (n/th)*am else 0 end,
   'plan_days',case when v_enabled and v_kind='plan' then (n/th)*least(am,vd) else 0 end,
   'next_at',case when v_enabled then (n/th+1)*th end));
  if v_enabled then
   if v_kind='library' then lib:=lib+(n/th)*am;elsif v_kind='ai_questions' then ai:=ai+(n/th)*am;else plan_days:=plan_days+(n/th)*least(am,vd);end if;
  end if;
  i:=i+1;
 end loop;
 -- Two enabled rules of one kind stack at every common multiple of their thresholds.
 for a in select value from jsonb_array_elements(out_rules) where (value->>'enabled')::boolean loop
  for b in select value from jsonb_array_elements(out_rules) where (value->>'enabled')::boolean and (value->>'index')::int>(a->>'index')::int and value->>'kind'=a->>'kind' loop
   ia:=(a->>'threshold')::int;ib:=(b->>'threshold')::int;common:=ia*ib/gcd(ia,ib);
   stacking:=stacking||jsonb_build_array(jsonb_build_object('rules',jsonb_build_array(a->'index',b->'index'),'kind',a->'kind','first_common_count',common,
    'combined_amount_at_common',case when a->>'kind'='plan' then least((a->>'amount')::int,(a->>'valid_days')::int)+least((b->>'amount')::int,(b->>'valid_days')::int) else (a->>'amount')::int+(b->>'amount')::int end));
  end loop;
 end loop;
 select min((value->>'next_at')::int) into next_count from jsonb_array_elements(out_rules) where (value->>'enabled')::boolean;
 select coalesce(jsonb_agg(jsonb_build_object('index',value->'index','kind',value->'kind','amount',value->'amount') order by (value->>'index')::int),'[]') into next_grants
  from jsonb_array_elements(out_rules) where (value->>'enabled')::boolean and (value->>'next_at')::int=next_count;
 return jsonb_build_object('accepted_count',n,'rules',out_rules,'totals',jsonb_build_object('library',lib,'ai_questions',ai,'plan_days',plan_days),
  'stacking',stacking,'next',case when next_count is null then null else jsonb_build_object('count',next_count,'remaining',next_count-n,'grants',next_grants) end,
  'rule','Her kural kendi eşiğinin tam katlarında, kabul edilen toplam soru sayısına göre bir kez hak verir; aynı kilometre taşı tekrar ödenmez.');
end;$$;
revoke all on function public.library_policy_preview(int,jsonb) from public,anon;
grant execute on function public.library_policy_preview(int,jsonb) to authenticated,service_role;

-- 4. Shared-source group integrity report ----------------------------------------------
-- Acquisition, contribution and cohort enrolment already move whole units; this surfaces any
-- copy where the group would have come apart (missing member, missing media, unfinalized group).
create function public.admin_library_group_integrity(p_limit int default 200) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform gina.assert_admin();
 if p_limit is null or p_limit not between 1 and 1000 then raise exception 'invalid_input';end if;
 return (select coalesce(jsonb_agg(to_jsonb(v)),'[]') from (
  select 'acquisition_charge_mismatch' issue,a.id subject_id,a.family_id,a.package_id,a.unit_key,a.question_count expected,(select count(*) from gina.library_acquisition_charges c where c.acquisition_id=a.id)::int actual
  from gina.library_acquisitions a where a.question_count<>(select count(*) from gina.library_acquisition_charges c where c.acquisition_id=a.id)
  union all
  select 'acquisition_group_members',a.id,a.family_id,a.package_id,a.unit_key,a.question_count,(select count(*) from public.question_source_members m where m.group_id=(a.block->>'id')::uuid)::int
  from gina.library_acquisitions a where a.block->>'kind'='group' and a.question_count<>(select count(*) from public.question_source_members m where m.group_id=(a.block->>'id')::uuid)
  union all
  select 'acquisition_group_unfinalized',a.id,a.family_id,a.package_id,a.unit_key,a.question_count,null
  from gina.library_acquisitions a join public.question_source_groups g on g.id=(a.block->>'id')::uuid where a.block->>'kind'='group' and g.finalized_at is null
  union all
  select 'acquisition_media_missing',a.id,a.family_id,a.package_id,a.unit_key,a.question_count,
   (select count(*) from gina.library_acquisition_charges c join public.learning_source_links l on l.question_id=c.question_id where c.acquisition_id=a.id)::int
  from gina.library_acquisitions a join gina.library_import_sources s on s.package_id=a.package_id and 'source:'||s.source_key=a.unit_key and s.asset_hash is not null
  where a.question_count<>(select count(*) from gina.library_acquisition_charges c join public.learning_source_links l on l.question_id=c.question_id where c.acquisition_id=a.id)
  union all
  select 'contribution_group_partial',c.id,c.family_id,c.package_id,null,jsonb_array_length(c.snapshot->'questions'),(select count(*) from gina.library_import_questions q where q.package_id=c.package_id)::int
  from gina.contribution_sets c where c.status='approved' and c.package_id is not null and jsonb_array_length(c.snapshot->'questions')<>(select count(*) from gina.library_import_questions q where q.package_id=c.package_id)
  union all
  select 'cohort_group_members',e.id,e.family_id,g.package_id,null,(select count(*) from public.group_exam_entry_questions eq where eq.entry_id=e.id),(select count(*) from public.group_exam_questions q where q.group_id=g.id)::int
  from public.group_exam_entries e join public.group_exams g on g.id=e.group_id
  where (select count(*) from public.group_exam_entry_questions eq where eq.entry_id=e.id)<>(select count(*) from public.group_exam_questions q where q.group_id=g.id)
  limit p_limit)v);
end;$$;
revoke all on function public.admin_library_group_integrity(int) from public,anon,service_role;
grant execute on function public.admin_library_group_integrity(int) to authenticated;

-- 5. Rejection → correction → re-review chain --------------------------------------------
create trigger contribution_set_frozen before update on gina.contribution_sets for each row execute function gina.guard_contribution_set();

-- Same signature for existing callers (Edge contribution-submit passes four named params); the
-- optional p_supersedes links a corrected copy to the rejected one. Without it, a corrected copy of
-- the same question (or a newer version of the same shared-source series) links automatically.
drop function public.begin_question_contribution(uuid,uuid,boolean,boolean);
create function public.begin_question_contribution(p_id uuid,p_question_id uuid,p_rights boolean,p_no_personal_data boolean,p_supersedes uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s gina.contribution_sets;prev gina.contribution_sets;v jsonb;h text;f uuid:=gina.family_id();series uuid;begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501';end if;
 if p_id is null or p_question_id is null or p_rights is not true or p_no_personal_data is not true then raise exception 'consent_required';end if;
 perform pg_advisory_xact_lock(hashtextextended(f::text,31));
 select * into s from gina.contribution_sets where id=p_id for update;
 if found then
  if s.family_id<>f or s.actor_id is distinct from auth.uid() or s.question_id is distinct from p_question_id
  or (p_supersedes is not null and s.supersedes_id is distinct from p_supersedes) then raise exception 'request_conflict';end if;
 else
  if not exists(select 1 from public.app_settings where key='contribution_sets.enabled' and value='true') then raise exception 'contribution_disabled';end if;
  if (select count(*) from gina.contribution_sets where family_id=f and created_at>now()-interval '1 day')>=20 then raise exception 'contribution_daily_limit';end if;
  v:=gina.contribution_snapshot(p_question_id);
  h:=encode(extensions.digest((v||jsonb_build_object('images',(select coalesce(jsonb_agg(value-'id'),'[]') from jsonb_array_elements(v->'images'))))::text,'sha256'),'hex');
  if p_supersedes is not null then
   select * into prev from gina.contribution_sets where id=p_supersedes and family_id=f;
   if not found then raise exception 'contribution_not_found';end if;
   if prev.status not in('rejected','withdrawn') then raise exception 'contribution_supersede_invalid';end if;
   if exists(select 1 from gina.contribution_sets where supersedes_id=prev.id and status<>'withdrawn') then raise exception 'contribution_supersede_taken';end if;
  else
   select g.series_id into series from public.question_source_groups g join public.question_source_members m on m.group_id=g.id where m.question_id=p_question_id and g.family_id=f;
   select o.* into prev from gina.contribution_sets o where o.family_id=f and o.status='rejected'
    and not exists(select 1 from gina.contribution_sets later where later.supersedes_id=o.id and later.status<>'withdrawn')
    and (o.question_id=p_question_id or (series is not null and exists(select 1 from public.question_source_groups og join public.question_source_members om on om.group_id=og.id where om.question_id=o.question_id and og.series_id=series)))
    order by o.reviewed_at desc nulls last,o.created_at desc limit 1;
  end if;
  select * into s from gina.contribution_sets where family_id=f and fingerprint=h and status<>'withdrawn';
  if not found then
   insert into gina.contribution_sets(id,family_id,actor_id,question_id,snapshot,fingerprint,status,consent_version,supersedes_id,chain_id)
   values(p_id,f,auth.uid(),p_question_id,v,h,case when jsonb_array_length(v->'images')=0 then 'pending' else 'preparing' end,'library-sharing-v2',prev.id,coalesce(prev.chain_id,p_id)) returning * into s;
  elsif prev.id is not null and s.fingerprint=prev.fingerprint then raise exception 'contribution_unchanged';
  end if;
 end if;
 if s.status='preparing' and s.actor_id is distinct from auth.uid() then raise exception 'contribution_in_progress';end if;
 return jsonb_build_object('id',s.id,'status',s.status,'snapshot',s.snapshot,'supersedes_id',s.supersedes_id,'chain_id',s.chain_id);
end;$$;
revoke all on function public.begin_question_contribution(uuid,uuid,boolean,boolean,uuid) from public,anon,service_role;
grant execute on function public.begin_question_contribution(uuid,uuid,boolean,boolean,uuid) to authenticated;

-- Traceable history of one contribution chain: rejection reason, corrected copies, re-review,
-- AI pre-review state and the resulting draft package. Parents see their own family only.
create function public.contribution_review_trail(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s gina.contribution_sets;admin boolean:=gina.is_admin_strict();begin
 if not(admin or coalesce(gina.is_parent(),false)) then raise exception 'forbidden' using errcode='42501';end if;
 select * into s from gina.contribution_sets where id=p_id and (admin or family_id=gina.family_id());
 if not found then raise exception 'contribution_not_found';end if;
 return jsonb_build_object('chain_id',s.chain_id,'family_id',case when admin then s.family_id end,
  'current',(select id from gina.contribution_sets where chain_id=s.chain_id and status<>'withdrawn' order by created_at desc,id desc limit 1),
  'steps',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'version',c.version,'status',c.status,'created_at',c.created_at,
    'supersedes_id',c.supersedes_id,'question_id',case when admin then c.question_id end,'title',c.snapshot->>'title','question_count',jsonb_array_length(c.snapshot->'questions'),
    'decision',case when c.status in('approved','rejected') then c.status end,'review_note',c.review_note,'reviewed_at',c.reviewed_at,'reviewed_by',case when admin then c.reviewed_by end,
    'package_id',c.package_id,'prereview_status',ai.prereview_status,'prereview_at',ai.prereview_at,
    'package_status',(select i.status from gina.library_content_items i where i.kind='package' and i.id=c.package_id)) order by c.version),'[]')
   from (select o.*,row_number() over(order by o.created_at,o.id) version from gina.contribution_sets o where o.chain_id=s.chain_id) c
   left join gina.content_prereviews ai on ai.target_kind='contribution_set' and ai.target_id=c.id));
end;$$;
revoke all on function public.contribution_review_trail(uuid) from public,anon,service_role;
grant execute on function public.contribution_review_trail(uuid) to authenticated;

-- Package revisions: each revision is immutable, so the trail walks previous_id both ways and
-- reports per-question editorial outcomes and the publication state of every revision.
create function public.admin_library_package_trail(p_package_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare pk text;begin
 perform gina.assert_admin();
 select package_key into pk from gina.library_import_packages where id=p_package_id;
 if pk is null then raise exception 'library_review_not_found';end if;
 return jsonb_build_object('package_key',pk,'revisions',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'revision',p.revision,'previous_id',p.previous_id,'content_hash',p.content_hash,'created_at',p.created_at,
   'status',i.status,'live',i.live,'publication_version',i.publication_version,'prereview_status',i.prereview_status,
   'questions',(select coalesce(jsonb_agg(jsonb_build_object('key',q.question_key,'revision',q.revision,'outcome',r.outcome,'note',r.note,'review_revision',r.review_revision,'reviewed_at',r.created_at) order by q.position),'[]')
    from gina.library_import_questions q left join lateral (select * from gina.library_editorial_reviews where package_id=q.package_id and question_key=q.question_key order by review_revision desc limit 1) r on true where q.package_id=p.id)) order by p.revision),'[]')
  from gina.library_import_packages p join gina.library_content_items i on i.kind='package' and i.id=p.id where p.package_key=pk));
end;$$;
revoke all on function public.admin_library_package_trail(uuid) from public,anon,service_role;
grant execute on function public.admin_library_package_trail(uuid) to authenticated;

-- 6. Birlikte Prova: separate phases, optional ranking, unscored never ranked ---------------
-- Only entries that are finished, consented and (for reviewed cohorts) fully reviewed and
-- published can be ranked. Unreadable or pending reviews keep an entry out of the board.
create function gina.cohort_ranking_rows(p_group uuid) returns table(entry_id uuid,alias text,points int,maximum int,eligible boolean,reason text)
language sql stable security definer set search_path='' as $$
 with g as (select * from public.group_exams where id=p_group),
 s as (select gina.cohort_review_state(p_group) state from g where requires_review),
 rows as (select * from gina.cohort_rows(p_group))
 select e.id,e.alias,sum(rows.points)::int,sum(rows.maximum)::int,
  bool_and(e.ranking_consent and rows.attempt_status<>'in_progress' and rows.reviewed and rows.outcome<>'unreadable' and rows.points is not null)
   and coalesce((select (state->>'published')::boolean from s),true),
  case when not e.ranking_consent then 'no_consent' when bool_or(rows.attempt_status='in_progress') then 'unfinished'
   when bool_or(rows.outcome='unreadable') then 'unreadable' when bool_or(not rows.reviewed or rows.points is null) then 'unscored'
   when exists(select 1 from s where (state->>'published')::boolean is not true) then 'results_not_published' else 'eligible' end
 from public.group_exam_entries e join rows on rows.entry_id=e.id where e.group_id=p_group group by e.id,e.alias,e.ranking_consent;
$$;
revoke all on function gina.cohort_ranking_rows(uuid) from public,anon,authenticated,service_role;

create function public.group_exam_phases(p_group uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare g public.group_exams;admin boolean:=gina.is_admin_strict();f uuid;s jsonb;begin
 if not(admin or coalesce(gina.is_parent(),false)) then raise exception 'forbidden' using errcode='42501';end if;
 select * into g from public.group_exams where id=p_group;
 if not found then raise exception 'not_found';end if;
 if not admin then
  f:=gina.family_id();
  if g.status<>'published' and not exists(select 1 from public.group_exam_entries where group_id=g.id and family_id=f) then raise exception 'not_found';end if;
 end if;
 if g.requires_review then s:=gina.cohort_review_state(g.id);end if;
 return jsonb_build_object('group_id',g.id,'status',g.status,
  'participation',jsonb_build_object('starts_at',g.starts_at,'ends_at',g.ends_at,'open',g.status='published' and now()>=g.starts_at and now()<g.ends_at,
   'phase',case when g.status<>'published' then 'cancelled' when now()<g.starts_at then 'upcoming' when now()<g.ends_at then 'open' else 'closed' end,
   'entries',case when admin then (select count(*) from public.group_exam_entries where group_id=g.id) end,
   'my_entries',case when admin then null else (select coalesce(jsonb_agg(jsonb_build_object('child_id',child_id,'exam_id',exam_id,'ranking_consent',ranking_consent,'review_consent_at',review_consent_at)),'[]') from public.group_exam_entries where group_id=g.id and family_id=f) end),
  'child_time',jsonb_build_object('duration_minutes',g.duration_minutes,'deadline_rule','started_at + duration, never past participation end','one_attempt',true),
  'review',jsonb_build_object('required',g.requires_review,'phase',case when not g.requires_review then 'automatic' when now()<g.ends_at then 'waiting_for_window' when (s->>'pending')::int>0 or (s->>'unfinished')::int>0 then 'in_review' when (s->>'appeals')::int>0 then 'appeals_open' when (s->>'published')::boolean then 'published' else 'ready_to_publish' end,
   'pending',s->'pending','unfinished',s->'unfinished','appeals',s->'appeals','published',coalesce(s->'published','true'::jsonb),'publication_version',s->'version'),
  'ranking',jsonb_build_object('optional',true,'consent_required',true,'secondary',true,
   'eligible_entries',(select count(*) from gina.cohort_ranking_rows(g.id) where eligible),
   'excluded',(select coalesce(jsonb_object_agg(reason,n),'{}') from (select reason,count(*) n from gina.cohort_ranking_rows(g.id) where not eligible group by reason)x),
   'mine',case when admin then null else (select coalesce(jsonb_agg(jsonb_build_object('child_id',e.child_id,'eligible',r.eligible,'reason',r.reason)),'[]') from gina.cohort_ranking_rows(g.id) r join public.group_exam_entries e on e.id=r.entry_id where e.family_id=f) end));
end;$$;
revoke all on function public.group_exam_phases(uuid) from public,anon,service_role;
grant execute on function public.group_exam_phases(uuid) to authenticated;

-- Automatic (multiple-choice) cohorts: an attempt still in progress is not a result and is kept
-- out of the definitive board; the parent still sees their own interim count.
create or replace function gina.automatic_group_result(p_group uuid,p_child uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare e public.group_exam_entries;g public.group_exams;me record;topics jsonb;board jsonb;mine_eligible boolean;mine_reason text;
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501';end if;
 select * into e from public.group_exam_entries where group_id=p_group and child_id=p_child and family_id=gina.family_id();
 if e.id is null then raise exception 'not_found';end if;
 select * into g from public.group_exams where id=p_group;
 if now()<g.ends_at and g.status='published' then return jsonb_build_object('ready',false,'ends_at',g.ends_at);end if;
 select * into me from gina.group_scores(p_group) where entry_id=e.id;
 if me.entry_id is null then return jsonb_build_object('ready',true,'participated',false,'cancelled',g.status='cancelled');end if;
 select r.eligible,r.reason into mine_eligible,mine_reason from gina.cohort_ranking_rows(p_group) r where r.entry_id=e.id;
 select jsonb_agg(to_jsonb(t) order by t.topic) into topics from (
  select q.content->>'topic' topic,count(*)::int total,count(*) filter(where a.answer_key=q.content->>'correct_key')::int correct,
  count(*) filter(where a.answer_key is null)::int unanswered
  from public.group_exam_entry_questions eq join public.group_exam_questions q on q.group_id=e.group_id and q.ord=eq.ord
  left join public.exam_answers a on a.attempt_id=me.attempt_id and a.question_id=eq.question_id
  where eq.entry_id=e.id group by q.content->>'topic') t;
 if e.ranking_consent and g.status='published' then
  select coalesce(jsonb_agg(jsonb_build_object('alias',s.alias,'correct',s.correct,'total',s.total,'rank',s.rank,'mine',s.entry_id=e.id) order by s.rank,s.alias),'[]') into board
  from (select sc.*,rank() over(order by sc.correct desc) rank,row_number() over(order by sc.correct desc,sc.alias) pos
   from gina.group_scores(p_group) sc join gina.cohort_ranking_rows(p_group) el on el.entry_id=sc.entry_id where el.eligible) s where s.pos<=50 or s.entry_id=e.id;
 end if;
 return jsonb_build_object('ready',true,'participated',true,'cancelled',g.status='cancelled','correct',me.correct,'total',me.total,'attempt_id',me.attempt_id,'topics',topics,
  'ranking',coalesce(board,'[]'),'ranking_optional',true,'ranked',coalesce(mine_eligible,false),'ranking_reason',mine_reason,
  'interim',exists(select 1 from public.exam_attempts a where a.id=me.attempt_id and a.status='in_progress'));
end;$$;
revoke all on function gina.automatic_group_result(uuid,uuid) from public,anon,authenticated,service_role;

-- Reviewed cohorts: the published board must not contain unscored or unreadable entries.
create or replace function public.get_group_result(p_group uuid,p_child uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare e public.group_exam_entries;g public.group_exams;s jsonb;me record;board jsonb:='[]';mine_eligible boolean;mine_reason text;begin
 if not coalesce(gina.is_parent(),false) then raise exception 'forbidden' using errcode='42501';end if;
 select * into e from public.group_exam_entries where group_id=p_group and child_id=p_child and family_id=gina.family_id();
 if not found then raise exception 'not_found';end if;select * into g from public.group_exams where id=p_group;
 if not g.requires_review then return gina.automatic_group_result(p_group,p_child);end if;
 if now()<g.ends_at and g.status='published' then return jsonb_build_object('ready',false,'requires_review',true,'ends_at',g.ends_at);end if;
 s:=gina.cohort_review_state(g.id);
 select min(attempt_id::text)::uuid attempt_id,sum(points) points,sum(maximum) maximum,count(*) total,count(*) filter(where points=maximum and reviewed) correct from gina.cohort_rows(g.id) where entry_id=e.id into me;
 if me.attempt_id is null then return jsonb_build_object('ready',true,'participated',false,'cancelled',g.status='cancelled','requires_review',true);end if;
 select r.eligible,r.reason into mine_eligible,mine_reason from gina.cohort_ranking_rows(g.id) r where r.entry_id=e.id;
 if e.ranking_consent and g.status='published' and s->>'published'='true' then
  select coalesce(jsonb_agg(jsonb_build_object('alias',v.alias,'points',v.points,'maximum',v.maximum,'rank',v.rank,'mine',v.entry_id=e.id) order by v.rank,v.alias),'[]') into board from (
   select *,rank() over(order by points desc) rank,row_number() over(order by points desc,alias) position from gina.cohort_ranking_rows(g.id) where eligible
  )v where v.position<=50 or v.entry_id=e.id;
 end if;
 return jsonb_build_object('ready',true,'participated',true,'cancelled',g.status='cancelled','requires_review',true,'published',s->'published','publication_version',s->'version',
 'points',case when s->>'published'='true' then me.points end,'maximum',me.maximum,'total',me.total,'correct',me.correct,'attempt_id',me.attempt_id,'ranking',board,'topics','[]'::jsonb,
 'ranking_optional',true,'ranked',coalesce(mine_eligible,false),'ranking_reason',mine_reason,
 'reviews',(select coalesce(jsonb_agg(jsonb_build_object('ord',r.ord,'stem',r.content->>'stem','kind',r.content->>'kind','topic',r.content->>'topic','maximum',r.maximum,'points',r.points,'outcome',r.outcome,'feedback',r.feedback,'revision',r.review_revision,
 'criteria',r.content#>'{rubric,criteria}','criterion_points',(select criterion_points from gina.cohort_reviews where entry_id=e.id and ord=r.ord),
 'appeal',(select jsonb_build_object('status',a.status,'reason',a.reason,'response',a.response) from gina.cohort_appeals a where entry_id=e.id and ord=r.ord)) order by r.ord),'[]') from gina.cohort_rows(g.id)r where r.entry_id=e.id));
end;$$;
revoke all on function public.get_group_result(uuid,uuid) from public,anon,service_role;
grant execute on function public.get_group_result(uuid,uuid) to authenticated;
