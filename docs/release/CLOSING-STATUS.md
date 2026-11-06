# GINA — tek güncel kapanış tablosu

7 Kasım 2026, ~01:15 (TR), H08 sonrası uzlaştırma. Bu tablo `continuation-2026-11-06/PROGRESS.md`, `overnight-2026-11-06/PROGRESS.md` ve C/D raporlarındaki durum sütunlarının **yerini alır**. Eski tablolardaki "KOD HAZIR / yayımlanmadı" ifadeleri tarihseldir. Son kapsam kararı: Kütüphane içerik üretimi backoffice üzerinden kullanıcı tarafından, 3B dünya kullanıcı + Codex tarafından ayrı yürütülecek. İkisi de Claude devrinin dışındadır. Güncel kalan işlerin öncelik ve kabul ölçütleri: [H00–H08](../CLAUDE-REMAINING-WORK.md).

## Son yayınlar

| Yayın | Onay | Kaynak commit | DB (ledger) | Edge | Web / yönetim | Mobil |
|---|---|---|---|---|---|---|
| C14 | Enes 16:01Z | `c16b8b1` | 141, son `20261106340000` | 24 fonksiyon | web `a31715be`, yönetim `b1cd107a` | iOS 28 gönderim `8f37781c` (IPA `9e2dbc10…`); tablet 28 `m8aeavsrur` (IPA `116a7fad…`) |
| C14b | Enes 15:38Z | `b04207c`; `prova-grade` ek düzeltme `8fb2eef` | 146, son `20261106390000` | 8 + `prova-grade` | web `1c0cf214`, yönetim `30000ffb` | iOS 29 gönderim `d9628cbd` (IPA `a5ad4764…`); tablet 29 `b9q067lwk9`, kaynak `8fb2eef` (IPA `d2d254c6…`) |
| C14c | Enes 18:23Z | **`bba2b01`** | **151, son `20261106450000`** | `prova-generate` v8, `prova-grade` v7, `prova-review` v3 | **web `7f515ca0`, yönetim `d4ebcb30`** | **iOS 30 gönderim `b7ccb6a4` (IPA `7ddc64f9…`); tablet 30 `c4aic5og2w`, kaynak `bba2b01` (IPA `be558e9e…`)** |
| **H08 (güncel)** | Enes 19:51Z (yayın yetkisi) | **`fe08cb60`** | **160, son `20261107000400`** (470000/480000 başka hatta 20:57Z; QT Faz 0 21:58Z) | `delete-account` v18, `apple-token`, `apple-revocation-worker`, `push-send` v17, H02/H07 fonksiyonları | **web `f1adee0b`, yönetim `04c33ac6`** | **iOS 32 gönderim `670700d0` (IPA `ef6e6834…`); tablet 32 `gxt6d74dz6` (IPA `04834182…`)** |

- **Ayarlar:** `question_groups.enabled=true`; `curriculum_catalog.enabled=false`; `content_prereview.enabled=true` (21:04Z, Codex/PR #156, günlük sınır 25); `channels.email.provider` boş (ürün e-postası kapalı).
- **Zamanlanmış işler (son 3 saat, hepsi `succeeded`, 7 Kasım 01:08 TR kontrolü):** `prune-unused-devices` 03:25, `prune-pairing-records` 03:35, `apple-revocation-worker` */15, `content-prereview-drain` */10, `push-send`, `settle-group-attempts`, `source-cleanup`.
- **Canlı sağlık:** `health-check.mjs --strict` temiz, ACL 0, RLS kapalı tablo 0.
- **Alan adı / e-posta** ([STATUS](domain-email-2026-11-06/STATUS.md) esas): `ginafamily.com`, `www`, `admin.ginafamily.com` kurulu; Auth e-postaları `noreply@ginafamily.com` (Brevo SMTP), TR reset gerçek teslimatla doğrulandı; `destek@ginafamily.com` yönlendirmesi Active ve Cloudflare teslim kaydı var; Gmail "GINA Destek" göndericisi kurulu ve INBOX teslimatı doğrulandı. Açık: EN/yeni hesap teslimatı, farklı sağlayıcıya dış teslimat, ürün bildirim kanalı (H04).
- **iOS dağıtım adımları ayrı:** güncel iOS 32 gönderimi `670700d0` (KANITLI). Apple işleme ve test grubu erişimi bu ajanın erişimiyle okunamaz (App Store Connect oturumu yok); cihaza kurulum C15.
- **Yayındaki uygulama kaynağı ile main farkı:** web, yönetim, iOS/tablet 32 `fe08cb60`'tan derlendi. Main'e sonra giren uygulama kodu yalnız Prova QT Faz 0'dır: `packages/core` (`question-types/*`, `answer-journal.ts`, `answer-receipts.ts`, `index.ts`, `database.types.ts`) ve `apps/mobile/src/app/parent/prova/shared-source.tsx` (structured üyeyi reddeden 2 satır). Bunlar **hiçbir istemci derlemesinde yok**; yalnız Faz 0 migration'ları üretimde. Diğer farklar test (066/069/116 vb.) ve belgedir.

## Güncel kalan işler (H00–H08)

| Kart | Durum | Kanıt | Sorumlu |
|---|---|---|---|
| H00 kayıt uzlaştırması | KABUL TAMAM | bu dosya, C14c planı (YAYINDA), ekran matrisi D11-K1/K2 → D12, D19 raporu main'de | Claude |
| H01 Apple hesap silme / belirteç iptali | YAYINDA (H08) / gerçek Apple kabulü AÇIK | Apple girişi üretimde açık (app.json, c06 config diff). Şifreli belirteç saklama, kalıcı iptal işi + worker, Apple ile yeniden doğrulama; pgTAP 131 64/64, Deno 46/46 ([h01](h01-2026-11-06/README.md)). Apple sırları yokken silme engellenmez, iş `token_unavailable` (elle) kaydedilir | Claude; Apple sırları + gerçek cihaz kabulü Enes |
| H02 MEB kaynağını panelden indirme/çıkarma | YAYINDA (H08) / gerçek yönetici kabulü AÇIK | Boş katalogdan ilk indirme, sürüm bazlı sunucu çıkarımı (Deno, Python ile 16/16 dosyada bayt bayt aynı), kilit, yeniden deneme; izole zincir 31/31 + UI 12/12, pgTAP 132 ([h02](h02-2026-11-06/README.md)). Yalnız taslak; genel katalog kapalı | Claude; gerçek yönetici oturumuyla tek ders kabulü Enes |
| H03 insan incelemesi paketi | KOD HAZIR (betik; uygulamaya gitmez) / içerik paketi ve onayı AÇIK | Taşınabilir paket (tam kök, ortak kaynak, gömülü görsel, rubrik, kaynak izi), pilot paketi temizlikten önce dışa aktarıyor; izole 16/16 ve pilot 76/76 ([h03](h03-2026-11-06/README.md)). D15 soru kökleri kurtarılamadı (temizlikte silindi); tam paket için yeni pilot (1 ücretli çağrı) Enes onayı ister. İçerik onayı yapılmadı | Claude; yeni pilot ve içerik onayı Enes |
| H04 hesap ve ürün e-postası kabulü | YAYINDA (H08) / gerçek teslimat AÇIK, ürün kanalı KAPALI | Şablon denetimi (TR/EN), süresi dolmuş/kullanılmış bağlantı ekranı, SMTP çift gönderim ve makbuz düzeltmeleri, hesap dili, kanal nabzı; pgTAP 134, Deno, core 470 ([h04](h04-2026-11-06/README.md)). Ürün kanalı sağlayıcısı kapalı kalır | Claude; gerçek teslimat, ürün SMTP sırları ve kanal açma Enes |
| H05 satın alma AI notu, fotoğraf saklama metni | YAYINDA (H08, web + 32) / cihaz AÇIK | `subscription.aiConsentNote` TR/EN, Playwright 4/4 (390/768); dosya yaşam döngüsü koddan doğrulandı, üretimde `source-cleanup` cron (43 * * * *) etkin; hukuk taslakları TR/EN güncel ([h05](h05-2026-11-06/README.md)). Yayın H08 | Claude; özel hukuk kopyaları + avukat Enes |
| H06 görsel/etkileşim kabul boşlukları | YAYINDA (H08, web + 32) / cihaz AÇIK | groups ve question-media pencereleri ölçüldü (azaltılmış 0/6, normal 5–6/6); değişen ekranlar 4 ölçüde 16/16; H06-1, H06-2 düzeltildi; C15 cihaz listesi 18 satır ([h06](h06-2026-11-06/README.md), [C15](h06-2026-11-06/C15-DEVICE-CHECKLIST.md)) | Claude; fiziksel cihaz Enes |
| H07 AI ön inceleme | YAYINDA ve AÇIK | Kapı 21:04Z'de Codex ile açıldı (`verify_jwt=false`, günlük sınır 25). 01:08 TR sağlık okuması: cron etkin, 24 saatte 1 çağrı (`needs_admin`), uyarı 0, bitmemiş çağrı 0, sağlayıcı duraklaması yok. Kalite kalibrasyonu Codex işi | Claude (kod), Codex/Enes (işletim) |
| H08 regresyon, düzeltme yayını, rapor | YAYINDA | [h08](h08-2026-11-06/README.md): regresyon temiz, migration → Edge → web/yönetim → iOS/tablet 32; canlı sentetik smoke: şifreli hesap silme 6/6, süresi dolmuş bağlantı ekranı doğru | Claude |

Kütüphane içerik üretimi/onayı ve 3B dünya Claude'un açık işi değildir (aşağıda yalnız bilgi).

## Açık kabul kalemleri (kapatılmadı)

### A. Ajanın mevcut erişimle yapabildikleri (7 Kasım 01:08 TR'de yapıldı)

| Kalem | Sonuç |
|---|---|
| Üretim zamanlanmış işleri | Son 3 saatte tüm işler `succeeded` (Apple iptal işçisi dahil; Apple sırrı yokken iş bulmuyor) |
| AI ön inceleme sağlığı | `content_prereview_health()`: uyarı 0, 1 çağrı, kota 24 kaldı |
| H01 şifreli hesap regresyonu (canlı) | Sentetik hesap: yanlış parola 403, doğru parola 200, Apple işi yok, kullanıcı ve aile üyeliği silindi ([live-smoke.json](h08-2026-11-06/live-smoke.json)) |
| H04 süresi dolmuş bağlantı ekranı (canlı web) | https://ginafamily.com/auth-callback#…otp_expired → "This link has expired or was already used" + yeniden gönderme formu |
| Web/yönetim/tablet sürümü, sağlık | hash ve alias doğrulandı; `health-check --strict` temiz |

Ajanın yapamadıkları ve nedeni: gelen kutusu okunamıyor (e-posta teslimatı), App Store Connect yok, yönetici oturumu açılamıyor (sentetik geçici yönetici izin kuralınca reddedildi).

### B. Oturum / kurulum bekleyenler

| Kalem | Gereken | Sonra kim doğrular |
|---|---|---|
| iOS 32 Apple işleme ve test grubu erişimi | App Store Connect oturumu | Enes bakar; ekran görüntüsü yeter |
| Apple belirteç iptali (H01) | Edge sırları (`APPLE_TEAM_ID`, `APPLE_SIGNIN_KEY_ID`, `APPLE_SIGNIN_PRIVATE_KEY`, `APPLE_SERVICES_ID`, `APPLE_TOKEN_ENCRYPTION_KEY`, `APPLE_REVOCATION_SECRET`) + Vault `apple_revocation_secret` | Kurulunca ajan iş tablosunu ve işçi sonucunu okur |
| MEB panel akışı (H02) | Enes'in yönetici oturumu (yönetimde "İlk indirme" → "Adayları çıkar") | Ajan sonrasında kayıtları (kaynak, revizyon, aday sayısı, `draft`) doğrular |
| Ürün bildirim e-postası (H04) | Ürün SMTP sırları + `channels.email.provider='smtp'` kararı | Ajan kuyruk/makbuz kayıtlarını okur; teslimatı Enes görür |
| Auth e-postası EN / yeni hesap / farklı sağlayıcı | Enes'in okuyabildiği bir test gelen kutusu | Ajan tetikler (`scripts/h04-auth-email-trigger.sh`), Enes gelen kutusunu teyit eder |

### C. Fiziksel cihaz / insan kararı gerekenler

| Kalem | Neden |
|---|---|
| C15 fiziksel cihaz (18 madde, [liste](h06-2026-11-06/C15-DEVICE-CHECKLIST.md)) | Pencil, VoiceOver, yazı boyutu, döndürme, push, Apple/Google girişi |
| Apple ile hesap silme uçtan uca | Gerçek Apple hesabı + iPhone Ayarlar kontrolü |
| H03 tam inceleme paketi | Yeni pilot (1 ücretli çağrı) onayı ve insan içerik onayı |
| Barındırılan tam geri yükleme / PITR | Ayrı ortam ve maliyet kararı |
| Hukuk metinlerinin yayını | Avukat incelemesi; rıza modeli |

## Prova yeni soru türleri (ayrı thread)

Faz 0 = yalnız veri sözleşmesi, puanlama ve RPC altyapısı; **kullanıcı özelliği olarak tamamlanmış sayılmaz.** Üretimde yalnız migration `20261107000000`–`000400`. Çocuk ekranı, veli incelemesi, AI üretim şemaları, gönderim/uyumluluk ve PDF ([QT PROGRESS](qt-2026-11-07/PROGRESS.md)) Prova thread'inin dalında; main'de ve yayında değil.

## 1. Kodda tamam ve canlıda, kabul kanıtı tam (tarihsel, sorumlu Claude)

| İş | Kanıt |
|---|---|
| C00 envanter | continuation PROGRESS §C00 |
| C03 geri gönderme nedeni | C14; izole + canlı smoke |
| C05 kaynak çıkarımı | D15 pilotunda hosted indirme, hash, kova, çıkarım canlı geçti |
| C07 rol matrisi | pgTAP 113; C14 |
| C08 AI yönlendirme (Anthropic) | D5, C14b, C14c gerçek çağrılar |
| C13 AUTH-1 eşleme kaba kuvvet koruması | `20261106340000`, C14 |
| C14 / C14b / C14c ara yayınları | yukarıdaki tablo; `c14*-2026-11-06/PLAN.md` yürütme kayıtları |
| D1 AI ortak kaynak grupları | C14b canlı: gerçek grup kuruldu |
| D3 operatör kapsamı, kanal hataları | C14b |
| D5 gerçek AI kabulü | d5, c14b/ai |
| D6 puanlama düzeltmesi (B1) | C14b canlı 200 + `accept_ai_grade` |
| D7 içerik operatörü taslak kabulü | C14b |
| D9 ortak metin puanlama, rubrik 100 | C14b canlı |
| D11 yönetim P2 düzeltmeleri | C14c |
| D12 aile süzgeci, denetimde yönetici adı | C14c |
| D13 amaca göre puanlama | C14c canlı: yalnız sonuç 95, süreç 60 |
| D15 MEB gerçek kabul zinciri | Canlı: resmî kaynak → yayın → pilot kapsamı → gerçek üretim (6 soru, 2/1/1/1/1, tam iz) → atama → geri çekme; 1 ücretli çağrı; temizlik doğrulandı ([§6](d15-2026-11-06/README.md)) |
| D17 eşleme saklama işleri | C14c: iki pg_cron işi etkin |
| X01'in alan adı ve hesap e-postası kısmı | Türkçe şifre sıfırlama gerçek teslimatla doğrulandı (Codex, PR #151/#152) |

## 2. Canlıda, fiziksel cihaz testi bekliyor (C15 — sorumlu Enes; hata gelirse Claude)

| İş | Cihazda bakılacak |
|---|---|
| C01 köken etiketleri | veli telefonu/tablet görünümü |
| C02 ders bağı, tarihli görünümler | ana ekran, çocuk Bugün, takvim |
| C04 Prova merkezi | Hazırla / Gönderilenler / İncelenecekler akışı |
| C06 tek eşleme yolu, D2 PIN'siz çocuk modu ve eşleme onayı | gerçek tablet eşleme, yeniden açılış, red |
| C12 ekran incelemesi | VoiceOver/TalkBack, yazı boyutu, güvenli alan, kalem, yön |
| D4/D8 PDF yazı tipi | fiziksel iPhone/iPad ve Android PDF metin katmanı |
| D10 kişi adı uyarısı, D14 AI sorusunu düzenleme | telefon 390 px ve tablet düzeni |
| D15 protokol testi 7 | veli/çocuk ekranında senaryo, defter, rubrik okunabilirliği |
| Bildirim, gerçek OAuth girişi | push teslimi; Google/Apple giriş dönüş adresleri |
| İngilizce hesap e-postası ve yeni hesap doğrulaması | gerçek teslimat |

Üretilen MEB pilot sorularının alan/dil uygunluğu insan incelemesi olmadan kabul sayılmaz.

## 3. Kodda tamam, yalnız belge düzeyinde (uygulamaya gitmez; hukuk onayı Enes/avukat)

| İş | Durum |
|---|---|
| D16/D18/D19 hukuk metinleri | 10 belgenin hepsi TR + EN; 16 iç tutarsızlıktan 15'i koddan çözüldü; alan adı yer tutucuları dolduruldu. Yayın hukuk onayına bağlı (X03). Açık Rıza A modeli (tek rıza mı, işlem bazlı onay mı) avukat kararı |
| Kapanış tablosu | bu dosya |

## 4. Dış bağımlılık nedeniyle kapalı (DIŞ ENGEL)

| Kimlik | Ne kapalı | Gereken |
|---|---|---|
| X01 (kalan kısım) | ürün bildirim e-postaları (C10), EN/yeni hesap ve farklı sağlayıcı teslimat kabulü | Destek yönlendirmesi ve Gmail göndericisi kurulu (domain-email STATUS, PR #153/#154); kalan gerçek kanal testleri H04 |
| X02 Firebase / Play / SMS | Android iç test, SMS kanalı | hesaplar |
| X03 mağaza ve hukuk onayı | satış, mağaza başvurusu, hukuk metinlerinin yayını | hukuk uzmanı incelemesi; yasal kimlik/adres. Bireysel geliştirici olarak başlanır, şirket kurulması ön şart değil |
| X04 OpenAI / Gemini | ek AI sağlayıcıları (C08) | anahtarlar |
| X06 bağımsız editör | Ayrı kütüphane içerik operasyonu; Claude devri dışında | Kullanıcının backoffice içerik süreci |

## 5. Ertelenenler ve kapsam dışı (tamamlanmış sayılmaz)

| İş | Neden / ne zaman |
|---|---|
| C13 barındırılan ortamda tam geri yükleme / PITR tatbikatı | ertelenmiş kabul işi; ayrı ortam/maliyet/erişim kararı (Enes); üretimin üzerine restore yok |
| C09 AI ön inceleme kapısı | Açık (Codex, 21:04Z); kalite kalibrasyonu ve yanlış onay ölçümü Codex/Enes |
| Apple ile Giriş belirteç iptali | Kod yayında (H01); sırlar ve gerçek kabul yukarıda B/C |
| Satın alma ekranında AI onayı cümlesi | Yayında (H05) |
| Veli rubriğinde "sonuç / süreç" seçici | migration gerekir; şimdilik sorudan çıkarım |
| D11 K3/K4/K5 yönetim kararları | DECISIONS.md |
| K01 kütüphane üretimi | Claude kapsamı dışında; kullanıcı backoffice üzerinden yürütecek. Tarihsel sayılar ilerleme kanıtı olarak korunur. |
| R02 eski son yayın sırası | Bu Claude teslimini bağlamaz. H08 düzeltme yayını K01/WORLD-01 beklemez; mağaza satışı dış kabul kapılarına bağlıdır. |
| WORLD-01 3B dünya | Claude kapsamı dışında; kullanıcı + Codex ile ayrı çalışma |
