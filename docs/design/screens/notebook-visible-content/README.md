# Defter: görünen soru ve sayfa devamı

3 Kasım 2026. Kullanıcının bildirdiği dikey tablet kesilmesi düzeltildi.

- Sorudan kopyalama eylemi kaydırılan alandan sabit başlığa taşındı.
- Dikey tablette görsel ve soru yan yana; “Sorunun tamamı” ile soru alanı büyütülür, “Deftere dön” ile cevap korunarak dönülür.
- Defterde aşağıda içerik varsa “Sayfanın devamı aşağıda” ve 48 dp yukarı/aşağı kontrolleri görünür. Sayfa sonunda aşağı kontrolü devre dışıdır. Kalem modunda parmak hareketi sayfayı kaydırmaz.
- Önceki kanıttaki alt üçgen, sentetik örnekte iki kez eklenen görseldi. Yeni kanıt tek eklenmiş görsel içerir; veriden nesne silen bir düzeltme yapılmadı.

## Görseller

| Dosya | Gerçekleştirilen kontrol |
|---|---|
| ipad-portrait-native.png | iPad Air M4 simülatörü, 820×1180; sabit başlık, kaynak kopyalama, tam soru ve deftere dönüş, sayfa sonuna/başına ilerleme |
| phone-question-web.png | 390×844 Expo web, Soru sekmesi |
| phone-notebook-web.png | 390×844 Expo web, kopyalanmış görselle Defter sekmesi |

Ayrıca 600×900 ve 1280×800 web düzenleri kontrol edildi. Kopyalama düğmesi tüm kırpma sınırlarının içinde, dokunma yüksekliği en az 48 ve sayfada yatay taşma yok. Uzun sorular kaydırılabilir; her sorunun bütünü özet alanına sığar iddiası yoktur.

Bu kontroller gerçek uygulama bileşenlerini geçici sentetik rota ve yalnız yerel QA sunucusuyla çalıştırır. Önceki [cihaz doğrulama paketi](../notebook-device-acceptance/README.md) aynı test düzeneğini açıklar. Yeni ölçümde başlık ve ilerleme ayrı geçirilmiştir. Test rotası uygulamadan kaldırıldı. “Yerel test” ifadesi gerçek kayıt veya senkronizasyon kanıtı değildir. Simülatörün sağ üst geliştirme düğmesi dağıtılan arayüzün parçası değildir.

Mobil TypeScript, Expo lint ve 8 defter yerleşim kontrolü geçti. Fiziksel iPad/Pencil, Android, VoiceOver, büyük sistem yazısı ve gerçek cevap kaydı kabulü açık. Üretim verisi değişmedi; TestFlight veya cihaz yayını yapılmadı.
