-- Durable manual saves; legacy API remains for already-installed clients/imports.
create function public.save_school_timetable_request(
 p_request_id uuid,p_child_id uuid,p_revision integer,p_lessons jsonb,p_settings jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();payload jsonb;result jsonb;entry jsonb;revision integer;
begin
 if auth.uid() is null or f is null or
  (gina.is_parent() or (gina.is_device() and p_child_id=gina.child_id())) is not true
  or not exists(select 1 from public.children where id=p_child_id and family_id=f)
 then raise exception 'timetable_forbidden' using errcode='42501';end if;
 if p_revision is null or p_revision<0 or p_lessons is null or jsonb_typeof(p_lessons)<>'array'
 or p_settings is null or jsonb_typeof(p_settings)<>'object' then raise exception 'timetable_invalid';end if;
 if jsonb_array_length(p_lessons)>112 or octet_length(p_lessons::text)>100000
 or not(p_settings ?& array['start','duration','break']) or p_settings-array['start','duration','break']<>'{}'::jsonb
 or jsonb_typeof(p_settings->'start')<>'string' or jsonb_typeof(p_settings->'duration')<>'number'
 or jsonb_typeof(p_settings->'break')<>'number' then raise exception 'timetable_invalid';end if;
 for entry in select * from jsonb_array_elements(p_lessons) loop
  if jsonb_typeof(entry)<>'object' or not(entry ?& array['id','day','title','start','end'])
  or entry-array['id','day','title','start','end']<>'{}'::jsonb or jsonb_typeof(entry->'id')<>'string'
  or jsonb_typeof(entry->'day')<>'number' or jsonb_typeof(entry->'title')<>'string'
  or jsonb_typeof(entry->'start')<>'string' or jsonb_typeof(entry->'end')<>'string'
  then raise exception 'timetable_invalid';end if;
 end loop;
 payload:=jsonb_build_object('action','timetable.save','child',p_child_id,'revision',p_revision,'lessons',p_lessons,'settings',p_settings);
 result:=gina.help_receipt(p_request_id,payload);
 if result is not null then return result;end if;
 -- Existing child-row lock serializes manual edits, imports and child deletion.
 revision:=public.save_school_timetable(p_child_id,p_revision,p_lessons,p_settings);
 result:=jsonb_build_object('request',p_request_id,'child_id',p_child_id,'revision',revision);
 perform gina.save_help_receipt(p_request_id,payload,result,f);
 return result;
end;$$;
revoke all on function public.save_school_timetable_request(uuid,uuid,integer,jsonb,jsonb) from public,anon,service_role;
grant execute on function public.save_school_timetable_request(uuid,uuid,integer,jsonb,jsonb) to authenticated;
