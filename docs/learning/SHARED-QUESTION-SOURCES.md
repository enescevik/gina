# Ortak içerikli sorular — uygulama ve dağıtım

2 Kasım 2026. Telefon/tablet maketi kullanıcı tarafından onaylandı ve uygulandı. Bu artım henüz üretime veya TestFlight'a dağıtılmadı.

## Davranış

Veli, Prova içindeki ortak içerik girişinden metin ve en fazla üç özel görsel ekler, 2–12 soru hazırlar, çocuğun göreceği içeriği önizler ve kaydeder. Açık uçlu soruda beklenen cevap ve çözüm, çoktan seçmelide seçenekler/doğru seçenek ve çözüm ayrı alanlardır. Çocuk önizlemesinde cevaplar yoktur. Mevcut kaydı değiştirmeden önizleyen veli aynı sürümden Prova hazırlayabilir.

Değişiklik yeni grup/soru kimlikleriyle yeni sürüm oluşturur. Eski sürümden atanmış Prova aynı soruları gösterir ve aynı cevaplarla puanlanır. Başka bir veli aynı seriyi daha önce güncellediyse eski sürümün üzerine sessizce yazılmaz. Kayıt cevabı kaybolursa düzenleme kilitlenir; aynı istek makbuzuyla tekrar denenir. Kaydedilmemiş taslak bellektedir: normal çıkışta uyarılır, uygulama zorla kapatılırsa kalıcı saklama garantisi yoktur.

## Sözleşme

- `question_source_groups`: aile, seri, sürüm, önceki sürüm, başlık/metin, ders/sınıf, sonlandırma zamanı.
- `question_source_members`: grup, soru kimliği, sıra, özgün soru cümlesi. Sonlandırılmış içerik ve görsel bağları değiştirilemez.
- `save_question_source_group`: tek transaction; özel görsel bağları, soru üyeleri, doğrulama ve istek makbuzu.
- `assign_question_source_group`: sabit üye sırasıyla, mevcut kota ve yetki kontrollerini kullanarak tekrar güvenli atama.
- `get_question_context`: yalnız istenen ve erişilebilir soru kimlikleri için bağlam; cevap/çözüm/kardeş sorular/dosya yolları verilmez.
- Ortak metin ayrıca `question_bank.stem` içine yazılır. Eski okuyucu bağlamı kaybetmez; yeni ekranlar özgün soru cümlesini kullanarak tekrarı önler.
- `standalone_question_bank` normal mobil otomatik seçime grup üyelerini katmaz. `current_question_bank` güncel kütüphane görünümüdür. Geçmiş sınav/inceleme tam kimliklerle asıl tabloyu okur. Diğer tarihî otomatik seçim yollarının tümü bu artımda yeniden tasarlanmadı.
- Atama ile soru/görsel düzenlemesi aynı soru satırlarını sıralı kilitler. Atanmış sınav içeriği ilk cevap beklenmeden korunur. Aile hesabı silme zinciri çalışır.

## Dağıtım sırası

1. CI'da yeni iki migration'ın temiz veritabanına uygulanmasını ve 651 SQL kontrolünü doğrula. Normal yerel veya üretim aile verisini sıfırlama.
2. Üretime `20261102180000_assigned_question_integrity.sql`, ardından `20261102181000_shared_question_sources.sql` uygula. Yeni mobil sürümde PDF ve normal soru seçimi yeni RPC/görünümlere bağlıdır; veritabanı istemciden önce güncellenmelidir.
3. Ortak görseli bütün soru numaralarıyla tek kez gönderen `_shared/question-images.ts` kullanan `prova-grade` Edge işlevini dağıt. Mevcut özel kaynak/temizleme altyapısını doğrula; gizli anahtarı istemciye koyma.
4. Yeni istemciyi TestFlight'ta telefon/tablet, native klavye ve mevcut kaynak yükleme akışıyla dene. iOS JS/Hermes export bu kontrolün yerine geçmez.
5. `question_groups.enabled` varsayılan kapalıdır. Hazır olduğunda sunucuda etkinleştir; görselli içerik için `sources.enabled` ve özel kaynak hizmeti de hazır olmalıdır. Üretim anahtarları bu çalışmada değiştirilmedi.
6. Geri dönüşte grup anahtarı yeni kayıt/atamayı kapatır; önceden atanmış Prova okunmaya, başlamaya ve bitirilmeye devam eder. Kilitleri kaldıran veya saklanan sürümleri silen bir geri dönüş yapma.

## Kanıt ve sınırlar

`../design/screens/prova-shared-source/implementation-review.json` test ve ekran kaydıdır. Ekranlar çalışan Expo web bileşenlerinden alınmıştır. Gerçek PostgREST/SQL kullanılmış; oturum ve kaynak görsel sunumu izole sentetik proxy'dir. Üretim Auth/Storage veya fiziksel cihaz uçtan uca testi sayılmaz.

PDF metin/görsel gruplaması ve HTML kaçışları otomatik test edildi; fiziksel yazdırma denemesi yapılmadı. Görsel AI girişinin tekrarları test edildi; ücretli canlı AI çağrısı yapılmadı. Çizimli cevabın AI değerlendirmesi, veli not/çizim katmanı, tam grup katkısı moderasyonu ve yeni kütüphane soru üretimi bu artımın dışındadır. Grup/görsel katkısı bağlam kaybıyla yayımlanmak yerine sunucuda engellenir.
