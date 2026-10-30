# Güncel uygulama durumu ve devam planı

30 Ekim 2026, incelenen main `3d81e4b`. Önceki 5d20850/bb390aa analizi tarihsel kaldı; eksik diye listelenen birçok özellik artık mevcut. Güncel main ve DECISIONS kaynak kabul edilir.

- Odam prototipi, Hazinem/Koleksiyonum, gerçek hedef bileti, üç sergi yuvası ve resimli v3 Collectible bileşeni var.
- `20261030060000_rewards.sql` ödül kataloğu, hedef, talep, envanter, oda tercihi ve rozet tablolarını/RPC’lerini kuruyor. Aynı modeli tekrar oluşturma.
- `20261030070000_badge_icons_v3.sql` Diş Parlatan görselini yeni varlığa eşliyor. Rozet kazanma eşiği görsel değişimiyle değiştirilmez.
- Yan Yana platform kaynakları, Baloo 2/Nunito, görev yeniden gönderme ve saat dilimi geliştirmeleri main’de. Eski “logo bağlanmadı / returned yok / lockfile bloke” ifadeleri güncel görev listesi değildir.
- Haftam, Prova, AI ve mevcut abonelik/auth/PIN akışları korunur.

## Şimdiki iş

`CLAUDE-PROMPT.md` yeni kaynak yollarını ve sırayı tanımlar. Görev/ders/etkinlik resimlerini mevcut statik slug eşlemelerine bağla; oyunlaştırma entegrasyonunu doğrula. Native küçük ikonlar ile büyük koleksiyon görsellerinin kullanımını ayır. Mobil boyut türetimini mevcut script üzerinden genişlet; ham yüksek çözünürlükleri tüm listeye yükleme.

Önce iki ana ekran: gerçek veriler, telefon/tablet, büyük yazı, uzun metin, loading/empty/error/offline ve pending/approved/returned durumları. Kullanıcı ana ekranları gördükten sonra alt ekran sanat turu. Oda ve karakter art-candidates hâlâ adaydır.

## Korunacak sözleşmeler

Çocuk JWT kimliği ve ebeveyn child-mode PIN kontrolü, aile sınırı, RLS, realtime/logout cache temizliği ve plan yetkileri korunmalı. complete_task/review_task ve ödül RPC’lerinin ledger/idempotency garantileri istemciye taşınamaz. Ağ tekrarı aynı client_id’yi kullanır; istemci harcanabilir yıldız veya rozet yaratamaz. Aile saat dilimi ve onay gecikmesini testle koru. Deployed migration’ı geçmişten düzenlemek yerine gerçekten gereken değişiklik için yeni migration kullan.

Asset PR’larında lint/typecheck/test ve Supabase migration+pgTAP CI sonuçlarını DELIVERY.md üzerinden izle. Görsel teslim, cihaz üzerinde uygulama kabul testi yapıldığı anlamına gelmez.
