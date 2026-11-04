# Birlikte Prova — ölçütlü inceleme ve özel itiraz

4 Kasım 2026. Onaylı ortak mint/mor/krem tasarım dili uyarlandı. Bu ekran için ayrı birebir onaylı maket bulunduğu iddia edilmiyor. Gerçek uygulama bileşenleri sentetik API ve taslak pilot soruyla kontrol edildi; gerçek öğrenci cevabı veya editör onayı kullanılmadı.

## Davranış

- Kütüphane paketiyle oluşturulan ortak Provada açık uçlu ve şıklı sorular birlikte seçilebilir. Ortak kaynak blokları bütün taşınır. Eski otomatik şıklı Provalar korunur.
- Katılımdan önce şıklı soru başına 1 puan, açık uçlu sorunun sabit ölçüt toplamı açıklanır. Merkezi cevap incelemesi için ayrı, başlangıçta kapalı veli onayı gerekir. Takma adlı sıralama ayrıca isteğe bağlıdır.
- Başlamış sorular ve ölçütleri dondurulur. Veli kişisel puanı ve AI önerisi ortak sıralamayı değiştirmez. Yönetici yalnız canlı admin yetkisiyle, katılım süresi ve deneme tamamlandıktan sonra özgün metin/çizim ve izinli kütüphane görsellerini okur; aile/çocuk adı taşınmaz.
- Açık uçlu puanlar her ölçüt için tam sayı ve sınır denetiminden geçer. Okunamayan cevap sıfır sayılmaz; yayın bekletilir. Boş cevap ile eksik öğrenme birbirine eşitlenmez.
- Yazı/görsel/çizim birlikte görünür; defter büyütülür, özgün sayfa geometrisi korunur. Görseller tek kez yüklenir; kaynak kimliğiyle sorulara bağlanır. Kayıtlı SVG/HTML çalıştırılmaz.
- Her inceleme revizyonu, gerekçe ve özel itiraz geçmişte korunur. Aynı anda çalışan incelemeciler eski sürümle birbirini ezemez. Değişiklik yapılan formdan başka soruya geçmek için kaydetmek veya açıkça bırakmak gerekir.
- İnceleme kaydı yayın değildir. Tüm cevaplar/itirazlar tamamlanınca ayrı kontrol ve yayın onayı gerekir. İtiraz veya puan düzeltmesi kesin sıralamayı yeniden incelemeye alır. Eşit toplam puan eşit sıradır; hız üstünlük sağlamaz.
- Veli yalnız kendi çocuğunun ölçütlerini/gerekçesini okur ve özel yeniden inceleme isteği verir. İnceleme, itiraz ve yayın istekleri kayıp yanıt/yeniden açılışta özgün kimlikle kurtarılır; ikinci işlem oluşturulmaz.

## Görsel kontrol

- [Yönetici masaüstü](review-desktop.png): soru, kaynak, özgün çözüm, sabit ölçütler.
- [Yönetici tablet ve itiraz çözümü](resolved-tablet.png).
- [Büyütülmüş defter](notebook-expanded.png): 1280×800; sayfa devamı içeride kaydırılır, ölçek ve çizim kırpılmaz.
- [Veli telefon](result-phone.png): 390×844.
- [Veli tablet](result-tablet.png): 1280×800.
- [Katılım ve ayrı inceleme onayı](consent-phone.png).
- [Kayıp itiraz yanıtından kurtarma](appeal-phone.png).

`qa-fixture.cjs` yalnız `ginaqa.supabase.co` adresini taklit eder. Oda/takvim/gerçek aile verisini değiştirmez. İlk inceleme ve ilk itiraz sunucu sonucunu kaydettikten sonra yanıtı düşürür; yeniden açılışta aynı istek geri alınır. Örnek 2/4 açık uçlu puanı, itirazla 3/4 yapılır; iki şıklı soruyla toplam 5/6 ayrı yayın sonrası görünür. Katılımda inceleme onayı olmadan düğme kapalı, onayla açık; sıralama false gönderildi. Gerçek API yetkileri ayrıca SQL testleriyle sınandı.

## Doğrulama

- 59 SQL dosyasında 1.609 kontrol; bu artımda 58 kontrol.
- Dört gerçek eşzamanlı veritabanı senaryosu: aynı inceleme, eski incelemeci, aynı itiraz, yayın–itiraz yarışı. `python3 scripts/test-cohort-review-races.py --template gina_completion_audit` yalnız geçici klonlar kullanır.
- Core 157 test; mobil/backoffice tip kontrolü ve lint; backoffice 18 sayfalık statik derleme.
- Admin yetkisi kaldırma, başka aileden erişim, canlı cevap gizleme, okunamayan/eksik ölçüt, eski cevap izi, iptal edilmiş grup, kayıt tekrarları ve aile silmeyle özel geçmiş temizliği kontrol edildi.

## Açık sınırlar

081000 migration, istemciler ve bu özellik üretime dağıtılmadı; TestFlight 17 değişmedi. Gerçek soru paketleri editör onayı almadan bu test onaylarıyla yayımlanmaz. Fiziksel iPhone/iPad/Android, ekran okuyucu, gerçek push teslimi ve merkez inceleme operasyon kapasitesi kabulü açık. Bu artım sonuç yayınına yeni push bildirimi bağlamaz; ayrı takip işidir. Ailelerin kişisel değerlendirmesi merkezi puanlama yerine geçmez.
