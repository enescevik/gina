# Odam, Hazinem ve Koleksiyonum

## İlk bakış ve etkileşim

Sol panoda en yakın bekleyen görev büyük, ikinci görev küçük. “Tüm görevler” aynı pano içinde açılır; uzun liste odayı doldurmaz. “Başla” görevin detayını açar; sayaç gerektirmeyen görevde sahte süre başlatmaz. Tamamlamanın onay koşulu açıkça söylenir. Gün özeti: onaylanan / toplam ve ayrı onay bekleyen adet. Üst bakiye harcanabilir yıldız; alt “bugün kazandım” yalnız bugünün ledger kazanımıdır.

Sağ hedef bileti tek seçili hedefi gösterir: ad, maliyet, mevcut bakiye, max(0,maliyet−bakiye), clamp(bakiye/maliyet,0,1). Sıfır maliyette oran bölmesi yapılmaz. Hedef seçilmemişse davet, katalog yoksa ebeveynin ekleyeceğini söyleyen sakin boş durum. Hedefe ulaşmak gerçek ödül teslim edildi demek değildir.

## Hazinem

Çekmece açılınca üç tür: Deneyimler (sinema, gezi), Eşyalar (bisiklet, kitap), Dijital (oyun süresi gibi ebeveyn tanımlı). Tek liste + filtre yeterli; ayrı bir sanal ev oluşturma. Hedefler/istenenler ile kazanılmış envanter ayrı görünür.

Önerilen durumlar: available→requested→approved/reserved→fulfilled; rejection/cancellation terminal veya tekrar talebe dönüş kuralları ayrıca tanımlanır. Debit zamanını tek politika yap: ebeveyn onayında reserve/debit, iptalinde idempotent refund. Bekleyen talepte bakiye tüketilmemişse UI bunu harcanmış gibi göstermez; onay anında bakiye yeniden doğrulanır. Gerçek eşya/etkinlik için teslimi ebeveyn işaretler. Çocuk kendi başına sinema rezervasyonu/satın alma yapmaz.

Sinema ödülünde gerçek bilet kodu varsa yalnız yetkili aile üyelerine gösterilir; görsele, loga, bildirim önizlemesine veya public asset'e gömülmez. Kullanılmış deneyimler tarihli hatıra olarak kalabilir. Oda raftaki üç yuvadan birine envanterin küçük simgesini koyar; yerleşim yalnız görsel tercih, yeniden yıldız harcamaz. Konsol görseli markasızdır; kullanıcının PS5 örneği otomatik marka lisansı anlamına gelmez.

## Koleksiyonum

Rozetler satın alınmaz, yıldız harcatmaz. Önerilen isimler: İlk Adım, Kitap Kurdu, Diş Parlatan, Düzen Ustası, Yardımsever, Haftanın Kahramanı. Eşikler `badge-catalog.json` içinde öneridir; ürün onayı olmadan kesin ekonomik kural sayma. Kilitli rozet hedefe kalan görevi açıklar; endişe yaratan sayaç veya arkadaş kıyası yok.

Seri: yalnız ilgili planlı günler, aile saat dilimi ve onaylı görev gerçekleşmeleri. Onay gecikmesi çocuğu cezalandırmaz; completion.due_date esas alınır. Planlanmamış gün seri bozmaz; geçmiş görev planı değişince değerlendirme tutarlı sürümlenir. Tek çocuk + rozet + eşik/sürüm unique; tekrar eden realtime event çift ödül yaratmaz. Geçmiş veriye ilk açılışta dağıtım yapılacaksa migration/backfill ayrı, dry-run ve idempotent olmalı.

“En uzun diş parlatan”ı fırçalama süresi liderliği olarak uygulama. Diş Parlatan: planlı diş bakımını düzenli tamamlayan çocuğun kişisel ilerlemesi. Görevin sağlıklı süresi ebeveynin rehberliğinde kalır; daha uzun süre için daha çok yıldız yok.

## Özel günler

Oda en altta sabit; sezon dekoru ayrı, pointerEvents=none ve ekran okuyucuya gizli. Aile kapatabilir, hareket azaltma tercihi geçerli. Görev panosu/hedef/çıkış hitbox'larının üstüne süs konmaz. Tarihler family timezone ile gün aralığı; birden fazla olayda öncelik ve tek baskın dekor.

Yeni yıl, yerel kurtuluş günü, Ramazan Bayramı aile tarafından seçilebilir. Dini tercih cinsiyet, isim, ülke veya konumdan çıkarılmaz. Ülke holiday verisi otomatik dini kişiselleştirme anlamına gelmez. Ramazan Bayramı tarihini sabit Gregoryen gün/ay yapma. Yerel kurtuluş günü için doğrulanmış şehir/tarih gerekir. Bu pakette etkinlik yapılandırma taslağı var; onaylı özel gün görsel seti henüz yok.
