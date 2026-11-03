-- Parent-entered school distributions are not verified official catalogue entries.
alter table public.exam_blueprints add column source_context jsonb not null default '{}';
create function public.save_family_blueprint(p_request_id uuid,p_input jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();actor uuid:=auth.uid();r public.mutation_receipts;child public.children;row jsonb;total int:=0;result uuid;grade int;term int;exam int;y text;
begin
 if not gina.is_parent() or f is null or actor is null then raise exception 'forbidden' using errcode='42501';end if;
 if p_request_id is null or jsonb_typeof(p_input) is distinct from 'object' or octet_length(p_input::text)>50000 then raise exception 'blueprint_invalid';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,27));
 select * into r from public.mutation_receipts where request_id=p_request_id;
 if found then
  if r.family_id<>f or r.actor_id<>actor or r.operation<>'family_blueprint' or r.payload<>p_input then raise exception 'request_conflict';end if;
  return (r.result#>>'{}')::uuid;
 end if;
 if exists(select 1 from jsonb_object_keys(p_input) k where k not in('child_id','grade','subject','name','academic_year','term','exam','rows','source_url','confirmed'))
 or jsonb_typeof(p_input->'grade') is distinct from 'number' or jsonb_typeof(p_input->'term') is distinct from 'number' or jsonb_typeof(p_input->'exam') is distinct from 'number'
 or jsonb_typeof(p_input->'name') is distinct from 'string' or jsonb_typeof(p_input->'subject') is distinct from 'string'
 or p_input->'confirmed' is distinct from 'true'::jsonb or coalesce(p_input->>'grade','') !~ '^([1-9]|1[0-2])$'
 or coalesce(p_input->>'term','') !~ '^[12]$' or coalesce(p_input->>'exam','') !~ '^[12]$'
 or length(trim(coalesce(p_input->>'subject',''))) not between 1 and 80 or length(trim(coalesce(p_input->>'name',''))) not between 1 and 100
 or coalesce(p_input->>'academic_year','') !~ '^20[0-9]{2}-20[0-9]{2}$'
 or jsonb_typeof(p_input->'rows') is distinct from 'array' then raise exception 'blueprint_invalid';end if;
 y:=p_input->>'academic_year';grade:=(p_input->>'grade')::int;term:=(p_input->>'term')::int;exam:=(p_input->>'exam')::int;
 if right(y,4)::int<>left(y,4)::int+1 or jsonb_array_length(p_input->'rows') not between 1 and 30 then raise exception 'blueprint_invalid';end if;
 if jsonb_typeof(p_input->'source_url') is distinct from 'string' or length(p_input->>'source_url')>2000
 or (p_input->>'source_url'<>'' and p_input->>'source_url' !~ '^https://[^[:space:]/]+(/[^[:space:]]*)?$') then raise exception 'blueprint_invalid';end if;
 select * into child from public.children where id=(p_input->>'child_id')::uuid and family_id=f for share;
 if not found then raise exception 'forbidden' using errcode='42501';end if;
 if child.grade between 1 and 12 and child.grade<>grade then raise exception 'blueprint_grade_mismatch';end if;
 for row in select value from jsonb_array_elements(p_input->'rows') loop
  if jsonb_typeof(row) is distinct from 'object' or jsonb_typeof(row->'topic') is distinct from 'string' or jsonb_typeof(row->'count') is distinct from 'number' or length(trim(coalesce(row->>'topic',''))) not between 1 and 200 or coalesce(row->>'count','') !~ '^([1-9]|[12][0-9]|30)$' then raise exception 'blueprint_invalid';end if;
  total:=total+(row->>'count')::int;
 end loop;
 if total>30 or (select count(distinct trim(value->>'topic')) from jsonb_array_elements(p_input->'rows'))<>jsonb_array_length(p_input->'rows') then raise exception 'blueprint_invalid';end if;
 insert into public.exam_blueprints(family_id,grade,subject,name,rows,source_url,created_by,source_context)
 values(f,grade,trim(p_input->>'subject'),trim(p_input->>'name'),(select jsonb_agg(jsonb_build_object('topic',trim(value->>'topic'),'count',(value->>'count')::int)) from jsonb_array_elements(p_input->'rows')),nullif(p_input->>'source_url',''),actor,
 jsonb_build_object('origin','parent_entered','academic_year',y,'term',term,'exam',exam,'school_confirmed',true,'officially_verified',false)) returning id into result;
 insert into public.mutation_receipts(request_id,family_id,actor_id,operation,payload,result)values(p_request_id,f,actor,'family_blueprint',p_input,to_jsonb(result));
 return result;
end;$$;
revoke all on function public.save_family_blueprint(uuid,jsonb) from public,anon;
grant execute on function public.save_family_blueprint(uuid,jsonb) to authenticated;
