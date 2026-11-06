# Gina — gelecek özellik fikirleri (yol haritası notu)

6 Kasım 2026. Kaynak: Enes'in proje sohbetindeki isteği; ek fikirler için ayrıca beyin fırtınası yapıldı.

**Bu belge uygulama değildir.** Hiçbir ekran, tablo, RPC veya Edge işi yapılmadı. Aşağıdaki maddeler ilk sürümden (TestFlight / mağaza gönderimi) sonra ele alınacak fikirlerdir. Enes her madde için kararı Claude'a bıraktı; "Öneri" satırları bu yüzden önerilen varsayılan karardır ve uygulamaya başlarken geçerli sayılır. Tüm maddeler [DECISIONS.md](DECISIONS.md)'deki ilkelere tabidir; özellikle **çocuk AI ile doğrudan etkileşmez**, üçüncü taraf analitik yok, push içeriğinde kişisel veri yok.

---

## 1. Soru beğenme (❤️) ve beğenilenler listesi — Enes'in fikri

Çocuk Prova'da gördüğü herhangi bir soruyu (deneme sırasında, sonuç ekranında ya da kitapçıkta) beğenebilir. Beğenilen sorular bir listede toplanır; her satırda sorunun hangi denemeden / senaryodan / kütüphane setinden geldiği, ders, konu, tarih ve çocuğun o soruya verdiği cevabın doğru olup olmadığı görünür.

**Öneri:**

- Beğeni **soru başına çocuk başına tek kayıt** (aç/kapa). Önerilen tablo: `question_reactions (child_id, question_id, exam_id null, reaction, created_at)`; `exam_id` sorunun hangi denemede beğenildiğini tutar, böylece "hangi soru setinde beğenildi" sorusu doğrudan cevaplanır. Aynı soru farklı denemelerde tekrar çıkarsa son bağlam yazılır, geçmiş kaybolmaz (bağlam ayrı satır olarak tutulabilir).
- Deneme **sırasında** beğeni düğmesi küçük ve sessiz olur (süreli denemede dikkat dağıtmamak için animasyon yok); asıl beğeni yeri sonuç ekranı ve soru inceleme ekranıdır.
- Çocuk tarafında liste odada kitaplığın içinde "Sevdiğim sorular" rafı olarak; veli tarafında Prova altında çocuk bazlı "Beğenilen sorular" sekmesi (ders/konu/set filtresiyle).
- Veli bu listeden tek dokunuşla **yeni deneme oluşturabilir** ("beğenilenlerden tekrar denemesi").
- Ücretsiz pakette de açık (veri küçük, bağlılığı artırır).

## 2. "Bunun gibi daha çok göster" — beğeniden ayrı mı, birlikte mi?

Enes emin olamadı; karar Claude'a bırakıldı.

**Öneri: iki ayrı sinyal, tek dokunuş akışı.** Beğeni (❤️) duygusal sinyaldir ("bu soruyu sevdim, eğlenceliydi") ve her zaman sorunun kendisine bağlıdır. "Daha çok böyle" (➕) ise öğrenme sinyalidir ve sorunun **özelliklerine** (ders, konu, kazanım, soru tipi, zorluk) bağlıdır. Gerekçeler:

- Çocuk bir soruyu kolay ve eğlenceli olduğu için beğenebilir; bunu "bu konudan daha çok ver" diye okumak yanlış kişiselleştirmeye yol açar (hep kolay sorular gelir).
- Tersine, çocuk zorlandığı bir soru tipinden daha çok isteyebilir ama soruyu "sevmemiş" olabilir.
- Ayrı tutmak veriyi temiz bırakır: beğeni listesi bir koleksiyon, "daha çok" listesi bir çalışma tercihi olur.

Akış: çocuk ❤️'ye bastığında küçük bir balon "Bunun gibi daha çok ister misin?" diye sorar (Evet / Hayır, kendiliğinden kapanır). Böylece tek dokunuşla iki sinyal toplanır ama ikisi ayrı kaydedilir. ➕ düğmesi ayrıca sonuç ekranında da tek başına bulunur.

Nasıl işler:

- **Kütüphaneden** (tüm paketler): ➕ işaretli soruların konu/kazanım/tip/zorluk etiketleriyle eşleşen kütüphane soruları, sonraki deneme önerilerinde ve "Senin için" rafında öne çıkar. Çocuk tarafı yalnız hazır, veli tarafından onaylı kütüphane sorusu görür.
- **AI ile** (Plus/Pro): ➕ sinyalleri veli alanında "Çocuğunuz şu konulardan daha çok soru istedi" kartı olarak toplanır; veli tek dokunuşla `prova-generate` ile benzer soru üretir. Çocuk AI'yi doğrudan tetiklemez (DECISIONS ilkesi). Üretim isteğine soru metni ve etiketleri gider; çocuk adı, cevabı veya kimliği gitmez.
- Veli isterse "daha çok böyle" önerilerini kapatabilir ya da çocuk başına onaya bağlayabilir.

## 3. Soruya sesli yanıt — veli iznine bağlı, varsayılan kapalı

Çocuk özellikle açık uçlu soruları yazmak yerine sesle cevaplayabilir (küçük yaşta yazma yavaş; 7 yaşındaki çocuk için büyük kolaylık).

**İzin modeli (öneri):**

- Varsayılan **kapalı**. Veli açar; açarken kısa bir açıklama ve onay ekranı görür (ne kaydedilir, nerede işlenir, ne kadar saklanır).
- İki seviye: **genel ayar** (çocuk başına: kapalı / açık) ve **Prova bazlı override** (bu denemede: genel ayarı kullan / açık / kapalı). Override her zaman kazanır; böylece veli "genelde kapalı ama bu denemede açık" ya da tersini seçebilir. Öneri: `child_settings.voice_answers boolean default false` + `exams.voice_answers_override text check in ('inherit','on','off') default 'inherit'`.
- Şıklı sorularda sesli yanıt yok (gereksiz); yalnız açık uçlu sorularda mikrofon düğmesi çıkar.
- Mikrofon izni (iOS/Android) yalnız veli özelliği açtıktan sonra ve ilk kullanımda istenir.

**Ses mi, metin mi, ikisi mi? Öneri: metne çevir, sesi saklama (varsayılan); veli isterse sesi kısa süre sakla.**

- Varsayılan akış: çocuk konuşur → cihaz üzerinde konuşmadan metne (iOS `SFSpeechRecognizer` on-device, Android `SpeechRecognizer` offline Türkçe paketi; Expo tarafında `expo-speech-recognition` gibi bir modül) → metin çocuğa gösterilir, çocuk düzeltebilir ya da "tamam" der → **yalnız metin** kaydedilir ve normal açık uçlu cevap gibi `prova-grade`'e gider. Ses dosyası cihazdan çıkmaz ve kayıttan sonra silinir.
- Gerekçe: ses kaydı çocuğun **biyometrik olarak tanımlanabilir** sesidir. KVKK'da çocuk verisi + ses, COPPA'da (2025 güncellemesiyle) ses kaydı açıkça kişisel bilgi sayılır ve yalnız isteği yerine getirmek için kısa süre tutulup silinmesi şartıyla istisna vardır. Sesi hiç saklamamak hem hukuki yükü hem depolama maliyetini en aza indirir; AI değerlendirmesi zaten metin ister.
- Seçenek (Pro, veli açarsa): "Sesli cevabı da sakla" — ses Supabase Storage'da aile klasöründe, **30 gün** saklanır ve otomatik silinir; yalnız veli dinleyebilir (çocuğun nasıl anlattığını, telaffuzunu duymak için). Sese AI veya üçüncü taraf erişmez; ses yurt dışına aktarılmaz.
- Cihazda Türkçe offline tanıma yoksa iki yol: (a) özellik o cihazda "sesle yaz" yerine klavye dikteye yönlendirir, (b) veli ayrıca izin verirse bulut tanıma. Öneri (a); bulut tanıma ayrı karar + avukat incelemesi.
- Metin kaydında `answer_input_method ('typed','voice')` tutulur; veli sonuçta hangi cevapların sesle verildiğini görür.
- Hukuk: aydınlatma metnine ve gizlilik politikasına ses işleme maddesi eklenir; `[AVUKAT]` onayı olmadan ses saklama seçeneği açılmaz. Metne çevirme cihazda olduğu sürece ek açık rıza gerekmemesi beklenir; avukata yine sorulur.

---

## 4. Ek fikirler (beyin fırtınası)

Aşağıdaki fikirler ayrı bir beyin fırtınasından geldi ve Gina ilkelerine göre süzüldü (çocuğun canlı AI ile konuşmasını gerektirenler, mevcut veriyle karşılanan kısımlara indirildi). Efor: S küçük, M orta, L büyük.

| # | Fikir | Ne yapar | Efor | Gizlilik / not |
|---|---|---|---|---|
| 4.1 | **Beğenilenlerden mini deneme** | Beğenilen + yanlış yapılan sorulardan 10 soruluk hızlı tekrar seti; veli tek dokunuşla oluşturur. Beğeniye somut bir amaç verir, yoksa liste pasif kalır. | S | Yeni veri toplamaz. |
| 4.2 | **"Zor buldum" işareti** | ❤️ ve ➕ yanında üçüncü sessiz işaret; veli konu açığını çocuğun kendi beyanıyla görür. | S | Yok. |
| 4.3 | **Konu ısı haritası (veli)** | MEB kazanımı bazında Prova sonuçları + zor/beğeni/➕ işaretleri tek tabloda; "daha çok böyle" ve tekrar önerileri buradan beslenir. | M | Yalnız veli görür; çocuklar arası kıyas yok. |
| 4.4 | **Aralıklı tekrar** | Yanlış veya "zor" sorular 1-3-7 gün sonra günlük görev olarak geri gelir; görev/ödül sistemine bağlanır. | M | Yok. |
| 4.5 | **"Neden?" düğmesi** | Sonuç ekranında soruyla birlikte saklanan çözüm yolu ve anlatımı adım adım açar. Canlı AI çağrısı yok; içerik üretimde veli tarafında hazırlanmış olur. | S | Çocuk AI ile etkileşmez (DECISIONS). |
| 4.6 | **Soruyu sesli okuma (TTS)** | Sesli yanıtın tersi: okuma güçlüğü olan ya da küçük çocuk için soruyu cihazda seslendirir. Aynı izin modeli (genel + Prova bazlı override); varsayılanı açık olabilir çünkü veri toplamaz. | S | Cihaz içi TTS, veri çıkmaz. |
| 4.7 | **İzin ve denetim paneli** | Sesli yanıt, TTS, AI özeti, öğretmen paylaşımı izinleri tek ekranda; kim, ne zaman açtı kaydı; ses saklama süresi (varsayılan: yalnız metin, ses 0 gün). Sesli yanıtın ön koşulu. | S/M | KVKK açık rıza kaydı için gerekli. |
| 4.8 | **Sesli cevap metni incelemesi** | Veli son sesli cevapların metnini görür, yanlış tanımayı düzeltir, toplu siler. Metinler model eğitimi için kullanılmaz. | S | Saklama süresi ayarlanabilir. |
| 4.9 | **Öğretmene "zorlandığı konular"** | Mevcut öğretmen paylaşımı üzerinden zor/➕ listesi ve ısı haritası özeti; ham cevaplar değil özet. | M | Veli onayı + ders bazlı kapsam. |
| 4.10 | **Haftalık özete Prova bölümü** | Mevcut AI haftalık özete (Plus/Pro) güçlü/zayıf konular, beğeni ve tekrar sayıları, önerilen 3 adım eklenir. | S | AI'ya takma adlı girdi (mevcut kural). |
| 4.11 | **Odada "Günün sorusu"** | Çocuk odasında günde bir soru, beğenilen/➕ işaretli konulardan kütüphaneden seçilir; cevaplayınca rozet puanı. | S | Yok. |
| 4.12 | **Soru rozetleri** | Beğeni koleksiyonu, seri gün, tekrar tamamlama gibi davranışlara rozet; mevcut ödül sistemi. | S | Yok. |
| 4.13 | **Soruyu bildir** | Çocuk ya da veli hatalı/uygunsuz soruyu tek dokunuşla işaretler; backoffice'te içerik kalite kuyruğu ve AI sorusunun kütüphaneden çekilmesi. | S | AI içerik güvenliği için önemli. |
| 4.14 | **Favori defteri** | Beğenilen sorular ders/konu defterlerine ayrılır, kitapçık PDF'i olarak basılır (mevcut kitapçık altyapısı). | M | PDF'te çocuk adı isteğe bağlı. |
| 4.15 | **Uyarlanabilir zorluk** | Seviye tespiti + sonuçlar + işaretlerle sonraki denemelerin zorluk dağılımı kendiliğinden ayarlanır. | L | Profil verisi aile içinde kalır. |

**Önerilen ilk üçü:** 4.1 (beğeniyle aynı sürümde, S), 4.7 + 4.8 (sesli yanıtın ön koşulu), 4.3 (sonraki kişiselleştirme ve öğretmen paylaşımının veri temeli). 4.5, 4.6 ve 4.13 küçük oldukları için aynı dönemde alınabilir.

---

## 5. Önerilen sıra

1. Beğeni + beğenilenler listesi (§1) — küçük, ilk güncellemede çıkabilir, sonraki her şey bu veriyi kullanır.
2. "Daha çok böyle" kütüphane eşleştirmesi (§2), sonra AI yolu.
3. Sesli yanıt, yalnız cihaz üstü metne çevirme (§3); ses saklama seçeneği avukat onayından sonra.
4. §4'teki ilk üç öneri.

Sıra Enes'in yeni önceliğiyle değişebilir; değişiklik bu dosyaya ve [DECISIONS.md](DECISIONS.md)'ye yazılır.
