# Veli değerlendirmesi — cihazda kalıcı taslak (4 Kasım 2026)

## Davranış

Puan, geri bildirim, veli çizim katmanı ve uygulanmış AI önerisinin kimliği her düzenlemede mevcut cihaz deposuna yazılır. Veli/aile/Prova denemesi/soru kapsamları ayrıdır. Taslak sunucuya kendiliğinden gönderilmez ve çocuğa görünmez; mevcut Kaydet eylemi paylaşır. Hesaptan çıkış yerel kayıtları temizler; başka hesaba erişim vermez. Farklı cihazlar arasında taslak eşitlemesi değildir.

Kayıt isteği ağ çağrısından önce aynı depoda sabitlenir. Sonucu belirsiz istek yeniden açılınca özgün işlem kimliği, revizyon, cevap imzası, puan, not, çizim ve AI kimliğiyle tekrar edilir. Yeni işlem oluşturulmaz. Sunucu makbuzu doğrulanıp yerel kayıt temizlenmeden işlem tamamlandı sayılmaz. Kesin hata taslağı korur; başka değerlendirme/cevap sürümü üzerine otomatik taşıma yoktur.

Eski taslak görünür ancak kayıt engellenir. “Güncel değerlendirmeyi aç” ikinci bir silme onayıyla yalnız bu yerel taslağı kaldırır ve sunucuyu yeniden okur. Bekleyen isteğin sonucu belirsizken bu silme yolu açılmaz. “Taslağı sakla ve çık” cihazdaki kaydı korur; “Taslağı sil ve çık” açık vazgeçmedir. Sonucu belirsiz istekte bu çıkış seçenekleri kullanılmaz.

## Doğrulama

- 218 çekirdek testi (12 yeni), 19 ilgili Node kontrolü, mobil/core tip ve mobil lint geçti.
- Çekirdek: yeniden açılış, aynı makbuz, eski revizyonu koruma, kesin hata sonrası yeni istek, depolama hatası, onay temizliği hatası, eski sekme/geç yanıt koruması, dört ayrı kapsam, bozuk sürüm, eksik/geçersiz puan, şıklı soru, geçersiz makbuz ve belirsiz isteği silmeme testleri.
- Gerçek Expo web bileşenleri, sentetik ağ: telefon 390×844 ve tablet 1280×800.
- Puan 90 ve yazılı geri bildirim yeniden yüklemede geri geldi. Veli kalemiyle çizilen not da geri geldi.
- İlk kayıtta yanıt kaybettirildi: yeniden açıldıktan sonra iki çağrının bütün alanları aynıydı; bir sunucu makbuzu/tek revizyon ve sıfır bekleyen yerel kayıtla tamamlandı.
- Ayrı bir senaryoda eski sekme tamamen kapatılıp aynı tarayıcı bağlamında yeni sekme açıldı: 95 puan ve not geri geldi. Önceki uygulama belleği kullanılmadı.
- Başka veli revizyonu taklit edildi: eski not korundu, kayıt engellendi; iki adımlı vazgeçme güncel notu açtı, ek kayıt isteği göndermedi.
- Cihaz deposu hata verdiğinde not ekranda kaldı, sunucuya gönderme kapandı; depolama düzelince yeniden deneme aynı notu cihazda sakladı.
- “Taslağı sakla ve çık” sonrası aynı not geri geldi; “Taslağı sil ve çık” sonrası yerel kayıt temizlendi.
- Tarayıcı çalışma zamanı hatası görülmedi. Yerel geliştirme sunucusunun yeniden derlemesinde zaman aşımı olan gezinmeler tekrarlanarak kontrol edildi; bunlar başarılı kabul sayılmadı.

`qa-fixture.cjs` yalnız sahte oturum/REST yanıtları içerir; gerçek Supabase veya AI çağrısı yapmaz. Ekranlar: `restored-phone.png`, `restored-tablet.png`, `pending-tablet.png`, `stale-tablet.png`, `leave-options-phone.png`, `leave-options-tablet.png`. Onaylı tasarım korundu; yalnız durum açıklamaları ve güvenli kurtarma eylemi eklendi.

## Sınırlar

Fiziksel iPhone/iPad/Android üzerinde işletim sistemi kapanışı, disk doluluğu ve Pencil kabulü ayrıca yapılmalı. Cihazdan kaldırılan uygulama, temizlenen tarayıcı deposu veya çıkış yapılan hesap için taslağın kalacağı söylenmez. Taslaklar cihazda saklanır, bulut yedeği değildir.

Migration, gerçek aile/demo kaydı, üretim ve TestFlight 0.1.0 (17) değişmedi. Kütüphane 100 taslakla bekler; yeni üretim en sonda.
