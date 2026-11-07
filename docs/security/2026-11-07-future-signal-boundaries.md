# F1 — ebeveyn soru beğenisi sınırları

7 Kasım 2026. Yeni özellik incelemesi; üretimde istismar veya genel “açık yok” iddiası değildir.

- Aile ve parent_user_id istemciden geldiği için güvenilir kabul edilmez: RLS canlı aile üyeliği + auth.uid() ve sorunun aile sahipliğini doğrular.
- Çocuk oturumu ebeveyn tercihini göremez/yazamaz. Başka veli kullanıcı kimliğini gönderemez. Global/kütüphane sorusu ancak aileye edinilmiş kopyası üzerinden beğenilir; katalog erişimi açılmaz.
- İstemci oluşturma tarihini değiştirerek sıralamayı yönlendiremez; kolon bazlı INSERT, UPDATE yok. Beğeni kaldırılabilir; soru/aile/kullanıcı silme CASCADE.
- Tekil anahtar + ON CONFLICT DO NOTHING yinelenen kaydı engeller. Beğeni puan, AI çağrısı veya otomatik görev üretmez.
- Olumsuz testler: `supabase/tests/145_question_reactions.test.sql` (yabancı soru/aile, sahte veli, tarih yazımı, çocuk yazımı, anon erişimi ve yabancı silmenin etkisizliği). İzole taze DB; uygulama/demo verisi değişmedi.

## §6.1 sürekli kural

Bulunan her güvenlik açığı aynı teslimde düzeltme, açığı tekrar üreten olumsuz test ve tarihli kayıt gerektirir. Tekrarlanan açık sınıfı genel CI kuralına dönüştürülür. Eksik testle bulgu kapatılamaz. F5'te bütün migration'lara genellenmiş otomatik denetim ve engelleyici sır taraması eklenecektir.
