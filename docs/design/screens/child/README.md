> **Güncel durum:** Tablet v1/v2 ürün sahibi tarafından reddedildi; uygulanmamalı. [Oyun sahnesi yön önerisi ve gerçek 3D çalışma](game-direction-v3/README.md) yeni inceleme konusudur. Ürün/teknik kararlar henüz kesinleşmedi.

# Tablet v2 revizyonu — 30 Ekim 2026

Tablet v1 onaylanmadı. Bu revizyon yalnız tasarım dosyalarını değiştirir; aşağıdaki eski tablet kararlarının yerine geçer. Telefonlar korunur. **Uygulama giydirmesi için onay hâlâ bekleniyor.**

[Hareketli oda demosu](motion.html) · [Sekiz tablet ekranı](tablet-contact-sheet.png) · [Tüm maketler](index.html)

- Pano artık pencereyi, kitaplığı ve halıyı örten büyük çerçeve değil; boş duvara bağlı, klipsli bir kâğıt yüzeyi. Uzun listeler yüzeyin içinde kayar.
- Koleksiyon, ortak ahşap tonunda raflar ve 3B nesneler kullanır. Kilitli katalog korunur.
- Tek oda vardır. Karakter ve pet, içerik sınırlarıyla ölçeklenir; görünür alt sınırları aynı 738 px zemin çizgisindedir. Oda düzenleyicide ikinci minyatür oda yoktur.
- İnteraktif karakter/pet seçimleri ve tema dekorları yalnız yerel demo durumudur; kalıcılık veya yeni iş kuralı eklenmedi.
- Pencerenin gece/yağmur/kar katmanları aynı cam alanına kırpılır. Gece oda ışığı hafifçe azalır; okunacak içerik karartılmaz.
- Pet nefesi 5 sn, kedi esnemesi 22 sn aralıkla 2.9 sn; dokunma/inceleme kontrolüyle kısa oyun. Sekme görünmezken yeni esneme başlamaz. Prova hareketi durdurur; reduced-motion tüm hareketi durdurur.
- Yeni `concepts/pet-cat-yawn.webp` imagegen ile aynı kediden türetildi. Bu bir **tasarım konsepti**, üretim sprite paketi değildir. Oyun mevcut görselin konum dönüşümüdür. Diğer hayvanlara yanlış esneme resmi uygulanmaz.
- Ses başlangıçta kapalı. Demoda yalnız kullanıcı hareketiyle kısa **sentetik zamanlama sesi** var; gerçek miyav/hayvan kaydı teslim edilmiş değildir.

### Claude için — tasarım onayından sonra

Şehir tercihini veli ayarlarından almak, saat dilimini ve hava sağlayıcısını belirlemek, çevrimdışı/izin yok durumunda son bilinen görünüm + gündüz varsayılanını kullanmak gerekiyor. Bu demoda GPS, konum izni veya hava API isteği yok. Ses/motion tercihlerinin kalıcılığı, tüm petler için uyku/esneme/oyun kareleri ve lisanslı/üretilmiş gerçek ses dosyaları ayrıca tamamlanmalı. Animasyonlar yıldız veya rozet vermez; bildirim ya da oyun süresi baskısı oluşturmaz. Üretimde bu katmanlar ayrı native parçalar olacak, ekran resmi butonların altına yerleştirilmeyecek.

### Revizyon doğrulaması

37 tablet renderı: 8 ekranın normal/boş/yükleniyor/hata durumları + 5 ek akış; eksik görsel 0, yatay taşma 0, tüm görünür düğmeler en az 48 dp. Prova hareket engeli ve reduced-motion tarayıcıda doğrulandı. Gündüz/gece/yağmur/kar ve esneme PNG'leri `concepts/` altında. Gerçek uygulama karşılaştırması önceki demo giriş hatası nedeniyle halen eksik; v1/v2 kıyası uygulama ekran görüntüsü değildir.

---

# BRIEF 14 · Grup 1 · Çocuk maketleri

**Durum: Enes’in tasarım onayını bekliyor.** Uygulama koduna geçilmedi. Bu PR yalnız bu grubu kapsar. BRIEF 13 sanat düzeltmeleri ayrı PR #16 üzerindedir; bu tasarım PR’ı ona bağımlıdır. Grup 2–4 ve giydirme ayrı işlerdir.

## Tasarım sistemi

Onaylı oda dilinin ahşap çerçevesi, yırtık krem kâğıdı, teal etiketi ve sarı bileti kullanılır. Telefon: tek sütun, 44 px üst/34 px alt güvenli alan, 18 px gövde, 30 px Baloo 2 başlık. Tablet: oda içinde 782 px içerik panosu, sağda karakter ve dostu; 38 px başlık. Nunito gövde yazısı. Renkler: krem #FFF8EF, teal #0FA3A3 / #0B7F7F, açık teal #D9F4F2, sarı #F5B301, koyu metin #142331. Çocuk bottom-nav yok.

Her düğme en az 48 px yüksek; metin küçültülmeden sarılır. Uzun listeler panel içinde kayar. Büyük yazıda giydirme sırasında tek sütuna akış ve içerik yüksekliğinin büyümesi korunmalı; sabit maket PNG’si uygulama arka planı yapılmamalı. Referanslar 1× ölçeklidir; native iOS/Android ve büyük yazı kabulü giydirme aşamasında yapılır.

## Dosyalar

- `index.html`: tüm normal telefon/tablet ve ek akışlar.
- `states.html`: sekiz ekranın boş/yükleniyor/hata durumları tek sayfada; tablet karşılıkları bağlantılı.
- `reference.html`: yalnız dokümantasyon amaçlı, aynı parçalar ve native benzeri metin katmanıyla çizilen kaydırılabilir tasarım kaynağı. `screen`, `state`, `size` parametreleri vardır.
- `{ekran}-phone.png`: 390×844; `{ekran}-tablet.png`: 1280×800.
- `{ekran}-{empty,loading,error}-{phone,tablet}.png`: durumlar.
- Prova için `open`, `confirm`, `result`; oda için `themes`, `pets` ek görünümleri.

Yerel inceleme: repo kökünden HTTP sunucusu aç ve `docs/design/screens/child/index.html` yoluna git. Kaynak HTML mevcut kilitli Baloo 2/Nunito font paketlerini kullanır; yeni paket eklenmez. PNG’ler font kurulumu gerektirmez.

## İşlev eşlemesi

| Ekran | Korunan alanlar ve eylemler | Sunum bileşenleri |
|---|---|---|
| child/week | Haftanın yedi günü (Pazartesi başlangıcı), task.title/icon/stars, completion.status, Bugün → replace today | NineSlice, TaskIcon, durum simgesi |
| child/calendar | Olay başlığı/türü, başlangıç-bitiş, tüm gün, konum; çocuk adı gösterilmez; geri | NineSlice, EventIcon |
| child/goal | family_rewards.title/icon/cost_stars, maliyet sırası; bir karta dokununca mevcut choose mutasyonu, pending kilidi; Vazgeç | ticket-goal, SkinPressable, ödül illüstrasyonu |
| child/collection | earned/total, badge.title/icon/earned; bir kez kutlama; kilitli rozetler; geri | Collectible, CelebrationBurst, kâğıt kart |
| child/prova/index | assigned/completed ayrımı, question_ids.length, timed/duration_minutes, in_progress → Devam, mc_correct/mc_total | SkinPressable, TaskIcon/SubjectIcon |
| child/prova/[examId] | Sayaç, q.stem, multiple_choice/open_ended, seçili şık, metin cevabı, Geri/Sonraki/Bitir, boş soru onayı ve sonuç | NineSlice, mevcut radio/TextInput semantiği, SkinPressable |
| child/pin | Tek secureTextEntry input, maxLength=4, number-pad, busy/error, Tamam/Vazgeç | kâğıt panel, mevcut Field/Button |
| child/room-preview | Karakter önizlemesi; istenen oda/dost seçim görünümleri; varsayılanlar | RoomScene, SkinPressable, ayrı karakter/hayvan katmanları |

Rozet kataloğu migration’daki dört tanımı kullanır (İlk Görev, 25 Görev, Diş Parlatan, Kitap Kurdu); resimli ikon dosyalarının sayısı rozet toplamı değildir. Boş koleksiyon maketi sıfır kazanımda kilitli kataloğu korur.

Maket veri örnekleri onaylı referanslar ve mevcut alan sözleşmeleriyle hazırlanmıştır. Canlı hesaptan çekilmiş veri veya tamamlanmış native ekran değildir. Takvim/deneme örnekleri tasarım fixture’ıdır; kullanıcı kaydına yazılmaz. Görsellerin içinde metin yok; maket PNG’sindeki Türkçe yazılar referans UI katmanıdır.

## Metin ve erişilebilirlik

`copy-map.json` mevcut i18n anahtarlarını ve onay sonrası eklenecek TR/EN önerilerini ayırır. Bu PR gerçek tr.json/en.json dosyalarını değiştirmez. Hiçbir mevcut anahtar silinmeyecek. Form/radio/disabled/live-region semantiği ve mevcut accessibilityLabel/Hint/State korunacak. Prova süresinin anonsu, mutasyonlar, realtime, routing ve yetki koduna dokunulmayacak.

## Claude için

1. Yerel demo girişinde **Database error querying schema** hatası var (`current-app-access-error.png`). Bu nedenle korunan ekranlardan gerçek karşılaştırma görüntüleri alınamadı. Auth/DB düzeltmesi bu tasarım PR’ına dahil edilmedi; veritabanı değiştirilmedi, yeniden tohumlanmadı.
2. `room-preview` şu an yerel state ile karakter önizleyen prototiptir. `useChildRoomPrefs` okuma kancası ve `set_room_pet` RPC mevcut; bu ekranda oda/karakter/hayvan kalıcı kaydı bağlı değil. Oda ve karakter için mevcut sunucu sözleşmesini doğrula; tercih okuma/kaydetme ve dönüş yönlendirmesi gereken bağlantıları Claude hazırlasın. Makette yeni bir Kaydet mutasyonu varsayılmadı; seçimler önizleme olarak etiketlendi.
3. Veli çocuk modu yalnız today ve prova alias’larını içeriyor. Week/calendar/goal/collection PIN’li cihaz rotaları child claims’e dayanıyor; çocuk modundaki yönlendirme/childId farkını tasarım işi içinde değiştirmeyeceğim. Gerekli alias/kimlik desteğini Claude ele alsın.
4. Prova soru ekranı açılırken start_exam_attempt çağırıyor. “Yalnız gezin, kayıt değiştirme” kuralı nedeniyle bu rota canlı demoda açılmadı. Soru/sonuç maketleri mevcut kod akışını izler.

## Kontrol ve onay sınırı

PNG boyutları, eksik görseller, yatay taşma ve 48 px minimum düğme yüksekliği tarayıcıda kontrol edildi. TypeScript ve Expo lint çalıştırıldı. Gerçek native cihaz / büyük yazı / sunucuya bağlı hata durumları giydirme aşamasında doğrulanacak. Onay verilmeden bu ekranların JSX/stil/i18n dosyaları değiştirilmez. Sonraki adım: Enes’in bu grubun tasarımını onaylaması; ardından gerekli sanat ve ayrı giydirme PR’ı.
