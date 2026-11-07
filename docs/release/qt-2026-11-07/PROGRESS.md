# Prova soru türleri — ilerleme ve kanıt kaydı

> Güncel yayın durumu: [1.0.0 (34) canlı yayın kaydı](LIVE-RELEASE.md). Aşağıdaki “yayımlanmadı / kod hazır” ifadeleri ilgili test koşusunun tarihsel durumudur; güncel yayın durumu bu kayıttan okunmalıdır. Fiziksel cihaz kabulü ayrı ve açıktır.

Plan: [PROVA-QUESTION-TYPES-PLAN.md](../../learning/PROVA-QUESTION-TYPES-PLAN.md) · Sözleşme: [PROVA-QUESTION-TYPES-CONTRACT.md](../../learning/PROVA-QUESTION-TYPES-CONTRACT.md)
Branch: `claude/prova-question-types` (worktree `../gina-qtypes`, taban `origin/main 7dc3ef9`). Main'e merge, prod migration, Edge deploy ve istemci yayını **yapılmadı**; koordinatör onayı bekleniyor (tek yayın hattı H08 thread'inde).

Durum ölçeği: PLANLANDI → YAPILIYOR → KOD HAZIR → YAYINDA → KABUL TAMAM; DIŞ ENGEL.

## Kart durumu

| Kart | Durum | Not |
|---|---|---|
| QT00 veri/güvenlik sözleşmesi | KOD HAZIR (sunucu+core) · istemci YAPILIYOR | Migration 0000–0400, pgTAP 140/141, yarış testi; istemci alt ajanlarda |
| QT01 puanlama | KOD HAZIR (SQL) | Golden 360 iddia core fixtures'tan üretiliyor |
| QT10 doğru/yanlış | KOD HAZIR | Sunucu+core+çocuk+veli+PDF+AI+backoffice; yayın ve gerçek cihaz kabulü açık |
| QT11 boşluk doldurma | KOD HAZIR | Sunucu+core+çocuk+veli+PDF+AI+backoffice; yayın ve gerçek cihaz kabulü açık |
| QT12 eşleştirme | KOD HAZIR | Sunucu+core+çocuk+veli+PDF+AI+backoffice; yayın ve gerçek cihaz kabulü açık |
| QT13 sayısal kısa cevap | KOD HAZIR | Sunucu+core+çocuk+veli+PDF+AI+backoffice; yayın ve gerçek cihaz kabulü açık |
| QT20 sıralama | KOD HAZIR | Sunucu+core+çocuk+veli+PDF+AI+backoffice; yayın ve gerçek cihaz kabulü açık |
| QT21 sınıflandırma | KOD HAZIR | Sunucu+core+çocuk+veli+PDF+AI+backoffice; yayın ve gerçek cihaz kabulü açık |
| QT30 metin işaretleme | KOD HAZIR | Sunucu+core+çocuk+veli+PDF+AI+backoffice; yayın anahtarı 20261107050400 + istemci faz anahtarı; gerçek cihaz kabulü açık |
| QT31 hata bulma–düzeltme | KOD HAZIR | Sunucu+core+çocuk+veli+PDF+AI+backoffice; yayın anahtarı 20261107050400 + istemci faz anahtarı; gerçek cihaz kabulü açık |
| QT32 çoklu doğru seçenek | KOD HAZIR | Sunucu+core+çocuk+veli+PDF+AI+backoffice; yayın anahtarı 20261107050400 + istemci faz anahtarı; gerçek cihaz kabulü açık |
| QT33 iki aşamalı | KOD HAZIR | Sunucu+core+çocuk+veli+PDF+AI+backoffice; yayın anahtarı 20261107050400 + istemci faz anahtarı; gerçek cihaz kabulü açık |
| QT40 defter güçlendirme | PLANLANDI | Yeni defter yok; mevcut NotebookWorkspace + cihaz kabulü (DIŞ ENGEL: Pencil cihazı) |
| QT41 şekil boyama + saat | KOD HAZIR | Sunucu+core+çocuk+veli+PDF+AI+backoffice; yayın anahtarı 20261107050400 + istemci faz anahtarı; gerçek cihaz kabulü açık |
| QT42 tablo/grafik, harita/şema | KOD HAZIR | Sunucu+core+çocuk+veli+PDF+AI+backoffice; yayın anahtarı 20261107050400 + istemci faz anahtarı; gerçek cihaz kabulü açık |
| QT43 dikte | KARAR BEKLİYOR | Ses dosyası depolama/yükleme hattı (özel ses türü, imzalı URL, silme) veya cihaz TTS seçimi; TTS metni istemciye taşıyacağı için cevap sızar |
| QT44 problem kurma | PLANLANDI | Açık uçlu + rubrik ön ayarı (yeni cevap altyapısı yok) |
| QT50 bulmaca | YAPILIYOR · sunucu+core KOD HAZIR | `enabled=false` |
| QT51 sesli cevap | KARAR BEKLİYOR | Çocuk sesi kaydı/aktarımı için ayrı açık rıza ve saklama/silme kararı (hukuk/ürün); mevcut izinlerden türetilmez |

## Faz 0 (QT00 + QT01) kanıtı — 7 Kasım 2026

**Commit'ler:** `e126dfd4` (sözleşme + puanlama + core), `a5c648fb` (rapor durumları + sözleşme dokümanı), yarış testi commit'i (bu dosyayla).

**Migration'lar (yalnız branch; prod'a uygulanmadı):** `20261107000000_qt00_structured_kind`, `20261107000100_qt00_question_contract`, `20261107000200_qt01_scoring`, `20261107000300_qt00_rpcs`, `20261107000400_qt00_report_states`. Diğer thread'in aralığı (20261106460000–20261106490000, pgTAP 131–134) ile çakışma yok.

**Testler (hepsi izole/tek kullanımlık DB):**

| Komut | Sonuç |
|---|---|
| `python3 scripts/test-q02-sql.py --run-local --fresh --out docs/release/qt-2026-11-07` | 131 dosya, 6318 iddia; başarısız yalnız `066_weekly_summary_safety` (4) ve `069_learning_plan_import` — **aynısı branch migration'ları olmadan da başarısız** (`sql-checks-fresh-without-20261107.json`, 5871 iddia): önceden var olan, bu işten bağımsız |
| `140_qt_scoring_golden` (core `fixtures.json` → `node scripts/gen-qt-golden-sql.mjs`) | 360/360 |
| `141_qt_contract_flow` | 88/88 |
| `python3 scripts/test-qt-answer-races.py --run-local` → `answer-races.json` | 7/7 (iki cihaz aynı revizyon, uçuşta aynı istek kimliği, geç/eski yanıt, kayıt–bitirme yarışı, çift bitirme, süre sonu, veli puanı tekrarı) |
| `packages/core`: `npx tsc --noEmit`, `npx vitest run` | temiz; 65 dosya / 598 test (yeni: fixtures paritesi, cevap yardımcıları, çevrimdışı günlük) |
| `scripts/gen-db-types-isolated.sh --run-local` | `database.types.ts` yalnız yeni sütun/RPC farkıyla güncellendi |

**QT00 kriterleri:**
- [x] Tip sözleşmesi, genel/özel payload örnekleri, geçiş/geri dönüş ve RPC etki listesi — sözleşme dokümanı.
- [x] Eski sorular/sınavlar/v3 istemci regresyonu: bütün eski pgTAP dosyaları geçiyor; eski hash'ler birebir; eski toplam alanları aynı anlamda. Eski istemci yapılandırılmış soruda açık `client_update_required`.
- [x] Yinelenen/çakışan istek kimliği, eski revizyon, sıra dışı yanıt, süre bitişi, gönderim–bitirme yarışı: 141 + yarış testi.
- [x] Geçersiz tür, büyük/derin payload, bilinmeyen/yinelenen kimlik, fazla seçim (birebir eşleştirmede tekrar, kapasite), tür–soru uyuşmazlığı sunucuda reddediliyor.
- [x] Anahtar sızıntısı: cihaz/öğrenci ve başka aile tablo ya da RPC ile anahtar alamıyor; öğrenci payload'ı izin listesiyle yeniden kuruluyor (derin alan taraması testli); deneme sürerken puan hesaplanmıyor (oracle yok). PDF ve varlık URL yolu istemci işiyle birlikte test edilecek (açık).
- [x] Raporlar `items_scored / items_pending / items_unanswered / items_partial` ile ayrışıyor; gelişim raporu ve tekrar adayları yapılandırılmış maddeleri doğru sınıflıyor.

**QT01 kriterleri:** tam/kısmi/boş/yanlış/sınır/kötüye kullanım örnekleri (her tür), 0–100 sınırı, deterministik tekrar, kimlik tabanlı cevap (karışık sırada aynı puan), sabit ağırlık (atama bağı), hassas sayı sınırları (sıfır hedef, mutlak/göreli tolerans, binlik ayraç), TR harf kuralı (ı/İ, ASCII eşitleme yok, NFC) — [x]. Veli düzeltmesi gerekçeli kayıt — [x]. AI önerisi ayrı: yapılandırılmışta AI önerisi bu fazda yok, veli puanlar (paket/kota bağımsız) — [x].

**Açık riskler / sınırlar:** grup (toplu) sınav ve kütüphane içe aktarma yapılandırılmış tür taşımıyor (açık ret); AI düzenleme yapılandırılmışta kapalı; cihaz yeteneği atamada uyarı düzeyinde; ortak kabul kapısının istemci, PDF, ekran ve gerçek cihaz maddeleri henüz yok.

## Ortak kabul kapısı — Faz 1A/1B (güncel)

| Madde | Durum |
|---|---|
| Elle hazırlama + AI aynı sürümlü şemaya yazıyor | Sunucu: [x] (`save_question_with_sources`, `complete_prova_generation`). İstemci/Edge: YAPILIYOR |
| Katı AI şeması + deterministik sunucu doğrulaması | Sunucu doğrulaması [x]; Edge şeması YAPILIYOR |
| AI çıktısı öğrenci görünümü + özel anahtara ayrılıyor | Sunucu [x]; Edge YAPILIYOR |
| Çocukta cevapsız/kısmi/dolu, taslak, kapat/aç, offline, iki cihaz, bitirme/deadline | Sunucu + core günlük [x]; çocuk ekranı YAPILIYOR |
| Veli incelemesi/rapor kısmi–bekliyor–boş ayrımı | Sunucu [x]; ekran YAPILIYOR |
| Paket eşitliği; AI'dan bağımsız manuel yol | Sunucu [x] (ücretsiz aile testli) |
| Telefon/tablet/web/backoffice ekranları | YAPILIYOR |
| PDF öğrenci kitapçığı ≠ cevap anahtarı | YAPILIYOR |
| İzole DB yetki/negatif, SQL golden, core sözleşme testleri | [x] |
| Gerçek cihaz (Pencil, VoiceOver/TalkBack, döndürme) | DIŞ ENGEL — fiziksel cihaz erişimi gerekli |
| Sürümler, eski istemci davranışı, ekranlar, sınırlamalar raporu | Kısmen (bu dosya); yayın yapılmadı |


## Faz 1A + 1B ortak kabul kapısı — birleşik dal kanıtı (7 Kasım 2026)

Birleşik dal `claude/prova-question-types` (`d17c38f1`): Faz 0 + istemci dalları (`claude/qt-child`, `claude/qt-parent`, `claude/qt-ai`) + `20261107050000_qt10_question_views`.

| Kontrol | Komut | Sonuç |
|---|---|---|
| Tam pgTAP | `python3 scripts/test-q02-sql.py --run-local --fresh` | 133 dosya / 6577 iddia; yalnız önceden var olan 066/069. Bir koşuda `116` (anon EXECUTE yüzeyi) 1 kez başarısız; tek başına ve tekrar koşuda geçti → kararsız, izleniyor |
| Core | `packages/core: npx tsc --noEmit; npx vitest run` | temiz; 66 dosya / 704 test |
| Mobil | `apps/mobile: npx tsc --noEmit; npx expo lint; vitest question-types` | 0 hata; lint temiz; 19/19 |
| Edge | CI `deno test` satırı | 360/360 (yapı paritesi + red-team) |
| Backoffice | `pnpm typecheck`, `pnpm build` | temiz; build 0 |
| Çocuk UI (web build, izole yığın) | `scripts/test-qt-child-ui.cjs --run-local` | 16/16 (birleşik dalda yeniden) — `screens/child/` |
| Hazırlama/atama/PDF UI | `scripts/test-qt-author-ui.cjs --run-local` | 14/14 (AI tür seçimi dahil; Edge sahte uç) — `screens/author/`, öğrenci/anahtar PDF ayrı |
| Backoffice UI | `scripts/test-qt-backoffice-ui.py --run-local` | geçti (birleşik dalda, 68 migration) — `screens/backoffice/` |
| Yarış | `scripts/test-qt-answer-races.py --run-local` | 7/7 |

| Kapı maddesi | Durum |
|---|---|
| Manuel + AI aynı sürümlü şema | [x] (`save_question_with_sources`, AI `interaction_types` → `complete_prova_generation`) |
| Katı AI şeması + deterministik doğrulama | [x] Edge + SQL; gerçek sağlayıcının `anyOf` şemasını kabulü DOĞRULANMADI (sağlayıcı pilotu gerekli; Gemini riskli) |
| Anahtar ayrımı / sızıntı yok | [x] çocuk/cihaz; not: veli cihazındaki AI üretim günlüğü dönen anahtarı yerelde saklar (veli verisi; telefonda çocuk modu için risk notu — günlükte anahtarı saklamamak takip işi) |
| Çocuk cevapsız/kısmi/dolu, taslak, yeniden yükleme, bitirme | [x] UI; çevrimdışı/iki cihaz çakışması core günlük + SQL yarış testleriyle, UI senaryosu olarak koşulmadı |
| Veli incelemesi/rapor ayrımı | [x] |
| Paket eşitliği; AI'sız manuel yol | [x] |
| Telefon/dar/tablet/masaüstü + backoffice | [x] web build (390/360/768/1280); fiziksel değil |
| PDF öğrenci ≠ anahtar, Türkçe font | [x] headless Chrome; native `expo-print` cihazda koşulmadı |
| DB yetki/negatif, golden, core | [x] |
| Gerçek cihaz (Pencil, VoiceOver/TalkBack, döndürme, büyük yazı) | **DIŞ ENGEL** — fiziksel cihaz erişimi |
| Yayın | YAPILMADI — Faz 0 DB onayı var (H08 hattı uygular); istemci/Edge yayını ayrıca onay ister |

Bilinen sınırlar: kaydedilmiş yapılandırılmış soru düzenlenemez (AI/elle düzenleme kapalı); ortak kaynak grupları ve kütüphane paylaşımı yalnız eski türler; ağırlık (weights) için UI yok; global yapılandırılmış soru backoffice'te salt okunur (admin kaydetme RPC'si yok). Ürün kararı: amaç “yazılıya hazırlık” veya tür “şıklı/açık uçlu” seçiliyken yapılandırılmış sorular (sayısal dahil) “Karma” seçimi ister.


## Toplu ortak kabul kapısı — Faz 1A + 1B + 2A + 2B (tek yayın, Enes kararı)

Birleşik dal `claude/prova-question-types` @ `d952d4f9` (origin/main `86d815ce` Faz 0 yayını dahil). Main/prod/Edge/istemci yayını YAPILMADI.

**Yayın paketi:** migration `20261107050000` (görünüm sütunları), `20261107050100` (2A, kapalı), `20261107050200` (2B, kapalı), `20261107050300` (Faz 3 bulmaca, kapalı kalır), `20261107050400` (2A+2B açma + 1–4. sınıf saat 12 saat koruması) → Edge `prova-generate` (v9 eski gövde birebir; yapılandırılmış istek v10) → web/backoffice → imzalı mobil. Mobilde faz anahtarı: `apps/mobile/src/components/learning/question-types/support.ts` `PHASE2A_CHILD_ENABLED` / `PHASE2B_CHILD_ENABLED` (yayında `true` yapılmalı; hazırlama anahtarları bunlara bağlı). Anahtar kapalı eski/yeni istemci yeni türü açık `client_update_required` ile reddeder.

| Kontrol | Sonuç (d952d4f9) |
|---|---|
| Tam pgTAP (`test-q02-sql.py --fresh`) | 137 dosya / 6843 iddia / **0 hata** |
| Golden fixtures paritesi | güncel |
| Yarış testi | 7/7 |
| Core tsc + vitest | 738/738 |
| Mobil tsc / lint / soru türü testleri | 0 / temiz / 42/42 |
| Edge deno check + test | temiz / 421/421 |
| Backoffice typecheck + lint + build | temiz |
| UI: çocuk 1A/1B · 2A · 2B | 16/16 · 10/10 · 11/11 |
| UI: hazırlama 1A/1B (+AI seçici) · 2A/2B (+saat kararları, PDF) | 14/14 · 8/8 |
| UI: backoffice (73 migration) | geçti |

Kararlar uygulandı: sayısal soru açık uçlu/yazılı amacında Karma'sız; AI günlüğü yapılandırılmış anahtarı cihazda saklamaz; 1–4. sınıf saat 1–12 (sunucu korumalı); ekran okuyucuda saat okuma maddesi veliye düşer (yalnız iOS/Android).

**Açık / dış engel:** gerçek cihaz kabulü (Pencil/parmak, VoiceOver/TalkBack — ekran okuyucu saat notu dahil, döndürme/pinch, büyük yazı, native `expo-print` PDF) — DIŞ ENGEL; görsel bölgelerin gerçek görselle yerleşimi (izole yığında Storage/Edge yok; yalnız birim + etiket listesi yolu); gerçek AI sağlayıcısında 12 varyantlı şemanın kabulü (sentetik pilot gerekli, Gemini riskli); dikte/sesli cevap ses depolama + rıza kararı; kaydedilmiş yapılandırılmış soru düzenleme, ortak kaynak grubu/kütüphane paylaşımı, global yapılandırılmış soru düzenleme (admin RPC) yok; çocuk notu metni (saat) taslak.

## Yayın öncesi regresyon (Enes onayı sonrası, anahtarlar açık)

Kaynak: `claude/prova-question-types` (origin/main `40a0ffc5` — Codex locale yayını 33 dahil — ile uzlaştırıldı). Migration numaraları main'deki Codex dosyalarıyla çakıştığı için `20261107050000`–`050400` olarak yeniden numaralandı (sıra korunur; main'in son dosyası `20261107040000_prereview_input_budget`). İstemci anahtarı `PHASE2A_CHILD_ENABLED=PHASE2B_CHILD_ENABLED=true`.

| Kontrol | Sonuç |
|---|---|
| pgTAP şablon + `--fresh`, Europe/Istanbul + UTC (main #163 öncesi birleşim) | 140 dosya / 6896 / 0 hata (4 koşu) |
| pgTAP `--fresh` Istanbul + şablon UTC (son birleşim, #163/#164 dahil) | 141 dosya / 6903 / 0 hata |
| Edge `deno check` + CI `deno test` satırlarının tamamı | temiz / 0 hata |
| Core tsc + vitest | 738/738 |
| Mobil tsc / lint / vitest | temiz / temiz / 55/55 |
| Backoffice typecheck + lint + build | temiz |
| Yarış | 7/7 |
| UI: çocuk 1A/1B · 2A · 2B | 16/16 · 10/10 · 11/11 |
| UI: hazırlama 1A/1B · 2A/2B | 14/14 · 8/8 (yayın derlemesi 14 tür gösterir) |
| UI: backoffice | geçti |

Yayın adımları: başlatılmadı — üretim kimlik bilgilerine (Supabase Management, Cloudflare, EAS) bu oturumda erişim izni yok; Enes onayı / izin kuralı bekleniyor.
