# Veli haftalık AI özeti — 4 Kasım 2026

Yeni bir bağımsız maket onayı iddia edilmez. Kullanıcının “Onaylı ekranların ortak tasarımını bu ekranlara uyarla” kararıyla mevcut veli ana ekranı/planner dili kullanıldı: krem `#FCFAF6`, koyu mor `#201951`, vurgu `#6042DE`, mint `#C0EFDF`, lavanta `#EEE8FA`; Nunito başlık/metin, mevcut SatinButton/IconButton ve özgün logo. Yeni font, paket veya görsel üretilmedi.

Ana ekran → **Birlikte bakalım** → **Tamamlanan haftaların AI özeti**. Güncel haftayı konuşma alanı değişmedi; tamamlanmış haftanın AI yorumu ayrı bir veli ayrıntısıdır. Telefonda kayıtlar ve yorum dikey, 900 dp üzerindeki tablette yan yana; büyük yazıda tek sütuna döner. Çocuklar arasında sıralama, yüzdelik başarı/zekâ çıkarımı veya otomatik görev ataması yoktur.

## Ekran kanıtı

Gerçek Expo web bileşenleri, yalnız sentetik ağ yanıtları. Bunlar fiziksel iPhone/iPad kabulü veya gerçek AI üretimi değildir.

- [Telefon — haftanın kayıtları](before-phone.png)
- [Telefon — AI metninin okunduğu kaydırma konumu](ready-phone.png)
- [Tablet — kayıtlar ve yorum yan yana](ready-tablet.png)
- [Tablet — belirsiz üretim](uncertain-tablet.png)
- [Telefon — bağlantı hatası](error-phone.png)

Telefon 390×844, tablet 1280×800. Ekran görüntüleri görünür alanı gösterir; aşağıdaki içeriği tam ekranmış gibi birleştirmez. Her iki ölçüde yatay taşma ve JavaScript sayfa hatası görülmedi. Kontroller en az 48 dp; ayrı üretilmiş bir “VIP” arayüz yerine mevcut onaylı bileşenler korunur.

## Veri ve ücret davranışı

- Ailenin saat diliminde son sekiz **tamamlanmış** hafta. Hafta sınırı istemci saatinden tahmin edilmez.
- AI isteği yalnız veli onayı ve açık hazırlama düğmesiyle başlar. Okuma, gezinme veya yeniden açılma ücretli çağrı yapmaz.
- Sunucuda ilk bağlamın yanında özel çocuk kimliği/takma ad eşlemesi tutulur; eşleme AI girdisine ve işlem hash’ine eklenmez. Çocuk sırası değişince eski yorum başka çocuğa kaymaz. Ad değişse de aynı kimlik çözülür.
- Eski bağlamlarda eşleme yoksa bugünkü sıradan ad uydurulmaz; özgün takma ad gösterilir. AI metnindeki Türkçe ekleri bozacak ad değiştirmesi yapılmaz; kayıtlarda ad ve takma ad birlikte görünür.
- Kayıtlı sayımlar, modelin önerilerinden ayrıdır. Dondurulmuş kaydın zamanı gösterilir; sonraki görev değişiklikleri eski AI metnine sessizce uygulanmaz.
- Ücretli iş tamamlanıp son özet tablosuna yazma/yanıt kaybolsa da kayıtlı iş sonucu salt okunur. Paket düşürülse/AI kapatılsa da önceki sonuç için tekrar hak gerekmez.
- Çalışıyor/belirsiz durumunda otomatik yeniden üretim yok. Veli yalnız durumu yeniden okur. Çocuk silinince türetilmiş kayıtlar mevcut silme sözleşmesiyle temizlenir; ayrılmış/başka aile/çocuk oturumu bunları okuyamaz.

## Kabul

- 34 yeni SQL kontrolü; toplam **70 dosya / 2012** kontrol.
- Haftalık üretim için **5 gerçek DB yarışı**: aynı hafta, son hak, sonuç kaydı tekrarı, çocuk silme, çocuk sırası/bağlam yakalama. Yalnız silinen audit klonlarında.
- Core **206**, haftalık handler/ortak AI işlem **18** testi; mobil/core tip, mobil lint, native metin kontrolü. iOS/Android/web export başarıyla tamamlandı; fiziksel cihaz çalıştırması değildir.
- `qa-fixture.cjs`: kayıp üretim yanıtı → kayıtlı sonuç → sayfa yenileme, toplam tek sentetik üretim; kapalı pakette eski sonucu okuma, hafta değişimi, belirsiz işte üretim engeli, okuma hatası/kurtarma. Gerçek aile verisi/AI kredisi kullanılmadı.

## Yayın sınırı

092000 henüz üretime uygulanmadı. 088000 Edge+DB güvenlik sürümü ve diğer bekleyen migration’larla aynı yayın planında ele alınmalı. Eski bağlam hash’leri yeniden yazılmaz. Gerçek sağlayıcı metin kalitesi, fiziksel cihaz, erişilebilirlik ve dağıtım kabulü açıktır. TestFlight 0.1.0 (17) değişmedi; kullanıcının “Hepsini bitirelim sonra yayına alırız” kararı korunuyor.
