import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Collectible } from "@/components/collectible";
import { Button } from "@/components/ui/button";
import { ErrorText, Screen } from "@/components/ui/screen";
import { useSession } from "@/lib/session";
import { useChildBadges } from "@/lib/use-child-badges";

/** Koleksiyonum: kazanılan rozetler ve henüz kilitli olanlar (resimli v3 seti). */
export default function ChildCollectionScreen() {
  const { t, i18n } = useTranslation();
  const { claims } = useSession();
  const childId = claims?.child_id ?? "";
  const badges = useChildBadges(childId, i18n.language);
  const earnedCount = badges.data?.filter((b) => b.earned).length ?? 0;

  return (
    <Screen tone="child" title={t("room.myCollection")}>
      <Text className="font-body text-base text-ink dark:text-night-text">
        {t("collection.summary", { earned: earnedCount, total: badges.data?.length ?? 0 })}
      </Text>
      <View className="flex-row flex-wrap gap-4">
        {badges.data?.map((badge) => (
          <View
            key={badge.slug}
            className={`w-36 items-center gap-2 rounded-child p-3 ${badge.earned ? "bg-white dark:bg-night-surface" : "bg-mist/60"}`}
            accessible
            accessibilityLabel={`${badge.title}: ${badge.earned ? t("collection.earned") : t("collection.locked")}`}
          >
            <Collectible slug={badge.icon} locked={!badge.earned} size={96} />
            <Text className="text-center font-display text-sm text-ink dark:text-night-text">{badge.title}</Text>
            <Text className="text-xs text-gray-600">{badge.earned ? t("collection.earned") : t("collection.locked")}</Text>
          </View>
        ))}
      </View>
      <ErrorText error={badges.error} />
      <Button variant="ghost" title={t("child.today")} onPress={() => router.back()} />
    </Screen>
  );
}
