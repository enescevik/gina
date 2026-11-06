# D17 — eşleştirme saklama işleri (6 Kasım 2026)

Kaynak: [D16 README §4](../d16-2026-11-06/README.md) madde 2, 3 ve 9; [C13 AUTH-1-FIX](../c13-2026-11-06/AUTH-1-FIX.md) §4.
Koordinatör kararı: gizlilik metninin vaat ettiğini kod yapsın.

Migration: `supabase/migrations/20261106450000_pairing_retention_jobs.sql` (tek dosya).
pgTAP: `supabase/tests/130_pairing_retention_jobs.test.sql` (45 iddia; 129 numarası D15'e ait olduğu için 130).

## 1. Kullanılmayan eşleştirmenin 90 gün sonra kaldırılması

**`gina.prune_unused_devices(p_now default now())`** — her gün 03:25 UTC (`pg_cron` işi `prune-unused-devices`).

- **"Son kullanım" sinyali** (`gina.device_last_used_at(device_id)`): yeni bir istemci yazımı eklenmedi; cihazın sunucuda zaten bıraktığı izlerin en yenisi alınır:
  `devices.paired_at`, `devices.last_seen_at` (cihazda çocuk girişi/seçimi), cihazın anonim kullanıcısının `auth.users.last_sign_in_at`,
  `auth.sessions.refreshed_at` (UTC, saat dilimsiz sütun → `at time zone 'UTC'`) / `updated_at` / `created_at`, `auth.refresh_tokens.updated_at`
  ve cihazın kendi `push_tokens.updated_at` kaydı. GoTrue her token yenilemede (uygulama açıkken en az saatte bir) oturum/refresh token satırını
  günceller; bu yüzden aynı çocuk aylarca seçili kalsa bile kullanılan tabletin her zaman yeni bir sinyali olur. `last_seen_at` tek başına yetmezdi
  (yalnız çocuk girişinde yazılıyor).
- **Kaldırma ölçütü (en güvenli okuma):** sinyallerin **hepsi** 90 günden eskiyse. Yeni eşlenmiş cihaz (`paired_at` < 90 gün) hiç kaldırılmaz;
  zaten iptal edilmiş cihaza dokunulmaz; işlemdeki satır (`for update skip locked`) atlanır ve kilit altında koşul yeniden denetlenir.
- **Kaldırma = ebeveynin `revoke_device`'ı ile aynı:** `revoked_at = now()`, `active_child_id = null`. Satır ve geçmişi silinmez; access-token hook
  bir sonraki yenilemede rolü `none` yapar; tablet yeni kod alıp yeniden eşlenebilir (130'da `request_pairing` ile kanıtlandı). Anonim oturum
  silinmez (ebeveyn kaldırmasıyla tutarlı; oturumu silmek tableti eşleme ekranına dönemeyecek hâle getirebilirdi).
- **Ebeveyn bildirimi:** mevcut uygulama içi kutu (`gina.parent_inbox`, yeni tür `device_unused_removed`), ailenin **her** ebeveynine kaldırılan
  cihaz başına bir not (`event_key` ile tekrarsız, 30 gün). Not kişisel veri taşımaz (cihaz adı, aile adı, çocuk yok). Push gönderilmez.
- `p_now` yalnız testte "şu andaki gibi" geçmiş bir anı değerlendirmek içindir ve `least(p_now, now())` ile sınırlanır: ileri bir `p_now`
  gerçek saatte kalacak hiçbir cihazı kaldıramaz.

## 2. Eşleştirme deneme kayıtlarının periyodik temizliği

**`gina.prune_pairing_records(p_now default now())`** — her gün 03:35 UTC (`prune-pairing-records`). Siler:
- `device_pairing_attempts`: 1 günden eski (kilit yalnız son 10 dakikayı saydığı için kilit sonucu değişmez; aynı ebeveynin yeniden denemesindeki
  eski silme de aynen duruyor),
- `device_pairing_locks`: süresi geçmiş kilitler (çalışan kilit silinmez; aynı anda yazılan yeni kilit satır kilidiyle korunur),
- `device_pairing_previews` ve `device_pairings`: süresi 1 günden önce dolmuş jetonlar ve kodlar (ikisinin de ömrü ≤ 10 dk).
Aynı `least(p_now, now())` sınırı geçerli. Dönüş: silinen satır sayıları (`{"attempts","locks","previews","codes"}`).

Her iki fonksiyon ve yardımcı: `security definer`, `search_path=''`, `public`/`anon`/`authenticated`/`service_role`'den geri alındı (yalnız sahibi;
cron `postgres` olarak çalışır). Public RPC imzası değişmedi → `database.types.ts` yeniden üretilmedi (gina şeması tiplerde yok). C07'nin 24 admin
RPC'sine dokunulmadı.

## 3. Yasal metin çapraz başvuruları

Anlam vaatle örtüşüyor; yalnız D16'nın "bu iş yok" denetim notları uygulanan davranışla değiştirildi ve "kullanılmama" tanımı eklendi:
- `docs/legal/gizlilik-politikasi.md` TR + EN saklama tablosu (eşleştirilmiş cihazlar; eşleştirme kodu ve deneme kayıtları satırları) + D17 değişiklik satırları.
- `docs/legal/veli-beyani-ve-cocuk-profili-onayi.md` §6 eşleştirilmiş tablet + D17 değişiklik notu.
KVKK Aydınlatma §173 ve Çocuk Modu Bilgilendirmesi zaten "[90 gün] kullanılmayana kadar" diyor; değişmedi. `[90 gün]` yer tutucusu korunur
(kodda 90 gün sabit; süre değişirse migration'daki `c_idle` de değişmeli). Hukuk uzmanı onayı yoktur.

## 4. Eski UI testleri (D16 §4.9)

- `scripts/test-screen-review-a1-ui.cjs` güncellendi: tablet `pairing-code` (8 karakter, 4+4) → veli `/parent/pair-device`'ta kodu girer →
  `Cihazı göster` → önizleme (`pairing-target`, cihaz adı) → `Bu cihazı aileme bağla` → `/parent/device-access` özeti. Fixture yolu
  `GINA_QA_UI_FIXTURE`, çıktı dizini `GINA_QA_A1_OUT` ile verilebilir (varsayılanlar eskisi gibi). Akış dışı üç sapma da düzeltildi:
  aile ekranında katılma formu ayrı sekmede (`u02.family.tab.join`), kayıt "Yeni hesap" seçimiyle başlıyor, aile oluşturma önce
  "oluştur/katıl" seçimi istiyor (U01).
- `scripts/test-u02-device-family-ui.cjs` D2'de (`0496957`) zaten 8 karakter + önizleme jetonu akışına taşınmıştı; değişiklik gerekmedi, koşuldu.

## 5. Doğrulama (gerçekten koşuldu, bu worktree, `main` birleştirildikten sonra)

| Test | Sonuç |
|---|---|
| pgTAP 130 tek başına, Europe/Istanbul / UTC | 45/45 · 45/45 |
| A/B: 130, migration'sız (`--skip-migration 20261106450000`) | beklenen düşüş: `function "gina.prune_unused_devices(timestamptz)" does not exist` |
| Tam pgTAP Europe/Istanbul (`test-q02-sql.py --run-local`) | **128 dosya, 5.847 iddia, 0 hata** (102 hijyen dâhil) |
| Tam pgTAP UTC (`--timezone UTC`) | **128 dosya, 5.847 iddia, 0 hata** |
| İzole servisler `--run-local --with-realtime --ui-hold` (kendi fixture'ı scratchpad'de) | **194/194**; temizlik realtime/rest/auth/DB `removed: true`, fixture dosyası silindi |
| `expo export -p web` (fixture'a bağlı) + `serve-spa.mjs` 8717 | başarılı; sunucu durduruldu |
| Playwright A1 (`test-screen-review-a1-ui.cjs`) | **14/14** — [a1/after-checks.json](a1/after-checks.json), görüntüler `a1/` |
| Playwright U02 (`test-u02-device-family-ui.cjs`) | **15/15** — [u02/ui-checks.json](u02/ui-checks.json), görüntüler `u02/screenshots/` |
| `pnpm --filter @gina/core test` | 450/450 (63 dosya) |
| `pnpm typecheck` | 4/4 |

**pgTAP 130 kapsamı:** yetki (anon/authenticated/service_role çalıştıramaz, security definer + boş search_path); son kullanım sinyalleri tek tek
(çocuk girişi, UTC `refreshed_at`, refresh token, push token, anonim giriş, `paired_at`'a düşüş); T = 2026-06-01 anına göre koşu: 3 cihaz
kaldırılır (eski, B ailesindeki eski, kesimden 1 saat önce yenilenmiş), 8 cihaz kalır (yakın yenileme, **aktif çocuk cihazı** — seçili çocuğu da
korunur, refresh token, push, giriş, yeni eşleme, kesimden 1 saat sonra yenilenmiş, gerçek saatteki cihaz); iptal edilmiş cihaza dokunulmaz;
satır kalır; hook rolü `none`/`device`; notlar A'nın iki ebeveynine 2×2, B'ye yalnız kendi ebeveynine, kişisel veri yok, ikinci koşu 0 ve tekrar
not yok; kaldırılan tablet yeni kod alır; ileri `p_now` 10 günlük cihazı kaldırmaz. Kayıt temizliği: T'ye göre sayımlar, 1 günden genç deneme,
çalışan kilit, bekleyen kod ve canlı jeton kalır; ileri `p_now` yalnız gerçek saate göre eskiyeni siler, 10 dk penceresindeki 10 hata kalır;
temizlikten sonra kilitli veli doğru kodla da `pairing_locked`, kilitsiz velinin silinmiş koda denemesi `invalid_or_expired` ve sayılır.

## 6. Sınırlar

- **pg_cron yerelde yok:** test şablonunda `cron` şeması bulunmadığından migration yalnız notice verir; `cron.schedule` çağrıları yerelde
  koşmadı (diğer migration'lardaki kalıpla aynı). Yayında `select jobname, schedule from cron.job where jobname like 'prune-%'` ile
  doğrulanmalı. pgTAP fonksiyonları doğrudan çağırır.
- "Kullanılmama" sunucu izlerine dayanır. Hosted ortamda GoTrue oturum temizliği (oturum zaman kutusu/inaktivite) açılırsa eski oturum satırları
  silinir; o durumda sinyal `paired_at`/`last_seen_at`/push'a düşer — sonuç yine "gerçekten kullanılmayan" yönündedir, çünkü oturumu silinmiş
  tablet zaten istek yapamaz.
- Not yalnız uygulama içi kutuya düşer (push yok); mobil istemci kutuyu `title/body` ile genel gösterdiği için ek istemci kodu gerekmedi.
- Cihaz kaldırılınca `push_tokens` satırı silinmiyor (ebeveyn `revoke_device` ile aynı); `push_targets` iptal edilmiş cihaza göndermez (`d.revoked_at is null`).
- CI koşmadı (push yok); fiziksel cihaz yok; UI doğrulaması web export üzerinde. Üretime ve `main`'e dokunulmadı.
