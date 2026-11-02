# GINA öğrenme platformu — geliştirme durumu

2 Kasım 2026. Kullanıcı tüm kapsamın geliştirilmesini onayladı. Bu liste tamamlanma beyanı değil, devam eden işin kaydıdır. Üretim verisi değişmedi; yeni TestFlight yayımlanmadı.

## Bu dalda yapılan, doğrulaması süren

- Veli görev onayından sonra çocuk önbelleğinin de geçersizlenmesi; Realtime rota odağı/yeniden bağlantı uzlaştırması.
- Prova yanıtlarında sıralı, son düzenlemeyi koruyan yazma; soru geçişinde ağ yanıtını beklememe.
- Görev onayında istek makbuzu ve özgün gönderim zamanı kontrolü.
- AI model etkinliği/ayar okuma hatası/çıktı sınırı ve sağlayıcı tokenizer ile giriş sınırı.
- AI değerlendirme/plan için kalıcı iş, kota, eşzamanlılık, oran sınırlama, belirsiz sonuçta otomatik tekrar engeli, geç yanıtları reddeden işlem kimliği.
- Kanıt sorularıyla ayrıntılı Prova raporu; soru/konu referansı doğrulaması.
- Backoffice AI işlem merkezi; sağlayıcı sonucu kontrol edildikten sonra gerekçeli tekrar izni.
- Trivy + pnpm audit, yeni güvenlik CI; upstream geliştirme bağımlılığı uyarıları açık risk kaydında.
- Ayrı ücretli kütüphane tabanı, aileye kopyalama ve aylık kullanım; aileden rızalı soru katkısı, yönetici incelemesi, tekil ödül dönüm noktaları. Yönetici koleksiyon/yayın/inceleme/hak ekranları ve veli katalog/paylaşım akışı eklendi. AI soru, kütüphane ve geçici paket hakları bağlandı; varsayılan ödül kuralı kapalı.

## Tamamlanacak ana iş paketleri

1. Bu değişikliklerin DB/RLS/yarış/idempotency testleri; gerçek telefon/tablet kanıtı ve performans ölçümü.
2. Fotoğraf/PDF kaynağı → veli onayı → taslak → atomik kayıt; ders programı ile başlayıp ödev, ödül/hedef ve sorulara yay.
3. Resim/çizim destekli soru yazarı; özel kaynak ve soru görseli erişim kuralları; PDF kitapçık ve çocuk çözme ekranı desteği.
4. Kütüphane/katkı akışının gerçek cihaz ve uçtan uca kontrolleri; görüntülü soru desteğiyle medya incelemesi. Varsayılan ödül politikası kapalı; operatör etkinleştirecek.
5. Müfredat sürümü ve öğrenme çıktısı; okul yazılısı/konu pratiği/bağlam temelli deneme ayrımı; resmî senaryo ile doğrulama. Her sorunun hikâye/görsel zorunluluğu yok.
6. Toplu denemeler: aynı sürüm/düzey, veli katılım ve sıralama tercihi, takma ad, eşit puan kuralları, sonradan puanlama ve kapsamı sınırlı veli bildirimi. Başka çocuğun kişisel sonuçları açılmaz.
7. Göreve bağlı odak, ödev/ders/kurs ortak planı, tekrar defteri, çanta listesi, gerekçeli veli plan asistanı.
8. Backoffice onaylı görsel dil; feature flags sunucu denetimi; satın alma/erişim/iade farklı durumlar; hesap/cihaz desteği; destek/fikir/SSS.
9. Çok sağlayıcılı doğrulanmış adapterler, model/iş bazında politikalar, anahtar referansları, maliyet/kota/limit; yeni sağlayıcı sırf metin eklenerek çalışıyor gibi gösterilmeyecek.
10. Güvenlik taraması, kapsamlı yetki/iş kuralı testleri, kod temizliği; incelenebilir PR ve en son TestFlight.

## Mevcut sınırlar

- AI provider şu an Anthropic; kaydı bulunmayan veya pasif model çalıştırılmaz. Yeni sağlayıcı adapteri henüz yok.
- Soru üretimi earned AI credits ile çalışır; 18 işlem testi, kütüphane/katkı için 30 yetki/tekrar testi geçti. Üretim sağlayıcısıyla yeni uçtan uca çağrı ve fiziksel cihaz testi henüz yapılmadı.
- Daha eski tasarım adayları/untracked varlıklar korunuyor. Yerel asıl veritabanı sıfırlanmıyor; migration testleri ayrı `gina_release13_audit` üzerinde.

## 2 Kasım doğrulama kaydı

- İzole veritabanında 25 SQL dosyasında 423 kontrol geçti; mevcut aile verisi değişmedi.
- Core: 25 test; mobil/backoffice tip kontrolü ve lint geçti. Backoffice statik üretim derlemesi geçti.
- Kütüphane yönetim ekranı gerçek uygulama kodundan, yalnız sentetik verili yerel önizlemede incelendi. Bu, üretim yetkilendirmesi veya iPhone performans ölçümü değildir.
- Soru üretiminde sağlayıcı sonucu kayıt öncesi saklanır; lease, kalıcı kota tahsisi ve belirsiz sonuç uzlaştırması eklendi.

## Görselli soru ve özel kaynak eklemesi

- Fotoğraf seçimi ve çizim → yerel önizleme → açıklama ve ayrı saklama onayı → doğrulanan özel kaynak → soru ile tek işlemde kayıt eklendi. Aynı istek makbuzu tekrarında ikinci soru oluşmaz.
- En fazla üç soru görseli; görüntüler yerelde 1600 px sınırında hazırlanır, fotoğraf metadata'sı işlem kopyasına taşınmaz. JPG/PNG 4 MB, PDF 10 MB ve en fazla beş sayfa. Sunucu tür/ölçü/sayfa/hash kontrolü yapar; bu bir antivirüs veya tam görüntü decoder taraması değildir.
- Çocuk soru ekranı, veli incelemesi ve PDF kitapçıkta görsel desteği eklendi. Veli incelemesindeki medya listesi tek istekte alınır. PDF, süreli bağlantıya bağlı kalmadan resim bytes'larını içerir.
- AI'a görsel gönderimi özel depolama onayından ayrı tutulur. Her kaynak/veli/değerlendirme için onay kaydı vardır. Okunamayan görsel puan=0'a çevrilmez; açık gerekçeyle puanlanmadan bırakılabilir.
- Silinen kaynakların nesne temizliği kalıcı kuyruk + saatlik görevle yapılır. İki saat geçerli yükleme bağlantıları için silme kaydı üç saat tutulup tekrar temizlenir. Bağlantısız taslaklar 24 saat sonra temizlenir.
- `sources.enabled` varsayılan kapalıdır. Yayında açmadan önce private bucket, iki Edge function, SOURCE_CLEANUP_SECRET + aynı Vault değeri, Vault project_url ve saatlik temizleme görevi doğrulanmalıdır. Bu değişiklikler henüz üretime uygulanmadı.
- Telefon 390×844 ve tablet 1280×800 web önizlemesi sentetik API ile incelendi. Çizim → PNG → soru önizlemesi ve geri alma denendi. İlk çizgideki web modal odak kaybı, tuvalin odak almasıyla giderildi. Bunlar fiziksel iPhone/iPad veya gerçek Storage uçtan uca testi değildir. Kanıtlar `previews/question-image-phone-fixture.png`, `previews/question-drawing-tablet-fixture.png`; tarayıcı dili İngilizce, Türkçe metinler i18n içinde.
- Görselli kütüphane katkısının bağımsız medya kopyası ve moderasyonu henüz tamamlanmadığı için sunucu bu katkıyı açık hata ile engeller; metni görselsiz kabul edip yayınlamaz. Fotoğraf/PDF'den program taslağı çıkarma akışı henüz yok; dosya seçici hazır olması bu özelliğin tamamlandığı anlamına gelmez.

## Deneme veri sınırı düzeltmesi

- Aileye ait deneme satırı tek başına yeterli yetki kontrolü değildi: question_ids dizisi başka ailenin soru kimliklerini taşıyabiliyordu. Deneme/çocuk/senaryo/soru bağları artık sunucuda doğrulanıyor. Tekrarlı soru kimliği engellenir.
- Eski hatalı satırlar için de çocuk soru okuma, görsel okuma, deneme başlatma ve AI soru çekiminde ayrı korumalar var.
- Başlamış denemenin soru listesi, çocuğu ve temel koşulları; kullanılmış sorunun metni/cevabı değiştirilemez. Atanmış soruyu silerek sonuçları bozmak engellenir; aile hesabının silinmesi korunur.
- Bu, veri sızıntısı yaşandığı iddiası değil; izole testlerle doğrulanan bir yetkilendirme eksikliğinin düzeltmesidir. Üretim incelemesi ve dağıtım henüz yapılmadı.
