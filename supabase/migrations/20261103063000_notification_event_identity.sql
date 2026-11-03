-- Different Provas must not suppress each other. Keep the existing task/weekly batching policy.
-- Only identical pending Prova payloads coalesce; normal trigger transitions decide when to notify.
create or replace function gina.enqueue_push(
 p_family_id uuid,p_audience text,p_kind text,p_payload jsonb,p_target_child_id uuid default null
) returns void language plpgsql security definer set search_path='' as $$
declare body jsonb:=coalesce(p_payload,'{}'::jsonb);
begin
 perform pg_advisory_xact_lock(hashtextextended(jsonb_build_array(p_family_id,p_audience,p_kind,p_target_child_id,case when p_kind in('exam_assigned','exam_finished') then body else '{}'::jsonb end)::text,63));
 if exists(select 1 from public.push_outbox o where o.family_id=p_family_id and o.audience=p_audience and o.kind=p_kind
   and o.target_child_id is not distinct from p_target_child_id and (p_kind not in('exam_assigned','exam_finished') or o.payload=body) and o.status='pending') then return;end if;
 insert into public.push_outbox(family_id,audience,target_child_id,exclude_user_id,kind,payload)
 values(p_family_id,p_audience,p_target_child_id,auth.uid(),p_kind,body);
end;$$;
revoke execute on function gina.enqueue_push(uuid,text,text,jsonb,uuid) from public,anon,authenticated;
