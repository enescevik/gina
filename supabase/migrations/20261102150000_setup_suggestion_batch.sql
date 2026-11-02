-- Selecting several already-generated ideas does not invoke AI or consume another AI allowance.
create function public.save_setup_batch(p_request_id uuid,p_kind text,p_items jsonb,p_child_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();r public.mutation_receipts;body jsonb;x jsonb;created_id uuid;ids uuid[]:=array[]::uuid[];days int[];
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
 for x in select value from jsonb_array_elements(p_items) loop
  if length(trim(coalesce(x->>'title',''))) not between 1 and 80 or length(coalesce(x->>'icon','')) not between 1 and 80
   or coalesce(x->>'stars','') !~ '^[0-9]{1,3}$' then raise exception 'invalid_input';end if;
  if (x->>'stars')::int not between 1 and (case when p_kind='task' then 10 else 999 end) then raise exception 'invalid_input';end if;
  if p_kind='task' then
   if jsonb_typeof(x->'days') is distinct from 'array' or jsonb_array_length(x->'days') not between 1 and 7 then raise exception 'invalid_input';end if;
   if exists(select 1 from jsonb_array_elements_text(x->'days') d where d !~ '^[1-7]$') then raise exception 'invalid_input';end if;
   select array_agg(d::int order by d::int) into days from jsonb_array_elements_text(x->'days') d;
   if cardinality(days)<>(select count(distinct d) from unnest(days) d) then raise exception 'invalid_input';end if;
   insert into public.task_templates(family_id,child_id,title,icon,stars,days_of_week,starts_on)
   values(f,p_child_id,trim(x->>'title'),x->>'icon',(x->>'stars')::int,days,(now() at time zone (select timezone from public.families where id=f))::date) returning task_templates.id into created_id;
  else
   insert into public.family_rewards(family_id,title,icon,cost_stars,created_by)
   values(f,trim(x->>'title'),x->>'icon',(x->>'stars')::int,auth.uid()) returning family_rewards.id into created_id;
  end if;
  ids:=array_append(ids,created_id);
 end loop;
 insert into public.mutation_receipts(request_id,family_id,actor_id,operation,payload,result) values(p_request_id,f,auth.uid(),'setup_batch',body,to_jsonb(ids));
 return to_jsonb(ids);
end;$$;
revoke all on function public.save_setup_batch(uuid,text,jsonb,uuid) from public,anon;
grant execute on function public.save_setup_batch(uuid,text,jsonb,uuid) to authenticated;
