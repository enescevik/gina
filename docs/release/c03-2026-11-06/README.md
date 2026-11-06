# C03 — görev geri bildirimi, toplu temizleme ve kaynak yaşam döngüsü (U06 / U07 / L02 / L03)

6 Kasım 2026. Dal `worktree-agent-ae918eb9342aee005`, taban main `4ca34bb`, sonra main (`f95b8d5`, C07 + C04 dahil) birleştirildi. **Durum: KOD HAZIR + yerel izole testler geçti. Yayımlanmadı.** Main'e push edilmedi, üretim Supabase'e / yerel demo DB'ye dokunulmadı, `db reset` yapılmadı, gerçek aile silinmedi. Migration tek dosya `supabase/migrations/20261106280000_task_return_reason_and_bulk_scopes.sql`; pgTAP `supabase/tests/114_task_return_reason_and_bulk_scopes.test.sql`. i18n'e yalnız yeni anahtar (TR/EN `c03.*` + 5 düz `bulkArchive.ui.restoreEffect.{event,prova_draft,learning_plan,school_bag}` / `bulkArchive.ui.rowRestored.record`); mevcut anahtar değişmedi. C07'nin rol kontrollü admin RPC'leri yeniden tanımlanmadı.

## Eski görev bağlantısı

| Eski kimlik | C03'te kapanan kısım |
|---|---|
| U06 | Geri gönderme nedeni sunucuda; çocukta neden → somut sıradaki adım + velinin kısa notu (Dünyam sıradaki adım, görev paneli, Haftam'da bugün). Neden yoksa eski genel açıklama, uydurma yok. |
| U07 | Haftalık öneri → görev formu, çocuk ve kaynak bağıyla ön doldurma; yardımda yanıt takibi ("Yeni yanıt") ve kişisel verisi gizlenmiş görsel eki. |
| L02 | Takvim, Prova taslağı, ödev/çalışma planı ve çanta seçimi mevcut `bulk_archive_preview/apply/restore/history` sözleşmesine bağlandı; 300/200 sınırı açıklanıyor; yüklü sayfa seçimi artık "tümü" denmiyor. |
| L03 | Kaynak dosya silme, çocuk silme önizlemesi ve hesap silme (`delete-account` Edge, gerçek Auth, gerçek Storage) sentetik hesapla uçtan uca çalıştırıldı. |

## Commit'ler

- `0f452fa` feat(C03): task return reason with legacy-compatible review_task_once, weekly child map, help reply tracking and redacted attachments
- `73d27c9` feat(C03): bulk selection for calendar, homework/study, bag days and Prova drafts …; weekly suggestion prefills the task form; help reply tracking and redacted image
- `c9eb892` test(C03): isolated Auth/REST/Storage/Edge contract …; mirror local auth.users ACL in the isolated runner
- `4a95bb6` merge main (C07/C04) — çakışmalar: `tr/en.json` (main sürümü + C03 anahtarları yeniden eklendi), `scripts/isolated-source-edge.ts` (iki rota da tutuldu), `parent/prova/index.tsx` (C04 "Hazırla" bloğu + C03 tek satırlık giriş)
- son commit: fix(C03) eşzamanlı dokunma kilidi, geri gönderme sayfası kendi başarısında kapanır; UI kabul betiği ve kanıtlar (+ bu rapor)

## Sunucu sözleşmesi (migration 20261106280000)

**Geri gönderme nedeni**
- `task_completions.return_reason` (`not_finished|needs_care|missing_part|do_together|wrong_day|other`) ve `return_note` (≤140, yalnız nedenle). Mevcut RLS ile iki veli ve yalnız o çocuğun cihazı okur; kardeş cihazı ve yabancı aile okuyamaz. Bildirim yükü nedeni taşımaz.
- `review_task_once(p_request_id, p_completion_id, p_approve, p_expected_completed_at, p_return_reason default null, p_return_note default null)`: eski 4 argümanlı imza kaldırıldı, tek imza kaldı (PostgREST belirsizliği yok); eski istemcinin 4 adlı argümanlı çağrısı aynen çalışır. Nedensiz gövde eski makbuz gövdesiyle birebir aynıdır (eski makbuzla tekrar aynı sonuç). Onay + neden → `invalid_input`; bilinmeyen kod → `return_reason_invalid`; `other` notsuz → `return_note_required`; uzun/nedensiz not → `return_note_invalid`. Not boşluk/denetim karakterlerinden arındırılır. Aynı istek kimliği + farklı not → `request_conflict`; yeni kimlikle ikinci karar → `already_reviewed` (ikinci puan/işlem yok).
- `gina.task_completion_return_reason` BEFORE UPDATE tetikleyicisi: neden yalnız aynı işlemdeki inceleme ayarından yazılır; onay temizler; yeniden gönderimde (returned→done) önceki neden veliye bağlam olarak kalır; doğrudan neden değişikliği geri çevrilir; eski 2 argümanlı `review_task` bayat neden bırakmaz.

**Haftalık öneri:** `weekly_review_children(p_week)` — o haftanın takma adı → bugün aktif çocuk kimliği (arşivli çocuk yok, yabancı aile yok, cihaz `weekly_forbidden`). `get_family_weekly_review` yanıtı `.strict()` doğrulandığı için genişletilmedi.

**Yardım:** `gina.help_ticket_reads` + `help_ticket_updates()` (kullanıcı başına okunmamış aile yanıtı; ekip içi not hiç sayılmaz) + `mark_help_ticket_read` (monoton; geç gelen eski sıra geri almaz, görünmeyen sıra kabul edilmez). `help_attachments` (istemciye kapalı tablo) + `add_help_attachment` (JPEG/PNG sihirli bayt kontrolü, ≤600 KB, talep başına 3, kapalı talepte yok, "kişisel bilgi yok" + "metadata silindi" onayı zorunlu, makbuzla idempotent), `list_help_attachments`, `get_help_attachment` (aile velisi veya destek operatörü).

## İstemci

- **Veli ana ekranı:** "Geri gönder" → `ReturnReasonSheet` (TR/EN 6 seçenek, kısa not, "Neden seçmeden gönder"). Eşzamanlı dokunma kilidi (çift dokunuş tek istek), aynı karar+içerik → aynı istek kimliği. Karar verilen (veya başka oturumda karar verilmiş: `already_reviewed`/`not_found`) gönderim bekleyenler listesinden hemen düşer, eşzamanlı eski yenileme iptal edilir → Realtime/focus yenilemesinde onaylanan görev beklemede kalmaz. Hata metinleri ham değil (`c03.review.*`). Geri gönderilmiş görevde "Geri gönderme nedeni: …", yeniden gönderilen onay kartında "Önceki geri gönderme: …".
- **Çocuk:** `components/child-home/return-next.tsx` — Dünyam sıradaki adım ve görev panelinde (`components/room/child-home.tsx`, iki satır), Haftam'da bugün (`app/child/week.tsx`). Veri `lib/use-child-today.ts` seçimine iki sütun eklendi (aynı sorgu anahtarını paylaşan Haftam seçimi de aynı).
- **Toplu seçim:** `components/planner/bulk-scope-sheet.tsx` — seçim yüklü sayfadan değil sunucu önizlemesinden; "Listelenen N kaydı seç" (en çok 200), kesilmiş önizlemede açık uyarı, 200 üstü engellenir; arşiv ≠ kalıcı silme notu; tür notları (seri bütün arşivlenir, atanmış Prova korunur, çanta modu sıfırla/boşalt, geçmiş gün değişmez); sonuçta "Bu işlemi geri al" (geri alma önizlemesindeki güncel revizyonlarla; çanta görüntüsünden), son 5 toplu işlem geçmişi (sen/diğer veli). Takvim gün görünümünde (veli, çocuk seçiliyken) takvim/ödev-çalışma/çanta; Prova merkezi "Hazırla" sekmesinde **yalnız taslak seçimi için tek satırlık giriş** (`parent/prova/index.tsx`: bir import + bir bileşen satırı). Mevcut rutin/ödül/not seçim çubuğunda "Tümünü seç" → "Listelenen N kaydı seç" (`components/ui/bulk-archive-sheet.tsx`, bir satır).
- **Haftalık özet:** seçilen her öneri için "X için görev olarak ekle"; öneri metni rotaya/adrese yazılmaz, oturum belleğinde rastgele anahtarla taşınır (`components/tasks/task-prefill.ts`); görev formu ayrıntı adımında açılır, başlık önerinin ilk cümlesinden ≤80 karakter (`suggestionTaskTitle`), kaynak satırı ("Haftalık özetten: Ece · 26 Ekim haftası") ve tam öneri gösterilir; hiçbir şey kendiliğinden kaydedilmez.
- **Yardım:** liste başında "N talepte yeni yanıt var", talepte "Yeni yanıt"; talep açılınca en yeni aile yanıtı okundu işaretlenir. `components/help/help-attachments.tsx`: görsel seç → cihazda yeniden kodlama (EXIF/konum düşer, ≤1280 px), üst/alt şerit kırpma, "kişisel bilgi yok" onayı olmadan gönderilemez; ekler yalnız RPC ile açılır.
- Core: `packages/core/src/task-review.ts`, `bulk-scope.ts` (+ test), `database.types.ts` (iki sütun + RPC argümanları).

## Testler (gerçekten çalıştırıldı)

| Test | Ortam | Sonuç |
|---|---|---|
| pgTAP 114 | boş geçici DB | **81/81** |
| Tam pgTAP, Europe/Istanbul (`scripts/test-q02-sql.py --run-local`), main birleşimi sonrası | boş geçici DB, bütün migration'lar | **113 dosya, 4716 kontrol, 0 hata** (113_operator_access 191/191) — [sql-istanbul/sql-checks.json](sql-istanbul/sql-checks.json) |
| Tam pgTAP, `--timezone UTC` | aynı | **113 dosya, 4716 kontrol, 0 hata** — [sql-utc/sql-checks.json](sql-utc/sql-checks.json) |
| `pnpm --filter @gina/core test` | — | 56 dosya / 401 test geçti; `typecheck` temiz |
| `apps/mobile`: `pnpm exec tsc --noEmit`, `pnpm exec expo lint` | — | çıkış 0, uyarı yok |
| İzole servis `python3 scripts/test-isolated-services.py --run-local --with-storage` | rastgele adlı geçici DB + Auth/PostgREST/Storage container'ları + yerel Deno Edge (değişmemiş `learning-source`, `delete-account` handler'ları) | **353/353** (82 `c03_*`); temizlik storage/rest/auth/disposable DB `true` — [service-checks.json](service-checks.json) |
| Aynısı `--ui-hold` ile (UI fixture) | aynı | **355/355**, temizlik dört alan `true` — [service-checks-ui-hold.json](service-checks-ui-hold.json) |
| Playwright `scripts/test-c03-ui.cjs` (Chrome, tr-TR, Europe/Istanbul; 390×844, 768×1024, 1280×800) | yukarıdaki fixture'a bağlı `expo export -p web` | **11/11**, iki ardışık koşu — [ui-checks.json](ui-checks.json) |

İzole sözleşmede (`scripts/isolated-c03-contract.mjs`) sınanan başlıca durumlar: neden veli A'dan yazılır, eş veli ve çocuk cihazı aynı neden/notu okur, yabancı aile okuyamaz, cihaz karar veremez; aynı istek tekrarında aynı sonuç, farklı notla `request_conflict`, eş velinin eski kopyayla ikinci kararı `already_reviewed`; yeniden gönderimde neden kalır; eski 4 argümanlı onay çalışır, yıldız bir kez. Takvim toplu arşiv iki kayıt → aynı anahtarla ikinci uygulama aynı sonuç → eş veli geri alır → geçmişte iki koşu doğru sayı ve "mine" bayrağıyla; atanmış Prova taslağı `prova_draft_assigned` ile korunur, uygulama 0 kayıt. Storage/Edge: eş velide imzalı URL çalışır; **token'ı bozulmuş imzalı URL, ham nesne yolu, istemcinin kendi JWT'siyle imzalama ve yabancı aile görüntüleme reddedilir**; çocuk silme önizleme→onay (tekrarda makbuz), aile dosyası kalır; eş velinin hesap silmesi gerçek `delete-account` (yanlış şifre reddedilir; önizleme belirteci + şifre ile silinir, tekrar giriş yapamaz) → **paylaşılan aile dosyası silinmez**; önizlemeden sonra aile değişirse 409 `deletion_preview_stale`, hiçbir şey silinmez; son velinin taze önizlemeyle silmesi aileyi cascade siler, temizlik kuyruğu hatasız çalışır, eski imzalı URL ölür, Storage nesnesi kalkar. (Kuyruk satırı bilinçli olarak 3 saat tutulur — geç yükleme koruması; ilk koşuda "kuyruk boşaldı" beklentim yanlıştı, düzeltildi.) Atanmış soru görselinin silinemediği mevcut `testSources` kontrolüyle aynı koşuda geçti.

UI kontrolleri: "Başka bir neden" not ister; neden+not ile çift dokunuş → **tek** `review_task_once` isteği, kart bekleyenlerden düşer; ana ekranda neden satırı; onayda yanıt yapay kayboluyor (sunucu uyguladı, istemci 503 gördü) → yenileme sunucuyla uzlaşır, görev "bekliyor"da kalmaz, ikinci gönderim yok, aynı istek kimliğiyle tekrar makbuz döner, yıldız bir kez; eş veli tablette aynı neden; çocuk modunda (1280 ve 390) "Eksik kalan parçayı tamamla, sonra yeniden gönder." + "Velinin notu: “Yatağı da topla”", Haftam'da da; takvimde toplu arşiv (çift tıklama tek koşu), eş veliye kayıtlar gizli, geri alma ikisini döndürür, geçmiş arşiv+geri alma sayıları; Prova taslağı panelinde atanmış taslak "Sınav olarak atanmış" ve seçilemez; yardımda eş velide "Yeni yanıt", ekip içi not hiç görünmez, açınca okundu olur. Her görüntüde yatay taşma ve çözülmemiş anahtar denetlendi, sayfa hatası yok.

Koşu sırasında bulunan ve düzeltilen: (1) çift dokunuş iki istek gönderiyordu (`isPending` yeniden çizimden önce güncellenmiyor) → eşzamanlı kilit; (2) ikinci bir incelemede kapanmış geri gönderme sayfası yeniden açılıyordu → sayfa yalnız kendi başarı geri çağrısında kapanır; (3) izole çalıştırıcıda `postgres`'in `auth.users` yetkisi yerel yığından eksikti ve son velinin hesap silmesi "Database error deleting user" ile düşüyordu → çalıştırıcı yerel yığın ACL'ini (`postgres=arwdDxtm`) aynalar; ürün koduna dokunulmadı (yerel `postgres` DB'sinde aynı yetki doğrulandı).

## Görüntüler (yalnız geçici sentetik aile)

[screenshots/](screenshots/): `return-sheet-phone`, `home-returned-reason-phone`, `approve-lost-reply-reconciled-phone`, `coparent-home-reason-tablet`, `child-return-next-desktop`, `child-return-next-phone`, `child-week-return-next-phone`, `calendar-bulk-preview-desktop`, `calendar-bulk-result-desktop`, `calendar-bulk-undone-desktop`, `calendar-bulk-entry-phone`, `prova-draft-bulk-tablet`, `help-new-reply-phone`, `help-thread-read-phone`.

Onaylı referansla karşılaştırma: yeni yüzeyler mevcut `DecisionSheet`, `SatinButton`, planner `p/u` belirteçleri ve çocuk teması (`#FFF6E5` açıklama kutusu, Nunito) ile kuruldu; yeni renk/yazı/görsel yok, oda ve maskot değişmedi. Çocuk sıradaki adım görüntüsü `child-home-mint` düzeninde mevcut "geri gönderildi" kutusunun içinde kalır (iç kutu aynı krem tonunda, hafif iç içe görünüm — görsel ince ayar yapılmadı).

## Yayın

Yayımlanmadı. Sıra: migration önce (eski istemci 4 argümanla çalışmaya devam eder), istemci sonra.

## Kalan sınır

- Haftalık özetin "hazır" (AI önerileri seçilebilir) durumu ücretli üretim olmadan oluşmadığı için **ön doldurma UI'da uçtan uca görülmedi**; `weekly_review_children` RPC'si pgTAP + izole sözleşmede, başlık kısaltma core testinde sınandı. Bütün aile önerisinde çocuk bağı yoktur; form o an seçili çocukla açılır ve bunu söyler.
- Yardım görsel eki UI'da (dosya seçici + web kırpma) Playwright ile **çalıştırılmadı**; sunucu tarafı (redaksiyon onayı, tür, boyut, sınır, idempotency, yetki) pgTAP 114'te. Native kırpma (`allowsEditing`) ve gerçek cihaz denenmedi. Yönetim panelinde ek görüntüleme yok (C07 dosyaları; operatör RPC'si hazır).
- Toplu seçim takvimde yalnız seçili çocuk için ve görünen hafta aralığıyla; aile düzeyi (tüm çocuklar) takvim kapsamı yok. Seri–aralık üyeliği L02'deki yaklaşıklamayla (`starts_at<=to`).
- Çocuk ekranları veli telefonundaki çocuk modunda denendi (aynı bileşenler); eşleşmiş çocuk cihazı JWT yolu yalnız izole REST sözleşmesinde (cihaz nedeni okur, karar veremez).
- Fiziksel iPhone/iPad/Android, VoiceOver/TalkBack, büyük yazı ve gerçek arka plan/ön plan geçişi denenmedi. Hosted Edge/Storage üzerinde deneme yapılmadı (yalnız yerel container + yerel Deno).
- `docs/CLAUDE-REMAINING-WORK.md` C03 kutusu işaretlenmedi; koordinatör güncellesin.
