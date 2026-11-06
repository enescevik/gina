# GINA — tek güncel kapanış tablosu

6 Kasım 2026, ~20:10 (UTC), H00 uzlaştırması. Bu tablo `continuation-2026-11-06/PROGRESS.md`, `overnight-2026-11-06/PROGRESS.md` ve C/D raporlarındaki durum sütunlarının **yerini alır**. Eski tablolardaki "KOD HAZIR / yayımlanmadı" ifadeleri tarihseldir. Son kapsam kararı: Kütüphane içerik üretimi backoffice üzerinden kullanıcı tarafından, 3B dünya kullanıcı + Codex tarafından ayrı yürütülecek. İkisi de Claude devrinin dışındadır. Güncel kalan işlerin öncelik ve kabul ölçütleri: [H00–H08](../CLAUDE-REMAINING-WORK.md).

## Son yayınlar

| Yayın | Onay | Kaynak commit | DB (ledger) | Edge | Web / yönetim | Mobil |
|---|---|---|---|---|---|---|
| C14 | Enes 16:01Z | `c16b8b1` | 141, son `20261106340000` | 24 fonksiyon | web `a31715be`, yönetim `b1cd107a` | iOS 28 gönderim `8f37781c` (IPA `9e2dbc10…`); tablet 28 `m8aeavsrur` (IPA `116a7fad…`) |
| C14b | Enes 15:38Z | `b04207c`; `prova-grade` ek düzeltme `8fb2eef` | 146, son `20261106390000` | 8 + `prova-grade` | web `1c0cf214`, yönetim `30000ffb` | iOS 29 gönderim `d9628cbd` (IPA `a5ad4764…`); tablet 29 `b9q067lwk9`, kaynak `8fb2eef` (IPA `d2d254c6…`) |
| **C14c (güncel)** | Enes 18:23Z | **`bba2b01`** | **151, son `20261106450000`** | `prova-generate` v8, `prova-grade` v7, `prova-review` v3 | **web `7f515ca0`, yönetim `d4ebcb30`** | **iOS 30 gönderim `b7ccb6a4` (IPA `7ddc64f9…`); tablet 30 `c4aic5og2w`, kaynak `bba2b01` (IPA `be558e9e…`)** |

- **Ayarlar:** `question_groups.enabled=true`; `curriculum_catalog.enabled=false`; `content_prereview.enabled=false`.
- **Zamanlanmış işler:** pg_cron `prune-unused-devices` 03:25 UTC, `prune-pairing-records` 03:35 UTC.
- **Canlı sağlık:** `health-check.mjs --strict` temiz, ACL 0, RLS kapalı tablo 0.
- **Alan adı / e-posta** ([STATUS](domain-email-2026-11-06/STATUS.md) esas): `ginafamily.com`, `www`, `admin.ginafamily.com` kurulu; Auth e-postaları `noreply@ginafamily.com` (Brevo SMTP), TR reset gerçek teslimatla doğrulandı; `destek@ginafamily.com` yönlendirmesi Active ve Cloudflare teslim kaydı var; Gmail "GINA Destek" göndericisi kurulu ve INBOX teslimatı doğrulandı. Açık: EN/yeni hesap teslimatı, farklı sağlayıcıya dış teslimat, ürün bildirim kanalı (H04).
- **iOS dağıtım adımları ayrı:** 30 için gönderim `b7ccb6a4` yapıldı (KANITLI); Apple işleme ve test grubu erişimi bu oturumdan doğrulanamadı (App Store Connect erişimi yok; sorumlu Enes); cihaza kurulum yok (C15). Enes 27'nin TestFlight'a geldiğini 6 Kasım'da teyit etti.
- **Main:** bu yayınların ötesinde yalnız belge değişiklikleri var (D18/D19 hukuk metinleri, alan adı uzlaştırması, raporlar). Uygulamaya giden kod yok.

## Güncel kalan işler (H00–H08)

| Kart | Durum | Kanıt | Sorumlu |
|---|---|---|---|
| H00 kayıt uzlaştırması | KABUL TAMAM | bu dosya, C14c planı (YAYINDA), ekran matrisi D11-K1/K2 → D12, D19 raporu main'de | Claude |
| H01 Apple hesap silme / belirteç iptali | YAPILIYOR | — | Claude; gerçek Apple kabulü Enes (Apple hesabı) |
| H02 MEB kaynağını panelden indirme/çıkarma | YAPILIYOR | — | Claude |
| H03 insan incelemesi paketi | KOD HAZIR (main) / AÇIK (içerik) | Taşınabilir paket (tam kök, ortak kaynak, gömülü görsel, rubrik, kaynak izi), pilot paketi temizlikten önce dışa aktarıyor; izole 16/16 ve pilot 76/76 ([h03](h03-2026-11-06/README.md)). D15 soru kökleri kurtarılamadı (temizlikte silindi); tam paket için yeni pilot (1 ücretli çağrı) Enes onayı ister. İçerik onayı yapılmadı | Claude; yeni pilot ve içerik onayı Enes |
| H04 hesap ve ürün e-postası kabulü | YAPILIYOR | Auth TR reset + destek yönlendirme/gönderici STATUS'ta | Claude hazırlık; gerçek teslimat Enes |
| H05 satın alma AI notu, fotoğraf saklama metni | KOD HAZIR (main) | `subscription.aiConsentNote` TR/EN, Playwright 4/4 (390/768); dosya yaşam döngüsü koddan doğrulandı, üretimde `source-cleanup` cron (43 * * * *) etkin; hukuk taslakları TR/EN güncel ([h05](h05-2026-11-06/README.md)). Yayın H08 | Claude; özel hukuk kopyaları + avukat Enes |
| H06 görsel/etkileşim kabul boşlukları | AÇIK | H01–H05 sonrasına | Claude; fiziksel cihaz Enes |
| H07 AI ön inceleme işletim hazırlığı | YAPILIYOR | kapı kapalı kalır | Claude; aktivasyon kararı Enes |
| H08 regresyon, düzeltme yayını, rapor | AÇIK | son | Claude |

Kütüphane içerik üretimi/onayı ve 3B dünya Claude'un açık işi değildir (aşağıda yalnız bilgi).

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
| C09 AI ön inceleme kapısı | teknik hazırlık H07; aktivasyon ayrı karar (Enes) |
| Apple ile Giriş belirteç iptali | H01'de yapılıyor |
| Satın alma ekranında AI onayı cümlesi | H05'te yapılıyor |
| Veli rubriğinde "sonuç / süreç" seçici | migration gerekir; şimdilik sorudan çıkarım |
| D11 K3/K4/K5 yönetim kararları | DECISIONS.md |
| K01 kütüphane üretimi | Claude kapsamı dışında; kullanıcı backoffice üzerinden yürütecek. Tarihsel sayılar ilerleme kanıtı olarak korunur. |
| R02 eski son yayın sırası | Bu Claude teslimini bağlamaz. H08 düzeltme yayını K01/WORLD-01 beklemez; mağaza satışı dış kabul kapılarına bağlıdır. |
| WORLD-01 3B dünya | Claude kapsamı dışında; kullanıcı + Codex ile ayrı çalışma |
