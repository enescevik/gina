# Öğretmenle paylaşım (v1)

Durum: taslak, 30 Ekim 2026. Hukuki ifadeler avukat incelemesine tabidir ([AVUKAT] işaretleri).

## Ne yapar

Veli, bir çocuğu için öğretmene **salt okunur bir bağlantı** gönderir (Veli > Öğretmenle paylaş, `parent/share`). Öğretmen hesap açmaz; bağlantıyı tarayıcıda açar (`/s/<belirteç>`), oturum gerekmez. Çocuk bu akışa hiç katılmaz; AI kullanılmaz.

Veli her bağlantı için şunları seçer:

- **Etiket:** kiminle paylaşıldığı (ör. öğretmenin adı). Yalnız velinin listesinde ve raporun başlığında görünür.
- **Kapsam:** aşağıdakilerden en az biri.
- **Süre:** 7 / 30 / 90 / 180 gün (varsayılan 30, sunucu tavanı 180).

## Ne paylaşılır (kapsama göre, asgari veri)

| Kapsam | Paylaşılan | |
|---|---|---|
| Her zaman | Çocuğun **yalnız ilk adı** (ad alanının ilk kelimesi) ve **sınıfı**; bağlantının etiketi ve son geçerlilik tarihi | |
| `grades` Puanlar | Ders, puan / tam puan, tarih (son 100 kayıt) | Puan notu (`grades.note`) ve tür paylaşılmaz |
| `prova` Prova sonuçları | Deneme başlığı, ders, tarih, şıklı doğru / toplam, konu bazında doğru / toplam (son 30 deneme) | Soru metinleri, cevaplar, açık uçlu puanları ve AI geri bildirimi paylaşılmaz |
| `tasks_summary` Görev özeti | Son 30 günün **yalnız sayıları**: tamamlanan, veli onaylı, geri gönderilen | Görev adları, yıldızlar, ödüller paylaşılmaz |

**Hiçbir zaman paylaşılmaz:** notlar (öğretmen görünürlüklü notlar dâhil), PIN'ler, doğum tarihi/yılı, soyadı, avatar, takvim, aile adı ve aile üyelerinin e-posta adresleri, cihaz bilgileri.

## Nasıl iptal edilir

Veli > Öğretmenle paylaş > ilgili bağlantı > **İptal et**. İptal anında etkilidir: bağlantı bir sonraki açılışta «Bu bağlantı geçerli değil» gösterir. Süresi dolan bağlantı da aynı mesajı verir. Liste her bağlantının kapsamını, son geçerlilik tarihini, görüntülenme sayısını ve son görüntülenme zamanını gösterir. Çocuk profili veya aile silinince bağlantılar da silinir (`on delete cascade`).

## Teknik özet

- Tablo `public.child_shares` (göç `20261030130000_teacher_share.sql`). Belirteç 32 rastgele bayttır (base64url, 43 karakter); veritabanında **yalnız SHA-256 özeti** tutulur. Düz bağlantı oluşturma anında bir kez gösterilir; kaybedilirse yenisi oluşturulur.
- RLS: yalnız aynı ailenin velileri okur (özet kolonu hariç) ve siler; anon'un tabloya hiçbir yetkisi yoktur. Oluşturma/iptal `create_child_share` / `revoke_child_share` RPC'leriyle.
- Görünüm `get_shared_child_view(p_token)` (SECURITY DEFINER, anon çağırabilir): geçersiz, süresi dolmuş ve iptal edilmiş belirteç **aynı hatayı** (`invalid_share`) ve benzer gecikmeyi verir. Her başarılı açılış `view_count` ve `last_viewed_at`'i günceller. Öğretmenin IP'si veya tarayıcı bilgisi Gina veritabanına yazılmaz (Supabase/Cloudflare ağ günlükleri hariç).
- Oluşturma ve iptal, `public.audit_log` varsa denetim izine yazılır (belirteç ve özeti yazılmaz).
- Web sayfası `noindex, nofollow` ve `no-referrer` meta etiketleriyle sunulur; Cloudflare Pages'te `/s/*` için `X-Robots-Tag: noindex` başlığı ve `Referrer-Policy: no-referrer` da eklenmelidir (`_headers`).

## KVKK notları (hukuki metinler için)

- **Niteliği:** Paylaşımı veli başlatır; Gina, velinin talimatıyla ve velinin seçtiği alıcıya, velinin seçtiği verileri iletir. Öğretmen Gina'nın alt işleyeni değildir; bağlantıyı açtıktan sonra gördüğü bilgiler bakımından kendi sorumluluğundadır. [AVUKAT: paylaşımın KVKK m.8 anlamında «aktarım» mı, yoksa velinin kendi verisini/çocuğunun verisini velayet hakkıyla üçüncü kişiye açması mı sayılacağı; Gina'nın bu akıştaki rolü (veri sorumlusu / aracı)]
- **Hukuki sebep önerisi:** veli talebiyle sunulan özelliğin ifası (m.5/2-c); veli, çocuk adına velayet hakkıyla hareket eder. Ayrı açık rıza alınması gerekip gerekmediği avukata sorulacak. [AVUKAT]
- **Çocuk verisi:** veri asgaridir (ilk ad + sınıf + seçilen akademik özetler). Okul notları özel nitelikli kişisel veri değildir, ancak çocuk verisi olduğundan hassasiyetle ele alınır; v1'de sağlık benzeri veri yoktur ve paylaşılmaz.
- **Aydınlatma metnine eklenecekler (öneri):** «Öğretmenle paylaşım» amacı; paylaşılan veri kategorileri (yukarıdaki tablo); alıcı grubu «velinin seçtiği öğretmen/eğitimci»; bağlantının süreli ve her zaman iptal edilebilir olduğu; görüntülenme sayısının ve son görüntülenme zamanının tutulduğu.
- **Gizlilik politikasına eklenecekler (öneri):** paylaşım bağlantısı kayıtlarının (etiket, kapsam, süre, görüntülenme sayısı) saklama süresi: bağlantı iptal edildikten veya süresi dolduktan sonra [ÜRÜN KARARI: ör. 12 ay] saklanıp silinir; çocuk profili silinince hemen silinir. Bağlantıya sahip olan herkes raporu görebilir; veli bağlantıyı yalnız güvendiği kişiye göndermeli ve şüphede iptal etmelidir.
- **Güvenlik önlemleri (m.12):** tahmin edilemez 256 bit belirteç, sunucuda yalnız özet, en fazla 180 gün, anında iptal, tüm hata türleri için tek tip yanıt, arama motorlarına kapalı sayfa, çocuk başına en fazla 20 etkin bağlantı.
- **İlgili kişi hakları:** veli, m.11 başvurusunda hangi bağlantıların kimle (etiket) ve ne zaman paylaşıldığını ve kaç kez görüntülendiğini uygulamadan görebilir.
- Etkilenen belgeler: `docs/legal/kvkk-aydinlatma-metni.md`, `docs/legal/gizlilik-politikasi.md` (işleme amaçları tablosu, alıcılar, saklama süreleri), `docs/legal/veli-beyani-ve-cocuk-profili-onayi.md`.
