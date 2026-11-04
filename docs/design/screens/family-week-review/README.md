# Birlikte bakalım — haftalık aile konuşması

4 Kasım 2026. Mevcut veli ana ekranının mint özet alanı genişletildi; ayrı ekran veya ana menü yok. Onaylı ana ekranın oda/mascot, başlık, görev, hedef ve takvim yerleşimi korunur. Ortak tipografi ve kontroller kullanılır.

## Akış

Bölüm başlangıçta kapalıdır. Açınca görünen haftanın bugüne kadarki kayıtlı görevleri onaylandı / onay bekliyor / yeniden ele alınacak olarak ayrılır. Önceki tamamlandı sayısı, bekleyenleri de içeriyordu. En çok gün yapan çocuğu seçen örtük karşılaştırma kaldırıldı. Çocuğun seçimi mevcut ana ekran filtresini izler; tek çocukta ek seçici yoktur. Kayıt yokluğu başarısızlık ya da kaçırılmış görev sayılmaz.

Üç kısa konuşma sorusu sırayla gösterilir: keyifli an → birlikte kolaylaştırma → tek küçük adım. Yanıtlar alınmaz, kaydedilmez ve AI’ya gönderilmez. İsteyen bir soruyu geçebilir veya bölümü kapatabilir. Son eylem mevcut takvimi açar; otomatik görev/puan/etkinlik oluşturmaz. Gelişim raporu Prova ana ekranındaki mevcut erişiminden açılmaya devam eder.

Bu, aileyle yüz yüze konuşmayı kolaylaştıran kullanım akışıdır; psikolojik değerlendirme, kişilik çıkarımı, başarı sıralaması veya haftalık AI özetinin yeni istemcisi değildir. Geçmiş haftaların konuşma arşivi ve zorunlu rapor formu eklenmez.

## Gerçek bileşen kabulü

- [Telefon](phone.png), 390×844: durum sayıları düğme görünümü taşımaz; tek ana eylem ve geri oku vardır.
- [Tablet](tablet.png), 1280×800: mevcut ana ekran içinde yatay durum satırı ve son adım.
- [Kayıtsız hafta](empty-phone.png): sıfır başarısızlık yüzdesi veya çocuğu etiketleyen metin yok.
- `qa-fixture.cjs`: bütün Supabase istekleri sentetik hostta; gerçek aile verisi/AI çağrısı yok.
- Ailede 2 onaylı / 1 bekleyen / 1 yeniden ele alınacak kayıt; Ece filtresinde 1 / 1 / 1. Sayımlar ayrılıyor ve başka çocuk kaydı filtreye sızmıyor.
- İleri → ileri → geri, çocuk seçilince başlangıç adımına dönüş, tek çocukta seçici gizleme, boş kayıt, takvime geçiş kontrol edildi. Konuşma boyunca yazma/AI isteği gönderilmedi.
- 48 dp dokunma alanları ve telefon/tablet yatay taşma kontrolü geçti. Fiziksel cihaz/büyük sistem yazısı/sesli okuyucu kabulü henüz yapılmadı.

Beş yeni anlamlı sayım testi ile core toplam 179; mobil/core tip ve mobil lint kontrolleri geçti. Yeni paket yok. Üretim/TestFlight 17 değişmedi.
