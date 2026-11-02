# Aile deneyimi — yayın hazırlığı

Bu paket TestFlight 12’den sonraki çalışmadır. PR #42 (`91ea2c5`) main’e alındı. 2 Kasım 2026 tarihinde iki migration ve `prova-generate`, `prova-grade`, `prova-plan`, `ai-weekly-summary`, `iap-verify`, `delete-account` üretime dağıtıldı. **2 Kasım 2026: 0.1.0 (13) TestFlight’a yüklendi; Apple durumu VALID / IN_BETA_TESTING ve Team (Expo) grubunda 2 test kullanıcıya açık.** Canlı Apple/Google girişi ve AI üretimi doğrulanmadan bu özellikler tamamlandı olarak işaretlenmez.

## Değişen akışlar

- Maskot tek bir okuma görselinden ibaret değil: aile/karşılama, cihaz bağlantısı, planlama ve ödül için dört ayrı saydam görsel; Prova’da mevcut okuma pozu korunur. Odanın onaylı özgün resmi değişmez.
- Yardımcı işlemler çerçevesiz bağlantı biçiminde; ana işlem mor düğme olarak kalır. Cihaz tercihi ve çocuk seçimi dokunulabilir görsel seçeneklerdir.
- Eşleştirme sırasında iki cihaz arasındaki bağlantı simgesi yavaşça belirginleşir. Arka planda, ekran kapalıyken ve sistemde Hareketi Azalt açıkken animasyon durur. Maskota büyütme/küçültme efekti uygulanmaz.
- Ayarlar → Çocuk cihazları → cihaz: kişisel/paylaşılan kullanım, izinli çocuklar, PIN zorunluluğu. PIN’siz tercih yalnız o cihazın seçili çocuk profillerini açar; veli alanını açmaz. Sunucu izin listesini uygular. Eski cihazların önceki PIN davranışı korunur. Kurulu TestFlight 12 için eski `pair_device` yolu çalışır; yeni istemci `pair_child_device` ile seçim yapılmadan kapalı kalan cihaz oluşturur.
- Ayarlar → Ailem → Aile seçimi ve eş daveti: davet kodu önce aileyi gösterir, açık onayla katılır. Önceki aile ve geçmişi korunur; aileler arasında geri dönülebilir. Çocuk kayıtlarını, puanlarını veya ücretli paketleri **birleştirmez/taşımaz**. En fazla beş aile üyeliği; davet denemeleri sınırlıdır.
- Prova → AI ile hazırlama: adım adım veya hızlı hazırlık; yalnız soru kütüphanesi ya da tam Prova; soruları inceleme ve seçme; açık onaydan sonra çocuğa atama. Hızlı görünüm tercihi kullanıcıya özeldir.
- AI kotası sunucuda işlem başlamadan ayrılır. Aynı istek tekrarlandığında ikinci kez soru oluşturmaz/kota düşmez. Sorular ve kullanım kaydı tek işlemde kaydedilir.
- Apple/Google girişinin istemci bağlantıları hazır. Sağlayıcı üretimde etkin değilse düğmesi gösterilmez. iOS Apple girişi yerel Apple arayüzünü; Google ve web Apple girişi güvenli tarayıcı dönüşünü kullanır. Mevcut paketler kullanıldı, yeni bağımlılık eklenmedi.

## Dış hesaplarda tamamlanması gerekenler

### 2 Kasım canlı kurulum durumu

- Google Cloud projesi `gina-aile-enescevik` oluşturuldu. Google Auth Platform uygulama kaydı **GINA Aile**, dış kullanıcı ve test aşaması olarak kaydedildi; Google API Services User Data Policy kullanıcı onayıyla kabul edildi. `GINA Aile Supabase` adlı Web OAuth istemcisi oluşturuldu ve gizli değeri yalnız Supabase Google sağlayıcısına kaydedildi. Sağlayıcı etkin; test kullanıcı listesinde `enescevik@gmail.com` var. Google hâlâ Testing durumunda; genel yayın ve marka doğrulaması tamamlanmış değildir.
- Supabase dönüş listesine `gina://auth-callback` ve `https://gina-aile-enescevik.expo.app/auth-callback` eklendi ve kaydedildi. Mevcut iki şifre sıfırlama adresi korundu.
- Apple kişisel ekibi `689ZS375S5` altında `com.enescevik.gina` uygulamasında Sign in with Apple yeteneğinin zaten açık olduğu doğrulandı. `com.enescevik.gina.web` Services ID, Supabase alan adı/dönüş adresiyle kaydedildi. Yalnız Sign in with Apple yetkili `GINA Sign In` anahtarı oluşturuldu; anahtar kimliği `3SQWKXHAUJ`. Supabase sağlayıcısı etkin, Client IDs sırası `com.enescevik.gina.web,com.enescevik.gina`. Özel `.p8` dosyası repo dışında `/Users/enes/.config/gina/auth/AuthKey_3SQWKXHAUJ.p8` konumunda, dosya izni `0600`. Sunucu gizlisinin imzası yerelde doğrulandı; son geçerlilik tarihi **1 Mayıs 2027 04:24:42 UTC**. Bu tarihten önce aynı özel anahtarla yeni sunucu gizlisi üretilip Supabase’e kaydedilmeli; otomatik yenileme kurulmadı.
- Canlı sağlayıcı kayıtları kaydedildi ve panelde ikisi de Enabled olarak doğrulandı. Supabase başlangıç adresinden Google hesap seçiciye ve Apple’ın “GINA Aile Web” giriş ekranına yönlendirme başarılı. Bu kontrol kullanıcı onayını, token değişimini, yeni hesap açılmasını veya uygulamaya dönüşü sınamaz; gerçek iPhone testi henüz yapılmadı. Canlı Expo web adresi hâlâ eski giriş ekranını gösteriyor; yeni web dağıtımı yapılmadı. iOS 0.1.0 (13) TestFlight’a dağıtıldı; gerçek cihazda OAuth uçtan uca testi hâlâ bekliyor.
- Kullanıcı GINA alan adı ve e-posta gönderim hizmetinin olmadığını bildirdi. Supabase FREE projesinde özel SMTP kapalı. Mevcut panel, e-posta şablonunu düzenlemek için özel SMTP veya ücretli plan istiyor; varsayılan Magic Link şablonu kod değil bağlantı gösteriyor. SMTP/gönderici kurulmadan kodla yeniden doğrulama tamamlandı sayılamaz. Bu çalışma ücretli abonelik veya alan adı satın almadı.

### 1. AI anahtarı

1. Anthropic Console’da sohbette paylaşılan anahtarı iptal edip yeni bir **API** anahtarı oluşturun. Claude sohbet aboneliği ile API kullanım bakiyesi ayrıdır.
2. Supabase → **gina-prod** → **Edge Functions → Secrets** bölümüne girin.
3. Adı `ANTHROPIC_API_KEY` olan gizli değeri kaydedin. Değerini sohbete, uygulamaya veya GitHub’a koymayın.
4. “Anahtarı kaydettim” demeniz yeterli. Ardından sunucudan gerçek bir soru hazırlama ve tam Prova akışını sınayacağız.
5. Mevcut ürün kuralında AI üretimi Plus/Pro’ya aittir; ücretsiz planın kotası sıfırdır. Test hesabının paketi ayrıca doğrulanmalıdır. Bu çalışma ücretli paket açmadı veya satın alma başlatmadı.

[Anthropic yapılandırılmış çıktı belgesi](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) ve [model kimlikleri](https://platform.claude.com/docs/en/models/overview).

### 2. Google ile giriş

1. Google Cloud’da GINA projesini seçin/oluşturun. Proje adını paylaşabilirsiniz; gizli bilgi gerekmez.
2. Google Auth Platform’da uygulama adı ve destek e-postasını tanımlayın; test aşamasında deneyecek Google hesaplarını test kullanıcılarına ekleyin.
3. OAuth istemcisi oluşturun: **Web application**. Yetkili dönüş adresi: `https://wixjxlxgyhgdacadsawo.supabase.co/auth/v1/callback`.
4. Supabase → Authentication → Sign In / Providers → Google: istemci kimliği ve gizli değeri doğrudan buraya kaydedip etkinleştirin. Gizli değeri sohbete göndermeyin.
5. Supabase → URL Configuration → Redirect URLs listesine `gina://auth-callback` ve `https://gina-aile-enescevik.expo.app/auth-callback` ekleyin; mevcut şifre sıfırlama adreslerini silmeyin.
6. Gerçek iPhone’da giriş, vazgeçme, yeni hesap oluşturma ve mevcut hesaba dönüş sınanacak.

[Supabase Google kurulum belgesi](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).

### 3. Apple ile giriş

1. Apple Developer → Identifiers → `com.enescevik.gina`: **Sign in with Apple** yeteneğini etkinleştirin. Uygulama yapılandırması bu yeteneği talep ediyor; yeni imzalı derleme gerekli.
2. Web/Android tarayıcı girişi için oluşturulan `com.enescevik.gina.web` Services ID kaydını kullanın; aynı kimliği yeniden oluşturmayın.
3. Services ID için alan adı `wixjxlxgyhgdacadsawo.supabase.co`, dönüş adresi `https://wixjxlxgyhgdacadsawo.supabase.co/auth/v1/callback`.
4. Sign in with Apple yetkili anahtarı güvenle saklayın; Supabase Apple sağlayıcısının istediği sunucu gizlisini bu anahtarla oluşturup doğrudan Supabase’e kaydedin. App Store Connect yükleme anahtarıyla karıştırmayın.
5. Client IDs listesinde **Services ID önce**, `com.enescevik.gina` sonra yer almalı. Web akışı ilk kimliği kullanır; yerel iOS akışı bundle kimliğini kabul eder.
6. Apple’ın e-posta gizleme özelliğiyle kullanılacak gönderici alanını da tanımlayın. Gerçek cihazda ilk giriş, iptal ve tekrar giriş sınanacak.

[Supabase Apple kurulumu](https://supabase.com/docs/guides/auth/social-sign-in/auth-apple), [Expo 58 Apple yeteneği](https://docs.expo.dev/versions/v58.0.0/sdk/apple-authentication/).

### 4. Şifresiz hesaplarda e-posta doğrulaması

Supabase → Authentication → Email Templates → **Magic Link** şablonunda tek kullanımlık kodun `{{ .Token }}` alanıyla gösterilmesi gerekir. Kod uygulamadaki doğrulama alanına yazılır. Apple/Google hesabıyla giren kişiler hesap silerken veya veli PIN’ini unuttuklarında bu yolu kullanır. Gönderici/SMTP ve Apple gizli e-posta teslimatı gerçek hesapta sınanmadan bu akış tamamlandı sayılmaz. Yalnız JWT yenilemek yeniden kimlik doğrulama yerine geçmez; sunucu son beş dakikadaki doğrulanmış OTP girişini arar.

## Yayın sırası ve doğrulama sınırları

1. Kod, izin testleri ve telefon/tablet görünüm kontrolleri.
2. PR ve CI; iki yeni migration, ardından ortak yetki kontrolünü kullanan Edge Functions ve hesap silme işlevi.
3. Gizli anahtar ve OAuth sağlayıcılarının canlı doğrulaması; paket hakkı olan test ailesiyle gerçek AI denemesi.
4. Apple imzalama yeteneğinin doğrulanması; yeni iOS derlemesi ve TestFlight yüklemesi.
5. Apple işleme tamamlanıp beta erişimi açılınca sürüm numarasıyla haber verilecek.

Yerel görsel kontroller tüm sunucu çağrıları taklit edilerek yapılır; gerçek OAuth/AI çalıştığının kanıtı değildir. Deneme veritabanı `gina_release13_audit`, mevcut yerel veritabanından yalnız şema ve genel ürün/şehir tanımlarını alır; aile/demo kayıtları taşınmaz veya değiştirilmez.

## Görsel dosyalar

`packages/assets/brand/growing-friend/contextual/`: `family.png`, `device.png`, `planner.png`, `reward.png`, `manifest.json`. Dördü de yerleşik imagegen aracıyla, onaylı `reading.png` karakteri referans alınarak üretildi. Temel tarif: aynı mint peluş gövde, iki mor ve bir mint yaprak, aynı göz/yüz oranı; aile için ev yastığı, cihaz için tablet, planlama için takvim defteri, ödül için yıldız madalyası; yazısız ve saydam zemin. Bunlar animasyon dosyası değildir.

## Yapılan kontroller

- `pnpm turbo run lint typecheck test`: geçti; çekirdek 22 test.
- Yayın hazırlığı ve yerel metin kontrolleri: 7 test geçti.
- Edge Functions tür kontrolü; yetki/hesap silme/hava testleri: 21 test geçti.
- İzole PostgreSQL üzerinde 20 pgTAP dosyası, 315 doğrulama geçti. Eski/yeni eşleştirme, PIN zorunluluğu, izinli çocuk, aile değiştirme, davet limiti, AI kota rezervasyonu ve tekrarlanan istek kontrol edildi.
- Telefon/tablet: 14 ekran durumu ve 10 etkileşim; taşma, bozuk görsel veya tarayıcı hatası yok. Şifresiz hesap doğrulamasında ek 5 kontrol geçti. Bunlar taklit sunucu yanıtlarıyla sınandı.
- iPhone simülatöründe Prova adımları ve cihaz erişimi açıldı; ekran görüntüleri galeride. Canlı Apple/Google/AI ve gerçek e-posta teslimatı bu kontrollerin kapsamında değildir.
- [Görüntü galerisi](evidence/family-experience/index.html), [telefon/tablet sonuçları](evidence/family-experience/validation.json), [veritabanı sonuçları](evidence/family-experience/database-tests.json), [şifresiz hesap kontrolleri](evidence/family-experience/social-validation.json).

Google giriş düğmesinde resmî renkli simge ve Google Sans Medium kullanılır; yalnız sağlayıcı düğmesine aittir, GINA’nın yazı tipini değiştirmez. Kaynak/lisans kayıtları `packages/assets/auth/google/manifest.json`, `OFL.txt` ve `TRADEMARKS.md` içindedir. [Google giriş düğmesi kuralları](https://developers.google.com/identity/branding-guidelines).

Çocuk profil seçicisi, izin/PIN değişikliklerini ekran açıkken 30 saniyede bir kontrol eder; ilk profil yapılandırması bekleniyorsa süre 5 saniyedir. Arka planda periyodik kontrol yapmaz. Giriş reddedilirse profil bilgisi hemen yenilenir; sunucu izni her girişte kontrol eder.

## TestFlight 13 yayın kaydı

Kaynak commit: `39ce6a33071e55e96d190f49e2c0896055795af4`. Temiz, ayrı bir checkout üzerinden production profiliyle derlendi; çalışma klasöründeki yerel taslaklar korunup yüklemeye dahil edilmedi. EAS derleme ve gönderim FINISHED; Apple işleme VALID, iç test durumu IN_BETA_TESTING. Türkçe test notlarına SMTP/OTP ve canlı AI doğrulaması eksikleri eklendi. App Store genel yayını başlatılmadı.

[TestFlight durum kaydı](testflight-13-status.json), [yapılandırma kontrolü](testflight-13-preflight.json).
