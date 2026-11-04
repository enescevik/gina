# Prova cevap ve değerlendirme kurtarma denetimi — 4 Kasım 2026

## Düzeltilenler

- Cevap okuması kayıt yanıtından önce başlamışsa, gecikmiş eski sonuç artık daha yeni cevap revizyonunu ezmez. Sunucudaki daha yeni revizyonlar hâlâ alınır.
- Kaydedilen yerel taslak yalnız aynı içerik onaylandığında bırakılır. Gönderim sırasında yapılan yeni seçim/yazı/çizim korunur; eski onay daha yeni taslağı silmez.
- Veli değerlendirmesinin cevap/revizyon görüntüsü bağlantı veya uygulama odağı geri geldiğinde kendiliğinden yenilenmez. Ekran yeniden açıldığında güncel görüntü alınır. Sunucu revizyon ve cevap imzası denetimi korunur; başka velinin değişikliği sessizce ezilmez.
- Puan alanındaki “/ 100” telefon ve tablet genişliklerinde tek satırda kalır. Onaylı yerleşim, maskot ve renkler değiştirilmedi.

## Kontrol

Gerçek Expo web bileşenleri, `qa-fixture.cjs` ile yalnız sentetik REST yanıtları kullanılarak çalıştırıldı. Gerçek aile verisi, Supabase veya AI hizmetine istek gönderilmedi.

1. Şıklı cevap A kaydedildi, yanıtı kasıtlı kaybettirildi.
2. Bağlantı kapalıyken deftere `6 + 8 + 10 = 24 cm` yazısı eklendi.
3. Sayfa yeniden açıldı: iki yerel cevap geri geldi.
4. Bağlantı geri geldi: aynı iki işlem kimliği tekrar kullanıldı; iki cevap da birinci revizyonda kaldı; yerel bekleyen kayıtlar temizlendi.
5. Prova bitirildi ve doğru şık sonucu gösterildi.
6. Veli defterdeki cevabı gördü, 90 puan ve geri bildirim girdi. Offline/online/focus olaylarında taslak ve puan korundu, cevap/revizyon okuması tekrarlanmadı.
7. Veli kaydı doğru puan/geri bildirim/cevap imzasıyla gönderildi. Çocuk sonuç ekranı yeniden açıldığında geri bildirim görüldü.
8. İkinci bir oturumun daha yeni değerlendirmesi taklit edildi. Eski revizyonla gönderim reddedildi, yazılan taslak ekranda kaldı.
9. Telefon 390×844 ve tablet 1280×800 incelendi. Tarayıcı çalışma zamanı hatası yok.

`check-answer-recovery.test.mjs`: iki eski davranışın yeniden üretimi ve dört düzeltme testi; gerçek TanStack QueryClient/QueryObserver kullanır. Mevcut kalıcı cevap günlüğü ve sıra testleri de core testleri içindedir.

## Görüntüler

- `pending-phone.png`: çevrimdışı, yerelde saklı defter cevabı.
- `recovered-tablet.png`: yeniden açılış/bağlantı sonrası aynı defter cevabı.
- `review-phone.png`, `review-tablet.png`: puan ve geri bildirim; düzeltilmiş puan yerleşimi.
- `child-feedback-phone.png`: kaydedilmiş veli geri bildirimi.

## Açık sınırlar

Bu, sentetik web akış kabulüdür; gerçek sunucu/cihaz uçtan uca kabulü değildir. Fiziksel iPad/iPhone, Pencil/klavye, işletim sistemi tarafından uygulamanın kapatılması ve canlı ağ davranışı ayrıca doğrulanmalı. Veli henüz kaydetmediği değerlendirmeyi uygulama tamamen kapatılırsa kalıcı olarak geri getirme bu değişiklikte eklenmedi; bu kontrol açık. Hazırlama/atanmış Prova sürümlerinin tam canlı kabulü de açık.

Migration veya sunucu iş kuralı değişmedi. Üretim ve TestFlight 0.1.0 (17) değiştirilmedi. Kütüphane üretimi sona bırakıldı; 100 taslak korundu.
