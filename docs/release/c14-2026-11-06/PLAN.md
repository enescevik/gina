# C14 — koordineli ara yayın planı (onay bekliyor)

6 Kasım 2026. Kaynak: main `e755d54`. Bu belge plandır; **hiçbir adım çalıştırılmadı**. R02 yerine geçmez.

## Kapsam

| Hedef | Şimdi canlıda | Yayınla gelecek |
|---|---|---|
| Üretim DB | 108 migration (son `20261105190000`) | **33 yeni migration** (`20261106010000` … `20261106340000`); repo 141 dosya |
| Edge | R01 öncesi kaynak | 22 değişen + 2 yeni fonksiyon (`channel-unsubscribe`, `content-prereview`, `curriculum-source-fetch` yeni; diğerleri güncel) — `room-weather`, `source-cleanup` değişmedi |
| Veli webi | R01 (5 Kasım 23:31) | main |
| Yönetim | 5 Kasım | main |
| iOS / tablet | 0.1.0 (27) | 0.1.0 (28) TestFlight + tablet Ad Hoc |

Kapalı kalan kapılar (yayınla açılmaz): `content_prereview.enabled`, e-posta/SMS kanalları (X01/X02), pazarlama izni, ek AI sağlayıcıları (X04), satış (hukuk URL'si yok).

## Eski istemci (26/27) uyum matrisi

| Değişiklik | 26/27 davranışı | Etki |
|---|---|---|
| `20261106170000` doğrudan çocuk silme kapalı | Menüden çocuk silme `42501` hatası | Özellik çalışmaz, veri kaybı yok → 28'e güncelleme gerekir |
| `20261106340000` eşleme belirteci | Yeni tablet eşleme `client_update_required` | Mevcut eşleşmiş cihazlar etkilenmez (pgTAP 120) |
| C02 ders bağı (`subject_id`) | Bağ kuran ailede eski istemci program kaydını reddedebilir | Bağ yalnız 28'de kurulabildiği için eski istemcide pratikte oluşmaz |
| C08 AI puanı öneri | Eski istemci AI puanını kesin puan olarak göremez, "bekliyor" görür | Bilinçli; veli 28'de onaylar |
| C11 yönetilen konumda ileri tarihli geçiş | `calendar_review_required` | Nadir; 28'de gerekçe akışı |
| C01 blueprint köken alanları | Eski istemci kaydeder, köken "sorulmadı" | Uyumlu |
| U08 hata sözleşmesi | `error` alanı korunuyor | Uyumlu |

Sonuç: aynı gün 28 TestFlight + tablet yayını zorunlu; aile cihazları güncellenene kadar çocuk silme ve yeni tablet eşleme çalışmaz.

## Sıra (tek oturum, dry-run → onay → execute)

1. Ön kontrol: `node scripts/release-local.mjs migrations:plan` (bekleyen 33, sıra dışı 0), yedek: `public`+`gina` dökümü (`.codex-setup/`), canlı ACL salt okunur kontrolü (`scripts/security/post-restore-acl-check.sql`, beklenen 0).
2. Migration'lar sırayla, her biri tek işlem (`release-local.mjs migrations:apply --execute`); her adımdan sonra ledger okuması. RLS politika değişiklikleri kısa kilit alır → düşük trafik saatinde.
3. Edge: 24 fonksiyon aynı kaynaktan (`supabase functions deploy`), `channel-unsubscribe` ve `content-prereview` `--no-verify-jwt`. Yeni sırlar bu yayında **eklenmez** (kapılar kapalı).
4. Web + yönetim: `release-local.mjs web|backoffice --execute`; canlı JS hash, Access ana/önizleme kontrolü.
5. Canlı smoke: `scripts/health-check.mjs --strict`; sentetik hesapla giriş, görev, Prova taslak, takvim günü, eşleme önizleme (kod tüketmeden).
6. iOS 28 yerel EAS build → `eas submit`; tablet 28 Ad Hoc → önizleme hash → `tablet` alias.
7. C15: sen 28'i kurup temel akışları denersin.

## Geri dönüş

- DB: geri alma migration'ı yok; ileri düzeltme (yeni migration). Kritik hata halinde ilgili Edge'i önceki sürüme döndür (`supabase functions deploy` önceki commit'ten).
- Web/yönetim: `scripts/rollback.mjs` ile önceki Pages dağıtımı.
- Tablet: `eas deploy:alias --alias tablet --id 7hteqzifmy` (27).
- iOS: TestFlight'ta 27 kalır; 28 test grubundan çıkarılabilir.

## Gerekenler

- **Senin onayın** (33 migration + 24 Edge + web/yönetim + iOS/tablet 28; eski istemcide iki özelliğin geçici olarak çalışmaması).
- Cloudflare yayını için yerel Wrangler oturumu (5 Kasım'da çalışıyordu; yayın anında kontrol edilir).
