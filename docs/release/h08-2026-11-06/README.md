# H08 — regresyon, düzeltme yayını ve teslim (6–7 Kasım 2026)

Yetki: Enes, 6 Kasım 19:51Z ("Uygun testler geçince hazır düzeltmeleri mevcut yayın yetkisi kapsamında web, yönetim, tablet ve TestFlight'a yayımla"). Kaynak: main `fe08cb60` (H00–H07). Sonradan main'e giren H08a ve 116 değişiklikleri yalnız testtir; uygulamaya gitmez.

## Regresyon (yayın öncesi, birleşik main)

| Kontrol | Sonuç |
|---|---|
| pgTAP, Europe/Istanbul ve UTC (şablon) | 133 dosya, 6.136 kontrol, 0 hata |
| pgTAP `--fresh` (boş DB), iki saat dilimi | 133 dosya, 6.136 kontrol, 0 hata (H08a düzeltmesinden sonra) |
| Edge (Deno, `--config supabase/functions/deno.json`) | 538 geçti, 0 hata |
| core vitest / tsc | 474 / temiz |
| mobil tsc / expo lint | temiz / temiz |
| yönetim typecheck / lint | temiz / temiz |
| script testleri | 109 geçti |

Ek: Faz 0 birleştirmesinden sonra (Enes onayı) şablon koşusu 135 dosya / 6.584 / 0; `--fresh` UTC koşusunda 116 test 61 bir kez düştü (rastgele imzanın son iki karakteri zaten `00` ise kurcalama etkisiz kalıyordu). Test kesinleştirildi (`917cee2e` öncesi commit), 3 tekrar temiz.

## Yayın (sıra: migration → Edge → web/yönetim → mobil)

| Adım | Sonuç | Kanıt |
|---|---|---|
| Ön kontrol | anlık görüntü 200 tablo / 745 satır (`.codex-setup/h08/`, gitignored); ACL 0, RLS kapalı 0 | |
| Üretimde bulunan durum | `20261106470000` (H02) ve `20261106480000` (H07) ile H02/H07 Edge fonksiyonları **20:57Z'de başka bir yayın hattı tarafından** yüklenmişti (Codex). Tablet 31 `711945e` kaynağından yayımlanmıştı. | ledger, Edge `updated_at`, tablet `release.json` |
| Migration | `20261106460000` (H01) ve `20261106490000` (H04) tek işlem; ledger 155, son `20261106490000`; ACL 0, RLS kapalı 0; yeni cron `apple-revocation-worker` (*/15) | `.codex-setup/h08/migrations-apply.log` |
| Edge | `delete-account` v18, `apple-token` v1, `push-send` v17, `apple-revocation-worker` v1 (`--no-verify-jwt`); H02/H07 fonksiyonları (`curriculum-source-fetch`, `curriculum-source-extract`, `content-prereview`) aynı kaynaktan yeniden yüklendi | Management API listesi |
| Web | https://f1adee0b.gina-web.pages.dev, canlı hash eşleşti; https://ginafamily.com 200 | `release-local verify --target web` |
| Yönetim | https://04c33ac6.gina-backoffice.pages.dev, Access 12/12; https://admin.ginafamily.com 302 (Access) | `check-backoffice-access.mjs` |
| iOS | build **32** (31 başka hatta kullanılmıştı), IPA SHA-256 `ef6e68349aac…`, TestFlight gönderimi `670700d0-66d6-4032-8892-cff67e241624` | `.codex-setup/h08/submit.log` |
| Tablet | build 32, dağıtım `gxt6d74dz6` → `tablet` alias, kaynak `fe08cb60`, IPA SHA-256 `048341824c7d…`. Alias önbelleği (`max-age=3600`) ilk doğrulamada 31 gösterdi; yeniden doğrulama temiz | [kayıt](../tablet-32-2026-11-06/release.json) |
| Sağlık | `health-check.mjs --strict --expected-tablet-build 32` ok | |

Sonradan (21:04Z) başka hatta `content-prereview` `verify_jwt=false` ile yeniden yüklendi ve `content_prereview.enabled=true` yapıldı (Codex, PR #156). Bu yayın o ayara dokunmadı.

Kapalı kalanlar: `channels.email.provider` boş (ürün e-postası kapalı), `curriculum_catalog.enabled=false`, Apple sırları kurulmadı (Apple iptal işi `token_unavailable` olarak kaydedilir, silme engellenmez).

## Ayrıca: Prova QT Faz 0

Migration `20261107000000`–`20261107000400` main'de (Enes'in diğer thread'deki onayıyla birleştirildi). **Üretime uygulandı** (Enes onayı bu thread'de, 6 Kasım 21:57Z): 5/5 tek işlem, ledger 160, son `20261107000400`; sonrası ACL 0, RLS kapalı 0, sağlık temiz. Uygulama/Edge/web değişiklikleri ve `20261107010000+` bu yayına girmez.

## Eski istemci uyumu

- Build 30/31: `delete-account` eski istemci `request_id` göndermez → Apple kullanıcısı engellenmez (`token_unavailable`). Yeni ekranlar (Apple ile doğrula, bağlantı hata ekranları, abonelik AI notu, H06 düzeltmeleri) yalnız 32'de.
- `push-send` dil sırası hesap dili → push token → Türkçe; eski istemciyi etkilemez.

## Geri dönüş

- DB: ileri düzeltme; Apple iş cron'u `cron.unschedule('apple-revocation-worker')`.
- Web/yönetim: önceki dağıtımlar `7f515ca0` / `d4ebcb30` (C14c).
- Tablet: `eas deploy:alias --alias tablet --id c4aic5og2w` (30) ya da 31 dağıtımı.
- iOS: TestFlight'ta 30/31 kalır.
