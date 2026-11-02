# Veli çözüm incelemesi — onaylı tasarım ve uygulama

Kullanıcı telefon/tablet maketini ve sunucuda `@resvg/resvg-wasm` kullanımını açıkça onayladı. Mevcut GINA logosu, Nunito fontları, krem/lila yüzeyler ve mor ana eylem korundu. Mobil pakete bağımlılık eklenmedi.

## Uygulama

- Tablet: %32 soru/değerlendirme, %68 defter; genişlet ile defter tüm alanı kullanır. Paneller kendi içinde kayar.
- Telefon: Çözüm / Değerlendirme sekmeleri; geniş defter, kompakt soru önizlemesi, altta tek ana eylem. 320×568 ve 390×844 kontrol edildi.
- Numara seçici soru durumunu gösterir. Cevap anahtarı ve ortak kaynak açılır/kapanır. Çoktan seçmeli seçenekler ve çocuğun seçimi korunur; hesaplanan doğru/yanlış değiştirilmez.
- Veli çizimi/notu ayrı katmandır. Gizle, silgi, geri al ve yinele çocuğun özgün belgesini değiştirmez. 0–100 puan, geri bildirim ve veli katmanı tek kayıt işleminde saklanır. Boş puan sıfıra çevrilmez.
- Eski revizyon yeni değerlendirmeyi ezemez. Kaybolan HTTP yanıtında aynı istek kimliğiyle yeniden deneme yapılır. Kayıtsız çıkış uyarısı vardır. Kalıcı çevrimdışı taslak yoktur.
- Çocuk kendi gönderilmiş cevabının üzerindeki kaydedilmiş veli notlarını/geri bildirimini açabilir. Kardeş ve başka aile erişimi engellenir; toplu sınav bitiş ambargosu korunur.
- Prova özeti, mevcut detaylı AI raporu ve çalışma planı aynı yerde kalır. Çözümleri incele yeni çalışma ekranını açar. Eski toplu AI değerlendirmesi çizimli cevapları otomatik puanlamaz.

## AI sözleşmesi

İşaretlenmemiş ayrı paylaşım onayı ve gerçek kalan hak gösterilir. Sunucu yalnız kendi veritabanındaki özgün çocuk cevabını, bağlı soru görsellerini ve cevap anahtarını okur. İstemciden gönderilen görsel/URL veya veli çizimi kullanılmaz. Onay, sağlayıcı çağrısından önce kaydolur.

1000×1400 PNG, uygulamanın Nunito fontuyla sunucuda üretilir. Metnin sığmadığı/bilinmeyen belge hatası sessiz kırpmaya dönüşmez. Kaynaklar aile, soru bağlantısı, hash, boyut ve tür kontrolünden geçer. PNG geçici bellektedir; veritabanına görüntü hash'i ve cevap hash'i yazılır. Resvg WASM ve font lisans/kökeni `supabase/functions/prova-review/assets/provenance.json` içindedir.

AI çıktısı puan önerisi, kanıt, geri bildirim, sonraki adım ve sınırlama içerir. Okunamayan cevap tahmini sıfır almaz. **Taslağa al** alanları doldurur; **Kaydet** olmadan puan yayımlanmaz. Mevcut kota, hız sınırı, kalıcı iş kaydı ve belirsiz sağlayıcı sonucu korumaları kullanılır. Aynı cevap için saklanmış öneri tekrar ücretlendirilmez.

## Görsel ve işlem kanıtı

- [Onaylı maket](parent-phone-tablet-proposal-v1.png)
- [Tablet uygulaması](tablet-implemented-web.png)
- [Telefon: çözüm](phone-solution-web.png)
- [Telefon: değerlendirme](phone-assessment-web.png)
- [Çocukta geri bildirim](child-feedback-web.png)
- [Kontrol kaydı](implementation-review.json)

Görüntüler gerçek Expo web arayüzünden, sentetik bahçe sorusuyla alındı. Maketteki üçgen örneği zorla uygulama verisi gibi gösterilmedi. Auth/Storage yerel test vekili, kayıt ve yetki kontrolleri izole PostgreSQL/PostgREST üzerinden çalıştı. Fiziksel iPhone görüntüsü değildir. AI taslağa alma arayüz testi açıkça sentetik sağlayıcı yanıtı kullandı; gerçek servis doğrulaması ayrı yayın kaydında tutulur.

Bildirilen sınırlar: fiziksel cihaz kalem gecikmesi, Apple Pencil basınç/eğim/avuç içi reddi bu teslimin kanıtı değildir. Yeni canlı sahne, maskot veya başka ekran tasarımı eklenmedi. Yayın durumu ayrı sürüm kaydındadır; maket onayı TestFlight'a yüklenmiş olduğu anlamına gelmez.
