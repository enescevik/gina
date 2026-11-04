# Belgeden ödev / çalışma planı — 4 Kasım 2026

Mevcut onaylı GINA sihirbazı, logo, Nunito ve krem/mor/mint bileşenleri kullanıldı. Yeni ana menü yok: Takvim → seçili çocuk → Ödev ve çalışmalar → Belgeden ödev planla. Çocuk cihazı çıkarımı veya belgeyi göremez; veli onaylı planın küçük adımlarını mevcut ekranda işaretler.

## Akış

1. Fotoğraf/PDF seçme veya son 30 özel belgeden birini açma. Yeni dosya için ayrı saklama onayı; sağlayıcıya gönderim için ayrı AI onayı.
2. En fazla 12 kaynak maddesinden birini/birkaçını/tamamını seçme. Kaynak sayfası, eksik tarih uyarısı, belgenin açılabilir bağlantısı ve daha önce eklenmiş maddeler görünür.
3. Her seçimin türü/adı/dersi/konusu, çalışma günü, isteğe bağlı teslim/saat ve en fazla 12 adım düzenlenir. Çalışma günü veli takvim seçimidir; AI üretmez. Tam yıl içermeyen veya göreli tarih null kalır; kaynak ifadesi kontrol notunda korunur. Bu kural istem ve doğrulama sözleşmesidir; modelin her yorumunun doğru olduğu iddiası değildir.
4. Veli açık kontrol onayı → tek atomik kayıt. Bu kayıt ders programını değiştirmez, otomatik yıldız veya değerlendirme üretmez.

## Kanıt

- `select-phone.png`, `review-phone.png`: 390×844 gerçek Expo web bileşenleri.
- `select-tablet.png`, `review-tablet.png`: 1280×800 aynı bileşen. Uzun içerik iç kaydırmada, onay/kayıt alt bölgede. Tablet yeni bir tasarım alternatifi değildir; ortak sihirbaz sözleşmesidir.
- `qa-fixture.cjs` ve kardeş `../learning-plan/qa-fixture.cjs`: yalnız sentetik ağ yanıtları, özel test sunucusu 8098. Gerçek aile/veritabanı/AI sağlayıcısına gidilmedi.
- İki seçim, başlık düzenleme, yön değiştirmede durum koruma, tek AI çağrısından iki kayıt denendi. Yeniden belge açma AI çağırmadı; eklenmiş iki satır seçime kapalı geldi.
- Sunucu kaydından sonra yanıt kaybı → yeniden yükleme → aynı UUID ve aynı içerikle kurtarma: iki istek, iki toplam plan, tek üretim.
- İstek sunucuya ulaşmadan ağ kaybı → yeniden açılış → kesin tarih hatası: düzenlenmiş başlık ve iki seçim korundu; tekrar onayla kayıt başarılı.
- Sihirbazın asenkron adım değişiminde kaydırma konumu başa döner. Mobil genişlikte yatay taşma ve yakalanmış sayfa istisnası yok.

## Sunucu ve sınırlar

`091000`: canlı aile/veli/çocuk/kaynak kapsamı, sunucudan sınıf bilgisi, özgün kaynak hash'i/model/istem/şema/dil ile değişmez çıkarım bağlamı. Aynı kayıtlı kaynak + çocuk + dil aynı sonucu kullanır. Başka dosya kimliğiyle yeniden yüklemek aynı istek değildir; hash bazında dosyalar arası küresel tekilleştirme yoktur.

`import` paket politikası/kota/oran/eşzamanlılık ve belirsiz işlem için mevcut operatör kurtarması kullanılır. Çalışan/belirsiz üretim otomatik yeniden başlatılmaz. Onaylı sonuç ve token kullanım kaydı aynı işlemde saklanır. Kaynak/çocuk silinirse ham çıkarım temizlenir ve geç sağlayıcı cevabının işlem yetkisi iptal edilir; kullanım sayımı silinmez. Velinin onayladığı plan kaynak silinince kalır. Kaynağa bağlı planlar otomatik dosya temizliğinden korunur; uygulanmamış çıkarım, bağlantısız kaynağa yedi gün koruma sağlar.

42 yeni SQL kontrolü: toplam 69 dosya / 1978 kontrol. Beş gerçek DB yarışı: aynı kayıt, iki cihazın aynı seçimi, kaynak silme, çocuk silme, iki ücretli rezervasyon. Core195; ilgili Edge32; mobil/core tip, mobil lint, native metin denetimi geçti. iOS/Android/web dışa aktarımı başarılı; native mağaza derlemesi değildir.

AI sonucu saklıdır; henüz Kaydet'e basılmamış yerel düzenlemeler kalıcı taslak değildir (çıkış uyarısı var). Kaydet'e basılan belirsiz komut kullanıcı/aile/çocuk kapsamlı cihaz deposunda tutulur ve oturum çıkışında temizlenir. Gerçek yeni dosya–Storage–AI uçtan uca kabulü, fiziksel iPhone/iPad/Android/VoiceOver ve üretim yapılandırması açık. Yeni paket eklenmedi. Migration/Edge/istemci dağıtılmadı; TestFlight 0.1.0 (17) değişmedi.
