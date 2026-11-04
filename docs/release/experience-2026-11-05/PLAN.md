# GINA kullanım ve çoklu kaynak çalışması — 5 Kasım 2026

Yetki: kullanıcı tüm aşamaları mevcut onaylı tasarıma uyarak otonom tamamlama ve sonunda yayınlama istedi. Yeni tasarım onayı gerekmiyor. Mevcut kullanıcı verileri silinmeyecek, testler izole veride yapılacak.

## Aşamalar
1. Ortak dosya/galeri/kamera seçimi; birikimli çoklu seçim, kaldırma, sıra, önizleme; varsayılan 5, yönetimden sınır. Özel kaynak depolama ve birlikte AI analizi, kaynak ilişkileri ve yeniden deneme güvenliği.
2. Yönetilebilir seçenek kataloğu: çanta, ödev/çalışma; serbest giriş ikincil. Prova süre seçimi, geniş AI not alanı ve kullanılabilir örnekler.
3. Mobil/web/yönetim rota envanteri; ekran türüne göre anlaşılabilirlik, bilgi hiyerarşisi, çocuk/veli ihtiyacı, klavye, dokunma, metin büyütme ve telefon/tablet yerleşimi. Çalıştırılmayan kontrol açık işaretlenecek.
4. İşlev/yetki/güvenlik: aile izolasyonu, admin sınırı, kaynak erişimi, kota/idempotency, izin reddi, bağlantı hatası ve eşzamanlılık. Test edilen kapsam güvenlik garantisi olarak sunulmayacak.
5. CI, üretim migration/Edge/web/yönetim dağıtımı, TestFlight; sürüm ve kanıtları içeren final raporu.

## Sabit kararlar
- GINA mint/mor/krem, mevcut Nunito/Baloo 2, onaylı logo/maskot ve bileşenler korunur.
- Seçim cihazda kalır; saklama ve AI gönderme onayından önce yükleme yapılmaz.
- Bir çoklu kaynak analizi tek işlem hakkı; Prova soru başına mevcut üretim kotası korunur. Gerçek token tüketimi izlenir; medya sayısı ve toplam bayt/sayfa ayrıca sınırlandırılır.
- Kaynak dosyalar ayrı kalır. Gruplama değişmez; değişen seçim yeni kaynak kimlikleri alır. Yeniden deneme mevcut iş/istek kimliğiyle yapılır.
- Kütüphane soru üretimi kullanıcının önceki kararıyla en sonda; bu çalışma onu öne almaz.

## Durum
İlk dört aşama tamamlandı; web, yönetim ve sunucu yayımlandı. iOS yerel imzalı derlemesi sürüyor. Fiziksel cihaz ve mağaza işletme gereksinimleri README içinde ayrı gösterilir.
