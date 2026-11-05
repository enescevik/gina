# Derleme aracı güvenlik yamaları — 4 Kasım 2026

Yeni paket veya ana sürüm eklenmedi. Expo 58 ile gelen sürümlere dar kapsamlı pnpm yamaları uygulanır; dosyaların hash'leri `pnpm-lock.yaml` içindedir. `pnpm install --frozen-lockfile` bunları yeniden uygular. Uygulama kullanıcı arayüzü değişmez.

| Paket | Düzeltme | Kaynak |
|---|---|---|
| glob 13.0.6 | İptal sinyalinden sonra dört gezinme yolunda hemen dön; duraklatılmış geri çağrının tamamlanmasını engelleme. Ham ve paketlenmiş CommonJS/ESM girişleri birlikte düzeltildi. | [Üreticinin düzeltmesi](https://github.com/isaacs/node-glob/commit/4682e8c9babee1b385202ede36389634e12076d7), [duyuru](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) |
| minimatch 10.2.6 | `**/..` genişlemesini mevcut `braceExpandMax` sınırında tut; 1000'den büyük kümelerde ikili karşılaştırmayı atla. Her iki modül biçimi korunur. | [Üreticinin düzeltmesi](https://github.com/isaacs/minimatch/commit/77a0f5c4b80bdc641c3c930a1d9edf5ad2db57f8), [duyuru](https://github.com/advisories/GHSA-g3hv-75wg-m249) |
| deepmerge 4.3.1 | Birleştirme sonucuna anahtarları açık veri özelliği olarak yaz; null-prototype kaynak/hedef veya hedefteki öz `__proto__` alanı sonucun prototipini değiştirmesin. Kaynak ve iki dağıtım dosyası birlikte düzeltildi. Bu proje içi düzeltmedir; resmî düzeltilmiş sürüm değildir. | [Üretici deposundaki bildirim](https://github.com/TehShrike/deepmerge/issues/273), [duyuru](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) |

Glob 14/minimatch 11, `makeRe`, RegExp tabanlı desenler ve bazı iç yöntemlerde uyumsuz değişiklik içeriyor. Ana sürümü zorla değiştirmedik. Glob yamasının büyük görünmesi paketlenmiş iki tek satırlık dosyadan kaynaklanır; ham kaynak farkı dar kapsamlıdır. Mevcut lisans dosyaları korunur.

## Davranış kabulü

`node --test scripts/check-toolchain-security.test.mjs` CI'ya eklendi. İlk yamasız koşumda 7 testten 6'sı başarısızdı: prototype zehirlenmesi, bellek/süre sınırını aşan desen ve iptalden sonra devam eden dört dosya gezinme yolu. Normal birleştirme geçiyordu. Yamadan sonra ESM desen kontrolü de eklenmiş 8/8 test geçti. Saldırgan desen denemesi ayrı 96 MB süreçte iki saniyeyle sınırlıdır. Dosya örneği yalnız geçici küçük bir ağaçtır; test sonunda kaldırılır.

Yamalı kurulumda iptalden sonraki ilave dizin okumaları durur; önceki örnekte 12 okuma yerine ilk okumada durur. Normal desen eşleştirme, iç içe nesne/dizi/sembol birleştirme korunur. Kapsam bütün olası güvenlik açıklarının kapandığı iddiası değildir.

## Denetim sınırı ve bakım

Paket sürüm numaraları değiştirilmedi; sürüme bakan `pnpm audit` yamalanmış kodu ayrı değerlendirmeyebilir. Bulgular gizlenmedi veya genel istisnaya alınmadı. ESLint zincirindeki minimatch 3.1.5, 6 Kasım 2026 Q03 taramasında artık duyuru aralığında (`>=7.0.0 <11.0.1`) görünmüyor; bu eski sürümde ilgili `firstPhasePreProcess`/`optimizationLevel` uygulaması zaten yok. Onu uyumsuz 11 sürümüne yükseltmedik. Bu, paket için genel güvenlik garantisi değildir.

**Q03 (6 Kasım 2026) doğrulaması:** `pnpm install --frozen-lockfile --ignore-scripts` temiz bir worktree'de üç yamayı yeniden uyguladı (`pnpm-lock.yaml` `patchedDependencies` hash'leri değişmedi); `node --test scripts/check-toolchain-security.test.mjs` 8/8 geçti. `pnpm audit` (prod/dev ayrı) ve Trivy aynı üç paketi raporlamaya devam eder: bu beklenen durumdur, çünkü yama sürüm numarasını değiştirmez. Uyarı bastırılmadı. Ayrıntı: `docs/release/q03-2026-11-06/README.md`.

Expo/fingerprint/lint araçları uyumlu resmî düzeltilmiş sürümlere geçtiğinde ilgili yama kaldırılmalı; aynı davranış kontrolleri ve iOS/Android/web dışa aktarma ile backoffice üretim derlemesi yeniden çalışmalıdır. Deepmerge için resmî düzeltme yayımlandığında proje yaması onunla karşılaştırılmalıdır.
