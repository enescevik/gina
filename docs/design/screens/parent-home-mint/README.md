# Onaylanan ebeveyn ana ekranı — uygulama kanıtı

Yalnız `/parent` ana ekranı yeniden giydirildi. Referans `approved.png`; marka: kullanıcının onayladığı mint/mor Büyüyen Dost ve peluş kitap okuma karakteri. Diğer ekranlar, global tema, uygulama simgesi/splash ve mağaza sürümü değiştirilmedi.

## Görüntüler

- `phone.png`: 430 × 932, telefon ilk görünüm.
- `phone-more.png`: aynı telefon ekranının kaydırılan alt kısmı (hedef, görevler ve Prova).
- `tablet.png`: 1280 × 800, tablet/geniş ekran.
- `small-phone.png`: 320 × 844 dar ekran kontrolü.
- `empty-phone.png`, `loading-phone.png`, `error-phone.png`: çocuk yok, yükleniyor ve hata durumları.

Bunlar üretim Expo web çıktısının gerçek ekran görüntüleridir; yapay görsel veya bağımsız HTML maketi değildir. Tutarlı karşılaştırma için HTTP yanıtları ayrı test verileriyle karşılandı; gerçek veritabanında hiçbir kayıt değiştirilmedi. Fiziksel iOS/Android veya TestFlight testi yapıldığı anlamına gelmez.

## Davranış

- Çocuk seçimi onayları, görevleri, etkinlikleri, haftalık özeti ve hedefleri filtreler. Tüm çocuklar görünümü ayrı yıldız bakiyelerini korur.
- Görev onay/geri gönderme aynı `review_task` RPC'sini kullanır; işlem bitince onay listesi, görev durumları ve yıldız bakiyesi yenilenir.
- Hedef mevcut `useChildGoal` üzerinden gelir; bakiye gerçek yıldız olaylarından hesaplanır. Hedefi olmayan çocuk için açıklama gösterilir.
- Maketteki örnek Prova tarihi veriye yazılmaz. Tarih ancak bu haftaki gerçek takvim sınavından alınır; yoksa mevcut Prova bölümüne erişim sunulur.
- Görevlerde `done` ve `approved` mevcut iş kuralına göre tamamlanma sayısına dahildir; bekleyen onay ayrı durum olarak gösterilir.
- Metinler TR/EN ortak çeviri kaynaklarında. Gövde ve başlıklarda mevcut Nunito ailesi kullanılır; yeni font paketi eklenmedi.
- Geniş ekranda yan menü ve iki sütun; telefonda sabit alt gezinme, kaydırılabilir içerik. Büyük sistem yazısında tek sütuna geçilir.
- Eski notlar, puanlar, paylaşım ve gelişim erişimleri alt bölümde korunur. Yeni ekran tasarımı yapılmadı.

## Doğrulama

- `cd apps/mobile && pnpm exec tsc --noEmit`: geçti.
- `cd apps/mobile && pnpm exec expo lint`: geçti.
- `expo export --platform web`: geçti.
- `verify.cjs`: üretim web çıktısında 13 kontrol; çocuk filtresi, onay, geri gönderme, işlem hatası, hata sonrası yeniden deneme ve altı gezinme hedefi geçti.
- 320 px ve tablet yatay taşma yok; dar ekranda 48 dp altı işlem hedefi yok; eksik görsel ve yakalanmamış tarayıcı hatası yok.
- Test girişleri gerçek oturum değildir; HTTP ve realtime izole edilmiştir. Test dosyasını Playwright `browser_run_code_unsafe` ile, çıktı `http://localhost:8081` üzerinde servis edilirken çalıştırın.

Geliştirme Metro sürecinin bellek sınırına takılması üzerine son kontrol ve görüntüler statik üretim çıktısında alındı. Uygulama kodunda bu nedenle başka ekran veya sunucu değişikliği yapılmadı.
