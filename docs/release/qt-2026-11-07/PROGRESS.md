# Prova soru türleri — ilerleme ve kanıt kaydı

Plan: [PROVA-QUESTION-TYPES-PLAN.md](../../learning/PROVA-QUESTION-TYPES-PLAN.md) · Sözleşme: [PROVA-QUESTION-TYPES-CONTRACT.md](../../learning/PROVA-QUESTION-TYPES-CONTRACT.md)
Branch: `claude/prova-question-types` (worktree `../gina-qtypes`, taban `origin/main 7dc3ef9`). Main'e merge, prod migration, Edge deploy ve istemci yayını **yapılmadı**; koordinatör onayı bekleniyor (tek yayın hattı H08 thread'inde).

Durum ölçeği: PLANLANDI → YAPILIYOR → KOD HAZIR → YAYINDA → KABUL TAMAM; DIŞ ENGEL.

## Kart durumu

| Kart | Durum | Not |
|---|---|---|
| QT00 veri/güvenlik sözleşmesi | KOD HAZIR (sunucu+core) · istemci YAPILIYOR | Migration 0000–0400, pgTAP 140/141, yarış testi; istemci alt ajanlarda |
| QT01 puanlama | KOD HAZIR (SQL) | Golden 360 iddia core fixtures'tan üretiliyor |
| QT10 doğru/yanlış | YAPILIYOR | Sunucu+core hazır; çocuk/veli/PDF/AI istemci işi sürüyor |
| QT11 boşluk doldurma | YAPILIYOR | 〃 |
| QT12 eşleştirme | YAPILIYOR | 〃 |
| QT13 sayısal kısa cevap | YAPILIYOR | 〃 |
| QT20 sıralama | YAPILIYOR | Sunucu+core hazır (1B sunucu tarafı Faz 0 ile birlikte geldi) |
| QT21 sınıflandırma | YAPILIYOR | 〃 |
| QT30–QT51 | PLANLANDI | Faz 2A/2B/3 |

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
