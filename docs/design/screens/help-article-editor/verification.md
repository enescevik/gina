# Yardım yazıları — uygulama kabul kaydı

3 Kasım 2026. Kullanıcı `desktop-tablet-proposal-v1.png` tasarımını uygulamak üzere onayladı. Bu teslim yönetim panelindeki `/help-articles` ekranıdır; mobil uygulamaya yeni ekran veya paket eklemez.

## Uygulama

- Mevcut GINA logo/fontları, krem yüzey, mor eylemler ve mint yayın durumuyla masaüstünde liste–editör, dar ekranda liste–detay düzeni.
- Dil ve platform filtreleri. “Tüm platformlar” bütün platformları getirir; “Tüm cihazlar için ortak” yalnız `all` hedefli yazılardır. 50 kayıt ve `(slug,id)` imleciyle sonraki sayfa.
- Yeni yazı kodu/dil/platformu ilk kayıtta belirlenir, mevcut yazıda değişmez. Başlık ve düz metin yanıt düzenlenir. Önizleme HTML çalıştırmaz.
- Güncel taslak ve gerçekten yayımlanan sürüm sunucudan ayrı okunur. Düzenleme/saklama ailelerin gördüğü içeriği değiştirmez.
- İnceleme, yayımlama ve yayından kaldırma ayrı gerekçeli onay adımlarıdır. Kaydedilmemiş/değişmiş sürüm yayımlanamaz. Yeni kayıt yeniden inceleme gerektirir. Aynı yetkili hem inceleyebilir hem yayımlayabilir; iki kişi onayı uygulanmış değildir.
- Sonucu belirsiz komut kullanıcıya özel yerel kayıtta eylem, yazı, sürüm, içerik/gerekçe ve istek kimliğiyle korunur. Yeniden açılış aynı komutu tekrarlar; doğru makbuz gelmeden temizlemez. Depolama başarısızsa göndermez.
- Başka editörün yeni sürümü yerel taslağı ezmez; kullanıcı açıkça güncel sürümü seçer. Kaydedilmemiş değişikliklerde seçim, bağlantı, tarayıcı geri ve çıkış koruması vardır.
- Canlı `content` rolü hem UI hem RPC'de zorunludur. Geçici yetki kontrolü hatasında form gizlenir, toparlanınca taslak geri gelir. Kesin yetki iptalinde form kaldırılır; çıkış/rol iptalinde yerel komut temizlenir. Özel destek yazışmaları bu ekrana alınmaz.

## Kanıt

| Görünüm | Uygulamadan alınan görüntü |
|---|---|
| Masaüstü 1440 × 1000 | [Düzenleyici](desktop-implementation.png) |
| Tablet dikey 834 × 1194 | [Taslak önizlemesi](tablet-implementation.png) |
| Tablet yatay 1280 × 800 | [Düzenleyici](tablet-landscape-implementation.png) |
| Telefon 390 × 844 | [Taslak önizlemesi](phone-implementation.png) |
| Boş / yükleniyor / hata | [Boş](empty.png), [yükleniyor](loading.png), [hata](error.png) |

Bunlar gerçek React ekranlarının sentetik örnek içerikle Chromium görüntüleridir. Tüm boyutlarda yatay taşma yok. Alt köşedeki N işareti yerel Next geliştirme göstergesidir, üretim arayüzünün parçası değildir. Fiziksel iPad/Safari ve ekran okuyucu kabulü bu kayıtla tamamlanmış sayılmaz.

- `pnpm turbo run lint typecheck test`: 7 iş geçti; 73 core testi.
- Backoffice üretim derlemesi/statik dışa aktarım geçti (15 rota).
- `039_help_article_editor.test.sql`: izole `gina_prova_builder_audit` veritabanında 25 kontrol geçti; sonrasında rollback. Gerçek/örnek aile kayıtlarına dokunulmadı.
- `qa-fixture.cjs` + `qa-checks.cjs`: 17 tarayıcı kontrolü; kayıt/yayın ayrımı, HTML düz metin, aynı istekle yayın kurtarma, çakışma, arşiv, yeni yazı, rol kesintisi/iptali ve çalışma zamanı hatası kontrolü. Bu ayrı test bağlamında sıfır JS çalışma zamanı hatası.
- Ek tarayıcı kontrolleri: çıkışta taslak uyarısı, Next yönlendirme geçmişinden geri dönüş koruması, generic-platform filtresinin yalnız 2 ortak örneği getirmesi; diğer iOS örneğini hariç tutması.

Tarayıcı örnekleri `https://ginaqa.supabase.co/**` çağrılarını tamamen keser ve yerel örnekle yanıtlar. Hiçbir gerçek yardım yazısı yayımlanmadı, aileye mesaj/e-posta gönderilmedi, operasyon rolü atanmadı. Migration yalnız izole test veritabanına uygulandı; üretim migration/hosting/TestFlight dağıtımı yapılmadı. Yayın öncesi gerçek yardım metinleri mevcut uygulama adımlarıyla karşılaştırılıp ayrı ayrı incelenmeli.
