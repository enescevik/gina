# Gina — Odam tasarım ve Claude devir paketi

2026-10-30 · İncelenen uygulama tabanı: `3d81e4b`. Bu paket uygulama geliştirmesi değil; tasarım kaynakları, kararlar ve uygulanabilir geliştirme talimatıdır.

Önce [CLAUDE-PROMPT.md](CLAUDE-PROMPT.md), sonra [IMPLEMENTATION.md](IMPLEMENTATION.md) ve [ART-HANDOFF.md](ART-HANDOFF.md) okunmalı. Yeni main değişiklikleri varsa bu tarihteki dosya tespitlerini yeniden doğrula.

| Kaynak | Durum / kullanım |
| --- | --- |
| references/child-home-approved.png | Kullanıcının beğendiği çocuk ana ekranı; oyun odası hissi, mobilyaya entegre görevler. Ekran görüntüsünü uygulama arka planı olarak kullanma. |
| references/parent-home-approved.png | Kullanıcının beğendiği ebeveyn ana ekranı; telefonda sakin krem/teal düzen. |
| art-candidates/ | Yeni boş oda ve kız/erkek/belirtmeyen karakter katmanları; tasarım adayları. Piksel paleti ve kenar temizliği üretim sertifikası değildir. |
| packages/assets/brand/yan-yana/ | Seçilen 2. logo yönünün yeni düz SVG yorumu. Platform geçişi main’de tamamlandı. |
| packages/assets/rooms/v2/ | Yazısız SVG dekor, sinema/bisiklet/markasız konsol nesneleri ve diş bakım sembolü. |
| packages/assets/icons/tasks/illustrated-v3/ | 66 görev WebP. |
| packages/assets/icons/subjects/illustrated-v3/ | 19 ders WebP. |
| packages/assets/icons/events/illustrated-v3/ | 20 etkinlik WebP. |
| packages/assets/gamification/illustrated-v3/ | 25 WebP + native animasyon tarifi. |

Alt ekranlar için burada davranış tarifleri vardır; henüz kullanıcı tarafından onaylanmış alt ekran mockup'ları yoktur. Mevcut iki ana ekranın yeni sanatla uygulaması doğrulanmalı; sonraki ekranlar aynı dille birlikte değerlendirilecek.

Bu teslimde `apps/mobile/assets`, uygulama kodu, veritabanı migration'ları veya bağımlılıklar değiştirilmez. 66 görevin tamamı yeni resimli teslim kapsamındadır. BRIEF 7–11 tam setleri bu teslim kapsamında değildir. Eski SVG teslimleri uyumluluk için kalır; güncel büyük resim yönü illustrated-v3’tür.
