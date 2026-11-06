# D15 — MEB gerçek kabul zinciri pilotu (OYSS 2026–27 / 1. dönem) · 6 Kasım 2026

Ajan: Claude Opus 5.5. Dal `worktree-agent-a556d8c4c3b826f1b` (taban main `3245a39`). **Main'e push edilmedi,
üretime yazılmadı, ücretli AI çağrısı yapılmadı.** Canlı kısım koordinatörün/Enes'in onayıyla koşulacak.
Sözleşme: [MEB-SCENARIO-PROTOCOL](../../learning/MEB-SCENARIO-PROTOCOL.md); önceki işler: [M01](../overnight-2026-11-06/M01-REPORT.md),
[C05](../c05-2026-11-06/README.md), [C01](../c01-2026-11-06/README.md), [D5](../d5-2026-11-06/README.md).

**Durum: KOD HAZIR / YEREL İZOLE ZİNCİR 71/71 GEÇTİ — canlı pilot BEKLİYOR (onay gerekli, aşağıda).**

## 1. Zincir (sözle)

1. **Hedef** tam olarak `oyss · 2026-2027 · 1. dönem · 1. ortak yazılı · 5. sınıf · Türkçe` (okul doğrulaması yok,
   "okulun senaryosunu biliyorum" beyanı velide). Başka yıl/dönem ikame edilmez.
2. **Kaynak edinme** — yönetici `curriculum-source-fetch` Edge'ini çağırır: kayıtlı resmî ÖDSGM dizini
   (`gina.curriculum_source_targets`) → ders bağlantısı `meb.ai/ankmeb4` → 302 → `cdn.eba.gov.tr/.../turkce2.xlsx`
   (host/IP/DNS denetimi, boyut/ZIP sınırı) → SHA-256 + bayt + MIME + zincir → `gina.curriculum_source_revisions`
   (`pending_review`, çıkarım `queued`) → orijinal dosya `gina-curriculum-sources` kovasına.
3. **Çıkarım** — işletim adımı `fetch-curriculum-sources.py --process-queue` (yönetici oturumu): aynı politika ile
   yeniden indirir, hash eşleşmesini doğrular, `extract-meb-scenarios.py` ile 46 aday üretir ve idempotent içe alır
   (`queued → done`).
4. **İnceleme/yayın** — aday incelemesi (`review`) → kaynak revizyonu onayı olmadan yayın reddi
   (`curriculum_source_not_approved`) → revizyon onayı → **ayrı** yayın (`published`, revizyon 2).
5. **(D15 yeni) Pilot kapsamı** — servis rolü yalnız sentetik aileyi ≤ 6 saatlik pilot kapsamına alır
   (`set_curriculum_pilot_family`). Global `curriculum_catalog.enabled` **kapalı kalır**; yayımlı senaryoyu yalnız bu
   aile görür.
6. **Aile seçimi** — veli kaynak durumunu (`verified`, `officially_verified:false`) ve senaryo özetini (toplam 6;
   bloklar 2/1/1/1/1) görür; `save_catalog_blueprint` (okul onayı beyanı zorunlu) dondurulmuş kopya
   (`distribution_kind=school_catalogue`, `official_source_verified=false`) üretir; yazılı taslağı açılır.
7. **Üretim** — `prova-generate` (blueprint + taslak): sunucu özel bağdan (`get_catalog_blueprint_context`) normalize
   blok/çıktı metnini sağlayıcıya verir (yalnız URL değil); `validateGenerationResult` toplam/blok/tür/şema
   denetimini yapar; yanlış adet → 502, satır yok.
8. **Provenance** — her soru: `scenario_version`, `catalogue_id/revision`, `source_sha256`, `block_id`,
   `outcome_ids ⊆ blok çıktıları`, `source_cells`, rubrik, `content_fit=pending_human_review`. Ortak kaynak tek grup
   (D1), bağlı sorular ayrı sayılır.
9. **Deterministik denetim** — betik sunucudaki satırlardan toplamı, blok başına adedi, türü (yazılı → açık uçlu),
   izi yeniden sayar (`chain-trace.json`).
10. **Atama** — grup bloklarıyla taslak → `submit_prova_draft` → çocuğa atanmış 6 soruluk sınav; çocuk yükünde cevap
    anahtarı/rubrik/provenance yok; atama ücret düşürmez.
11. **Geri çekme / temizlik** — yayın geri çekilince yeni üretim sağlayıcıya gitmeden durur; atanmış sınav, sorular ve
    dondurulmuş kopya değişmez (hash); kapsam kalkar; hesaplar silinir; aile kapsamlı tablolar 0.

## 2. Üretimde ne var, pilot ne gerektiriyor

| Konu | Üretim durumu (D5 17:15 ve C14b kayıtları; bu turda üretime bağlanılmadı) | Pilot için |
|---|---|---|
| Migration | Son `20261106390000` (C05 `250000` dahil) | **`20261106440000` (bu dal) dağıtılmalı** |
| `curriculum_catalog.enabled` | `false` | Değişmez (pilot kapsamı yeterli) |
| Kaynak/revizyon/aday/yayın/aile bağı | 0 / 0 / 0 / 0 / 0; 1 dizin hedefi | Pilot bunları **gerçek üretim verisi olarak** oluşturur |
| `curriculum-source-fetch` | C14 ile dağıtıldı (hosted `Deno.resolveDns` ve kova yüklemesi hiç canlı denenmedi) | `source` aşaması ilk canlı doğrulama |
| Yönetici | Gerçek yönetici JWT'si gerekir; D5'te sentetik `admins` satırı izin politikasınca reddedildi | Enes onayıyla geçici sentetik yönetici **veya** Enes'in oturum token'ı |
| AI | Pro: Sonnet, gerçek sağlayıcı çalışıyor (D5/C14b) | 1 ücretli çağrı (tavan 3) |

**Şemada test kapsamlı yayın yoktu**: yayın tek (global) `status='published'`; aile görünürlüğü yalnız global anahtarla
açılıyordu. Yani pilot için ya global anahtar herkese açılacaktı ya da hiçbir aile senaryoyu göremeyecekti. Bu yüzden
küçük bir migration eklendi (aşağıda). Yayının kendisi yine globaldir: pilot sonunda geri çekilmezse, ileride global
anahtar açıldığında herkese görünür.

## 3. Kod değişiklikleri

| Dosya | Ne |
|---|---|
| `supabase/migrations/20261106440000_curriculum_pilot_scope.sql` | `gina.curriculum_pilot_families` (aile başına tek satır, gerekçe 10–300, ≤ 6 saat, RLS açık, hiçbir rol yetkisi yok); `gina.curriculum_catalog_open(aile)` = global anahtar **veya** etkin pilot satırı; yalnız `service_role`: `set_/clear_/get_curriculum_pilot_family` (denetim kaydı yazar). **Yalnız sentetik aile**: her üyenin Auth e-postası `@example.invalid` değilse `curriculum_pilot_family_not_synthetic`. `get_curriculum_scenarios`, `save_catalog_blueprint`, `reserve_catalog_prova_generation` en son gövdeleriyle birebir; yalnız anahtar denetimi yardımcıya geçti (`create or replace`, ACL korunur). Anon/authenticated çalıştırabilen yeni fonksiyon yok; C07'nin 24 yönetici RPC'sine dokunulmadı. |
| `supabase/tests/129_curriculum_pilot_scope.test.sql` | 47 pgTAP kontrolü: ACL'ler, üç kapının yardımcıyı kullanması, kapsam öncesi görünmezlik, veli/anon kendini kapsamlayamaz, gerekçe/süre/bilinmeyen aile, gerçek ve karma aile reddi, kapsamlı aile görür/seçer/rezerve eder, kapsamsız aile göremez/seçemez, başka dönem ikame yok, süre dolunca kapanır (mevcut iş okunabilir), temizleme idempotent + denetim, global anahtar davranışı aynen, aile silinince satır silinir. |
| `docs/release/d15-2026-11-06/run-meb-pilot.mjs` | Aşamalı canlı betik (run-c14b modeli). Üretimde her çağrı `--prod` ister. |
| `scripts/d15-meb-pilot-edge.ts` | Yalnız yerel: değişmemiş `curriculum-source-fetch`, `prova-generate`, `delete-account` işleyicileri; gerçek resmî indirme, deterministik senaryo-duyarlı sağlayıcı. |
| `scripts/test-meb-pilot-local.mjs` | Yalnız yerel: betiği izole yığında tüm aşamalarla koşturur. |
| `scripts/test-isolated-services.py` | `--meb-pilot` bayrağı (depolamayı açar, yukarıdaki koşucuyu çalıştırır). Varsayılan davranış aynı. |

## 4. Yerelde doğrulanan (gerçekten çalıştırıldı)

```
python3 scripts/test-q02-sql.py --run-local --only 129   → 47 ok, 0 hata
python3 scripts/test-q02-sql.py --run-local --only 057|056|111|108|102 → 43/37/106/108/16 ok, 0 hata
deno check scripts/d15-meb-pilot-edge.ts                 → temiz
python3 scripts/test-isolated-services.py --run-local --meb-pilot → 71/71, konteynerler + geçici DB silindi
```

Kanıt: [`local/isolated-run.json`](local/isolated-run.json), aşama raporları `local/stage-*.json`, çağrı özeti
[`local/calls.jsonl`](local/calls.jsonl), iz [`local/chain-trace.json`](local/chain-trace.json).

Ayrım: **gerçek** = resmî ÖDSGM/EBA ağı (dizin 07.09/10.09.2026, `meb.ai:302 → cdn.eba.gov.tr:200`, 31.410 bayt,
SHA-256 `6405d02aaaad…` = depodaki manifest), gerçek Auth/PostgREST/Storage (kovaya yükleme `stored:true`), gerçek
Python çıkarıcı (46 aday); **izole** = tek kullanımlık DB/konteynerler, sentetik `example.invalid` hesaplar (veli, anonim
tablet, geçici yönetici); **deterministik** = AI sağlayıcı sınırı (içerik kalitesi kanıtı değildir).
Deneme geçmişi: 1. koşu `dns_failed` — `deno run` izninde sistem çözücüsü (`192.168.1.1:53`) yoktu (test altyapısı;
çözücü `/etc/resolv.conf`'tan izne eklendi). 2. koşu 69/69 ama ortak kaynak grubu oluşmadı (şablonda
`question_groups.enabled` kapalı; üretimde açık — koşucu üretimle eşitlendi). 3. koşu 71/71.

Gözlem: yerel yanlış-adet testi (`ai_result_uncertain`) aileden 6 hak düşürdü (300 → 294). Bu mevcut C08 kuralı
(belirsiz sonuç ücretlenmiş sayılır, tekrar yok); canlıda bu negatif test **yapılmaz**.

## 5. Canlı adımlar (koordinatör; her biri ayrı komut, otomatik tekrar yok)

Ön koşul (Enes onayı): migration `20261106440000` dağıtıldı. Ücretsiz salt okunur kontrol önce:

```sh
B=docs/release/d15-2026-11-06/run-meb-pilot.mjs
node $B preflight --prod      # migration var, global anahtar kapalı, Pro senaryo+AI, devre kesici kapalı, ücret sayacı
node $B setup --prod          # sentetik veli/aile/5. sınıf çocuk/anonim tablet + PIN
node $B override --prod       # yalnız bu aileye gerekçeli 3 saatlik Pro (D5/C14b yöntemi)
node $B admin-setup --prod --allow-temp-admin   # (A) onaylıysa geçici sentetik yönetici
#   veya (B) GINA_ADMIN_ACCESS_TOKEN=<Enes oturumu> ile admin-setup/source/extract/review/cleanup (token yazılmaz)
node $B source --prod         # gerçek hosted indirme: DNS, zincir, hash, kova, tekrar=unchanged, 2. dönem ikame yok
node $B extract --prod        # işletim adımı: queued → done, 46 aday, tekrar iş yok (ilgisiz kuyruk varsa durur)
node $B review --prod --reviewed-by-enes   # yalnız Enes hücreleri resmî dosyayla karşılaştırdıysa; yoksa Enes
                                           # backoffice'te inceler/onaylar/yayımlar, aşama bayraksız yalnız doğrular
node $B scope --prod          # kapsam öncesi görünmez → sentetik aile 3 saat kapsamda; global anahtar kapalı
node $B select --prod         # durum/özet, okul onayı zorunlu, sahte provenance reddi, dondurulmuş kopya, yazılı taslağı
node $B generate --prod       # ★ TEK ücretli çağrı (6 soru) + ücretsiz tekrar; deterministik zincir denetimi
node $B assign --prod         # çocuğa atama; çocuk yükü temiz; ücret yok
node $B cleanup --prod [--withdraw]   # (Enes kararı) geri çek → yeni üretim durur, atanmış sınav aynı; kapsam, hesaplar silinir
node $B verify --prod         # auth 0, aile tabloları 0, kapsam yok, anahtar kapalı; yerel durum dosyası silinir
```

Çıktılar `docs/release/d15-2026-11-06/live/` altına yazılır (`stage-*.json`, `calls.jsonl`, `chain-trace.json`,
`questions-for-human-review.json`); parola/token yalnız gitignored `.codex-setup/d15/meb-pilot-state.json` (0600).
Ücretli tavan 3: 1 üretim + en çok 2 bilinçli yeniden deneme (aynı taslakla yeni `request_id`, ancak sonuç `failed`
ise; `uncertain` ise yeniden deneme yok, durup inceleme).

### Enes onayı gereken üretim değişiklikleri

1. **Migration `20261106440000` dağıtımı** (yeni tablo + 3 servis RPC'si + 3 kapı fonksiyonunun yeniden tanımı).
2. **Gerçek katalog verisi** — resmî `turkce2.xlsx`'in kaynak/revizyon satırı ve kovadaki orijinali (kalıcı); 46 aday
   (taslak) içe alımı; revizyon **onayı**; **bir** adayın (`tr-2026-2027-t1-turkce2-g5-c6`) incelemesi ve **yayını**.
   Global anahtar kapalı kaldıkça yalnız pilot aile görür. İnceleme beyanı (`source_checked/counts_checked/
   applicability_checked`) gerçek bir editoryal karar olduğu için Enes'in hücre karşılaştırması gerekir.
3. **Yönetici kimliği** — (A) geçici sentetik `admins` satırı (temizlikte silinir; D5'te izin politikası reddetmişti)
   ya da (B) Enes'in kendi oturum token'ı.
4. **Pilot sonu kararı** — yayını geri çek (`--withdraw`, önerilen: pilot incelemesi kalıcı katalog onayı sayılmasın) ya
   da yayımlı bırak (anahtar açıldığında herkese görünür).
5. **≤ 3 ücretli çağrı** (beklenen 1) ve sentetik aileye 3 saatlik Pro hakkı.

Migration'sız alternatif: kısa süre global `curriculum_catalog.enabled=true` (yayımlı tek senaryo o sürede **bütün**
5. sınıf Türkçe velilerine görünür) — önerilmez.

## 6. Protokol kabul testleri 1–7 eşlemesi

| # | Protokol | Bu pilotun kanıtı (yerel; canlıda aynı kontroller) | Başka yerde |
|---|---|---|---|
| 1 | Doğru yıl/dönem/yazılı/sınıf/ders, okul/program kapsamı; bilinmeyen okul | `source`: tam hedef, 2. dönem `unpublished`; `select`: 2. dönem/2027–28 senaryosu yok, okul onayı beyanı zorunlu, kopya `school_catalogue` ama `official_source_verified=false` | "Henüz bilmiyorum" yolu: C01 pgTAP 108 |
| 2 | Eksik dosya, ağ kesintisi, yeni hash, geri çekilen kaynak; eski sınav değişmez | `source`: aynı hash → `unchanged`; `cleanup`: geri çekme → yeni üretim sağlayıcısız 409, atanmış sınav+sorular+kopya hash'i aynı | Ağ/404/yeni hash/eskime: C05 zinciri + pgTAP 087/111 |
| 3 | Birleşik blok sayımı; 20'lik havuzdan 7'lik dağılım; yanlış adet/tür reddi | Blok 1 = 2 soru tek blok (çıktıyla çarpılmaz), blok başına adet birebir; yanlış adet → 502 + 0 satır (yalnız yerel) | Havuz seçimi: `planPoolSelection` Deno testleri (kütüphane OYSS alt havuzu henüz yok) |
| 4 | Blok/çıktı/rubrik izi; kod etiketi ≠ içerik uygunluğu | `generate`: her soruda `scenario_version/block_id/outcome_ids/source_cells/source_sha256` + rubrik; `content_fit=pending_human_review`, `accepted:false` | Gerekçeli inceleme: C05 |
| 5 | Manuel kaynak onaylı katalog gibi yükseltilemez; aile/rol yetkileri; eşzamanlılık | `select`: istemci `officially_verified` veremez, kopya REST ile yeniden yazılamaz (`curriculum_copy_immutable`); `source`: veli Edge'i çağıramaz; pilot kapsamını yalnız servis kurar, yalnız sentetik aile (pgTAP 129) | Yarışlar: `test-curriculum-races.py`, `test-catalogue-selection-races.py`, C01 108 |
| 6 | SSRF, aşırı dosya/ZIP, bozuk format, belge talimatı; tekrar çift iş/kota tüketmez | `source` gerçek politika ile; tekrar indirme yeni revizyon yok, çıkarım tekrarı iş yok, üretim tekrarı ikinci ücret yok, seçim/atama tekrarı aynı kimlik | SSRF/ZIP/format: M01/C05 Python + Deno + edge-runtime probu |
| 7 | Veli telefon/tablet önizleme; çocuk defteri ve veli rubriği okunabilirliği | Yalnız veri düzeyi: çocuk yükü temiz, 6 soru atanmış | **Kapsam dışı**: UI/fiziksel cihaz bu turda yok (C05 web export turu var) |

## 7. Sınırlar

- Canlı koşulmadı; hosted `Deno.resolveDns`, kova yüklemesi ve gerçek modelin senaryo şemasına (v5) uyumu canlıda ilk kez görülecek.
- Deterministik sağlayıcı içerik kalitesini kanıtlamaz; gerçek modelin blok başına adedi tutturamaması `ai_result_invalid` → `uncertain` olur (ücretli, tekrar yok). Soru kalitesi/çözüm doğruluğu insan incelemesi ister (`questions-for-human-review.json`).
- Tek dosya/tek senaryo; toplu kütüphane üretimi bu pilottan sonra.
- Atanmış sınav senaryo bağını kendi satırında taşımaz; iz soru provenance'ı ve üretim işi bağı (`catalog_generation_links`) üzerinden.
- `packages/core/src/database.types.ts` yeniden üretilmedi (yeni RPC'ler yalnız servis rolü; betik tipsiz çağırır). Birleştirmeden sonra `scripts/gen-db-types-isolated.sh --run-local` önerilir.
- Arayüz, fiziksel cihaz, çocuk cevaplama/puanlama bu pilotun kapsamında değil.
