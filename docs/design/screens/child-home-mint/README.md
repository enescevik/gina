# Çocuk ana ekranı — onaylı mint oda

2026-11-01: Kullanıcının son onayladığı görsel üzerinden çocuk ana ekranı uygulandı. Kaynak: https://chatgpt.com/share/6ae626eb-3f48-83ed-a90f-1e0eb0508c0e içindeki **Tablet corner seam correction**. Orijinal görsel `packages/assets/rooms/mint-home/approved-board.png` içinde, değiştirilmeden saklanıyor.

## Uygulama

- `/child/today` ve `/parent/child-mode/today` aynı ekranı kullanır. Yalnız bu ana ekranlarda dikey/yatay yön serbest; diğer sayfaların görünümü değiştirilmedi.
- Oda, onaylı resimdeki illüstrasyon bölgesinin native görünüm içinde kadrajlanmasıdır. Cihaz çerçeveleri ve referanstaki arayüz görünümün dışında tutulur. Logo mevcut onaylı marka varlığından gelir.
- Metinler, butonlar, günlük durumlar, hedef ve gezinme gerçek React Native bileşenleridir. Telefon dikeyde kaydırılabilir akış, tablet yatayda oda + sağ panel ve tam genişlikte alt menü kullanır. Büyük yazıda tek sütuna geçilir.
- Görev defteri, mor kapı ve kitaplıktaki kupa alanları mevcut işlemlere açılır. Başla görevi açar; Yaptım mevcut complete_task işlemini çağırır. Aynı görevi tekrar göndermemek için işlem, sorgunun yenilenmesine kadar meşgul kalır.
- Tamamlandı = approved, onayda = done, sırada = null/returned. Dönen görev önce gösterilir. Kaydı bulunmayan süre veya devam durumu uydurulmaz.
- Hedef hâlen gerçek yıldız bakiyesi / cost_stars üzerinden çalışır. Referanstaki ayrı aile adımları veri modeline eklenmedi.
- Ebeveyn telefonundaki çocuk modundan çıkış mevcut veli PIN doğrulamasını korur. Eşlenmiş çocuk cihazında mevcut child_logout kullanılır.
- Haftalık görünüm, takvim, Prova, koleksiyon, hedef ve oda düzenleme bağlantıları korundu. Bu alt sayfalar henüz yeni tasarıma taşınmadı.

## Bilinçli sınırlar

Bu aşama resim temellidir: maskot sabit; oda düzenleme tercihleri, evcil hayvan seçimi, canlı hava ve eşya konumları bu yeni oda resmine henüz yansımaz. Eski kayıtlar silinmez. Dünyam ana odaya döner; dünya haritası eklenmedi. Kaynak pano 1536×1024, kullanılabilir oda bölgesi 726×638 pikseldir; yüksek çözünürlüklü ayrı sahne gelince aynı görünüm kaynağı değiştirilebilir. Geniş ekranlarda kadraj değişir; görüntü esnetilmez.

## Görüntüler

- phone.png: 430×932 telefon
- tablet.png: 1280×800 tablet
- tablet-4x3.png: 1024×768 tablet
- small-phone.png: 320×844
- phone-landscape.png: 932×430
- task.png: görev açma
- empty.png, loading.png, error.png: durumlar

Bunlar gerçek Expo web üretim çıktısının ekran görüntüleridir; tasarım maketi değildir. HTTP ve realtime yanıtları izole test verileriyle karşılandı; gerçek veritabanı değiştirilmedi. Fiziksel iPhone/iPad/Android testi veya TestFlight yayını yapılmadı.

## Kontroller

`apps/mobile` içinde `pnpm exec tsc --noEmit`, `pnpm exec expo lint` ve web üretim export'u geçti.

`verify.cjs` Playwright ile 17 kontrolü geçti: yatay taşma, Başla'nın veri yazmaması, işlem hatası ve görevi yeniden açarak kurtarma, tamamlamanın onaya düşmesi, veli PIN gerekliliği, yanlış PIN'de kilit, dar telefon, beş gezinme hedefi, hata sonrası yeniden deneme, yatay telefon, eşlenmiş cihaz rotası ve kimliğiyle tamamlama. Yakalanmamış tarayıcı hatası, eksik resim veya 48 dp altında ölçülen işlem hedefi yok.

Dal: codex/child-home-mint. Ebeveyn ana ekranı çalışmasının üzerine kuruldu; bu teslim başka bir ekran tasarımı içermez.
