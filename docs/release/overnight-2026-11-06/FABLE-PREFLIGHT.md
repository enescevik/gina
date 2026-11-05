# N00 — Fable ön incelemesi ve başlangıç paketi

5 Kasım 2026, 22:55 Europe/Istanbul. Kaynak commit: main `7e21801` (PR #150). Çalışan oturum: Claude Code (masaüstü, Remote Control), model kimliği oturum meta verisinden okundu: **claude-fable-5-1**, izin modu `auto`. Bu dosya N00 kabul kaydıdır; cevaplar geldikçe güncellenir.

## 1. Erişim ve ortam kontrolleri (kendim yaptım)

| Alan | Durum |
|---|---|
| Git / GitHub | `gh` oturumu `enescevik` aktif. Açık PR yok. Main 146 commit ileri alındı; yerel değişiklikler stash ile korunup geri yüklendi. `.gitignore` çakışması upstream sürümüyle çözüldü (upstream `.codex-setup/` ve `credentials/` kurallarını zaten içeriyor). Yedek stash `local-wip-before-main-sync-2026-11-05` duruyor. |
| Yerel değişiklikler | `apps/mobile/app.json` (owner + `extra.eas.projectId` eklenmiş, `newArchEnabled` kaldırılmış — Q04'ün istediği temizlik), `docs/release/YAYIN-KURULUM-REHBERI.md` (31 Ekim–1 Kasım kurulum kaydı genişletmesi), untracked `packages/assets/fonts/gina/` (GinaBirlik/GinaKesif özel fontlar; kodda hiç referans yok). |
| Codex worktree'leri | 15 worktree. `codex/remaining-screen-fidelity`, `codex/meb-scenario-night-handoff`, `codex/testflight-17-release` main'den 1'er commit ileride; diğerleri main'de. Dokunulmayacak. |
| Supabase | CLI 2.122 oturumu açık, `gina-prod` (`wixjxlxgyhgdacadsawo`, eu-central-1, ACTIVE_HEALTHY). Üretimde 106 migration uygulanmış; **`20261105180000_reward_history` ve `20261105190000_note_history` uygulanmamış** (R01). 20 Edge Function ACTIVE. Yerel Docker çalışıyor, yerel Supabase durdurulmuş (izole test DB için başlatılabilir). |
| Cloudflare | Wrangler oturumu `enes.cevik` hesabında açık; web/backoffice yayını yerelden yapılabilir. GitHub Actions'ta yayın secret/variable **yok**; Actions yayın işleri atlanmaya devam eder (yayın başarısı sayılmaz). |
| Expo / Apple | EAS CLI oturumu `enescevik` açık. Apple imzalama bilgileri EAS'te; `.codex-setup/build-ios.command` yerel iOS build yolu mevcut. Son kanıtlı sürüm 0.1.0 (26). |
| Simülatör | iPhone 17 Pro ve iPad Air 11" (iOS 26.5) açık. Fiziksel iPhone/iPad/Pencil/Android bu oturumdan erişilemez → fiziksel kabul maddeleri BEKLİYOR (X05). |
| Kota | Kullanım ekranı okundu: Ultra plan; haftalık tüm modeller **%46 kullanılmış**, Fable **%16**; her ikisi **6 Kasım 07:00 Europe/Istanbul** (04:00 UTC) yenileniyor. Enes'in "%55 / 07.00" beyanı bu veriyle uyumlu (≈%54 kalan). Abonelik dışı ek kullanım kapalı; açılmayacak. |
| GINA üretim AI | Anthropic üretim anahtarı sunucuda; gerçek üretim çağrısı GINA API faturasına yazar. Gece varsayılanı: yalnız izole/sentetik, sınırlı sayıda doğrulama çağrısı (bkz. soru 3). |

## 2. İnceleme özeti — yapılmış / açık

- **Yapılmış ve kanıtlı:** 26 paketi (web, backoffice, iOS TestFlight, tablet Ad Hoc); eğitim dönemi/okul geçmişi, profil arşivi, dönem raporları, rutin geçmişi; katalog inceleme/yayın + aile seçimi + AI blok denetimi (M01 temeli); 648 senaryo adayı, 16 resmî XLSX hash'li manifestle depoda.
- **Kod hazır, yayın açık (R01):** ödül geçmişi (#146) ve özel not RLS düzeltmesi (#147). Not düzeltmesi migration uygulanmadan canlıda etkin değil; bu gecenin ilk işi.
- **Açık:** Q00 inceleme matrisi hiç yok (`docs/release/experience-review/` boş); 67 mobil rota + 22 backoffice sayfası + alt akışlar. L01–L04, U01–U09, M01 kaynak edinme zinciri, P/B/S, Q01–Q04, K01 (0 onay/0 yayın), F01, R02.
- **Dış engel (BEKLİYOR):** alan adı/SMTP (X01), Android/FCM/Play (X02; `google-rtdn` 503), hukuk/işletme (X03), fiziksel cihaz (X05), bağımsız editör (X06).

## 3. Gerekçeli kararlar (dosyalarda cevabı olanlar; tekrar sorulmadı)

1. **PR/merge yöntemi:** proje kuralı "PR incelemesi yok, doğrudan main'e push". Devir listesi `codex/…` dalı + PR önerir; Enes'in daha güçlü kuralı geçerli. Alt ajanlar ayrı worktree/dalda çalışır, koordinatör main'e merge eder; CI yeşil olmadan merge edilmez.
2. **R01 sırası:** üretim migration → web/backoffice Wrangler → iOS 27 yerel build → TestFlight + tablet Ad Hoc. Önceki onay yayına izin veriyor; tekrar sorulmaz.
3. **L02 toplu işlem semantiği:** kayıt bazında sonuç (kısmi başarı, engellenen kayıt nedeniyle listelenir), ön izleme zorunlu. "Ya hep ya hiç" seçeneği yalnız silme için. Sunucuda tek RPC, idempotent.
4. **Q00 yöntemi:** izole Auth/REST/Realtime servisi + web export + Playwright ile telefon 390×844 / tablet 768×1024 / 1280×800 gerçek akış; iOS simülatör kontrolleri koordinatörde. Fiziksel cihaz satırları `GÖRÜLEMEDİ (X05)`.
5. **Özel fontlar (GinaBirlik/GinaKesif):** onaylı tipografi Nunito/Baloo 2; bu fontlar koda bağlanmaz. Repoya alınıp alınmayacağı Enes'e soruldu (soru 5).
6. **Supabase CLI v3 yükseltmesi:** gece yapılmaz; mevcut 2.122 çalışıyor.
7. **WORLD-01 ve K01 toplu üretim:** sıra korunur; gece bu ikisine dokunulmaz. M01 için yalnız küçük sentetik doğrulama pilotu.

## 4. Gece iş dağılımı (başlangıç; kapasiteye göre artırılır)

| Ajan | İş | Yazılabilir alan | Kabul |
|---|---|---|---|
| Koordinatör (bu oturum) | R01 yayını; merge/migration/yayın; PROGRESS; iOS simülatör kanıtları | main, prod | R01 kabul listesi |
| A1 | Q00 — auth/veli/aile/ayarlar ekranları matris + düzeltme | `apps/mobile/src/app/(auth)`, `parent/*` (prova hariç), `components/{parent-home,setup,ui,notes,rewards,tasks,education,planner}` | matris satırları + önce/sonra |
| A2 | Q00 — çocuk, çocuk modu ve tüm Prova ekranları | `child/*`, `parent/child-mode/*`, `parent/prova/*`, `components/{room,child-home,learning}` | aynı |
| A3 | Q00 — backoffice 22 sayfa | `apps/backoffice/src` | aynı |
| A4 | M01 — resmî kaynak edinme/sürümleme Edge işi (SSRF korumalı indirme, hash revizyon, stale durumu) + testler | `supabase/functions/curriculum-source-fetch` (yeni), `_shared`, `scripts/`, migration numarası koordinatörden | protokol kabul 1–6 |
| A5 | L01 seçerek dönem aktarımı | `components/education`, `components/tasks/routine-editor`, `components/planner/learning-plan`, yeni migration (koordinatör numaralandırır) | L01 kabul |

Ortak dosyalar (i18n `tr.json`/`en.json`, lockfile, migration numaraları, `database.types.ts`) yalnız koordinatörde birleştirilir. Çalışma penceresi: 23:15 → 06:30 toparlama → 07:00 rapor.

## 5. Başlangıç soruları ve cevaplar

Cevaplar 5 Kasım 23:06 Europe/Istanbul'da alındı.

| # | Soru | Cevap | Uygulama |
|---|---|---|---|
| 1 | Bitiş 6 Kasım 07:00 / 06:30 toparlama | Evet | Çalışma penceresi sabit. |
| 2 | Mac açık kalacak mı | Evet; yük yapan süreçleri Claude kapatabilir | Gereksiz süreçler koordinatörce kapatılır, kullanıcıdan adım istenmez. |
| 3 | GINA Anthropic faturası üst sınırı | "Rahat olabilirsin, kota çok" | Yalnız sentetik veri ve doğrulama amaçlı çağrı; gereksiz tekrar yok. Abonelik dışı Claude kullanımı yine 0. |
| 4 | R01 yayını | İtiraz yok | Migration → web/yönetim → iOS 27 TestFlight + tablet. |
| 5 | GinaBirlik/GinaKesif fontları | Mevcut font beğeniliyor, yeni fontlar beğenilmedi | Fontlar repoya alınmaz, koda bağlanmaz; untracked dosyalara dokunulmaz. Nunito/Baloo 2 kalır. |
| 6 | Editör onayı | AI içeriğe bakıp otomatik onay verebilir; karar veremezse BEKLİYOR + bildirim, yönetici onaylar | Yeni ürün kararı; DECISIONS.md'ye işlendi, yeni iş **E01** (AI ön inceleme ve yönetici kuyruğu) açıldı. K01 sırası değişmez. |
| 7 | Alan adı / Android | Yok; canlıya alma zamanında hazırlanacak | S01/S02/X01/X02 BEKLİYOR; geliştirmeyi durdurmaz. |
