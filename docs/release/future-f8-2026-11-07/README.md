# F6a–F8a — Gerçek web kabulü

Yerel, taze, geçici Supabase fixture ve bu koddan Expo web export kullanıldı. Chrome/Playwright; Türkçe, 390×844 ve 1280×800. Üretim veya demo verisi değiştirilmedi.

- Akşam tercihi kaydoldu ve saat kontrolleri açıldı.
- Kazanım gözlemi az veride sayısal sonuç göstermedi.
- Bir favori seçilince ortak kaynak iki sorusuyla tek blok olarak velinin taslağında açıldı.
- Altı ekran görüntüsünde sayfa genişliği taşmadı; yakalanmamış tarayıcı hatası yok.

Sonuç: [kontrol listesi](ui-checks.json), [görseller](screenshots/). `scripts/test-future-learning-ui.cjs` için `test-isolated-services.py --run-local --ui-hold` ile **yeni** sentetik fixture oluşturun, yalnız loopback Expo web export kullanın ve `GINA_QA_UI_FIXTURE`, `GINA_QA_WEB`, `GINA_QA_OUT` verin. Fixture dosyasını depoya koymayın. iOS/Android fiziksel testleri bu kabulün dışında.
