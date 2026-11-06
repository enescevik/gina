# Üçüncü ara yayın (C14c) — plan (onay bekliyor)

6 Kasım 2026 akşamı. Kaynak: main (D10–D17 birleşik). **Hiçbir adım çalıştırılmadı.** Önceki: [C14b](../c14b-2026-11-06/PLAN.md).

## Kapsam

| Hedef | Şimdi canlıda | Yayınla gelecek |
|---|---|---|
| Üretim DB | 146 (son `20261106390000`) | **5 migration**: `400000` kişi adı uyarısı (D10), `410000` aile süzgeci + denetimde yönetici adı (D12), `430000` AI sorusunu düzenleme (D14), `440000` MEB pilot kapsamı (D15, yalnız sentetik aileye süreli), `450000` eşleme saklama işleri (D17, 2 pg_cron işi) |
| Edge | C14b | **3 fonksiyon**: `prova-generate` (`v8-rubric-assesses`), `prova-grade` (`v7-purpose-aware`), `prova-review` (`review-v3-purpose`) |
| Veli webi / yönetim | C14b | main (D10/D14 ekranları, D11/D12 yönetim) |
| iOS / tablet | 29 | 30 |

Kapalı kalan: `content_prereview.enabled`, `curriculum_catalog.enabled` (global; pilot yalnız sentetik aileye), e-posta/SMS, ek AI sağlayıcıları, satış.

## Eski istemci (29) uyumu

| Değişiklik | 29 davranışı |
|---|---|
| D10 `content_review` yanıt alanı | Sessizce atılır, uyarı görünmez |
| D12 `admin_families_search` yeni isteğe bağlı parametreler | Eski çağrı aynı sonucu alır |
| D14 yeni RPC'ler | 29 düzenleme yapamaz; düzenlenmiş satırları normal soru olarak açar |
| D13 istem/şema | `rubric.assesses` isteğe bağlı; eski rubrikler geçerli |
| D17 cihaz temizliği | 90 gün izi olmayan cihazlar; etkin cihaz korunur |

Zorunlu güncelleme yok. **Sıra kuralı:** yönetim, migration'dan sonra yayımlanır (D12).

## Sıra

1. Anlık görüntü, ön kontrol (bekleyen 5, sıra dışı 0), ACL 0, RLS kapalı 0.
2. 5 migration; ledger 151; ACL/RLS tekrar; `cron.job` içinde `prune-unused-devices` ve `prune-pairing-records` var mı.
3. 3 Edge fonksiyonu.
4. Web + yönetim, hash ve Access.
5. `health-check.mjs --strict`.
6. Canlı puanlama kontrolü ([d13/run-d13.mjs](../d13-2026-11-06/run-d13.mjs)): sentetik hesap, ≤2 ücretli çağrı, beklenen 1. Yalnız sonuç sorusu ≥90; süreç sorusu ölçüte göre kısmi (40–75) ve ilkinden düşük. Temizlik + doğrulama.
7. iOS 30 + tablet 30.

## MEB gerçek kabul pilotu (ayrı karar, bu yayının parçası değil)

[D15 README](../d15-2026-11-06/README.md). Canlıda yapılması için ayrıca senden gerekenler:
- Gerçek katalog verisi üretime yazılır: `turkce2.xlsx` kaynağı ve kovada orijinal dosya kalıcı kalır, 46 aday taslak olarak girer.
- **Tek senaryonun** (`tr-2026-2027-t1-turkce2-g5-c6`) yayımlanması gerçek bir editoryal karardır. Bunu senin yapman gerekir: yönetimde hücreleri resmî dosyayla karşılaştırıp yayımlarsın, ya da betiğe senin kimliğinle onay verilir.
- Pilot sonunda yayın geri çekilir (önerim).
- Ücretli çağrı: beklenen 1, tavan 3.

## Geri dönüş

- DB ileri düzeltme. pg_cron işleri `cron.unschedule` ile durdurulabilir.
- Edge: C14b kaynağından (`8fb2eef`) yeniden dağıtım.
- Web/yönetim: C14b dağıtımları (`1c0cf214`, `30000ffb`).
- Tablet: `eas deploy:alias --alias tablet --id b9q067lwk9` (29). iOS: 29 kalır.

## Gerekenler

- **Senin onayın**: 5 migration, 3 Edge, web/yönetim, iOS/tablet 30, ≤2 sentetik gerçek AI çağrısı.
- MEB pilotu için ayrıca: "MEB pilotu da" + editoryal inceleme için 10 dakikalık zaman.

## Yürütme kaydı (6 Kasım 2026, Enes onayı 18:23Z: "onay + MEB pilotu da")

| Adım | Sonuç |
|---|---|
| Anlık görüntü | 197 tablo, 682 satır (`.codex-setup/c14c/`, gitignored) |
| Ön kontrol | bekleyen 5, sıra dışı 0, ACL 0, RLS kapalı 0 |
| Migration | 5/5; ledger 151, son `20261106450000`; sonrası ACL 0, RLS kapalı 0 |
| pg_cron | `prune-unused-devices` (03:25 UTC) ve `prune-pairing-records` (03:35 UTC) etkin; bugün kaldırılacak cihaz 0 / 2 |
| Edge | `prova-generate`, `prova-grade`, `prova-review` dağıtıldı |
| Web | https://7f515ca0.gina-web.pages.dev, canlı hash eşleşti |
| Yönetim | https://d4ebcb30.gina-backoffice.pages.dev, Access 12/12 (migration sonrası yayımlandı) |
| Sağlık | `health-check.mjs --strict` ok |
| Canlı puanlama ([d13](../d13-2026-11-06/)) | 1 ücretli çağrı; `prova-grade/v7-purpose-aware`; yalnız sonuç 95, süreç 60 (ilkinden düşük), tekrar ikinci iş açmadı; sentetik hesap silindi, aile satırları 0 |
| iOS 30 | yerel EAS store build, SHA-256 `7ddc64f9713c…`, TestFlight gönderimi `b7ccb6a4` |
| Tablet 30 | dağıtım `c4aic5og2w` → `tablet` alias; ilk alias doğrulaması CDN gecikmesiyle düştü, `verify --target tablet` sonra temiz ([kayıt](../tablet-30-2026-11-06/release.json)) |

MEB pilotu: ön kontrol, sentetik aile ve Pro izni (Claude); kaynak indirme, 46 aday çıkarma ve geçici yönetici silme (Codex, operatör olarak). Yayın, üretim, atama ve geri çekme Enes'in "yayımla" kararını bekliyor. Kanıt: [d15 live](../d15-2026-11-06/live/).
