# GINA gelecek özellikleri — yürütme planı

7 Kasım 2026. Kaynak main `694f4759`; kaynaklar FUTURE-IDEAS §1–§8, DECISIONS, PROVA, QT planı ve güvenlik kayıtlarıdır. Kullanıcı doğrudan main'e küçük commit, yeşil yerel lint/tip/test ve fazlar arasında otonom ilerleme istedi. İki aktif dal (`codex/library-batch-review`, `codex/content-review-calibration`) değiştirilmeyecek. İzole çalışma ağacı kullanılır; main ilerlerse push öncesi uzlaştırılır.

## Kesin kapılar ve kararlar

- Çocuk AI ile konuşmaz; AI yalnız veli başlatır, mevcut izin/hak/kota/idempotency kullanılır. Push kişisel veri içermez. Reklam/analitik SDK yok.
- [AVUKAT]/[DOĞRULA] işaretleri onay değildir: ses saklama, ses aktarımı, Öğretsen verisi/ödeme yönlendirmesi, meet kaydı **hukuk onayı bekliyor**; uygulama yok. Sağlık/tanı çıkarımı yok.
- Her güvenlik bulgusu düzeltme + olumsuz test + tarihli `docs/security/` kaydı olur (§6.1). Yeni tablo RLS + aile sınırı pgTAP; özel anahtar yalnız izinli sonuç kapısından. Çocuk hata dili güvenli ve kıyassız; bütün metinler TR/EN.
- ❤️ kalite/kişisel tercih, ➕ çocuğa özel süreli öğretim kararıdır. İkisi otomatik puan veya ödül üretmez. “Zorlandım” dürüst bir beyan olarak kalır; davranışa rozet vermiyoruz (kaynak içindeki çelişki bu yönde çözüldü).
- S/M/L göreli efordur; saat veya bitiş garantisi değildir. KOD HAZIR, YAYINDA ve CİHAZ KABUL ayrı durumlardır. Dış kapı için sahte başarı yazılmaz.

## Kod envanteri: olan / eksik

| Kaynak | Kodda olan | Eksik |
|---|---|---|
| §1–2 | `question_bank`, çocuk/deneme bağı, veli hazırlama/inceleme, sürümlü QT anahtarları | Reaksiyon/odak tabloları, favori listesi, çocuk sinyali ve öneri sessizliği |
| §3/3a | Cevap metni/defteri, veli puanlama, mevcut izin/kanal ayarları | Sesli cevap, cihaz TR desteği; güven/mola/erteleme tercihlerinin yeni akışla birleşimi |
| §4 | `parent/prova/repeat`, plan ve progress; kitapçık/PDF, kaynak/katkı inceleme | Sinyal temelli ısı haritası/tekrar; soru bildirimi, TTS, favori PDF ve günün sorusu |
| §6 | `.github/workflows/security.yml`, audit, bilgi amaçlı leak scan; `scripts/security/post-restore-acl-check.sql`, izole pgTAP/Edge testleri; PIN/eşleştirme sunucu yolları | Dependabot/CodeQL; engelleyici sır taraması; genel migration kuralı, sistematik TR/EN enjeksiyon seti; oran sınırı kapsamının olumsuz testlerle doğrulanması |
| §7 | Takvim/görev, öğretmen paylaşımı altyapısı | Öğretsen hesap sözleşmesi, aktarım rızası, eğitmen uygunluğu, meet/ödeme doğrulaması |
| §8 | 14 tür Faz 0–2B, `question_answer_keys`, v4 kayıt/idempotency; crossword sunucu/core kapalı | Sürümlü düzenleme, grup/kütüphane yeni türler, global save RPC, gerçek sağlayıcı×tür ve fiziksel kabul; QT43/QT51 |

Envanter “eski fikir belgesinde yok yazıyor” diye mevcut kodu yeniden yapmak için kullanılmaz. F1 uygulama öncesi somut ekran: `prova-builder-ui.tsx` soru önizlemesi; başlangıçta burada beğeni, Prova'da ayrı favori listesi. AI ile benzer üretim F2'de mevcut üretim akışına bağlanır.

## Fazlar ve kabul

Durum geçişi: PLANLANDI → YAPILIYOR → KOD HAZIR → YAYINDA → KABUL TAMAM. Her faz test kanıtı ve açık sınırla güncellenir. Önce F1–F4 küçük veri/erişilebilirlik işleri; sonra F5 güvenlik, F6–F9 kişiselleştirme; ses/Öğretsen/QT Faz 3 en son. B1/B3 güvenlik ve işletim bağımlılıkları F5 ile birlikte alınır; B2/B4 fiziksel/dış kapı bekler.

### F1 — Veli ❤️, geri alma ve beğenilen sorular listesi

- Kaynak: §1, §2. Durum: KOD HAZIR (yerel kontroller; üretim/cihaz kabulü ayrı). Efor: **S**.
- Kapsam: Veli ❤️, geri alma ve beğenilen sorular listesi.
- Bağımlılık: Soru bankası, aile oturumu.
- Paket kapısı: Tüm paketler.
- Kabul: Yalnız veli kendi beğenisini yazar; tekrar istek mükerrer değildir; soru silinirse beğeni silinir; liste aile/veli sınırında.
- Test planı: pgTAP: yabancı aile/soru, cihaz, anon, sahte kullanıcı, tekrar/geri alma; mobil tip/lint.

### F2 — Çocuk ❤️/zorlandım; veli ➕ süreli tercih; pekiştirme kartı ve mini deneme

- Kaynak: §1, §1.1–1.2, §4.1–2. Durum: PLANLANDI. Efor: **M**.
- Kapsam: Çocuk ❤️/zorlandım; veli ➕ süreli tercih; pekiştirme kartı ve mini deneme.
- Bağımlılık: F1, atanmış soru erişimi, sonuç/tekrar RPC.
- Paket kapısı: Sinyaller ve kütüphane tüm paketler; AI mevcut hak ve izinle.
- Kabul: ➕ çocuk başına, süreli; aynı kazanıma geç sonrası 7 gün sessizlik; çocuk puanı etkilenmez; kart yalnız veliye; kolaydan asıl düzeye 3–5 soru.
- Test planı: Aile/kardeş/atanmamış soru reddi; idempotency; süre ve gün sınırı; kart ret/tekrar senaryosu.

### F3 — Sonuçta kayıtlı çözüm yolunu aç; cihaz TTS

- Kaynak: §4.5–6. Durum: PLANLANDI. Efor: **M**.
- Kapsam: Sonuçta kayıtlı çözüm yolunu aç; cihaz TTS.
- Bağımlılık: Sonuç yetkisi, Expo 58 TTS dokümanı.
- Paket kapısı: Tüm paketler.
- Kabul: Aktif denemede cevap anahtarı sızmaz; çözüm yalnız sunucu sonuç kapısı izin verirse; TTS genel+deneme override, durdurma; çocuk AI çağrısı yok.
- Test planı: Devam eden deneme olumsuz testi; TTS arka plan/ekran değişimi/döndürme ve cihaz offline doğrulama.

### F4 — Çocuk/veli soruyu bildir; yönetimde kalite kuyruğu

- Kaynak: §4.13. Durum: PLANLANDI. Efor: **M**.
- Kapsam: Çocuk/veli soruyu bildir; yönetimde kalite kuyruğu.
- Bağımlılık: Atanmış soru erişimi, backoffice rolü.
- Paket kapısı: Tüm paketler.
- Kabul: Sabit neden seçimi; aile başına sınır; bildirim otomatik suçlama/geri çekme yapmaz; yönetici gerekçeyle karar verir.
- Test planı: Başka aile, yetkisiz moderasyon, mükerrer bildirim ve oran sınırı; çocuk güvenli hata.

### F5 — Güvenlik temelleri: bulgu→test kuralı, Dependabot, CodeQL, engelleyici sır taraması, migration RLS denetimi, PIN/giriş oran sınırı, enjeksiyon seti

- Kaynak: §6.1–6.4. Durum: PLANLANDI. Efor: **L**.
- Kapsam: Güvenlik temelleri: bulgu→test kuralı, Dependabot, CodeQL, engelleyici sır taraması, migration RLS denetimi, PIN/giriş oran sınırı, enjeksiyon seti.
- Bağımlılık: Mevcut security.yml, ACL betiği, PIN/Auth/Edge yolları.
- Paket kapısı: Paket bağımsız.
- Kabul: Her somut açık düzeltme+olumsuz test+kayıt; CI başarısızlığı push öncesi engel; 30–50 TR/EN enjeksiyon vakası; istemci yanıtına güven yok.
- Test planı: Bilerek kusurlu migration/secret fixture reddi; eşzamanlı PIN, hesabı kilitleyerek saldırı, token sızıntısı, sahte AI çıktısı; canlı ücretli test ayrı.

### F6 — Hata güvenli/kıyassız dil; mola/akşam tercihleri; izin ve denetim görünümü

- Kaynak: §3a, §4.7. Durum: PLANLANDI. Efor: **M**.
- Kapsam: Hata güvenli/kıyassız dil; mola/akşam tercihleri; izin ve denetim görünümü.
- Bağımlılık: Mevcut izinler, bildirim sessiz saatleri.
- Paket kapısı: Tüm paketler.
- Kabul: Sağlık etiketi depolamadan bugün ertele; beğeni/zorlanma puanı yok; yaş süreleri öneri, tıbbi iddia değil; tercihler geri alınır.
- Test planı: TR/EN metin; gece/timezone; izin iptali; kardeş kıyası bulunmaması; ekran okuyucu/büyük yazı.

### F7 — Veli kazanım ısı haritası, 1–3–7 tekrar ve haftalık özet

- Kaynak: §4.3–4, §4.10, §3a. Durum: PLANLANDI. Efor: **L**.
- Kapsam: Veli kazanım ısı haritası, 1–3–7 tekrar ve haftalık özet.
- Bağımlılık: F2 sinyalleri, tamamlanmış puanlar, mevcut plan üretimi.
- Paket kapısı: Harita/manuel tekrar tüm paketler; AI özet mevcut ücretli hak.
- Kabul: Cevapsız/puan bekliyor 0 başarı sayılmaz; yetersiz örnek belirtilir; çocuklar arası kıyas yok; tekrar tekil, iptal/erteleme mümkün.
- Test planı: Kısmi puan/eksik veri, DST/timezone, çift cron, silinen çocuk, plan iptal ve tekrar dağılımı.

### F8 — Öğretmene kazanım özeti; favori PDF; uyarlanabilir zorluk

- Kaynak: §4.9, §4.14–15. Durum: PLANLANDI. Efor: **L**.
- Kapsam: Öğretmene kazanım özeti; favori PDF; uyarlanabilir zorluk.
- Bağımlılık: F7, veli onayı, soru sürümü.
- Paket kapısı: Mevcut paylaşım/PDF hakları; tür kapısı yok.
- Kabul: Ham cevap aktarılmaz; paylaşım kapsamı/süresi/iptali; zorluk önerisi veli onaylı ve açıklanabilir; sabit şema dengesi.
- Test planı: Paylaşım iptali/başka aile, PDF anahtar sızıntısı, küçük örneklem ve aşırı tek konu önerisi.

### F9 — Günün sorusu ve öğrenme odaklı rozetler

- Kaynak: §4.11–12. Durum: PLANLANDI. Efor: **M**.
- Kapsam: Günün sorusu ve öğrenme odaklı rozetler.
- Bağımlılık: F7; görev/rozet idempotency.
- Paket kapısı: Tüm paketler, erişilebilir içerikle.
- Kabul: Çocuğun beğenisine puan yok; yalnız öğrenme tamamlamasına; gece baskısı ve seri kaybı yok.
- Test planı: Aynı soruyu yeniden açma ödül çoğaltmaz; mola/akşam; çevrimdışı tekrar.

### F10 — Cihaz üstü ses→metin cevap ve veli metin düzeltme/silme

- Kaynak: §3, §4.8. Durum: PLANLANDI. Efor: **L**.
- Kapsam: Cihaz üstü ses→metin cevap ve veli metin düzeltme/silme.
- Bağımlılık: F6; mikrofon/yerel TR desteği; hukuk değerlendirmesi.
- Paket kapısı: Metne çevirme erişilebilirlik; AI puanlama mevcut hak.
- Kabul: HUKUK ONAYI BEKLİYOR: ses işleme çerçevesi netleşene kadar uygulama yok. Onay sonrası yalnız cihaz içi; destek yoksa klavye; ses saklama/buluta aktarım yok.
- Test planı: Onay sonrası ağsız cihaz ve izin iptali; yanlış tanıma düzeltme; metin yaşam döngüsü.

### F11 — Öğretsen bağlantısı, veli araması, randevu/not, görüşme

- Kaynak: §7.1–7.8. Durum: PLANLANDI. Efor: **L**.
- Kapsam: Öğretsen bağlantısı, veli araması, randevu/not, görüşme.
- Bağımlılık: Hukuk, iki ürün sözleşmesi, eğitmen doğrulama.
- Paket kapısı: Öneri sıklığı paket bağımsız; ödeme Öğretsen tarafında doğrulanacak.
- Kabul: HUKUK ONAYI BEKLİYOR: [AVUKAT]/[DOĞRULA] aktarım, ödeme yönlendirmesi ve meet kaydı uygulanmaz. Çocukta ilan/mesaj yok; uzman otomatik önerilmez.
- Test planı: Onay sonrası kapsamlı rıza/iptal, çocuk engeli, imzalı randevu ve eğitmen uygunluğu; kayıt ayrı tüm veli rızası.

### F12 — Sürümlü yapılandırılmış soru düzenleme; grup/kütüphane taşıma; global yönetici düzenleme

- Kaynak: §8. Durum: PLANLANDI. Efor: **L**.
- Kapsam: Sürümlü yapılandırılmış soru düzenleme; grup/kütüphane taşıma; global yönetici düzenleme.
- Bağımlılık: QT sözleşmesi, atanmış sürüm/hash, aktif kütüphane dallarıyla koordinasyon.
- Paket kapısı: Türler tüm paketler; AI ayrı hak.
- Kabul: Başlamış deneme değişmez; payload+özel anahtar birlikte sürümlenir; çocuk projeksiyonu izinli alanlardan; toplu kütüphane üretimi kapsam dışı.
- Test planı: Eski istemci/atanmış deneme, revision/idempotency yarışları, grup puanlama ve özel anahtar/PDF sızıntı testleri.

### F13 — Gerçek sağlayıcı pilotu, bulmaca; dikte/sesli cevap ayrı kapılı

- Kaynak: §8 Faz 3. Durum: PLANLANDI. Efor: **L**.
- Kapsam: Gerçek sağlayıcı pilotu, bulmaca; dikte/sesli cevap ayrı kapılı.
- Bağımlılık: F12, 14 tür fiziksel kabul, hukuk kapıları.
- Paket kapısı: Tür kapısı yok; AI mevcut hak/kota.
- Kabul: Bulmaca kapalı kalır: UI+PDF+AI+erişilebilir alternatif ve aynı yayın anahtarı tamamlanınca açılır. Ses/dikte hukuk onayına bağlı.
- Test planı: Sağlayıcı×tür sınırlı sentetik pilot; anyOf/additionalProperties; TR kesişim; fiziksel klavye/Pencil/PDF.

### B1 — DB ve Storage yedekleme/geri dönüş

- Kaynak: brand son liste. Durum: PLANLANDI. Efor: **M**.
- Kapsam: DB ve Storage yedekleme/geri dönüş.
- Bağımlılık: Mevcut RESTORE-RUNBOOK, ayrı ortam/maliyet.
- Paket kapısı: İşletim.
- Kabul: DB yedeği Storage dosyası sayılmaz; hash/envanter; ayrı ortamda geri dönüş; kullanıcı verisiyle canlı sıfırlama yok.
- Test planı: İzole geri dönüş + ACL/RLS; tam barındırılan tatbikat DIŞ ENGEL (ortam/maliyet).

### B2 — iPhone/iPad push ve gerçek Apple giriş/hesap silme kabulü

- Kaynak: brand son liste. Durum: PLANLANDI. Efor: **M**.
- Kapsam: iPhone/iPad push ve gerçek Apple giriş/hesap silme kabulü.
- Bağımlılık: APNs kurulu; gerçek test cihazı/hesabı.
- Paket kapısı: İşletim.
- Kabul: FİZİKSEL KABUL BEKLİYOR; ana kullanıcı hesabı silinmez; push kişisel veri içermez.
- Test planı: C15, gerçek teslimat/izin iptali/Apple token iptali.

### B3 — Otomatik sağlık/kesinti ve haftalık güvenlik fark uyarıları

- Kaynak: brand son liste, §6.2. Durum: PLANLANDI. Efor: **M**.
- Kapsam: Otomatik sağlık/kesinti ve haftalık güvenlik fark uyarıları.
- Bağımlılık: health-check, Access kontrolü, sırlar ve bildirim alıcısı.
- Paket kapısı: İşletim.
- Kabul: Zamanlanmış salt okunur kontrol; tekrarlı alarm birleştirme; hassas log/çocuk verisi bildirimde yok.
- Test planı: Kesinti/iyileşme fixture; sır redaksiyonu; gönderim olmadan dry-run; gerçek alıcı kurulumu dış kapı.

### B4 — Android FCM/Play ve satışa hazırlık

- Kaynak: brand son liste. Durum: PLANLANDI. Efor: **L**.
- Kapsam: Android FCM/Play ve satışa hazırlık.
- Bağımlılık: Dış hesaplar/sırlar, hukuk ve satın alma kabulü.
- Paket kapısı: Satış mevcut IAP.
- Kabul: DIŞ ENGEL: FCM_SERVICE_ACCOUNT_JSON/Play hesabı; mobil Firebase SDK eklenmez. Hukuk/IAP kabulü olmadan satış açılmaz.
- Test planı: Android iç test, push, satın alma/geri yükleme/iade; farklı e-posta sağlayıcısı teslimatı.

### S1 — Semgrep/MobSF, MFA, şüpheli giriş, veri çekme alarmı, phishing/olay müdahale/rotasyon

- Kaynak: §6.2, §6.4–6.6. Durum: PLANLANDI. Efor: **L**.
- Kapsam: Semgrep/MobSF, MFA, şüpheli giriş, veri çekme alarmı, phishing/olay müdahale/rotasyon.
- Bağımlılık: F5, B3; sağlayıcı ve hukuk.
- Paket kapısı: Güvenlik tüm paketler.
- Kabul: Kaynak düzeyi kurallar önce dry-run; MFA kurtarma; `security@` gerçek teslimatı doğrulanır; yasal bildirim süreleri hukuk onayı olmadan kesin iddia edilmez.
- Test planı: Rol yükseltme, oturum iptali, yanlış alarm, kaynak/rapor sırrı ve rotasyon tatbikatı.

## Brand chat'inin son listesi ve ek öneriler

Kaynak: **brand**, `01a1a6d8-8ada-7762-a00b-775181ddaa8d`, son tamamlanan kurulum değerlendirmesi (7 Kasım). DB+Storage geri dönüş B1 → gerçek cihaz bildirim B2 → otomatik uyarı B3 → Android/FCM B4. Auth/ürün SMTP ve alan adı zaten kurulu; yeniden servis satın alınmayacak. Gerçek Apple hesap silme, ayrı e-posta sağlayıcısı teslimatı, hukuk/IAP kabulü açık. Chat'in önerisi, kurulum yapılmış kanıtı olarak sunulmaz.

Ek kararlar: sinyal kayıtları silinebilir ve yaşlandırılabilir olsun; zorluk önerisi nedenini veli görsün; küçük örneklemde kesin “zayıf” etiketi gösterilmesin; öneri kartı geri alınabilir/susturulabilir olsun. Erişilebilirlik/TTS ücretsiz; güvenlik hiçbir pakete bağlanmaz. İçerik sürümü değişirse geçmiş sinyal yeni soruya otomatik taşınmaz.

3B dünya bu planın dışında ve en sonda, kullanıcıyla ayrı yürütülür. Kütüphane toplu içerik üretimi aktif library chat'inin işidir; bu plan yalnız uygulama yetenekleri ve veri sözleşmelerini kapsar.

## Yürütme kaydı

- 7 Kasım: izole çalışma ağacı oluşturuldu, yerel WIP korundu; brand chat'inin doğru son listesi alındı. F1 ebeveyn beğeni temeliyle başlandı. Henüz üretim migration/istemci yayını yok.

- F1: izole taze DB 15/15 olumsuz/işlev kontrolü; root turbo lint/typecheck/test ve 749 core testi geçti. Kod: ebeveyn önizleme beğenisi, geri alma ve 30 satırlık sayfalı favori listesi. Liste ilk aşamada ders/konu ve soru metnini gösterir; toplu deneme oluşturma ve ayrıntılı kaynak filtresi F2 kapsamındadır. Kanıt: `release/future-f1-2026-11-07/`.
