# B03 / B04 — Toplu Prova ortak inceleme, destek, fikirler, yardım yazıları ve gönderim operasyonları (yönetim UI)

6 Kasım 2026 gece paketi. Dal: `worktree-agent-ad0a5997e33433f25` (kaynak main `304f303`, `77f45cb` docs commit'i birleşmeyle geldi). **Main'e push edilmedi, üretime migration uygulanmadı, hiçbir gerçek push/e-posta/SMS gönderilmedi.** Bütün denemeler tek kullanımlık `gina_b34_*` / `gina_q02sql_*` veritabanlarında; hepsi silindi (son kontrol: `pg_database`'te `gina_b34_%` yok, `gina_b34_*` container yok).

## Ne yapıldı

### B03 — Birlikte Prova (`pages/{groups,cohort-review}.tsx`, yeni `lib/cohort-text.ts`)
- **groups:** yayın öncesi önizleme `data-testid="group-preview"` üç adımda: 1 Kapsam → 2 Sorular ve süre → 3 Aile ve çocuk görünümü. Katılım penceresi, çocuğun süresi (tek deneme) ve inceleme aşamaları ayrı bloklar. Ölçütlü incelemede iş yükü tahmini = yerel "tahmini katılımcı" × açık uçlu soru (açık uçlu sayısı katalogdan üst sınır olarak hesaplanır; sunucuya gönderilmez). Paket etiketleri ham kod değil (Ücretsiz/Plus/Pro). Yayımlanmış provada "Aşamalar ve sıralama" `group_exam_phases` ile okunur. Mevcut "kontrol ettim" onayı ve taslak koruması korunur.
- **cohort-review:** "Sıradaki incelenmemiş" / "Sıradaki itiraz" kuyruğu (sona gelince başa döner; bitmemiş çalışma incelenmemiş kuyruğuna girmez), takma ad araması ("x / y kayıt"), kayıt satırında durum (bitmedi · incelenemez / N bekliyor · M itiraz / tamamlandı). Okunamayan cevap **"Okunamadı — puan verilmedi"** ve "boş veya sıfır sayılmaz; kesin sıralamaya girmez" uyarısıyla ayrı; bekleyen sayacına dahil (sunucuda `reviewed=false`). Dört aşama kartı: katılım penceresi, çocuğun süresi, inceleme, **Sıralama · isteğe bağlı** (uygun kayıt sayısı + `excluded` nedenleri Türkçe: izin yok, bitmedi, okunamadı, puanlanmamış, sonuç yayımlanmadı). Sonuç yayını ve yeniden değerlendirmenin etkisi açıklanır (yeniden değerlendirme/itiraz sonucu taslağa döndürür, kesin sıralama yeni yayına kadar kapanır). Sunucu sözleşmesi (P05) değişmedi.

### B04 — Destek ve fikirler (migration + `components/support/*`, yeni `lib/support-ops.ts`)
Migration `supabase/migrations/20261106210000_support_assignment.sql`:
- `help_tickets.assignee_id/assigned_at`, `idea_stage` (`new|reviewing|planned|building|shipped|declined`, yalnız fikirde), `similar_to` (yalnız fikir→fikir). Tetikleyici **türü değiştirmeyi yasaklar** (`help_kind_immutable`): özel destek talebi fikre dönüşemez; check kısıtları destek talebinde fikir alanlarını reddeder.
- `admin_support_queue(kind,status,category,assignee any|me|none|uuid,query,waiting,keyset)`: sorumlu, **veli bekleme başlangıcı** (son aileye görünür destek yanıtından sonraki ilk veli mesajı; ekip notu saati durdurmaz), arama (konu, kimlik, mesaj ve ekip notu gövdesi; `%`/`_` harfiyen), benzer fikir sayısı, eşleşme nedeni. Trigram indeksleri.
- `assign_help_ticket(request, ticket, expected_assignee, assignee)`: canlı destek rolü; atanan kişi de canlı destek yetkili olmalı (`assignee_not_operator`); beklenen sorumlu farklıysa `assignment_changed`; makbuzla idempotent; denetim kaydı; **görüşme revizyonunu artırmaz** (yazılan taslak "görüşme değişti" olmaz).
- `set_idea_stage(...)`: yalnız fikir (`idea_only`), bağ köke düzleştirilir, döngü yasak, beklenen durum kontrolü (`idea_changed`), denetim kaydı (mesaj metni yok).
- `admin_help_ticket_meta`, `admin_support_operators`. Aile RPC'leri (`create/reply/list_help_tickets/get_help_ticket`) **değişmedi**; sorumlu/fikir alanları ve ekip notu veli çıktısına girmez.
- UI: kuyrukta arama, sorumlu süzgeci, "yalnız veli yanıt bekleyenler", satırda "Veli 26 sa bekliyor" (24 saat üstü kırmızı), sorumlu, benzer fikir sayısı, "Mesajda eşleşti". Görüşmede sorumlu seçimi + "Bana ata", bekleme rozeti; fikirde durum seçimi ve benzer fikir bağla/kaldır. **Hazır yanıt** ve **ilgili yardım yazısı** (yalnız yayımlanmış sürüm, `get_help_articles` editor=false) yalnız açık görüşmenin "Aileye yanıt" taslağına eklenir; ekip notu sekmesinde yardımcı yok; kendiliğinden gönderim yok.

### B04 — Yardım yazısı, bildirim, duyuru (`components/help-articles.tsx`, `pages/{notifications,announcements}.tsx`, yeni `lib/{help-article-structure,channel-ops}.ts`, `components/{help-article-preview,channel-readiness}.tsx`)
- Yardım yazısı: kısa cevap / numaralı adımlar / bağlantılar düzenleyicisi; sunucu şeması aynı (`body` sabit başlıklarla serileştirilir; eski serbest metin olduğu gibi açılır, isteğe bağlı dönüştürme). Taslak (`help-article-draft`) ve yayındaki sürüm (`help-article-live`) yan yana; "Taslak kaydı canlı cevabı değiştirmez". Cihaz (telefon/tablet/masaüstü) × platform önizlemesi, dil önizlemesi (diğer dilin yayımlanmış sürümü).
- Bildirim teslimi: önce olay ve "Ne yapılmalı", teknik makbuz kapalı ikinci düzey. Kanal hazırlık kartı (`channel_readiness()`): kanal başına hazır/değil, eksikler Türkçe.
- Duyurular: hazırlık kartı; isteğe bağlı e-posta/SMS seçimi hazır olmayan kanalda kapalı; önizlemede kanal başına **uygun/engelli veli sayısı** ve nedenler; "sağlayıcı kabulü teslim veya okundu değildir" açıkça yazılı. Yayımlanan duyuruda `admin_announcement_channels` sonuçları.

## Testler (gerçekten çalıştırıldı)

- `pnpm --filter @gina/backoffice typecheck` → `✓ Types generated successfully`, `tsc --noEmit` hatasız. `lint` → `eslint .` hatasız/uyarısız. `build` → statik export başarılı (son: yerel test URL'siyle yeniden derleme dahil).
- **pgTAP tam koşu** `python3 scripts/test-q02-sql.py --run-local --out docs/release/b03-b04-2026-11-06` → **105 dosya / 3.968 kontrol, 0 başarısız** ([sql-checks.json](sql-checks.json)). Yeni `107_support_assignment.test.sql` **77/77**: veli/cihaz/süresi dolmuş/içerik operatörü/sahte admin claim reddi, anon yetkisi yok; kuyruk türü ayrımı; bekleme başlangıcı ve ekip notunun saati durdurmaması, aileye yanıtla durması; konu/mesaj/ekip notu araması, `%` harfiyen; atama idempotency (tek denetim satırı), farklı yük → `request_conflict`, eşzamanlı atama → `assignment_changed`, veli/süresi dolmuş/içerik-operatörü atanamaz, sorumlu süzgeçleri, bırakma `assigned_at` temizler; atama öncesi revizyonla taslak gönderilebilir; veli çıktısında ekip notu/sorumlu/fikir alanı yok, başka aile reddi; tür değişmezliği, `idea_only`, bağ düzleştirme, döngü, beklenen durum çakışması, `linked` hiçbir zaman null değil, fikir değişikliği revizyonu artırmaz, denetimde mesaj metni yok; iptal edilen operatör kuyruğu ve atanma hakkını hemen kaybeder.
- **İzole servis + Playwright** (`harness/run.py` + `seed.sql` + `cohort.sql` + `tour.cjs`; Chrome headless, 1280×800 ve 768×1024; DB `gina_b34_<hex>_audit`, geçici GoTrue/PostgREST, fixture repoda değil): **15/15 geçti** ([ui/ui-checks.json](ui/ui-checks.json)). İncelemeli kohort 098 tarifinden kuruldu (4 katılım: okunamayan, puanlı + açık itiraz, bitmemiş, incelenmemiş).
  - `cohort_queue_filled_next_unreviewed_and_appeal`, `cohort_unreadable_not_zero_and_not_ranked`, `cohort_search` (0 / 4), `groups_preview_and_phases` (yayımlı provada aşamalar ayrı, ham paket kodu yok)
  - `help_article_draft_vs_live_and_device_preview` (canlı v1 değişmeden, taslak v2 ayrı)
  - `announcement_channel_readiness_and_preview` (e-posta "hazır değil", Uygun 0 · Engelli 4; `channel_outbox` 0 satır, duyuru `draft` kaldı)
  - `notifications_event_first_receipt_second`
  - `support_queue_waiting_and_unassigned` ("Veli 26 sa bekliyor · Sorumlusuz"), `support_assign_to_me_keeps_draft` (taslak korunur, "görüşme değişti" yok), `support_canned_and_related_article_use_live_text` (yardım yazısının canlı metni girer, taslak "TASLAK" metni girmez), `support_draft_not_carried_to_other_conversation`, `support_team_note_hidden_from_family` (veli `get_help_ticket` çıktısında not/sorumlu yok), `support_search_reaches_team_notes`, `ideas_stage_and_similar_link`, `no_page_errors`.
  - Tur ilk iki koşuda gerçek hatalar buldu ve düzeltildi (`5552fb5`): benzer fikir `linked=null` → fikir paneli açılmıyordu; işlem sonrası sürüm artışı görüşmeyi yeniden yüklüyor ve sonuç mesajını gizliyordu; hızlı ikinci fikir değişikliği eski beklenen değeri gönderiyordu (sunucu `idea_changed` ile reddetti — veri bozulmadı; artık kontroller yeni okuma gelene kadar kapalı). Ayrıca iki tur adımı test hatasıydı (duyuru taslağı "Düzenle / önizle" ile açılır; "okundu" uyarısı önizleme kutusunun değil sayfanın metninde).
- Görseller: `ui/01…16-*.png` (yalnız sentetik `example.invalid` hesaplar).

## Commit'ler

`616aa9e` cohort-review kuyruğu · `eec253d` groups önizleme/aşamalar · `c341a28` bildirim teslimi + kanal hazırlığı · `9ca5660` duyuru kanalları · `5cc773c` yardım yazısı yapısı/önizleme · `13b7073` birleştirme · `422f2d3` migration + pgTAP 107 · `d28b3c9` destek/fikir UI · `5552fb5` tur bulguları düzeltmesi · `95eca27` harness · bu rapor.

## Kalan sınırlar

- Yayımlanmadı: migration üretime uygulanmadı; main'e birleştirme ayrı adım.
- `admin_workqueue` (B01) "sorumlusuz" kalemi hâlâ "operatör cevabı yok" tanımını kullanıyor; `assignee_id is null`'a geçirmek B01 fonksiyonunun yeniden tanımını gerektirir (bu pakette yapılmadı).
- Hazır yanıtlar kod içinde sabit (5 Türkçe metin); yönetilebilir kütüphane ve EN karşılıkları yok. İlgili yardım yazısı eşleşmesi basit kelime kökü örtüşmesi (yalnız TR, platform `all`).
- Fikir durumu ekip içidir; aileye fikir durumu bildirimi veya kamu fikir panosu yok (bilerek).
- groups önizlemesinin oluşturma formundaki `group-preview` adımları Playwright'ta doldurulmadı (yayımlı provadaki aşama görünümü test edildi); açık uçlu soru sayısı üst sınır tahmini. Kuyruk RPC'si kayıt başına okunamayan sayısını vermiyor (kayıt açılınca görünür).
- Duyuru kanal önizlemesi yalnız taslağa kaydedilmiş kanalları sayar; push için kesin cihaz sayısı yok. Gerçek sağlayıcı (X01/X02) yok; hiçbir gerçek gönderim denenmedi.
- Bu paket fiziksel cihaz/klavye/ekran okuyucu kabulü içermez.
