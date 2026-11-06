# Gizlilik erişimi ve avukat devir paketi — 6 Kasım 2026

## Değişiklik

- Veli Menü > Hesap > Gizlilik ve yasal ve giriş ekranı > Gizlilik ve yasal yolları eklendi. `/privacy` girişsiz; `/parent/privacy` mevcut veli/çocuk modu korumasını kullanır.
- Destek adresi görünür/kopyalanabilir. Veri başvurusu ve hesap silme düğmeleri e-posta uygulamasında taslak açar; otomatik gönderim, doğrulanmış talep veya silme işlemi yapmaz. Posta uygulaması yoksa adresle manuel devam edilebilir. Hesap sahipliği doğrulanmadan hiçbir silme yapılmamalıdır.
- Veli ekranı mevcut bildirim izinleri/geçmişi ve hesap silme seçeneklerine gider. Bildirim onay geçmişi genel sözleşme/veli onayı sayılmaz.
- Hukuk bağlantıları ve satın alma, `EXPO_PUBLIC_LEGAL_BASE_URL=https://ginafamily.com` ve `EXPO_PUBLIC_LEGAL_VERSION=YYYY-MM-DD.N` birlikte tanımlanmadığında kapalıdır. Yanlış alan adı, URL kimlik bilgileri, port/yol/sorgu ve taslak sürümleri reddedilir. Sürüm değeri tek başına hukuk onayı kanıtı değildir; operatör onay kaydı ve gerçekten yayımlanmış sayfaları doğrulamalıdır. Ortam değişkenleri bu işte açılmadı.
- Bağlantılar dil için `lang=tr/en` taşır. Yayınlanacak sayfaların bu seçimi desteklemesi ve aynı metin sürümünü göstermesi gerekir.
- Kişisel bilgiler içeren 10 tam taslak + 18 öncelikli soru + kaynak AVUKAT soruları tek, kendi içinde çalışan yerel HTML dosyasında birleştirildi. Çıktı yalnız kök çalışma alanının Git dışı `.codex-setup/legal-private-2026-11-06/` klasöründedir; uzak depoya veya canlı siteye eklenmez.

## Kalan işlerin ayrımı

Bu değişiklik C11'in gizlilik ekranı ve görünmeyen destek adresi açıklarını kapatır; girişsiz otomatik e-posta doğrulamalı silme formu eklediği iddia edilmez. Eski hukuk denetim notlarının ekranlarla ilgili kısmı, bu dal dağıtıldıktan sonra bu raporla birlikte okunmalıdır.

- **Hukuk kararı ardından:** koşullar/veli beyanı metinleri ve versiyonlu kabul kayıtları; rıza geri çekme kapsamı; kayıt türü bazında saklama, silme/yedek takvimi; 18 yaş ve dönem sonu silme vaatlerinin tutulması veya çıkarılması. Yayımlanmamış taslağa kullanıcı onayı toplanmadı ve süresiz/yıllarca yeni kişisel kayıt tutulmadı.
- **Başka aktif proje işleri:** H01 Apple token iptali, H04 ürün e-postası kabulü, H05 AI satın alma/fotoğraf açıklaması. Bu çalışma bunların dosyalarını değiştirmez veya tamamlandığını iddia etmez.
- **Yayın:** hukuk metinleri, e-posta hukuk linkleri ve satış açılmadı. Bu dalın uygulama kodu H08 düzeltme yayınına dahil edilmeli; native cihazlar yeni build gerektirir. Canlı dağıtım ayrı doğrulanmalıdır.
- **İnsan incelemesi:** sağlayıcı sözleşmeleri/aktarım mekanizmaları, KEP/VERBİS ve 20/B uygunluğu; ev adresinin yayın kapsamı.

## Doğrulama

- Mobil TypeScript ve Expo lint.
- Core test paketi: 65 dosya, 461 test geçti (yeni yayın/URL sınırı ve veri içermeyen e-posta taslağı testleri dahil).
- TestFlight / public build env / release planı: 27 test geçti.
- Expo SDK 58 web export; yerel, gerçek hesaba bağlanmayan önizleme.
- TR/EN girişsiz ekran, giriş ekranından ulaşım/geri dönüş, görünür adres, çeviriler ve 390px taşma kontrolü: `checks.json` ve ekran görüntüleri.
- Avukat dosyasındaki 10 ek, kaynak soruları ve dahili belge bağlantıları programatik kontrol edildi. Kişisel belge önizlemesi Git dışında tutuldu.

Bu rapor canlı kurulumu veya hukuk uygunluğu onayını temsil etmez.
