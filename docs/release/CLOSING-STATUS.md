# GINA — tek güncel kapanış tablosu

6 Kasım 2026 akşamı. Bu tablo `continuation-2026-11-06/PROGRESS.md`, `overnight-2026-11-06/PROGRESS.md` ve C/D raporlarındaki durum sütunlarının **yerini alır**. Eski tablolardaki "KOD HAZIR / yayımlanmadı" ifadeleri tarihseldir.

Durumlar:
- **TAMAM**: kod main'de, üretimde ve gerekli kabul kanıtı var.
- **CANLIDA, TEST BEKLİYOR**: üretimde ama cihaz ya da gerçek servis kabulü eksik.
- **MAIN'DE, YAYIN BEKLİYOR**: kod hazır, üretime çıkmadı.
- **YAPILIYOR**: üzerinde çalışılıyor.
- **DIŞ ENGEL**: başka bir hesap ya da kişiye bağlı.
- **ERTELENDİ**: bilerek sonraya bırakıldı; kabul sayılmaz.

Üretim seviyesi: ledger 146 (son `20261106390000`); web `1c0cf214`; yönetim `30000ffb`; tablet 29 `b9q067lwk9`; iOS 29 gönderildi (`d9628cbd`).

| İş | Durum | Kanıt / kalan |
|---|---|---|
| C00 envanter | TAMAM | continuation PROGRESS §C00 |
| C01 köken etiketleri | CANLIDA, TEST BEKLİYOR | C14; cihaz kabulü C15 |
| C02 ders bağı, tarihli görünümler | CANLIDA, TEST BEKLİYOR | C14; C15 |
| C03 geri gönderme nedeni | TAMAM | C14; izole + canlı smoke |
| C04 Prova merkezi | CANLIDA, TEST BEKLİYOR | Gerçek AI üretimi C14b'de geçti; cihaz C15 |
| C05 kaynak çıkarımı | CANLIDA, TEST BEKLİYOR | MEB gerçek zinciri D15 pilotu |
| C06 tek eşleme yolu | CANLIDA, TEST BEKLİYOR | C15 fiziksel cihaz |
| C07 rol matrisi | TAMAM | pgTAP 113, C14 |
| C08 AI sağlayıcı yönlendirmesi | TAMAM (Anthropic) / DIŞ ENGEL (X04) | Gerçek Anthropic D5 + C14b; OpenAI/Gemini anahtarı yok |
| C09 AI ön inceleme | ERTELENDİ | Kapı kapalı; K01'den önce açılacak (sır + pg_cron + pilot) |
| C10 bildirim kanalları | DIŞ ENGEL | X01 alan adı/SMTP, X02 SMS/Firebase |
| C11 takvim, mağaza, hukuk metinleri | CANLIDA / DIŞ ENGEL | Mağaza ve hukuk onayı (X03); metin uyumu D16 |
| C12 ekran incelemesi | CANLIDA, TEST BEKLİYOR | Matris §5; fiziksel erişilebilirlik C15 |
| C13 güvenlik ve performans | TAMAM / ERTELENDİ | AUTH-1 kapandı. **Barındırılan ortamda tam geri yükleme / PITR tatbikatı ertelenmiş kabul işi; tamamlanmış değil.** |
| C14 ara yayın 1 | TAMAM | c14-2026-11-06/PLAN.md |
| C14b ara yayın 2 | TAMAM | c14b-2026-11-06/PLAN.md |
| C15 cihaz kabulü | DIŞ ENGEL (Enes) | 29/30 kurulumu; çocuk cihazı, kalem, yön, VoiceOver, yazı boyutu, bildirim, OAuth |
| D1 AI ortak kaynak grupları | TAMAM | Canlıda gerçek grup kuruldu (C14b) |
| D2 PIN'siz çocuk modu, eşleme onayı | CANLIDA, TEST BEKLİYOR | C15 |
| D3 operatör kapsamı, kanal hataları | TAMAM | C14b |
| D4/D8 ekran devirleri, PDF yazı tipi | CANLIDA, TEST BEKLİYOR | D8-1: fiziksel cihaz PDF (C15) |
| D5 gerçek AI kabulü | TAMAM | d5 + c14b/ai |
| D6 puanlama düzeltmesi (B1) | TAMAM | C14b'de canlı 200 + `accept_ai_grade` |
| D7 içerik operatörü taslak kabulü | TAMAM | C14b |
| D9 ortak metin puanlama, rubrik 100, kişi adı | TAMAM | C14b canlı: rubrik 100 |
| Puanlama alternatif cevap kuralı | MAIN'DE, YAYIN BEKLİYOR (D13) | `prova-grade/v7-purpose-aware`: yalnız sonuç / süreç / sorudan çıkar; gerçek model kontrolü `d13/run-d13.mjs` yayında. Veli rubriğinde amaç seçici yok (migration gerekir) |
| D10 kişi adı uyarısı veliye | MAIN'DE, YAYIN BEKLİYOR | migration `400000`, pgTAP 126 |
| D11 yönetim P2 düzeltmeleri | MAIN'DE, YAYIN BEKLİYOR | Playwright 7/7 |
| D12 aile süzgeci, denetimde yönetici adı | MAIN'DE, YAYIN BEKLİYOR | migration `410000`, pgTAP 127; önce migration sonra yönetim yayını |
| D14 AI sorusunu düzenleme | YAPILIYOR | D10 notu şimdilik yalnız atla/yeniden yaz diyor |
| D15 MEB gerçek kabul pilotu | YAPILIYOR | Resmî senaryo → gerçek AI üretimi → atanmış sınav; K01'den önce |
| D16 teknik/hukuk metin uyumu | MAIN'DE (metin) | İngilizce gizlilik eşitlendi, 8 karakterli eşleme, şirket kurma ön şart değil. Hukuk onayı dışarıda (X03). İngilizce Kullanım Koşulları yok |
| D17 eşleme saklama işleri, eski eşleme testleri | YAPILIYOR | Gizlilikteki "90 gün kullanılmayan eşleme kaldırılır" vaadi kodda yoktu |
| D11 kararları K3/K4/K5 | ERTELENDİ | DECISIONS.md |
| X01 alan adı / SMTP | DIŞ ENGEL | Canlıya alırken |
| X02 Firebase / Play / SMS | DIŞ ENGEL | Android iç test |
| X03 mağaza ve hukuk onayı | DIŞ ENGEL | Bireysel geliştirici olarak başlanır (DECISIONS); şirket kurulması zorunlu engel değildir |
| X04 OpenAI / Gemini | DIŞ ENGEL | Anahtar |
| X06 bağımsız editör | DIŞ ENGEL | K01 onay/yayın sayıları buna bağlı |
| K01 kütüphane üretimi | ERTELENDİ (Enes, 6 Kasım 17:09) | 100 taslak / 1.440 eksik / 0 onay / 0 yayın |
| R02 son yayın | ERTELENDİ | K01 ve dış kabullerden sonra |
| WORLD-01 3B dünya | ERTELENDİ | En son |

## Claude'un tamamlayabileceği / dış erişim bekleyen ayrımı

- **Claude (şimdi):** D12, D13, D14, D15, D16, ardından üçüncü küçük yayın (onayla), içinde puanlama ve MEB pilotunun gerçek model doğrulaması. C09 kapısının açılması K01'den önce.
- **Enes:** C15 cihaz kabulü, yayın onayları, K01 başlama kararı.
- **Dış:** X01, X02, X03, X04, X06; barındırılan geri yükleme tatbikatı için ayrı proje/maliyet kararı.
