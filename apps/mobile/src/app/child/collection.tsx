import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, Text, View, useWindowDimensions } from "react-native";

import { NineSlice } from "@/components/room/nine-slice";
import { shelfDisplayArt } from "@/components/room/room-art";
import { ILLUSTRATED_GAMIFICATION } from "@/generated/illustrated/gamification";
import { Collectible } from "@/components/collectible";
import { CelebrationBurst } from "@/components/collectible-motion";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/screen";
import { ChildScreen as Screen } from "@/components/room/child-screen";
import { useActiveChild } from "@/lib/active-child";
import { useChildBadges } from "@/lib/use-child-badges";

// Bu oturumda kutlanan rozetler: kutlama yalnız bir kez oynar (yeniden açılışta tekrar etmez).
const celebrated = new Set<string>();
const CELEBRATE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Koleksiyonum: kazanılan rozetler ve henüz kilitli olanlar (resimli v3 seti). */
export default function ChildCollectionScreen() {
  const { t, i18n } = useTranslation();
  const { width, fontScale } = useWindowDimensions();
  const singleColumn = fontScale > 1.2;
  const collectibleSize = width >= 900 ? 138 : 88;
  const { childId } = useActiveChild();
  const badges = useChildBadges(childId, i18n.language);
  const earnedCount = badges.data?.filter((b) => b.earned).length ?? 0;
  // Son 24 saatte kazanılan ve henüz kutlanmamış en yeni rozet (liste en yeni önce sıralı). Rozet sunucuda verilir; burada yalnız gösterim.
  const [openedAt] = useState(() => Date.now());
  const [doneSlug, setDoneSlug] = useState<string | null>(null);
  const fresh = badges.data?.find(
    (b) => b.earned && b.awardedAt && !celebrated.has(`${childId}:${b.slug}`) && openedAt - Date.parse(b.awardedAt) < CELEBRATE_WINDOW_MS,
  );
  const celebrating = fresh && fresh.slug !== doneSlug ? fresh.slug : null;

  return (
    <Screen tone="child" surface="collection" loading={badges.isLoading} title={t("room.myCollection")}>
      <Text className="font-body text-base text-ink">
        {t("collection.summary", { earned: earnedCount, total: badges.data?.length ?? 0 })}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {badges.data?.map((badge) => (
          <View
            key={badge.slug}
            style={{ width: singleColumn ? "100%" : "50%", marginBottom: -8 }}
            accessible
            accessibilityLabel={`${badge.title}: ${badge.earned ? t("collection.earned") : t("collection.locked")}`}
          >
            <NineSlice skin="child-cabinet-cell-v5" scale={width >= 900 ? .55 : .3} contentStyle={{ alignItems: "center", gap: 6 }}>
            <View className="items-center justify-center">
              {shelfDisplayArt(badge) || !badge.earned ? <Image source={badge.earned ? shelfDisplayArt(badge)! : ILLUSTRATED_GAMIFICATION["display-locked"]} resizeMode="contain" accessible={false} style={{ width: collectibleSize, height: collectibleSize, opacity: badge.earned ? 1 : .5 }} /> : <Collectible slug={badge.icon} size={collectibleSize} />}
              {celebrating === badge.slug ? (
                <View className="absolute" pointerEvents="none">
                  <CelebrationBurst
                    size={collectibleSize}
                    onFinish={() => {
                      celebrated.add(`${childId}:${badge.slug}`);
                      setDoneSlug(badge.slug);
                    }}
                  />
                </View>
              ) : null}
            </View>
            <Text style={{ backgroundColor: "#FFD59A", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, fontFamily: "Baloo2_700Bold", color: "#65421E", textAlign: "center", fontSize: 16 }}>{badge.title}</Text>
            <Text className="font-body text-xs text-gray-600">{badge.earned ? t("collection.earned") : t("collection.locked")}</Text>
            </NineSlice>
          </View>
        ))}
      </View>
      <ErrorText error={badges.error} />
      <Button variant="ghost" title={t("child.today")} onPress={() => router.back()} />
    </Screen>
  );
}
