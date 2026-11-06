# C15 — fiziksel cihaz kabul listesi

6 Kasım 2026 · H06 kapsamında hazırlandı. **Bu adımların hiçbiri yapılmadı**: bu oturumda fiziksel cihaz yok. Web ölçümleri (`h06/checks.json`: zoom, döndürme, 360–1280 px) bu listenin yerine geçmez ve burada fiziksel sonuç olarak yazılmadı.

Sorumlu: Enes (cihaz, hesap, izinler). Çıkan hata Claude'a, satır kimliği + ekran görüntüsü/video + saat ile gelir.

## Derlemeler

| Kod | Derleme | Kaynak | İçerik notu |
|---|---|---|---|
| **B30-iOS** | iOS 30, TestFlight gönderimi `b7ccb6a4` (IPA `7ddc64f9…`) | `bba2b01` (C14c) | D14 dahil. **H01, H04, H05, H06 değişiklikleri yok** (bunlar main'de, C14c sonrasında) |
| **B30-tab** | Tablet 30, kablosuz dağıtım `c4aic5og2w` (IPA `be558e9e…`) | `bba2b01` | Aynı |
| **B31+** | Henüz yok — H08 yayınından sonraki ilk iOS derlemesi | main ≥ H06 | H01 Apple ile yeniden doğrulama, H04 bağlantı ekranları, H05 AI notu, H06-1 |
| Android | **Yok** (X02: Firebase/Play hesabı) | — | TalkBack ve Android satırları bu yüzden ENG |

Durum sütunu boş bırakıldı; Enes doldurur: **GEÇTİ / KALDI (+ kanıt) / ENG (neden)**.

## Ön koşullar

- Gerçek veli hesabı (e-posta + şifre), ayrıca Apple ile girilmiş ikinci bir **test** hesabı; en az bir çocuk profili (5. sınıf), PIN'li çocuk modu.
- Bildirim izni ilk açılışta sorulur; C15-10 için "İzin ver" seçilir.
- iPad'de Apple Pencil eşli (C15-01..03).
- Silme satırı (C15-13) **yalnız silinecek test hesabıyla** yapılır; gerçek aile hesabı silinmez.

## Liste

| # | Cihaz | OS | Derleme | Rol | Adımlar | Beklenen sonuç | Durum |
|---|---|---|---|---|---|---|---|
| C15-01 | iPad (Pencil destekli) | iPadOS 26.x | B30-tab | Çocuk (eşli tablet) | Prova → açık uçlu soru → Defter → Pencil ile 3 çizgi + silgi + geri al; aynı anda avuç ekrana değsin | Pencil çizer, avuç çizmez; çizerken sayfa kaymaz; geri al son çizgiyi kaldırır; gönderimde çizim veliye ulaşır | |
| C15-02 | iPad | iPadOS 26.x | B30-tab | Çocuk | Defter açıkken parmakla kaydır, Pencil ile çiz, sonra iki parmakla yakınlaştır | Parmak kaydırır/yakınlaştırır, çizmez (kalem/parmak ayrımı); kâğıt sınırı dışına çizim taşmaz | |
| C15-03 | iPad | iPadOS 26.x | B30-tab | Veli | İnceleme → “Çizimli not ekle” → Pencil ile not → kaydet → çocuk tarafında aç | Not kaydedilir ve çocukta aynı konumda görünür | |
| C15-04 | iPhone | iOS 26.x | B30-iOS | Veli | VoiceOver açık: giriş → Bugün → Prova merkezi → “Birlikte Prova” → “Çocuğum katılsın” penceresi → onay kutuları → “Vazgeç” | Her düğme anlamlı adla okunur (ör. “Çocuğum katılsın, düğme”); onay kutusu durumu “seçili/seçili değil” okunur; pencere açıkken arkadaki ekran okunmaz; kapatınca odak açan düğmeye döner | |
| C15-05 | iPhone | iOS 26.x | B30-iOS | Çocuk (veli telefonunda çocuk modu) | VoiceOver açık: görselli soru → “Görseli büyüt: …” → “+”, “−”, “Kapat” | Görsel açıklaması okunur; yakınlaştırma yüzdesi değişince duyurulur; “Kapat” pencereyi kapatır | |
| C15-06 | iPhone ve iPad | iOS/iPadOS 26.x | B30-iOS, B30-tab | Veli | Kitapçık → Matematik 5 → “Öğrenci nüshasını oluştur” → PDF'i Dosyalar'a kaydet → PDF'te “i” içeren bir kelimeyi ara/kopyala (D4-4/D8-1) | Arama bulur; kopyalanan metinde “!” yok; Nunito/Baloo 2 görünür. (Android PDF yolu: ENG) | |
| C15-07 | iPhone | iOS 26.x | B30-iOS | Veli + Çocuk | Ayarlar → Erişilebilirlik → Daha Büyük Yazı en büyük değer; giriş, Bugün, Prova sorusu, abonelik ekranı | Metin kesilmez/üst üste binmez; düğmeler en az 48 pt dokunma alanında kalır; yatay kaydırma gerekmez | |
| C15-08 | iPhone | iOS 26.x | B30-iOS | Veli | Hareketi Azalt açık: “Birlikte Prova” katılım/sonuç pencereleri, soru görseli, “Soruyu göster”, rota geçişi | Pencereler solma/kayma olmadan anında açılır; kapatınca da animasyon yok | |
| C15-09 | iPad | iPadOS 26.x | B30-tab | Çocuk ve Veli | Defter, soru görseli penceresi ve katılım penceresi açıkken cihazı dikey↔yatay döndür (2 tur) | Pencere açık kalır, içerik yeniden yerleşir, çizim/kaydırma konumu korunur, uygulama kapanmaz | |
| C15-10 | iPhone | iOS 26.x | B30-iOS | Veli → Çocuk | Çocuk bir görevi tamamlasın (eşli tablet), veli telefonu kilitli beklesin | Veliye push gelir; bildirime dokununca ilgili onay ekranı açılır; bildirim izni kapalıyken uygulama içi kutu yine dolu | |
| C15-11 | iPhone | iOS 26.x | B30-iOS | Veli (oturumsuz) | Giriş → yetişkin beyanı → “Apple ile devam et” → Apple sayfası → onay; ayrı denemede Apple sayfasında “Vazgeç” | Onayda uygulamaya veli olarak döner (aile seçimi/Bugün); vazgeçte giriş ekranı kullanılabilir kalır, hata kodu görünmez | |
| C15-12 | iPhone | iOS 26.x | B30-iOS | Veli (oturumsuz) | Yalnız giriş ekranında “Google ile devam et” görünüyorsa (canlı Auth ayarı): “Google ile devam et” → Google hesabı → dönüş | Uygulamaya döner, oturum açılır; tarayıcı sekmesi açık kalmaz | |
| C15-13 | iPhone | iOS 26.x | **B31+** | Apple ile girilmiş **test** velisi | Menü → Hesap → “Hesap silme etkisini gör” → “Apple ile doğrula” → Apple onayı → “Bu işlemin geri alınamayacağını anladım” → “Kalıcı olarak sil” | Apple sayfası açılır, dönüşte doğrulandı görünür; silme tamamlanır; Apple Kimliği → “Apple ile Giriş Yap” listesinde GINA görünmez (iptal) ya da ekranda “iptal bekliyor/elle” iletisi çıkar. B30'da bu yol yok (H01 sonrası) | |
| C15-14 | iPhone | iOS 26.x | B30-iOS | Yeni hesap | Yeni hesap aç → e-postadaki doğrulama bağlantısına iPhone Mail'den dokun | Uygulama (ya da web) açılır, hesap doğrulanır | |
| C15-15 | iPhone | iOS 26.x | **B31+** | Yeni hesap | Doğrulama bağlantısını iki kez aç; ayrıca süresi geçmiş bir bağlantıyı aç | İkinci/eski açılışta “Bu bağlantının süresi dolmuş ya da daha önce kullanılmış” + “Doğrulama bağlantısını yeniden gönder”; yeni bağlantı gelir. (B30'da eski ekran: H04 öncesi) | |
| C15-16 | iPhone | iOS 26.x | B30-iOS (bağlantı ekranı B31+) | Veli | Şifremi unuttum → e-posta → bağlantıyı aç → yeni şifre; sonra aynı bağlantıyı tekrar aç | İlk açılışta şifre değişir; ikinci açılışta “Yeni şifre yenileme bağlantısı iste” kartı; uçak modunda açılışta “Tekrar dene” | |
| C15-17 | iPhone | iOS 26.x | B30-iOS | Veli | Klavye: giriş, soru editörü (AI sorusunu düzenle), hesap silme şifre alanı | Klavye açılınca odaktaki alan ve birincil düğme görünür kalır; çentik/ana gösterge alanına içerik girmez | |
| C15-18 | Android telefon | Android 15 | — | Veli | TalkBack ile C15-04/05 | **ENG (X02):** Android derlemesi yok | |

## Bu listede olmayanlar

- Web zoom (%135), 360×740 / 768×1024 / 1280×800 düzen, Tab sırası ve `prefers-reduced-motion` web ölçümleri → [`README.md`](README.md) ve `ui/checks.json`. Fiziksel kabul sayılmaz.
- Gerçek e-posta teslimatı (EN, farklı sağlayıcı) → H04 runbook.
