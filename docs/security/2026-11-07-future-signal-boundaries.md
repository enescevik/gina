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
