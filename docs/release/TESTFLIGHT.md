# Gina · yayın denetimi ve TestFlight durumu

**31 Ekim 2026: henüz yayına hazır değil.** Apple Developer üyeliği aktif; üretim Supabase, Expo/EAS projesi ve App Store Connect uygulama kaydı yok. İmzalı IPA, gerçek cihaz ve mağaza kabulü yapılmadı. [Enes için adım adım kurulum rehberi](YAYIN-KURULUM-REHBERI.md): şimdi yalnız ilk üç bölüm.

## Kod ve tasarımda tamamlananlar

| Alan | Yapılan düzeltme | Kanıt |
| --- | --- | --- |
| Çocuk v5 | Oda/karakter/pet tercihleri kaydı, katman hizaları, Baloo 2/Nunito, hedef/ödül/hafta/takvim/koleksiyon, PIN ve yeniden açılışta çocuk modu kilidi; aile dışı oda tercihi erişimi kapatıldı | [PR22](https://github.com/enescevik/gina/pull/22), [görsel denetim](../design/screens/child/implementation-v5/README.md) |
| Veli günlük | 8 ekran aynı pencere/kâğıt dilinde; avatar/ikon, boş/hata/yükleme, tarih/saat/puan doğrulaması, çift kayıt önleme, silme onayı | [PR23](https://github.com/enescevik/gina/pull/23), [yan yana galeri](../design/screens/parent-daily/implementation-v5/index.html) |
| Veli Prova | 10 ekran; soru/sınav/senaryo/plan/kitapçık; 48 dp kontroller; sınıf ve süre doğrulaması, gerçek yükleme/hata, AI servis hataları | [PR24](https://github.com/enescevik/gina/pull/24), [galeri](../design/screens/parent-prova/implementation-v5/index.html) |
| Çocuk Prova | Cevapları yeniden açılışta geri alma, otomatik kayıt, hata sonrası taslağı koruma, kaydedilmemiş cevapta çıkış uyarısı, süre sonunda sonsuz istek döngüsünü durdurma; doğru cevaplar çocuğa açılmaz | [PR25](https://github.com/enescevik/gina/pull/25), [akış kanıtı](../design/screens/child/implementation-v5/prova-reliability/) |
| Hesap | 9 görünüm; kayıt doğrulaması, PKCE şifre kurtarma, eşleme süresi, bildirim kaydında gerçek başarı, tam paylaşım adresi, mağaza/hukuki adres kontrolü, uygulama içinden hesap silme | [PR26](https://github.com/enescevik/gina/pull/26), [galeri](../design/screens/account/implementation-v5/index.html) |
| Güvenlik | Güncel üyelik kontrolüyle eski veli/admin/çocuk JWT erişiminin kesilmesi; Edge CORS ve canlı Auth kontrolü; hesap değişiminde sorgu önbelleğinin temizlenmesi | PR26 migration + pgTAP + 9 Edge testi |
| Son kontrol | Koyu sistem temasında yarım tema karışması önlendi; native ön plana/bağlantıya dönüşte veri yenileme, arka planda token yenilemeyi durdurma; PIN girdisi, AI not güncellemesi, sonuç alt metni, telefonda koleksiyon kapısı, görünür profil çıkış hatası ve push hata yakalama; veli menüsünden tek çocuk profilini ikinci onayla silme | Son yayın denetimi PR'ı |

Görsel testler üretim **web** paketinde, tamamen yakalanmış örnek HTTP/WebSocket yanıtlarıyla yapıldı. Gerçek demo veritabanı sıfırlanmadı, yeniden seed edilmedi, yeni migration uygulanmadı. Ekran kanıtları native iPhone/iPad kabulü yerine geçmez. CI migration'ları geçici test veritabanında çalıştırır.

## Açık işler — hazır kabul edilmeyecekler

| Öncelik | Açık iş | Tamamlanma ölçütü / sorumlu |
| --- | --- | --- |
| TestFlight engeli | Supabase, Expo/EAS, App Store Connect kaydı | Enes ilk üç kurulum adımını yapar; Codex gerçek kimlikleri bağlar, üretim şema/Edge/hook/RLS'i test eder |
| TestFlight engeli | İmzalı build ve gerçek cihaz | Production iOS yerel EAS build + submit; iPhone/iPad'de giriş, PIN, görev/ödül/Prova, hesap silme, büyük yazı/safe area/klavye/VoiceOver |
| Görsel ürün kapsamı | Doğal pet hareketi ve sesi | V5 ile aynı kedi için organik rig ve gerçek animasyon örneği; sonra köpek/maymun/aslan. Reddedilen v4 modeller ve büyütme efekti kullanılmaz. [Üretim kabul brief'i](PET-VE-HAVA-URETIM-KABULU.md) |
| Görsel ürün kapsamı | Pencere: gün doğumu/batımı, gece, yağmur/kar/rüzgâr | Aynı kamera/geometride hizalı ışık/hava katmanları + veli şehir seçimi + gerçek veri/önbellek/çevrimdışı durum; mevcut üç konsept PNG'si bunun yerine geçmez |
| Dış beta / mağaza engeli | Domain, SMTP, web/legal adresleri | Gerçek HTTPS sayfaları, e-posta doğrulama/kurtarma, destek; hesap silme web talebi ve hukuki saklama vaatleri gerçek uygulamayla eşleşmeli |
| Dış beta / mağaza engeli | Veli beyanı ve izin kayıtları | Kayıt ekranındaki 18+ beyanı tek başına hukuki rıza/saklama sisteminin tamamı değildir; gerçek veri envanteri ve danışman onayı |
| Özellik yayını engeli | Push / IAP / AI | APNs/FCM, sandbox satın alma/geri yükleme/webhook, Anthropic model/izin/limit; gerçek hesaplarla uçtan uca test. Kurulmamış özellik satış vaadi olarak sunulmaz |
| Mağaza engeli | Yayın metinleri ve beyanlar | App Privacy, yaş derecelendirmesi, destek URL, gerçek cihaz görselleri, inceleme hesabı; Enes + Codex |

Pet/hava ve eğitim oyunları sessizce kapsamdan çıkarılmadı. Bu denetim dört grubu mevcut uygulamada birleştirir; profesyonel oyun animasyonu veya gerçek 3D teslimi iddia etmez. Yeni runtime paketi eklenmedi. Yeni paket yasağı altında mevcut statik katmanlar organik rig çalıştıramaz; somut tek kedi prototipi ve native uyumluluk testi sonraki teknik kararın dayanağıdır.

## Salt okunur hazırlık kontrolü

```sh
pnpm release:check:ios
pnpm release:check:ios --env-file /tam/yol/.env.production.local
node --test scripts/check-testflight.test.mjs
```

Kontrol build/submit yapmaz, anahtar değerlerini yazdırmaz. [JSON raporu](testflight-config-audit.json) EAS proje kimliği, Apple uygulama kimliği ve public Supabase adresinin eksik olduğunu gösterir. Web/legal adresleri de hazır değildir. Public anahtar biçiminin geçmesi proje bağlantısının doğrulandığı anlamına gelmez.

## Yetki ve çalışma sınırları

Ürün sahibi bu denetimde “gerekli tüm katmanları düzelt” diyerek eski sunum/RPC/Supabase sınırını kaldırdı; PR'ları doğrudan merge etme yetkisi var. Yerel değişiklikler korundu, `apps/mobile/assets` değiştirilmedi, yeni uygulama paketi eklenmedi. Üretim hesabı kurulmadan deploy, gerçek ödeme veya mağaza gönderimi yapılmadı.
