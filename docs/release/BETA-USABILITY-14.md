# Beta kullanım düzenlemeleri — TestFlight 14 hazırlığı

2 Kasım 2026. PR #46 main’e alındı (`a8f53f2`). **0.1.0 (14) TestFlight’ta yayında.** Apple durumu `VALID / IN_BETA_TESTING`; 2 Kasım 2026 07:45 UTC kontrolünde doğrulandı. Bu belge önceki sürümün yerine yeni bir tasarım yönü tanımlamaz; onaylı mint maskot, mor/krem arayüz ve özgün oda resmi korunur.

## Değişen deneyim

- Ebeveyn ana ekranı bugün yapılacak işleri öne alır. Boş onay ve sıfır ilerleme alanları, yinelenen görev/Prova/ödül kısayolları çıkarıldı. Gerçek içerik olduğunda ilgili alan görünür. Görev, takvim ve hedef boşluklarında ilgili görsel ve tek bir sonraki adım gösterilir.
- Tek çocuk olduğunda ana ekran/takvim/görev filtreleri gizlenir; çocuk moduna giriş ve form seçimleri tek çocuğu otomatik kullanır. Aile geneline ait notların kapsam seçimi korunur.
- Ana ekran, takvim, görev ve ödül menüleri alt güvenli alanı kendi zeminleri içinde karşılar; dışarıda ikinci bir alt şerit bırakmaz.
- Çocuk ekleme: ad/takma ad ve avatar → doğum yılı, sınıf, isteğe bağlı cinsiyet/ilgi alanları → seçilebilir ve düzenlenebilir başlangıç rutinleri → son kontrol. Okul adı ve tam doğum tarihi istenmez. Okul öncesinde birlikte okuma önerilir; okula gitmeyen çocukta çanta rutini gösterilmez. Cinsiyet görev veya yetenek sınırı değildir.
- Çocuk ve seçili rutinler tek işlemde kaydedilir. Bağlantı sonrası tekrar deneme aynı profili/rutinleri çoğaltmaz; hata tüm işlemi geri alır. Paket sınırları sunucuda kalır.
- Görev ve ödül ekleme üç adımlıdır: şablon/özel fikir, düzenleme, önizleme. Yıldız, gün ve simgeler düzenlenebilir. Kaydedilmemiş taslakta çıkış uyarısı vardır.
- Hedef belirleme: çocuk ve aile kataloğundaki ödül → son kontrol. Hedef seçmek yıldız harcamaz. Aynı hedefin tekrar seçilmesi mükerrer geçmiş kaydı oluşturmaz; başka aileye ait çocuk için işlem reddedilir.
- Çocuk ana ekranı yatay telefon ve tablette tüm onaylı oda kadrajını orantılı gösterir. Sağ panel bağımsız kayar; kısa yatay telefonlarda başlık ve menü küçülür, 48 dp dokunma hedefleri korunur. Kaynağın oranını değiştirmek yerine gerektiğinde krem boşluk kalır. Dikey kullanım korunur.
- Çocuk haftası, Prova ve koleksiyon boş durumlarına açıklayıcı görseller eklendi. Haftalık ilerleme ve takvim ayrı adlandırıldı. Alt sayfalardaki sahne/panel negatif örtüşmesi kaldırıldı.
- Büyük yatay kaymalar yerine kısa geçiş kullanılır; sistemde Hareketi Azalt açıkken animasyon kapanır. Sürekli büyüyüp küçülen maskot efekti eklenmedi.

## Test paketi

`Diğer → Hesabım → Paketler → Beta · Paket denemesi`: Free, Plus, Pro. Erişim yalnız sunucudan açıkça izin verilmiş veli/aileye ve süreli olarak verilir; istemci bayrağıyla açılmaz. Çocuklar veya diğer kullanıcılar kendilerine bu yetkiyi veremez.

Seçim gerçek abonelik kaydını değiştirmez, satın alma başlatmaz. “Gerçek paketimize dön” veya sürenin dolması, mevcut mağaza/manuel paketine geri döndürür. Test planı aileye uygulanır; aile üyeliği bittiğinde yetki geçersiz olur. Plan değiştirmek kullanılan AI kotasını sıfırlamaz. Free’ye geçerken mevcut çocuk/görevler silinmez; yeni oluşturmalarda o planın sınırları uygulanır.

Kurulum AI önerileri için ayrı aylık sınır: Free 0, Plus 10, Pro 30 üretim isteği. Bir istek en fazla üç düzenlenebilir taslak verir. İstekler sunucuda ayrılır, tekrarlar aynı sonucu kullanır, başarısız üretim kotayı tüketmez. Çocuk adı, okul adı, doğum yılı ve cinsiyet modele gönderilmez; yalnız yaş aralığı, sınıf ve sabit listeden ilgi alanları kullanılabilir. Öneri kendiliğinden çocuğa atanmaz.

## Kanıt ve sınırlar

[Ekran galerisi](evidence/beta-usability/index.html). Görseller çalışan uygulamadan alınmıştır; maket değildir. Tarayıcı ve iPhone 17 Pro / iOS 26.5 simülatörü, gerçek veritabanına bağlanmayan bellek içi örnek API ile test edildi. Ece/Emre/Deniz gibi görünen örnek kayıtlar gerçek aile kayıtlarını değiştirmez. AI görsel akışının örnek yanıtı gerçek Anthropic üretimi değildir.

- Tüm çalışma alanı lint/typecheck/test: geçti; core 22 test.
- Statik native metin ve yayın kontrolleri: 7 test geçti.
- İzole veritabanı: 22 dosyada 360 pgTAP kontrolü geçti. Mevcut yerel demo veritabanı sıfırlanmadı, yeniden tohumlanmadı.
- Edge: 24 test geçti; yeni fonksiyonun Deno kontrolü geçti.
- Elle: tek çocuk seçimi, boş/dolu ana ekran, görev oluşturma/düzenleme/önizleme, kaydetmeden çıkış uyarısı, çocuk kurulumunda geçersiz yıl, örnek AI taslağı seçimi, ödül kaydı, hedef kaydı, Free/Pro değişimi, çocuk PIN girişi ve ebeveyn PIN çıkışı.
- Telefon: 390×844; tablet: 1280×800; yatay telefon: 844×390. Native simülatörde ana ekran, görev sihirbazı ve çocuk odası dikey/yatay açıldı. Gerçek iPhone 14 Pro Max ve Android cihaz kontrolü henüz yapılmadı.
- Canlı AI anahtarı mevcut olmadığı için gerçek soru, Prova ve yeni kurulum önerisi üretimi doğrulanmadı. Yeni anahtar Supabase → gina-prod → Edge Functions → Secrets → `ANTHROPIC_API_KEY` alanına kaydedilmeli; sohbete gönderilmemeli.
- Gün/gece, canlı atmosfer, yeni 3B sahne ve yeni maskot animasyonları bu sürümün kapsamında değil. Önceki SMTP/mağaza/gerçek OAuth test eksikleri [önceki yayın notunda](FAMILY-EXPERIENCE-13.md) korunur.

## Dağıtım

Beş ek migration: beta erişimi, çocuk kurulumu, hedef yetki kontrolü, AI taslak kotası ve aylar arası tekrar kotası. Yeni Edge Function: `setup-suggestions`. Mevcut mağaza ürünleri, demo verileri ve onaylı sanat dosyaları değiştirilmez. 2 Kasım 2026: beş migration üretime uygulandı ve `setup-suggestions` dağıtıldı. İstekte bulunan Enes veli hesabına Çevik Ailesi için 2 Aralık 2026’ya kadar beta erişimi verildi; başlangıçta herhangi bir test paketi seçilmedi. EAS build: `c31d8553-ac2b-486c-91be-ac630e67f0ed`, kaynak `a8f53f26d2c1dfdfe9fe5b399b6572fd6f458d96`. Ay değişiminden sonra yeniden denenen başarısız AI isteğinin yeni ayın kotasına sayılması ek testle düzeltildi ve üretime uygulandı. Apple gönderimi: `5bae0467-d7c7-45fc-a70e-c2954cb45e91`; yükleme tamamlandı ve iç beta testine açıldı. Gerçek cihazda bu yeni sürümü kullanıcı sınayacak.
