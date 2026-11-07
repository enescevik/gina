# Favori kitapçığı ve eski şema uyumu

- 12 gerçek web kontrolü: [sonuç](ui-checks.json), [telefon/tablet](screenshots/). Sentetik, loopback, taze ayrı DB; üretim veya demo verisi değiştirilmedi.
- Yazdırma çerçevesinde ortak metin korundu, öğrenci nüshasında beklenen cevap ve cevap anahtarı bulunmadı. Native PDF/yazıcı testi açık.
- Eski sunucunun PGRST202 yanıtı simüle edildi; desteklenmeyen favori işlemleri görünmedi.
- Taze DB 155 dosya, 7.123 kontrol; 772 core ve lint/typecheck geçti.
- Canlı ledger yalnız okundu: `20261107180500`; F1–F8 migration'ları bekliyor. Bu kayıt bir üretim dağıtımı değildir.
