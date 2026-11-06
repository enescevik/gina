# D18 — Yasal belgelerin İngilizce sürümleri (6 Kasım 2026)

**Durum:** Worktree dalında tamamlandı; `main`'e alınmadı, üretime hiçbir şey gönderilmedi. Hukuk uzmanı onayı yoktur; tüm belgeler taslak olarak kalır.

Gerekçe: DECISIONS.md yayının TR + EN olacağını söylüyor (`/legal/*` sayfaları); D16 README §4 madde 1'de "İngilizce Kullanım Koşulları taslağı yok (diğer 8 belge de yalnız TR)" açık kalemi vardı. Bu iş o kalemi kapatır.

## 1. Yöntem ve biçim kararı

- **Aynı dosya, Türkçe metnin sonunda İngilizce bölüm.** Gizlilik Politikası'nın D16'daki deseni izlendi (`---` ayırıcı, ardından `# <Başlık> (English)`). Ayrı `*.en.md` dosyası açılmadı; çünkü:
  - Depoda `*.en.md` örneği yok; DECISIONS.md ve tüm belgeler tek slug listesi kullanıyor (`/legal/<slug>`), "herkese açık HTML, TR/EN" tek sayfa olarak yazılmış.
  - Kodda yasal belgelere giden tek bağlantı `apps/mobile/src/app/parent/subscription.tsx` (`/legal/abonelik-kosullari`, `/legal/gizlilik-politikasi`). `scripts/` altında `docs/legal` okuyan veya `.md` yolu kullanan kod yok (`git grep` ile doğrulandı). Bu nedenle **hiçbir uygulama/betik bağlantısı değiştirilmedi.**
- Her Türkçe belgenin "Dil" satırına Gizlilik Politikası'ndaki gibi iki dilli bir işaret cümlesi eklendi ("İngilizce sürüm sayfanın sonundadır / The Turkish text prevails; an English version is at the end of this page"). Her Türkçe değişiklik geçmişine "0.2 (D18 İngilizce sürüm)" satırı eklendi. **Türkçe metnin içeriği değiştirilmedi.**
- Çeviri, D16/D17 sonrası güncel Türkçe metinden, bölüm bölüm ve satır satır yapıldı (başlık bloğu, uygulama denetimi notları, değişiklik geçmişi dâhil). Türkçede olmayan hukuki iddia eklenmedi.
- **Yer tutucular ve uzman/ürün notları:** `[VERİ SORUMLUSU UNVANI]`, `[E-POSTA]`, `[30 gün]`, `[AVUKAT: …]`, `[ÜRÜN KARARI: …]`, `[TEKNİK DOĞRULAMA: …]` vb. **Türkçe hâliyle aynen korundu**, hemen ardından parantez içinde kısa İngilizce açıklama verildi (ör. `[AVUKAT: bent harflerinin teyidi] (Lawyer note: confirm the sub-paragraph letters.)`). Not: Gizlilik Politikası'nın D16 İngilizce bölümü `[AVUKAT: …]` notlarını `[LAWYER: …]` olarak çevirmişti; bu işte görev kuralı ("[AVUKAT]/yer tutucu işaretlerini koru") gereği işaretler değiştirilmedi. İki desen arasında tekleştirme yayın öncesi yapılabilir (açık nokta 6).
- "Taslak, hukuk uzmanı onayı yok" notları her İngilizce bölümün başlık bloğunda korundu ("No legal expert has reviewed or approved it").
- Türk mevzuatı atıfları aynen bırakıldı, ilk geçtiği yerde kısa İngilizce açıklama eklendi (ör. "Law No. 805 on the Compulsory Use of Turkish", "TMK Art. 342, legal representation of the child", "Tüketici Hakem Heyeti (Consumer Arbitration Committee)", "e-Devlet (the Turkish e-Government portal)", "İYS (Turkey's commercial message management system)", "Law No. 5651 (Internet Law)").
- Terim birliği Gizlilik Politikası İngilizce bölümüyle sağlandı: child mode, paired device, child PIN / parent PIN, workbook, teacher share link, Data Subject Request Form, feature permission, explicit consent, Settings > Privacy and Legal, Gina Başlangıç (ürün adı çevrilmedi). Belge adları: Terms of Use, KVKK Privacy Notice, Parent Declaration, Child Mode Notice, Subscription Terms, Cookie Policy, Account and Data Deletion, Explicit Consent Texts / Consent Texts.

## 2. Dosyalar ve kapsam

| Dosya | İngilizce bölüm | Commit |
|---|---|---|
| `docs/legal/kullanim-kosullari.md` (Kullanım Koşulları) | Gina Terms of Use (English) — §1–18, özet, başlık, değişiklik geçmişi | `bae04a3` |
| `docs/legal/kvkk-aydinlatma-metni.md` (KVKK Aydınlatma Metni) | KVKK Privacy Notice (English) — §1–14, tablolar, değişiklik geçmişi | `bbecea4` |
| `docs/legal/veli-beyani-ve-cocuk-profili-onayi.md` (Veli Beyanı) | Parent Declaration and Consent to Create a Child Profile (English) — §1–15, Ek A, değişiklik geçmişi | `5315183` |
| `docs/legal/cocuk-modu-bilgilendirme.md` (Çocuk Modu Bilgilendirmesi) | Child Mode Short Notice (English) — Bölüm A (çocuk metni), Bölüm B.1–B.6 | `355f9c0` |
| `docs/legal/abonelik-kosullari-ve-on-bilgilendirme.md` (Abonelik Koşulları) | Subscription Terms and Pre-purchase Information (English) — §1–15, Ek A, Ek B | `d827d82` |
| `docs/legal/hesap-ve-veri-silme.md` (Hesap ve Veri Silme) | Account and Data Deletion (English) | `f8687da` |
| `docs/legal/cerez-politikasi.md` (Çerez Politikası) | Cookies and Similar Technologies Policy (English) | `01db7c3` |
| `docs/legal/kvkk-basvuru-formu.md` (KVKK Başvuru Formu) | KVKK Data Subject Request Form and Response Procedure (English) | `01db7c3` |
| `docs/legal/acik-riza-metinleri.md` (Açık Rıza Metinleri) | Explicit Consent Texts (English) — SQL bloğundaki yorumlar dâhil | `0bb0001` |
| `docs/legal/gizlilik-politikasi.md` | Değiştirilmedi (D16'da İngilizce bölüm var) | — |

Sonuç: `docs/legal/` altındaki 10 belgenin 10'unda İngilizce bölüm var.

Kapsam dışı bırakılanlar:
- Abonelik Koşulları'ndaki "Taslak notu (yayın öncesi silinecek)" HTML yorumu çevrilmedi (yayımlanmayan iç not; İngilizce başlık bloğunda belirtildi).
- Çocuk Modu Bilgilendirmesi Bölüm A, çocuk metninin düz çevirisidir; uygulamada İngilizce çocuk metni gösterilecekse 7–10 yaş dili için ayrı ürün/uzman incelemesi gerekir (İngilizce başlıkta not edildi).
- i18n dosyaları, uygulama ekranları ve bağlantılar değiştirilmedi.

## 3. Türkçe metinde bulunan iç tutarsızlıklar (düzeltilmedi; çeviri Türkçeyi aynen izler)

Her biri Türkçe metinde olduğu gibi çevrildi; karar uzmana/ürüne aittir. (D16 README §4'te zaten listelenenler kısaca anıldı.)

1. **Okul adı istenir mi?** Kullanım Koşulları §2 "Çocuk Profili" tanımı isteğe bağlı "eğitim dönemi (okul adı dâhil)" diyor; aynı belgenin §4.2'si "okul adı … istenmez ve girilmemelidir" diyor. Aydınlatma §3.2 ve Gizlilik Politikası okul adını isteğe bağlı olarak sayıyor; Veli Beyanı §5 "Hiç istemediklerimiz" listesinde okul adı yok ama §7'de "okul adı gönderilmez" var.
2. **Çocuk PIN'i zorunlu gibi anlatılıyor.** Veli Beyanı §2 "Çocuk Modu" tanımı aynı cümlede hem "çocuk PIN'i isteğe bağlıdır" hem "giriş çocuğun 4 haneli Çocuk PIN'i ile … yapılır" diyor; "Çocuk PIN'i" tanımı isteğe bağlılığı anmıyor (§6 ve D16 düzeltmesi PIN'siz girişi anlatıyor).
3. **Eşleştirilmiş tablette ebeveyn alanı.** Çocuk Modu Bilgilendirmesi Bölüm A "çıkmak için annenin ya da babanın PIN'i gerekir" diyor; aynı belgenin B.4'ü "tablette ebeveyn alanı yoktur" diyor (D16 §4 madde 7). Kullanım Koşulları §2 "Çocuk Modu" tanımındaki "ebeveyn alanı Ebeveyn PIN'i ile korunur" da yalnız ebeveyn telefonu için doğru.
4. **Veli PIN'i kilidi.** Kullanım Koşulları §2 "Her iki PIN de 5 yanlış denemede 60 saniye kilitlenir" diyor; veli PIN'i kilidi doğrulanmadı (D16 §4 madde 6).
5. **Yapay zekâ izin modeli belge içinde çelişkili** (uygulama denetimi notları bunu zaten söylüyor): Kullanım Koşulları §9.1 aynı paragrafta "tek genel izin anahtarı yok, işlem bazlı onay" ve "Ayarlar > Yapay Zekâ Özeti anahtarından geri alma" anlatıyor; Aydınlatma §5 YZ satırı "varsayılan kapalı, ayrı özellik izni, geri alınınca kapanır" derken §8 "her işlemde ayrı onay, genel anahtar yok" diyor; Veli Beyanı §7 madde 3–4 (tek dokunuşla geri alma, diğer ebeveyne bildirim, itiraz kilidi) başındaki denetim notuyla çelişiyor; Abonelik Koşulları §3 ve §13 "izni geri alırsanız / varsayılan kapalı, her zaman geri alınabilir" diyor; KVKK Başvuru Formu §7 (ç) "yalnızca yapay zekâ özelliğini açtıysanız" ve (g) "özellik kapatılır" diyor; Açık Rıza Metinleri'nin tamamı Rıza A modelini anlatıyor.
6. **Haftalık özete giden çocuk verisi.** Açık Rıza Metinleri A-3 "çocuğun takma adı ya da ilk adı veya 'Çocuk A' etiketi; … yaş aralığı" gönderildiğini söylüyor; Kullanım Koşulları §9.2, Aydınlatma §8 ve Veli Beyanı §7 haftalık özette yalnız "Çocuk A" etiketi + sınıf + sayımlar gönderildiğini, adın gönderilmediğini söylüyor. Veli Beyanı §5 tablosu doğum yılı için "AI özetinde yalnızca yaş aralığı" diyor; §7 haftalık özet için yaş aralığını değil sınıfı sayıyor.
7. **"7 günlük ipuçları".** Açık Rıza Metinleri ürün notu bu özelliğin ilk sürümde sunulmadığını söylüyor; aynı belgenin A-2a/A-2b kutucuk metinleri ve 0.2 değişiklik özeti hâlâ "7 günlük ipuçları" diyor. Abonelik Koşulları §3 de "Üretilen özetler ve ipuçları Gina'da 12 ay" diyor.
8. **Fotoğraftan/belgeden takvim hangi pakette?** Açık Rıza Metinleri (ürün notu, A-3 tablosu) ve Veli Beyanı §7'deki ÜRÜN/AVUKAT notu bunu yalnız Gina Pro (ayda 20) olarak anlatıyor; Abonelik Koşulları §3 tablosu "belge/fotoğraftan ders programı ve öğrenme planı" için Plus'ta ayda 5, Pro'da ayda 20 işlem gösteriyor; Kullanım Koşulları §2/§10.1 de Plus'ta "belgeden ders programı" sayıyor. Abonelik Koşulları HTML taslak notu (D16 §4 madde 10) de eski özeti taşıyor.
9. **Paket farkı.** Abonelik Koşulları §3 "Paketler arasındaki fark yalnızca bu tabloda yazanlardır" dedikten hemen sonra tabloda olmayan "Plus ve Pro'da farklı yapay zekâ modelleri kullanılır" farkını ekliyor.
10. **Çerez Politikası §4 ile §2/özet.** §4 "işlevsel … kategorisinde hiçbir öge yoktur" diyor; kısa özet ve §2 uygulama denetimi web uygulamasının birinci taraf "işlevsel" yerel depolama ögeleri yazdığını söylüyor. Aydınlatma §12 de web'de yalnızca oturum ve dil tercihi ögesi olduğunu söylüyor.
11. **"Henüz yok" notu eksik ekran yolları.** Aydınlatma, Kullanım Koşulları §8.4 ve Çocuk Modu B.1 "Ayarlar > Gizlilik ve Yasal > KVKK Başvurusu (henüz yok)" derken Veli Beyanı §12, Hesap ve Veri Silme §10, Açık Rıza Metinleri §7 ve KVKK Başvuru Formu §2 tablosu (bu belgenin başlık bloğunda "henüz yoktur" notu var) aynı ekranı not düşmeden mevcut gibi anlatıyor.
12. **Çok ebeveynli hesap silme.** Hesap ve Veri Silme §9 güncel davranışı (diğer velide kalır; son veli silinince aile silinir) yazıyor; Veli Beyanı §10 aynı konuyu hâlâ `[ÜRÜN KARARI — … (a) … (b) …]` olarak açık bırakıyor.
13. **Apple ile Giriş belirteç iptali.** Hesap ve Veri Silme §5 tablosu "Apple'a belirteç iptali bildirilir" diyor; aynı belgenin başındaki denetim notu bunun uygulanmadığını söylüyor (Kullanım Koşulları §13.2 ve Aydınlatma §9 için de aynı; başlık denetim notlarında kabul edilmiş).
14. **Öğretmen paylaşımı rıza şablonu.** Açık Rıza Metinleri §6 `feature_teacher_share`'i "faz 2, rıza gerekir" diye listeliyor; özellik çalışıyor ve ayrı rıza kutusu yok (belge başındaki denetim notu ve Aydınlatma §5 son satırları bunu söylüyor).
15. **Veli Beyanı sürüm tabloları.** §15 tablosu yalnız 0.1 ve 0.2'yi listeliyor; C11/D16/D17 kayıtları yalnız sondaki "Değişiklik geçmişi"nde. Veli Beyanı 0.2 değişiklik geçmişi "6 haneli" Cihaz Eşleştirme Kodu diyor (tarihsel kayıt; güncel metin 8 karakter).
16. **Kullanım Koşulları §18 tablo sırası:** 0.2 (2026-10-30) satırı C11/D16 satırlarından sonra geliyor (yalnız sıralama; içerik etkisi yok).

## 4. Doğrulama (gerçekten koşuldu, 6 Kasım 2026, bu worktree)

- **Göreli bağlantı denetimi:** değişen 9 belgede tüm `](…)` göreli bağlantıları çözüldü, kırık bağlantı yok (geçici betik scratchpad'de: her `./*.md` hedefinin varlığı kontrol edildi).
- **Yer tutucu/not eşliği:** her belgede Türkçe bölümdeki büyük harfli köşeli parantez işaretlerinin (`[AVUKAT: …]`, `[ÜRÜN KARARI: …]`, `[E-POSTA]`, `[30 gün]` vb.) tamamı İngilizce bölümde de var. Fark olarak yalnız Hesap ve Veri Silme ile Çerez Politikası'ndaki bağlantı metinleri (`[KVKK Aydınlatma Metni](…)` → `[KVKK Privacy Notice](…)`) çıktı; bunlar yer tutucu değil, çevrilmiş bağlantı etiketi.
- **Taslak notu:** 9 İngilizce bölümün hepsinde "No legal expert has reviewed or approved it" ifadesi var.
- `node --test scripts/*.test.mjs` → 104 test, 104 geçti, 0 başarısız.
- Core vitest koşulmadı: i18n dosyası, uygulama kodu veya bağlantı değişmedi (yalnız `docs/`).

## 5. Açık noktalar

1. Tüm İngilizce metinler hukuk uzmanı incelemesi bekliyor; Türkçe metin esastır.
2. Bölüm 3'teki tutarsızlıklar için uzman/ürün kararı; Türkçe düzeltilince İngilizce bölüm aynı commit'te eşlenmeli.
3. Web yayını (Cloudflare `/legal/*`) için Markdown → HTML derlemesi bu depoda yok; derleme yazılırken İngilizce bölüme bağlantı (ör. `#…-english` çapası veya dil düğmesi) eklenebilir. Bağlantılar bugün tek sayfaya gittiği için uygulama değişikliği gerekmez.
4. Veli Beyanı, Çocuk Modu Bilgilendirmesi ve Açık Rıza Metinleri uygulama içi metinlerdir; uygulamada gösterilecek İngilizce kısa metinler (Ek A kutucukları, Bölüm A çocuk metni) i18n'e ayrıca taşınmalı ve uzman onayından geçmeli.
5. Abonelik Koşulları'ndaki İngilizce fiyat tablosu TL referans fiyatlarını aynen taşır; DECISIONS.md'deki USD fiyatları ($3.99 / $39.99 / $7.99 / $79.99) Türkçe metinde olmadığı için eklenmedi.
6. Gizlilik Politikası İngilizce bölümünde `[AVUKAT]` notları `[LAWYER]` olarak çevrilmiş; diğer belgelerde Türkçe işaret + İngilizce açıklama kullanıldı. Yayın öncesi tek desen seçilmeli.
