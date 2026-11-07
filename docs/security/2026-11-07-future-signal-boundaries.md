# F1 — ebeveyn soru beğenisi sınırları

7 Kasım 2026. Yeni özellik incelemesi; üretimde istismar veya genel “açık yok” iddiası değildir.

- Aile ve parent_user_id istemciden geldiği için güvenilir kabul edilmez: RLS canlı aile üyeliği + auth.uid() ve sorunun aile sahipliğini doğrular.
- Çocuk oturumu ebeveyn tercihini göremez/yazamaz. Başka veli kullanıcı kimliğini gönderemez. Global/kütüphane sorusu ancak aileye edinilmiş kopyası üzerinden beğenilir; katalog erişimi açılmaz.
- İstemci oluşturma tarihini değiştirerek sıralamayı yönlendiremez; kolon bazlı INSERT, UPDATE yok. Beğeni kaldırılabilir; soru/aile/kullanıcı silme CASCADE.
- Tekil anahtar + ON CONFLICT DO NOTHING yinelenen kaydı engeller. Beğeni puan, AI çağrısı veya otomatik görev üretmez.
- Olumsuz testler: `supabase/tests/145_question_reactions.test.sql` (yabancı soru/aile, sahte veli, tarih yazımı, çocuk yazımı, anon erişimi ve yabancı silmenin etkisizliği). İzole taze DB; uygulama/demo verisi değişmedi.

## §6.1 sürekli kural

Bulunan her güvenlik açığı aynı teslimde düzeltme, açığı tekrar üreten olumsuz test ve tarihli kayıt gerektirir. Tekrarlanan açık sınıfı genel CI kuralına dönüştürülür. Eksik testle bulgu kapatılamaz. F5'te bütün migration'lara genellenmiş otomatik denetim ve engelleyici sır taraması eklenecektir.

## F1-INITPLAN — CI regresyonu ve kalıcı kontrol

Yeni beğeni politikaları aile sınırını korudu ancak mevcut InitPlan performans kuralını ihlal etti. Main CI `100_q02_fixes_rls_initplan`, `106_calendar_archived_events` ve `119_c13_authz_hardening` ile reddetti. Uygulanmış olabilecek migration değiştirilmedi; `20261107160500_question_reaction_initplan.sql` yardımcıları skaler SELECT'e alır. Politika envanteri yeni 3 beğeni + 1 çocuk sinyali politikasıyla açıkça güncellendi; çıplak çağrıya izin veren test istisnası eklenmedi. Sonraki push öncesinde bütün taze DB regresyonu **144 dosya, 6.939 kontrol, 0 hata** çalıştırıldı.

F2a: çocuk sinyali yalnız atanmış denemedeki soruya yazılır; kardeş denemesi, yabancı soru/aile, bilinmeyen alan, anon erişimi reddedilir. `146_question_child_signals.test.sql`: 17 kontrol; aynı beyanı tekrar gönderme tek satırdır; bir beyanı değiştirmek diğerini silmez, puan değişmez.

## F2b — sınıf, süre ve bozuk etiket sınırları

`147_question_focus.test.sql`: yabancı çocuk/soru, farklı sınıf, doğrudan süre yazımı, çocuk/anon RPC ve bozuk JSON etiket olumsuz testleri. Bozuk `outcome_ids` öneri ekranını çökertebileceği için JSON türü kontrollü uzunluk ölçümü kullanıldı; bilinmeyen etiket eşleşme üretmez. Pozitif testler süreli tercih/geri alma, tekil tekrar, öneri sessizliği ve orijinal sorunun sona gelmesini kapsar. Güncel taze regresyon 145 dosyada 6.962 kontrol, 0 hata. Gerçek sağlayıcı çağrısı yapılmadı.

## F3 — kayıtlı çözüm ve yerel okuma

`148_child_solution.test.sql`: aktif/gönderilmiş denemede çözüm yok, kardeş/ilgisiz soru/sahte aile/anon reddi; iki alanlı projeksiyon. `149_question_reading.test.sql`: çocuk tercih değiştiremez, deneme override genel tercihten önce gelir, sahte aile ve anon reddedilir. `question-reading.test.ts`: uzak web sesi, eksik yerellik bilgisi, dil uyuşmazlığı ve Android ağ özelliği belirsizliği reddedilir. Çözüme veya okumaya canlı AI bağlanmadı; mikrofon ve ses kaydı yok. Yerel okuma yeni native modül içerir; cihaz/sürüm/offline kabulü henüz yok.

## F4 — soru bildirimi

`150_question_reports.test.sql` 22 kontrol: request replay/çatışma, kardeş/ilgisiz soru, serbest neden reddi, doğrudan INSERT engeli, yarışa dayanıklı kullanıcı kilidi + oran sınırı, eski isteği sınır tüketmeden yeniden deneme, yetkisiz moderasyon ve tek audit. Paylaşılan tablette aktif çocuk değişince önceki kardeş raporu okunamaz/replay edilemez. Yönetici yalnız bildirilen içerik kökü ve nedeni görür; çocuk cevabı/çizimi bu yüzeye kopyalanmaz. Tam regresyon 7.010 kontrol, 0 hata.

## F5 — kalıcı güvenlik kontrolleri

- Sızıntı taramasında bütün dosyayı kapsayan yüksek önem istisnası yeni anahtarı saklayabilirdi: tam satır hash'ine daraltıldı. `.env.example` içeriğini atlama ve symlink döngüsü de kaldırıldı; `scripts/security/leak-scan.test.mjs` 8 vaka. CI taramayı artık engelleyici çalıştırır; gerçek anahtar değeri rapora yazılmaz.
- İç uygulama tablolarında istemci grant'i olmasa da RLS koruması tamamlandı. `151_schema_security_guard.test.sql`: 9 katalog bulgusu/karşı örnek. İstemci helper'ı çağıramaz.
- Veli telefonundaki çocuk PIN'i kilit bitiminden sonra sayacı sıfır pencereye almıyordu; sayacın büyümesi ve her hatada yeniden kilitlenmesi giderildi. `152_child_pin_window.test.sql` 13 vaka: kalıcı başarısızlık sayacı, kilidi doğru PIN'le aşamama, süre bitimi, uzun/biçimsiz giriş, başarıyla toparlanma ve aile sınırı.
- Prompt sistem güven sınırı ve veri etiketi v12/v8; şema değişmedi, açıklanan istem değişikliği nedeniyle golden prompt hash/sürüm kanıtı güncellendi. 30 TR/EN veri sınırı örneği ve kaynak ref ihlali. Canlı model saldırı kabulü yapılmış gibi gösterilmez.

Son taze regresyon 151 dosyada 7.032 kontrol; Edge ilgili 130 test, Node 117 test temiz. Canlı Auth limitleri yalnız sayısal ayarlarla raporlandı; SMTP/anahtar değerleri alınan rapora yazılmadı.

## CodeQL ilk bulgu takibi

Analiz başarılı olsa da 205 uyarı açıktır; güvenlik kabulü kapatılmadı. `curriculum-source` ardışık entity çözümü `&amp;lt;` değerini iki kez yorumluyordu; tek geçişli çözüm ve nested-entity regresyonu eklendi. `meb-extract` geçersiz sayı tanısında ters eğik çizgi/satır sonu kaçışı eksikti; tek satır güvenli tanı ve olumsuz test eklendi. Bunlar tek başına XSS istismarı kanıtı değildir: kaynak metin veri olarak işlenir. Kalan core ReDoS/kitapçık ve yerel betik uyarılarının triyajı açıktır, hiçbiri topluca bastırılmadı.

### Uzun girdi / düzenli ifade regresyonu

CodeQL core işaretleri sonrasında boşluk işaretleri üç çağrı yerinde tek geçişli tarayıcıya taşındı; 1.500 üretilmiş bozuk/geçerli metin örneği eski ayrıştırıcıyla birebir karşılaştırılır. 200.000 kapanmamış açıcı, 100.000 haneli anlamsız ölçü, uzun hatalı saat/e-posta/rubrik için olumsuz testler eklendi. E-posta uzunluğu regex öncesi denetlenir, saat/rubrik girişi hesaplama öncesi sınırlanır, cümle sonu noktalaması sondan doğrusal taranır. Defter değerinde sayının ortasından yeniden başlanmaz; uzun sayıdan kırpılmış ölçü uydurulmaz. Root 7/7 kontrol, 768 core testi geçti. Kitapçık HTML uyarıları için mevcut script/URL kaçış olumsuz testleri var; uyarılar test geçmesiyle otomatik kapatılmadı, HTML veri akışı incelemesi açık.
