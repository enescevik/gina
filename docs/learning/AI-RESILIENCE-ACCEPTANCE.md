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
