-- Idempotent manual calendar edits, including retries after a lost response.
alter table public.events add column edit_revision int not null default 1 check(edit_revision>0);
create function gina.bump_event_revision() returns trigger language plpgsql set search_path='' as $$
begin new.edit_revision:=old.edit_revision+1;return new;end;$$;
revoke all on function gina.bump_event_revision() from public,anon,authenticated;
create trigger events_revision before update on public.events for each row execute function gina.bump_event_revision();
alter policy events_parent_all on public.events with check (
 family_id=gina.family_id() and gina.is_parent() and (child_id is null or exists(select 1 from public.children c where c.id=child_id and c.family_id=gina.family_id()))
);
create function public.save_calendar_event(p_request_id uuid,p_event_id uuid,p_revision int,p_values jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id(); previous public.events; candidate public.events; receipt public.mutation_receipts; payload jsonb; result jsonb;
begin
 if not coalesce(gina.is_parent(),false) or f is null then raise exception 'forbidden' using errcode='42501';end if;
 if p_request_id is null or p_event_id is null or p_revision is null or p_revision<0 then raise exception 'invalid_input';end if;
 payload:=jsonb_build_object('event',p_event_id,'revision',p_revision,'values',p_values);
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,27));
 select * into receipt from public.mutation_receipts where request_id=p_request_id;
 if found then
  if receipt.family_id<>f or receipt.actor_id<>auth.uid() or receipt.operation<>'save_calendar_event' or receipt.payload<>payload then raise exception 'request_conflict';end if;
  return receipt.result;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_event_id::text,61));
 select * into previous from public.events where id=p_event_id for update;
 if found then
  if previous.family_id<>f then raise exception 'forbidden' using errcode='42501';end if;
  if previous.timetable_entry_key is not null then raise exception 'event_is_timetable';end if;
  if previous.edit_revision<>p_revision then raise exception 'event_changed';end if;
 elsif p_revision<>0 or p_values is null then raise exception 'event_changed';end if;
 if p_values is null then
  delete from public.events where id=p_event_id;
  result:=jsonb_build_object('id',p_event_id,'deleted',true,'revision',p_revision);
 else
  if jsonb_typeof(p_values)<>'object' or not(p_values ?& array['title','type','child_id','starts_at','ends_at','all_day','location','rrule'])
   or p_values-array['title','type','child_id','starts_at','ends_at','all_day','location','rrule']<>'{}'::jsonb
   or jsonb_typeof(p_values->'title')<>'string' or length(trim(p_values->>'title')) not between 1 and 120
   or jsonb_typeof(p_values->'type')<>'string' or jsonb_typeof(p_values->'starts_at')<>'string'
   or jsonb_typeof(p_values->'all_day')<>'boolean' or jsonb_typeof(p_values->'ends_at') not in('string','null')
   or jsonb_typeof(p_values->'child_id') not in('string','null') or jsonb_typeof(p_values->'location') not in('string','null')
   or jsonb_typeof(p_values->'rrule') not in('string','null') or coalesce(length(p_values->>'location'),0)>180 or coalesce(length(p_values->>'rrule'),0)>250
  then raise exception 'invalid_input';end if;
  select * into candidate from jsonb_populate_record(null::public.events,p_values);
  if not isfinite(candidate.starts_at) or (candidate.ends_at is not null and (not isfinite(candidate.ends_at) or candidate.ends_at<candidate.starts_at)) then raise exception 'invalid_input';end if;
  if candidate.child_id is not null and not exists(select 1 from public.children where id=candidate.child_id and family_id=f) then raise exception 'forbidden' using errcode='42501';end if;
  if candidate.rrule is not null and candidate.rrule is distinct from previous.rrule and candidate.rrule !~ '^FREQ=WEEKLY;BYDAY=(MO|TU|WE|TH|FR|SA|SU)(,(MO|TU|WE|TH|FR|SA|SU))*(;UNTIL=[0-9]{8})?$' then raise exception 'invalid_input';end if;
  if previous.id is null then
   insert into public.events(id,family_id,created_by,title,type,child_id,starts_at,ends_at,all_day,location,rrule)
   values(p_event_id,f,auth.uid(),trim(candidate.title),candidate.type,candidate.child_id,candidate.starts_at,candidate.ends_at,candidate.all_day,candidate.location,candidate.rrule) returning * into candidate;
  else
   update public.events set title=trim(candidate.title),type=candidate.type,child_id=candidate.child_id,starts_at=candidate.starts_at,ends_at=candidate.ends_at,all_day=candidate.all_day,location=candidate.location,rrule=candidate.rrule where id=p_event_id returning * into candidate;
  end if;
  result:=jsonb_build_object('id',p_event_id,'deleted',false,'revision',candidate.edit_revision);
 end if;
 insert into public.mutation_receipts(request_id,family_id,actor_id,operation,payload,result) values(p_request_id,f,auth.uid(),'save_calendar_event',payload,result);
 return result;
end;$$;
revoke all on function public.save_calendar_event(uuid,uuid,int,jsonb) from public,anon;
grant execute on function public.save_calendar_event(uuid,uuid,int,jsonb) to authenticated;
