import type { ImageSourcePropType } from "react-native";

import { ILLUSTRATED_GAMIFICATION, isIllustratedGamificationSlug } from "@/generated/illustrated/gamification";

// Odadaki resimli yuvalar (BRIEF 13 / D): görseller packages/assets/gamification/illustrated-v3/manifest.json'a
// eklenip `node scripts/generate-illustrated.mjs` çalıştırıldığında ILLUSTRATED_GAMIFICATION'a kendiliğinden girer;
// buradaki aramalar ek kod gerektirmeden onları kullanır. Görsel yoksa null döner ve yuva hiç çizilmez.
// Not: Codex görselleri ayrı bir klasöre (ör. gamification/display/) koyarsa generate-illustrated.mjs CATEGORIES
// listesine o klasör yeni kategori olarak eklenmeli ve aşağıdaki aramalara o eşleme de katılmalı.

function gamificationSource(slug: string): ImageSourcePropType | null {
  return isIllustratedGamificationSlug(slug) ? ILLUSTRATED_GAMIFICATION[slug] : null;
}

/**
 * Hedef biletinin sol/sağ ödül görselleri (`family_rewards.icon`, ör. reward-movie-night).
 * Çift teslim: `{icon}-left` + `{icon}-right`; tek görsel teslimi: `{icon}` (solda).
 */
export function rewardTicketArt(icon: string | null | undefined): { left: ImageSourcePropType | null; right: ImageSourcePropType | null } {
  if (!icon) return { left: null, right: null };
  const left = gamificationSource(`${icon}-left`) ?? gamificationSource(icon);
  const right = gamificationSource(`${icon}-right`);
  return { left, right };
}

/**
 * Raftaki 3B sergi nesnesi: önce `display-{rozet slug}` (ör. display-dis-parlatan),
 * sonra `display-{ikon slug, badge- öneki olmadan}` (ör. display-first-task). Yoksa null → madalya gösterilir.
 */
export function shelfDisplayArt(badge: { slug: string; icon: string }): ImageSourcePropType | null {
  return gamificationSource(`display-${badge.slug}`) ?? gamificationSource(`display-${badge.icon.replace(/^badge-/, "")}`);
}
