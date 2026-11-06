# AI ön inceleme — 7 Kasım 2026 aktivasyonu

Hesap sahibinin otomatik ön incelemeyi tamamlama talebi üzerine H07 aktivasyon
adımları uygulandı. Hukuk yayını, genel katalog, içerik yayın kararları ve
bağımsız eğitimci onayı değiştirilmez.

- Edge ve Vault için eşleşen zamanlayıcı sırrı kuruldu; değerleri bu kayıtta yoktur.
- `content-prereview` kendi sistem sırrını ve kullanıcı JWT/rolünü doğrular.
  Gateway `verify_jwt=false` kalıcı config'e eklendi; sonraki dağıtım zamanlayıcıyı bozmaz.
- Canlı kimlik doğrulama sondaları: eksik/yanlış sır 403; geçerli sistem sırrı 200.
- Auth ve handler testleri: 26 geçti, 0 hata.
- Gerçek sağlayıcıyla dokuz sentetik örnek: 0 servis hatası, 0 yanlış onay,
  8/9 beklenen sınıflandırma. Belirsiz eksik-verili problem `needs_admin` yerine
  `ai_rejected_suggestion` döndü; yine yönetici kararı gerekir. Eşik kalibre edilmiş
  sayılmaz. Ayrıntılar: [pilot.json](pilot.json).
- İlk kullanım sınırı: kayan 24 saatte 1 kayıt inceleme çağrısı; tekrarlar dahil.
  Sentetik pilotun 9 çağrısı bu kayıt kotasından ayrıdır ve otomatik tekrarlanmaz.
- Zamanlayıcı mevcut `*/10 * * * *` işidir. Yalnız kuyruğa alınmış kayıtlar işlenir;
  tüm arşiv kendiliğinden kuyruğa alınmaz. AI sonucu içerik yayımlamaz.

İzleme: `select gina.content_prereview_health();`. Durdurma:
`update public.app_settings set value='false'::jsonb where key='content_prereview.enabled';`.
Kota dolunca `daily_limit_reached` beklenen frendir; otomatik olarak artırılmaz.

Gizli bilgiler ve ayrıntılı canlı operasyon kanıtı Git dışındaki
`.codex-setup/prereview-activation/` dizinindedir.
