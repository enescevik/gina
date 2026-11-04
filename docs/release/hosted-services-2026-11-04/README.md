# Canlı sunucu kabulü — 4 Kasım 2026

Bu kayıt mobil/web/yönetim paneli yayını veya bütün işlevlerin kabulü değildir.
Ürün kaynağı: `3b661c8` (PR #130 sonrası main). Mevcut aile/demolar sıfırlanmadı.

## Dağıtım

- Üretim `gina-prod` veritabanı 20261103040000 → **20261103094000**: 32 migration uygulandı. Son dry-run `upToDate: true`, `migrations: []`.
- Önce public/gina şema ve veri SQL yedeği yerel özel dizine alındı (0700 dizin/0600 dosya). Bu yedek Auth/Storage tam felaket kurtarma kopyası değildir; geri yükleme tatbikatı yapılmadı. Yedek Git'e veya bu rapora eklenmedi.
- **19 Edge function** dağıtıldı; ad/sürüm/ACTIVE/JWT ayarı `function-revisions.json` içinde. Yeni: `learning-plan-import`, `contribution-submit`, `iap-operator-reconcile`.
- `prova-review` ve `contribution-submit` için WASM ve font dosyaları dağıtım paketinde yer aldı. Ertelenmiş `room-weather` dağıtılmadı.

## Gerçek AI ve kayıt zinciri

`ai-verification.json`: **29 kontrol + 6 temizleme doğrulaması geçti**. Yalnız yeni sentetik hesap/aile/çocuk ve sabit sentetik PNG'ler kullanıldı. Mevcut `sources.enabled` açık olduğu doğrulandı; genel özellik ayarı değiştirilmedi. Test ailesine bir saatlik Pro hakkı verildi ve test sonunda normal hesap silme akışıyla kaldırıldı.

Gerçek Auth → özel Storage → ürün Edge function → Anthropic → veli düzeltmesini temsil eden RPC → kalıcı kayıt zinciri:

1. Ders programı: eksik saati null bırakma, veli tamamlama, ders/takvim/kaynak bağlantısı, aynı makbuzun tekrarı.
2. Haftalık özet: sonucu tekrar açma, tek kota kaydı, kanıtsız zorluk çıkarımı yapmama.
3. Belgeden ödev/kurs: iki öğe, eksik tarihi veli düzeltmesi, tek işlemle uygulama, özel kaynak.
4. Görev ve ödül: önerilerin birden fazlasını seçme, tek makbuz, özgün kaynak bağlantısı, ücretli sonucu yeniden kullanma.

**Toplam beş gerçek ücretli üretim** yapıldı. Otomatik tekrar yok. Raporlanan üç kalıcı kullanım kaydı ders programı/plan/haftalık içindir; iki setup işleminin token sayısı mevcut sözleşmede tutulmadığından uydurulmadı. Sentetik kullanıcı/aile/kaynak/nesnelerin kalmadığı doğrulandı.

Bu, ekranlara tıklanmış bir telefon/tablet deneyi değildir. Aynı ürün işlevleri gerçek hizmetlere HTTP üzerinden çağrıldı.

## Açık kalan sınır

`boundary-verification.json`: anonim anahtarla boş POST verilen **18 uç nokta 4xx ile reddetti**. Bu kontrol her yetki senaryosunu kapsamaz; ayrıntılı sınırlar izole hizmet/SQL testlerinde ayrıca sınanır.

**`google-rtdn` 503 `push_auth_not_configured`** döndürdü. Handler, `GOOGLE_RTDN_AUDIENCE` ve `GOOGLE_RTDN_SA_EMAIL` olmadan Google bildirimini işlemez. Bu güvenli kapalı durumdur; Google Play entegrasyonu tamamlanmış değildir. Betik bu yüzden başarılı çıkış kodu üretmez. Geçerli mağaza satın alması/yenileme/iade testi yapılmadı.

## Tekrar çalıştırma

- `node scripts/learning-service-smoke.mjs --project-ref=<project> --run`: bir ücretli ders programı üretimi.
- Aynı komuta `--features` eklemek: en fazla beş ücretli üretim; yalnız açık operatör kararıyla, CI'da otomatik çalıştırılmaz.
- `node scripts/check-hosted-function-boundaries.mjs --project-ref=<project> --run`: anonim boş istekler; yetkili iş/hesap silme/üretim/satın alma çalıştırmaz. Eksik yapılandırma ve 5xx görünür hata kalır.

Anahtarlar CLI'dan yalnız belleğe alınır; rapora, Git'e veya komut çıktısına yazılmaz. İlk betik sentetik hesabı normal akışla siler; hata durumunda yalnız kendi oluşturduğu kimliklerle temizleme yapar.
