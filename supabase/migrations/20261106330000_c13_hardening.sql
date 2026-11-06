-- C13 — bütünleşik güvenlik/performans sertleştirmesi (docs/release/c13-2026-11-06/README.md).
--
-- 1) C13-AUTH-2 (düşük, gizlilik): `question_bank_admin_all` tam admin'e AİLEYE ÖZEL soruları (veli yazımı soru
--    kökü/çözüm) REST üzerinden okuma ve yazma izni veriyordu (c13-rpc-fuzz: admin_full → table:question_bank).
--    Yönetim paneli yalnız `family_id is null` (global banka) satırlarını kullanır (apps/backoffice/src/pages/
--    questions.tsx: `.is("family_id", null)` hem liste hem güncellemede). Politika global bankayla sınırlandı;
--    aile soruları için yönetim yolu SECURITY DEFINER RPC'lerdir (RLS'ten etkilenmez). InitPlan biçimi korunur
--    (pgTAP 100). Restrictive `question_bank_admin_strict` değişmedi.
drop policy if exists question_bank_admin_all on public.question_bank;
create policy question_bank_admin_all on public.question_bank as permissive for all to authenticated
 using ((select gina.is_admin()) and family_id is null)
 with check ((select gina.is_admin()) and family_id is null);

-- 2) C13-PERF-1 (orta, performans): çocuk Bugün / görev listesi `routines_for_day` ve takvim `plan_for_days`.
--    Kanıt ve eşdeğerlik: docs/release/c13-2026-11-06/perf/ (aynı koşu A-B-A; 4000 girdilik plan_version_on
--    karşılaştırması 0 fark, REST çıktı sha256'ları eşit). Yetki kontrolü ve gövde birebir aynı; yalnız
--    `cross join lateral (select f() v) x` → `cross join lateral f() v` (fonksiyon satır başına 1 kez) ve
--    plan_version_on tek geçişli plpgsql. `create or replace` mevcut grant/revoke'u korur.
create or replace function public.routines_for_day(p_child_id uuid,p_day date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare f uuid:=gina.family_id();
begin
 if auth.uid() is null or f is null or (gina.is_parent() or (gina.is_device() and gina.child_id()=p_child_id)) is not true
 or not exists(select 1 from public.children where id=p_child_id and family_id=f)
 then raise exception 'plan_forbidden' using errcode='42501';end if;
 if p_day is null or not isfinite(p_day) then raise exception 'plan_day_invalid';end if;
 return jsonb_build_object('child_id',p_child_id,'day',p_day,'routines',coalesce((select jsonb_agg(jsonb_build_object(
   'id',t.id,'current_revision',t.revision,
   'version',case when v is null then null else jsonb_build_object('revision',(v->>'revision')::int,'title',v->'value'->>'title','icon',v->'value'->>'icon',
     'stars',(v->'value'->>'stars')::int,'days_of_week',v->'value'->'days_of_week','time_of_day',v->'value'->>'time_of_day',
     'requires_approval',(v->'value'->>'requires_approval')::boolean,'effective_from',v->'effective_from','known_since',v->'known_since',
     'status',v->>'status','unknown_before',v->'unknown_before') end,
   'next',(select jsonb_build_object('revision',c.revision,'effective_from',c.effective_from,'title',c.after_value->>'title','icon',c.after_value->>'icon',
     'stars',(c.after_value->>'stars')::int,'days_of_week',c.after_value->'days_of_week')
    from gina.task_routine_changes c where c.template_id=t.id and c.superseded_by is null and c.effective_from>p_day order by c.effective_from,c.revision limit 1)
  ) order by t.sort_order,t.created_at,t.id) from public.task_templates t cross join lateral gina.task_routine_version_on(t.id,p_day) v
  where t.child_id=p_child_id and t.family_id=f),'[]'::jsonb));
end;$$;

-- 2) plan_version_on: plan_for_days(42 gün) rutin × gün başına bir kez çağırır (220 rutinde 9240 çağrı, öz süre
--    ~%60). Üç CTE'li SQL gövdesi her çağrıda jsonb_array_elements + sıralama planı çalıştırıyordu. Aynı kuralın
--    tek geçişli plpgsql karşılığı (SPI sorgusu yok, yalnız basit ifadeler):
--    known    = eff<=gün olanlar içinde (eff desc, revision desc NULLS FIRST) ilk
--    earliest = tümü içinde (eff asc, revision asc NULLS LAST) ilk
--    next_known = start'ı olanların en küçük start'ı
create or replace function gina.plan_version_on(p_versions jsonb,p_day date) returns jsonb
language plpgsql immutable set search_path='' as $$
declare n int:=coalesce(jsonb_array_length(p_versions),0);i int;x jsonb;rev int;st date;eff date;nxt date;
 k jsonb;k_eff date;k_rev int;k_st date;e jsonb;e_eff date;e_rev int;e_st date;
begin
 for i in 0..n-1 loop
  x:=p_versions->i;rev:=(x->>'revision')::int;
  st:=coalesce((x->>'effective_from')::date,(x->>'known_since')::date);eff:=coalesce(st,'-infinity'::date);
  if st is not null and (nxt is null or st<nxt) then nxt:=st;end if;
  if eff<=p_day and (k is null or eff>k_eff or (eff=k_eff and k_rev is not null and (rev is null or rev>k_rev))) then
   k:=x;k_eff:=eff;k_rev:=rev;k_st:=st;end if;
  if e is null or eff<e_eff or (eff=e_eff and rev is not null and (e_rev is null or rev<e_rev)) then
   e:=x;e_eff:=eff;e_rev:=rev;e_st:=st;end if;
 end loop;
 if k is not null then
  return k||jsonb_build_object('status',case when k_st is null then 'unknown_before' else 'known' end,'unknown_before',case when k_st is null then nxt end);
 end if;
 if e is not null then return e||jsonb_build_object('status','unknown_before','unknown_before',coalesce(e_st,nxt));end if;
 return null;
end;$$;
revoke all on function gina.plan_version_on(jsonb,date) from public,anon,authenticated,service_role;
