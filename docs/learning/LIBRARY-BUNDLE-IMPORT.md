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

## 6 Kasım eklemesi — tek içerik yaşam döngüsü, hak güvenliği ve düzeltme zinciri (sunucu)

`20261106110000_library_credit_safety.sql` veri taşımadan mevcut tabloların üzerine okunur bir yaşam döngüsü koyar; UI bağlanmadı, hiçbir kapı açılmadı. Rapor: [library-lifecycle-2026-11-06](../release/library-lifecycle-2026-11-06/README.md).

- **Görünüm** `gina.library_content_items` (yalnız `admin_library_content_items(p_kind,p_status,p_limit)` ile): tür `package | contribution_set | legacy_item | collection | legacy_contribution`; durum `draft | reviewed | approved | published | withdrawn`; sürüm, yayın sürümü, önceki sürüm, kaynak aile, E01 ön inceleme durumu, yönetici kararı ve `live` (aileye gerçekten sunuluyor mu). **Onay ≠ yayın:** bütün sorular `suitable` olan paket `approved`'dur, `library_publications` kaydı olmadan `live=false` kalır ve `get_published_library_packages` onu döndürmez. Yeni paket sürümü (`revision+1`) kendi `draft` satırıyla gelir; yayımlı sürüm değişmez.
- **Değişmezlik tetikleyicileri:** `library_publications` yalnız `version+1` ile güncellenir, silinemez; yayımlanmış veya edinilmiş eski `library_items` içeriği değişmez (durum geçişi serbest); aileler kayıt olduktan sonra `group_exam_questions` dondurulur; `library_acquisitions` bloğu bir kez dolar ve aile var olduğu sürece silinmez; `library_acquisition_charges` yalnız eklenir ve her soru kopyası tek edinime aittir (benzersiz indeks). Kabul edilmiş `contribution_sets` kararı/anlık görüntüsü değişmez; `chain_id/supersedes_id` yeniden yazılamaz.
- **Hak:** `family_library_credits(p_family_id)` → aylık limit/kullanım/kalan/yenilenme, aktif bonus hakları (kazanılan/harcanan/kalan), toplam kalan, kabul edilmiş katkı sayısı ve sonraki kilometre taşları. Veli yalnız kendi ailesini, yönetici/servis herhangi bir aileyi okur. `library_policy_preview(p_accepted_count,p_rules)` çakışan kuralların toplam etkisini, ortak kat (yığılma) noktalarını ve sıradaki kilometre taşını hesaplar; `p_rules` boşsa açık `contribution_rewards` kullanılır. Arşiv/not kotası bu alan dışındadır.
- **Grup bütünlüğü:** edinim, katkı ve kohort kaydı zaten birim bazlı (bütün ortak kaynak) çalışır; `admin_library_group_integrity()` kopuk kopyaları (eksik üye, eksik görsel, sonlandırılmamış grup, kısmi katkı paketi) raporlar. Kısmi katkı kabulü iş kuralında yok; sunucu bütün sorular için öğretmen alanı ister.
- **Ret → düzeltme → yeniden inceleme:** `contribution_sets.supersedes_id/chain_id`. `begin_question_contribution(p_id,p_question_id,p_rights,p_no_personal_data,p_supersedes default null)` reddedilen kopyayı aynı soru/aynı ortak kaynak serisi için otomatik, istenirse açıkça bağlar; değişmeyen içerik `contribution_unchanged`, kabul edilmiş kopya `contribution_supersede_invalid`, ikinci düzeltme `contribution_supersede_taken`. `contribution_review_trail(p_id)` (veli: kendi ailesi, yönetici: aile kimliğiyle) zinciri, ret notunu, yeniden inceleme kararını, ön inceleme durumunu ve paket durumunu verir; `admin_library_package_trail(p_package_id)` paket sürümlerini ve soru başına son editoryal kararı listeler.
- **Birlikte Prova:** `group_exam_phases(p_group)` katılım penceresi / çocuğun süresi / inceleme bekleme / isteğe bağlı sıralama alanlarını ayırır. `gina.cohort_ranking_rows` yalnız rıza vermiş, bitmiş, tamamen puanlanmış (okunamayan/bekleyen yok) ve incelemeli kohortlarda yayımlanmış kayıtları sıralamaya alır; `get_group_result` artık `ranked`, `ranking_reason` (`no_consent | unfinished | unreadable | unscored | results_not_published`) ve `ranking_optional` döndürür. Devam eden deneme kesin tabloya girmez (`interim`).
