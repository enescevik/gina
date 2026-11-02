import { Text, View } from "react-native";
import { Star } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { TaskIcon } from "@/components/task-icon";
import { p, u } from "@/components/planner/ui";
export function TaskTile({ slug, size = 56 }: { slug: string; size?: number }) {
  const background = slug.includes("book")
    ? "#FDECCD"
    : slug.includes("tidy") || slug.includes("plant")
      ? "#DDF4EA"
      : slug.includes("dress")
        ? "#FBE1EB"
        : p.lilac;
  return (
    <View
      accessible={false}
      style={{
        width: size,
        height: size,
        borderRadius: 18,
        backgroundColor: background,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <TaskIcon slug={slug} size={size * 0.88} variant="illustrated" />
    </View>
  );
}
export function StarReward({ count }: { count: number }) {
  const { t } = useTranslation();
  return (
    <View
      accessibilityLabel={t("room.starCount", { count })}
      accessible
      style={[u.row, { gap: 3 }]}
    >
      {Array.from({ length: Math.min(5, count) }, (_, i) => (
        <Star key={i} size={16} color="#C88B27" fill="#F7BC50" />
      ))}
      {count === 0 || count > 5 ? (
        <Text style={u.small}>{t("room.starCount", { count })}</Text>
      ) : null}
    </View>
  );
}
