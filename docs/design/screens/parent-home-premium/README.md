# Veli ana ekranı — tasarım önerisi, 1 Kasım 2026

Durum: **onay bekliyor**. Bunlar image_gen ile üretilmiş tasarım maketleridir; uygulama ekran görüntüsü değildir. Bu aşamada uygulama kodu, veri tabanı veya TestFlight değiştirilmedi.

## Görseller

- [Telefon ilk görünüm](phone-proposal-v1.png): 853×1844 raster kaynak.
- [Tablet yatay](tablet-proposal-v1.png): 1585×992 raster kaynak.
- [Çocuk eklenmemiş aile](empty-proposal-v1.png): 853×1844 raster kaynak.
- [Üretim istemleri ve kaynaklar](generation.json).

Mantıksal hedef ölçüleri yerleşim hedefidir; üretilmiş rasterlar tam cihaz çözünürlüğü veya piksel hassasiyetinde uygulama kanıtı olarak sunulmaz. İlk taslaklarda görülen yanlış ilerleme oranı ve gereksiz yüzdelik etiketler son önerilerde düzeltildi.

## Referans ve eleştiri

Görsel dayanak kullanıcı tarafından beğenilen `../calendar-premium/approved-reference.png` ve haftalık ders programıdır. Marka kaynakları `packages/assets/brand/growing-friend/logo.png` ve `reading.png`. Eski `parent-home-mint/approved.png` yeni tasarımın hedefi değildir; ana ekranın güncel reddi önceki onayı geçersiz kılar.

İncelenen kaynaklar: mevcut ana ekranın `phone.png` kayıtlı uygulama görüntüsü, `apps/mobile/src/app/parent/index.tsx`, `components/parent-home/home-view.tsx` ve `theme.ts`. Canlı TestFlight oturumunda görsel inceleme yapılmadı.

Mevcut görünümde birbirine yakın ağırlıktaki çok sayıda kutu, küçük maskot, zayıf işlem hiyerarşisi ve uzun dikey akış var. Çözüm yalnız renk değiştirmek değil: bekleyen onay, günün planı ve kişiye ait ilerlemeyi sıraya koymak.

## Önerilen düzen

1. Marka, açık etiketli Çocuk modu ve bildirim erişimi.
2. Kompakt selamlama, tarih ve mevcut kitap okuyan peluş maskot. Veli adı yoksa “Ailemiz için bugün”.
3. Tümü / çocuk filtresi. Bütün ilgili bölümler aynı filtreye uyar.
4. Bekleyen görev onayı: başlık, çocuk, yıldız ve iki ayrı işlem. Görev başına onay/geri gönderme korunur. Çok sayıda onay varsa ilk iki satır ve aynı ekran içinde “Tümünü göster” açılımı önerilir; kayıt gizlenmez veya toplu onaylanmaz.
5. Günün planı: ders ve etkinlikleri ortak zaman çizgisinde gösterir. Makette iki örnek satır vardır; gerçek içerik kaydırılır. Takvime ve program düzenleyicisine erişim korunur.
6. Çocuk başına görev ilerlemesi ve yıldız bakiyesi; bakiyeler birleştirilmez. Görev tamamlandı sayısı mevcut `done`/`approved` kuralını korur, bekleyen onay ayrıca görünür.
7. Hedefler, günlük görevler, Prova ve haftalık küçük adımlar aşağıda devam eder. Telefonun ilk görünümüne sığmaması kaldırıldıkları anlamına gelmez.
8. Görev, Prova ve ödül kısayolları; Bugün / Takvim / Prova / Diğer gezinmesi. Tablette de tam genişlikte alt gezinme önerilir; eski yan menünün yerleşimi değişir, hedefleri kaybolmaz.

Telefonda tek sütun (430×932 mantıksal hedef); tablette (1280×800) onay ve plan solda, ilerleme ve hedefler sağda. Hedefler telefonun aşağı kaydırılan bölümündedir. Notlar, not/puan kayıtları, paylaşım ve gelişim bağlantıları alt devam bölümünde korunur.

## Görsel sözleşme

Krem zemin, koyu mor metin, mint seçim/ilerleme, lavanta ikincil kontroller ve mor saten birincil butonlar; onay kartında sınırlı sıcak kayısı vurgusu. Mevcut Nunito ailesi ve onaylı planlayıcı bileşenleri uygulamanın temeli olacak. Maketteki üretilmiş harf ve ikonlar yeni font veya yeni marka kaynağı değildir; uygulamada özgün logo/karakter ve mevcut TaskIcon, SubjectIcon, EventIcon, Collectible kullanılır.

Maketler etkileşim alanı ölçümünün veya erişilebilirlik testinin yerine geçmez. Uygulamada tüm işlemler en az 48 dp, safe area ve büyük yazı desteğiyle doğrulanacak; içerik sığmadığında kaydırılacak. Yüzdelik ek etiketlere gerek yok: görev oranı ve yıldız sayıları yeterli.

Sürekli büyütme/küçültme veya zıplama yok. Önerilen hareket yalnız basma durumunda kısa yüzey değişimi ve işlem başarıyla sonuçlandığında satırın sakin güncellenmesi; azaltılmış hareket tercihi korunur. Maskot bu aşamada onaylı statik kaynak olarak kalır.

## Boş, yükleniyor ve hata

- Çocuk yok: büyük maskot, “İlk çocuğunu ekle”, kısa açıklama ve baskın “Çocuk ekle” butonu. Sahte sıfır istatistikler veya boş onay/plan kutuları gösterilmez. Mevcut aile yönetimine erişir.
- Onay yok: geniş boş kart yerine “Bekleyen onay yok” şeklinde sakin durum satırı; günün planı öne gelir.
- Etkinlik yok: “Bugün için plan yok” ile “Etkinlik ekle” ve “Ders programı” erişimleri.
- Hedef yok: çocuğun adıyla açıklama ve mevcut ödüllere erişim; otomatik hedef seçimi yok.
- Yükleniyor: sabit yerleşimde iskelet satırlar ve erişilebilir yükleme metni; sahte başarı sayısı gösterilmez.
- Hata: “Bilgiler yüklenemedi” ve görünür “Tekrar dene”; boş durum gibi sunulmaz. Onay işlem hatası ilgili satırda kalır, çift gönderim engellenir.

## Onaydan sonraki uygulama ve veli ekranları sırası

Bu ana ekran tasarımı onaylandığında önce yapılacak uygulama değişiklikleri belirtilecek, uygulama onayıyla kodlanacak. Gerçek telefon/tablet görüntüleri maketlerle karşılaştırılacak. Sonraki ekranın tasarımına bundan sonra geçilecek.

| Sıra | Alan | Mevcut kaynak / korunacak amaç |
| --- | --- | --- |
| 1 | Ana ekran | `/parent`; onay, bugün, çocuk filtresi, yıldız, hedef, kısa yollar |
| 2 | Prova ve alt ekranları | `/parent/prova/*`; hazırlama, soru, sınav, plan, sonuç/gelişim, kitapçık |
| 3 | Ayarlar ve aile | `/parent/menu`; çocuk ekleme/düzenleme, PIN, aile daveti, cihaz eşleme/ayırma |
| 4 | Hedef ve ödül bağlantıları | Ana ekrandaki GoalCard ve `/parent/rewards`; onaylı ödül tasarımını koruyarak bütünlük kontrolü |
| 5 | Görevler | `/parent/tasks`; mevcut onaylı tasarımın ana ekranla uyumu, bütün işlem/durumlar |
| 6 | Günün planı ve onay | Ana ekran içi bölümler ile `/parent/calendar`; yeni bağımsız ekran ihtiyacı ayrıca önerilir |
| 7 | Bildirim | `/parent/notifications`; mevcut bildirim tercihleri ve izin/cihaz durumları |
| 8 | Paylaş | `/parent/share`; mevcut paylaşım ve rapor akışları |
| 9 | Paketler | `/parent/subscription` ve oda kredileri; gerçek satın alma/geri yükleme durumları |
| 10 | Hesap silme ve çıkış | Menüdeki AccountDeletion ve oturum işlemleri; sonuç ve onay adımları korunur |
| 11 | Diğerleri | Notlar, puanlar, giriş/eşleme ve ortak boş/hata/yükleme durumları |

Bu tablo kapsam planıdır; listedeki bütün alt ekranların bu turda görsel/işlevsel denetlendiği iddia edilmez. Veri ve yetki davranışı korunur; bir akış değişikliği gerekirse ayrı açık öneri olarak ele alınır.
