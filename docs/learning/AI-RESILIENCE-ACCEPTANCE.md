# AI hata kabulü — 3 Kasım 2026

Mevcut Anthropic yolu üzerinde 11 arıza testi eklendi. Gerçek sağlayıcı çağrısı yapılmadı; fetch ve iş kaydı yanıtları sentetik. Ücretli kota/anahtar veya üretim yapılandırması değişmedi. Başka sağlayıcı adapterinin tamamlandığı anlamına gelmez.

Kontroller:

- Rezervasyon veritabanı hatası, kota ve hız sınırında sağlayıcı çağrılmaz.
- Önceden kaydedilmiş geçerli sonuç tekrar üretilmez. Bozuk önbellek de sessizce yeniden ücretli üretime gönderilmez.
- Geçerli yapılandırılmış yanıt tek kez kaydedilir; düşünme bloğu kullanıcı sonucu yerine kullanılmaz.
- Girdi token sınırı aşılırsa üretim mesajı gönderilmez.
- 429 otomatik yeniden denenmez; özel sağlayıcı hata gövdesi istemciye aktarılmaz.
- 5xx, ağ kaybı, ret, çıktı kesilmesi, bozuk JSON ve şemaya uymayan çıktı belirsiz olarak kalır. İkinci ücretli çağrı kendiliğinden yapılmaz.
- Sonucu kaydetmenin yanıtı kaybolursa yeni üretim yapılmaz.

Testte bulunan ve düzeltilen iki eksik kontrol: metin bloğu olmayan sağlayıcı yanıtı eskiden `{}` kabul ediliyordu; negatif token sayısı geçerli sayılıp üretime geçebiliyordu. Artık boş/eksik metin ve bozuk JSON `ai_result_invalid`, geçersiz token sayısı `ai_token_count_invalid` ile reddedilir. Bozuk JSON içeriği hata mesajına eklenmez. Token sayımı aşamasındaki geçersiz yanıt, üretime geçilmediği için kesin başarısız iş olarak kaydedilir.

CI Edge adımına bu test dosyası eklendi. Yapılandırılmış tüm Edge giriş noktalarının tip kontrolü ve **101 Edge testi** yerelde geçti. Bu sonuç fiziksel cihaz kabulü, gerçek sağlayıcı arızası deneyi, sağlayıcı değiştirme/fallback veya yeni model onayı değildir. Belirsiz ücretli işlemlerin otomatik tekrarını açmıyoruz; yeni sağlayıcı bağlama ve iş bazında model politikası ayrı açık işlerdir.

# S06 eki — çok sağlayıcılı adapter ve işletim politikaları — 6 Kasım 2026

Rapor: `docs/release/ai-providers-2026-11-06/README.md`. Gerçek sağlayıcı çağrısı yine yapılmadı; OpenAI-uyumlu ve Gemini adapterleri sahte sunucuyla sınanan iskelettir, anahtar yok (X04 bekliyor). Anthropic yolu `callClaude` değişmeden ortak `AiAdapter` arayüzüne sarıldı; önceki 11+4 arıza testi aynen geçti.

Yeni kontroller (`_shared/ai-provider.test.ts`, 12 test; `supabase/tests/092_ai_provider_matrix.test.sql`, 53 kontrol):

- Model yalnız adıyla etkinleşmez: adapter + yetenek beyanı + sözleşme sürümü + etkin sağlayıcı kaydı yoksa DB tetikleyicisi `ai_model_unsupported` ile reddeder, `resolveAi` 503 ve etkilenen özellik × girdi listesi döner, `runAiOperation` rezervasyon açmaz.
- Yapılandırılmamış sağlayıcı (secret adı var, değer yok) hiç istek atmadan `provider_unconfigured`.
- İkinci sağlayıcı üzerinden 429 bilinen hata; 5xx, zaman aşımı, ret, kesilme, bozuk/boş çıktı belirsiz; belirsiz iş aynı girdiyle sessiz tekrar çalışmaz (409 `ai_result_uncertain`); kayıt yanıtı kaybolursa yeni üretim yok.
- İki aynı istek → tek ücretli işlem (durumlu rezervasyon, tek `finish_ai_operation`).
- Anahtar yalnız HTTP başlığında, URL'de değil; sağlayıcı gövdesi hata mesajına girmez.
- Yönetici RPC'leri (`admin_model_disable_preview`, `admin_provider_change_impact`, `admin_ai_policy_matrix`, `admin_ai_failed_operations`) veli/cihaz için 42501; kill switch önizleme ve `get_ai_usage()` çıktısına yansır.

Sınır: DB'deki haftalık/öğrenme planı rezervasyonları ve devre kesici hâlâ `provider='anthropic'` sabitini kullanır; UI bağlanmadı; üretime uygulanmadı.
