# Devam kaydı — 6 Kasım 2026 (C00–C15)

Saatler Europe/Istanbul. Koordinatör: Claude (oturum modeli claude-opus-5-5; alt ajanlar Opus). Plan: [CLAUDE-REMAINING-WORK §4A](../../CLAUDE-REMAINING-WORK.md). Taban: main `0131229`.

## C00 — durum uzlaştırma (12:25)

**Kaynak:** main = origin/main (`0131229`); açık PR yok; kirli dosya yalnız izlenmeyen `packages/assets/fonts/` (kararla repoya alınmıyor) ve `.claude/` (ajan worktree'leri).

**Migration sayısı (20/22 farkı):** Sabah kaydı "22 yeni migration" dedi; doğru sayı **20 yayımlanmamış 6 Kasım migration'ı**. 22, R01 ile 5 Kasım 23:12'de üretime uygulanmış `20261105180000` ve `20261105190000`'ı da sayıyordu (dosya adı glob'u ile sayıldı, ledger ile karşılaştırılmadı — hata).

**Canlı ledger karşılaştırması** (Management API, salt okunur): repo 128 dosya, üretim 108 kayıt; repo dışı canlı kayıt yok.

| Aralık | Durum |
|---|---|
| ≤ `20261105072000` (106 dosya) | UYGULANDI. 80 tanesinde ledger'daki `statements` birleşimi dosya metninden farklı: CLI ifadeleri bölerek sakladığı için biçim farkı olması muhtemel; **içerik eşitliği bu karşılaştırmayla doğrulanamadı** (bilinmiyor). |
| `20261105180000`, `20261105190000` | UYGULANDI, hash aynı (R01). |
| `20261106010000` … `20261106210000` (20 dosya; `190000` numarası boş) | **UYGULANMADI.** |

**Sürüm tablosu**

| Hedef | Durum | Kanıt |
|---|---|---|
| Üretim DB | 108 migration (R01 dahil) | Ledger okuması |
| Veli webi | R01 kaynağı yayında (5 Kasım 23:31) | `gina-web.pages.dev`; Actions deploy işleri sonraki commit'lerde secret yok → atlandı, **yayın değil** |
| Yönetim | 5 Kasım yayını; gece değişiklikleri yayımlanmadı | — |
| iOS 0.1.0 (27) | EAS submit `finished`; Apple işledi; TestFlight'ta erişilebilir | Kullanıcı 6 Kasım 12:24'te TestFlight'tan kurduğunu bildirdi (fiziksel cihaz). Özellik kabul testi (C15) ayrı. |
| Tablet 0.1.0 (27) | Canlı `release.json` build 27, IPA SHA-256 `12cb54ee…` | Fiziksel kurulum yapılmadı |
| Gece kapsamı (20 migration + istemciler) | Main'de, **yayımlanmadı** | C14 |

**Dış bağımlılıklar:** X01 alan adı/SMTP — BEKLİYOR (canlıya alırken); X02 Firebase/Play/SMS — BEKLİYOR; X03 işletme/hukuk/mağaza — BEKLİYOR; X04 ek AI sağlayıcı anahtarları — BEKLİYOR; X05 fiziksel cihaz — kullanıcı; X06 bağımsız editör — E01 AI ön inceleme + yönetici onayı (6 Kasım kararı), bağımsız editör ayrı kademe.

## Kart durumları

| Kart | Durum | Not |
|---|---|---|
| C00 | TAMAM (okuma) | Bu bölüm |
| C01 | KOD HAZIR — sunucu + UI; yayın ve cihaz kabulü açık | Sunucu `b8bef9e` + UI takibi. Köken etiketleri (okul onayı / çalışma / veli / kişiselleştirilmiş; resmî doğrulama ayrı satır), veli eski sıfır düzeltme ekranı (önizleme→uygula→kayıp yanıtta aynı istek→denetim izi), resmî doğrulama işletim paneli (yazma yalnız service_role komutuyla), arşivli etkinlik mesajı. Playwright 11/11. **Açık:** yönetici adına düzeltme ekranı; Prova seçici/listede köken etiketi; fiziksel/üretim. |
| C02 | KOD HAZIR — izole test edildi; fiziksel kabul C15 | Main `0c8297e`. Sunucuda veli onaylı ders bağı (`child_subject_links`, `subject_id` sunucu tarafından yazılır), ana ekran/çocuk Bugün/takvim/görevler aynı tarihli okuma (`plan_for_days`, `routines_for_day`), geçmişte bilinmeyen program doldurulmaz, rutin ileri tarih seçici açık; planlı eğitim geçişi + 14 gün geri alma; elle eklenen ödevlerde toplu yeniden dağıtım. pgTAP 109 149/149, Playwright 12/12 + U05 regresyon 12/12. **Yayın notu:** migration bu istemciyle birlikte çıkmalı. **Açık:** planlı geçiş açılışta uygulanır (cron yok), Prova `subject` metninin kanonik kimliğe bağlanması (C04/P02). |
| C03 | KOD HAZIR — izole test edildi | Main `46f163e`. Geri gönderme nedeni (6 TR/EN seçenek + 140 karakter not; iki veli ve çocuk cihazı aynı, kardeş/yabancı göremez; çocukta sakin sonraki adım), eski 4 argümanlı çağrı uyumlu, çift dokunuş tek istek, eski kopya `already_reviewed`; takvim/Prova taslağı/çalışma planı/çanta toplu seçim (atanmış Prova korunur, "Listelenen N kaydı seç"); haftalık öneriden görev formu ön doldurma; yardım eki ve yanıt takibi; gerçek Storage/Edge ile kaynak/hesap silme yolu (signed URL kurcalama reddi, paylaşılan dosya kalır, eski önizleme 409). İzole 355/355, Playwright 11/11. **Açık:** haftalık öneri ön doldurma UI'da AI hazır hâliyle görülmedi; yardım görsel eki UI akışı; yönetimde ek görüntüleme; hosted Edge/Storage ve cihaz. |
| C04 | KOD HAZIR — izole zincir kanıtlı; gerçek AI BEKLİYOR (C08) | Main `5ec58eb`. Prova merkezi Hazırla/Gönderilenler/İncelenecekler; eski girişler taslağa; taslak bağlamı (ders/karma, MEB/LGS/serbest, dönem, okul beyanı) gönderimde `exams`'e donar; kısmi/tam AI tamamlama, "tümünü seç" ek ücret yok; alternatif cevap + rubrik; incelemede gerekçe ve AI≠veli etiketi. Zincir: kütüphane+ortak görselli 2 soru+elle+AI → kaydet/aç → ata → çocuk çöz (açık uçlu bekliyor/cevap yok, 0 yok) → veli incele → gelişim; Playwright 17/17, Deno 419. **Açık (C04b):** sunucuda `apply_ai_grades` AI puanını hâlâ `score`'a yazıyor (kart gereği ayrılmalı); AI `shared_sources` soru grubuna dönüşmüyor; dönem uyuşmazlığı soru düzeyinde değil; native PDF yolu; erişilebilirlik. |
| C05 | KOD HAZIR — izole zincir kanıtlı; gerçek AI BEKLİYOR (C08/C14) | Main `ea09f96`. Kaynak hedefleri, çıkarım kuyruğu `--process-queue`, onaysız kaynakta yayın reddi, `get_curriculum_source_status` (yerine koyma yok, stale), soru başına gerekçeli uygunluk incelemesi. Gerçek edge-runtime ile resmî indirme (turkce2.xlsx, hash manifestle aynı) → 46 aday → yayın → aile seçimi → deterministik 6 soru blok eşleşmesi; DNS/SSRF fail-closed. Zincir 39/39, pgTAP 4.102/0. **Açık:** hosted DNS tek çağrı doğrulaması (C14 sonrası), veli uygunluk inceleme ekranı (C04), çıkarım zamanlanmış değil, gerçek AI içerik kalitesi. |
| C06 | KOD HAZIR — izole test edildi; fiziksel kabul C15 | Main `2925682`. Tek eşleme yolu + hedef önizleme (`preview_device_pairing`), QR kodu girişte 10 dk korunur, veli çıkış PIN'i ortak `PinEntry` + sunucu kilidi (5 yanlış/60 sn), iptal nedeni. Üretim dönüş adresleri salt okunur doğrulandı (hepsi listede). Playwright 16/16, pgTAP 4.034/0. **Açık:** eşleme kodu deneme sınırı yok; çocuk modunda PIN'siz çocuk istemci farkı; hedef kartı metni; gerçek OAuth/kamera/e-posta (C15/X01). |
| C07 | KOD HAZIR — izole test edildi | Main `377f75a`. Rol matrisi (destek/içerik/finans/yayın kendi kuyruğu; tam yönetici veya `/families` açılmadı; 24 admin RPC'si rol kontrolüne geçti), sorumlusuz=`assignee_id is null`, TR/EN sürümlü hazır yanıtlar, `/billing` ve içerik listesi keyset sayfalama, push hedef sayısı, tablet düzeni; mobil P05 hak özeti, politika önizlemesi, ret→düzeltme zinciri, grup aşamaları. pgTAP 113 191/191, backoffice Playwright 13/13, mobil 8/8. **Açık:** soru bazlı ret notu (sunucu alanı yok), görselli düzeltme Edge/Storage yolu, sonraki migration'ların rol kontrolünü geri almama kuralı (pgTAP 113 yakalar). |
| C08 | KOD HAZIR — gerçek Anthropic sözleşme testi BEKLİYOR; OpenAI/Gemini X04 | Main (C08 merge). Sağlayıcıyı taşıyan işler, sağlayıcı başına devre kesici, `reserve_*` model desteğine bağlı; `get_ai_usage()` + mobil kullanım kartı; `check_input_range` tetikleyicileri; **AI puanı yalnız `ai_score` (öneri), kesin puan veli onayıyla (`accept_ai_grade`)**; tüm AI uçları `fail()`/`parentOrResponse`; gövdesiz 401'de tek yenileme + tek tekrar. pgTAP 115 66/66, izole servis 379/379, Playwright 7/7. **Açık:** gerçek Anthropic çağrısı (GINA anahtarı izole Edge'e verilmedi), `daily_tips` ürün kararı (DECISIONS'ta Pro vaadi var, ekran/kod vaat etmiyor → şimdilik sunulmuyor), hosted 401 ve cihaz (C15). |
| C09 | KOD HAZIR — gerçek model pilotu BEKLİYOR; kapı kapalı | Main (C09 merge). C08 yönlendirmesi, sağlayıcı başına devre kesici, görselli kayıt asla `ai_approved` olmaz (`media_not_reviewed`), eski/geri çekilmiş kaynaktan aday modele gitmez, aile dışı operatöre kalıcı bildirim, yapılandırma kaynaklı bekleyenlerin açık yeniden kuyruğu, 10 dk pg_cron drain (kapı kapalıyken istek yok), aday kaynak rozetleri; pilot seti + tek komut (`DEPLOY.md` adım 6). pgTAP 118 83/83, Playwright 9/9, deterministik pilot 9/9. **Enable kararı: kapalı** (gerçek pilot yok, eşik kalibre değil, üretimde Edge/sır/Vault yok). |
| C10 | KOD HAZIR — gerçek kanal kabulü BEKLİYOR (X01/X02) | Main `39223af`. E-posta doğrulama ekranı (deneme/süre/sınır), kanal×amaç tercihleri, rıza kapsamı ve geçmişi, `/verify-contact` (oturumda onaylı), `/unsubscribe` + RFC 8058 one-click POST (tek kullanımlık, GET değiştirmez), doğrulanmamış adres reddi, pazarlama kilitli, aynı adrese tek teslim, okul/bölge operatör kapsamı, en çok 3 yeniden sıraya alma, SMTP STARTTLS düz metne düşmez. pgTAP 4.716/0, Deno 433, Playwright 9/9. **Açık:** üretim env/Edge dağıtımı, push cihaz davranışı, operatör kapsam yönetim ekranı ve `channel-failures` sayfaya bağlanması, Universal/App Link, token'da kullanıcı UUID'si. |
| C11 | KOD HAZIR — mağaza/e-posta/hukuk dış kabulü BEKLİYOR (X01–X03) | Main `0a87406`. Takvim yayın kapısı (düşük güven/gizli/eski kaynak yayımlanamaz; orta güven kayıtlı incelemeyle; okul>il>ülke), tatil önerisi (veli kabul/vazgeç/geri al; program silinmez, sınıf yükseltilmez), tarih dışı planlı geçişte takvim gerekçesi, dönem hatırlatması tek kez, eşanlamlı yönetimi + audit, istemci paket seçiminin kalıcı hak üretmediği (Deno 6 + pgTAP), hukuk envanteri (37 çelişki: 23 düzeltildi) ve kullanıcı rehberleri (`user-guides.md`). pgTAP 117 137/137, Playwright 10/10. **Açık:** tatil `paused` işaretinin takvim/ana ekran/çocuk Bugün'de gösterimi (C12'ye), gizlilik İngilizce bölümü senkron değil, uzman onayı yok. **Önemli hukuk bulgusu:** metinlerdeki "çocuk AI ile etkileşmez" ifadesi eksik — Pro incelemede çocuğun cevabı/defteri AI'a gidiyor; metin düzeltildi, uzman onayı gerekli. |
| C12 | KOD HAZIR — web izole; fiziksel kabul C15 | Main (C12 merge). Tek matris `docs/release/experience-review/SCREEN-REVIEW-MATRIX.md` (86 birim; mobil 62 rota, yönetim 21 sayfa + 5 sekme), 76 mobil ziyaret 4 ölçü + %135 ölçek, yönetim 23 sayfa; 14 yeni bulgu (2 P1 + 9 P2 düzeltildi), eski A2-9/10/11/13, A3-5, B02 kapatıldı; açık P0/P1 yok. Tatil gösterimi (C11 devri), soru bankası şık editörü (JSON yerine), seçim çiplerinde ekran okuyucu durumu, büyük yazıda Prova sekmeleri. **Açık P2:** `/ai` ve `/questions` tarayıcı onay penceresi, kitapçık sınıf alanı serbest metin, pencere solma reduced-motion, giriş odak halkası, A3-4/A3-7; görülemeyen 6 alt akış (T1). |
| C13 | YAYINLANDI (C14) — AUTH-1 `20261106340000` ile kapatıldı; hosted geri yükleme açıkları sürüyor | Main (C13 merge). Yüksek 0, orta 2 (PERF-1 düzeltildi: görev listesi p50 449→31 ms, 42 gün takvim 1732→776 ms; AUTH-1 açık: eşleme kodu deneme sınırı yok), düşük 10 (5 düzeltildi). pgTAP 5.160/0 iki saat dilimi, e2e 404/404, izole 473/473, persona taraması 5.390 çağrı sızıntı 0, geri yükleme tatbikatı (Auth girişi + dosya sha256 + ACL) yerelde geçti. **Hosted açıklar:** PITR/yedek doğrulaması, süper kullanıcısız Auth+Storage geri yükleme, Storage içerik türü, canlı ACL salt okunur kontrolü. |
| C14 | YAYINLANDI — sunucu, Edge, web, yönetim, tablet 28; iOS 28 yüklendi (TestFlight erişimi kullanıcı kontrolü) | Enes onayı 6 Kasım 16:01 ("onay veriyorum"). Plan `docs/release/c14-2026-11-06/PLAN.md`. |
| C15 | AÇIK — kullanıcının 6 maddelik ilk kontrolü C15'in yalnız başlangıcıdır; bağımsız çocuk cihazı, kalem/klavye/yön, erişilebilirlik, gerçek OAuth, bildirim ve servis akışları ayrıca gerekir |
| K01 / R02 / WORLD-01 | BEKLİYOR | Sıra korunur |

## Günlük
| 12:55 | C01 | ajan → main `b8bef9e` | KOD HAZIR | Ayrıntı: `docs/release/c01-2026-11-06/README.md`. Yayın sırası: migration önce, istemci sonra. |
| 13:05 | C06 | ajan → main `2925682` | KOD HAZIR | `docs/release/c06-2026-11-06/README.md`. Kullanıcı adımı: Google/Apple konsolunda callback `https://wixjxlxgyhgdacadsawo.supabase.co/auth/v1/callback` doğrulaması. |
| 13:15 | C05 | ajan → main `ea09f96` | KOD HAZIR | `docs/release/c05-2026-11-06/README.md`. 16 dosya kontrolü 648 aday onayı değildir; 1 dosya uçtan uca. |
| 13:35 | C02 | ajan → main `0c8297e` | KOD HAZIR | Birleşik main: pgTAP 110 dosya / 4.397 kontrol / 0 hata; core 385 test; tsc 0. |
| 13:55 | C04 | ajan → main `5ec58eb` | KOD HAZIR | Birleşik main: pgTAP 111 dosya / 4.444 / 0; core 391 test; tsc 0. |
| 14:20 | C07 + test düzeltmesi | ajan → main `377f75a`; koordinatör `8d5c63b` | KOD HAZIR | 095#99 ve 102#5 kararsız kontroller deterministik yapıldı. Birleşik main: pgTAP 112 dosya / 4.635 / 0; core 391; tsc/lint 0. Çalışan C03/C08/C10 ajanlarına C07 rol kontrolünü koruma notu gönderildi. |
| 14:55 | C10 | ajan → main `39223af` | KOD HAZIR | Birleşik main: core 397 test; mobil/backoffice tsc 0. |
| 15:05 | C01 UI | ajan → main | KOD HAZIR | `docs/release/c01-2026-11-06/README.md` "UI takibi". |
| 15:40 | C08 | ajan → main | KOD HAZIR | Birleşik main: pgTAP 114 dosya / 4.785 / 0; core 404 test; tsc 0. |
| 14:10 | Ürün kararı | koordinatör | KARAR KAYDI | Pro "7 günlük ipucu" ilk sürümde sunulmaz; DECISIONS güncellendi. Hukuk/mağaza metni düzeltmesi C11'e iletildi. |
| 16:05 | C03 | ajan → main `46f163e` | KOD HAZIR | Birleşik main: pgTAP 115 dosya / 4.866 / 0; core 414 test; tsc 0 (core/mobil/backoffice). Faz 1 (C01–C03) ve Faz 2 (C04–C07) kod olarak tamam. |
| 16:35 | C09 | ajan → main | KOD HAZIR | `docs/release/c09-2026-11-06/{README,DEPLOY}.md`. |
| 17:10 | C11 + DB tipleri | ajan → main `0a87406`; koordinatör | KOD HAZIR | Birleşik main: pgTAP 117 dosya / 5.086 / 0; core 414; tsc 0 (core/mobil/backoffice). |
| 17:55 | C12 | ajan → main | KOD HAZIR | Core 415 test; tsc 0. |
| 18:35 | C13 | ajan → main | KOD HAZIR | Birleşik main pgTAP 118 dosya / 5.160 / 0; core 415. C13-AUTH-1 güvenlik bulgusu P0'a alındı (kart kuralı). |
| 16:03 | C14 ön kontrol | koordinatör | TAMAM | Üretim veri anlık görüntüsü (150 tablo/318 satır, `.codex-setup/c14/pre-release-snapshot.json`; Auth/Storage dahil değil). ACL kontrolü: 5 gina yardımcı fonksiyonu anon'a açık (Q03 hijyen migration'ının kapatacağı beklenen durum). Ledger 108. |
| 16:05 | C14 migration | koordinatör | YAYINLANDI | 33 migration tek tek, her biri ayrı işlemde (`20261106010000`…`20261106340000`), hepsi ok (0,6–2,2 sn), hata yok. Ledger 141 / son `20261106340000`. Sonrası ACL kontrolü **0 satır**, RLS kapalı tablo 0; aile/çocuk/rutin sayıları değişmedi. Kayıt `.codex-setup/c14/migrations-apply.{log,json}`. |
| 16:07 | C14 Edge | koordinatör | YAYINLANDI | 24 fonksiyon `supabase functions deploy` (config.toml JWT ayarları); yeni: `channel-unsubscribe` v1 (jwt=false), `content-prereview` v1, `curriculum-source-fetch` v1, `room-weather` v1. Oturumsuz duman: JWT'li uçlar 401, unsubscribe 400 (5xx yok). Not: `content-prereview` jwt=true dağıtıldı; kapı kapalı ve sır yok — C09 DEPLOY'daki `--no-verify-jwt` + sır kurulumu kapı açılırken yapılacak. |
| 16:08 | C14 web | koordinatör | YAYINLANDI | `gina-web` dağıtım https://a31715be.gina-web.pages.dev ; canlı ana + dağıtım adresinde 32/32 dosya yerel export ile hash aynı. |
| 16:09 | C14 yönetim | koordinatör | YAYINLANDI | Access ön kontrol ok → `gina-backoffice` dağıtım https://b1cd107a.gina-backoffice.pages.dev → Access son kontrol (ana + önizleme) ok. |
| 16:12 | C14 sağlık | koordinatör | TEST EDİLDİ | `health-check.mjs --strict`: web kökü (CSP/HSTS başlıkları), yönetim Access 12/12, Supabase REST (anon reddi) + Auth 200, 24 Edge ACTIVE, tablet alias 27 — **ok**. Betikte publishable anahtar davranışı için düzeltme (`ed16ae9`). |
| 16:44 | C14 mobil | koordinatör | YAYINLANDI (yükleme) | iOS 0.1.0 (28) imzalı, aps production, üretim Supabase gömülü, SHA-256 `9e2dbc10…`; EAS submit `8f37781c` **finished** — Apple işleme/TestFlight grup erişimi kullanıcı kontrolüyle doğrulanacak. Tablet 0.1.0 (28) Ad Hoc, tek kayıtlı cihaz, SHA-256 `116a7fad…`; önizleme `m8aeavsrur` hash aynı → `tablet` alias → canlı IPA/manifest/sayfa 28 doğrulandı. Önceki 27 dağıtımı `7hteqzifmy` (geri dönüş). |

## 6 Kasım 17:05 — C14 sonrası kalan yazılım işleri (Codex bağımsız incelemesiyle uzlaştırıldı)

Koordinatör C14 sonrası C15'i beklemek için durdu; bu hataydı — bağımsız yazılım işleri kullanıcıyı beklemez. Başlatılan işler:

| İş | Kapsam | Durum |
|---|---|---|
| D1 | AI ortak kaynak → gerçek soru grubu + çocuğa ortak içerik; soru düzeyinde dönem/program eşleşmesi; Prova dersinin kanonik kimliğe bağlanması; MEB soru uygunluğu veli inceleme ekranı (migration `350000`, pgTAP 121) | YAPILIYOR |
| D2 | PIN'siz çocuk modu; tablet yeniden açılışında eşleme onay kartı; red bildirimi; u02 testi (`360000`, 122) | KOD HAZIR — pgTAP 5.311/0, Playwright D2 9/9, U02 15/15; yayımlanmadı. Açık: red notu yalnız uygulama içi, eski `childModeSubtitle` metni çelişkili. |
| D3 | Operatör bölge/okul kapsam ekranı; kanal hataları sayfası; soru bazlı katkı ret notu; yönetim `confirm` pencereleri, A3-4/A3-7 (`370000`, 123) | YAPILIYOR |
| D4 | Görülemeyen 6 alt akış; reduced-motion solma; giriş odak halkası; kitapçık sınıf seçimi; native PDF yolu | YAPILIYOR |
| D5 | Gerçek AI kabulü — üretimde sentetik hesapla, ≤30 çağrı, temizlik; ön inceleme kapısı açılmaz | TEST EDİLDİ (8 gerçek çağrı, claude-sonnet-5-5) — Prova kısmi/tam üretim GEÇTİ (hak doğru, tekrar ücretsiz); haftalık özet ve preflight GEÇTİ; soru başına `prova-review` GEÇTİ. **B1 P1: üretimde `prova-grade` toplu AI puanlama `ai_result_invalid` 502** (güvenli başarısızlık, ücret tekrar yok). **B2 P1: AI ortak tablosu çocuğa gösterilmiyor** (D1 kapsamı). B3 rubrik ölçeği 5–6 vs 100, B4 10 MiB+ PDF yanlış hata sınıfı, B5 Free haftalık özet 503 yerine 402 olmalı, B6 istemde gerçek ad kuralı ihlali, ortak devre kesici model çıktısı hatasıyla tüm aileleri etkileyebilir. Temizlik doğrulandı (98 tablo 0 satır). Rapor `docs/release/d5-2026-11-06/`. |

Hâlâ dış bağımlı (kod işi değil): gerçek e-posta/SMS (X01/X02), mağaza satın alma–iade–geri yükleme (X02/X03), hukuk onayı (X03), ek AI sağlayıcıları (X04), hosted tam geri yükleme provası. K01 kütüphane: 100 taslak / 1.440 eksik / 0 onay / 0 yayın — yazılım işlerinden sonra. WORLD-01 en son.
| D6 | B1 `prova-grade` düzeltmesi + B3/B4/B5/B6 + devre kesici politikası | YAPILIYOR |
