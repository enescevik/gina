# 5. sınıf Türkçe — oyunların dilinden taslak havuzu

4 Kasım 2026. **20 özgün açık uçlu taslak; 0 bağımsız alan editörü onayı, 0 yayın.** Ücretli AI çağrısı yapılmadı. Bu havuz yıllık Türkçe kapsamı veya tek oturumluk resmî sınav değildir.

## İçerik ve dosyalar

Üç özgün kısa metin ve iki özgün görsel ortak kaynak olarak tutulur. Kurmaca kişiler/olaylar, afiş ve kutu çizimleri bu paket için hazırlandı; kitap veya sınavdan alınmadı. Bir sorunun yanıtı başka bir soruyu çözmek için gerekmez. Aynı kaynağı kullanan sorular bağımsız yeterlilik kanıtı sayılmaz; birbirine ipucu verme etkisi editör incelemesine açıktır.

- `pilot.json`: 20 soru, kaynaklar, cevap/çözüm, dört ayrı 1 puanlık ölçüt, olası yanılgı ve sonraki adım.
- [Öğrenci görünümü](student.html) ve `student.json`: cevap ve puanlama alanları bulunmaz.
- [Özel editör görünümü](review.html): cevaplar ve puanlama; öğrenciye veya genel dosya deposuna sunulmaz.
- `assets/play-poster.{svg,png}`, `assets/box-sequence.{svg,png}` ve `assets/manifest.json`: ölçü, sRGB, köken, kaynak geometrisi, dosya hash’leri.
- `source-verification.json`: program sayfası ve dağılım tablosu kökeni; `verification.json`: teknik kontrol sonuçları ve sınırları.
- [Afiş / telefon](student-poster-phone.png), [görsel sıralama / telefon](student-sequence-phone.png), [yazma / editör](review-writing.png), [hece / editör](review-syllables.png).

Bunlar HTML içerik önizlemeleridir; uygulama ekranı veya fiziksel cihaz kabulü değildir. 390 px önizlemede görseller 277 px içerik genişliğine sığar; yatay taşma yoktur ve tam boy açılabilir. Editör kartları 1280 px tarayıcıda alınmıştır. Görsel betimlemesi erişim alternatifi sağlar; bu yolla cevaplanan soru saf görsel okuma başarısı diye raporlanmamalıdır.

## Program eşlemesi

[MEB 5. sınıf Oyun Dünyası teması](https://tymm.meb.gov.tr/ortaokul-turkce-dersi/unite/54) 4 Kasım 2026’da okundu. Eşleştirmeler öneridir; teknik kontrol alan onayı değildir.

| Çıktı adayı | Sorular | Çalışılan bölüm |
|---|---|---|
| T.O.5.6 | 1–6 | Açıkça verilen kişi, zaman, yer, sıra ve koşul bilgileri |
| T.O.5.7 | 7–10 | Afiş ve ardışık kareleri okuma; görünen ile bilinmeyeni ayırma |
| T.O.5.20 | 11–14 | Bağlam içinde eş/zıt anlam ve eş sesli kullanımlar |
| T.Y.5.13 | 15–17 | Amaca uygun, belirgin ve çeşitli kelimelerle kısa yazma |
| T.Y.5.16 | 18–20 | Nokta, hece sınırı ve satır sonu kısa çizgi |

Dönem kaynağı `turkce2.xlsx`, `5. Sınıf` sayfası, `C6` başlığı, `B12/B13/B21/B30/B32` çıktı hücreleri; aday `tr-2026-2027-t1-turkce2-g5-c6`. SHA-256 `6405d02aaaadaa4d25a3ce54954dd256a045da9f35d49ee806a3b29565a82cee`. [MEB dağılım dizini](https://odsgm.meb.gov.tr/www/1donem-konu-soru-dagilim-tablolari-2026-2027/icerik/1724). Altı soruluk bu okul senaryosu **seçilmedi**; 20 soruluk paket o sınavın karşılığı değildir.

Yazım örnekleri [TDK noktalama](https://tdk.gov.tr/icerik/yazim-kurallari/noktalama-isaretleri-aciklamalar/) ve [TDK hece/satır sonu kuralları](https://tdk.gov.tr/icerik/yazim-kurallari/hece-yapisi-ve-satir-sonunda-kelimelerin-bolunmesi/) ile kontrol edildi. Kaynakların örnek cümleleri alınmadı. İlk tema dışındaki noktalama konuları bu paketin değerlendirme hedefi yapılmadı.

## Puanlama ve erişilebilirlik sınırı

Her ölçüt bağımsız 1 puandır. Uygun farklı anlatımlar kabul edilir; örnek yazı tek doğru cevap değildir. Anahtar sözcük eşleşmesiyle otomatik not verilmez. El yazısının güzelliği, çizgi düzgünlüğü veya hız puanlanmaz. 18–20 dışındaki maddelerde anlama engel olmayan yazım hataları için ayrı puan kesilmez.

Klavyeyle veya el yazısıyla cevap verilebilir. Çizim plan olarak kullanılabilir; yazılı üretim için istenen kelime/cümlelerin yerine yalnız resim yeterli değildir. Bu ayrım soru metninde ve aktarılabilen `response` bilgilerinde bulunur. Yeni bir mobil giriş kısıtlaması eklenmedi. Esnek değerlendirme ilkesi mevcut `rubric.scoring` alanında; ek açıklayıcı bayraklar `metadata.response` içinde korunur. Sunucunun kabul etmediği yeni rubric anahtarları eklenmez.

Kaynak metni değişip cevaplar eski kalırsa, yanlış ortak kaynak bağlanırsa, noktalama/hece kontrol verisi bozulursa veya görselde nesne başka konuma kayarsa teknik kontrol hata verir. Bu kontroller her cümlenin pedagojik/dilsel doğruluğunu kanıtlamaz. Zorluklar editoryal tahmindir, psikometrik ölçüm değildir.

## Teknik kabul

```sh
node scripts/render-library-draft.mjs docs/learning/library-pilot/grade-5-turkish
python3 scripts/test-library-turkish5.py
python3 scripts/test-library-science6.py
python3 scripts/test-library-math6.py
python3 scripts/test-library-draft.py
python3 scripts/test-learning-pilot.py
python3 scripts/test-library-import-preparer.py
python3 scripts/build-library-coverage.py --check
python3 scripts/test-library-draft-roundtrip.py --folder docs/learning/library-pilot/grade-5-turkish --template gina_completion_audit
```

28 yeni kontrol, 90 mevcut içerik/aktarım kontrolü; öğrenci cevap ayrımı, ortak kaynak, yazılı/görsel kanıt ve açık uçlu puanlama sözleşmesi. İlk aktarım denemesinde saptanan tanınmayan rubric alanları mevcut sözleşmeye uyarlandı; dosya doğrulayıcıya bu hata için regresyon kontrolü eklendi.

Geçici DB klonunda 20 soru, beş kaynak ve iki PNG bütün alan ve baytlarıyla geri okunup karşılaştırıldı. Aynı istek tek paket olarak kaldı; işlem geri alındı, klon kaldırıldı. Mobil tip ve lint kontrolü geçti; mobil kod değişmedi.

## Açık işler

Bağımsız Türkçe alan/dil incelemesi, erişilebilir alternatiflerin değerlendirme etkisi ve gerçek uygulama/cihaz kabulü bekliyor. Toplam havuz 77 sınıf–ders hedefinde **100 taslak**, **1440 yazılmamış**, **0 bağımsız onay**, **0 yayın**. Üretim ve TestFlight17 değişmedi.
