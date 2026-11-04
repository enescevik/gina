# Gerçek AI: yeni özellik içerik kabulü

4 Kasım 2026. Üretimdeki mevcut Anthropic bağlantısı ile dört sabit sentetik örnek üretildi. Hiçbir gerçek çocuk, aile veya belge gönderilmedi; aile kayıtları, plan hakları ve özellik anahtarları değiştirilmedi. Yalnız operatöre açık `ai-preflight` denetim işlevi güncellendi. Geçici erişim anahtarı 15 dakika ile sınırlıydı ve işlem sonunda kaldırıldı.

- Haftalık özet: gerçek SQL girdisinin aynı biçiminde anonim iki çocuk; onaylı/bekleyen görev ayrımı doğru, kaydı olmayan çocukta zorluk/başarısızlık iddiası yok.
- Çalışma belgesi: PNG içindeki iki iş ayrıldı; belirsiz Cuma için tarih/saat null kaldı; 12 Kasım 2026 16:30 kursu doğru alındı.
- Belgeden görev: yalnız kitap okuma ve koşullu bitki sulama; sıklık/süre uydurulmadı.
- Belgeden ödül: yalnız park yürüyüşü ve birlikte hikâye; alışkanlıklar ödüle dönüştürülmedi.

`verification.json` gerçek çıktıları ve sağlayıcının döndürdüğü token sayılarını içerir. Dört ücretli çağrı yapıldı, otomatik tekrar yapılmadı. Model `claude-sonnet-5-5`. Bunlar ürünün güncel prompt, şema ve doğrulayıcılarıdır; setup prompt'u değişmeden ortak modüle alındı. İstemci key/prompt/model/kaynak veremez.

Yeniden çalıştırma: `python3 scripts/check-ai-connection.py --project-ref wixjxlxgyhgdacadsawo --feature-smoke`. Yalnız açık operatör çalıştırması ücretli çağrı yapar. Normal CI sağlayıcıya ulaşmaz. İlgili 34 Edge testi ve yedi workspace lint/tip/test işi geçti.

## Sınırlar

Bu, yeni ürün uç noktalarının üretimde uçtan uca kabulü değildir: makbuz/kota/kayıt/yeniden açılışın sunucu ve arayüz testleri ayrı kayıtlardadır. Ürün migration'ları ve yeni mobil sürüm dağıtılmadı. Gerçek cihaz, görev/ödül/çalışma planını uygulamada kaydetme, yeni haftalık özeti yeniden açma ve görsel kontrol hâlâ gerekir. Bu dört örnek tüm eğitim içeriklerinin doğruluğunu garanti etmez.
