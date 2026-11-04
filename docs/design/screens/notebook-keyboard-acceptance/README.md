# Defter: klavye ve büyük yazı kabulü

4 Kasım 2026. Gerçek `NotebookWorkspace` ve `NotebookEditor` bileşenleri, sentetik soru ve yalnız yerel QA sunucusuyla çalıştırıldı. Gerçek aile verisi, AI, üretim veya TestFlight değişmedi.

## Bulunan ve düzeltilenler

- iPad yatayken ekran klavyesi açık olduğunda “Deftere yerleştir” düğmesi aşağıda kalıyordu. Başlık/kapatma ve ekleme eylemi artık görünür alanda; metin ve semboller aradaki alanda kaydırılır. Tek modal ve dört yön desteği korunur.
- Büyük sistem yazısında üst üste soru/defter düzeni çizim alanını çok daraltıyordu. Yazı ölçeği 1,4 ve üzerindeyken soru/defter sekmeleri kullanılır. Normal yazıdaki telefon/tablet düzeni korunur.

## Gerçekleştirilen kontroller

Ortam: iPad Air 11-inch M4 simülatörü, iOS 26.5, Expo 58 / RN 0.88.1 geliştirme derlemesi.

- Yazı penceresi açıkken yatay → dikey → yatay geçiş; sonraki açılışta ters yönler. Bu denemelerde sürekli dönüş oluşmadı.
- “Diğer araçlar” → semboller geçişi aynı modal içinde çalıştı.
- Ekran klavyesinden A, sembol düğmesinden + ve ayrıca ° eklenip deftere yerleştirildi.
- Kalemle dikey tablette çizgi çizildi; çizim sırasında sayfa kaymadı. Önceki eklenen sembol korundu.
- Sistem yazısı altı kademe büyütüldü; sekmeli düzen, soru önizlemesi ve defter kontrolleri görüldü. Test sonunda altı kademe geri alındı.
- iPhone 17 Pro simülatöründe Soru/Defter geçişi ve yazı penceresinde sembol girişi çalıştı. Simülatörün klavye ve ekran kaydetme menüleri devre dışı olduğundan **telefon ekran klavyesi kabulü tamamlanmadı**.

| Görsel | Gösterdiği durum |
|---|---|
| ipad-landscape-keyboard.png | Klavye açık, metin girilmiş ve ekleme düğmesi görünür |
| ipad-portrait-drawing.png | Dikey düzende soru, sembol ve çizgi birlikte |
| ipad-accessibility-text.png | Büyük sistem yazısında sekmeli defter |

Bu görseller yeni tasarım maketi değildir. Geliştirme dişlisi dağıtılan ürünün parçası değildir. İmzasız simülatörde bildirim keychain uyarısı oluştu; push teslimi doğrulanmış sayılmaz.

## Tekrar çalıştırma

Önceki [yerel test düzenini](../notebook-device-acceptance/README.md) kullan; geçici rotada `title="Matematik" progress="1 / 3"` geçir. Yazı penceresini aç, ekran klavyesini göster, yatayda ekleme düğmesine bas; büyük sistem yazısında çizim alanını kontrol et. Test rotasını dağıtıma dahil etme.

## Açık kabul

Fiziksel iPad/Pencil ve avuç teması, fiziksel iPhone klavyesi, Android, VoiceOver, işletim sistemi kapanışında kalıcı kayıt, gerçek sunucu/Storage/AI ve APNs/FCM teslimi bu çalışmada doğrulanmadı.

Mobil TypeScript, Expo lint ve 8 defter yerleşim kontrolü geçti. Bağımlılık taramasında yüksek/kritik bulgu yok; deepmerge düşük, minimatch ve glob orta önem kayıtları devam ediyor.

API kaynakları: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [KeyboardAvoidingView](https://reactnative.dev/docs/keyboardavoidingview), [ScrollView](https://reactnative.dev/docs/scrollview).
