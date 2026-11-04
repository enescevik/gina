# Prova — canlı AI ve kullanım kabulü

4 Kasım 2026; kod kaynağı `3afaa847aea3020aba8ed551f8fae3e910eb586e` (#135).
Bu tur ayrı, sentetik bir aileyle gerçek üretim hizmetlerine karşı yapıldı.
Mevcut aileler, çocuklar ve demo kayıtları değiştirilmedi. Ekran görüntüleri
390×844 ve 1280×800 tarayıcı boyutlarıdır; fiziksel cihaz görüntüsü değildir.

## Gerçek arayüzden tamamlanan akış

1. E-posta ile veli girişi; tek çocuklu ailede gereksiz Tümü seçimi yok.
2. Beşinci sınıf Matematik için üç soru gerçek AI ile üretildi. Konu seçimi ve
   serbest not ile hazırlanan sorular, cevap ve çözümüyle birlikte önizlendi.
3. İlk iki soru birlikte seçilerek aynı Prova'ya eklendi. Sayfa yenilendi;
   saklanan AI sonucu tekrar açıldı. Eklenmiş iki soru tekrar seçilemedi,
   üçüncü soru eklenebildi. Aileye sınırlı kullanım kaydı: tek generate işlemi,
   üç soru. Yeniden açma ve seçim ek hak tüketmedi.
4. Veli kontrol onayından sonra üç soru çocuğa atandı. Çocuk PIN'iyle girildi;
   üç açık uçlu cevap yazıldı, kayıt tamamlandı, Prova bitirildi. Veritabanında
   üç açık uçlu soru ve üç cevap korundu.
5. Ebeveyn PIN'iyle geri dönüldü. Veli incelemesinde soru ve özgün çocuk cevabı
   görünüyordu. AI paylaşım onayından sonra bir soru için gerçek inceleme alındı.
   Puan ve geri bildirim kendiliğinden kaydedilmedi. Öneri taslağa alındı,
   veli açıkça kaydetti. Kalan değerlendirme hakkı 30'dan 29'a indi.
6. Diğer iki soruya elle puan ve ayrı geri bildirim kaydedildi. Özet
   100/100, 3/3 puanlandı olarak güncellendi.
7. Çocuk tamamlanan Prova'yı tekrar açtı. Üç geri bildirim görünüyordu;
   incelenmiş deneme için bekleme mesajı veya 0/0 doğru bilgisi çıkmadı.

## Bu turda düzeltilenler

- Yazılıya hazırlık AI'sı sunucuda açık uçlu üretiyordu; arayüzdeki şıklı/karma
  seçimleri yanlış beklenti yaratıyordu. Artık sözleşmeyle aynı tür ve açıklama
  gösterilir. Eski taslaklar da doğru değerlendirilir. Konu pekiştirme ve deneme
  için üç tür korunur. Elle/kütüphaneden eklenen mevcut sorular değiştirilmez.
- `finish_exam_attempt` yanıtı AFTER tetikleyicisinin toplamlarından önceki satırı
  döndürebiliyor. Eksik toplamlar mevcut soru anlık görüntüsünden tamamlanır;
  gerçek puan veya değerlendirme uydurulmaz. Açık uçlu cevap inceleme bekliyorsa
  bitiş ekranında açıklanır. Şıklı soru olmayan Prova'da çocuk/veli ekranları
  yanıltıcı 0/0 göstermez.
- İlk AI üretimi yanlışlıkla “geri yüklendi” diyordu. İlk sonuç ve yeniden açılış
  için aynı doğru açıklama kullanılır.

## Doğrulama ve yayın ayrımı

- Core 243/243; mobil TypeScript ve Expo lint geçti.
- #135'in aynı baş commit'inde dört CI kontrolü SUCCESS olmadan birleştirilmedi.
- Son üretim web paketi gerçek CSP başlıklarıyla yerelde açıldı. Yazılıda tek
  açık uçlu seçeneği; konu pekiştirmede açık/şıklı/karma seçenekleri doğrulandı.
- Cloudflare `https://2e866601.gina-web.pages.dev` üzerinden ana adrese dağıtıldı.
  Beş rota 200, CSP/nosniff mevcut; 12 ilgili JS dosyasının SHA256 özeti test
  edilen dosyalarla eşleşti. [Doğrulama](web-verification.json).
- Çocuk geri bildirimi ekranı son canlı yayından; veli incelemesi aynı kaynaklı
  son yerel üretim paketindendir. Konsol: 0 hata; RN web uyarıları ayrıca mevcut.

| Görünüm | Telefon | Tablet |
|---|---|---|
| Veli soru/cevap inceleme | [Telefon](parent-review-phone.png) | [Tablet](parent-review-tablet.png) |
| Çocuğa veli geri bildirimi | [Telefon](child-feedback-phone.png) | [Tablet](child-feedback-tablet.png) |

## Temizleme

Normal hesap silme işlemiyle sentetik Auth hesabı, aile ve ilgili kaynak satırları
silindi; yoklukları doğrulandı. Bu tur yeni kaynak dosyası yüklemedi. Geçici giriş
bilgileri dosyası da kaldırıldı. Gerçek aile veya demo kaydı değiştirilmedi.

## Açık sınırlar

Bu kabul fiziksel Pencil, iOS yön değişimi, Android cihazı, sosyal giriş, e-posta
ulaşması, gerçek ödeme veya bildirim teslimi yerine geçmez. Sınıfa/okula göre
resmî ders önerileri ayrı iyileştirmedir; bugünkü öneriler aile kütüphanesinden gelir.
AI soru üretimi ve bir inceleme doğrulandı; bu üç sorunun resmî müfredata bağımsız
editör onayını aldığı veya kütüphanenin tamamlandığı iddia edilmez.

TestFlight 19, bu ek düzeltmelerden önce hazırlanmış olduğundan gönderilmedi.
20 Apple'da VALID / IN_BETA_TESTING olarak doğrulandı. Ayrı iPad dağıtımı ve
[TestFlight yayın kaydı](../CLIENT-20-2026-11-04.md) ayrıca izlenir.
