# P05/B02 — Kütüphane yaşam döngüsü, hak güvenliği ve Birlikte Prova sınırı (sunucu)

6 Kasım 2026 gece paketi. Yalnız **sunucu + core + Edge**: migration `20261106110000_library_credit_safety.sql`, pgTAP `098_library_credit_safety.test.sql`, `scripts/test-library-credit-races.py`, `packages/core/src/library-lifecycle.ts`, `supabase/functions/contribution-submit/` (isteğe bağlı `supersedes`). **UI bağlanmadı, hiçbir şey yayımlanmadı.** Mobil `parent/prova/{library,share,groups}` ve backoffice kütüphane sayfalarına dokunulmadı. Üretim Supabase'e ve yerel demo DB'ye yazılmadı; bütün SQL kontrolleri boş `gina_completion_audit` şablonundan kurulan tek kullanımlık veritabanlarında çalıştı, `db reset` yok. **Editoryal onay (X06) ve AI ön inceleme (E01) ayrı kademedir; bu paket onların yerine geçmez.**

Dal: `worktree-agent-a44561681d1287b53` (main üzerine, `772b994` sonrası). Commit'ler: `ea077b7` (migration + pgTAP 098), `3e6d326` (yarış betiği, core, Edge), docs commit'i aşağıda.

## Model

Veri taşınmadı. Mevcut tablolar (`gina.library_import_packages/publications/editorial_reviews`, `gina.contribution_sets`, `public.library_items/collections/question_contributions`, `gina.content_prereviews`) tek okunur görünümde birleşti:

| Alan | Anlam |
|---|---|
| `kind` | `package` (taslak/yayın paketi) · `contribution_set` (aile katkı kopyası) · `legacy_item` · `collection` · `legacy_contribution` |
| `status` | `draft` → `reviewed` (ilk editoryal karar / ret) → `approved` (bütün sorular `suitable`) → `published` (yayın kararı) → `withdrawn` (arşiv/geri çekme). Reddedilen katkı `reviewed` + `admin_decision='rejected'`; geri çekilen `withdrawn`. |
| `live` | Aileye gerçekten sunuluyor mu: yayın `published` **ve** inceleme parmak izi güncel **ve** medya tam. `approved` hiçbir zaman `live` değildir. |
| `version` / `publication_version` | Paket sürümü (`revision`) ve ayrı yayın sürümü; katkıda zincir içindeki sıra. |
| `series_key` / `previous_id` | Paket anahtarı ve önceki sürüm; katkıda `chain_id` ve `supersedes_id`. |
| `source_family_id` | Katkı kaynağı aile (paketlerde katkıdan geliyorsa). |
| `prereview_status` | E01 AI ön inceleme durumu (yönetici kararından ayrı sütun). |

Görünüm `gina` şemasında, API rollerine kapalı; yalnız `admin_library_content_items(p_kind,p_status,p_limit)` ile okunur.

## Sözleşmeler

| RPC / nesne | Kim | Davranış |
|---|---|---|
| `admin_library_content_items(p_kind,p_status,p_limit≤500)` | yönetici | Birleşik liste, `updated_at desc`. Veli → `forbidden`. |
| `admin_library_package_trail(p_package_id)` | yönetici | Aynı `package_key` altındaki bütün sürümler; sürüm başına durum/`live`/yayın sürümü/ön inceleme ve soru başına son editoryal karar + not. |
| `family_library_credits(p_family_id default null)` | veli (kendi ailesi) · yönetici/servis (aile zorunlu) | `monthly{limit,used,remaining,period_start,renews_at}`, `bonus{earned,used,remaining,grants[]}`, `total_remaining`, `contributions{accepted_questions,credited_sets,pending_sets,next_milestones[]}`. Aylık sayım `gina.library_month_used` ile aynı (eski koleksiyon + paket edinimleri). |
| `library_policy_preview(p_accepted_count,p_rules default null)` | veli/yönetici/servis | Kural başına `milestones/granted/next_at`, türe göre toplamlar (`library`, `ai_questions`, `plan_days` = `least(amount,valid_days)` kuralıyla), aynı türden iki kuralın yığıldığı ilk ortak kat ve sıradaki kilometre taşı. `p_rules` boşsa açık `contribution_rewards`. Geçersiz kural → `invalid_input`. Arşiv/not kotası burada değil. |
| `admin_library_group_integrity(p_limit)` | yönetici | Kopuk kopya raporu: edinim ücret sayısı ≠ soru sayısı, grup üye sayısı ≠ birim, sonlandırılmamış grup, eksik görsel bağı, kısmi katkı paketi, kohort kaydında eksik soru. Boş `[]` = bütünlük tam. |
| `begin_question_contribution(p_id,p_question_id,p_rights,p_no_personal_data,p_supersedes default null)` | veli | Eski 4 parametreli çağrı aynen çalışır (Edge `contribution-submit` dâhil). Reddedilen kopya aynı soru veya aynı ortak kaynak serisi için **otomatik** bağlanır; `p_supersedes` ile açıkça da bağlanır. `contribution_unchanged` (içerik değişmeden tekrar), `contribution_supersede_invalid` (kabul edilmiş/bekleyen kopya), `contribution_supersede_taken` (ikinci düzeltme), `request_conflict` (aynı istek farklı bağ). |
| `contribution_review_trail(p_id)` | veli (kendi ailesi) · yönetici | Zincir adımları: sürüm, durum, karar, ret notu, inceleme zamanı, paket ve paket durumu, E01 durumu; `current`. Veli görünümünde aile/soru/inceleyici kimlikleri yoktur. |
| `group_exam_phases(p_group)` | veli (yayımlı grup veya kendi kaydı) · yönetici | `participation{starts_at,ends_at,open,phase}` · `child_time{duration_minutes,one_attempt}` · `review{required,phase: automatic\|waiting_for_window\|in_review\|appeals_open\|ready_to_publish\|published,pending,unfinished,appeals,published}` · `ranking{optional:true,consent_required:true,secondary:true,eligible_entries,excluded{reason:n},mine[]}`. |
| `gina.cohort_ranking_rows(p_group)` | iç | Sıralamaya girebilen kayıt: rıza **ve** deneme bitmiş **ve** bütün satırlar puanlanmış (okunamayan yok) **ve** incelemeli kohortta sonuçlar yayımlanmış. Neden öncelik sırası: `no_consent > unfinished > unreadable > unscored > results_not_published`. |
| `get_group_result` / `gina.automatic_group_result` | veli | Tablo yalnız uygun kayıtlardan kurulur; yanıt `ranked`, `ranking_reason`, `ranking_optional:true`, otomatikte `interim` ekler. Kendi ara sayımı görünür, tabloya girmez. |

### Değişmezlik (trigger ile kanıtlı)

- `gina.library_publications`: yalnız `version = eski+1` ve aynı paketle güncellenir; silinemez (`library_publication_immutable`).
- `public.library_items`: `published/archived` veya ailece edinilmiş öğenin `content/content_hash/collection_id` değişmez, silinemez; durum geçişi (yayımla/arşivle) serbest (`library_item_immutable`).
- `public.group_exam_questions`: herhangi bir aile kayıt olduktan sonra güncellenemez/silinemez (`group_exam_locked`).
- `gina.library_acquisitions`: blok yalnız `{}` iken bir kez dolar; aile var olduğu sürece silinemez. `gina.library_acquisition_charges`: yalnız eklenir; `question_id` benzersiz (bir kopya tek edinime ait). Aile silme kaskadı çalışır.
- `gina.contribution_sets`: kabul edilmiş kopyanın durumu/anlık görüntüsü/paketi değişmez (`contribution_already_accepted`); `chain_id/supersedes_id` yeniden yazılamaz (`contribution_chain_immutable`).
- Paket içerik tabloları zaten `library_import_immutable` ile donuktu; yeni sürüm ayrı satırdır, yayımlı sürüm ve `get_published_library_packages` çıktısı değişmez (098'de kanıt).

### Hak kuralı

Aynı birim ikinci kez hak tüketmez: aynı istek makbuzu aynı sonucu döndürür, farklı istekle sahip olunan birim `charged=0`; ücret satırı soru kopyası başına tektir. Katkı kabulü `contribution_commands` makbuzu + `contribution_question_credits(fingerprint)` + `learning_credit_grants unique(family,policy,milestone)` ile tek hak verir; aynı kopyaya ikinci kabul `contribution_changed`. Yayın hak vermez.

### Kaynaklı soru grubu

Edinim (`source:` birimi), katkı anlık görüntüsü (bütün üyeler + aynı görseller) ve kohort kaydı zaten grup bazlı atomiktir; grouped üyeyi tek başına edinmek `library_unit_unavailable`, üye silmek `question_group_immutable`. **Kısmi katkı kabulü iş kuralında yok ve uygulanmadı**: sunucu bütün sorular için öğretmen alanı ister (`contribution_review_required`). Etki önerisi: kısmi kabul istenirse (a) kabul edilmeyen üyeler paket dışında kalırsa ortak kaynak bağlamı eksik soruyla yayımlanır — bu, grup bütünlüğü ilkesine aykırı; (b) doğru yol, yöneticinin kopyayı reddedip hangi soruların düzeltilmesi gerektiğini notta söylemesi ve velinin düzeltilmiş kopyayı `supersedes` ile göndermesidir (bu iş akışı artık izlenebilir); (c) hak, yalnız kabul edilen bütün kopya için verilir. Bu nedenle kısmi kabul için ayrı RPC açılması önerilmez.

## Testler (gerçekten çalıştırıldı)

- **pgTAP, izole DB** `gina_p05_credit_audit` (şablon `gina_completion_audit`, 0 aile/0 kullanıcı; ≥ `20261103093000` migration'lar + yeni migration): yeni `098_library_credit_safety.test.sql` **155 kontrol, 0 başarısız** — yaşam döngüsü (draft→reviewed→approved→published→withdrawn; onay yayın değil; 2. sürüm taslağı canlıyı değiştirmez; parmak izi/yayın değişmezliği; eski öğe dondurma; görünüm birleştirme), hak (aynı istek, farklı istek, kota, benzersiz ücret, değişmez edinim; `family_library_credits` veli/yönetici/çocuk sınırları), politika önizleme (yığılma, sıradaki eşik, devre dışı kural, plan günü, geçersiz girdi, anon), katkı (bütün grup anlık görüntüsü, kısmi kabul reddi, çift kabul/çift hak yok, kabul edilen kopya değişmez, `source_family_id`), ret zinciri (otomatik bağ, değişmemiş içerik, kabul edilmişi geçersiz kılma, izleme RPC'si veli/yönetici/başka aile, zincir değişmezliği), Birlikte Prova (katılım/çocuk süresi/inceleme fazları; bitmemiş kayıt tabloda yok ve `interim`; bitirince sıralanır; çocuk oturumu/başka aile/yönetici sınırları; incelemeli kohortta `unscored` → `unreadable` → `results_not_published` → yayın sonrası sıralı → rıza geri alınca `no_consent`, kendi puanı görünür; kohort soruları dondurulur).
- **Tüm pgTAP regresyonu** aynı şablonun klonunda: **92 dosya / 3.037 kontrol**, [sql-checks.json](sql-checks.json). 90 dosya temiz; `083_school_grade_lifecycle` (3 kontrol) ve `088_period_transfer` (3 kontrol) düşüyor. Yeni migration **olmadan** kurulan kontrol DB'sinde (`gina_p05_control_audit`) **aynı 6 kontrol aynı şekilde** düşüyor; bu başarısızlık bu pakete ait değil (tarih/dönem duyarlı L03/L01 testleri, ayrı bulgu olarak bırakıldı).
- **Yarışlar** `python3 scripts/test-library-credit-races.py --template gina_p05_credit_audit` → [credit-races.json](credit-races.json), 6/6: `acquire_same_request` (2 başarı, 1 edinim, 3 ücret), `acquire_other_request` (aynı), `acquire_two_units_quota` (1 başarı + `library_quota_exceeded`), `accept_twice` (1 kabul, 1 hak, `contribution_changed`), `accept_and_publish` (kabul 1 hak; eş zamanlı yayın `library_publication_input` — paket henüz yok; var olduğunda inceleme şartı 098'de), `publish_same_version` (1 yayın, sürüm 2, `library_publication_changed`). Her senaryoda `admin_library_group_integrity()=[]`.
- **Mevcut yarış regresyonları** aynı şablonla: `test-library-acquisition-races.py`, `test-library-import-races.py`, `test-contribution-races.py`, `test-group-package-races.py`, `test-group-enrollment-races.py`, `test-cohort-review-races.py` — hepsi `passed`.
- **Deno** `deno test --frozen-lockfile --config supabase/functions/deno.json contribution-submit/`: **9 geçti / 1 başarısız**. Başarısız olan `real renderer preserves two ordered images and the empty gap`, değişiklikten **önce de** (HEAD'deki orijinal test dosyasıyla 7/8) aynı şekilde düşüyor; gerçek `renderSvg` bu makinede 400 döndürüyor (resvg-wasm ortamı), bu paketle ilgisi yok. Yeni 2 test (uuid doğrulama + `supersedes` aktarımı; zincir hata kodları) geçti.
- **Core** `pnpm --filter @gina/core test` → **46 dosya / 301 test geçti** (yeni `library-lifecycle.test.ts` 9 test: politika önizleme SQL ile aynı sayılar, hak tüketimi, `approved≠served`, zincir, sıralama uygunluk önceliği). `tsc --noEmit`: yeni dosyalar temiz; `period-transfer.test.ts`'te önceden var olan `noUncheckedIndexedAccess` hataları değişmedi.

## Yapılmayanlar / kalan sınır

- **UI bağlanmadı:** mobil kütüphane/paylaşım/grup ekranları ve backoffice kütüphane/yayın/katkı/grup sayfaları yeni RPC'leri kullanmıyor (Q00 ve B02/B03 ekran işi). Hak özeti, düzeltme zinciri ve faz/sıralama alanları yalnız RPC'de.
- **Yayımlanmadı:** migration üretime uygulanmadı; `library_packages.enabled`, `contribution_sets.enabled`, `cohorts.enabled`, `question_groups.enabled`, `sources.enabled` kapıları değişmedi; Edge `contribution-submit` dağıtılmadı.
- **Editoryal/AI kademesi ayrı:** `approved` yalnız editoryal uygunluk toplamıdır; E01 `ai_approved` ve bağımsız eğitimci (X06) onayı bu görünümde ayrı alanlardır ve yayın kararı için gereken `admin_set_library_publication` kuralları değişmedi.
- **Kısmi katkı kabulü** uygulanmadı (yukarıdaki etki önerisi). Ret notu serbest metindir; yapılandırılmış ret nedeni kataloğu eklenmedi.
- `get_group_result` incelemeli yolunda `topics` hâlâ boş döner (önceki davranış); yalnız sıralama alanları eklendi. Otomatik kohortta `settle_group_attempts` yalnız `deadline_at` geçince kapatır; pencere kapanıp süre dolmamışsa deneme `unfinished` sayılır ve tabloya girmez — davranış değişmedi, yalnız görünür kılındı.
- Kontrol/dev DB'leri (`gina_p05_dev_audit`, `gina_p05_control_audit`) silindi; `gina_p05_credit_audit` yeniden üretim için tutuldu (yalnız sentetik fixture, aile/kullanıcı yok).
