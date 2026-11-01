-- Atomically reserve question quota, persist results + usage once, and retry lost responses safely.
create table public.prova_generation_jobs (
 id uuid primary key, family_id uuid not null references public.families(id) on delete cascade,
 requested_by uuid references auth.users(id) on delete set null, prompt_hash text not null,
 items integer not null check(items between 1 and 30), status text not null check(status in('working','done','failed')),
 result jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.prova_generation_jobs enable row level security;
revoke all on public.prova_generation_jobs from anon,authenticated;
grant all on public.prova_generation_jobs to service_role;
create index on public.prova_generation_jobs(family_id,status,updated_at);
create function public.reserve_prova_generation(p_id uuid,p_family_id uuid,p_user_id uuid,p_hash text,p_items integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.prova_generation_jobs; ent jsonb; reserved integer;
begin
 if auth.role()<>'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_family_id::text,13));
 select * into j from public.prova_generation_jobs where id=p_id for update;
 if j.id is not null then
  if j.family_id<>p_family_id or j.requested_by<>p_user_id or j.prompt_hash<>p_hash then return jsonb_build_object('error','request_conflict'); end if;
  if j.status='done' then return jsonb_build_object('cached',j.result); end if;
  if j.status='working' and j.updated_at>now()-interval '10 minutes' then return jsonb_build_object('error','generation_in_progress'); end if;
 end if;
 ent:=public.get_prova_entitlement(p_family_id);
 select coalesce(sum(items),0) into reserved from public.prova_generation_jobs where family_id=p_family_id and status='working' and updated_at>now()-interval '10 minutes';
 if p_items>(ent->>'ai_generate_limit')::int-(ent->>'ai_generate_used')::int-reserved then return jsonb_build_object('error','ai_quota_exceeded'); end if;
 insert into public.prova_generation_jobs(id,family_id,requested_by,prompt_hash,items,status) values(p_id,p_family_id,p_user_id,p_hash,p_items,'working')
 on conflict(id) do update set status='working',updated_at=now();
 return jsonb_build_object('ok',true);
end; $$;
create function public.complete_prova_generation(p_id uuid,p_rows jsonb,p_model text,p_prompt_version text,p_input integer,p_output integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.prova_generation_jobs; v_result jsonb; questions jsonb; ent jsonb;
begin
 if auth.role()<>'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
 select * into j from public.prova_generation_jobs where id=p_id for update;
 if j.id is null then raise exception 'generation_not_found'; end if;
 if j.status='done' then return j.result; end if;
 if j.status<>'working' or jsonb_array_length(p_rows)<1 or jsonb_array_length(p_rows)>j.items then raise exception 'invalid_generation'; end if;
 with inserted as (
 insert into public.question_bank(family_id,grade,subject,topic,scenario_code,kind,difficulty,stem,choices,correct_key,expected_answer,solution,explanation,source_urls,provenance,created_by)
 select j.family_id,r.grade,r.subject,r.topic,r.scenario_code,r.kind,r.difficulty,r.stem,r.choices,r.correct_key,r.expected_answer,r.solution,r.explanation,r.source_urls,r.provenance,j.requested_by
 from jsonb_populate_recordset(null::public.question_bank,p_rows) r
 returning id,topic,kind,difficulty,stem,choices,correct_key,expected_answer,solution,explanation,source_urls
 ) select jsonb_agg(to_jsonb(inserted)) into questions from inserted;
 insert into public.prova_ai_usage(family_id,action,model,items,input_tokens,output_tokens,requested_by)
 values(j.family_id,'generate',p_model,jsonb_array_length(questions),p_input,p_output,j.requested_by);
 ent:=public.get_prova_entitlement(j.family_id);
 v_result:=jsonb_build_object('ok',true,'model',p_model,'prompt_version',p_prompt_version,'remaining',greatest(0,(ent->>'ai_generate_limit')::int-(ent->>'ai_generate_used')::int),'questions',questions);
 update public.prova_generation_jobs set status='done',result=v_result,updated_at=now() where id=j.id;
 return v_result;
end; $$;
revoke all on function public.reserve_prova_generation(uuid,uuid,uuid,text,integer),public.complete_prova_generation(uuid,jsonb,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.reserve_prova_generation(uuid,uuid,uuid,text,integer),public.complete_prova_generation(uuid,jsonb,text,text,integer,integer) to service_role;
