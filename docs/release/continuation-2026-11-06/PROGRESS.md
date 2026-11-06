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
| C01 | KOD HAZIR (sunucu) — UI takibi açık | Main `b8bef9e`. Okul onayı/beyan/köken/resmî doğrulama ayrı; arşivli takvim kaydı düzenleme reddi; haftalık özet çocuk eşleme hatası düzeltildi; eski sıfır puan önizleme/uygulama/denetim RPC'leri. pgTAP 4.104/0 (İst+UTC). **Açık (C01-UI):** köken etiketi ekranda yok, eski puan düzeltme ekranı yok, resmî doğrulama yönetim akışı yok, takvimde `event_archived` özel mesajı (C02 sonrası). |
| C02 | KOD HAZIR — izole test edildi; fiziksel kabul C15 | Main `0c8297e`. Sunucuda veli onaylı ders bağı (`child_subject_links`, `subject_id` sunucu tarafından yazılır), ana ekran/çocuk Bugün/takvim/görevler aynı tarihli okuma (`plan_for_days`, `routines_for_day`), geçmişte bilinmeyen program doldurulmaz, rutin ileri tarih seçici açık; planlı eğitim geçişi + 14 gün geri alma; elle eklenen ödevlerde toplu yeniden dağıtım. pgTAP 109 149/149, Playwright 12/12 + U05 regresyon 12/12. **Yayın notu:** migration bu istemciyle birlikte çıkmalı. **Açık:** planlı geçiş açılışta uygulanır (cron yok), Prova `subject` metninin kanonik kimliğe bağlanması (C04/P02). |
| C03 | YAPILIYOR | C02 birleşti, başlatıldı |
| C04 | KOD HAZIR — izole zincir kanıtlı; gerçek AI BEKLİYOR (C08) | Main `5ec58eb`. Prova merkezi Hazırla/Gönderilenler/İncelenecekler; eski girişler taslağa; taslak bağlamı (ders/karma, MEB/LGS/serbest, dönem, okul beyanı) gönderimde `exams`'e donar; kısmi/tam AI tamamlama, "tümünü seç" ek ücret yok; alternatif cevap + rubrik; incelemede gerekçe ve AI≠veli etiketi. Zincir: kütüphane+ortak görselli 2 soru+elle+AI → kaydet/aç → ata → çocuk çöz (açık uçlu bekliyor/cevap yok, 0 yok) → veli incele → gelişim; Playwright 17/17, Deno 419. **Açık (C04b):** sunucuda `apply_ai_grades` AI puanını hâlâ `score`'a yazıyor (kart gereği ayrılmalı); AI `shared_sources` soru grubuna dönüşmüyor; dönem uyuşmazlığı soru düzeyinde değil; native PDF yolu; erişilebilirlik. |
| C05 | KOD HAZIR — izole zincir kanıtlı; gerçek AI BEKLİYOR (C08/C14) | Main `ea09f96`. Kaynak hedefleri, çıkarım kuyruğu `--process-queue`, onaysız kaynakta yayın reddi, `get_curriculum_source_status` (yerine koyma yok, stale), soru başına gerekçeli uygunluk incelemesi. Gerçek edge-runtime ile resmî indirme (turkce2.xlsx, hash manifestle aynı) → 46 aday → yayın → aile seçimi → deterministik 6 soru blok eşleşmesi; DNS/SSRF fail-closed. Zincir 39/39, pgTAP 4.102/0. **Açık:** hosted DNS tek çağrı doğrulaması (C14 sonrası), veli uygunluk inceleme ekranı (C04), çıkarım zamanlanmış değil, gerçek AI içerik kalitesi. |
| C06 | KOD HAZIR — izole test edildi; fiziksel kabul C15 | Main `2925682`. Tek eşleme yolu + hedef önizleme (`preview_device_pairing`), QR kodu girişte 10 dk korunur, veli çıkış PIN'i ortak `PinEntry` + sunucu kilidi (5 yanlış/60 sn), iptal nedeni. Üretim dönüş adresleri salt okunur doğrulandı (hepsi listede). Playwright 16/16, pgTAP 4.034/0. **Açık:** eşleme kodu deneme sınırı yok; çocuk modunda PIN'siz çocuk istemci farkı; hedef kartı metni; gerçek OAuth/kamera/e-posta (C15/X01). |
| C07 | KOD HAZIR — izole test edildi | Main `377f75a`. Rol matrisi (destek/içerik/finans/yayın kendi kuyruğu; tam yönetici veya `/families` açılmadı; 24 admin RPC'si rol kontrolüne geçti), sorumlusuz=`assignee_id is null`, TR/EN sürümlü hazır yanıtlar, `/billing` ve içerik listesi keyset sayfalama, push hedef sayısı, tablet düzeni; mobil P05 hak özeti, politika önizlemesi, ret→düzeltme zinciri, grup aşamaları. pgTAP 113 191/191, backoffice Playwright 13/13, mobil 8/8. **Açık:** soru bazlı ret notu (sunucu alanı yok), görselli düzeltme Edge/Storage yolu, sonraki migration'ların rol kontrolünü geri almama kuralı (pgTAP 113 yakalar). |
| C08 | YAPILIYOR | |
| C09 | AÇIK | C08 sonrası |
| C10 | KOD HAZIR — gerçek kanal kabulü BEKLİYOR (X01/X02) | Main `39223af`. E-posta doğrulama ekranı (deneme/süre/sınır), kanal×amaç tercihleri, rıza kapsamı ve geçmişi, `/verify-contact` (oturumda onaylı), `/unsubscribe` + RFC 8058 one-click POST (tek kullanımlık, GET değiştirmez), doğrulanmamış adres reddi, pazarlama kilitli, aynı adrese tek teslim, okul/bölge operatör kapsamı, en çok 3 yeniden sıraya alma, SMTP STARTTLS düz metne düşmez. pgTAP 4.716/0, Deno 433, Playwright 9/9. **Açık:** üretim env/Edge dağıtımı, push cihaz davranışı, operatör kapsam yönetim ekranı ve `channel-failures` sayfaya bağlanması, Universal/App Link, token'da kullanıcı UUID'si. |
| C11 | YAPILIYOR | |
| C12 | SÜREKLİ | Her kartta |
| C13–C15 | AÇIK | Faz 4 |
| K01 / R02 / WORLD-01 | BEKLİYOR | Sıra korunur |

## Günlük
| 12:55 | C01 | ajan → main `b8bef9e` | KOD HAZIR | Ayrıntı: `docs/release/c01-2026-11-06/README.md`. Yayın sırası: migration önce, istemci sonra. |
| 13:05 | C06 | ajan → main `2925682` | KOD HAZIR | `docs/release/c06-2026-11-06/README.md`. Kullanıcı adımı: Google/Apple konsolunda callback `https://wixjxlxgyhgdacadsawo.supabase.co/auth/v1/callback` doğrulaması. |
| 13:15 | C05 | ajan → main `ea09f96` | KOD HAZIR | `docs/release/c05-2026-11-06/README.md`. 16 dosya kontrolü 648 aday onayı değildir; 1 dosya uçtan uca. |
| 13:35 | C02 | ajan → main `0c8297e` | KOD HAZIR | Birleşik main: pgTAP 110 dosya / 4.397 kontrol / 0 hata; core 385 test; tsc 0. |
| 13:55 | C04 | ajan → main `5ec58eb` | KOD HAZIR | Birleşik main: pgTAP 111 dosya / 4.444 / 0; core 391 test; tsc 0. |
| 14:20 | C07 + test düzeltmesi | ajan → main `377f75a`; koordinatör `8d5c63b` | KOD HAZIR | 095#99 ve 102#5 kararsız kontroller deterministik yapıldı. Birleşik main: pgTAP 112 dosya / 4.635 / 0; core 391; tsc/lint 0. Çalışan C03/C08/C10 ajanlarına C07 rol kontrolünü koruma notu gönderildi. |
| 14:55 | C10 | ajan → main `39223af` | KOD HAZIR | Birleşik main: core 397 test; mobil/backoffice tsc 0. |
