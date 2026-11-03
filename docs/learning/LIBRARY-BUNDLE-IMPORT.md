# Taslak kütüphane paketini kayıpsız aktarma

3 Kasım 2026. Bu artım **özel taslak kabulünün sunucu sözleşmesidir**. Yeni bir yönetim ekranı, aileye açık kütüphane yayını veya Prova'ya soru seçme entegrasyonu değildir. Üretime dağıtılmadı.

## Hazırlama ve tekrar gönderme

Depo kökünde:

```sh
python3 scripts/prepare-library-import.py --output /tmp/gina-library-request.json
python3 scripts/test-library-import-preparer.py
```

Hazırlayıcı mevcut 5. sınıf Matematik pilotunu doğrular; 20 soruyu, 8 PNG'yi, ortak kaynakları, cevapları, kısmi puan ölçütlerini ve köken bilgisini bir JSON isteğinde toplar. Ağ veya veritabanı bağlantısı kurmaz. Dosya `0600` izinli oluşturulur; var olan dosya ezilmez. Bu dosya cevap anahtarı içerir, öğrenciye sunulmaz ve genel dosya deposuna yüklenmez.

Dosyanın kökünde `p_request_id` ve `p_bundle` vardır. İleride yönetim istemcisi bunları, oturum açmış yetkili yöneticinin kimliğiyle `admin_import_library_bundle` RPC'sine gönderecek. Ağ sonucu belirsizse **aynı dosya, istek kimliği ve içerik** tekrar kullanılmalı. Yeni istek üretmek başarıyı doğrulama yöntemi değildir. İlk yanıtta dönen `id` ve `content_hash` saklanır. Dosya hazırlamak aktarım yapıldığı anlamına gelmez.

Mevcut hazırlayıcı yalnız ilk sürümü üretir. Güncelleme aracı/UI henüz yoktur; sunucu yeni sürümler için aşağıdaki kuralları uygular.

## Kayıt ve sürüm sözleşmesi

- `gina.library-import.v1`: paket anahtarı, sürüm, önceki içerik özeti, başlık, sınıf/ders, köken, görseller, ortak kaynaklar ve sorular. Bir paket tek sınıf/ders kapsamındadır; karma Prova daha sonra birden fazla paketten soru seçebilir.
- Ortak kaynak metin, PNG veya ikisini içerebilir. Metin kaynağına sahte görsel eklemek gerekmez. Birden çok soru aynı kaynak kimliğini kullanır. Bağımsız sorunun `source_key` alanı `null` olabilir.
- Öğrenci alanları sınıf, ders, konu, tür, tahmini zorluk, soru ve seçeneklerle sınırlıdır. Öğretmen cevabı, çözüm, açıklama, yanlış anlama, sonraki adım ve rubrik ayrı tabloda saklanır. Müfredat/köken ayrıntıları özel meta veridir. Metne anlamsal olarak yazılmış bir cevap otomatik tespit edilmiş sayılmaz; editör incelemesi gerekir.
- Paket bütünü tek işlemde kaydolur. Eksik kaynak, bozuk ilişki veya geçersiz puan toplamında hiçbir parçası kalmaz. Görseller SHA-256 ile tekilleşir; dosya boyutu ve gerçek başlık ölçüleri karşılaştırılır.
- Aynı istek aynı yönetici/içerikle aynı sonucu döndürür. Farklı içerik veya yönetici aynı istek kimliğini kullanamaz. Başka istekle gönderilen aynı paket/sürüm/içerik yeni kopya oluşturmaz.
- Paket sürümü değiştirilemez. Sonraki sürüm, önceki sunucu `content_hash` değeri ve ardışık sürüm numarası ister. Değişen soru, cevap, özel meta veri veya bağlı kaynak yeni soru sürümü gerektirir. Ortak kaynak değişirse bağlı bütün sorular ilerler; yalnız soru sırası değişirse soru sürümünü artırmak gerekmez. Eski paket bağımsız okunur.
- Her yeni paket sürümü için bir denetim olayı; tekrarlar için yeni yayın veya kota harcaması yoktur. Yönetici hesabının silinmesi bu kayıtlar tarafından engellenmez. Özel köken kimlikleri ve saklama politikası ayrıca operasyonel olarak değerlendirilmelidir.

## Okuma ve yetki

`admin_list_library_imports(p_limit)` en fazla 100 özet döndürür. Eski kayıtlar için imleçli sayfalama henüz yoktur. `admin_get_library_import(p_id, p_include_answers=false)` tam olarak istenen sürümü açar; en son sürüme sessiz geçiş yapmaz. Açık `true` seçimi öğretmen alanlarını, soru meta verisini ve köken kayıtlarını ekler. Ortak kaynağın PNG verisi ve okunabilirlik ölçüsü korunur.

**Her iki görünüm de yöneticiye özeldir.** `false` seçeneği çocukların çağırabileceği bir endpoint değildir. Genel/veli/çocuk kimliği, servis anahtarı ve geri alınmış yönetici yetkisi reddedilir. API rollerinin özel tablolara doğrudan okuma/yazma izni yoktur. Her çağrı canlı yönetici üyeliğini tekrar denetler; yalnız istemcinin gösterdiği rol yeterli değildir.

## Boyut ve görsel sınırları

- 1–100 soru; en fazla 100 kaynak ve 100 görsel; JSONB metni en fazla 6 MB.
- Görsel başına 512 KiB, paket başına 3 MB PNG; en fazla 4096×4096 boyut ve görsel başına 4 milyon, toplam 24 milyon piksel.
- Yalnız statik 8-bit RGB/RGBA PNG. Başlık, parça sınırları, izin verilen parça türleri, terminal IEND, özet ve bildirilen boyut kontrol edilir. SVG, animasyon ve metin parçaları kabul edilmez. SVG yazım kaynağı depoda kalır.
- Bu kontrol **piksel açma, PNG CRC veya renk profili doğrulaması değildir**. Editoryal önizlemede görüntünün açılması, okunabilirliği, sRGB kaynak iddiası ve temizliği ayrıca doğrulanmalıdır. Yayın öncesi yeniden kodlama/depolama hattı açık iştir.
- Küçük ve sınırlı taslak PNG'leri özel veritabanında saklanır. Genel medya deposu, temizlik/saklama süresi ve aileye yetkili görsel sunumu bu artımda yoktur.

## Doğrulama

- `supabase/tests/040_library_import.test.sql`: 67 işlem içi kontrol; rol ve cevap ayrımı, görsel sınırları, atomiklik, tekrar, sürüm çatışması, ortak kaynak güncellemesi, metin kaynağı, çoktan seçmeli soru ve hesap silme. Her test işlemi geri alınır.
- `scripts/test-library-import-preparer.py`: üç test; eksiksiz alan aktarımı, sabit içerik ve kalıcı/özel istek dosyası. CI'ye eklendi.
- Gerçek 20 soruluk pilot ayrı `gina_prova_builder_audit` veritabanında aktarılıp okundu. Tüm öğrenci/öğretmen/meta veri alanları ve sekiz PNG baytları kaynakla karşılaştırıldı; işlem geri alındı. Normal/demo veritabanı ve üretim değişmedi.
- `python3 scripts/test-library-import-races.py --template gina_prova_builder_audit`: açıkça verilen izole audit veritabanından tek kullanımlık klon. İki gerçek bağlantıyla aynı/farklı istek ve çelişen içerik yarışları; tek paket ve tek denetim olayı doğrulanır. Yalnız kendi klonunu siler, şablonu sıfırlamaz veya oturumlarını sonlandırmaz.

## Sıradaki iş

Mevcut yönetim kütüphanesinde paket seçme → öğrenci/öğretmen önizlemesi → inceleme akışı tasarlanmalı. Kayıt ve yayın açıkça ayrı kalmalı. Alan editörü kabulü, paket erişimleri, Prova'ya ortak kaynaklı soru seçimi, gerçek telefon/tablet/AI testi ve yayın entegrasyonu tamamlanmadan bu taslaklar ailelere açılmamalı. İlk pilot hâlâ 20 taslak; kalan 1.520 soru bu aktarım işiyle üretilmiş olmadı.


## 3 Kasım eklemesi — ayrı yayın kararı ve teslim görselleri

`20261103040000_library_publication.sql` ve `library-media` ile taslak değişmeden sürümlü yayın kararı ve yeniden kodlanmış teslim PNG'leri eklendi. İlk aktarımın yalnız yapısal PNG kabulü yukarıdaki gibi kalır; yayın öncesinde CRC/piksel/boyut/sRGB doğrulaması ayrıca zorunludur. Yeni katalog kapısı `library_packages.enabled=false`; aileye cevap veya ham kaynak sunmaz. Aylık hak tüketimi/edinim/Prova seçimi sonraki aşamadır. Sözleşme, renk profili sınırı ve test kaydı: [yayın kabulü](../design/screens/library-publication/README.md).

## 3 Kasım eklemesi — ikinci içerik profili

Hazırlayıcı, `--folder docs/learning/library-pilot/grade-5-science` ile kayıtlı Fen taslak profilini de doğrular; kaynak bilgi bağlantıları ve iki görselsiz metin kaynağı kaybolmadan taşınır. Bilinmeyen profil otomatik onaylanmaz. Mevcut Matematik profili ve özel geometri kontrolleri korunur. `test-library-draft-roundtrip.py` açıkça verilen izole audit şablonundan geçici kopyada tam paketi aktarır/okur, alanları ve PNG baytlarını karşılaştırır; inceleme veya yayın yapmaz. Dosya hazırlamak gerçek editör onayı değildir. Aile edinimi kodu PR #79 ile eklendi; bu dokümandaki eski “sonraki aşama” ifadeleri tarihîdir, üretim açılışını ifade etmez.
