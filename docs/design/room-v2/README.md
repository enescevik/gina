# Gina — Odam tasarım ve Claude devir paketi

2026-10-30 · İncelenen uygulama tabanı: `5d20850`. Bu paket uygulama geliştirmesi değil; tasarım kaynakları, kararlar ve uygulanabilir geliştirme talimatıdır.

Önce [CLAUDE-PROMPT.md](CLAUDE-PROMPT.md), sonra [IMPLEMENTATION.md](IMPLEMENTATION.md) ve [ART-HANDOFF.md](ART-HANDOFF.md) okunmalı. Yeni main değişiklikleri varsa bu tarihteki dosya tespitlerini yeniden doğrula.

| Kaynak | Durum / kullanım |
| --- | --- |
| references/child-home-approved.png | Kullanıcının beğendiği çocuk ana ekranı; oyun odası hissi, mobilyaya entegre görevler. Ekran görüntüsünü uygulama arka planı olarak kullanma. |
| references/parent-home-approved.png | Kullanıcının beğendiği ebeveyn ana ekranı; telefonda sakin krem/teal düzen. |
| art-candidates/ | Yeni boş oda ve kız/erkek/belirtmeyen karakter katmanları; tasarım adayları. Piksel paleti ve kenar temizliği üretim sertifikası değildir. |
| packages/assets/brand/yan-yana/ | Seçilen 2. logo yönünün yeni düz SVG yorumu. Eski platform ikonlarını henüz değiştirmez. |
| packages/assets/rooms/v2/ | Yazısız SVG dekor, sinema/bisiklet/markasız konsol nesneleri ve diş bakım sembolü. |
| packages/assets/icons/subjects/ | 19 ders, renkli + mono. |
| packages/assets/icons/events/ | 20 etkinlik, renkli + mono. |
| packages/assets/gamification/ | BRIEF ayrıntısındaki 38 renkli varlık + 10 mono yıldız. |

Alt ekranlar için burada davranış tarifleri vardır; henüz kullanıcı tarafından onaylanmış alt ekran mockup'ları yoktur. İlk uygulama teslimi yalnız iki ana ekranın doğrulanabilir prototipi olmalı; sonraki ekranlar aynı dille birlikte değerlendirilecek.

Bu teslimde `apps/mobile/assets`, uygulama kodu, veritabanı migration'ları veya bağımlılıklar değiştirilmez. Önceki 1–3 kategori PR'ları zaten birleştirilmiştir; 4–6 ayrı PR'lardır. Görev ikonlarının kalan 36'sı, BRIEF 7–11 tam setleri bu teslim kapsamında değildir.
