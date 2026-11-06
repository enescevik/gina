-- D6 — D5 gerçek AI kabulünde bulunan sorunlar (yalnız fonksiyon gövdeleri; tablo/veri değişmez).
--
-- 1. Devre kesici: modelin sözleşmeye uymayan çıktısı (ai_result_invalid[_kural]), reddi (refusal) ve çıktı
--    sınırında kesilmesi (max_tokens/length/truncated) sağlayıcı arızası değildir — sağlayıcı yanıt verdi. Bu
--    sonuçlar iş satırında yine `uncertain` kalır (ücret oluşmuş olabilir, otomatik tekrar yok), ama tüm ailelerin
--    paylaştığı sağlık sayacını artırmaz ve başarı gibi sıfırlamaz da. 429/5xx ve sonucu bilinmeyen çağrılar
--    (zaman aşımı, ağ kaybı: provider_outcome_unknown) eskisi gibi sayar.
-- 2. B4: 10 MiB üstü PDF rezervasyonda `source_file_too_large` ile reddedilir. Önceden RPC PDF için bayt sınırı
--    denetlemiyor, tablo CHECK'i yakalıyor ve Edge `source_failed` (service_unavailable, retryable:true) dönüyordu.
-- Tekrar uygulanabilir (create or replace); imzalar ve yetkiler aynıdır.

create or replace function gina.ai_content_outcome(p_code text) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(p_code ~ '^(ai_result_invalid(_[a-z_]+)?|(anthropic|openai|gemini)_(refusal|max_tokens|length|truncated))$', false);
$$;
comment on function gina.ai_content_outcome(text) is
 'D6: sağlayıcının yanıt verdiği ama çıktının kullanılamadığı kodlar; devre kesiciyi beslemez.';
revoke all on function gina.ai_content_outcome(text) from public, anon;
grant execute on function gina.ai_content_outcome(text) to authenticated, service_role;

-- Tek yerden sağlık kaydı (finish_ai_operation, fail_prova_generation_v2 ve diğer çağıranlar bunu kullanır).
create or replace function gina.ai_provider_outcome(p_provider text, p_ok boolean, p_error text, p_uncertain boolean) returns void
language plpgsql security definer set search_path='' as $$
declare prov text := coalesce(p_provider, gina.ai_error_provider(p_error), 'anthropic');
begin
 insert into public.ai_provider_health(provider) values(prov) on conflict (provider) do nothing;
 if p_ok then
  update public.ai_provider_health set failures=0,open_until=null,updated_at=now() where provider=prov;
 elsif gina.ai_content_outcome(p_error) then
  -- D6: model çıktısı sorunu; sağlayıcı sağlığı değişmez (ne artar ne sıfırlanır).
  return;
 elsif p_uncertain or gina.ai_breaker_code(p_error) then
  update public.ai_provider_health set failures=failures+1,
   open_until=case when failures+1>=3 then now()+interval '2 minutes' else open_until end,updated_at=now() where provider=prov;
 end if;
end;$$;
revoke all on function gina.ai_provider_outcome(text,boolean,text,boolean) from public, anon, authenticated;
grant execute on function gina.ai_provider_outcome(text,boolean,text,boolean) to service_role;

-- B4: 20261105010000_learning_source_sets.sql gövdesi + PDF bayt sınırı (tablo CHECK'i ile aynı 10 MiB).
create or replace function public.reserve_learning_source(p_id uuid,p_kind text,p_name text,p_mime text,p_bytes int,p_sha256 text,p_consent boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();s public.learning_sources;
begin
 if not gina.is_parent() then raise exception 'forbidden' using errcode='42501'; end if;
 if not exists(select 1 from public.app_settings where key='sources.enabled' and value='true'::jsonb) then raise exception 'source_unavailable'; end if;
 if p_consent is not true then raise exception 'source_consent_required'; end if;
 if p_id is null or p_kind not in('document','question_image') or p_mime not in('image/png','image/jpeg','application/pdf') or (p_mime<>'application/pdf' and p_bytes>4194304) then raise exception 'source_size_or_type'; end if;
 if p_mime='application/pdf' and p_bytes>10485760 then raise exception 'source_file_too_large'; end if;
 perform pg_advisory_xact_lock(hashtextextended(f::text,41));
 select * into s from public.learning_sources where id=p_id;
 if found then
  if s.family_id<>f or s.uploaded_by is distinct from auth.uid() or s.sha256<>p_sha256 or s.kind<>p_kind or s.bytes<>p_bytes or s.mime<>p_mime then raise exception 'request_conflict'; end if;
  return to_jsonb(s);
 end if;
 if (select count(*) from public.learning_sources where family_id=f and created_at>now()-interval '1 minute')>=greatest(5,gina.source_file_limit()) then raise exception 'source_rate_limited'; end if;
 if (select count(*) from public.learning_sources where family_id=f and created_at>now()-interval '1 day')>=100
 or (select coalesce(sum(bytes),0) from public.learning_sources where family_id=f)+p_bytes>536870912 then raise exception 'source_storage_limit'; end if;
 insert into public.learning_sources(id,family_id,uploaded_by,kind,name,mime,bytes,sha256,object_path,storage_consent)
 values(p_id,f,auth.uid(),p_kind,trim(p_name),p_mime,p_bytes,p_sha256,f::text||'/'||p_id::text,'private-storage-v1') returning * into s;
 return to_jsonb(s);
end; $$;
