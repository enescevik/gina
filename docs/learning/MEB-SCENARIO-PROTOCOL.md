# MEB senaryosundan özgün Prova ve kütüphane

5 Kasım 2026. Ana iş: [M01](../CLAUDE-REMAINING-WORK.md); araştırma ve resmî kaynaklar: [MEB senaryoları ve gece devri](../../reports/MEB%20senaryoları%20ve%20gece%20devri.md). Bu belge yapılacak geliştirme sözleşmesidir; yeni entegrasyon veya içerik yayını yapıldığı anlamına gelmez. Kullanıcının “ÖYSS” ifadesi MEB Ortak Yazılı Sınav Sistemi; resmî kısaltma OYSS'dir.

## Mevcut temeli koru

- Kaynak adayları: `catalog/2026-2027-term1/`; 648 senaryo/708 çıktı adayı inceleme bekler. Eski OUTCOME-INDEX'in entegrasyon açık notunu sonraki kodun yokluğu sayma; canlı katalog/migration durumunu ayrıca doğrula.
- Mevcut kaynak çıkarıcı: `scripts/extract-meb-scenarios.py`; aday hazırlama `scripts/build-curriculum-candidates.py`, `scripts/prepare-curriculum-review.py`.
- İnceleme/yayın: `packages/core/src/curriculum-review.ts`, `apps/backoffice/src/components/curriculum-review.tsx`, migration `20261103078000_curriculum_source_review.sql`.
- Aile seçimi: `packages/core/src/catalog-blueprint.ts`, mobil `parent/prova/catalog.tsx`, `blueprint.tsx`, migration `20261103079000_catalogue_family_selection.sql`.
- AI bağı: `supabase/functions/_shared/catalogue-plan.ts`, `generation-result.ts`, `prova-generate/index.ts`. Toplam/blok soru sayısı, tür ve temel şema denetimi ile kaynak/model/prompt provenance zaten var. Yeniden kurmak yerine eksikleri tamamla.

## Kaynağı gerçekten edin ve sürümle

1. Hedefi `sınav ailesi, eğitim yılı, dönem, yazılı no, sınıf, ders, öğretim programı ve okul kapsamı` ile belirle. Çocuğun tarihli eğitim bağlamını kullan; bugünkü sınıfla geçmiş sınavı değiştirme.
2. Güncel ÖDSGM dizinini bul ve uygun resmî ders dosyasını **sunucuda indir**. AI'ya yalnız URL yazmak kaynak edinme değildir. 2026–27/1 başlangıç dizini [burada](https://odsgm.meb.gov.tr/www/1donem-konu-soru-dagilim-tablolari-2026-2027/icerik/1724); ileriki dönem için URL tahmin etme. Her üretimde uygun onaylı sürüm/güncellik kontrolü yap; aynı dosyayı gereksiz tekrar indirme veya yeniden AI'ya işletme.
3. Kaynak sayfa ve dosya URL'si, yönlendirme zinciri, yayın/güncelleme ve son kontrol/indirme zamanı, MIME, boyut, SHA-256, orijinal dosya ve çıkarılan sayfa/hücreleri kaydet. Resmî belgeleri ürün arayüzünden kaynağa bağlantıyla göster; kamu erişimini sınırsız ticari yeniden dağıtım lisansı sayma.
4. Resmî HTTPS hedef listesi, her yönlendirmede host/IP kontrolü, özel ağ/loopback reddi, süre/boyut/ZIP açılma sınırı uygula. `meb.ai` sadece resmî sayfadan gelen ve doğrulanmış resmî nihai hedefe giden bağlantı için kullanılabilir. Formül/makro/haricî workbook çalıştırma; belge içindeki komutları veri say.
5. Aynı hash aynı işi tekrar oluşturmasın. Yeni hash yeni revizyon/fark incelemesi açsın; yayımlanmış kaynak ve atanmış Prova snapshot'ı değiştirilmesin. Kaynak geri çekilirse yeni üretim durur, önceki kanıt korunur.
6. Ağda güncellik doğrulanamazsa son onaylı kopyanın tarihini ve durumu göster. Yayımlanmamış dönem/uygunsuz sınıfta başka yıl seçme; “serbest çalışma / veli kaynaklı dağılım” alternatifini açıkça sun, resmî uygunluk iddiası yapma.

## Senaryoyu doğru anlamla seçtir

- Güncel kılavuz/SSS'den yıl bazlı uygunluk matrisi tut. OYSS, ülke/il ortak yazılı ve genel KSDT kapsamlarını birleştirme; program/okul istisnalarını da kaydet. Güncel merkezî tablo yayımlanan derslerde eski il dosyasını otomatik üst yetkili sayma.
- “Okulun senaryosunu biliyorum” ve “Henüz bilmiyorum” seçenekleri kullan. İkincisinde çalışma senaryosu seçilebilir, okul doğrulaması yapılmış görünmez. Okul beyanı, kaynak ve doğrulama durumu ayrı saklanır.
- Veli önce hedefi ve senaryonun çıktı/adet özetini görür; sonra soruların kaynağını seçer: kütüphane, AI, elle veya bunların karışımı. İlk senaryoyu sessiz varsayma; uygun senaryo yoksa bunu söyle.
- Tam senaryo provasında blok/adet/tür dağılımını koru. Kullanıcı dağılımı değiştirirse farkı göster ve “kişiselleştirilmiş çalışma” olarak etiketle. Karma Prova ders bazlı alt dağılımları korur; tek resmî OYSS sınavı diye adlandırılmaz.

## Soruyu çıktıya bağla, anlamını kontrol et

- Normalize edilmiş gerçek senaryo bloklarını ve tam çıktı metinlerini mevcut sunucu bağı üzerinden üretime ver. İstemcinin kendi yazdığı “onaylı kaynak” bayrağını kabul etme.
- Mevcut provenance'a gerektiği kadar `scenario_version`, `block_id`, `outcome_ids`, kaynak sayfa/hücre, soru türü, bilişsel talep, amaçlanan güçlük, cevap/rubrik ilişkisi ekle. Bir soru birden fazla çıktıyı ölçebilir; birleşik blok sayısı çıktı sayısıyla çarpılmaz.
- Ortak metin/görsel tek kaynak olarak kalır; bağlı sorular ayrı sayılır. Sırf her soru hikâyeli/görselli olsun diye ilgisiz içerik ekleme. Açık uçlu/kısa cevaplı ve diğer türlerin uygunluğu seçilen sınav ailesinin güncel kuralından gelir.
- Mevcut deterministik sayım/tür denetimini genişlet; ayrıca soru gerçekten beklenen beceriyi ölçüyor mu, çözüm doğru mu, alternatif doğru cevaplar ve kısmi puan ölçütü yeterli mi kontrol et. AI kontrol önerisi ile insan alan/dil incelemesini ayır. Amaçlanan güçlüğü ölçülmüş güçlük olarak sunma.
- GINA özgün hazırlık üretir. Öğretmen hesabı/EBA havuzu, gizli sınav veya yasak okul dışı soru/cevap paylaşımı edinme yolu değildir; veli katkısı da bunu aşamaz. Dil yazılısını tüm dil notu sayma; dinleme/konuşma oranları güncel kaynakla doğrulanmadan sabitleme.

## Kütüphane ve kabul

K01'in OYSS alt havuzu aynı onaylı kaynak sürümleri ve çıktı haritasıyla hazırlanacak. Sınıf/ders başına 20 soru **havuz hedefi**, sınav adedi değildir. Bir soru uygun birden çok senaryoya ilişkilendirilebilir. Tam senaryo kurarken eksik çıktı/adet açık gösterilecek; eksikliği rastgele soru doldurarak gizleme. Her sınıf/ders OYSS kapsamında değil; tüm havuza bu etiket verilmez. Toplu üretim hâlâ yazılım işlerinden sonra; M01 için küçük sentetik/özgün doğrulama pilotu bu sırayı bozmaz.

Kabul testleri:

1. Doğru yıl/dönem/yazılı/sınıf/ders ve okul/program kapsamı; bilinmeyen okul seçimi.
2. Eksik dosya, ağ kesintisi, yeni hash ve geri çekilen kaynak; eski atanmış sınav değişmez.
3. Birleşik hücre/blok sayımı; mevcut yirmilik havuzdan yedilik dağılım örneği; yanlış adet/tür reddi.
4. Sorunun blok/çıktı/rubrik izi; yalnız kod etiketiyle içerik uygunluğu sayılmaması.
5. Manuel kaynağın onaylı katalog gibi yükseltilememesi, aile/rol yetkileri ve eşzamanlılık.
6. SSRF, aşırı dosya/ZIP, format bozukluğu, belge talimatı; tekrarın çift iş/kota tüketmemesi.
7. Veli telefon/tablet kaynak–dağılım–soru önizlemesi; çocuk defteri ve veli rubriği okunabilirliği.

Mevcut testleri genişlet: `scripts/test-meb-scenarios.py`, `test-curriculum-candidates.py`, `test-curriculum-review.py`, `test-curriculum-races.py`, `test-catalogue-selection-races.py`; Supabase `056_curriculum_source_review.test.sql`, `057_catalogue_family_selection.test.sql`; `_shared/catalogue-plan.test.ts`, `generation-result.test.ts`. Kökteki `scripts/` ve `supabase/tests/` kısaltmalarıdır. Tüm adayları teknik test geçti diye editoryal onaylı/yayımlı sayma.
