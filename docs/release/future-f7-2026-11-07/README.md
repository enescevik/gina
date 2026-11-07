# F7a — Kazanım kümesi gözlemleri

Kod hazır, DB migration henüz üretime uygulanmadı. Web/BO main push otomatik dağıtımına tabidir; yeni tablo/RPC'nin uçtan uca yayında çalıştığı iddia edilmez.

- İzole taze DB: 154 dosya, 7.121 kontrol, sıfır hata.
- Lint/typecheck/core: 7/7 görev; 772 core testi.
- Yeni SQL: tüm etiket kümesi, sıra/tekrar eşitliği, karma kazanım, kısmi puan, bekleyen/boş ayrımı, tekrarın örnek sayısını şişirmemesi, az gözlem, aile/rol/anon ve dönem/ders filtreleri.
- Ortak etiketlenen kazanımlar için soru puanı ayrı kazanım ustalığına dönüştürülmez. 5 bağımsız puanlanmış soru eşiği ürünün temkinli sunum kuralıdır, bilimsel geçerlik/teşhis iddiası değildir.
- Görsel/cihaz kabulü; AI tercih entegrasyonu ve atomik süre seçenekleri hâlâ açık.
