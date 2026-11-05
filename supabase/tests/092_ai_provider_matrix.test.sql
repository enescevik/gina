begin;
select no_plan();
-- S06: yetenek alanları, yalnız-ad model engeli, kill switch, önizleme/etki/kuyruk RPC yetkisi, veli kullanım bilgisi.
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000009201','s06-admin@example.invalid'),
 ('00000000-0000-4000-8000-000000009202','s06-parent@example.invalid'),
 ('00000000-0000-4000-8000-000000009203','s06-other@example.invalid');
insert into public.admins(user_id) values('00000000-0000-4000-8000-000000009201');
insert into public.families(id,name,created_by) values('10000000-0000-4000-8000-000000009202','Synthetic','00000000-0000-4000-8000-000000009202');
insert into public.family_members(family_id,user_id) values('10000000-0000-4000-8000-000000009202','00000000-0000-4000-8000-000000009202');
create function pg_temp.actor(id text, admin boolean default false, role_name text default 'parent') returns void language sql as $$
 select set_config('request.jwt.claims',jsonb_build_object('sub',id,'role','authenticated','gina',
  jsonb_build_object('family_id','10000000-0000-4000-8000-000000009202','role',role_name,'admin',admin))::text,true)::void$$;

-- Yetenek alanları ve tohumlar
select has_column('public','ai_models','adapter','ai_models.adapter exists');
select has_column('public','ai_models','contract_version','ai_models.contract_version exists');
select has_column('public','ai_models','supports_vision','ai_models.supports_vision exists');
select has_column('public','ai_operation_policies','max_media_bytes','media limit lives on the policy row');
select is((select count(*)::int from public.ai_providers),3,'three providers registered');
select is((select status from public.ai_providers where id='anthropic'),'active','anthropic active');
select is((select count(*)::int from public.ai_providers where status='unconfigured'),2,'openai_compatible and gemini wait for X04 keys');
select is((select count(*)::int from public.ai_feature_requirements),17,'feature matrix seeded');
select is((select bool_and((gina.ai_model_support(m)->>'supported')::boolean) from public.ai_models m),true,'anthropic seeds remain supported');

-- Yalnız adı yazılan model etkinleşmez
select throws_ok($$insert into public.ai_models(id,provider,display_name) values('gpt-5-mini','openai_compatible','GPT-5 mini')$$,'23514','ai_model_unsupported','name-only model cannot be active');
insert into public.ai_models(id,provider,display_name,active) values('gpt-5-mini','openai_compatible','GPT-5 mini',false);
select is((gina.ai_model_support(m)->>'supported')::boolean,false,'inactive name-only model is unsupported') from public.ai_models m where id='gpt-5-mini';
select is((select gina.ai_model_support(m)->'reasons' from public.ai_models m where id='gpt-5-mini'),'["adapter_missing","contract_missing","capabilities_missing","provider_unconfigured"]'::jsonb,'reasons listed');
select is((select jsonb_array_length(gina.ai_model_support(m)->'unsupported_features') from public.ai_models m where id='gpt-5-mini'),17,'every feature listed as unsupported');
select throws_ok($$update public.ai_models set active=true, adapter='openai-chat', contract_version='x', context_tokens=128000, supports_json_schema=true where id='gpt-5-mini'$$,'23514','ai_model_unsupported','declared model still blocked while provider is unconfigured');
select throws_ok($$update public.ai_settings set model_id='gpt-5-mini' where plan_code='plus'$$,'23514','ai_model_unsupported','enabled plan cannot point at an unsupported model');
-- Yetenek eksikliği özellik bazında görünür
update public.ai_models set supports_pdf=false where id='claude-haiku-5-5';
select is((select gina.ai_model_support(m)->'unsupported_features' from public.ai_models m where id='claude-haiku-5-5'),
 '[{"feature":"document_analysis","input_kind":"pdf"},{"feature":"pre_review","input_kind":"pdf"},{"feature":"question_generation","input_kind":"pdf"},{"feature":"setup_suggestions","input_kind":"pdf"}]'::jsonb,
 'missing pdf capability lists only pdf rows');
update public.ai_models set supports_pdf=true where id='claude-haiku-5-5';

-- Yetki: anonim/veli yönetici RPC'lerini çağıramaz
set local role authenticated;
select pg_temp.actor('00000000-0000-4000-8000-000000009202');
select throws_ok($$select public.admin_model_disable_preview('claude-sonnet-5-5')$$,'42501','forbidden','parent cannot preview model disable');
select throws_ok($$select public.admin_provider_change_impact('anthropic','gemini')$$,'42501','forbidden','parent cannot read provider impact');
select throws_ok($$select public.admin_ai_failed_operations()$$,'42501','forbidden','parent cannot page the failure queue');
select throws_ok($$select public.admin_ai_policy_matrix()$$,'42501','forbidden','parent cannot read the policy matrix');
select throws_ok($$select public.ai_model_support('claude-haiku-5-5')$$,'42501','forbidden','parent cannot read model support');
select is((select count(*)::int from public.ai_providers),0,'rls hides providers from parents');
-- Veli kendi kullanımını okur
select is(public.get_ai_usage()->>'plan','free','parent reads own plan usage');
select is((public.get_ai_usage()->'generate'->>'remaining')::int,0,'free plan has no generation credit');
select ok((public.get_ai_usage()->>'renews_at')::timestamptz > now(),'renewal date is in the future');
select is(jsonb_array_length(public.get_ai_usage()->'operations'),4,'usage lists every non-generate action (grade, import, plan, weekly)');
select pg_temp.actor('00000000-0000-4000-8000-000000009203', false, 'device');
select throws_ok($$select public.get_ai_usage()$$,'42501','forbidden','device cannot read family ai usage');

-- Yönetici: önizleme, etki, kuyruk, matris
select pg_temp.actor('00000000-0000-4000-8000-000000009201', true);
select is(public.admin_model_disable_preview('claude-sonnet-5-5')->'affected_plans','["pro"]'::jsonb,'sonnet disable affects pro');
select ok(public.admin_model_disable_preview('claude-sonnet-5-5')->'affected_features' @> '[{"feature":"study_plan"}]'::jsonb,'study plan listed as affected');
select is(public.admin_model_disable_preview('claude-sonnet-5-5')->'alternatives','["claude-haiku-5-5"]'::jsonb,'haiku is the supported alternative');
select is(public.admin_model_disable_preview('claude-haiku-5-5')->'affected_plans','["plus"]'::jsonb,'haiku disable affects plus');
select is(public.admin_provider_change_impact('anthropic','openai_compatible')->'block_reasons','["provider_unconfigured","no_supported_model"]'::jsonb,'unconfigured provider is blocked with reasons');
select is((public.admin_provider_change_impact('anthropic','gemini')->>'new_processor')::boolean,true,'provider change is a new processor');
select is(public.admin_provider_change_impact('anthropic','gemini')->'region_change','{"from":"us","to":"global"}'::jsonb,'region change reported');
select is(public.admin_provider_change_impact('anthropic','gemini')->'cost_class'->>'direction','down','cost class direction reported');
select ok(public.admin_provider_change_impact('anthropic','gemini')->'affected_features' @> '[{"feature":"weekly_summary"}]'::jsonb,'weekly summary affected by provider change');
select throws_ok($$select public.admin_provider_change_impact('anthropic','nope')$$,'provider_unknown','unknown provider rejected');
select is((public.admin_ai_failed_operations()->>'total')::int,0,'empty failure queue');
select throws_ok($$select public.admin_ai_failed_operations(array['bogus'])$$,'invalid_input','bogus status rejected');
select is((public.admin_ai_policy_matrix()->>'global_enabled')::boolean,true,'kill switch reads enabled');
select is(jsonb_array_length(public.admin_ai_policy_matrix()->'plans'),3,'matrix lists all plans');
select ok(public.admin_ai_policy_matrix()->'models' @> '[{"id":"gpt-5-mini","support":{"supported":false}}]'::jsonb,'matrix marks the name-only model unsupported');
-- Kill switch önizleme ve kullanım bilgisine yansır
select public.admin_set_ai_enabled(false);
select is((public.admin_ai_policy_matrix()->>'global_enabled')::boolean,false,'kill switch off is visible');
select pg_temp.actor('00000000-0000-4000-8000-000000009202');
select is((public.get_ai_usage()->>'enabled')::boolean,false,'parent usage shows ai disabled');
reset role;

-- Arıza kuyruğu filtre/sayfalama (service_role iş kayıtları)
insert into public.ai_operation_jobs(family_id,requested_by,action,input_hash,lease,status,error_code,created_at) values
 ('10000000-0000-4000-8000-000000009202','00000000-0000-4000-8000-000000009202','weekly',repeat('a',64),gen_random_uuid(),'uncertain','anthropic_503',now()-interval '2 days'),
 ('10000000-0000-4000-8000-000000009202','00000000-0000-4000-8000-000000009202','import',repeat('b',64),gen_random_uuid(),'failed','ai_input_too_large',now()-interval '1 day'),
 ('10000000-0000-4000-8000-000000009202','00000000-0000-4000-8000-000000009202','grade',repeat('c',64),gen_random_uuid(),'done',null,now());
set local role authenticated;
select pg_temp.actor('00000000-0000-4000-8000-000000009201', true);
select is((public.admin_ai_failed_operations()->>'total')::int,2,'queue counts failed and uncertain only');
select is((public.admin_ai_failed_operations(array['uncertain'])->>'total')::int,1,'status filter');
select is((public.admin_ai_failed_operations(array['failed','uncertain'],'import')->>'total')::int,1,'action filter');
select is(jsonb_array_length(public.admin_ai_failed_operations(array['failed','uncertain'],null,null,null,1,0)->'rows'),1,'page size respected');
select is(public.admin_ai_failed_operations(array['failed','uncertain'],null,null,null,1,1)->'rows'->0->>'action','weekly','second page is the older row');
select is((public.admin_ai_failed_operations(array['failed','uncertain'],null,now()-interval '36 hours')->>'total')::int,1,'from filter');
select is((public.admin_ai_failed_operations()->'rows'->0->>'retryable')::boolean,false,'failed row is not retryable');
select is((public.admin_ai_failed_operations(array['uncertain'])->'rows'->0->>'retryable')::boolean,true,'uncertain row is retryable only by operator');
select is(public.admin_model_disable_preview('claude-haiku-5-5')->'jobs_last_30d'->>'weekly','1','preview reports recent job volume');
reset role;
select finish();
rollback;
