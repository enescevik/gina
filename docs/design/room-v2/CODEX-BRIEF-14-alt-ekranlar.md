# BRIEF 14: Alt ekranların tasarımı ve giydirilmesi

Ana ekranlar (BRIEF 13) ile aynı görsel dil bütün alt ekranlara taşınacak. Bu turda Codex hem tasarımı hem de **giydirmeyi** (uygulamadaki sunum katmanını) yapar. Claude veri, iş kuralları ve backend tarafında kalır; PR'ları kontrol edip birleştirir.

## Akış (her ekran grubu için)

1. **Referans maketi:** grubun her ekranı için onaylı ana ekranlarla aynı dilde, Türkçe metinli bir referans PNG çiz. Telefon 390×844; çocuk ekranlarına ek olarak tablet 1280×800. Gerçek alan adlarını ve verileri kullan; ekranın bugünkü işlevini çıkarma, yeni işlev ekleme.
   - Dosyalar: `docs/design/screens/<grup>/<ekran>-{phone,tablet}.png`.
   - Ekranın "boş", "yükleniyor", "hata" durumlarını da tek bir sayfada göster.
2. **Onay:** maketleri PR ile gönder. Ürün sahibi (Enes) onaylamadan o grubun koduna geçme.
3. **Kaplama ve sanat:** onaylanan maketin gerektirdiği yeni kaplama ve illüstrasyonları mevcut sözleşmelerle ekle: `room-chrome` 9-slice manifesti, `illustrated-v3` manifestleri, yazısız görseller.
4. **Giydirme:** ekran dosyasının sunum katmanını maketle birebir aynı yap. Ayrı bir PR aç.

## Ekran grupları ve sıra

| Sıra | Grup | Ekranlar (`apps/mobile/src/app/`) |
| --- | --- | --- |
| 1 | Çocuk | `child/week`, `child/calendar`, `child/goal`, `child/collection`, `child/prova/index`, `child/prova/[examId]`, `child/pin`, `child/room-preview` → **Odamı düzenle**: karakter, oda teması ve evcil hayvan seçimi (kedi, köpek, maymun, aslan, yok) |
| 2 | Veli günlük | `parent/tasks`, `parent/rewards`, `parent/calendar`, `parent/grades`, `parent/notes`, `parent/menu`, `parent/child-mode/index` |
| 3 | Veli Prova | `parent/prova/{index,exam,question,blueprint,generate,level,progress,booklet}`, `parent/prova/attempt/[attemptId]`, `parent/prova/plan/[planId]` |
| 4 | Hesap ve diğer | `(auth)/sign-in`, `(auth)/family`, `device/pair`, `parent/notifications`, `parent/share`, `parent/subscription`, `s/[token]` (öğretmen raporu) |

Çocuk ekranları "oda" dilini sürdürür: pano, kâğıt kart, etiket, bilet, dolap. Veli ekranları `parent-card` dilinde, sakin ve hızlı okunur.

## Giydirme kuralları (kod)

- **Yalnız sunum katmanı:** JSX yapısı, stiller, kaplamalar, illüstrasyonlar, düzen. Şunlara **dokunma**:
  - veri sorguları (`useQuery`, `supabase.from/rpc`), mutasyonlar, RPC adları ve parametreleri;
  - realtime, yetki ve yönlendirme mantığı;
  - `supabase/` klasörü ve `packages/core/src/database.types.ts`.
- Mevcut bileşenleri kullan:
  - `components/room/nine-slice.tsx`: `NineSlice`, `SkinPressable`, `SkinProgress`, `SkinIcon`
  - `components/room/skins.ts`
  - `TaskIcon`, `SubjectIcon`, `EventIcon`, `Collectible`, `collectible-motion.tsx`
  - `components/ui/*`

  Yeni kaplama eklersen `skins.ts` haritasına ekle. Yeni illüstrasyon eklersen `scripts/generate-illustrated.mjs` ile türet; tüm yüksek çözünürlüklü kaynakları yükleme.
- **Metinler:** i18n anahtarlarıyla, `packages/core/src/i18n/tr.json` ve `en.json` içinde. Var olan anahtarı silme ya da anlamını değiştirme; yenilerini ekle. Türkçe birincil.
- **Erişilebilirlik:**
  - dokunma alanı en az 48 dp;
  - mevcut accessibilityLabel, role ve state değerlerini koru;
  - büyük yazıda düzen yeniden aksın;
  - safe area;
  - uzun Türkçe metinler sığsın.
- **Platform:** iOS, Android ve web (veli webi Expo web export'tur). Tasarım açık temada; koyu tema okunur kalsın.
- **Yasaklar:**
  - ekran resmini tek arka plan yapıp üstüne görünmez buton koymak;
  - görsellerin içinde yazı;
  - çocuk ekranında bottom-nav;
  - istemcide yıldız veya rozet vermek;
  - yeni paket eklemek (gerekirse PR açıklamasında sor).
- **Kontrol:** her PR'dan önce `cd apps/mobile && pnpm exec tsc --noEmit && pnpm exec expo lint`. PR açıklamasına maket ve uygulama ekran görüntülerini yan yana koy.

## Çakışmayı önleme

- Her PR tek grubu kapsar. Bir grubun giydirme PR'ı açıkken Claude o grubun ekran dosyalarında yalnız hata düzeltmesi yapar, düzen değiştirmez.
- Veri ya da iş kuralı değişikliği gerekirse (yeni alan, yeni RPC) kodu yazma; PR açıklamasında "Claude için" başlığıyla iste.
