import { Text, View } from "react-native";
import { Star } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Collectible } from "@/components/collectible";
import { p, u } from "@/components/planner/ui";
export const REWARD_ICONS = ["reward-movie-night", "reward-book", "reward-toy", "reward-bike-ride", "reward-park", "reward-ice-cream", "reward-game-with-parent", "reward-mystery-box"];
export function RewardTile({ slug, size = 84 }: { slug: string | null; size?: number }) {
  const color = slug?.includes("book") ? "#DDF4EA" : slug?.includes("game") ? "#FDECCD" : p.lilac;
  return <View accessible={false} style={{ width: size, height: size, borderRadius: 19, backgroundColor: color, alignItems: "center", justifyContent: "center" }}><Collectible slug={slug ?? "reward-mystery-box"} size={size * .88} /></View>;
}
export function RewardCost({ count }: { count: number }) {
  const { t } = useTranslation();
  return <View style={[u.row, { gap: 6 }]}><Star accessible={false} size={22} color="#C88B27" fill="#F7BC50" /><Text style={[u.copy, { flexShrink: 1 }]}>{t("room.starCount", { count })}</Text></View>;
}
