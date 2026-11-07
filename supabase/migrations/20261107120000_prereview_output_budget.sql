-- Adaptive thinking and the final JSON share the output budget. Keep review
-- headroom separate from family plan quotas and question-generation budgets.
insert into public.app_settings(key,value) values
 ('content_prereview.max_output_tokens','24000') on conflict do nothing;
-- The runtime's total ceiling remains 130s; operators may allocate up to 120s
-- to one step. Existing chains and their retry policies are not changed here.
alter table public.ai_chains drop constraint ai_chains_attempt_seconds_check;
alter table public.ai_chains add constraint ai_chains_attempt_seconds_check
 check(attempt_seconds between 10 and 120);
