-- C08 (S06/U09/Q02) — AI yönlendirme, kota ve ortak hata sözleşmesi + C04 kalan sınır 3 (AI puanı ≠ veli puanı).
--
-- 1. Sağlayıcıya göre yönlendirme: rezervasyon/devre kesici/hata sınıfı artık 'anthropic' sabitine bağlı değil.
--    İş satırı çözülmüş sağlayıcıyı taşır (provider); null = bu migration'dan önceki Anthropic işi (geriye uyumlu).
--    Devre kesici sağlayıcı başına: bir sağlayıcının 429/5xx/belirsiz sonucu diğerini durdurmaz.
--    reserve_weekly_summary / reserve_learning_plan_import bağlamdaki modelin desteklenip desteklenmediğini
--    (gina.ai_model_support) ve sağlayıcısını kullanır.
-- 2. Özellik → yetenek → paket → girdi sınırı tek okuma: get_ai_usage() özellik listesini (sunuluyor mu,
--    paket uygun mu, model destekliyor mu), medya sınırını (shared_source_limits) ve duraklatmayı döndürür.
--    `daily_tips` ayrı uç/kota olmadan çalışıyor görünmesin: ai_feature_requirements.offered=false.
-- 3. gina.check_input_range() yetkili mutasyonlara bağlanır (ödül bedeli, görev yıldızı, Prova/grup sınavı süresi).
-- 4. AI puanı öneridir: apply_ai_grades yalnız ai_score/ai_feedback/ai_details/ai_graded_at yazar; kesin `score`
--    yalnız veli yolu (score_open_answer / save_answer_review / accept_ai_grade) ile oluşur. Eski graded_by='ai'
--    satırları yeniden yazılmaz: score'ları eskisi gibi okunur ve özet `legacy_ai` olarak işaretler.
-- Tekrar uygulanabilir değildir (tek seferlik); yalnız yeni fonksiyon/sütun ekler, mevcut veriyi değiştirmez.

-- 1. Sağlayıcı yönlendirmesi -------------------------------------------------------------------------
alter table public.ai_operation_jobs add column provider text references public.ai_providers(id);
alter table public.prova_generation_jobs add column provider text references public.ai_providers(id);
comment on column public.ai_operation_jobs.provider is 'C08: rezervasyonda çözülen sağlayıcı; null = C08 öncesi Anthropic işi.';
comment on column public.prova_generation_jobs.provider is 'C08: rezervasyonda çözülen sağlayıcı; null = C08 öncesi Anthropic işi.';
insert into public.ai_provider_health(provider) select id from public.ai_providers on conflict (provider) do nothing;
alter table public.ai_provider_health add constraint ai_provider_health_provider_fkey foreign key (provider) references public.ai_providers(id);

-- Ailenin paketinde etkin modelin sağlayıcısı (resolveAi ile aynı sıra: ai_settings → plans.ai_model).
create function gina.ai_family_provider(p_family uuid) returns text
language plpgsql stable security definer set search_path='' as $$
declare plan public.plans; model text;
begin
 plan := gina.family_plan_of(p_family);
 model := coalesce((select model_id from public.ai_settings where plan_code=plan.code), plan.ai_model);
 return coalesce((select provider from public.ai_models where id=model), 'anthropic');
end;$$;

-- Sağlayıcı hata kodu öneki → sağlayıcı kimliği (Edge classifyAiError ile aynı önekler).
create function gina.ai_error_provider(p_code text) returns text
language sql immutable set search_path='' as $$
 select case when p_code ~ '^anthropic_' then 'anthropic' when p_code ~ '^openai_' then 'openai_compatible'
  when p_code ~ '^gemini_' then 'gemini' end;
$$;

-- Devre kesiciyi besleyen kodlar: sağlayıcının 429 ve 5xx yanıtları (Anthropic 529 dahil).
create function gina.ai_breaker_code(p_code text) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(p_code ~ '^(anthropic|openai|gemini)_(429|5[0-9][0-9])$', false);
$$;

create function gina.ai_provider_paused(p_provider text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.ai_provider_health where provider=coalesce(p_provider,'anthropic') and open_until>now());
$$;

-- Tek yerden sağlık kaydı: başarı sıfırlar; belirsiz sonuç veya 429/5xx sayacı artırır, 3'te 2 dk duraklatır.
create function gina.ai_provider_outcome(p_provider text, p_ok boolean, p_error text, p_uncertain boolean) returns void
language plpgsql security definer set search_path='' as $$
declare prov text := coalesce(p_provider, gina.ai_error_provider(p_error), 'anthropic');
begin
 insert into public.ai_provider_health(provider) values(prov) on conflict (provider) do nothing;
 if p_ok then
  update public.ai_provider_health set failures=0,open_until=null,updated_at=now() where provider=prov;
 elsif p_uncertain or gina.ai_breaker_code(p_error) then
  update public.ai_provider_health set failures=failures+1,
   open_until=case when failures+1>=3 then now()+interval '2 minutes' else open_until end,updated_at=now() where provider=prov;
 end if;
end;$$;
revoke all on function gina.ai_family_provider(uuid), gina.ai_provider_paused(text), gina.ai_provider_outcome(text,boolean,text,boolean) from public, anon, authenticated;
grant execute on function gina.ai_family_provider(uuid), gina.ai_provider_paused(text), gina.ai_provider_outcome(text,boolean,text,boolean) to service_role;
revoke all on function gina.ai_error_provider(text), gina.ai_breaker_code(text) from public, anon;
grant execute on function gina.ai_error_provider(text), gina.ai_breaker_code(text) to authenticated, service_role;

-- reserve_ai_operation: isteğe bağlı p_provider (Edge resolveAi çıktısı); verilmezse ailenin etkin modeli.
drop function public.reserve_ai_operation(uuid,uuid,text,text,uuid);
create function public.reserve_ai_operation(p_family_id uuid,p_user_id uuid,p_action text,p_hash text,p_lease uuid,p_provider text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.ai_operation_jobs; pol public.ai_operation_policies; plan public.plans; used int; prov text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
 if p_action not in('grade','plan','import','weekly') or p_hash is null or length(p_hash)<>64 or p_lease is null then raise exception 'invalid_input'; end if;
 if p_provider is not null and not exists(select 1 from public.ai_providers where id=p_provider) then raise exception 'invalid_input'; end if;
 if not exists(select 1 from public.family_members where user_id=p_user_id and family_id=p_family_id) then raise exception 'forbidden' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_family_id::text,28));
 plan:=gina.family_plan_of(p_family_id);
 prov:=coalesce(p_provider, gina.ai_family_provider(p_family_id));
 if p_action='weekly' and (not plan.ai_weekly or exists(select 1 from public.app_settings where key='ai.enabled' and value='false'::jsonb) or exists(select 1 from public.ai_settings where plan_code=plan.code and not enabled)) then return jsonb_build_object('error','ai_disabled'); end if;
 select * into pol from public.ai_operation_policies where action=p_action and plan_code=plan.code;
 if pol.action is null or not pol.enabled then return jsonb_build_object('error','ai_disabled'); end if;
 select * into j from public.ai_operation_jobs where family_id=p_family_id and action=p_action and input_hash=p_hash for update;
 if found then
  if j.status='done' then return jsonb_build_object('cached',j.result,'id',j.id); end if;
  -- Ücret oluşmuş olabilecek eski çağrı sessizce tekrar çalışmaz (ikinci ücretli fallback yok).
  if j.status in('working','uncertain') then return jsonb_build_object('error',case when j.status='working' and j.updated_at>now()-interval '3 minutes' then 'generation_in_progress' else 'ai_result_uncertain' end); end if;
 end if;
 -- Anahtarı/kaydı etkin olmayan sağlayıcıya iş açılmaz (X04: OpenAI/Gemini 'unconfigured').
 if not exists(select 1 from public.ai_providers where id=prov and status='active') then return jsonb_build_object('error','provider_unconfigured'); end if;
 if gina.ai_provider_paused(prov) then return jsonb_build_object('error','ai_temporarily_unavailable'); end if;
 select count(*) into used from public.ai_operation_jobs where family_id=p_family_id and action=p_action and created_at>=gina.family_month_start(p_family_id) and status<>'failed';
 if used>=pol.monthly_limit then return jsonb_build_object('error','ai_quota_exceeded'); end if;
 if (select count(*) from public.ai_request_attempts where family_id=p_family_id and created_at>now()-interval '1 minute')>=pol.per_minute then return jsonb_build_object('error','ai_rate_limited'); end if;
 if (select count(*) from public.ai_operation_jobs where family_id=p_family_id and status='working' and updated_at>now()-interval '3 minutes')>=pol.max_concurrent then return jsonb_build_object('error','generation_in_progress'); end if;
 insert into public.ai_request_attempts(family_id,action) values(p_family_id,p_action);
 insert into public.ai_operation_jobs(family_id,requested_by,action,input_hash,lease,status,provider)
 values(p_family_id,p_user_id,p_action,p_hash,p_lease,'working',prov)
 on conflict(family_id,action,input_hash) do update set status='working',lease=p_lease,provider=prov,created_at=now(),updated_at=now(),error_code=null
 returning * into j;
 return jsonb_build_object('id',j.id,'lease',p_lease,'provider',prov);
end; $$;
revoke all on function public.reserve_ai_operation(uuid,uuid,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_ai_operation(uuid,uuid,text,text,uuid,text) to service_role;

-- reserve_child_ai_operation imzası değişmez (6 argüman, mevcut yetki testleri); 5 argümanla çağırdığı
-- reserve_ai_operation sağlayıcıyı ailenin etkin modelinden çözer (Edge resolveAi ile aynı an, aynı kaynak).

-- Bağlamdaki model hâlâ etkin VE desteklenen (adapter + yetenek + sözleşme + etkin sağlayıcı) olmalı.
create function gina.ai_context_provider(p_model text, p_provider text) returns text
language plpgsql stable security definer set search_path='' as $$
declare m public.ai_models;
begin
 select * into m from public.ai_models where id=p_model and active;
 if m.id is null or (gina.ai_model_support(m)->>'supported')::boolean is not true then return null; end if;
 if p_provider is not null and p_provider<>m.provider then return null; end if;
 return m.provider;
end;$$;
revoke all on function gina.ai_context_provider(text,text) from public,anon,authenticated;
grant execute on function gina.ai_context_provider(text,text) to service_role;

drop function public.reserve_weekly_summary(uuid,uuid,uuid,uuid);
create function public.reserve_weekly_summary(p_family uuid,p_user uuid,p_context uuid,p_lease uuid,p_provider text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c gina.weekly_summary_contexts; prov text;begin
 if auth.role() is distinct from 'service_role' then raise exception 'weekly_forbidden' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_family::text,28));
 select * into c from gina.weekly_summary_contexts where id=p_context and family_id=p_family;
 if c.id is null then raise exception 'weekly_context_unavailable';end if;
 prov:=gina.ai_context_provider(c.context#>>'{config,model}',p_provider);
 if prov is null then return jsonb_build_object('error','ai_model_unavailable');end if;
 return public.reserve_ai_operation(p_family,p_user,'weekly',encode(extensions.digest(c.id::text||c.context::text,'sha256'),'hex'),p_lease,prov);
end;$$;
revoke all on function public.reserve_weekly_summary(uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_weekly_summary(uuid,uuid,uuid,uuid,text) to service_role;

drop function public.reserve_learning_plan_import(uuid,uuid,uuid,uuid);
create function public.reserve_learning_plan_import(p_family uuid,p_user uuid,p_context uuid,p_lease uuid,p_provider text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i gina.learning_plan_imports;r jsonb;plan public.plans;prov text;begin
 if auth.role() is distinct from 'service_role' then raise exception 'plan_import_forbidden' using errcode='42501';end if;
 select * into i from gina.learning_plan_imports where id=p_context and family_id=p_family;
 if i.id is null then raise exception 'plan_import_unavailable';end if;
 perform gina.learning_import_parent(p_family,p_user,i.child_id,i.source_id);
 if not exists(select 1 from public.learning_sources where id=i.source_id and sha256=i.context->>'sha256') then raise exception 'source_not_ready';end if;
 if not exists(select 1 from public.app_settings where key='sources.enabled' and value='true') then return jsonb_build_object('error','source_unavailable');end if;
 plan:=gina.family_plan_of(p_family);
 if exists(select 1 from public.app_settings where key='ai.enabled' and value='false') or exists(select 1 from public.ai_settings where plan_code=plan.code and not enabled) then return jsonb_build_object('error','ai_disabled');end if;
 prov:=gina.ai_context_provider(i.context#>>'{config,model}',p_provider);
 if prov is null then return jsonb_build_object('error','ai_model_unavailable');end if;
 r:=public.reserve_ai_operation(p_family,p_user,'import',encode(extensions.digest('learning-plan/v1/'||i.id::text||i.context::text,'sha256'),'hex'),p_lease,prov);
 if r ? 'id' then update gina.learning_plan_imports set job_id=(r->>'id')::uuid where id=i.id;end if;
 return r;
end;$$;
revoke all on function public.reserve_learning_plan_import(uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_learning_plan_import(uuid,uuid,uuid,uuid,text) to service_role;

create or replace function public.finish_ai_operation(p_id uuid,p_lease uuid,p_result jsonb,p_error text default null,p_uncertain boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare prov text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
 update public.ai_operation_jobs set status=case when p_uncertain then 'uncertain' when p_error is not null then 'failed' else 'done' end,
 result=p_result,error_code=left(p_error,80),updated_at=now()
 where id=p_id and lease=p_lease and status='working' returning provider into prov;
 if not found then raise exception 'lease_lost'; end if;
 perform gina.ai_provider_outcome(prov, p_error is null, p_error, p_uncertain);
end; $$;

create or replace function public.reserve_prova_generation_v2(p_id uuid,p_family_id uuid,p_user_id uuid,p_hash text,p_items int) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.prova_generation_jobs; b jsonb; p public.plans; pol public.ai_operation_policies; take int; remaining int; g record; lease_id uuid:=gen_random_uuid(); prov text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
 if p_id is null or p_items is null or p_items not between 1 and 30 or coalesce(length(p_hash),0)<>64 then raise exception 'invalid_input'; end if;
 if not exists(select 1 from public.family_members where user_id=p_user_id and family_id=p_family_id) then raise exception 'forbidden' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_family_id::text,28));
 perform pg_advisory_xact_lock(hashtextextended(p_family_id::text,13));
 select * into j from public.prova_generation_jobs where id=p_id for update;
 if found then
  if j.family_id<>p_family_id or j.requested_by is distinct from p_user_id or j.prompt_hash<>p_hash or j.items<>p_items then return jsonb_build_object('error','request_conflict'); end if;
  if j.status='done' then return jsonb_build_object('cached',j.result); end if;
  if j.provider_result is not null and j.status='working' then return jsonb_build_object('provider_result',j.provider_result,'lease',j.lease); end if;
  if j.status in('working','uncertain') then return jsonb_build_object('error',case when j.status='working' and j.updated_at>now()-interval '3 minutes' then 'generation_in_progress' else 'ai_result_uncertain' end); end if;
 end if;
 p:=gina.family_plan_of(p_family_id);
 prov:=gina.ai_family_provider(p_family_id);
 select * into pol from public.ai_operation_policies where action='generate' and plan_code=p.code;
 if pol.action is null or not pol.enabled then return jsonb_build_object('error','ai_disabled'); end if;
 b:=gina.generation_balance(p_family_id);
 if p_items>(b->>'base_remaining')::int+(b->>'bonus_remaining')::int then return jsonb_build_object('error','ai_quota_exceeded'); end if;
 if not exists(select 1 from public.ai_providers where id=prov and status='active') then return jsonb_build_object('error','provider_unconfigured'); end if;
 if gina.ai_provider_paused(prov) then return jsonb_build_object('error','ai_temporarily_unavailable'); end if;
 if (select count(*) from public.prova_generation_jobs where family_id=p_family_id and status<>'failed' and created_at>=gina.family_month_start(p_family_id))>=pol.monthly_limit then return jsonb_build_object('error','ai_quota_exceeded'); end if;
 if (select count(*) from public.ai_request_attempts where family_id=p_family_id and created_at>now()-interval '1 minute')>=pol.per_minute then return jsonb_build_object('error','ai_rate_limited'); end if;
 if (select count(*) from public.prova_generation_jobs where family_id=p_family_id and status='working' and updated_at>now()-interval '3 minutes')>=pol.max_concurrent then return jsonb_build_object('error','generation_in_progress'); end if;
 insert into public.ai_request_attempts(family_id,action) values(p_family_id,'generate');
 insert into public.prova_generation_jobs(id,family_id,requested_by,prompt_hash,items,status,lease,provider)
 values(p_id,p_family_id,p_user_id,p_hash,p_items,'working',lease_id,prov)
 on conflict(id) do update set status='working',lease=lease_id,provider=prov,provider_result=null,error_code=null,created_at=now(),updated_at=now();
 delete from public.generation_credit_allocations where job_id=p_id;
 remaining:=p_items; take:=least(remaining,(b->>'base_remaining')::int);
 if take>0 then insert into public.generation_credit_allocations(job_id,units) values(p_id,take);remaining:=remaining-take; end if;
 for g in select c.id,c.amount-coalesce((select sum(case when x.status='done' then a.consumed when x.status in('working','uncertain') then a.units else 0 end) from public.generation_credit_allocations a join public.prova_generation_jobs x on x.id=a.job_id where a.grant_id=c.id),0) available
 from public.learning_credit_grants c where c.family_id=p_family_id and c.kind='ai_questions' and c.starts_at<=now() and c.ends_at>now() order by c.ends_at,c.id for update loop
  exit when remaining=0;take:=least(remaining,g.available);
  if take>0 then insert into public.generation_credit_allocations(job_id,grant_id,units) values(p_id,g.id,take);remaining:=remaining-take; end if;
 end loop;
 if remaining<>0 then raise exception 'credit_allocation_failed'; end if;
 return jsonb_build_object('ok',true,'lease',lease_id);
end; $$;

create or replace function public.fail_prova_generation_v2(p_id uuid,p_lease uuid,p_code text,p_uncertain boolean) returns void language plpgsql security definer set search_path='' as $$
declare prov text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
 update public.prova_generation_jobs set status=case when p_uncertain then 'uncertain' else 'failed' end,error_code=left(p_code,80),updated_at=now()
 where id=p_id and lease=p_lease and status='working' and provider_result is null returning provider into prov;
 if not found then raise exception 'lease_lost'; end if;
 -- Yalnız başarısızlık yönü: başarısız kod bu fonksiyonda sayacı sıfırlamaz.
 if p_uncertain or gina.ai_breaker_code(p_code) then perform gina.ai_provider_outcome(prov, false, p_code, p_uncertain); end if;
end; $$;

create or replace function public.complete_prova_generation_v2(p_id uuid,p_lease uuid,p_rows jsonb,p_model text,p_prompt_version text,p_input int,p_output int) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.prova_generation_jobs; a record; remaining int; take int; v_result jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
 select family_id into j.family_id from public.prova_generation_jobs where id=p_id;
 perform pg_advisory_xact_lock(hashtextextended(j.family_id::text,13));
 select * into j from public.prova_generation_jobs where id=p_id for update;
 if j.lease is distinct from p_lease or p_lease is null then raise exception 'lease_lost'; end if;
 if j.status='done' then return j.result; end if;
 if j.status<>'working' or j.provider_result is null or coalesce(jsonb_typeof(p_rows),'null')<>'array' or jsonb_array_length(p_rows)<>j.items then raise exception 'invalid_generation'; end if;
 remaining:=jsonb_array_length(p_rows);
 for a in select * from public.generation_credit_allocations where job_id=p_id order by grant_id nulls first loop
 take:=least(remaining,a.units); update public.generation_credit_allocations set consumed=take where id=a.id; remaining:=remaining-take; end loop;
 if remaining<>0 then raise exception 'credit_allocation_failed'; end if;
 v_result:=public.complete_prova_generation(p_id,p_rows,p_model,p_prompt_version,p_input,p_output);
 v_result:=jsonb_set(v_result,'{remaining}',to_jsonb((public.get_prova_entitlement(j.family_id)->>'ai_generate_remaining')::int));
 update public.prova_generation_jobs set result=v_result where id=p_id;
 perform gina.ai_provider_outcome(j.provider, true, null, false);
 return v_result;
end; $$;

-- 2. Özellik/yetenek/paket/girdi sınırı tek okuma --------------------------------------------------------
alter table public.ai_feature_requirements add column offered boolean not null default true;
comment on column public.ai_feature_requirements.offered is 'C08: false = ayrı uç/kota yok; paket ve kullanım ekranında çalışıyor gibi gösterilmez.';
update public.ai_feature_requirements set offered=false where feature='daily_tips';

create or replace function public.get_ai_usage() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare fam uuid := gina.family_id(); plan public.plans; month_start timestamptz; renews timestamptz; ent jsonb; setup jsonb;
 model public.ai_models; support jsonb; prov text; enabled boolean; media jsonb;
begin
 if fam is null or not gina.is_parent() then raise exception 'forbidden' using errcode='42501'; end if;
 plan := gina.family_plan_of(fam);
 month_start := gina.family_month_start(fam);
 renews := month_start + interval '1 month';
 ent := public.get_prova_entitlement(fam);
 setup := public.get_setup_ai_entitlement(fam);
 select * into model from public.ai_models where id=coalesce((select model_id from public.ai_settings where plan_code=plan.code), plan.ai_model) and active;
 support := case when model.id is null then null else gina.ai_model_support(model) end;
 prov := gina.ai_family_provider(fam);
 enabled := coalesce((select value from public.app_settings where key='ai.enabled') <> 'false'::jsonb, true)
    and coalesce((select s.enabled from public.ai_settings s where s.plan_code=plan.code),false);
 media := public.shared_source_limits('import', fam); -- mobil seçiciyle aynı okuyucu (get_learning_source_policy)
 return jsonb_build_object(
  'plan',plan.code,'period_start',month_start,'renews_at',renews,
  'enabled', enabled,
  'paused', gina.ai_provider_paused(prov),
  'operations',(select coalesce(jsonb_agg(jsonb_build_object('action',o.action,'enabled',o.enabled,'limit',o.monthly_limit,
     'used',(select count(*) from public.ai_operation_jobs j where j.family_id=fam and j.action=o.action and j.created_at>=month_start and j.status<>'failed'),
     'remaining',greatest(0,o.monthly_limit-(select count(*) from public.ai_operation_jobs j where j.family_id=fam and j.action=o.action and j.created_at>=month_start and j.status<>'failed')),
     'max_media_items',o.max_media_items,'max_media_bytes',o.max_media_bytes) order by o.action),'[]')
    from public.ai_operation_policies o where o.plan_code=plan.code and o.action<>'generate'),
  'generate',jsonb_build_object('limit',coalesce((ent->>'ai_generate_limit')::int,0),'used',coalesce((ent->>'ai_generate_used')::int,0),
     'remaining',greatest(0,coalesce((ent->>'ai_generate_remaining')::int,coalesce((ent->>'ai_generate_limit')::int,0)-coalesce((ent->>'ai_generate_used')::int,0)))),
  'setup',jsonb_build_object('limit',coalesce((setup->>'limit')::int,0),'remaining',coalesce((setup->>'remaining')::int,0)),
  -- Özellik başına: sunuluyor mu (offered), pakette var mı, girdi türleri ve modelin desteği. Model/sağlayıcı adı dönmez.
  'features',(select coalesce(jsonb_agg(jsonb_build_object(
     'feature',g.feature,'action',g.action,'offered',g.offered,'in_plan',g.in_plan,'inputs',coalesce(g.inputs,'[]'::jsonb),
     'available',enabled and g.offered and g.in_plan and g.inputs is not null
   ) order by g.feature),'[]')
   from (select f.feature, min(f.action) action, bool_and(f.offered) offered, bool_or(plan.code = any(f.plans)) in_plan,
           jsonb_agg(f.input_kind order by f.input_kind) filter (where plan.code = any(f.plans) and f.offered
             and coalesce((support->>'supported')::boolean,false)
             and not exists(select 1 from jsonb_array_elements(support->'unsupported_features') u
                            where u->>'feature'=f.feature and u->>'input_kind'=f.input_kind)) inputs
         from public.ai_feature_requirements f where f.feature<>'pre_review' group by f.feature) g),
  'media',jsonb_build_object('max_files',media->'max_files','max_total_bytes',media->'max_total_bytes',
     'max_image_bytes',media->'max_image_bytes','max_pdf_bytes',media->'max_pdf_bytes','max_pdf_pages',media->'max_pdf_pages',
     'analysis_cost','per_operation'));
end; $$;
revoke all on function public.get_ai_usage() from public, anon;
grant execute on function public.get_ai_usage() to authenticated;

-- 3. Ortak giriş aralığı yetkili mutasyonlarda ----------------------------------------------------------
-- Tetikleyici yalnız değer değiştiğinde çalışır; mevcut satırlar yeniden doğrulanmaz/yazılmaz.
create function gina.enforce_input_ranges() returns trigger
language plpgsql security definer set search_path='' as $$
declare rec jsonb := to_jsonb(new); prev jsonb := case when tg_op='UPDATE' then to_jsonb(old) else '{}'::jsonb end;
 i int := 0; col text; key text; v_detail text;
begin
 while i < tg_nargs loop
  col := tg_argv[i]; key := tg_argv[i+1]; i := i + 2;
  if rec->col is not null and jsonb_typeof(rec->col)<>'null' and (rec->col) is distinct from (prev->col) then
   begin
    perform gina.check_input_range(key, (rec->>col)::numeric);
   exception when raise_exception then
    -- Mesaj sözleşme kodu (invalid_input + alan/min/max), SQLSTATE eski check kısıtıyla aynı (23514):
    -- mevcut çağıranlar ve testler kısıt ihlali olarak görmeye devam eder.
    get stacked diagnostics v_detail = pg_exception_detail;
    raise exception 'invalid_input' using errcode = '23514', detail = v_detail;
   end;
  end if;
 end loop;
 return new;
end;$$;
revoke all on function gina.enforce_input_ranges() from public, anon, authenticated;
create trigger family_rewards_input_range before insert or update of cost_stars on public.family_rewards
 for each row execute function gina.enforce_input_ranges('cost_stars','reward_cost_stars');
create trigger task_templates_input_range before insert or update of stars on public.task_templates
 for each row execute function gina.enforce_input_ranges('stars','task_stars');
create trigger group_exams_input_range before insert or update of duration_minutes on public.group_exams
 for each row execute function gina.enforce_input_ranges('duration_minutes','group_exam_minutes');
create trigger exams_input_range before insert or update of duration_minutes on public.exams
 for each row execute function gina.enforce_input_ranges('duration_minutes','prova_minutes');

-- 4. AI puanı öneri, veli puanı kesin ------------------------------------------------------------------
alter table public.exam_answers add column ai_graded_at timestamptz;
comment on column public.exam_answers.ai_score is 'AI önerisi (0-100). C08 sonrası kesin puan değildir; score yalnız veli onayıyla yazılır.';
comment on column public.exam_answers.graded_by is 'parent = veli kesinleştirdi. ai = C08 öncesi eski kayıt (score AI''dan yazılmıştı; yeniden yazılmaz).';

-- prova-grade (service_role): yalnız öneri alanları. score/feedback/graded_by/graded_at'a dokunmaz; bu yüzden
-- inceleme revizyonu da değişmez. Deneme, veli puanlayana kadar ara sonuç (provisional) kalır.
create or replace function public.apply_ai_grades(p_attempt_id uuid, p_grades jsonb, p_summary jsonb default null)
returns public.exam_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  g jsonb;
  v_score smallint;
begin
  if not gina.is_service() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  for g in select * from jsonb_array_elements(coalesce(p_grades, '[]'::jsonb)) loop
    v_score := greatest(0, least(100, round((g ->> 'score')::numeric)))::smallint;
    update public.exam_answers ans
    set ai_score = v_score,
        ai_feedback = g ->> 'kisa_geri_bildirim',
        ai_details = jsonb_build_object(
          'eksikler', coalesce(g -> 'eksikler', '[]'::jsonb),
          'iyilestirme_onerileri', coalesce(g -> 'iyilestirme_onerileri', '[]'::jsonb)
        ),
        ai_graded_at = now()
    where ans.attempt_id = p_attempt_id and ans.question_id = (g ->> 'question_id')::uuid;
  end loop;
  if p_summary is not null then
    update public.exam_attempts set ai_feedback = p_summary where id = p_attempt_id;
  end if;
  return gina.recompute_attempt_totals(p_attempt_id);
end;
$$;

-- Veli AI önerisini olduğu gibi kesinleştirir. p_expected: velinin ekranda gördüğü öneri; arada yeni öneri
-- geldiyse 'ai_suggestion_changed'. Aynı çağrı tekrarında (zaten aynı veli puanı) sonuç değişmez.
create function public.accept_ai_grade(p_attempt_id uuid, p_question_id uuid, p_expected smallint)
returns public.exam_attempts
language plpgsql security definer set search_path = public as $$
declare a public.exam_attempts%rowtype; ans public.exam_answers%rowtype;
begin
  if not gina.is_parent() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into a from public.exam_attempts where id = p_attempt_id and family_id = gina.family_id() for update;
  if a.id is null then raise exception 'attempt_not_found' using errcode = 'P0001'; end if;
  if a.status = 'in_progress' then raise exception 'attempt_not_finished' using errcode = 'P0001'; end if;
  select * into ans from public.exam_answers where attempt_id = p_attempt_id and question_id = p_question_id for update;
  if ans.attempt_id is null or ans.ai_score is null then raise exception 'ai_suggestion_missing' using errcode = 'P0001'; end if;
  if ans.ai_score is distinct from p_expected then raise exception 'ai_suggestion_changed' using errcode = 'P0001'; end if;
  if ans.graded_by = 'parent' and ans.score = ans.ai_score then return a; end if;
  return public.score_open_answer(p_attempt_id, p_question_id, ans.ai_score, coalesce(ans.feedback, ans.ai_feedback));
end;$$;
revoke all on function public.accept_ai_grade(uuid, uuid, smallint) from public, anon;
grant execute on function public.accept_ai_grade(uuid, uuid, smallint) to authenticated;

-- Konu hakimiyeti: yalnız kesin puan (score). AI önerisi (ai_score) artık yedek puan olarak sayılmaz;
-- eski graded_by='ai' satırlarının score'u eskisi gibi okunur.
create or replace function public.child_topic_mastery(p_child_id uuid)
returns table (
  subject text, grade smallint, topic text, total int, correct numeric, pending int,
  accuracy int, score int, level_total int, last_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  with items as (
    select q.subject, q.grade, q.topic, e.kind,
           a.finished_at,
           case
             when q.kind = 'multiple_choice' then coalesce(ans.is_correct, false)::int::numeric
             when ans.attempt_id is null then 0
             else ans.score::numeric / 100
           end as value,
           power(0.5, greatest(0, extract(epoch from (now() - coalesce(a.finished_at, a.started_at))) / 86400.0) / 30.0) as w
    from public.exam_attempts a
    join public.exams e on e.id = a.exam_id
    join unnest(e.question_ids) qid on true
    join public.question_bank q on q.id = qid
    left join public.exam_answers ans on ans.attempt_id = a.id and ans.question_id = q.id
    where a.child_id = p_child_id
      and a.family_id = gina.family_id()
      and gina.is_parent()
      and a.status in ('submitted', 'graded')
  )
  select i.subject, max(i.grade)::smallint, i.topic,
         count(*) filter (where i.value is not null)::int as total,
         round(coalesce(sum(i.value), 0), 2) as correct,
         count(*) filter (where i.value is null)::int as pending,
         case when count(i.value) > 0 then round(100 * avg(i.value))::int end as accuracy,
         case when sum(i.w) filter (where i.value is not null) > 0
              then round(100 * sum(i.w * i.value) / sum(i.w) filter (where i.value is not null))::int end as score,
         count(*) filter (where i.kind = 'level_test' and i.value is not null)::int as level_total,
         max(i.finished_at) as last_at
  from items i
  group by i.subject, i.topic
  order by i.subject, score nulls last, i.topic;
$$;

-- Deneme özeti: soru başına AI önerisi ayrı alan; eski AI puanı `legacy_ai` ile işaretlenir.
create or replace function public.get_attempt_summary(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  a public.exam_attempts%rowtype;
  v_full boolean;
  v_open_total int;
  v_open_graded int;
  v_pending int;
  v_unanswered int;
  v_provisional boolean;
  v_open_answers jsonb;
begin
  select * into a from public.exam_attempts x
  where x.id = p_attempt_id
    and (
      (gina.is_parent() and x.family_id = gina.family_id())
      or (gina.is_device() and x.family_id = gina.family_id() and x.child_id = gina.child_id())
      or gina.is_service()
    );
  if a.id is null then
    raise exception 'attempt_not_found' using errcode = 'P0001';
  end if;
  v_full := gina.is_parent() or gina.is_service();

  v_open_total := coalesce(a.open_total, 0);
  v_open_graded := coalesce(a.open_graded, 0);
  v_pending := coalesce(a.open_pending, greatest(v_open_total - v_open_graded, 0));
  v_unanswered := coalesce(a.open_unanswered, 0);
  v_provisional := coalesce(a.provisional, v_open_graded < v_open_total);

  if v_full then
    select coalesce(jsonb_agg(jsonb_build_object(
             'question_id', q.id,
             'position', qid.ord,
             'state', gina.open_answer_state(ans.score, ans.answer_text, ans.answer_document),
             'score', ans.score,
             'graded_by', ans.graded_by,
             'ai_score', ans.ai_score,
             -- Öneri: AI puanı var, veli henüz kesinleştirmedi (eski AI kaydı değil).
             'ai_suggested', ans.ai_score is not null and ans.score is null,
             'legacy_ai', ans.graded_by = 'ai' and ans.score is not null,
             'has_text', nullif(trim(ans.answer_text), '') is not null,
             'has_document', coalesce(jsonb_array_length(ans.answer_document -> 'elements'), 0) > 0
           ) order by qid.ord), '[]'::jsonb)
    into v_open_answers
    from public.exams e
    join unnest(e.question_ids) with ordinality qid(id, ord) on true
    join public.question_bank q on q.id = qid.id
    left join public.exam_answers ans on ans.attempt_id = a.id and ans.question_id = q.id
    where e.id = a.exam_id and q.kind = 'open_ended';
  end if;

  return jsonb_build_object(
    'id', a.id,
    'exam_id', a.exam_id,
    'child_id', a.child_id,
    'status', a.status,
    'review_state', case
      when a.status = 'in_progress' then 'in_progress'
      when a.status = 'graded' then 'graded'
      else 'pending_review' end,
    'mc_total', a.mc_total,
    'mc_correct', a.mc_correct,
    'open_total', a.open_total,
    'open_graded', a.open_graded,
    'pending_open_count', v_pending,
    'unanswered_open_count', v_unanswered,
    'provisional', v_provisional,
    'score_pct', a.score_pct,
    'started_at', a.started_at,
    'finished_at', a.finished_at,
    'graded_at', a.graded_at
  ) || case when v_full then jsonb_build_object(
    'open_answers', v_open_answers,
    'ai_suggestion_count', (select count(*) from jsonb_array_elements(v_open_answers) x where (x->>'ai_suggested')::boolean)
  ) else '{}'::jsonb end;
end;
$$;
