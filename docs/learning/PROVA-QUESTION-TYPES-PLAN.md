# Prova — yapılandırılmış soru türleri planı

6 Kasım 2026 · Kullanıcı plan yönünü onayladı. **Bu kayıt plan/devir teslimidir; uygulama yapılmış değildir.** Teknik inceleme tabanı `8521042`; başlamadan güncel main farkı ve ilgili AGENTS kuralları okunacak.

## 1. Amaç, kapsam ve öncelik

7 ve 9 yaş başta olmak üzere çocukların telefon/tablet üzerinde anlaşılır kontrollerle cevaplayabilmesi; Apple Pencil ve mevcut çözüm defterinin korunması. Türler paket yüzünden kapanmaz. Otomatik puanlama bütün paketlerde; otomatik olmayan değerlendirme veliyle yapılır. Paket/hak/izin uygunsa AI yalnız önerir, veli onaylar. Kota bittiğinde veli yolu çalışmaya devam eder. Tür kullanılabilirliği ile AI çağrısı yetkisi ayrı kontrol edilir.

- Soru içeriği/uyaranı, etkileşim türü ve puanlama yöntemi ayrı kavramlardır. Grafik/tablo okuma, ortak metin veya problem kurma için gereksiz ayrı cevap altyapısı kurulmaz.
- Kütüphane toplu içerik üretimi/onayı/yayını bu kapsamda yok; kullanıcı backoffice üzerinden yönetecek. Yönetim/editör araçlarının yeni tür desteği kapsamda.
- 3B dünya bu kapsamda yok; kullanıcı ve Codex ayrı yürütecek.
- H00–H08 devir işleri iptal olmaz. Kritik mevcut kusurlar önceliklidir; bağımsız plan/kontrat çalışması paralel yürüyebilir. H08 düzeltme yayını bu planın bütün fazlarını beklemez. Her faz ayrı test/yayın birimidir.
- Onaylı mint/mor/krem, özgün logo/maskot, Nunito/Baloo 2 korunur. Yeni görsel yön üretme. Türün anlaşılabilirliğini 7–9 yaş kullanımında ölç; uzman incelemesi yerine yalnız otomatik test sonucu sunma.

## 2. Bugünkü kod ve değişiklik alanları

| Kaynak | Mevcut sınır / etkisi |
|---|---|
| `supabase/migrations/20261030040000_prova.sql` | `question_kind`: `multiple_choice`, `open_ended`; eski key/text cevap alanları |
| `supabase/functions/_shared/generation-result.ts` | question_type etiketi etkileşim sözleşmesi değil; yalnız iki kind doğrulaması |
| `apps/mobile/src/app/child/prova/[examId].tsx` | İki tür dalı, açık uçluda NotebookWorkspace, cevap günlüğü ve v3 RPC |
| `supabase/migrations/20261102131000_exam_boundaries.sql` | Öğrenci choices projeksiyonu key/text izin listesi; kullanılan soruyu değiştirme koruması |
| `supabase/migrations/20261102160000_answer_notebooks.sql` | v3 submit/get-saved, defter, request ID/revision; yapılandırılmış cevap eklenmeli |
| `supabase/migrations/20261102200000_parent_answer_reviews.sql` | Cevap hash'i ve veli incelemesi; yeni cevap alanı hash'e dahil edilmeli |
| `supabase/migrations/20261106140000_open_answer_pending_score.sql` | mc/open sayaçları ve pending/unanswered/provisional; iki türe göre toplamlar |
| `supabase/migrations/20261106430000_ai_question_edit.sql` | AI sorusu ve ortak kaynak düzenleme/sürümleme; yeni alanlar korunmalı |

Bunlar başlangıç referanslarıdır; uygulanırken her RPC/trigger'ın en son tanımını esas al. Hazırlama, düzenleme, AI üretimi, kütüphaneden seçim, atama, cevap kaydı, bitirme, veli incelemesi, rapor ve PDF birlikte ele alınır. Yalnız çocuk render'ı eklemek tamamlanma değildir.

## 3. MEB ve kullanım modu ayrımı

- **Alıştırma modu:** kazanıma uygun etkileşimli türler kullanılabilir.
- **OYSS/ortak yazılı modu:** yıl, dönem, yazılı, sınıf, ders ve seçilen resmî senaryoya uygun madde biçimleri ayrıca doğrulanır. Kazanım etiketinin eşleşmesi biçim uygunluğunu kanıtlamaz.
- Doğru/yanlış, eşleştirme, seçenekli işaretleme ve kelime havuzlu doldurma alıştırma türüdür; yazılı moduna kendiliğinden alınmaz. Kaynak kuralı ve senaryo kapsamı izin vermedikçe üretilmez/atanmaz; sessizce açık uçluya çevrilmez.
- 7–9 yaş/ilkokul için doğrulanmış kapsam yoksa “OYSS uyumlu” iddiası yapılmaz. Yaş yerine çocuğun güncel sınıf/programı ve modun kapsamı esas alınır.
- Üç ifadeli bir madde otomatik olarak üç senaryo sorusu sayılmaz. `assessment_item` ve alt maddeler ayrılır; senaryo sayımı, blok dağılımı ve soru puanı açıkça tutulur.
- PDF'ye dönüşümün ölçtüğü beceriyi değiştirip değiştirmediği ayrıca incelenir. Teknik PDF üretimi MEB uygunluğu onayı değildir.

İnceleme kaynakları (6 Kasım 2026; uygulamada güncelliği tekrar kontrol et):
- [MEB OYSS uygulama kılavuzu duyurusu, 20 Ekim 2026](https://www.meb.gov.tr/ortak-yazili-sinav-sistemi-uygulama-kilavuzu-yayimlandi//haber/42228/tr)
- [Resmî ölçme değerlendirme merkezi: madde türleri açıklaması](https://batmanodm.meb.gov.tr/meb_iys_dosyalar/2025_09/16121030_okul_geneli_ortak_sinav_sorulari_hazirlanirken_dikkat_edilecek_hususlar.pdf)
- Repo: `docs/learning/MEB-SCENARIO-PROTOCOL.md`.

## 4. Veri ve güvenlik sözleşmesi — Faz 0 (QT00, P1)

### Tercih edilen model

1. Eski `kind` geçişte korunur. Yeni `interaction_type` (yönetilen tür kaydı/FK veya migration ile denetlenen değer), `schema_version` ve öğrenciye açık `payload` eklenir. Sınırsız serbest tür metni yok; yalnız enum genişletmek çözüm değil. Her tür için ayrı tablo açma.
2. Doğru eşler/sıra, alternatif cevaplar, tolerans, rubrik ve puan politikası çocuk erişimine kapalı **ayrı değerlendirme tablosunda**, soru sürümüne bağlı tutulur. Public payload içine doğru cevabı gömme.
3. `exam_answers.answer` sürümlü, türe göre ayrıştırılan JSON olur. Mevcut `answer_key`, `answer_text`, `answer_document` kayıpsız geçiş adaptörüyle desteklenir; çizim belgesi korunur. Tek yetkili cevap kaynağı ve alan çakışması davranışı belirlenir.
4. Kalıcı öğe kimlikleri kullanılır: ifade, boşluk, seçenek, eş, token, bölge. Yanıtlar ekran konumuna veya indeksine bağlanmaz. Rastgele gösterim sırası attempt içinde sabitlenir; geri dönünce değişmez.
5. Atamada değişmez soru sürümü, değerlendirme politikası sürümü, maksimum puan ve içerik hash'i bağlanır. Metin/şema değişince yeni sürüm; başlamış/geçmiş sınav sessizce yeniden puanlanmaz. İdari yeniden değerlendirme varsa gerekçeli/sürümlü ayrı işlem.
6. Öğrenci RPC'si izinli alanlardan projeksiyon kurar. Payload'tan yalnız `correct_*` silmek yeterli değil. İç içe metadata, alternatifler, özel kaynak ve rubrik sızıntıları test edilir. RLS satır koruması tek başına özel sütun koruması değildir.
7. Yeni submit/get-saved/get-questions sözleşmeleri sürümlenir. Request ID + beklenen revision + fingerprint, yeni answer ve tür/sürümünü kapsar. Eski bir cihaz yeni cevabı eksik alanlarla ezemez.
8. Eski soru otomatik tahminle yeni etkileşime dönüştürülmez. Eski istemci yeni türü desteklemiyorsa açık güncelleme/uyumsuzluk yolu; sessiz boş ekran, serbest metin fallback'i veya cevap kaybı yok. Cihaz yeteneği uygunluğu atamada da kontrol edilir.

### QT00 tamamlanma kriterleri

- Tip sözleşmesi, genel/private payload örnekleri, geçiş/rollback yaklaşımı ve RPC etki listesi mevcut.
- Eski sorular, devam eden sınavlar, v3 istemci ve çevrimdışı günlük regresyonu geçiyor.
- Yinelenen/çakışan request ID, eski revision, sıra dışı ağ cevabı, süre bitişi ve gönderim yarışı testli. Finalize bekleyen kayıtları güvenli biçimde ele alıyor.
- Geçersiz tür, büyük/derin payload, bilinmeyen veya yinelenen öğe kimliği, fazla seçim ve tür-soru uyuşmazlığı sunucuda reddediliyor.
- Öğrenci/başka aile doğrudan DB, RPC, PDF ve varlık URL'sinden cevap anahtarı alamıyor. Öğrenci düzenli kayıt sırasında puan API'sini cevap deneme oracle'ı olarak kullanamıyor.
- Raporlar `mc_total/open_*` ayrımına sıkışmıyor: puanlanmış, insan incelemesi bekleyen, cevapsız, kısmen cevaplanmış ve geçici toplam açıkça tanımlı.

## 5. Puanlama sözleşmesi (QT01, P1; Faz 0 ile birlikte)

**Karar:** Mevcut RPC/transaction mimarisinde SQL sunucu otoritesi. Core ikinci bağımsız puan motoru olmaz; tür/cevap doğrulaması, gösterim ve ortak test örnekleri sağlar. İstemci puanı gönderemez; çocuğa yerel puanlama için gizli anahtar verilmez. Sunucu puanının kullanıcıya ne zaman gösterileceği alıştırma/sınav moduna göre belirlenir.

- Genel formül: `soru puanı = 100 × kazanılan alt madde ağırlığı / toplam ağırlık`. Pozitif ağırlık, sabit payda; tek final yuvarlama. Sınav toplamı soru maksimum puanlarıyla ağırlıklı hesaplanır; alt madde sayısı soru ağırlığını kendiliğinden artırmaz. Eksik puanlı toplam provisional kalır.
- Doğru/yanlış, boşluk, eşleştirme, sınıflandırma: her alt madde doğruysa ağırlığı kazanır. Gönderilmiş boş alt madde puan kazanmaz. Hiç gönderilmemiş/taslak cevap ve insan puanı bekleyen cevap otomatik sıfır sayılmaz. Açık uçlu eski pending davranışı korunur.
- Sıralama: karşılaştırılabilir doğru ikili öncelik sayısı / gerekli öncelik sayısı. Tek eleman, eksik/tekrar öğe ve sıfır payda ayrı doğrulanır. Cümle kurma tek sıraya zorlanmaz: sınırlı alternatifler veya öncelik kısıtları; ifade özgürlüğü varsa insan değerlendirmesi.
- Sayısal: kontrollü sayı parser'ı, virgül/nokta ve kesir desteği; izinli birim dönüşümünden sonra `abs(x-y) <= max(absTolerance, relTolerance*abs(y))`. Float/yuvarlama sınırları ve sıfır hedef testli. Gelişigüzel ifade çalıştırma yok. Sonuç/birim ayrı puanlanabilir; süreç isteyen soruda yalnız sonuçtan tam puan yok.
- Çoklu doğru (Faz 2): öneri `max(0, TP/P - FP/N) × 100`, P doğru ve N yanlış seçenek sayısı. Bu politikada P ve N pozitif olmalı; hepsi-doğru/hiç-doğru yapı reddedilir veya açık ayrı politika gerekir. Her şeyi seçmek tam puan vermez; formül ve geri bildirim veliye anlaşılır olur.
- Metin işaretleme (Faz 2): sınırlı hedefler için doğru seçilen/hedef ve yanlış seçilen/çeldirici oranını dengeleyen, sürümlü politika; bütün paragrafı seçerek puan kazanılmaz. Cümle/kelime sınırları ve kabul edilen aralıklar authoring sırasında belirlenir.
- Hata düzeltme: hatayı bulma ile düzeltme ayrı ölçüt; serbest alternatif düzeltme yalnız kapalı anahtarla haksızca reddedilmez. Belirsizlikte veli yolu.
- Türkçe: Unicode NFC, trim ve boşluk düzenleme temel. Büyük/küçük harf TR locale ile ancak ölçüt izin veriyorsa. `ı/i`, `ş/s`, `ğ/g` topluca eşitlenmez. Noktalama/yazım kazanımında tolerans kapalı; alternatif cevaplar sürümlü ve incelenmiş. Fuzzy eşleşme sessiz doğru kabul etmez.

**Kabul:** Her otomatik tür için tam/kısmi/boş/yanlış/sınır ve kötüye kullanım örnekleri; puan 0–100 sınırı, deterministik tekrar, karıştırılmış sırada aynı puan, sabit ağırlık, hassas sayı sınırları doğrulanmış. Veli puan düzeltmesi gerekçeli kayıt; AI önerisi ve veli kesin puanı ayrı. Tür paket yüzünden kapanmıyor; AI yok/kota bitti senaryosunda veli puanlayabiliyor.

## 6. Fazlar ve tür bazlı kabul

| Faz / kart | Kapsam | Ek tamamlanma kriteri |
|---|---|---|
| 1A / QT10 | Doğru/yanlış grubu, varsayılan 3–5 ifade | Her ifade için açık seçili/cevapsız durum, geri alma; cümleler tek yargılı; 3/5 alt maddeli eşit/ağırlıklı puan testleri |
| 1A / QT11 | Boşluk doldurma | Boşluk kimlikleri; kelime havuzu/klavye veli veya öğretmen seçimi. 1–3 için havuz önerisi, 4+ için yazı önerisi katı yasak değil. Kelime tekrar kullanım kuralı açık; TR alternatif/yazım testleri |
| 1A / QT12 | Eşleştirme | Dokun–dokun; eş çözme/değiştirme, kullanılan seçenek durumu, klavye/erişilebilir alternatif. Birebir/çoktan-bire politika açık; farklı sayıda çeldirici ve tekrar denetimi. Çizgi animasyonu şart değil |
| 1A / QT13 | Sayısal kısa cevap | Rahat sayı/birim kontrolleri; alternatif sayı biçimi, ölçü dönüşümü, tolerans ve süreç/sonuç ayrımı. Birim gerekmeyen soruda zorunlu alan yok |
| 1B / QT20 | Sıralama, cümle kurma | Taşı/yukarı-aşağı veya dokunarak yerleştir; yalnız sürüklemeye bağımlı değil. Aynı görünen kelimeler farklı ID; kabul edilen alternatif sıra; ekran döndürmede düzen kaybolmuyor |
| 1B / QT21 | Sınıflandırma | Öğeyi seç → kategoriyi seç; geri al, kategori kapasitesi/çoklu üyelik açık. Otomatik puan için kategoriler belirsiz/örtüşen değil; insan yolu gereken örnek ayrılıyor |
| 2A / QT30 | Metin içinde kelime/cümle işaretleme | Sabit içerik/token kimlikleri; TR Unicode, emoji ve tekrarlanan kelimelerde doğru aralık; büyük yazı/zoom satır değişse cevap kaymıyor; aşırı seçim puan avantajı sağlamıyor |
| 2A / QT31 | Hata bulma ve düzeltme | Hata yeri ve düzeltme ayrı kaydediliyor; hata sayısı/alternatif doğru düzeltme tanımlı. Anlamca geçerli serbest cevap veliye yönleniyor; AI tek başına kesinleştirmiyor |
| 2A / QT32 | Birden çok doğru seçenek | Kaç seçim yapılabileceği açıklanmış; her şeyi seçme suistimali engelli, kısmi puan formülü testli; tek seçimli eski tür bozulmuyor |
| 2A / QT33 | İki aşamalı soru | Cevap + gerekçe ayrı alt öğe/ölçüt; ilk aşamanın puanı ve geri bildirim zamanı önceden sabit. Bir aşama diğerinin anahtarını sızdırmıyor; aynı beceri iki kez sayılmıyor |
| 2B / QT40 | Mevcut kalem/işlem/çizim akışını güçlendirme | Yeni defter kurma. Düzenlenebilir stroke/text/source belge + değerlendirme görüntüsü; Pencil/parmak, scroll kilidi, palm rejection cihaz kabulü, kayıt/geri alma/yön/izin regresyonu. AI önerir, veli onaylar |
| 2B / QT41 | Şekil boyama ve saat | Kararlı bölge ID'leri; renge tek başına anlam yüklemeyen gösterim. Saatte analog/dijital, dakika aralığı ve kabul ölçütü açık. Dokunarak alternatif var |
| 2B / QT42 | Tablo/grafik, harita/şema | Uyaran katmanı + mevcut cevap türleri; harita/şema için normalize bölge kimlikleri. Görsel ölçeklemede seçim sapmıyor, okunur eksen/etiket ve alternatif açıklama var; açıklama cevabı ifşa etmiyor |
| 2B / QT43 | Dikte | Ses tekrar/hız politikası ölçüte uygun; dinleme sırasında transkript cevabı görünmüyor. Yazım/işitme amacı ayrılmış; sessiz/ses oynatılamaz ortam davranışı ve PDF sınırlaması açık |
| 2B / QT44 | Problem kurma | Açık uçlu alt çeşidi; verilenler, tutarlılık, çözülebilirlik ve gerekçe rubriği. Tek doğru cümle beklenmiyor; AI önerisi/veli kabulü ayrı |
| 3 / QT50 | Bulmaca | Düşük öncelik; TR karakterler, kesişen cevaplar, mobil hücre kullanımı, erişilebilir alternatif. Tamamlanma puanı ile yazım becerisi ayrılmış |
| 3 / QT51 | Sesli cevap | Mikrofon izni/ret, kayıt sınırı, dinle/sil/yeniden kaydet, güvenli saklama/silme. Transkripsiyon yalnız yardımcı; aksan/hata yüzünden kesin yanlış puan yok; veli yolu. Çocuk sesi aktarımı için mevcut izinlerden otomatik yetki türetme |

Sıra: QT00 + QT01 → Faz 1A → Faz 1B → Faz 2A → Faz 2B → Faz 3. Faz içi bağımsız türler paralel yapılabilir. Mevcut defterde kritik hata bulunursa Faz 2B beklenmeden düzeltilir. Her faz aşağıdaki ortak kapıyı geçmeden “tamam” olmaz; dış engel varsa ayrı tutulur, kanıtsız geçilmez.

## 7. Her tür/faz için ortak kabul kapısı

- [ ] Manuel hazırlama/düzenleme ve AI üretimi aynı sürümlü şemaya yazıyor; ortak kaynak ve soru sürümleri korunuyor.
- [ ] Katı AI şeması + deterministik sunucu doğrulaması var. Sadece JSON syntax değil; eksik/yinelenen ID, bulunmayan eş/hedef, çelişkili cevap, yanlış adet/ağırlık, çözümsüz sıralama ve boyut sınırı reddediliyor.
- [ ] AI çıktısı öğrenci görünümü + özel anahtara ayrılıyor; anahtar/çözüm/provenance istemciye sızmıyor. Üretim promptu pedagojik belirsizliği tek başına çözmüş sayılmıyor; editör/veli önizlemesi mevcut.
- [ ] Çocukta cevapsız/kısmi/dolu durum doğru; taslak kayıt, uygulamayı kapat/aç, offline/online, iki cihaz çakışması, sınav bitirme/deadline testli.
- [ ] Veli incelemesi ve gelişim raporu kısmi puanı, puan bekliyor ve boş cevabı ayırıyor. Yaş/zeka/kişilik etiketlemesi ve utandırıcı yanlış geri bildirimi yok.
- [ ] Paket Free/Plus/Pro tür erişimi eşit; AI kotası/izni ayrı. Manuel hazırlama/cevaplama/değerlendirme AI hizmetine bağımlı değil.
- [ ] Telefon 390×844 + dar telefon; tablet 768×1024 ve 1280×800; web ve backoffice authoring. Klavye/safe area/büyük yazı/azaltılmış hareket/48 dp hedef; sürüklemeye dokunma alternatifi ve geri al.
- [ ] PDF öğrenci kitapçığı ve özel cevap anahtarı ayrı. Türkçe font, sayfa taşması, ortak kaynağı gereksiz çoğaltmama, boşluk/eşleştirme/işaretleme cevap alanları ve soru sırası testli. Dikte/sesli cevapta öğretmen metni/rubrik eki ve gereken ses aracı açık; PDF tek başına aynı sınavmış gibi sunulmuyor.
- [ ] İzole DB yetki ve negatif testleri, SQL puan golden-fixture testleri, core sözleşme testleri, mobil/backoffice tip/lint ve ilgili CI başarılı.
- [ ] Gerçek Pencil, ses ve erişilebilirlik kabulü cihaz/sürümle kayıtlı; simülatör veya web bunun yerine geçmiyor. Cihaz yoksa açık DIŞ ENGEL.
- [ ] Commit/migration/Edge/istemci sürümleri, eski istemci davranışı, çalışan ekran görüntüleri ve sınırlamalar raporlanmış; öğrenci verisini kaybeden geri dönüş yok.

## 8. AI risk kontrolleri

- Her tür için açık discriminant + schema_version; bilinmeyen alan/tür reddi. Bir modelin JSON şema desteği yoksa sessiz doğrulamasız kabul edilmez.
- Yanlış eşler, birden fazla geçerli doldurma, gramer bakımından birden fazla sıra, kategori örtüşmesi, görselde bulunmayan öğe ve birim hatası özel red-team örnekleriyle test edilir.
- Görselin adının veya metindeki tarifinin varlığı görselin gerçekten bulunduğu anlamına gelmez. Varlık erişimi/çözünürlüğü ve öğrenci paketinde varlığı doğrulanır.
- Yazılı senaryosunda hedef toplam, blok sayısı ve izin verilen madde biçimi sunucuda doğrulanır. İstemci/AI etiketine güvenilmez.
- Aynı üretim/puanlama isteği iki kez ücretlenmez. Belirsiz sağlayıcı sonucu yeniden denemeden önce mevcut iş ve ücret durumu uzlaştırılır.
- Gerçek sağlayıcı pilotları sınırlı sentetik örneklerle, mevcut bütçe/yetki içinde yapılır; toplu kütüphane üretimine dönüşmez.

## 9. Takip ve teslim

Başlangıçta bütün QT kartları **PLANLANDI**. Kart durumu: PLANLANDI → YAPILIYOR → KOD HAZIR → YAYINDA → KABUL TAMAM; bağımlılık için DIŞ ENGEL. Her kartta commit, test, UI/PDF kanıtı, yayın sürümü, fiziksel kabul ve açık sınırlama tutulur. H00–H08 ile ortak dosya/migration sahipliği tek koordinatörde olsun.

Faz başında tür bazlı kısa etkileşim akışını ve kabul örneklerini kaydet; uygulama sonrasında bunlarla karşılaştır. Geçerli repo/oturum onay kurallarını izle; bu plan tek başına yeni ücretli hizmet, gizli anahtar paylaşımı veya gerçek kullanıcı verisiyle test izni değildir. Bu dokümanın hazırlanması uygulama koduna başlanmış olduğu anlamına gelmez.

## 10. Claude'a verilecek prompt

> Güncel main'i yerel değişiklikleri koruyarak al. Önce `docs/learning/PROVA-QUESTION-TYPES-PLAN.md`, `docs/CLAUDE-REMAINING-WORK.md`, DECISIONS, PROVA ve ilgili AGENTS dosyalarını oku. Soru türleri için onaylanan teknik yönü Faz 0 (QT00/QT01) → 1A → 1B → 2A → 2B → 3 sırasıyla uygula. Fazların ortak kabul kapısını ve tür bazlı ölçütlerini tamamlamadan işi kapatma. Mevcut defter, eski sorular/RPC'ler, atanmış sınav sürümleri ve çevrimdışı cevap kaydı korunacak. SQL sunucu puanlama otoritesi; core ikinci bağımsız motor değil. Öğrenci payload'ı ile özel anahtarı ayır; yeni answer'ı revision/idempotency/hash zincirine kat. Türler paketle kısıtlanmayacak; AI önerisi ayrı hak/onay, yoksa veli değerlendirmesi. Alıştırma ile MEB ortak yazılı biçim kurallarını ayır. Onaylı tasarımı koru; hazırlama, çocuk cevaplama, veli inceleme, rapor ve PDF'yi birlikte tamamla. H00–H08 mevcut işleri koru; kritik kusurları öne al ve H08 yayınını bütün yeni türlerin bitmesine bağlama. Bağımsız işleri alt ajanlara bölebilirsin; migration/merge/yayını tek koordinatörde tut. Kütüphane toplu üretimi ve 3B dünya kapsam dışında. Mevcut yetkiler içinde ilerle, dış engelleri ayrı kaydet; finalde her fazın test, yayın ve gerçek cihaz kabulünü dürüstçe raporla.
