# GINA — tek güncel kapanış tablosu

6 Kasım 2026, ~19:45 (UTC). Bu tablo `continuation-2026-11-06/PROGRESS.md`, `overnight-2026-11-06/PROGRESS.md` ve C/D raporlarındaki durum sütunlarının **yerini alır**. Eski tablolardaki "KOD HAZIR / yayımlanmadı" ifadeleri tarihseldir. Son kapsam kararı: Kütüphane içerik üretimi backoffice üzerinden kullanıcı tarafından, 3B dünya kullanıcı + Codex tarafından ayrı yürütülecek. İkisi de Claude devrinin dışındadır. Güncel kalan işlerin öncelik ve kabul ölçütleri: [H00–H08](../CLAUDE-REMAINING-WORK.md).

## Son yayınlar

| Yayın | Onay | Kaynak commit | DB (ledger) | Edge | Web / yönetim | Mobil |
|---|---|---|---|---|---|---|
| C14 | Enes 16:01Z | `c16b8b1` | 141, son `20261106340000` | 24 fonksiyon | web `a31715be`, yönetim `b1cd107a` | iOS 28 gönderim `8f37781c` (IPA `9e2dbc10…`); tablet 28 `m8aeavsrur` (IPA `116a7fad…`) |
| C14b | Enes 15:38Z | `b04207c`; `prova-grade` ek düzeltme `8fb2eef` | 146, son `20261106390000` | 8 + `prova-grade` | web `1c0cf214`, yönetim `30000ffb` | iOS 29 gönderim `d9628cbd` (IPA `a5ad4764…`); tablet 29 `b9q067lwk9`, kaynak `8fb2eef` (IPA `d2d254c6…`) |
| **C14c (güncel)** | Enes 18:23Z | **`bba2b01`** | **151, son `20261106450000`** | `prova-generate` v8, `prova-grade` v7, `prova-review` v3 | **web `7f515ca0`, yönetim `d4ebcb30`** | **iOS 30 gönderim `b7ccb6a4` (IPA `7ddc64f9…`); tablet 30 `c4aic5og2w`, kaynak `bba2b01` (IPA `be558e9e…`)** |

- **Ayarlar:** `question_groups.enabled=true`; `curriculum_catalog.enabled=false`; `content_prereview.enabled=false`.
- **Zamanlanmış işler:** pg_cron `prune-unused-devices` 03:25 UTC, `prune-pairing-records` 03:35 UTC.
- **Canlı sağlık:** `health-check.mjs --strict` temiz, ACL 0, RLS kapalı tablo 0.
- **Alan adı:** `ginafamily.com` ve `admin.ginafamily.com` kurulu; hesap e-postaları `noreply@ginafamily.com` (Brevo SMTP) üzerinden gidiyor ([kayıt](domain-email-2026-11-06/STATUS.md)).
- **iOS:** gönderim TestFlight'a yüklendiğini gösterir; Apple işlemesi ve cihaza kurulum ayrı adımlardır.
- **Main:** bu yayınların ötesinde yalnız belge değişiklikleri var (D18/D19 hukuk metinleri, alan adı uzlaştırması, raporlar). Uygulamaya giden kod yok.

## 1. Kodda tamam ve canlıda, kabul kanıtı tam

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

## 2. Canlıda, fiziksel cihaz testi bekliyor (C15 — Enes)

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

## 3. Kodda tamam, yalnız belge düzeyinde (uygulamaya gitmez)

| İş | Durum |
|---|---|
| D16/D18/D19 hukuk metinleri | 10 belgenin hepsi TR + EN; 16 iç tutarsızlıktan 15'i koddan çözüldü; alan adı yer tutucuları dolduruldu. Yayın hukuk onayına bağlı (X03). Açık Rıza A modeli (tek rıza mı, işlem bazlı onay mı) avukat kararı |
| Kapanış tablosu | bu dosya |

## 4. Dış bağımlılık nedeniyle kapalı

| Kimlik | Ne kapalı | Gereken |
|---|---|---|
| X01 (kalan kısım) | ürün bildirim e-postaları (C10), EN/yeni hesap ve farklı sağlayıcı teslimat kabulü | Destek yönlendirmesi ve Gmail göndericisi kurulu (domain-email STATUS, PR #153/#154); kalan gerçek kanal testleri H04 |
| X02 Firebase / Play / SMS | Android iç test, SMS kanalı | hesaplar |
| X03 mağaza ve hukuk onayı | satış, mağaza başvurusu, hukuk metinlerinin yayını | hukuk uzmanı incelemesi; yasal kimlik/adres. Bireysel geliştirici olarak başlanır, şirket kurulması ön şart değil |
| X04 OpenAI / Gemini | ek AI sağlayıcıları (C08) | anahtarlar |
| X06 bağımsız editör | Ayrı kütüphane içerik operasyonu; Claude devri dışında | Kullanıcının backoffice içerik süreci |

## 5. Bilerek ertelenenler (tamamlanmış sayılmaz)

| İş | Neden / ne zaman |
|---|---|
| C13 barındırılan ortamda tam geri yükleme / PITR tatbikatı | ertelenmiş kabul işi; ayrı proje ve maliyet kararı |
| C09 AI ön inceleme kapısı | kütüphaneden (K01) önce açılacak: sır + pg_cron + pilot |
| Apple ile Giriş belirteç iptali | Apple girişi açılmadan `delete-account` içine eklenmeli (App Store 5.1.1(v)) |
| Satın alma ekranında AI onayı cümlesi | satış açılmadan önce küçük metin işi |
| Veli rubriğinde "sonuç / süreç" seçici | migration gerekir; şimdilik sorudan çıkarım |
| D11 K3/K4/K5 yönetim kararları | DECISIONS.md |
| K01 kütüphane üretimi | Claude kapsamı dışında; kullanıcı backoffice üzerinden yürütecek. Tarihsel sayılar ilerleme kanıtı olarak korunur. |
| R02 eski son yayın sırası | Bu Claude teslimini bağlamaz. H08 düzeltme yayını K01/WORLD-01 beklemez; mağaza satışı dış kabul kapılarına bağlıdır. |
| WORLD-01 3B dünya | Claude kapsamı dışında; kullanıcı + Codex ile ayrı çalışma |
