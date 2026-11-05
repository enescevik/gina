# S04 uygulaması: ders kataloğu ve kaynaklı takvim taslağı (6 Kasım 2026)

Gece S04 uygulama ajanı (Claude Opus 5.5). Dal `worktree-agent-a1aab5d7f831ce8b1`, taban main `02b659b` (F01/S04 karar commit'i). Çalışma 01:27–02:15 Europe/Istanbul. **Main'e push edilmedi; üretim DB'sine dokunulmadı.** Bütün DB işleri tek kullanımlık veritabanlarında yapıldı ve silindi.

Kaynak kararlar: [DECISIONS.md "F01 ve S04 kararları"](../../DECISIONS.md). 20 yeni ders kimliği eklenir; eşleşme her zaman veli onaylıdır; 4 parçalı dönem modeli korunur; Düzce yayımlanmaz.

## Ne yapıldı

### 1. Migration `supabase/migrations/20261106180000_subject_catalog_and_calendar_seed.sql`

- **20 yeni `subject-*` kimliği** `public.guided_input_options` tablosuna eklendi: Almanca, Fransızca, DKAB, İnkılap, Beden, Görsel Sanatlar, Müzik, Bilişim, Teknoloji-Tasarım, Trafik, Sağlık Bilgisi-Trafik Kültürü, İHVD, Rehberlik, Serbest Etkinlikler, Felsefe, Sosyal Bilim Çalışmaları, Kur'an-ı Kerim, Siyer, Temel Dinî Bilgiler, Seçmeli (diğer). Sınıf kapsamı JSON'daki `grades` alanının en küçük–en büyük değeri, sıra 130–320. Ekleme `on conflict (id) do nothing` ile yapılıyor; mevcut 12 kimlik değişmiyor, sonradan yapılan yönetici düzenlemesinin üzerine yazılmıyor (pgTAP'te test edildi).
- **`gina.subject_synonyms(alias_normalized, alias, subject_id, grade_min, grade_max, source)`**: 279 satır. `subject-synonyms.json` dosyasındaki 32 dersin bütün eşanlamlıları ve TR/EN etiketleri buraya girdi. Sınıf listesi kesintiliyse (İnkılap 8 ve 12; Bilişim 5–6 ve 9–12) her kesintisiz aralık için ayrı satır var. Bunun yanında `policy_ambiguity` kaynaklı 12 satır, JSON'daki `normalization_examples` ve `matching_policy` belirsizliklerini işler: Lisede "Fen" Fizik/Kimya/Biyoloji'ye, "Din" DKAB/Kur'an/Siyer/TDB'ye, "Yabancı Dil" İngilizce/Almanca/Fransızca'ya, 9+ sınıfta "Sosyal" Sosyal Bilim Çalışmaları'na, 9. sınıfta "Trafik" Sağlık Bilgisi'ne, 9–11. sınıfta "İnkılap" Tarih'e yönlenir. Bu SQL bloğu `scripts/build-subject-catalog-sql.py` ile JSON'dan üretiliyor; `--check` seçeneği bloğun JSON ile uyumlu olduğunu doğruluyor (`ok: 20 subject options, 279 synonym rows in sync`). Tabloda RLS açık ve doğrudan erişim izni yok.
- **`gina.normalize_subject_alias(text)`**: Türkçe harf katlama, küçük harf, harf/rakam dışındaki her şeyi silme ve sondaki "dersi" ekini atma. Python üreticisi ve `packages/core` ile aynı kural.
- **`public.suggest_subject(p_text, p_grade)`**: Veli (`is_parent`) ya da içerik operatörü çağırabilir; `STABLE` olduğu için yazma yapamaz. Dönen alanlar: `match` (`none|single|ambiguous`) ve `candidates[]` (her adayda `in_grade_scope` ve `matched_alias`). **`requires_confirmation` her durumda `true`**; üst düzeyde bağlanmış bir kimlik döndürülmez. `keep_label=true`, yani velinin yazdığı ad korunur. Sınıf bilgisi aday listesini yalnız daraltır; uygun aday yoksa kapsam dışı adaylar `scope_note=true` notuyla yine önerilir, engellenmez. Pasif ders önerilmez.
- **`public.admin_subject_synonyms()`**: Yalnız içerik rolü için okuma uç noktası.
- **`public.admin_import_education_calendar_seed(p_request, p_seed, p_execute)`**: Girdi `gina.education-calendar-seed.v1` tohumu.
  - `p_execute=false` önizlemedir, hiçbir şey yazmaz. Kayıtları kademe bazında açar ve her biri için şunları döndürür: eylem (`create|exists|skip|invalid`), neden, kaynak URL, kontrol tarihi, dönem sayısı, yeni il sayısı ve kaynak listesi.
  - `p_execute=true` yalnız eksik kayıtlara **taslak** yazar (`published` null kalır). Var olan taslak ya da yayımlanmış takvime dokunmaz. `confidence` değeri `high` veya `medium` değilse kayıt atlanır (Düzce). Her `calendar_value` `gina.validate_education_calendar` doğrulamasından geçer. Yeni il yeri **pasif** açılır, dolayısıyla veli listesinde görünmez; il yayımlanmadan önce yönetici onu ayrıca etkinleştirir. Her taslak için ayrı denetim kaydı, her içe aktarma için bir özet kaydı yazılır. Aynı `p_request` ile tekrar çağrı makbuzdan aynı sonucu döndürür.
  - Okul düzeyinde kayıt tohumdan açılmaz, çünkü okul listesi uydurulmaz.
  - **Yayın her zaman ayrı adımdır**: mevcut `admin_save_education_calendar(..., true)`.

Kaynak URL ve kontrol tarihi `calendar_value` içindeki `source_url` ve `verified_on` alanlarıyla taslağa giriyor. `checked_at`, `confidence` ve `seed_id` denetim kaydında tutuluyor. Dört kademe × (ülke + 4 il) = 20 taslak. Düzce'nin 4 kaydı atlanıyor.

### 2. Betik `scripts/import-education-calendar-draft.mjs`

- Varsayılan kipte **kuru çalışır** ve DB'ye bağlanmaz: tohumu okur, kayıtları kademe bazında açar, atlanan ve geçersiz kayıtları, kaynakları ve dönem sayılarını yazdırır.
- `--server-preview` ve `--execute` yalnız yerel hedefle çalışır: `--docker <container> --database <izole_db>` ya da yalnız `localhost`/`127.0.0.1` kabul eden `--db-url`. Başka host verilirse `refusing non-local database host` hatasıyla durur. `--admin-user` ile RPC'yi o kullanıcının yetkisiyle çağırır.

### 3. `packages/core/src/subject-synonyms.ts` (+ test, `index.ts` içinde tek export satırı)

- `normalizeSubjectAlias`: SQL ile aynı kural.
- `readSubjectSuggestion`: zod ile doğrular; `requires_confirmation` `true` değilse yanıtı reddeder.
- `confirmSubjectChoice`: Seçim yoksa ya da aday listesinde değilse `subject_id: null` döner ve etiket korunur.
- `groupSubjectSynonyms`: Yönetim listesi için gruplama.

### 4. Backoffice

- **`input-catalog`**: "Dersler" türünde 32 kimlik, her kartta kimlik ve eşanlamlı çipleri görünür. Belirsiz eşanlamlılar sarı gösterilir, "Tümünü göster" ile liste açılır. "Veli ne yazarsa hangi ders önerilir?" deneme alanı metin ve sınıf alıp `suggest_subject` sonucunu gösterir (tek aday, çok aday ya da eşleşme yok; kapsam notu). Hiçbir kayda yazmaz. Yeni bileşen: `components/subject-synonyms.tsx`.
- **`education-calendars`**: Yeni sekme **"Taslak içe aktar (kaynaklı)"** (`components/calendar-seed-import.tsx`).
  - Varsayılan kaynak depodaki `tr-2026-2027.json`; "Başka dosya seç" ile başka bir tohum yüklenebilir.
  - "Önizle" sunucu önizlemesini çağırır. Ekranda şunlar görünür: oluşturulacak, zaten var olan, atlanan ve geçersiz kayıt sayısı ile yeni gizli il sayısı; il bazında kademe satırları (tarih aralığı, dönem sayısı, atlanma nedeni); kaynak güveni; kontrol tarihi; kaynak bağlantısı; 14 kaynaklık liste.
  - Taslaklar ancak "Kaynakları kontrol ettim… hiçbir takvim yayımlanmasın" kutusu işaretlenince "20 taslağı oluştur (yayımlamaz)" düğmesiyle oluşturulur. Yanıt kaybolup tekrar gönderilirse aynı istek kimliği kullanıldığı için çift kayıt oluşmaz. Sonuç mesajı yayının Takvimler sekmesinde ayrı yapıldığını söyler.
- `components/s04-rpc.ts`: Yeni RPC'ler `database.types.ts` dosyasında henüz yok (o dosya bu ajana ait değil). Tipler yeniden üretilene kadar bu dar, tipsiz çağrı katmanı kullanılıyor.

## Testler (gerçekten çalıştırıldı)

| Test | Sonuç |
|---|---|
| `python3 scripts/test-q02-sql.py --run-local --only 104` | 104 dosyası: **78/78** |
| `python3 scripts/test-q02-sql.py --run-local --out docs/release/s04-catalog-2026-11-06` (tam pgTAP, tek kullanımlık DB, Europe/Istanbul) | **103 dosya, 3840 doğrulama, 0 hata** — [sql-checks.json](sql-checks.json) |
| `pnpm --filter @gina/core test` | **51 dosya, 362 test** geçti (`subject-synonyms.test.ts` 6 test) |
| `pnpm --filter @gina/core typecheck` | temiz |
| `pnpm --filter @gina/backoffice typecheck` / `lint` / `build` | temiz / temiz / 22 statik sayfa dışa aktarıldı |
| `python3 scripts/build-subject-catalog-sql.py --check` | `ok: 20 subject options, 279 synonym rows in sync` |
| `node scripts/import-education-calendar-draft.mjs` (kuru) | taslak adayı 20, atlanan 4 (Düzce, `low_confidence`), geçersiz 0, 14 kaynak |
| Betiğin izole servis DB'sinde çalıştırılması | `--server-preview` → `{"create":0,"exists":20,"skipped":4}`. Ankara ve Sivas taslakları silindikten sonra `--execute` → `{"create":8,"exists":12}`, 20 takvim / 0 yayımlanmış. Yerel olmayan `--db-url` reddedildi. |
| `GINA_QA_UI_FIXTURE=… python3 scripts/test-isolated-services.py --run-local --ui-hold` | **137 servis kontrolü** geçti; geçici DB ve auth/rest container'ları kaldırıldı — [service-checks.json](service-checks.json) (3. çalıştırma; önceki iki çalıştırma da 137/137) |
| `scripts/test-s04-catalog-ui.cjs` (Playwright, Chrome, 1280×800) | **6 kontrol** — [ui/ui-checks.json](ui/ui-checks.json) |

pgTAP 104'ün kapsadıkları:

- 32 ders kimliği var; 20 yeni kimliğin hepsi aktif ve revizyonu 1.
- Mevcut 12 kimliğin etiket, sınıf kapsamı, sıra ve revizyonu birebir aynı.
- Kimlik eklemesi tekrar çalışınca yönetici düzenlemesini ezmiyor; eşanlamlı eklemesi idempotent.
- SQL normalizasyonu saklanan değerle aynı.
- `suggest_subject` 17 örnekte doğru aday listesini veriyor.
- Bütün eşanlamlılar, tek aday dahil, onay istiyor; üst düzeyde bağlanmış kimlik yok; fonksiyon `STABLE`.
- Pasif ders önerilmiyor.
- Yetki: anon, ailesiz hesap ve rolü geri alınmış operatör reddediliyor; veli yönetici listesini ve içe aktarmayı göremiyor; normalizasyon fonksiyonu ve tablo doğrudan erişime kapalı.
- Önizleme hiçbir şey yazmıyor.
- Yürütme 19 taslak oluşturuyor; önceden elle girilmiş yayımlanmış lise takvimi değişmiyor.
- Tekrar çağrı: aynı istek kimliği makbuzdan aynı sonucu veriyor; yeni istek kimliğiyle her kayıt `exists` dönüyor.
- Düzce atlanıyor ve il kaydı açılmıyor; yeni iller pasif açılıyor.
- Taslaklar kaynağı ve kontrol tarihini taşıyor; her taslak denetim kaydında.
- İçe aktarma velilerin gördüğü takvimi değiştirmiyor. Ülke ilkokul taslağı ancak ayrı yayın adımıyla canlıya çıkıyor. Pasif ildeki taslak yayımlanamıyor (`calendar_invalid`).

UI kontrolleri: 32 ders ve eşanlamlılar listeleniyor. "Fen" + 10. sınıf 3 aday gösteriyor; "MAT" + 6. sınıf tek aday gösteriyor ve onay istiyor. Önizleme sayıları, Düzce'nin atlanması ve 14 kaynak görünüyor; önizleme sırasında DB'ye yazılmıyor. Onay kutusu işaretlenmeden düğme pasif. Onaydan sonra 20 taslak oluşuyor; yayımlanan takvim 0, gizli il 4. Takvimler listesinde "Yayında" yazan kart yok. İkinci önizlemede yeni taslak çıkmıyor. Sayfa hatası ve yatay taşma yok.

## Görüntüler (`ui/`, 1280×800)

- `input-catalog-subjects-1280x800.png`, `input-catalog-subjects-full.png`: ders kataloğu ve eşanlamlılar
- `input-catalog-match-fen-grade10-1280x800.png`: belirsiz etiket için 3 aday
- `education-calendars-import-preview-1280x800.png`, `…-preview-full.png`: önizleme (sayılar, il kartları, Düzce atlandı, kaynaklar)
- `education-calendars-import-done-1280x800.png`: oluşturma sonrası
- `education-calendars-drafts-1280x800.png`: Takvimler sekmesi; bütün kartlar "Taslak"

Görüntülerdeki e-posta adresleri, geçici servisin ürettiği sentetik `@example.invalid` hesaplarıdır.

## Temizlik

Tek kullanımlık `gina_q02sql_*` ve `gina_http_*` veritabanları ile `*_auth`/`*_rest` container'ları test betikleri tarafından silindi. Kontrol: `pg_database` içinde `gina_q02sql%`/`gina_http%` kalmadı, `gina_http` container'ı yok. Yerel statik sunucu (127.0.0.1:3194) durduruldu. Başka ajanların veritabanlarına ve container'larına dokunulmadı.

## Kalan sınır / açık

- **Veli tarafında bağlama yapılmadı.** Mobil ders programı, ödev ve not girişinde `suggest_subject` ile aday gösterip onaylatma bu işin kapsamında değil (mobil ekranlar başka ajanda). Sözleşme ve core yardımcıları hazır. Prova/kütüphane `subject` metninin kanonik kimliğe bağlanması kararla P02'ye bırakıldı.
- **Sözleşmedeki farklar:**
  - "Din" tek başına yazıldığında 4 aday çıkar, "Din K." yazıldığında yalnız DKAB.
  - "Yabancı Dil" ilkokulda da 3 aday gösterir (İngilizce, Almanca, Fransızca).
  - JSON'daki `single_with_note` ayrımı `scope_note` ve `in_grade_scope` alanlarıyla karşılanıyor.
  - "Sosyal" 9+ sınıfta yalnız Sosyal Bilim Çalışmaları'na gider; Sosyal Bilgiler 4–7 kapsamı dışında kalır.
- **Yönetimden eşanlamlı ekleme/düzenleme yok.** Tablo `source='admin'` değerini kabul ediyor ama yazma RPC'si yazılmadı; eşanlamlılar şimdilik migration ile JSON'dan geliyor.
- **`database.types.ts` yeniden üretilmedi.** Yeni RPC'ler backoffice'te `s04-rpc.ts` üzerinden tipsiz çağrılıyor. Tipler üretildiğinde bu katman kaldırılmalı.
- **Takvimlerin yayımlanmadan önceki adımları yöneticide.** İçe aktarılan 4 il gizli; yayından önce yönetici "Bölgeler ve okullar" sekmesinden il kaydını etkinleştirip kaynağı doğrulamalı. Düzce il MEM teyidi bekliyor. Sivas güveni orta.
- **İçe aktarma yalnız eksik kaydı ekliyor.** Var olan taslağı güncellemiyor; tohum değişirse yönetici ilgili taslağı elle düzenler.
- **Üretim:** Migration üretime uygulanmadı; hiçbir takvim yayımlanmadı.
