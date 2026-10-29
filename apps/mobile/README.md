# Gina Aile — mobil uygulama

Expo SDK 58 (React Native 0.88) uygulaması; iOS, Android ve web export aynı koddan çıkar.

- Rotalar `src/app/` altında, expo-router ile: `(auth)` veli girişi ve aile kurulumu, `(device)` tablet eşleştirme, `(child)` çocuk alanı, `(parent)` veli alanı. `src/app/index.tsx` JWT'deki `gina` claim'ine göre yönlendirir.
- Stil: NativeWind 4 (`tailwind.config.js` Gina paletini taşır). Çocuk alanı krem zemin ve büyük dokunma hedefleri kullanır.
- Veri: `@gina/api` üzerinden Supabase; sorgular TanStack Query ile. Yazma işlemleri RPC'lerle (`complete_task`, `review_task`, `pair_device`, …).
- Dil: i18next + expo-localization; metinler `packages/core/src/i18n/`.

## Çalıştırma

```bash
cp .env.example .env            # yerel Supabase URL + anon key
pnpm exec expo run:ios          # iOS simülatörü / cihaz (dev client; Expo Go kullanılmaz)
pnpm exec expo start            # Metro
pnpm exec expo export -p web    # statik web çıktısı (dist/)
```

Native modül ekledikten sonra yeniden `expo run:ios|android` gerekir. `ios/` ve `android/` klasörleri üretilir, elle düzenlenmez.
