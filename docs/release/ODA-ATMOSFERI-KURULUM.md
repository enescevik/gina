# Oda atmosferini etkinleştirme

31 Ekim 2026. Supabase/Expo/Apple hesabı açma adımları [ana kurulum rehberinde](YAYIN-KURULUM-REHBERI.md). Bu sayfa yeni hava ve ses özelliğinin kurulumu içindir.

## Senin uygulamada yapacağın

1. Üretim hesabı bağlantısı ve aşağıdaki teknik kurulum tamamlandıktan sonra veli hesabıyla giriş yap.
2. **Menü → Odanın havası ve sesleri → Hava için şehir seç** bölümünü aç.
3. İl adını ara ve seç. Şimdilik Türkiye'nin 81 il merkezi destekleniyor. GPS izni istenmez.
4. İstersen **Oda seslerine izin ver** seçeneğini aç. Bu tek başına ses başlatmaz.
5. Çocuk odasında sağ/alt taraftaki ses simgesine dokun. Yağmur/rüzgâr varsa ortam sesi başlar. Kedi seçiliyken kediye dokununca kısa mırıltı çalar. Tekrar ses simgesine dokunarak sustur.
6. Sakin kullanım için **Odadaki hareketler** seçeneğini kapatabilirsin. Telefonun/tabletin “Hareketi azalt” ayarı da uygulanır.

Şehir seçilmediyse “Örnek atmosfer” normaldir. “Hava bekleniyor” veri alınamadığını, “Son tahmin” çevrimdışı/eski tahmin kullanıldığını gösterir. Hava ekranındaki saat, tahminin üretim zamanıdır.

## Teknik kurulum — hesaplar hazır olunca Codex ile

Gerçek proje reference ID'si doğrulanmadan komutları çalıştırma. Yerel demo veritabanını sıfırlama/yeniden tohumlama gerekmez.

```sh
cd /Users/enes/Documents/projs/gina
pnpm exec supabase link --project-ref GERCEK_PROJE_REFERENCE_ID
pnpm exec supabase db push --dry-run
# Listelenen migration'lar doğru üretim projesine aitse:
pnpm exec supabase db push
pnpm exec supabase functions deploy room-weather
```

`20261031140000_room_atmosphere.sql` şehir listesi, aile tercihleri ve özel sunucu önbelleğini kurar. Function özel bir hava API anahtarı gerektirmez; Supabase çalışma ortamının sunucu kimlik bilgilerini kullanır. Service-role anahtarını mobil uygulamaya koyma. Kaynak API'sinin ücretsiz erişimiyle Supabase kullanım maliyetleri ayrı şeylerdir.

`expo-audio` yerel modül içerdiği için yalnız OTA/web güncellemesi yeterli değildir. Güncel bağımlılıklarla yeni EAS iOS/Android build gerekir. Mikrofon ve arka plan ses izinleri kapatıldı. Bu iş için başka uygulama paketi eklenmedi.

## Fiziksel cihaz kabulü

1. iPhone, iPad ve bir Android cihazda oda açılır; native yazılar ve görev kontrolleri aynı konumda kalır.
2. Sessiz anahtar açıkken iPhone ses çıkarmaz. Kulaklığı çıkarınca ses durur. Ekran kilitlenince/uygulama arka plana geçince ses sürmez.
3. Prova ekranına geçince ortam ve pet sesi kesilir. “Hareketi azalt” açıkken yağmur/kar hareket etmez.
4. Ağ kapatılınca önbellek açıkça “Son tahmin” olarak görünür; yanlış bir güncel hava gösterilmez.
5. Yağmur/rüzgâr döngüsünü en az bir dakika kulaklık ve cihaz hoparlöründe dinle: sıçrama, tık ve rahatsız edici seviye olmamalı. Gerçek cihaz dinleme kabulü henüz yapılmadı.
6. 10 dakika kullanımda kare süresi, bellek ve pil davranışı ölçülür. Web ekran görüntüsü bu ölçümün yerine geçmez.

## Doğal pet animasyonları için kalan

31 Ekim güncellemesi: Enes Pro planını etkinleştirdi; video erişimi doğrulandı. Kedinin uyku ve esneme örnekleri kaynak MP4, şeffaf WebM ve V5 oda montajıyla [inceleme paketinde](../design/screens/child/cat-motion-v5/index.html). Önce bu iki hareketin kimliği ve doğallığı değerlendirilecek; kabul edilmeden diğer üç hayvana çoğaltılmayacak. Uygulamadaki petler hâlâ statik; örnekler henüz native runtime'a bağlanmadı. Üretilen video düzenlenebilir rig değildir; [üretim brief'indeki](PET-VE-HAVA-URETIM-KABULU.md) cihaz performans ve geçiş kabulü sürer.
