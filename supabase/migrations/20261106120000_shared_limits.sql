-- U08 — Ortak sınırlar tek kaynaktan: çoklu kaynak (dosya/galeri/kamera) sınırı, S06 medya politikası
-- ile hizalama ve sayı/süre giriş aralıkları. Core karşılığı packages/core/src/shared-limits.ts;
-- testler (pgTAP 099, core vitest) iki tarafın aynı değerleri taşıdığını doğrular.

-- 1. S06 tohumu import/generate politikalarına 10 MiB "medya baytı" yazmıştı; yayımlanmış davranış
--    (learning_source_sets, deneyim raporu) toplam 20 MiB'dir. Yalnız dokunulmamış tohum değeri hizalanır;
--    yöneticinin değiştirdiği satır korunur.
update public.ai_operation_policies set max_media_bytes=20971520
 where action in ('import','generate') and max_media_bytes=10485760;

-- 2. Etkin kaynak sınırı = app_settings 'sources.max_files' (1–10, varsayılan 5) ∩ ilgili eylem politikası.
--    p_action verilirse ailenin paketine ait ai_operation_policies.max_media_items/max_media_bytes (0 = sınır yok) kesişir.
create or replace function public.shared_source_limits(p_action text default null,p_family uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare fam uuid:=coalesce(p_family,gina.family_id()); pc public.plan_code; items int; bytes bigint;
begin
 if p_action is not null and fam is not null then
  select p.code into pc from gina.family_plan_of(fam) p;
  select nullif(o.max_media_items,0),nullif(o.max_media_bytes,0) into items,bytes
  from public.ai_operation_policies o where o.action=p_action and o.plan_code=pc;
 end if;
 return jsonb_build_object(
  'max_files',least(gina.source_file_limit(),coalesce(items,10)),
  'max_image_bytes',4194304,
  'max_pdf_bytes',10485760,
  'max_pdf_pages',5,
  'max_total_pages',20,
  'max_total_bytes',least(20971520::bigint,coalesce(bytes,20971520)),
  'analysis_cost','per_operation',
  'source',case when items is null and bytes is null then 'app_settings' else 'app_settings+policy' end);
end;$$;
revoke all on function public.shared_source_limits(text,uuid) from public,anon;
grant execute on function public.shared_source_limits(text,uuid) to authenticated,service_role;

-- Mobil seçici bu RPC'yi okur: max_files artık aynı okuyucudan gelir (import politikasıyla kesişir).
create or replace function public.get_learning_source_policy() returns jsonb language sql stable security definer set search_path='' as $$
 select public.shared_source_limits('import')||jsonb_build_object(
  'enabled',gina.is_parent() and exists(select 1 from public.app_settings where key='sources.enabled' and value='true'::jsonb),
  'max_images',3);
$$;

-- Set kaydı aynı okuyucuyu kullanır (eylemden bağımsız genel sınır; eylem bazlı kesişim Edge'de uygulanır).
create or replace function public.register_learning_source_set(p_ids uuid[]) returns uuid language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();existing public.learning_source_sets; n int; total_pages int;total_bytes bigint;limits jsonb;
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501';end if;
 if not exists(select 1 from public.app_settings where key='sources.enabled' and value='true') then raise exception 'source_unavailable';end if;
 limits:=public.shared_source_limits(null,f);
 if p_ids is null or array_ndims(p_ids)<>1 or array_lower(p_ids,1)<>1 or cardinality(p_ids) not between 1 and (limits->>'max_files')::int
 or exists(select 1 from unnest(p_ids) x where x is null) or (select count(distinct x) from unnest(p_ids)x)<>cardinality(p_ids) then
  raise exception 'source_file_limit' using detail=jsonb_build_object('max_files',(limits->>'max_files')::int,'selected',coalesce(cardinality(p_ids),0),'remaining',0)::text;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(f::text,41));
 perform 1 from public.learning_sources where id=any(p_ids) order by id for update;
 select count(*),sum(coalesce(pages,1)),sum(bytes) into n,total_pages,total_bytes from public.learning_sources
 where id=any(p_ids) and family_id=f and kind='document' and status='ready' and uploaded_by=auth.uid();
 if n<>cardinality(p_ids) then raise exception 'source_not_ready';end if;
 if total_pages>(limits->>'max_total_pages')::int or total_bytes>(limits->>'max_total_bytes')::bigint then raise exception 'source_size_or_type';end if;
 select * into existing from public.learning_source_sets where anchor_id=p_ids[1];
 if found then
  if existing.family_id<>f or existing.source_ids<>p_ids then raise exception 'request_conflict';end if;
  return existing.anchor_id;
 end if;
 if exists(select 1 from public.learning_source_sets where source_ids && p_ids)
 or exists(select 1 from public.learning_source_ai_consents where source_id=any(p_ids))
 or exists(select 1 from public.learning_source_links where source_id=any(p_ids)) then raise exception 'request_conflict';end if;
 insert into public.learning_source_sets(anchor_id,family_id,source_ids,pages) values(p_ids[1],f,p_ids,total_pages);
 return p_ids[1];
end;$$;

-- 3. Sayı/süre girişleri: hazır seçim ve elle giriş aralıkları. Core INPUT_RANGES ile birebir aynı
--    (core testi bu literal'i migration metninden okuyup karşılaştırır; değişiklik iki yerde birden yapılır).
create or replace function public.shared_input_ranges() returns jsonb language sql immutable set search_path='' as $$
 select '{
  "prova_minutes":{"min":1,"max":180,"step":5,"presets":[10,15,20,30,45,60],"unit":"minutes"},
  "prova_target":{"min":1,"max":100,"step":1,"presets":[5,10,15,20],"unit":"count"},
  "source_question_count":{"min":1,"max":30,"step":1,"presets":[3,5,10,20,30],"unit":"count"},
  "task_stars":{"min":0,"max":10,"step":1,"presets":[1,2,3,5],"unit":"stars"},
  "reward_cost_stars":{"min":1,"max":500,"step":1,"presets":[5,10,20,50,100],"unit":"stars"},
  "timetable_lesson_minutes":{"min":5,"max":180,"step":5,"presets":[30,35,40,45,50],"unit":"minutes"},
  "timetable_break_minutes":{"min":0,"max":120,"step":5,"presets":[5,10,15,20],"unit":"minutes"},
  "study_item_minutes":{"min":5,"max":60,"step":5,"presets":[5,10,15,20,40,60],"unit":"minutes"},
  "group_exam_minutes":{"min":5,"max":120,"step":5,"presets":[20,30,40,60],"unit":"minutes"},
  "school_max_score":{"min":1,"max":9999,"step":1,"presets":[10,20,50,100],"unit":"points"},
  "setup_task_stars":{"min":1,"max":5,"step":1,"presets":[1,2,3,5],"unit":"stars"},
  "setup_reward_stars":{"min":1,"max":100,"step":1,"presets":[5,10,20,50],"unit":"stars"}
 }'::jsonb
$$;
revoke all on function public.shared_input_ranges() from public,anon;
grant execute on function public.shared_input_ranges() to authenticated,service_role;

-- Sunucu aynı aralığı uygular: tek doğrulayıcı. Aralık dışı → 'invalid_input' + alan/min/max ayrıntısı.
create or replace function gina.check_input_range(p_key text,p_value numeric) returns int language plpgsql immutable set search_path='' as $$
declare r jsonb:=public.shared_input_ranges()->p_key;
begin
 if r is null then raise exception 'invalid_input' using detail=jsonb_build_object('field',p_key)::text;end if;
 if p_value is null or p_value<>trunc(p_value) or p_value<(r->>'min')::numeric or p_value>(r->>'max')::numeric then
  raise exception 'invalid_input' using detail=jsonb_build_object('field',p_key,'min',(r->>'min')::int,'max',(r->>'max')::int)::text;
 end if;
 return p_value::int;
end;$$;
revoke all on function gina.check_input_range(text,numeric) from public,anon,authenticated;
grant execute on function gina.check_input_range(text,numeric) to service_role;
