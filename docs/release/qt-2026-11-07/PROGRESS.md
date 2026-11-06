# Prova soru türleri — ilerleme ve kanıt kaydı

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
| QT30 metin işaretleme | YAPILIYOR · sunucu+core KOD HAZIR | `enabled=false`; istemci çizicisi yok |
| QT31 hata bulma–düzeltme | YAPILIYOR · sunucu+core KOD HAZIR | Anahtarda olmayan anlamlı düzeltme → veli |
| QT32 çoklu doğru seçenek | YAPILIYOR · sunucu+core KOD HAZIR | `max(0, TP/P − FP/N)`; hepsi-doğru yapı ret |
| QT33 iki aşamalı | YAPILIYOR · sunucu+core KOD HAZIR | Metin gerekçe → veli; seçenekli gerekçe otomatik |
| QT40 defter güçlendirme | PLANLANDI | Yeni defter yok; mevcut NotebookWorkspace + cihaz kabulü (DIŞ ENGEL: Pencil cihazı) |
| QT41 şekil boyama + saat | YAPILIYOR · sunucu+core KOD HAZIR | `region_select` (ızgara/dilim/görsel bölge), `clock` |
| QT42 tablo/grafik, harita/şema | YAPILIYOR · sunucu+core KOD HAZIR | `stimulus` (table/bar_chart, alt zorunlu) + görsel bölge kutuları |
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

Birleşik dal `claude/prova-question-types` (`d17c38f1`): Faz 0 + istemci dalları (`claude/qt-child`, `claude/qt-parent`, `claude/qt-ai`) + `20261107000500_qt10_question_views`.

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
