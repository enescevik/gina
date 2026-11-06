-- Q03-BK-3 — geri yükleme sonrası fonksiyon ACL kontrolü (salt okunur). scripts/restore-database.mjs 5. adımda ve
-- docs/security/RESTORE-RUNBOOK.md'de kullanılır; üretimde hesap sahibi tarafından bir kez çalıştırılması önerilir.
-- Beklenen: 0 satır. Satır dönüyorsa şema dökümü hedefin varsayılan fonksiyon ayrıcalığıyla birleşmiş ve anon'a
-- açılmıştır (patches/proposed/post-restore-acl-check.sql §4'teki acil kapatma ve referans matris karşılaştırması).
-- Bilinçli anon istisnaları yalnız public.get_shared_child_view(text) (öğretmen paylaşımı) ve S02/C10'dan beri
-- public.unsubscribe_with_token(text) (imzalı e-posta vazgeçme bağlantısı; pgTAP 102/116 izin listesiyle aynı —
-- C13-RST-1: eksik olduğu için başarılı geri yükleme "BAŞARISIZ" görünüyordu). gina.* yardımcı fonksiyonları
-- 20261106150000_rls_grant_hygiene ile anon'dan açıkça geri alınmıştır; bu yüzden listede istisna değildir.
select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as anon_executable_function
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'gina') and p.prokind = 'f'
  and p.prorettype <> 'trigger'::regtype
  and has_function_privilege('anon', p.oid, 'EXECUTE')
  and not (n.nspname = 'public' and p.proname in ('get_shared_child_view', 'unsubscribe_with_token'))
order by 1;
