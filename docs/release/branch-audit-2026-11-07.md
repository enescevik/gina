# Branch ve commitlenmemiş iş denetimi — 7 Kasım 2026

Denetim zamanı: 2026-11-07 ~05:00 (+03). Referans: `origin/main` @ `4578b115` (bu denetimin font + gitignore commitleri dahil).
Hiçbir branch, stash veya worktree silinmedi; force-push yapılmadı. Sadece `main`e push edildi.

## 1. Ana checkout (`~/Documents/projs/gina`)

- Yerel `main` 93 commit gerideydi → `git pull --rebase origin main` ile güncellendi.
- **Commitlenip pushlandı:**
  - `assets: Gina font prototipi (GinaVF, Birlik/Keşif) — uygulamaya entegre değil` — `packages/assets/fonts/gina/` (20 dosya, 876 KB; sır/anahtar yok, uygulamaya bağlı değil).
  - `chore: .claude/worktrees yok say` — `.gitignore`a `.claude/worktrees/` eklendi (83 ajan worktree'si artık untracked görünmüyor; içerik commitlenmedi).
- Sonrasında ana checkout temiz.
- `git worktree prune`: kaldırılacak bayat kayıt yoktu; **103 ek worktree** kayıtlı (ana checkout hariç).

## 2. Stash `stash@{0}` — "local-wip-before-main-sync-2026-11-05"

**Hüküm: tamamı main'de (daha yeni hâliyle). Uygulanmasına gerek yok.** (Dokunulmadı, drop edilmedi.)

| Dosya | Durum |
|---|---|
| `.gitignore` (`.codex-setup/`, `apps/mobile/credentials.json`) | main'de var |
| `apps/mobile/app.json` (`owner`, EAS `projectId`, `newArchEnabled` kaldırma) | main'de var |
| `apps/mobile/eas.json` (`tablet` profili) | main'de var |
| `docs/release/YAYIN-KURULUM-REHBERI.md` (+129 satır) | 128 satır birebir main'de; 1 satır (tablet eşleştirme paragrafı) main'de daha yeni QR/8 haneli kod sürümüyle değişmiş |
| Untracked: `packages/assets/brand/apple-mint-delivery/**` (14 dosya) | main'de birebir aynı |
| Untracked: `packages/assets/fonts/gina/**` | bu denetimde commitlenen dosyalarla birebir aynı |
| Untracked: `docs/release/TABLET-KABLOSUZ-DAGITIM.md`, `scripts/prepare-tablet-install.mjs` | main'deki sürüm daha yeni (stash'teki eski hâli) |

## 3. Branch'ler (`origin` + yerel, `main` hariç) — 437 ref (173 remote, 264 yerel)

Yöntem: `git cherry origin/main <branch>` ile '+' sayısı; '+' olanlar için tip'in main'den farklı olduğu dosyalar, `git merge-tree` ve GitHub PR durumu (PR head SHA ile tip karşılaştırması).

| Sınıf | Remote | Yerel | Toplam |
|---|---|---|---|
| (a1) 0 '+' — tamamen main'de | 143 | 232 | 375 |
| (a2) '+' var ama dosya içerikleri main ile aynı (squash/yeniden yazılmış) | 3 | 4 | 7 |
| (a3) '+' var, squash-merge edilmiş PR'ın head'i (tip == merged PR head; farklar sadece main'in sonradan ilerlemesi) | 26 | 27 | 53 |
| (b) main'de olmayan iş (aşağıda) | 1 (kapalı PR #50) | 2 | 3 |

(a2): `codex/assets-tasks-mvp30`, `codex/branded-product-email`, `codex/design-fidelity-audit`, `codex/testflight14-status` (+ remote eşleri).

(a3) branch → PR: assets-brand #2, backoffice-protected-release #137, calendar-school-planner #34, family-experience-13 #42, group-library-integration #87, learning-documents-admin #48, learning-plan #110, learning-plan-import #112, learning-progress-screen #60, library-first-batch #163, notebook-device-acceptance #66, parent-review-delivery #53, parent-review-durable-drafts #118, parent-review-implementation #51, premium-art-guidance #9, premium-v3-delivery #14, prova-answer-recovery-audit #117, prova-builder-implementation #57, prova-review-clarity #54, prova-unified-hub #56, release-20-publish #136, restore-approved-home-layouts #75, reward-history #146, room-chrome-production #15, task-submission-receipts #111, v5-pet-weather #28 (hepsi MERGED, tip PR head ile aynı).

### (b) Main'de olmayan iş

| Branch | '+' | Son commit | Son konu | Değişen dosyalar (merge-base'e göre) | Not |
|---|---|---|---|---|---|
| `codex/library-batch-review` (sadece yerel, PR yok) | 10 | 2026-11-07 04:37 | docs: record 30-question OYSS round, approvals and Sol comparison | 211 dosya, +26.032: `docs/learning/library-batches/2026-11-07-*` (oyss-round30 108 dosya, g7-math-b02…b08), `supabase/operations/library-first-batch/batch-0[3-8]-handler.ts`, `oyss-round30-handler.ts` | **Aktif Codex işi** — worktree `/private/tmp/gina-library-first-batch`, ayrıca untracked `supabase/functions/library-generation-batch/` (04:58). main'e temiz merge olur; ajan bitirince PR'lanmalı. |
| `wip/plan-limit-cta-2026-11-05` (yerel, bu denetimde oluşturuldu) | 1 | 2026-11-05 02:17 (değişiklik zamanı) | wip: plan limiti hata mesajı + 'Planları incele' CTA | `packages/core/src/plan-limit.ts` (+test), `child-setup.tsx`, `wizard.tsx`, `ui/screen.tsx`, `parent/menu.tsx`, i18n en/tr | `~/.codex/worktrees/gina-avatars/gina` (branch `codex/prova-clarity-fixes`) içindeki commitlenmemiş kod; worktree'ye dokunmadan ayrı branch'e kurtarıldı. Taban 3 Kasım main'i — main'e almak için rebase + test gerekir. |
| `codex/parent-review-design` (PR #50 CLOSED) | 1 | 2026-11-02 | design(prova): propose parent annotation and review workspace | `docs/design/screens/prova-parent-review/REVIEW.md`, `proposal-v1.json` | Aynı dosyalar main'de daha yeni hâliyle var; pratikte geçersiz. |

## 4. Diğer worktree'lerde commitlenmemiş değişiklikler

| Worktree | Branch | Değişiklik | Son değişiklik | Durum |
|---|---|---|---|---|
| `/private/tmp/gina-library-first-batch` | codex/library-batch-review | untracked `supabase/functions/library-generation-batch/` | 07.11 04:58 | Aktif Codex — dokunulmadı |
| `/private/tmp/gina-prereview-output-fix` | codex/content-review-calibration | 7 dosya M (+25/−6): `_shared/ai-adapter-openai.ts`, `prereview-config.ts`, testler… | 07.11 05:00 | Aktif Codex — dokunulmadı |
| `~/.codex/worktrees/gina-live-acceptance/gina` | codex/live-acceptance-20261107 (PR #159 MERGED) | 5 untracked PNG (`expired-link`, `meb-panel`, `product-key-active`, `smtp-approval`, `testflight-32`), 380 KB | 07.11 01:34 | main'de referans yok; `product-key-active`/`smtp-approval` hassas bilgi içerebilir → bakmadan commitlenmedi |
| `~/.codex/worktrees/gina-avatars/gina` | codex/prova-clarity-fixes | 7 M + 183 untracked (çoğu ekran görüntüsü, `.playwright-mcp/`, `mint-home` oda taslakları, `...NOT-APPROVED.zip`) | 05.11 02:17 | Kod kısmı `wip/plan-limit-cta-2026-11-05`e kurtarıldı; görseller/taslaklar olduğu yerde |
| `/private/tmp/gina-android-acceptance-20261104` | (detached) | `app.json` QA adı/şeması + `qa-journal.tsx` | 04.11 16:49 | QA amaçlı geçici yama; main'e alınmamalı |

## 5. Açık PR

GitHub'da açık PR yok.

## 6. Sonuç (7 Kasım ~05:10)

- **Plan limiti WIP'i main'e alındı:** `f8d6a771 feat: plan limiti hatasında 'Planları incele' yönlendirmesi (5 Kasım WIP'inden)`. Güncel main üzerine taşındı, 5 dosyada çakışma vardı:
  - `parent/menu.tsx`: main'deki yeni eşleştirme akışı korundu (artık `/parent/pair-device`). Buton eşleştirme ekranındaki `ErrorText`e eklendi.
  - `child-setup.tsx`: önce özel plan limiti mesajı gösteriliyor, eşleşme yoksa main'deki `betaUx.planLimit` ve eğitim geçişi mesajları kullanılıyor. Buna "Paketleri incele" butonu eklendi.
  - i18n en/tr: 5 yeni `subscription.*` anahtarı. `core/index.ts`: `plan-limit` dışa aktarıldı.
  - Kontroller: `turbo lint typecheck test` 7/7, core vitest 70 dosya / 749 test, mobil tsc ve expo lint temiz. Native-text, notebook-layout ve answer-recovery kontrolleri 17/17 geçti.
  - `wip/plan-limit-cta-2026-11-05` yerel branch'i ve gina-avatars worktree'si olduğu gibi duruyor (silinmedi).
- **live-acceptance ekran görüntüleri:** commitlenmedi. main'de referansları yok ve key/SMTP içerebilirler. Dokunulmadı.
- `codex/library-batch-review` ve `codex/content-review-calibration`: Codex aktif olduğu için dokunulmadı.
