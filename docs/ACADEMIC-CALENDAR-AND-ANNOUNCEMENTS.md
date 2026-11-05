# Eğitim takvimi, aile duyuruları ve gelecek sosyal alan

> **5 Kasım devir güncellemesi:** Kalan işlerin güncel durumu, yürütme sırası ve kabul ölçütleri [Claude devir listesinde](CLAUDE-REMAINING-WORK.md). Bu belgedeki ürün kuralları korunur; eski faz/yayın ifadeleri güncel durum beyanı değildir. 3B dünya diğer bütün işlerin ve son yayın kabulünün arkasındadır.

5 Kasım 2026 — PR #143 kapsamına eklenen ürün kararı. Üretim yayını değildir.

## Birbirinden ayrı kavramlar

- **Takvim:** bir okulun/kademenin çalışma tarihleri. Yıl ve yarıyıllar; ara tatil boşlukları. Sınıf yükseltmez.
- **Eğitim kaydı:** çocuğun hangi tarihte hangi sınıfta/okulda olduğu. Başarılar, geçmiş Provalar ve program arşivi korunur.
- **Takvim bildirimi:** velinin kendi okulundan aktardığı, doğrulanmayı bekleyen bilgi. Ortak takvimi değiştirmez.
- **Duyuru:** yönetimin hedeflediği ailelere bilgilendirme. Görevleri/programı kendiliğinden iptal etmez veya yeniden planlamaz.

## Takvim kapsamı ve kaynak

Ülke → il/bölge → ilçe → okul/kampüs. Aynı yıl ve kademede en özel yayımlanmış takvim kazanır. İlkokul, ortaokul, lise, okul öncesi ve üniversite ayrı kapsamlar. Üniversite takvimi desteği üniversite müfredatı/soru havuzu desteği değildir.

Özel okul istisnası gerçek bir ihtiyaçtır: [MEB açıklaması](https://www.meb.gov.tr/sss.php?v=1.0.23) özel okullar için genel takvim yanında valilikçe kabul edilen ayrı çalışma takvimlerini de anlatır. Üniversite/kampüs farkına resmî örnek: [ODTÜ Ankara ve Erdemli akademik takvimi](https://oidb.metu.edu.tr/en/metu-ankara-and-erdemli-campuses-2026-2027-academic-year-calendar). Bunlar bütün okullara tek tarih atama gerekçesi değildir.

Yalnız Türkiye ülke seçeneği başlangıç verisidir; doğrulanmamış tarihler veya uydurma okul listesi üretime eklenmez. Her takvim kaynak URL'si ve kontrol tarihi ister. Örnek resmî kaynaklar: [MEB 2026–2027](https://www.meb.gov.tr/2026-2027-egitim-ogretim-yili-takvimi-aciklandi/haber/41057/tr), [İstanbul çalışma takvimi](https://istanbul.meb.gov.tr/www/2026-2027-egitim-ogretim-yili-calisma-takvimi/icerik/6380). Tarihler ayrıca kontrol edilip yönetimde kaydedilecek.

Takvim taslağı kaydedilir, sonra değişmemiş taslağın önizlemesinden yayımlanır. Canlı sürüm, yeni taslak hazırlanırken korunur. Kapsamın kimliği sonradan değiştirilemez; kullanılan okul/bölge gizlenemez. Yayın, sınıfları veya eski kanıtları yeniden etiketlemez.

## Veli kararı

- Okulu listeden seçer; yoksa bölge seçip okul adını yazar. Okul seçimi isim benzerliğiyle otomatik tahmin edilmez. GPS kullanılmaz.
- Sınıfı biliniyorsa kademe ona göre belirlenir; bilinmiyorsa seçilir.
- Yıl dışı, dönem/ara tatil dışı ve yıl başlangıcından 14 günden sonraki **yeni yıl geçişi** açıklanır. 14 gün resmî kural değil, gözden geçirme eşiğidir; geçişi yasaklamaz.
- Gerekçe: okul takvimi farklı / kişisel durum / kayıt düzeltmesi / doğrulanmış takvim henüz yok.
- Okul farklılığı için açıklama gerekir. İnceleme kuyruğu çocuğun/aile hesabının kimliğini göstermez. Kişisel gerekçeler okul doğrulama kuyruğuna düşmez.
- Ekip kaynağı doğrular veya gerekçeyle kapatır. Doğrulama tek başına yayın değildir. Ayrı okul takvimi yayımlanınca sonraki kontrollerde önerilir; gerekirse ayrıca hedefli duyuru hazırlanır. Aile kayıtları topluca değiştirilmez.
- Takvim dışı seçim mümkündür; çakışan tarihli geçmiş, gelecekteki bir kaydı bugün etkinleştirme, aynı okulun başka adla eşleştirilmesi gibi veri bütünlüğü hataları hâlâ engellenir. Geleceğe planlı eğitim geçişi ayrı geliştirmedir.

## Duyuru iş akışı

Yayın operasyonu yetkisi: Taslak → kapsam/kademe → alıcı sayısı ve içerik önizlemesi → açık gönderim onayı. Uygulama içi bildirim temel kanaldır; push ek tercihtir. Her veli için tek kopya; kardeşler çoğaltmaz. Önizlemeden sonra kitle değişirse yeniden onay gerekir. İlk sürümde tek gönderim en çok 5.000 veliye yöneliktir; daha büyük yayın için bölümlenmiş kuyruk gerekir.

Yeni gelen kutusu: okunmamış, açıp okuma, arşiv, arşivden çıkarma ve eski kayıt sayfalaması. Yetki her okumada aile üyeliğiyle kontrol edilir. Duyuru süresi son gün dahildir. Yayımlanmış metin sessizce değiştirilemez; hatalı duyuru geri çekilir, gerekiyorsa düzeltme ayrıca hazırlanır. Daha önce sağlayıcıya verilmiş push geri çağrılamaz. Yönetimde taslak kaldırma geri çekme olarak kaydedilir.

Push: veli başına hedef, canlı aile üyeliği, tercih, cihaz oturumu ve duyuru geçerliliği yeniden kontrol edilir. Kilit ekranında okul adı, çocuk adı veya duyuru ayrıntıları yerine genel metin gösterilir. Gönderim kabulü okunma değildir. Mevcut teslim/yeniden deneme/tekilleştirme altyapısı kullanılır. Gerçek velilere geliştirme testi gönderilmez.

SMS/e-posta **hazır değil**: sağlayıcı, gönderici alan adı/numara, doğrulanmış iletişim adresi, kanal tercihi, amaç ayrımı ve vazgeçme akışı gerektirir. Telefon/e-posta bulunması tek başına izin sayılmaz. Hizmet ile pazarlama iletisi ayrı tasarlanmalı; [Ticaret Bakanlığı genel bilgileri](https://www.ticaret.gov.tr/ic-ticaret/ticari-elektronik-iletiler/genel-bilgiler) ve [İYS açıklaması](https://ticaret.gov.tr/ic-ticaret/ticari-elektronik-iletiler/ileti-yonetim-sistemi-iys) yayın kontrolünde değerlendirilir. Mevcut ekran bu kanalları açık/gönderildi göstermez.

## Sakin hatırlatmalar

- Yönetimde varsayılan kapalı. Doğrulanmış takvimler ve zamanlayıcı hazır olunca yayın yetkilisi açar.
- Aile saat diliminde yıl başlama gününden sonraki 7 günlük aralıkta, eski/yok eğitim kaydı için kontrol önerir.
- Yıl sonunda mevcut kaydı değiştirmeye zorlamadan geçmişi gözden geçirmeyi önerir. Yıl sonu sınıf atlatma anı değildir.
- Çocuk/yıl/başlangıç veya bitiş kimliğiyle tekilleştirilir; takvimin yeniden yayımlanması yeni mesaj doğurmaz.
- Arşivlenmiş çocuklara yeni hatırlatma oluşturulmaz. Veli push tercihinden kapatabilir; genel yönetim kapatma bekleyen push'u durdurur.
- Şimdiki hatırlatma yalnız yıl sınırları içindir; her yarıyılda sınıf güncellemesi istemez. Resmî tek günlük okul tatilleri ilk aşamada doğrulanmış hedefli duyuruyla iletilir; ileride ayrı istisna günü veri modeli eklenebilir.

## Gelecek: ebeveyn toplulukları (TODO, uygulanmadı)

Amaç “daha çok akış tüketimi” değil, benzer günlük sorunlarda güvenilir destek bulmak. İlk öneri: herkesin herkesi izlediği sınırsız akış yerine **konu odaları + aranabilir deneyim paylaşımları + yararlı bulunan çözümler**. Örnek odalar okul değişikliği, ders rutini, ortak tablet, okula başlama. Kısa gönderi/yanıt akışı olabilir; sınırsız kaydırma ve etkileşim baskısı ilk sürüme alınmamalı.

1. Yalnız yetişkin veli ve açık katılım; çocuğun adı, okulu, başarı puanı, tanısı veya aile içi verilerden otomatik grup üyeliği çıkarma yok. Kullanıcı kendi konusunu seçer. Okul topluluğu, isteğe bağlı ve ayrı görünürlükle ileride değerlendirilir.
2. Takma ad/profil görünürlüğü, içerik silme, ayrılma, engelleme, şikâyet, moderasyon kuyruğu ve itiraz ilk günden birlikte tasarlanır. Doğrudan özel mesaj ilk pilotta kapalı önerilir.
3. “Benzer sorun” eşleşmesi tanı koyma veya çocukları karşılaştırma değildir. Yardımcı kaynak ile kişisel deneyim ayrılır; sağlık/şiddet/istismar içerikleri için eğitimli moderasyon ve uygun yönlendirme gerekir.
4. Çocuk fotoğrafı, konum, okul üniforması ve isim içeren paylaşımlar için gizlilik uyarısı/inceleme. Aile destek görüşmeleri izinsiz topluluk gönderisine dönüşmez.
5. Küçük davetli pilot: faydalı yanıt oranı, çözülen ihtiyaç, şikâyet çözüm süresi ve güven hissi izlenir; ekranda geçirilen süre başarı hedefi olmaz.
6. Ayrı tasarım ve yayın kararı: içerik kuralları, moderasyon kapasitesi, yaş doğrulaması, saklama/silme politikası ve çocuk güvenliği incelemesi tamamlanmadan açılmaz.

## Açık yayın kapıları

Gerçek kaynaklardan başlangıç takvimlerinin içerik kontrolü; üretim migration/iş zamanlayıcısı; gerçek iOS/Android push izin/teslim kontrolü; fiziksel cihaz ve erişilebilirlik; e-posta/SMS sağlayıcı ve tercih akışları. Yeni kodun yerel kontrolden geçmesi bunların tamamlandığı anlamına gelmez.
