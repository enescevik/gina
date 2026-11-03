# Birlikte Prova — sürümlü kütüphane bağlantısı

4 Kasım 2026. Mevcut yönetim ekranı ve ortak GINA tasarımı genişletildi; yeni bir tasarım alternatifi üretilmedi.

## Davranış

- İncelenmiş/yayımlanmış paket veya önceki metin koleksiyonu seçilebilir. Paket sürümü kontrol edilir; güncel inceleme ve medya doğrulaması zorunludur.
- Ortak metin/görsele bağlı sorular tek seçimdir. Üç soruluk bir grup toplam sayıya üç olarak eklenir; tek tek koparılamaz. Seçim toplamı 3–50 sorudur.
- Otomatik sıralama yalnız çoktan seçmeli soruları kabul eder. Açık uçlu soru içeren birim pasiftir ve nedeni görünür. Bu kapsam ÖYSS/açık uçlu toplu puanlama olarak sunulmaz.
- Kaynak paketin izin vermediği erişim paketi seçilemez; sunucu da aynı sınırı uygular. Soruları ve görselleri ayrı inceleme ekranında açan bağlantı vardır.
- Yayında öğrenci içeriği, ortak kaynak, görsel referansı ve cevap anahtarı sabitlenir. Katılımda aileye ait bağımsız soru/context kopyası ve tek ortak medya kaydı oluşturulur. Normal kütüphane kotasından ikinci kez düşülmez; mevcut toplu Prova ve standart Prova sınırları uygulanır.
- Kaynak incelemesi geri çekilirse veya paket arşivlenirse yeni katılım durur. Atanmış çalışmanın içerikleri ve mevcut katılımı kurtarma işlemi korunur. Gerekirse mevcut toplu Prova ayrıca iptal edilir.
- Yayın isteği yöneticiye özel kalıcı tarayıcı kuyruğunda saklanır. Yanıt kaybı/yeniden açılış aynı isteği tekrarlar; yeni yayın oluşturmaz. Oturum değişimi ortak kuyruk temizleme sözleşmesini kullanır.

## Kabul kanıtı

- 47 dosyada 1.177 SQL kontrolü geçti; bu artımda 42 yeni kontrol: paket sürümü/erişimi, ortak kaynağı bölmeyi reddetme, açık uçlu soruyu sıralamaya almama, yayın/katılım tekrarları, kaynak/görsel/anahtar bütünlüğü, kapalı medya özelliğinde atomik geri alma, çocuk görünümü ve cevaplama, özel cevapların erişim sınırı, inceleme/arsiv geri çekme ve aile silme temizliği.
- 2 gerçek eşzamanlı veritabanı testi: aynı çocuk iki katılım isteğinde tek sınav/tek görsel/dört soru; katılım ile kaynak yayından kaldırma yarışı tutarlı. Yalnız atılabilir denetim kopyaları kullanılır (`scripts/test-group-package-races.py`).
- Gerçek Next.js ekranında sentetik ağ fixture: ortak grup + bağımsız soru = 4; açık uçlu birim pasif; izinsiz paket pasif; yayın yanıtı kesildi, sayfa yeniden açıldı, aynı gövde/kimlikle iki istek yalnız bir Prova oluşturdu. Bekleyen işlem varken yeni yayın formu kilitli.
- `desktop.png`: seçim ekranı. `recovery-tablet.png`: kalıcı yayın isteği kurtarma. Gerçek cihaz veya gerçek aile kayıtları değildir.
- Yönetim typecheck, lint ve üretim derlemesi geçti. Yeni bağımlılık eklenmedi.

## Açık kalanlar

Üretime dağıtılmadı; `cohorts.enabled` açılmadı. Gerçek iPhone/iPad görsel teslimi/push ve kontrollü içerik yayını kabulü açık. Açık uçlu toplu değerlendirmede inceleme/itiraz ve puan eşleştirme politikası henüz uygulanmış değildir. Kütüphane içerik havuzu ve müfredat incelemesi bu artımla tamamlanmış sayılmaz.
