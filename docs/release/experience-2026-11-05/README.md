# Çoklu kaynak ve kullanım iyileştirmeleri — 5 Kasım 2026

## Değişiklikler

- Ders programı, öğrenme planı, görev/ödül önerileri ve Prova belge girişinde ortak **Dosyalar / Galeri / Fotoğraf çek** seçimi. Seçimler birikir; önizleme, kaldırma ve sıralama vardır. Kamerada her çekim aynı listeye eklenir. Varsayılan 5 dosya; yönetim → AI → kaynak sınırı ile 1–10 değiştirilebilir.
- Seçim cihazda kalır. Saklama ve AI onayı verilince özel depoya yüklenir. Görsellerin konum/EXIF bilgisi taşınmaz. En fazla toplam 20 MiB / 20 sayfa; PDF başına mevcut 5 sayfa kuralı korunur. Aynı içerik iki kez seçilmez.
- AI bütün kaynakları sırasıyla alır; biri eksikse kısmi analiz yapmaz. Tek analiz tek işlem hakkıdır. Prova'nın soru başına kotası değişmez. Gerçek token tüketimi ve sunucu limitleri korunur. Yeniden deneme aynı ücretli sonucu kullanır.
- Kaynaklar birleştirilip kaybolmaz: her özgün dosya saklanır ve oluşturulan içerikten açılabilir. Kullanımdaki Prova kaynaklarının otomatik temizlenmesi engellendi.
- Yönetim → **Hazır seçenekler**: Türkçe/İngilizce etiket, sınıf aralığı, tür, sıra ve aktiflik. Çanta, ödev, çalışma, kurs, ders, konu ve adım seçenekleri desteklenir. İlk 33 seçenek hazır; boş konu/adım katalogları yöneticinin içeriğiyle genişletilebilir. Silmek yerine pasifleştirme geçmiş kayıtları korur.
- Çanta ve öğrenme planında önce seçenek, gerektiğinde özel metin. Çanta öğesi, plan başlığı ve ders seçimi sabit kimlikle kaydedilir. Konu ve adımlar şimdilik seçilen metin olarak saklanır; ayrıca kimlik bazlı konu analitiği tamamlandı sayılmaz.
- Prova süre ve soru sayısı: hazır değerler, artır/azalt ve isteğe bağlı elle giriş. AI notları çok satırlı; tıklanabilir örnekler mevcut metni silmeden eklenir.
- Yönetim küçük ekran menüsü ve geniş tablolar düzeltildi. İçerik seçilmeden paylaşım ekranı açıklayıcı yönlendirme gösterir. Anonim çocuk cihazı aile oluşturamaz; sunucu gerçek kayıtlı hesabı denetler.

## Kullanım ve tasarım değerlendirmesi

Mint/mor/krem, onaylı logo/mascot ve mevcut yazı ailesi korunmuştur. Sık kullanılan seçimler önce, özel giriş sonra gelir. Kullanıcıya boş ekran yerine neden ve sonraki adım gösterilir. Çocuğun notu veya AI yorumu psikolojik tanı olarak sunulmaz. Seçenekler kayıtlı sınıfa göre filtrelenir; cinsiyete göre akademik yetenek varsayılmaz. AI çıktısı insan incelemesinden önce programa otomatik uygulanmaz.

## Kontrol kanıtı

| Kontrol | Sonuç / sınır |
|---|---|
| Veritabanı | 75 dosya, 2.071 pgTAP kontrolü geçti |
| Temel mantık | 243 test geçti |
| Gerçek yerel Auth, REST, Realtime, Storage, Edge | İzole ailede 254 kontrol geçti; tüm geçici kaynaklar temizlendi |
| Typecheck/lint | Mobil, yönetim, core ve API kontrolleri geçti |
| Edge | CI'daki bütün kontrol ve test grupları geçti |
| Tarayıcı yerleşimi | 113 kayıtlı rota/boyut kontrolünde belge yatay taşması yok; ek kamu giriş ekranı ve defter görüntüleri eklendi |
| İşlevli UI denemeleri | İki dosya ekle/sırala/kaldır; yönetim sınırı değiştir/geri al; katalog ekle, çantada seç/kaydet/yeniden aç; çocuk PIN ve veli kilidi; deftere yazı/sembol/kalem, çizimde sabit scroll |
| Güvenlik | Aileler arası erişim, güncel yönetici yetkisi, anonim aile oluşturma, kaynak izinleri, toplam sınır ve tekrar deneme testleri. Yüksek/kritik bağımlılık uyarısı yok. Üç düşük/orta upstream sürüm uyarısı mevcut yamalarla karşılanıyor; davranış testleri geçti |

Yerel tarayıcı denemeleri gerçek izole servislerle çalıştı; yalnız bu yerel servisin CORS başlıkları tarayıcı testinde uyarlandı. Üretim kimlik bilgileri ve gerçek aile kayıtları bu testte kullanılmadı. Ekran görüntüleri sentetik veridir. `screen-audit.json` ayrı görülmeyen rotaları ve ortak çocuk ekranı kullanımını açıkça işaretler. Bir ekranın açılması bütün veri durumlarının test edildiği anlamına gelmez.

## Cihazda tamamlanacak kabul

1. TestFlight'taki yeni sürümü yükleyin. Ders programında Galeri'den iki görsel seçin, ardından Fotoğraf çek ile üçüncüyü ekleyin; silme/sıralama ve analiz sonucunu kontrol edin.
2. Kamera iznini reddedip yeniden deneyin; uygulama ayarlarına yönlendirme görülmeli. Galeri erişimi sistem seçicisi üzerinden kalmalı.
3. iPad'de defterde Apple Pencil ile çizin; dik/yatay ve metin/sembol pencerelerini deneyin. Tarayıcıdaki pointer denemesi fiziksel Pencil kabulü değildir.
4. Gerçek mağaza satın alma/iade, APNs/FCM teslimi ve üretim Google/Apple kullanıcı etkileşimi bu değişiklik kapsamında bütün kombinasyonlarıyla yeniden çalıştırılmadı. Önceki kabul kayıtları korunur.

Yayın kimlikleri ve canlı kontroller tamamlanınca bu klasöre ayrıca kaydedilecektir. Bu belge tek başına yayın kanıtı değildir.


## Canlı kabul ve düzeltme

İlk geniş canlı denemede öğrenme planı üretimi `ai_result_invalid_title` ile durdu. Model ödev açıklamasını kısa başlığa koyuyordu. Alan sınırlarını ve başlık/adım ayrımını istemde ve şema açıklamalarında belirginleştirdik. Sunucu doğrulaması, ücretli tekrar deneme koruması ve içerik sınırları gevşetilmedi. Hata teşhisinde yalnız sabit alan adı saklanır; belge içeriği saklanmaz. Ek iki regresyon kontrolüyle ilgili 28 test geçti.

Son canlı kabulde çoklu görsel ders programı, öğrenme planı, haftalık özet, görev ve ödül AI önerileri, çoklu seçim/kaydetme, özgün belge bağlantıları ve tekrar çağrıda tek hak tüketimi geçti. Sentetik aile normal hesap silme akışıyla kaldırıldı. Önceki başarısız denemeler ve temizlikleri gizlenmeden ayrı kanıtta tutulur.

Web ana HTML/giriş/aile ekranı ve giriş JS dosyası üretim derlemesiyle birebir hash eşleşti. Telefon/tablette canlı giriş ve aile oluşturma yönlendirmesi görüldü. Yönetimin ana ve gerçek önizleme adreslerinde 12/12 Access kontrolü geçti. Yetkili yönetim içeriği bu tur canlı kullanıcı hesabıyla yeniden açılmadı; yerel gerçek servis UI kabulü ve önceki canlı oturum kanıtı ayrı tutulur.

19 sunucu sınır kontrolünün 18'i yetkisiz isteği 4xx ile reddetti. `google-rtdn` önceki eksik Google bildirim yapılandırması nedeniyle 503 ve `push_auth_not_configured` verdi; bunu başarılı entegrasyon saymıyoruz. Android mağaza hazırlığı ayrı açık iştir.

Kaynaklar: [Anthropic yapılandırılmış çıktı sınırları](https://platform.claude.com/docs/en/build-with-claude/structured-outputs). Sağlayıcı `maxLength` kabul etmediği için açıklama + bağımsız sunucu doğrulaması kullanılır.
