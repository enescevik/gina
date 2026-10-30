# Premium v3 teslim kaydı — 30 Ekim 2026

| Kategori | WebP | Ayrı PR |
| --- | ---: | --- |
| Oyunlaştırma | 25 | [#10](https://github.com/enescevik/gina/pull/10) |
| Görev | 66 | [#11](https://github.com/enescevik/gina/pull/11) |
| Ders | 19 | [#12](https://github.com/enescevik/gina/pull/12) |
| Etkinlik | 20 | [#13](https://github.com/enescevik/gina/pull/13) |

129 ayrı illüstrasyon, toplam 130 WebP. Yükleme sabit yıldızı aynı dolu yıldız kaynağıdır. Animations.json 6 burst + 8 loading durumunu aynı resim üzerinde native dönüşüm olarak tarif eder; ayrı üretilmiş kareler yoktur.

Her PR açıklamasında tam dosya listesi, görsel örnekler ve HTML contact-sheet bağlantısı bulunur. Her kategori manifest ve gerçek üretim promptlarını içerir. 130 dosyada varlık yolu, tekil slug, SHA256, ölçü, RGBA/şeffaf alfa ve PNG olmaması doğrulandı. Tüm contact sheet’ler tarayıcıda açık/koyu zeminde incelendi. Resimli tonlar onaylanan v3 istisnasıyla teslim edildi; eski exact RGB SVG paletine uyum iddiası yoktur.

#10, #11, #12, #13 CI: lint/typecheck/test ve Supabase migrations + pgTAP geçti; birleştirildi. Normal merge kullanılır, admin bypass yok. Bu görsel teslim cihaz üzerinde mobil kabul testi değildir.

Codex bu değişikliklerde apps/mobile/assets, uygulama kodu, migration veya lockfile değiştirmedi. Claude’un main’e eklediği uygulama/marka/ödül geliştirmeleri korundu. Güncel devam metni CLAUDE-PROMPT.md’dir.

Eski #5–7 flat SVG teslimleri geçiş uyumluluğudur. Yeni oda/karakter art-candidates hâlâ konsept; iki onaylı ana ekran references klasöründedir. BRIEF 7–11 tam setleri, hesap açma ve TestFlight kurulumu bu teslimin parçası değildir.
