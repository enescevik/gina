-- ÖNERİ (uygulanmadı) — Q03-BK-3, docs/release/q03-2026-11-06/README.md §4.
-- Şema dökümü (pg_dump -n public -n gina) barındırılan Supabase'e geri yüklendiğinde hedefin varsayılan
-- fonksiyon ayrıcalığı (anon/authenticated/service_role EXECUTE) dökümdeki GRANT'lere EKLENİR; pg_dump
-- anon için REVOKE üretmez. İzole tatbikatta 260 fonksiyon (apply_ai_grades, admin_* dahil) anon'a açıldı.
--
-- 1) Geri yüklemeden ÖNCE (şema dökümü süresince) varsayılanı kaldır:
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated, service_role;
-- ... pg_restore (şema+veri) ...
-- 2) Sonra varsayılanı geri ver (yeni migration'lar için beklenen davranış):
alter default privileges for role postgres in schema public grant execute on functions to anon, authenticated, service_role;

-- 3) Doğrulama: anon'un çalıştırabildiği fonksiyonlar yalnız bilinçli liste olmalı.
select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public','gina') and p.prokind = 'f'
  and has_function_privilege('anon', p.oid, 'EXECUTE')
  and not (n.nspname = 'public' and p.proname = 'get_shared_child_view')
  and not (n.nspname = 'gina' and p.proname in ('claims','role','family_id','child_id','valid_review_document'))
order by 1, 2;
-- Beklenen: 0 satır. Aksi halde geri yükleme ACL kaybetmiştir; referans imza ile karşılaştır:
--   scripts/security/rls-matrix.py --run-local --fresh  →  rls-matrix-fresh.json "functions[].anon_execute"

-- 4) Acil kapatma (referansla eşitlemeden önce): public şemasındaki tüm fonksiyonlardan anon'u düşür, bilinçli olanı geri ver.
-- do $$ declare r record; begin
--   for r in select p.oid::regprocedure s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' loop
--     execute format('revoke execute on function %s from anon, public', r.s);
--   end loop; end $$;
-- grant execute on function public.get_shared_child_view(text) to anon;
-- Not: authenticated/service_role için de aynı karşılaştırma yapılmalı (ör. apply_ai_grades authenticated'dan revoke edilmiştir).
