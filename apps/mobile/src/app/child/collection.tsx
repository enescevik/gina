import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, Text, View, useWindowDimensions } from "react-native";

import { shelfDisplayArt } from "@/components/room/room-art";
import { ILLUSTRATED_GAMIFICATION } from "@/generated/illustrated/gamification";
import { Collectible } from "@/components/collectible";
import { CelebrationBurst } from "@/components/collectible-motion";
import { ErrorText } from "@/components/ui/screen";
import { ChildScreen as Screen, ChildEmptyState, childStyles } from "@/components/room/child-screen";
import { useActiveChild } from "@/lib/active-child";
import { useChildBadges } from "@/lib/use-child-badges";
import { useBadgeProgress, type BadgeRule } from "@/components/child-home/badge-progress";
import { TaskIcon } from "@/components/task-icon";

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
  const progress = useBadgeProgress(childId);
  const dateFormat = new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "long" });
  const meaning = (rule: BadgeRule | undefined) => !rule || rule.kind === "unknown" ? t("collection.rule.unknown")
    : rule.kind === "first_task" ? t("collection.rule.first_task")
    : rule.kind === "task_count" ? t("collection.rule.task_count", { count: rule.target })
    : t("collection.rule.planned_care", { count: rule.target });
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
      {(badges.data?.length ?? 0) > 0 && <Text className="font-body text-base text-ink">
        {t("collection.summary", { earned: earnedCount, total: badges.data?.length ?? 0 })}
      </Text>}
      {(badges.data?.length ?? 0) > 0 && <Text style={[childStyles.copy, { fontSize: 14 }]}>{t("collection.personal")}</Text>}
      {!badges.error && earnedCount === 0 && <ChildEmptyState kind="collection" title={t("betaUx.collectionStart")} body={t("betaUx.collectionStartBody")}/>}
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {badges.data?.map((badge) => (
          <View
            key={badge.slug}
            style={{ width: singleColumn ? "100%" : "50%", padding: 5 }}
            accessible
            testID={`badge-${badge.slug}`}
            accessibilityLabel={`${badge.title}: ${badge.earned ? t("collection.earned") : t("collection.locked")}. ${meaning(progress.data?.get(badge.slug))}${!badge.earned && progress.data?.get(badge.slug) && "target" in progress.data.get(badge.slug)! ? ` ${t("collection.progressA11y", { done: (progress.data.get(badge.slug) as { done: number }).done, target: (progress.data.get(badge.slug) as { target: number }).target })}` : ""}`}
          >
            <View style={[childStyles.card,{alignItems:"center",gap:10,minHeight:width >= 900 ? 240 : 210}]}>
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
            <Text style={{ backgroundColor: "#EEEAFE", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, fontFamily: "Nunito_700Bold", color: "#201951", textAlign: "center", fontSize: 16 }}>{badge.title}</Text>
            <Text className="font-body text-xs text-gray-600">{badge.earned ? (badge.awardedAt ? t("collection.earnedOn", { date: dateFormat.format(new Date(badge.awardedAt)) }) : t("collection.earned")) : t("collection.locked")}</Text>
            <BadgeMeaning rule={progress.data?.get(badge.slug)} earned={badge.earned} text={meaning(progress.data?.get(badge.slug))} />
            </View>
          </View>
        ))}
      </View>
      <ErrorText error={badges.error} />
    </Screen>
  );
}

function BadgeMeaning({ rule, earned, text }: { rule: BadgeRule | undefined; earned: boolean; text: string }) {
  const { t } = useTranslation();
  const counted = rule && rule.kind !== "unknown" ? rule : null;
  return <View style={{ alignSelf: "stretch", gap: 6 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center" }}>
      {counted?.kind === "planned_care" ? <TaskIcon slug={counted.icon} size={28} variant="illustrated" /> : null}
      <Text style={{ flexShrink: 1, fontFamily: "Nunito_600SemiBold", color: "#625C85", fontSize: 13, lineHeight: 18, textAlign: "center" }}>{text}</Text>
    </View>
    {counted && !earned ? <>
      <View style={{ height: 8, borderRadius: 8, backgroundColor: "#E9E6EC", overflow: "hidden" }} accessible={false}>
        <View style={{ height: 8, borderRadius: 8, backgroundColor: "#33BFA5", width: `${Math.round(counted.done / counted.target * 100)}%` }} />
      </View>
      <Text style={{ fontFamily: "Nunito_700Bold", color: "#201951", fontSize: 13, textAlign: "center" }}>{t("collection.progress", { done: counted.done, target: counted.target })}</Text>
    </> : null}
  </View>;
}
