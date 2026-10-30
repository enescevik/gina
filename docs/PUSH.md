# Push bildirimleri — kurulum (Enes)

Akış: veritabanı tetikleyicileri `push_outbox`'a yalnız kimlik içeren satır yazar → pg_cron her dakika `push-send` Edge Function'ını çağırır → iOS'a APNs, Android'e FCM HTTP v1 ile gider. Expo push servisi ve Firebase SDK kullanılmaz. Bildirim metni geneldir; çocuk adı, not, puan içermez. Anahtarlar tanımlanana kadar satırlar `skipped_unconfigured` olarak işaretlenir, hiçbir şey kırılmaz.

## 1. Apple (APNs anahtarı)

1. Apple Developer → Certificates, Identifiers & Profiles → **Keys** → `+` → "Apple Push Notifications service (APNs)" işaretli yeni anahtar. `.p8` dosyasını indir (bir kez indirilebilir), **Key ID**'yi not al.
2. **Team ID**: Membership sayfasında.
3. Identifiers → `com.enescevik.gina` → **Push Notifications** yeteneğini aç (sertifika gerekmez; token tabanlı kimlik doğrulama kullanıyoruz).

## 2. Firebase (yalnız FCM kimlik bilgisi)

1. Mevcut GCP projesine bağlı boş bir Firebase projesi oluştur (Analytics **kapalı**).
2. Proje ayarları → Android uygulaması ekle: paket adı `com.enescevik.gina`. İndirilen `google-services.json` dosyası EAS build için gerekir (repo'ya girmez; EAS secret/file olarak verilir).
3. Proje ayarları → Service accounts → "Generate new private key" → JSON dosyası. Bu hesap yalnız `Firebase Cloud Messaging API Admin` yetkisine ihtiyaç duyar.
4. Google Cloud Console'da "Firebase Cloud Messaging API (V1)" etkin olmalı.

## 3. Supabase secrets (değerleri yalnız Enes girer)

`supabase secrets set …` ile:

- `APNS_KEY_P8` — `.p8` dosyasının içeriği (PEM metni)
- `APNS_KEY_ID` — Key ID
- `APNS_TEAM_ID` — Team ID
- `APNS_BUNDLE_ID` — isteğe bağlı, varsayılan `com.enescevik.gina`
- `APNS_ENV` — isteğe bağlı; geliştirme build'leri için `sandbox`, TestFlight/App Store için boş bırak (production)
- `FCM_SERVICE_ACCOUNT_JSON` — service account JSON dosyasının tamamı
- `PUSH_SEND_SECRET` — rastgele uzun bir değer (cron'un fonksiyonu çağırırken kullandığı anahtar)

Deploy: `supabase functions deploy push-send --no-verify-jwt`.

## 4. Zamanlayıcı (Vault)

pg_cron işi (`push-send`, her dakika) migration'la kurulur; URL ve anahtarı Vault'tan okur. SQL Editor'de bir kez:

```sql
select vault.create_secret('https://<proje-ref>.supabase.co/functions/v1/push-send', 'push_send_url');
select vault.create_secret('<PUSH_SEND_SECRET ile aynı değer>', 'push_send_secret');
```

Vault kayıtları yoksa cron sessizce hiçbir şey yapmaz. İsteğe bağlı: anlık gönderim için Dashboard → Database Webhooks'tan `push_outbox` INSERT olayına `push-send` çağrısı eklenebilir (aynı `Authorization: Bearer` başlığıyla).

## Kontrol

`select status, count(*) from push_outbox group by 1;` — `sent`, `no_targets`, `skipped_unconfigured`, `failed`. Geçersiz token'lar (APNs 410/Unregistered, FCM UNREGISTERED) otomatik silinir.
