-- A retry must target the original submission, not a newer resubmission.
create table public.mutation_receipts (
 request_id uuid primary key,
 family_id uuid not null references public.families(id) on delete cascade,
 actor_id uuid not null references auth.users(id) on delete cascade,
 operation text not null, payload jsonb not null, result jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.mutation_receipts enable row level security;
revoke all on public.mutation_receipts from anon, authenticated;
grant all on public.mutation_receipts to service_role;
create function public.review_task_once(p_request_id uuid, p_completion_id uuid, p_approve boolean, p_expected_completed_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.mutation_receipts; c public.task_completions; body jsonb; result jsonb; f uuid:=gina.family_id();
begin
 if not gina.is_parent() or f is null then raise exception 'forbidden' using errcode='42501'; end if;
 if p_request_id is null or p_approve is null or p_expected_completed_at is null then raise exception 'invalid_input'; end if;
 body:=jsonb_build_object('completion',p_completion_id,'approve',p_approve,'completed_at',p_expected_completed_at);
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,27));
 select * into r from public.mutation_receipts where request_id=p_request_id;
 if found then
  if r.actor_id<>auth.uid() or r.family_id<>f or r.operation<>'review_task' or r.payload<>body then raise exception 'request_conflict'; end if;
  return r.result;
 end if;
 select * into c from public.task_completions where id=p_completion_id and family_id=f for update;
 if c.id is null then raise exception 'not_found'; end if;
 if c.completed_at is distinct from p_expected_completed_at then raise exception 'submission_changed'; end if;
 select to_jsonb(t) into result from public.review_task(p_completion_id,p_approve) t;
 insert into public.mutation_receipts(request_id,family_id,actor_id,operation,payload,result)
 values(p_request_id,f,auth.uid(),'review_task',body,result);
 return result;
end; $$;
revoke all on function public.review_task_once(uuid,uuid,boolean,timestamptz) from public,anon;
grant execute on function public.review_task_once(uuid,uuid,boolean,timestamptz) to authenticated;
