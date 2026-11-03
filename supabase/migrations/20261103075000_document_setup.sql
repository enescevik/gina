-- Document provenance is linked in the same transaction as the selected drafts.
alter table public.learning_source_ai_consents drop constraint learning_source_ai_consents_purpose_check;
alter table public.learning_source_ai_consents add constraint learning_source_ai_consents_purpose_check check(purpose in('grade','import','generate','setup'));
-- Manual and AI-selected items share one durable command. Existing clients remain compatible.
-- Zero-star tasks remain valid; rewards still require at least one star.
create or replace function public.save_setup_batch(p_request_id uuid,p_kind text,p_items jsonb,p_child_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();r public.mutation_receipts;body jsonb;x jsonb;created_id uuid;ids uuid[]:=array[]::uuid[];days int[];start_date date;source uuid;
begin
 if not gina.is_parent() or f is null then raise exception 'forbidden' using errcode='42501';end if;
 if p_request_id is null or p_kind not in('task','reward') or p_kind is null or jsonb_typeof(p_items) is distinct from 'array' then raise exception 'invalid_input';end if;
 if jsonb_array_length(p_items) not between 1 and 3 then raise exception 'invalid_input';end if;
 body:=jsonb_build_object('kind',p_kind,'child',p_child_id,'items',p_items);
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,27));
 select * into r from public.mutation_receipts where request_id=p_request_id;
 if found then
  if r.family_id<>f or r.actor_id<>auth.uid() or r.operation<>'setup_batch' or r.payload<>body then raise exception 'request_conflict';end if;
  return r.result;
 end if;
 perform 1 from public.families where id=f for update;
 if p_kind='task' then
  perform 1 from public.children where id=p_child_id and family_id=f for update;
  if not found then raise exception 'forbidden' using errcode='42501';end if;
 end if;
 -- Lock sources in stable order before creating rows. Cleanup/deletion cannot
 -- remove a selected document between validation and linkage.
 for source in select distinct (value->>'source_id')::uuid from jsonb_array_elements(p_items) where value ? 'source_id' order by 1 loop
  if source is null then raise exception 'source_not_ready';end if;
  perform 1 from public.learning_sources where id=source and family_id=f and kind='document' and status='ready' for update;
  if not found then raise exception 'source_not_ready';end if;
 end loop;
 for x in select value from jsonb_array_elements(p_items) loop
  if length(trim(coalesce(x->>'title',''))) not between 1 and 80 or length(coalesce(x->>'icon','')) not between 1 and 80
   or coalesce(x->>'stars','') !~ '^[0-9]{1,3}$' then raise exception 'invalid_input';end if;
  if (x->>'stars')::int not between (case when p_kind='task' then 0 else 1 end) and (case when p_kind='task' then 10 else 999 end) then raise exception 'invalid_input';end if;
  if p_kind='task' then
   if jsonb_typeof(x->'days') is distinct from 'array' or jsonb_array_length(x->'days') not between 1 and 7 then raise exception 'invalid_input';end if;
   if exists(select 1 from jsonb_array_elements_text(x->'days') d where d !~ '^[1-7]$') then raise exception 'invalid_input';end if;
   select array_agg(d::int order by d::int) into days from jsonb_array_elements_text(x->'days') d;
   if cardinality(days)<>(select count(distinct d) from unnest(days) d) then raise exception 'invalid_input';end if;
   start_date:=(now() at time zone (select timezone from public.families where id=f))::date;
   if x ? 'starts_on' then
    if jsonb_typeof(x->'starts_on') is distinct from 'string' or (x->>'starts_on') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'invalid_input';end if;
    start_date:=(x->>'starts_on')::date;
    if to_char(start_date,'YYYY-MM-DD')<>x->>'starts_on' then raise exception 'invalid_input';end if;
   end if;
   insert into public.task_templates(family_id,child_id,title,icon,stars,days_of_week,starts_on)
   values(f,p_child_id,trim(x->>'title'),x->>'icon',(x->>'stars')::int,days,start_date) returning task_templates.id into created_id;
  else
   insert into public.family_rewards(family_id,title,icon,cost_stars,created_by)
   values(f,trim(x->>'title'),x->>'icon',(x->>'stars')::int,auth.uid()) returning family_rewards.id into created_id;
  end if;
  if x ? 'source_id' then
   insert into public.learning_source_links(source_id,task_id,reward_id,alt)
   values((x->>'source_id')::uuid,case when p_kind='task' then created_id end,case when p_kind='reward' then created_id end,'');
  end if;
  ids:=array_append(ids,created_id);
 end loop;
 insert into public.mutation_receipts(request_id,family_id,actor_id,operation,payload,result) values(p_request_id,f,auth.uid(),'setup_batch',body,to_jsonb(ids));
 return to_jsonb(ids);
end;$$;
revoke all on function public.save_setup_batch(uuid,text,jsonb,uuid) from public,anon;
grant execute on function public.save_setup_batch(uuid,text,jsonb,uuid) to authenticated;

create function public.get_setup_sources(p_kind text,p_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not gina.is_parent() or gina.family_id() is null then raise exception 'forbidden' using errcode='42501';end if;
 if p_kind is null or p_kind not in('task','reward','goal') or coalesce(cardinality(p_ids),0)>100 then raise exception 'invalid_input';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('item_id',x.item_id,'source_id',s.id,'name',s.name,'mime',s.mime) order by s.created_at,s.id)
 from public.learning_source_links l join public.learning_sources s on s.id=l.source_id
 cross join lateral (
  select t.id as item_id from public.task_templates t where p_kind='task' and t.id=l.task_id and t.family_id=gina.family_id() and t.id=any(p_ids)
  union all select r.id from public.family_rewards r where p_kind='reward' and r.id=l.reward_id and r.family_id=gina.family_id() and r.id=any(p_ids)
  union all select g.id from public.child_goals g join public.family_rewards r on r.id=g.reward_id where p_kind='goal' and r.id=l.reward_id and g.family_id=gina.family_id() and g.id=any(p_ids)
 )x where s.family_id=gina.family_id() and s.status='ready'),'[]');
end;$$;
revoke all on function public.get_setup_sources(text,uuid[]) from public,anon;
grant execute on function public.get_setup_sources(text,uuid[]) to authenticated;

-- Fence late paid generation; an uncertain result is never retried automatically.
alter table public.setup_ai_jobs add column lease_token uuid, add column outcome_unknown boolean not null default false;
create function public.reserve_setup_generation(p_id uuid,p_family_id uuid,p_user_id uuid,p_hash text,p_lease uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.setup_ai_jobs;ent jsonb;
begin
 if auth.role()<>'service_role' then raise exception 'forbidden' using errcode='42501';end if;
 if p_id is null or p_family_id is null or p_user_id is null or p_lease is null or p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_input';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_family_id::text,15));
 select * into j from public.setup_ai_jobs where id=p_id for update;
 if found then
  if j.family_id<>p_family_id or j.user_id<>p_user_id or j.prompt_hash<>p_hash then return jsonb_build_object('error','request_conflict');end if;
  if j.status='done' then return jsonb_build_object('cached',j.result);end if;
  if j.outcome_unknown then return jsonb_build_object('error','ai_result_uncertain');end if;
  if j.status='working' then
   if j.updated_at>now()-interval '3 minutes' then return jsonb_build_object('error','generation_in_progress');end if;
   update public.setup_ai_jobs set status='failed',outcome_unknown=true,lease_token=null where id=p_id;
   return jsonb_build_object('error','ai_result_uncertain');
  end if;
 end if;
 ent:=public.get_setup_ai_entitlement(p_family_id);
 if (ent->>'remaining')::int<=0 then return jsonb_build_object('error','ai_quota_exceeded');end if;
 if exists(select 1 from public.setup_ai_jobs where family_id=p_family_id and updated_at>now()-interval '20 seconds') then return jsonb_build_object('error','generation_in_progress');end if;
 insert into public.setup_ai_jobs(id,family_id,user_id,prompt_hash,status,lease_token) values(p_id,p_family_id,p_user_id,p_hash,'working',p_lease)
 on conflict(id) do update set status='working',created_at=now(),updated_at=now(),lease_token=p_lease,outcome_unknown=false;
 return jsonb_build_object('ok',true);
end;$$;
create function public.finish_setup_generation(p_id uuid,p_lease uuid,p_result jsonb,p_unknown boolean default false)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.role()<>'service_role' then raise exception 'forbidden' using errcode='42501';end if;
 if p_unknown is null or (p_unknown and p_result is not null) then raise exception 'invalid_input';end if;
 if p_result is not null and (jsonb_typeof(p_result) is distinct from 'object' or jsonb_typeof(p_result->'suggestions') is distinct from 'array') then raise exception 'invalid_input';end if;
 update public.setup_ai_jobs set status=case when p_result is null then 'failed' else 'done' end,result=p_result,outcome_unknown=p_unknown,updated_at=now(),lease_token=null
 where id=p_id and lease_token=p_lease and status='working' and updated_at>now()-interval '3 minutes';
 return found;
end;$$;
revoke all on function public.reserve_setup_generation(uuid,uuid,uuid,text,uuid),public.finish_setup_generation(uuid,uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.reserve_setup_generation(uuid,uuid,uuid,text,uuid),public.finish_setup_generation(uuid,uuid,jsonb,boolean) to service_role;
