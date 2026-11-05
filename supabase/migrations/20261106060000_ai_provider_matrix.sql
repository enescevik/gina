-- S06 — Çok sağlayıcılı AI yetenek matrisi ve işletim politikaları (sunucu).
-- Kural: bir model yalnız adı yazılarak etkin olmaz; adapter + yetenek beyanı + sözleşme sürümü +
-- etkin sağlayıcı kaydı gerekir. Anthropic tohumları geriye uyumlu doldurulur; mevcut yol değişmez.
-- Sağlayıcı anahtarı DB'de yalnız secret ADI olarak tutulur; değer hiçbir zaman yazılmaz.

-- Sağlayıcı kaydı ------------------------------------------------------------------
create table public.ai_providers (
 id text primary key check (id in ('anthropic','openai_compatible','gemini')),
 display_name text not null,
 adapter text not null check (adapter in ('anthropic-messages','openai-chat','gemini-generate')),
 key_secret_name text not null check (key_secret_name ~ '^[A-Z][A-Z0-9_]{2,63}$'), -- yalnız ad
 data_region text not null check (data_region in ('us','eu','tr','global')),
 cross_border boolean not null default true,
 cost_class text not null check (cost_class in ('low','medium','high')),
 status text not null default 'unconfigured' check (status in ('active','unconfigured','unsupported')),
 notes text,
 updated_at timestamptz not null default now()
);
insert into public.ai_providers(id,display_name,adapter,key_secret_name,data_region,cross_border,cost_class,status,notes) values
 ('anthropic','Anthropic','anthropic-messages','ANTHROPIC_API_KEY','us',true,'medium','active','Mevcut üretim yolu.'),
 ('openai_compatible','OpenAI uyumlu (Chat Completions)','openai-chat','OPENAI_API_KEY','us',true,'medium','unconfigured','X04 bekliyor: hesap/anahtar yok; adapter iskeleti ve sahte sunucu sözleşme testi var.'),
 ('gemini','Google Gemini','gemini-generate','GEMINI_API_KEY','global',true,'low','unconfigured','X04 bekliyor: hesap/anahtar yok; adapter iskeleti ve sahte sunucu sözleşme testi var.');
create trigger ai_providers_set_updated_at before update on public.ai_providers for each row execute function gina.set_updated_at();
alter table public.ai_providers enable row level security;
revoke all on public.ai_providers from anon;
grant select, update on public.ai_providers to authenticated;
create policy ai_providers_admin on public.ai_providers for all to authenticated
 using (gina.is_admin_strict()) with check (gina.is_admin_strict());
create trigger audit_ai_providers after insert or update or delete on public.ai_providers
 for each row execute function gina.audit_row('id');

-- Model yetenek beyanı ---------------------------------------------------------------
alter table public.ai_models
 add column adapter text check (adapter in ('anthropic-messages','openai-chat','gemini-generate')),
 add column supports_vision boolean not null default false,
 add column supports_pdf boolean not null default false,
 add column supports_json_schema boolean not null default false,
 add column context_tokens int check (context_tokens between 1000 and 10000000),
 add column tokenizer text not null default 'estimate' check (tokenizer in ('provider_count','estimate')),
 add column contract_version text check (char_length(contract_version) between 1 and 40),
 add column cost_class text not null default 'medium' check (cost_class in ('low','medium','high'));
update public.ai_models set adapter='anthropic-messages', supports_vision=true, supports_pdf=true, supports_json_schema=true,
 context_tokens=200000, tokenizer='provider_count', contract_version='s06-v1',
 cost_class=case id when 'claude-haiku-5-5' then 'low' else 'medium' end
 where provider='anthropic';
alter table public.ai_models add constraint ai_models_provider_fkey foreign key (provider) references public.ai_providers(id);

-- Özellik → girdi türü → gereken yetenek (packages/core/src/ai-capabilities.ts ile aynı) --------
create table public.ai_feature_requirements (
 feature text not null check (feature in ('weekly_summary','daily_tips','photo_calendar','document_analysis','question_generation','open_ended_grading','study_plan','pre_review','setup_suggestions')),
 input_kind text not null check (input_kind in ('text','image','pdf')),
 action text not null,
 requires_vision boolean not null default false,
 requires_pdf boolean not null default false,
 requires_json_schema boolean not null default true,
 min_context_tokens int not null check (min_context_tokens > 0),
 plans public.plan_code[] not null,
 entry_point text,
 primary key (feature, input_kind)
);
insert into public.ai_feature_requirements(feature,input_kind,action,requires_vision,requires_pdf,min_context_tokens,plans,entry_point) values
 ('weekly_summary','text','weekly',false,false,16000,'{plus,pro}','ai-weekly-summary'),
 ('daily_tips','text','weekly',false,false,16000,'{pro}',null),
 ('photo_calendar','image','import',true,false,32000,'{plus,pro}','timetable-import'),
 ('document_analysis','image','learning_import',true,false,32000,'{plus,pro}','learning-plan-import'),
 ('document_analysis','pdf','learning_import',false,true,64000,'{plus,pro}','learning-plan-import'),
 ('question_generation','text','generate',false,false,32000,'{plus,pro}','prova-generate'),
 ('question_generation','image','generate',true,false,32000,'{plus,pro}','prova-generate'),
 ('question_generation','pdf','generate',false,true,64000,'{plus,pro}','prova-generate'),
 ('open_ended_grading','text','grade',false,false,32000,'{pro}','prova-grade'),
 ('open_ended_grading','image','grade',true,false,32000,'{pro}','prova-review'),
 ('study_plan','text','plan',false,false,32000,'{pro}','prova-plan'),
 ('pre_review','text','preflight',false,false,8000,'{}','ai-preflight'),
 ('pre_review','image','preflight',true,false,8000,'{}','ai-preflight'),
 ('pre_review','pdf','preflight',false,true,8000,'{}','ai-preflight'),
 ('setup_suggestions','text','setup',false,false,16000,'{plus,pro}','setup-suggestions'),
 ('setup_suggestions','image','setup',true,false,32000,'{plus,pro}','setup-suggestions'),
 ('setup_suggestions','pdf','setup',false,true,64000,'{plus,pro}','setup-suggestions');
alter table public.ai_feature_requirements enable row level security;
revoke all on public.ai_feature_requirements from anon;
grant select on public.ai_feature_requirements to authenticated;
create policy ai_feature_requirements_admin on public.ai_feature_requirements for select to authenticated using (gina.is_admin_strict());

-- Paket bazlı medya sınırı aynı politika satırında (işlem/dakika/eşzamanlı ile tek yerde) --------
alter table public.ai_operation_policies
 add column max_media_items int not null default 0 check (max_media_items between 0 and 20),
 add column max_media_bytes int not null default 0 check (max_media_bytes between 0 and 52428800);
update public.ai_operation_policies set max_media_items=case when enabled and monthly_limit>0 then 5 else 0 end,
 max_media_bytes=case when enabled and monthly_limit>0 then 10485760 else 0 end where action in ('import','generate');

-- Model desteği: satır üzerinden hesaplanır (tetikleyici ve RPC aynı kuralı kullanır) ----------
create function gina.ai_model_support(m public.ai_models) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare reasons text[] := '{}'; p public.ai_providers; features jsonb;
begin
 if m.adapter is null then reasons := array_append(reasons, 'adapter_missing'); end if;
 if m.contract_version is null then reasons := array_append(reasons, 'contract_missing'); end if;
 if m.context_tokens is null then reasons := array_append(reasons, 'capabilities_missing'); end if;
 select * into p from public.ai_providers where id=m.provider;
 if p.id is null then reasons := array_append(reasons, 'provider_unknown');
 elsif p.status='unconfigured' then reasons := array_append(reasons, 'provider_unconfigured');
 elsif p.status='unsupported' then reasons := array_append(reasons, 'provider_unsupported');
 elsif p.adapter is distinct from m.adapter and m.adapter is not null then reasons := array_append(reasons, 'adapter_mismatch'); end if;
 select coalesce(jsonb_agg(jsonb_build_object('feature',r.feature,'input_kind',r.input_kind,'missing',
  (select coalesce(jsonb_agg(x),'[]') from unnest(array[
    case when r.requires_vision and not m.supports_vision then 'vision' end,
    case when r.requires_pdf and not m.supports_pdf then 'pdf' end,
    case when r.requires_json_schema and not m.supports_json_schema then 'json_schema' end,
    case when coalesce(m.context_tokens,0) < r.min_context_tokens then 'context_tokens' end]) x where x is not null))
  order by r.feature,r.input_kind),'[]')
 into features from public.ai_feature_requirements r;
 return jsonb_build_object('model_id',m.id,'supported',cardinality(reasons)=0,'reasons',to_jsonb(reasons),
  'features',features,
  'unsupported_features',(select coalesce(jsonb_agg(f - 'missing'),'[]') from jsonb_array_elements(features) f
    where cardinality(reasons)>0 or jsonb_array_length(f->'missing')>0));
end; $$;
revoke execute on function gina.ai_model_support(public.ai_models) from public, anon;
grant execute on function gina.ai_model_support(public.ai_models) to authenticated, service_role;

create function public.ai_model_support(p_model_id text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare m public.ai_models;
begin
 if not (gina.is_admin_strict() or auth.role()='service_role') then raise exception 'forbidden' using errcode='42501'; end if;
 select * into m from public.ai_models where id=p_model_id;
 if m.id is null then raise exception 'model_not_found'; end if;
 return gina.ai_model_support(m);
end; $$;
revoke all on function public.ai_model_support(text) from public, anon;
grant execute on function public.ai_model_support(text) to authenticated, service_role;

-- Yalnız adı yazılan model etkinleşmez; etkin paket ayarı desteksiz modele bağlanamaz ------------
create function gina.ai_model_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.active and not (gina.ai_model_support(new)->>'supported')::boolean then
  raise exception 'ai_model_unsupported' using detail = (gina.ai_model_support(new)->'reasons')::text, errcode='23514';
 end if;
 return new;
end; $$;
create trigger ai_models_guard before insert or update on public.ai_models for each row execute function gina.ai_model_guard();

create function gina.ai_settings_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare m public.ai_models;
begin
 if new.enabled and new.model_id is not null then
  select * into m from public.ai_models where id=new.model_id;
  if m.id is null or not m.active or not (gina.ai_model_support(m)->>'supported')::boolean then
   raise exception 'ai_model_unsupported' using errcode='23514';
  end if;
 end if;
 return new;
end; $$;
create trigger ai_settings_guard before insert or update on public.ai_settings for each row execute function gina.ai_settings_guard();

-- Model kapatma önizlemesi: etkilenen paketler/özellikler/alternatifler --------------------------
create function public.admin_model_disable_preview(p_model_id text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare m public.ai_models; affected public.plan_code[];
begin
 perform gina.assert_admin();
 select * into m from public.ai_models where id=p_model_id;
 if m.id is null then raise exception 'model_not_found'; end if;
 select coalesce(array_agg(plan_code order by plan_code),'{}') into affected from public.ai_settings where enabled and model_id=p_model_id;
 return jsonb_build_object(
  'model_id',p_model_id,'provider',m.provider,'active',m.active,
  'affected_plans',to_jsonb(affected),
  'affected_features',(select coalesce(jsonb_agg(jsonb_build_object('feature',f,'inputs',inputs,'plans',ps) order by f),'[]') from (
    select e.feature f, jsonb_agg(distinct e.input_kind) inputs, to_jsonb(array_agg(distinct e.plan order by e.plan)) ps
    from (select r.feature, r.input_kind, p.plan from public.ai_feature_requirements r, unnest(r.plans) p(plan) where p.plan = any(affected)) e group by e.feature) q),
  'alternatives',(select coalesce(jsonb_agg(a.id order by a.id),'[]') from public.ai_models a
    where a.id<>p_model_id and a.active and a.provider=m.provider and (gina.ai_model_support(a)->>'supported')::boolean),
  'jobs_last_30d',(select coalesce(jsonb_object_agg(action,n),'{}') from (
    select action,count(*) n from public.ai_operation_jobs where created_at>now()-interval '30 days' group by action) j));
end; $$;
revoke all on function public.admin_model_disable_preview(text) from public, anon;
grant execute on function public.admin_model_disable_preview(text) to authenticated;

-- Sağlayıcı değişiminin gizlilik/izin/maliyet etkisi ---------------------------------------
create function public.admin_provider_change_impact(p_from text, p_to text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare src public.ai_providers; dst public.ai_providers; blocks text[] := '{}'; from_plans public.plan_code[]; candidates text[];
begin
 perform gina.assert_admin();
 select * into src from public.ai_providers where id=p_from;
 select * into dst from public.ai_providers where id=p_to;
 if src.id is null or dst.id is null then raise exception 'provider_unknown'; end if;
 if p_from=p_to then blocks := array_append(blocks, 'same_provider'); end if;
 if dst.status='unconfigured' then blocks := array_append(blocks, 'provider_unconfigured'); end if;
 if dst.status='unsupported' then blocks := array_append(blocks, 'provider_unsupported'); end if;
 select coalesce(array_agg(a.id order by a.id),'{}') into candidates from public.ai_models a
  where a.provider=p_to and a.active and (gina.ai_model_support(a)->>'supported')::boolean;
 if cardinality(candidates)=0 then blocks := array_append(blocks, 'no_supported_model'); end if;
 select coalesce(array_agg(s.plan_code order by s.plan_code),'{}') into from_plans from public.ai_settings s
  join public.ai_models m on m.id=s.model_id where s.enabled and m.provider=p_from;
 return jsonb_build_object(
  'from',p_from,'to',p_to,'blocked',cardinality(blocks)>0,'block_reasons',to_jsonb(blocks),
  'affected_features',(select coalesce(jsonb_agg(jsonb_build_object('feature',f,'inputs',inputs,'plans',ps) order by f),'[]') from (
    select e.feature f, jsonb_agg(distinct e.input_kind) inputs, to_jsonb(array_agg(distinct e.plan order by e.plan)) ps
    from (select r.feature, r.input_kind, p.plan from public.ai_feature_requirements r, unnest(r.plans) p(plan) where p.plan = any(from_plans)) e group by e.feature) q),
  'feature_gaps',(select coalesce(jsonb_agg(jsonb_build_object('feature',r.feature,'input_kind',r.input_kind) order by r.feature,r.input_kind),'[]')
    from public.ai_feature_requirements r where r.plans && from_plans and not exists (
      select 1 from public.ai_models a where a.id = any(candidates)
       and (not r.requires_vision or a.supports_vision) and (not r.requires_pdf or a.supports_pdf)
       and (not r.requires_json_schema or a.supports_json_schema) and coalesce(a.context_tokens,0)>=r.min_context_tokens)),
  'new_processor',p_from<>p_to,
  'consent_update_required',p_from<>p_to,
  'cross_border_transfer',dst.cross_border,
  'region_change',case when src.data_region=dst.data_region then null else jsonb_build_object('from',src.data_region,'to',dst.data_region) end,
  'cost_class',jsonb_build_object('from',src.cost_class,'to',dst.cost_class,'direction',
    case when array_position(array['low','medium','high'],dst.cost_class) > array_position(array['low','medium','high'],src.cost_class) then 'up'
         when array_position(array['low','medium','high'],dst.cost_class) < array_position(array['low','medium','high'],src.cost_class) then 'down' else 'same' end),
  'key_secret_name',dst.key_secret_name,
  'candidate_models',to_jsonb(candidates));
end; $$;
revoke all on function public.admin_provider_change_impact(text,text) from public, anon;
grant execute on function public.admin_provider_change_impact(text,text) to authenticated;

-- Politika matrisi: paket × eylem sınırları tek okunur yerde (işlem/dakika/eşzamanlı/token/medya/model) --
create function public.admin_ai_policy_matrix() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform gina.assert_admin();
 return jsonb_build_object(
  'global_enabled', coalesce((select value from public.app_settings where key='ai.enabled') <> 'false'::jsonb, true),
  'providers',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]') from public.ai_providers p),
  'models',(select coalesce(jsonb_agg((to_jsonb(m) || jsonb_build_object('support',gina.ai_model_support(m))) order by m.id),'[]') from public.ai_models m),
  'features',(select coalesce(jsonb_agg(to_jsonb(r) order by r.feature,r.input_kind),'[]') from public.ai_feature_requirements r),
  'plans',(select coalesce(jsonb_agg(jsonb_build_object(
     'plan_code',s.plan_code,'enabled',s.enabled,'model_id',s.model_id,'max_input_tokens',s.max_input_tokens,'max_output_tokens',s.max_output_tokens,'prompt_version',s.prompt_version,
     'prova_ai_generate_monthly',pl.prova_ai_generate_monthly,'setup_ai_monthly',pl.setup_ai_monthly,
     'policies',(select coalesce(jsonb_agg(to_jsonb(o) - 'plan_code' order by o.action),'[]') from public.ai_operation_policies o where o.plan_code=s.plan_code)
    ) order by s.plan_code),'[]') from public.ai_settings s join public.plans pl on pl.code=s.plan_code));
end; $$;
revoke all on function public.admin_ai_policy_matrix() from public, anon;
grant execute on function public.admin_ai_policy_matrix() to authenticated;

-- Arıza kuyruğu: filtre + sayfalama (yönetici) ------------------------------------------------
create function public.admin_ai_failed_operations(p_statuses text[] default array['failed','uncertain'], p_action text default null,
 p_from timestamptz default null, p_to timestamptz default null, p_limit int default 50, p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare lim int := least(greatest(coalesce(p_limit,50),1),200); off int := greatest(coalesce(p_offset,0),0);
begin
 perform gina.assert_admin();
 if p_statuses is null or cardinality(p_statuses)=0 or exists (select 1 from unnest(p_statuses) s where s not in ('working','done','failed','uncertain')) then
  raise exception 'invalid_input';
 end if;
 return (with all_jobs as (
   select id,family_id,action,status,error_code,created_at,updated_at,
     (status='uncertain' or (status='working' and updated_at<now()-interval '3 minutes')) retryable
   from public.ai_operation_jobs
   union all
   select id,family_id,'generate',status,error_code,created_at,updated_at,
     (provider_result is null and (status='uncertain' or (status='working' and updated_at<now()-interval '3 minutes')))
   from public.prova_generation_jobs
  ), filtered as (
   select * from all_jobs j where j.status = any(p_statuses) and (p_action is null or j.action=p_action)
    and (p_from is null or j.created_at>=p_from) and (p_to is null or j.created_at<p_to)
  )
  select jsonb_build_object('total',(select count(*) from filtered),'limit',lim,'offset',off,
   'rows',coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at desc) from (select * from filtered order by created_at desc limit lim offset off) f),'[]')));
end; $$;
revoke all on function public.admin_ai_failed_operations(text[],text,timestamptz,timestamptz,int,int) from public, anon;
grant execute on function public.admin_ai_failed_operations(text[],text,timestamptz,timestamptz,int,int) to authenticated;

-- Veli: kullanım ve yenilenme bilgisi (yalnız kendi ailesi; kişisel veri yok) ------------------------
create function public.get_ai_usage() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare fam uuid := gina.family_id(); plan public.plans; month_start timestamptz; renews timestamptz; ent jsonb; setup jsonb;
begin
 if fam is null or not gina.is_parent() then raise exception 'forbidden' using errcode='42501'; end if;
 plan := gina.family_plan_of(fam);
 month_start := gina.family_month_start(fam);
 renews := month_start + interval '1 month';
 ent := public.get_prova_entitlement(fam);
 setup := public.get_setup_ai_entitlement(fam);
 return jsonb_build_object(
  'plan',plan.code,'period_start',month_start,'renews_at',renews,
  'enabled', coalesce((select value from public.app_settings where key='ai.enabled') <> 'false'::jsonb, true)
    and coalesce((select enabled from public.ai_settings where plan_code=plan.code),false),
  'operations',(select coalesce(jsonb_agg(jsonb_build_object('action',o.action,'enabled',o.enabled,'limit',o.monthly_limit,
     'used',(select count(*) from public.ai_operation_jobs j where j.family_id=fam and j.action=o.action and j.created_at>=month_start and j.status<>'failed'),
     'remaining',greatest(0,o.monthly_limit-(select count(*) from public.ai_operation_jobs j where j.family_id=fam and j.action=o.action and j.created_at>=month_start and j.status<>'failed')),
     'max_media_items',o.max_media_items,'max_media_bytes',o.max_media_bytes) order by o.action),'[]')
    from public.ai_operation_policies o where o.plan_code=plan.code and o.action<>'generate'),
  'generate',jsonb_build_object('limit',coalesce((ent->>'ai_generate_limit')::int,0),'used',coalesce((ent->>'ai_generate_used')::int,0),
     'remaining',greatest(0,coalesce((ent->>'ai_generate_remaining')::int,coalesce((ent->>'ai_generate_limit')::int,0)-coalesce((ent->>'ai_generate_used')::int,0)))),
  'setup',jsonb_build_object('limit',coalesce((setup->>'limit')::int,0),'remaining',coalesce((setup->>'remaining')::int,0)));
end; $$;
revoke all on function public.get_ai_usage() from public, anon;
grant execute on function public.get_ai_usage() to authenticated;
