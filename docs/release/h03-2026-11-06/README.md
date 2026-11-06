# H03 — İnsan incelemesi paketini tamamla · 6 Kasım 2026

Kart: [CLAUDE-REMAINING-WORK §4 H03](../../CLAUDE-REMAINING-WORK.md). Ajan: Claude Opus 5.5, dal `worktree-agent-ad2d615c0caa6339b`.
**Üretime dokunulmadı, ücretli AI çağrısı yapılmadı, migration yok, main'e push yok.**

**Durum: KOD + İZOLE TEST TAMAM. D15 canlı soruları tam olarak KURTARILAMIYOR. İnsan içerik onayı YAPILMADI; bu kart
içerik kabulü değildir.**

## 1. D15 içeriği kurtarılabilir mi? (önce bakıldı, hiçbir şey tahmin edilmedi)

Kaynaklar: `d15-2026-11-06/live/*.json`, `chain-trace.json`, `calls.jsonl`, `candidate-for-review.json`, git geçmişi
(`questions-for-human-review.json` tek sürüm, `1d92a81`). Gitignored durum dosyası `.codex-setup/d15/` boş (verify
aşaması sildi; zaten soru metni tutmuyordu). Üretim satırları cleanup/verify ile silindi (`generated_questions_absent`).
Ayrıntılı alan alan sonuç: [`d15-recovery.json`](d15-recovery.json) (`node scripts/build-question-review-package.mjs --d15-recovery`).

| Alan | 6 sorunun durumu | Kaynak |
|---|---|---|
| Soru kökü (stem) | **Yok — kurtarılamaz** | Hiçbir artefakta yazılmamış |
| Ortak kaynak başlığı/metni + kimliği (1 grup: B1×2 + B3×1) | **Yok — kurtarılamaz**; yalnız "gruplu" bayrağı ve üye sayısı (3) var | `chain-trace.json` `group:true`, `stage-generate` |
| Grup üyesi soru cümlesi (prompt) | **Yok** | — |
| B2 "görselle iletilen anlam" afiş betimlemesi | **Yok** (AI yolu görsel dosyası üretmez; betimleme soru metnindeydi) | — |
| Görsel dosyası | Beklenmiyor (AI üretimi `visual_description` metni kullanır, dosya yok) | prova-generate şeması |
| Tür | Var (6/6 açık uçlu) | `chain-trace.json` |
| Şıklar / doğru şık | Uygulanamaz (yazılı → açık uçlu) | — |
| Beklenen cevap + alternatif cevaplar | Var | `questions-for-human-review.json` |
| Rubrik (ölçüt/puan, `assesses`) | Var | aynı |
| Kazanım kodu + metni | Var | `chain-trace.json` + `candidate-for-review.json` |
| Kaynak izi (senaryo sürümü, katalog r2, blok, hücreler, kaynak sha256, resmî URL) | Var | `chain-trace.json`, `candidate-for-review.json` |

Kurtarılan alanlarla kurulan en iyi paket doğrulayıcıdan **geçmiyor** (`stem_missing` ×6, `shared_content_missing`,
`shared_prompt_missing` ×3). Bu yüzden D15 için inceleme HTML'i üretilmedi: cevap/rubrik tek başına "soru okunup
çözülebilir" kabulünü karşılamaz. Tam inceleme için yeni pilot gerekir (§5, ayrı iş, çalıştırılmadı).

## 2. Ne yapıldı

| Dosya | Ne |
|---|---|
| `scripts/question-review-package.mjs` | Kütüphane. `collectReviewPackage(serviceClient, {questionIds, scenario})` satırları temizlikten önce okur: tam kök, tür, şıklar + doğru şık, ortak kaynak (grup kimliği/sürümü/başlık/metin/tür; grup kurulmamış AI ortak kaynağı da provenance'tan), grup üyesi soru cümlesi, beklenen cevap, çözüm/açıklama, rubrik (`assesses` dahil), kazanım kodu+metni, kaynak izi (senaryo sürümü, katalog/revizyon, blok, hücreler, kaynak sha256, resmî dosya URL'si). Görseller özel kovadan indirilir, bayt/sha256/MIME sihirli baytı doğrulanır, **data URI** olarak gömülür; imzalı/süreli URL saklanmaz; bozuk/eksik görselde paket kurulmaz (sessizce düşürülmez). `validateReviewPackage` çevrimdışı: tamlık, blok/toplam sayısı, görsel bütünlüğü, içerik sha256, `pending_human_review`/`accepted:false` zorunlu, gizlilik taraması (aile/kullanıcı/çocuk/cihaz kimliği, e-posta, depolama yolu, dosya adı, `requested_by`, `draft_id`, izinli iki alan dışında URL). `renderReviewHtml` tek dosya HTML (CSP `default-src 'none'; img-src data:`; çalışan script yok; paket JSON'u HTML içinde salt veri). `openReviewPackage` yalnız diskteki iki dosyayla yeniden açar; HTML'in gömülü veriden birebir üretildiğini de doğrular (elle düzenlenmiş sayfa yakalanır). |
| `scripts/build-question-review-package.mjs` | CLI: `--open <dir>` (çevrimdışı doğrula), `--render <json> --out <dir>` (içeriği değiştirmeden yeniden çiz), `--d15-recovery`. |
| `docs/release/d15-2026-11-06/run-meb-pilot.mjs` | `review`: senaryo adayının genel müfredat verisini (kazanım metni, kaynak URL) duruma alır. `generate`: üretimden hemen sonra paketi `live/review-package/` altına yazar ve `review_package_complete_before_cleanup` **zorunlu** kontrolü. `cleanup`: paket çevrimdışı tam açılmadan hiçbir şey silmez (eksikse ve sorular duruyorsa önce yeniden dışa aktarır); bilinçli istisna yalnız `--allow-cleanup-without-review-package` (raporda `review_package_gate_overridden`). Eski `questions-for-human-review.json` geriye uyum için yazılmaya devam ediyor. Canlı çıktı dizini `GINA_MEB_PILOT_LIVE_OUT` ile ayrılabilir (bu değişiklik yalnız canlı dalı etkiler; 76/76 yerel koşusundan sonra eklendi, `node --check` temiz). |
| `scripts/d15-meb-pilot-edge.ts` | Deterministik sağlayıcı rubriğine `assesses: "process"` (gerçek v8 şemasıyla eşlik; ilk koşuda paket kapısı bunu yakaladı). |
| `scripts/test-meb-pilot-local.mjs` | Çıktı dizini `GINA_MEB_PILOT_LOCAL_OUT` ile yönlendirilebilir (D15 kaydının üzerine yazılmadı); cleanup+verify sonrası paketin DB'siz açıldığını kontrol eder. |
| `scripts/fixtures/question-review-fixture.mjs` | Sentetik fikstür: 2 bloklu senaryo, 3 soruluk ortak kaynak grubu (2 açık uçlu + 1 çoktan seçmeli) + gerçek PNG görsel, 1 bağımsız soru. Uydurma öğretim metni, `SYN.*` kazanım kodları, kişisel veri yok. |
| `scripts/question-review-package.test.mjs` | Birim testi (DB'siz, sahte servis istemcisi). |
| `scripts/test-question-review-package-local.mjs` + `scripts/test-isolated-services.py --review-package` | İzole yığın testi (gerçek Auth + PostgREST + Storage). |

Görsel davranışı: grubun tüm üyelerine bağlı aynı görsel ortak kaynakta bir kez; yalnız bir soruya bağlıysa soruda.
Ortak kaynak HTML'de bir kez gösterilir, bağlı sorular ayrı numaralanır; her sorunun kayıtlı tam metni açılır bölümde.
`assesses` saklamada isteğe bağlı olduğu için (puanlama sorudan çıkarır) boşsa uyarı, geçersiz değerse hata.

## 3. Test çıktıları (gerçekten çalıştırıldı)

```
node --test scripts/question-review-package.test.mjs                → 4/4 geçti
python3 scripts/test-isolated-services.py --run-local --review-package   → 16/16 geçti; konteynerler + geçici DB silindi
GINA_MEB_PILOT_LOCAL_OUT=docs/release/h03-2026-11-06/meb-pilot-local \
python3 scripts/test-isolated-services.py --run-local --meb-pilot   → 76/76 geçti (D15'in 71'i + 5 H03); konteynerler + DB silindi
node scripts/build-question-review-package.mjs --open docs/release/h03-2026-11-06/fixture-package           → ok (4 soru, 1 ortak kaynak, 1 görsel)
node scripts/build-question-review-package.mjs --open docs/release/h03-2026-11-06/meb-pilot-local/review-package → ok (6 soru, 1 ortak kaynak)
node scripts/build-question-review-package.mjs --d15-recovery        → çıkış 2 (beklenen: D15 içeriği eksik)
deno check --config supabase/functions/deno.json scripts/d15-meb-pilot-edge.ts → temiz
```

İzole fikstür akışı: sentetik veli (`@example.invalid`) + `create_family` → özel kovaya gerçek PNG + `ready` görsel kaynağı →
üretimin sakladığı biçimde senaryo bağlı satırlar, sonlandırılmış grup, üyelere görsel bağı → veli `get_question_context`
ile 3 soruya tek ortak kaynak, `get_question_media` ile 3 bağ görüyor → paket → aile, kullanıcı, nesne silinir; soru, grup,
kaynak satırı, nesne ve Auth kullanıcısının yokluğu kanıtlanır → paket yalnız dosyalardan açılır: ortak kaynak metni/başlığı,
görsel bayt bayt aynı, çoktan seçmeli şıklar + `C`, her soruda kök/kazanım metni/kaynak izi, açık uçlularda cevap + rubrik,
kişisel/depolama verisi yok, HTML'de URL kaynağı yok, `pending_human_review`. Kanıt: [`fixture-isolated-run.json`](fixture-isolated-run.json),
paket [`fixture-package/`](fixture-package/).

MEB zinciri (gerçek resmî indirme, deterministik sağlayıcı): `generate.review_package_complete_before_cleanup`,
`cleanup.review_package_opens_offline_before_cleanup`, `h03.review_package_opens_after_cleanup_without_db`,
`h03.review_package_has_all_generated_questions`, `h03.review_package_shared_source_with_body`. Kanıt:
[`meb-pilot-local/isolated-run.json`](meb-pilot-local/isolated-run.json), paket [`meb-pilot-local/review-package/`](meb-pilot-local/review-package/)
(deterministik içerik; içerik kalitesi kanıtı değildir). Deneme geçmişi: ilk MEB koşusu 72/76 — paket kapısı deterministik
rubrikte `assesses` yokluğunu yakaladı ve temizliği durdurdu (kapının çalıştığının kanıtı); sağlayıcı v8'e eşitlendi,
doğrulayıcıda boş `assesses` uyarıya indirildi (saklama sözleşmesiyle aynı); ikinci koşu 76/76.

## 4. Ayrım ve sınırlar

- **Kod/test**: tamam (yukarıdaki komutlar). **Canlı**: yok — üretimde paket henüz hiç üretilmedi. **İçerik kabulü**: yok —
  paket `pending_human_review`, `accepted:false` taşır; insan kararı ayrıca (`review_scenario_question_fit` / C05 akışı) kaydedilmeli.
- Paket servis rolüyle okur; yalnız pilot/işletim betiklerinde kullanılır, istemciye açılmadı. Görsel boyutu tek başına 10 MB ile sınırlı (kova sınırı).
- Görsel bağlantısı olan **AI** sorusu bugünkü üretim yolunda yok; görsel yolu izole fikstürde (veli/kütüphane biçimi bağlar) test edildi.
- `docs/release/d15-2026-11-06/README.md` ve `live/` kayıtları tarihsel olduğu için değiştirilmedi.

## 5. Ayrı iş (çalıştırılmadı): D15 içeriği için yeni pilot — kapsam ve maliyet

Amaç yalnız tam inceleme paketi üretmek; kütüphane havuzu üretimi değildir.

- **Ücretli çağrı: tam 1** (`prova-generate`, 6 soru, Sonnet; D15'te 67 sn). Yeniden deneme yok: sonuç `failed`/`uncertain`
  ise durulur. Token sayısı D15 kayıtlarında yok; gerçek tutar sağlayıcı faturasından okunmalı. Sentetik aileye 3 saatlik
  gerekçeli Pro hakkı; 6 öğe hak düşer (sentetik aile, temizlikte silinir).
- **Ön koşul (üretimde hazır)**: migration `20261106440000` D15'te dağıtıldı; resmî kaynak revizyonu onaylı ve kovada;
  `source` aşaması `unchanged`, `extract` "zaten çıkarılmış" yolunu kullanır (yeni revizyon/iş açmaz). Bu dal main'e
  birleşmeden koşulmamalı (yeni `generate`/`cleanup` kapısı gerekir).
- **Enes onayı gerekenler**: (1) üretimde koşu; (2) yönetici kimliği — geçici sentetik yönetici veya kendi oturumu
  (`GINA_ADMIN_ACCESS_TOKEN`, değer yazılmaz); (3) geri çekilmiş `tr-2026-2027-t1-turkce2-g5-c6` adayının backoffice'te
  **yeniden incelenip yayımlanması** (şema geri çekilmişten yeniden incelemeye izin veriyor; editoryal karar, betik
  bayraksız yalnız doğrular); (4) pilot sonunda yeniden `--withdraw`.
- **Sıra**: `preflight → setup → override → admin-setup → source → extract → review (Enes yayımladıktan sonra) → scope →
  select → generate (★ tek ücretli; paket burada yazılır) → assign → cleanup --withdraw (paket kapısı) → verify`.
- **Çıktı**: `GINA_MEB_PILOT_LIVE_OUT=docs/release/<yeni-kart>/live` ile ayrı dizin (bu dalda eklendi; verilmezse D15'in
  `live/` dizinine yazar ve D15 kayıtlarının üzerine gelir). Ücret tavanı o dizindeki `calls.jsonl`'a göre sayılır; yeni
  dizinde tek çağrı hedefi için operatör `generate`'i bir kez çalıştırır. Paket: `<dizin>/review-package/review-package.{html,json}`.
  Ardından **insan içerik incelemesi** (ayrı, kabulün asıl koşulu).
