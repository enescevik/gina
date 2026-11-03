# Okul senaryosu hazırlama — 4 Kasım 2026

Mevcut onaylı GINA sihirbazı kullanıldı. Teknik `konu; sayı` metni yerine çocuk/ders → konu satırları ve soru sayıları → okul duyurusuyla son kontrol akışı var. Yeni görsel yön veya maskot üretilmedi.

## Davranış

- Tek çocuk otomatik seçilir; kayıtlı sınıf esas alınır. Sınıf bilinmiyorsa veli açıkça seçer. Ders programındaki dersler önerilir; ders adı düzenlenebilir.
- Eğitim yılı, dönem ve yazılı seçilir. Birlikte ölçülen çıktılar tek konu satırında kalır. En fazla 30 ayrı satır ve toplam 30 soru; yinelenen veya boş konu kabul edilmez.
- Son adımda sınıf, yıl, yazılı ve dağılım görünür. Okul duyurusuyla karşılaştırma işaretlenmeden kaydedilmez. Bu veli girdisidir; resmî katalog onayı olarak sunulmaz.
- Kayıt soru oluşturmaz, AI kullanımını başlatmaz veya çocuğa Prova atamaz. Prova içindeki AI kaynağından senaryo ekleme açılır; dönünce güncel senaryolar alınır.
- AI üretimi yeni birleşik akışta kaydedilmiş, aileye ait Prova taslağına ve çocuğun güncel sınıfına bağlanır. Ders/sınıf uyuşmazlığı, gönderilmiş taslak veya eksik taslak sağlayıcı çağrısından önce reddedilir. Senaryo kapsamının anlık kopyası soru kökenine yazılır. Eski bağımsız üretim uyumluluğu korunur.
- Üretim sonucu her konu için istenen adet ve soru türü bakımından mevcut sıkı denetimden geçer. Hatalı eski senaryo satırları sessizce kırpılmaz veya değiştirilmez.

## Kanıt

Gerçek React Native Web ekranı, sentetik aile ve ağ yanıtlarıyla 390×844 ve 1280×800 ölçülerinde incelendi. `qa-fixture.cjs` gerçek aile/sağlayıcı kullanmaz.

- `distribution-phone.png`, `distribution-tablet.png`: ayrı konu satırları ve 48 dp sayaç düğmeleri.
- `review-tablet.png`: son kontrol ve veli doğrulaması.
- `saved-phone.png`: henüz soru üretilmediğini belirten sonuç.
- `recovery-phone.png`: sunucuda kaydedildikten sonra yanıt kaybı; tam sayfa yeniden açıldığında aynı komutun kurtarılması. Aynı kimlik ve gövdeyle tekrar tek senaryo kaydına döndü.
- 27 yeni SQL kontrolü; toplam 54 dosyada 1.382 kontrol. Üç gerçek PostgreSQL yarışı: aynı komut, aynı kimlikle farklı içerik, kayıtla eşzamanlı çocuk sınıfı değişikliği. Yalnız geçici denetim DB kopyaları kullanıldı.
- 122 core testi; 11 ilgili Edge testi; mobil tip kontrolü/lint ve Edge tip kontrolü geçti.

## Sınırlar ve dağıtım

076000 ve `prova-generate` birlikte dağıtılmalı; önce sunucu sonra istemci. Üretim/TestFlight değişmedi. iPhone/iPad klavye, erişilebilirlik ve gerçek AI sonucu kabulü henüz yapılmadı. Telefon/tablet görüntüleri native kanıt değildir.

Bu artım **resmî MEB katalog/API/insan kaynak incelemesini tamamlamaz**. 648 senaryo adayı ve öğrenme çıktısı kataloğu ayrı inceleme bekler. Okulun seçtiği senaryoyu kendiliğinden belirlemiyoruz. Yeni nesil pedagojik uygunluk, model cevabı veya okul programı doğruluğu yalnız teknik doğrulama ile onaylanmış sayılmaz.
