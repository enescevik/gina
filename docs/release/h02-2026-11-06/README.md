# H02 — MEB kaynağını panelden edinme ve çıkarma

6 Kasım 2026. Kart: [CLAUDE-REMAINING-WORK §H02](../../CLAUDE-REMAINING-WORK.md). Önceki işler: [C05](../c05-2026-11-06/README.md), [D15](../d15-2026-11-06/README.md).
Dal: `worktree-agent-aa0722c8ad3ed38d4` (taban `12115bc`). **Main'e push edilmedi; üretim DB'sine yazılmadı; Edge dağıtımı yapılmadı; ücretli AI çağrısı yok.**

**Durum: KOD HAZIR · İZOLE ORTAMDA TEST EDİLDİ · YAYINDA DEĞİL.** Gerçek hesapla barındırılan ortamda kabul ayrı adımdır (aşağıda).

## Sorun → çözüm

| Bulgu | Çözüm |
|---|---|
| İlk indirme mevcut kaynak kartına bağlıydı; boş katalogda başlangıç yolu yoktu | «Resmî dizin hedefleri» tablosunda her **etkin** hedefin «İlk indirme» düğmesi: sunucu kayıtlı dizin sayfasını okur (`curriculum-source-fetch` `action: "list_links"`, yazma yok), yönetici dersi seçer; dizinde aynı ders birden çok kez geçiyorsa (İngilizce, DKAB) **kademe zorunlu** (Ortaokul 5–8 / Lise 9–12), tahmin yok. İndirme mevcut politika ile sunucuda yapılır. |
| Çıkarma, yönetici token'ı kopyalanan bir terminal komutu istiyordu | Python çıkarıcı **Deno'ya taşındı** (`supabase/functions/_shared/meb-extract.ts`) ve yeni `curriculum-source-extract` Edge fonksiyonu yöneticinin **kendi panel oturumuyla** sürüm başına çalışır. Terminal komutu ve token metni panelden kaldırıldı. |

## Mimari karar: Deno portu (kuyruk + işçi değil)

Kartın tercih ettiği yol uygulandı, çünkü çıkarım deterministik ve küçük: **16 resmî 2026–2027/1 dosyasının 16'sında Python ile bayt bayt aynı aday paketi** (toplam 648 aday). Ölçülen süre (Deno 2.9.8, yerel): ısınmış 20–60 ms, ilk çağrı ≤ 0,6 s / dosya (≈ 30 KB XLSX). Bu yüzden ayrı işçi ve hizmet kimlik bilgisi gerekmedi; Python `--process-queue` yalnız parite/başvuru aracı olarak kaldı (üretim işletimi için gerekmez).

Akış: **kayıtlı hedef → dizin bağlantıları → ders (+kademe) → sunucu indirmesi (sürüm `pending_review`, çıkarma `queued`) → «Adayları çıkar» → kilit → bayt (özel kova; yoksa aynı politika ile resmî adres) → SHA-256 → Deno çıkarıcı → idempotent taslak içe alma → aday listesinde taslak inceleme.** Kaynak onayı ve senaryo yayını ayrı yönetici kararları olarak değişmedi.

## Değişen dosyalar

- **DB:** `supabase/migrations/20261106470000_curriculum_panel_extraction.sql` (atanan yuva), pgTAP `supabase/tests/132_curriculum_panel_extraction.test.sql` (atanan numara).
  - `gina.curriculum_source_revisions`: `extraction_started_at/by`, `extraction_attempts`, `extraction_last_error` (geçici hata nedeni; karar değil).
  - Yalnız servis (anon/authenticated çalıştıramaz): `begin_curriculum_extraction` (3 dk kilit; `claimed | in_progress | already_done | closed`), `record_curriculum_extraction_service`, `release_curriculum_extraction`. Her çağrı aktörün **canlı** `public.admins` kaydını yeniden denetler (geri alınmış yönetici JWT'si burada durur).
  - Tek uygulama `gina.curriculum_extraction_apply(actor, …)`; `admin_record_curriculum_extraction` aynı sözleşmeyle (`assert_admin`) buna devreder — pgTAP 111 değişmeden geçiyor. Bu fonksiyon C07'nin 24 rol denetimli RPC'sinden biri değildir; o 24'e dokunulmadı (pgTAP 113 geçiyor).
  - Tetikleyici `reject_duplicate_curriculum_revision`: aynı yıl/dönemde aynı SHA-256 başka bir kaynak kartına ikinci kez yazılamaz (`curriculum_source_duplicate`, kart da geri alınır).
  - Panel okuma modelleri: kaynak projeksiyonu ve `admin_curriculum_pipeline` kuyruğu `extraction_running/attempts/last_error`, `draft_candidates`, `stored`; `operator_step` artık `panel:curriculum-source-extract` (komut yok).
- **Edge:** yeni `supabase/functions/curriculum-source-extract/{index,handler,handler.test}.ts`; `curriculum-source-fetch/handler.ts` (`list_links`, isteğe bağlı `level`, `source_duplicate` 409); `_shared/meb-extract.ts` (+ test, golden); `supabase/config.toml` (`verify_jwt = true`), `supabase/functions/README.md`.
- **Backoffice:** `curriculum-pipeline.tsx` (ilk indirme, kuyrukta «Adayları çıkar / Çıkarmayı yeniden dene», durum/deneme/son hata), `curriculum-sources.tsx` (sürüm satırında çıkarma düğmesi, kademe etiketi, boş katalog yönlendirmesi, taslak sayısı), `curriculum-review.tsx` (çıkarma sonrası aday listesi kendiliğinden yenilenir), `review-rpc.ts`.
- **Core:** `curriculum-review.ts` (hedefte `level`, sürümde isteğe bağlı çıkarma alanları) + test; `database.types.ts` yeniden üretildi (`gen-db-types-isolated.sh`; yalnız 3 yeni servis RPC'si).
- **Python:** `prepare-curriculum-review.py` sınav başlığı yoksa artık çökmek yerine `exam_scope_unresolved` (iki çıkarıcı aynı kararı veriyor); `fetch-curriculum-sources.py` yalnız açıklama.
- **Test altyapısı (dağıtılmaz):** `scripts/test-meb-extract-parity.py` + `scripts/meb-extract-parity.ts`, `scripts/test-h02-panel-extraction.py` + `scripts/test-h02-backoffice-ui.cjs`, `scripts/c05-edge-runtime/main/index.ts` (yeni servis), `scripts/test-c05-backoffice-ui.cjs` (eski komut iddiası güncellendi), `.github/workflows/ci.yml` (yeni Deno satırı).

## Korunan denetimler

- **Host/DNS/SSRF:** çıkarma yolunda baytlar yalnız `fetchWithPolicy` ile (HTTPS, izinli MEB/EBA host'ları, `meb.ai` yalnız ara atlama, her atlamada genel IP, 15 s, 5 MB). İzole zincirde benzer ad (`cdn.eba.gov.tr.…invalid`), `http`, `169.254.169.254`, kullanıcı bilgili URL reddedildi; Deno testinde özel IP (`10.0.0.5`) reddi. `list_links` yalnız ilk atlaması politikaya uyan bağlantıları döndürür; sayfa metni politika genişletmez.
- **Hash:** saklanan kopya sürüm özetine uymazsa kullanılmaz; resmî adresten gelen bayt uymazsa gerekçeli `failed` (`hash_changed_since_fetch`). Aday paketi her aday için aynı SHA-256, yıl/dönem/ders zorunluluğu (sunucu kuralı değişmedi).
- **ZIP/boyut:** Python ile aynı 40 MB açılım sınırı (merkez dizinden, ayrıştırmadan önce); açılan veri bildirilen boyutu aşamaz; CRC denetimi; çalışma sayfası yolu `xl/worksheets/` dışına çıkamaz; DOCTYPE/varlık bildirimi reddedilir; formül/makro/dış bağlantı çalıştırılmaz.
- **Rol:** Edge `readAdmin` (canlı kullanıcı + `gina.admin` claim + `admins` satırı) ve DB'de her servis çağrısında canlı `admins` denetimi.
- **Ayrım:** kaynak onayı (`admin_review_curriculum_source_revision`) ve aday yayını (`admin_change_curriculum_candidate`) dokunulmadı; çıkarım yalnız `draft` aday yazar. Hiçbir kayıt silinmez. `curriculum_catalog.enabled` değiştirilmedi (izole zincir başta ve sonda `false` doğruladı).

## Testler (gerçekten çalıştırıldı)

Ayrım: **gerçek** = resmî ÖDSGM/`meb.ai`/EBA ağına gerçek HTTPS, gerçek Postgres/Auth/PostgREST, gerçek Supabase edge-runtime v1.77.8 imajı; **izole** = tek kullanımlık DB/konteynerler, sentetik `example.invalid` hesaplar; **sahte** = Deno birim testlerinde ağ/DB sahteleri. Kova (Storage) izole zincirde çalıştırılmadı.

| Test | Komut | Sonuç |
|---|---|---|
| Python ↔ Deno paritesi | `python3 scripts/test-meb-extract-parity.py --out docs/release/h02-2026-11-06/parity-report.json` | **31/31**; 16 resmî dosya bayt bayt aynı (648 aday); 15 negatif/kenar durum ([parity-report.json](parity-report.json)) |
| İzole uçtan uca + Playwright | `GINA_QA_PLAYWRIGHT_PATH=… python3 scripts/test-h02-panel-extraction.py --run-local --with-ui` | **31/31** (iki ardışık koşu), UI turu 12/12 ([chain-checks.json](chain-checks.json)); konteynerler ve DB silindi |
| pgTAP 132 | `python3 scripts/test-q02-sql.py --run-local --only 132` | **64/64** |
| pgTAP 111 / 113 / 102 / 087 / 129 | `--only …` | 106 / 191 / 16 / 54 / 47, hata yok |
| Tam pgTAP UTC / Europe/Istanbul | `python3 scripts/test-q02-sql.py --run-local --timezone … --out docs/release/h02-2026-11-06/pgtap-…` | 130 dosya, 5981 kontrol, 0 hata (iki saat dilimi) |
| Deno (CI satırı 52 + yeni satır) | `deno test --frozen-lockfile --config supabase/functions/deno.json …` | **294 + 15 geçti, 0 hata** (yeni: `meb-extract.test.ts` 8, `curriculum-source-extract/handler.test.ts` 7, `curriculum-source-fetch` +2) |
| Deno check | `curriculum-source-extract/index.ts`, `curriculum-source-fetch/index.ts` | temiz |
| Python | `test-meb-scenarios.py` 22 OK, `test-curriculum-review.py` OK, `test-curriculum-candidates.py` OK | geçti |
| Core | `pnpm --filter @gina/core test`, `tsc --noEmit` | 64 dosya, 457 test; temiz |
| Backoffice | `typecheck` / `lint` / `build` (yer tutucu `NEXT_PUBLIC_SUPABASE_URL=http://gina-c05ui.invalid`) | 0 / 0 / 0 |

### Kabul ölçütleri → kanıt

| Kabul | Kanıt |
|---|---|
| İzole **boş** katalogdan indirme → çıkarma → taslak inceleme panelden | `isolated_catalogue_empty`; masaüstü turu: [01 boş katalog](ui/desktop-01-empty-catalogue-registered-target.png) → [02 resmî bağlantılar](ui/desktop-02-official-index-links.png) → [03 indirildi](ui/desktop-03-first-download-done-queued.png) → [04 46 taslak](ui/desktop-04-extracted-46-drafts.png) → [05 kaynak kartı](ui/desktop-05-source-card-extracted.png) → [06 taslak inceleme](ui/desktop-06-draft-review-detail.png) |
| Masaüstü **1280×800** ve tablet **768×1024** | Tablet turu: [01 kademe zorunlu](ui/tablet-01-per-level-subject-needs-level.png) → [02 indirildi](ui/tablet-02-level-download-done.png) → [03 kuyruktan çıkarıldı](ui/tablet-03-extracted-from-queue.png) → [04 kademeli kart](ui/tablet-04-level-source-card.png) → [05 taslak inceleme](ui/tablet-05-draft-review-detail.png); her ekranda yatay taşma ve sayfa hatası yok |
| Yetkisiz rol | Veli `list_links`/çıkarma 403, anonim 401/403; pgTAP: veli, yönetici JWT'siyle doğrudan servis yolu, bilinmeyen aktör 42501 |
| Geri alınmış rol | `admins` satırı silinmiş ama JWT'si geçerli yönetici: çıkarma 403, indirme 403, hiçbir sayaç değişmedi (deneme sayısı 0); pgTAP: begin/record/release ve panel okuma 42501 |
| Eşzamanlı tıklama | İki paralel istek → tam bir `done` (36 aday), diğeri `extraction_in_progress`/`already_done`; UI'da çift tıklama = **1 deneme**; pgTAP: ikinci yöneticinin talebi `in_progress`, süresi geçmiş kilit (çöken işçi) yeniden alınabilir |
| Aynı hash | Aynı dosya tekrar → `unchanged`, sürüm sayısı değişmez; aynı paket tekrar → `unchanged`, aday sayısı aynı; kayıp yanıt tekrarı aynı makbuz; aynı bayt başka karta → `source_duplicate`, kart açılmaz |
| Değişen kaynak | Bayt sürüm özetine uymuyor → `failed` + `hash_changed_since_fetch`; yeniden deneme aynı karar (2. deneme); pgTAP: yeni hash ayrı kuyruk sürümü, aynı bayta farklı çıktı `curriculum_extraction_conflict` (üzerine yazmaz) |
| Ağ / çıkarma hatası | Resmî dosya 404 → 502 `source_unreachable`, sürüm `queued`, neden görünür, kilit serbest; çıkarıcı istisnası → 500 `extractor_error`, kilit serbest; bozuk/HTML/kesik dosya → gerekçeli `failed` |
| Mükerrer kayıt ve otomatik yayın yok | Fizik 36 aday = depodaki Python çıkarımı (anahtarlar birebir); tekrar tıklama `already_done`; son durum: 0 onaylı sürüm, 0 yayımlı aday, adaylar `draft` |
| Üretim kayıtları silinmiyor | Migration silme/sıfırlama içermez; pgTAP 132 sonunda tüm sürüm/adaylar duruyor (kenara konan dahil) |
| Genel katalog açılmıyor | Migration `app_settings`'e dokunmaz; izole zincir başta/sonda `curriculum_catalog.enabled=false` |

### Tam pgTAP

UTC: **130 dosya, 5981 kontrol, 0 hata** ([pgtap-utc](pgtap-utc/)). Europe/Istanbul: **130 dosya, 5981 kontrol, 0 hata** ([pgtap-istanbul](pgtap-istanbul/)). Migration'lar boş şablon klonuna uygulandı; uygulama/demo DB'sine dokunulmadı.

## Python'dan bilinçli farklar (hiçbirinde farklı aday üretilmez)

DOCTYPE/varlık bildirimi, UTF-8 dışı XML, ZIP64, şifreli veya deflate/stored dışı ZIP girdisi Deno'da **reddedilir** (Python bazılarını açardı). Python aracının çöktüğü girdiler (ör. olmayan paylaşılan metin dizini → `IndexError`) Deno'da gerekçeli `failed` kararıdır. Unicode `\s`/`\d`/`\b`, `str.split()`, `int()` Unicode rakamları, kod noktası sıralaması Python'la aynı uygulandı ve test edildi.

## Üretim / gerçek hesap adımları (yapılmadı)

1. Migration `20261106470000_curriculum_panel_extraction.sql` (C14c ledger'ı `20261106450000` sonrası; diğer H yuvalarıyla sırası koordinatörde).
2. `supabase functions deploy curriculum-source-fetch` (değişti) ve `supabase functions deploy curriculum-source-extract` (yeni; `verify_jwt = true`). Barındırılan ortamda Edge'in kendi `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` değişkenleri yeterli; yeni sır yok.
3. Yönetim sitesinin (backoffice) yeniden derlenip yayımlanması.
4. Dağıtım sonrası tek kabul: gerçek yönetici oturumuyla bir dersin ilk indirmesi + çıkarması (yalnız `draft` aday yazar; onay/yayın yapılmaz). Barındırılan Edge CPU süresinin ve `gina-curriculum-sources` kovasından okumanın (`origin: "storage"`) burada doğrulanması gerekir — izole zincirde kova çalışmadı (`stored:false`, baytlar resmî adresten okundu).

## Sınırlar

- Barındırılan Edge CPU/duvar saati sınırı ölçülmedi; yerel ölçüm ≈ 30 KB dosyada ≤ 0,6 s. 5 MB'a yakın bir çalışma kitabı denenmedi; zaman aşımında kilit 3 dk sonra serbest kalır ve deneme sayısı görünür.
- Kova okuma yolu yalnız Deno birim testinde (sahte indirme) kanıtlı.
- Veli tarafı `get_curriculum_source_status` aynı etiketli iki kademe kaynağında (İngilizce/DKAB) ilk oluşturulanın güncelliğini gösterir; H02 kapsamı dışında bırakıldı.
- DNS yeniden bağlama penceresi (IP denetimi ile bağlantı arasında) C05'teki gibi açık.
- Backoffice web aracıdır; fiziksel cihaz testi yok, kanıt Playwright (sistem Chrome) ekran görüntüleridir. Gerçek yönetici hesabıyla kabul yapılmadı.
- Üretilen adayların editoryal doğruluğu insan incelemesi gerektirir; bu kart yalnız edinme/çıkarma yazılımıdır.
