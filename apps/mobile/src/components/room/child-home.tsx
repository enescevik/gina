import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import Wordmark from "../../../../../packages/assets/brand/yan-yana/logo-wordmark.svg";

import { Collectible } from "@/components/collectible";
import { ZONES, roomSkinScale } from "@/components/room/layout";
import { NineSlice, SkinIcon, SkinPressable, SkinProgress } from "@/components/room/nine-slice";
import { RoomScene, type CharacterKey } from "@/components/room/scene";
import { SkinTaskCard, sortForBoard } from "@/components/room/skin-task-card";
import { ErrorText } from "@/components/ui/screen";
import { useChildBadges } from "@/lib/use-child-badges";
import { useChildExamCount } from "@/lib/use-child-exam-count";
import { useChildGoal } from "@/lib/use-child-goal";
import { useChildToday } from "@/lib/use-child-today";

export interface RoomChildHomeProps {
  childId: string;
  childName: string;
  character?: CharacterKey;
  actingAsParent?: boolean;
  onParentExit: () => void;
}

/** Onaylı tasarımın (child-home-approved.png) gerçek verili hâli: pano, hedef bileti, Haftam, raf ve Başardıklarım. */
export function RoomChildHome({ childId, childName, character = "unspecified", actingAsParent = false, onParentExit }: RoomChildHomeProps) {
  const { t, i18n } = useTranslation();
  const data = useChildToday(childId, actingAsParent);
  const badges = useChildBadges(childId, i18n.language);
  const shelf = (badges.data ?? []).filter((b) => b.earned).slice(0, 3);
  const earnedCount = (badges.data ?? []).filter((b) => b.earned).length;
  const assignedExams = useChildExamCount(childId);
  const goal = useChildGoal(childId);
  const weekday = new Intl.DateTimeFormat(i18n.language, { weekday: "short", timeZone: "UTC" });

  return (
    <RoomScene character={character}>
      {({ rect, frame }) => {
        const s = roomSkinScale(frame.width);
        const fs = (n: number) => Math.round(n * s);
        const header = rect(ZONES.header);
        const board = rect(ZONES.taskBoard);
        const column = rect(ZONES.rightColumn);
        const goalRect = rect(ZONES.goal);
        const week = rect(ZONES.week);
        const shelfZone = rect(ZONES.shelf);
        const shelfRect = rect(ZONES.bookshelf);
        const doneCount = data.due.filter((d) => d.status === "done" || d.status === "approved").length;
        const nextTaskId = data.due.find((d) => d.status === null || d.status === "returned")?.id;
        const goalData = goal.data;
        const remaining = goalData ? Math.max(0, goalData.cost - data.stars) : 0;

        return (
          <>
            {/* Üst çubuk: logo + selamlama solda; yıldız ve Ebeveyn hapları sağda */}
            <View style={{ position: "absolute", ...header }} className="flex-row items-center justify-between">
              <View className="flex-row items-center" style={{ gap: 16 * s }}>
                <Wordmark width={160 * s} height={70 * s} accessibilityLabel="Gina" />
                <View className="bg-ink/15" style={{ width: 2, height: 44 * s }} />
                <View>
                  <Text accessibilityRole="header" className="font-display text-ink" style={{ fontSize: fs(38), lineHeight: fs(48) }}>
                    {t("child.hello", { name: childName })}
                  </Text>
                  <NineSlice skin="header-greeting-underline" scale={s} style={{ marginTop: -6 * s }} />
                </View>
              </View>
              <View className="flex-row items-center" style={{ gap: 12 * s }}>
                <View accessible accessibilityLabel={t("room.starCount", { count: data.stars })}>
                  <NineSlice skin="pill-star" scale={s} contentClassName="justify-center">
                    <Text className="font-body-bold text-ink" style={{ fontSize: fs(20) }}>
                      {t("room.starCount", { count: data.stars })}
                    </Text>
                  </NineSlice>
                </View>
                <SkinPressable
                  skin="pill-parent"
                  pressedSkin="pill-parent-pressed"
                  scale={s}
                  onPress={onParentExit}
                  accessibilityLabel={t("room.parentExit")}
                  contentClassName="justify-center"
                  hitSlop={6}
                >
                  <Text className="font-body-bold text-ink" style={{ fontSize: fs(20) }}>
                    {t("room.parentExit")}
                  </Text>
                </SkinPressable>
              </View>
            </View>

            {/* Görev panosu: board-frame + ayrı task-card kâğıtları */}
            <NineSlice
              skin="board-frame"
              scale={s}
              style={{ position: "absolute", ...board }}
              contentStyle={{ flex: 1, flexGrow: 1 }}
            >
              <Text accessibilityRole="header" className="font-display text-ink" style={{ fontSize: fs(34), lineHeight: fs(40) }}>
                {t("room.todayTasks")}
              </Text>
              <Text className="font-body text-ink/80" style={{ fontSize: fs(19) }}>
                {t("room.completedOf", { done: doneCount, total: data.due.length })}
              </Text>
              {data.due.length > 0 ? (
                <View
                  className="flex-row flex-wrap"
                  style={{ gap: 6 * s, marginTop: 6 * s, marginBottom: 8 * s }}
                  accessible={false}
                  importantForAccessibility="no-hide-descendants"
                >
                  {data.due.map((task) => (
                    <SkinIcon
                      key={task.id}
                      skin={task.status === "done" || task.status === "approved" ? "progress-dot-filled" : "progress-dot-empty"}
                      size={16 * s}
                    />
                  ))}
                </View>
              ) : null}
              <ErrorText error={data.error} />
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 8 * s, paddingBottom: 4 }}>
                {data.loading ? <ActivityIndicator color="#0B7F7F" /> : null}
                {data.due.length === 0 && !data.loading && !data.error ? (
                  <Text className="font-body text-ink" style={{ fontSize: fs(18) }}>
                    {t("child.allDone")}
                  </Text>
                ) : null}
                {sortForBoard(data.due).map((task) => (
                  <SkinTaskCard
                    key={task.id}
                    task={task}
                    s={s}
                    isNext={task.id === nextTaskId}
                    completing={data.completing}
                    onComplete={() => data.complete(task.id)}
                  />
                ))}
              </ScrollView>
            </NineSlice>

            {/* Sağ sütun: hedef bileti → Haftam → sergi rafı → Başardıklarım çekmecesi */}
            <View
              style={{ position: "absolute", left: column.left, top: column.top, width: column.width, height: column.height, gap: 6 * s }}
              className="items-center"
            >
              <SkinPressable
                skin={goalData ? "ticket-goal" : "ticket-goal-empty"}
                scale={s}
                onPress={() => router.push("/child/goal")}
                accessibilityLabel={
                  goalData
                    ? `${t("room.myGoal")}: ${goalData.rewardTitle}, ${t("room.goalProgress", { stars: Math.min(data.stars, goalData.cost), cost: goalData.cost })}`
                    : `${t("room.myGoal")}: ${t("goal.pickCta")}`
                }
                style={{ width: goalRect.width, flexGrow: 272, flexBasis: 0 }}
                contentClassName="items-center justify-center"
              >
                <Text className="font-display text-ink" style={{ fontSize: fs(24), lineHeight: fs(28) }}>
                  {t("room.myGoal")}
                </Text>
                {goal.isLoading ? <ActivityIndicator color="#0B7F7F" /> : null}
                {goalData ? (
                  <>
                    <Text numberOfLines={1} adjustsFontSizeToFit className="font-display text-ink" style={{ fontSize: fs(32), lineHeight: fs(38) }}>
                      {goalData.rewardTitle}
                    </Text>
                    <Text className="font-body-bold text-ink" style={{ fontSize: fs(17) }}>
                      {t("room.goalProgress", { stars: Math.min(data.stars, goalData.cost), cost: goalData.cost })}
                    </Text>
                    <SkinProgress value={data.stars / goalData.cost} scale={s} style={{ alignSelf: "stretch", marginVertical: 4 * s }} />
                    <Text className="font-display text-ink" style={{ fontSize: fs(26), lineHeight: fs(32) }}>
                      {remaining === 0 ? t("goal.reached") : t("room.starsLeft", { count: remaining })}
                    </Text>
                  </>
                ) : !goal.isLoading ? (
                  <Text className="font-body-bold text-teal-dark" style={{ fontSize: fs(18) }}>
                    {t("goal.pickCta")}
                  </Text>
                ) : null}
              </SkinPressable>

              {/* Haftam duvar takvimi: week-frame; gün hücreleri native, durumlar kaplama */}
              <NineSlice
                skin="week-frame"
                scale={s}
                style={{ width: week.width, flexGrow: 186, flexBasis: 0, minHeight: 118 * s }}
                contentClassName="justify-center"
              >
                <Text accessibilityRole="header" className="text-center font-display text-ink" style={{ fontSize: fs(22), lineHeight: fs(26) }}>
                  {t("room.myWeek")}
                </Text>
                <View className="flex-row justify-between" style={{ marginTop: 2 * s }}>
                  {data.weekSummary.map((day) => {
                    const label = weekday.format(new Date(`${day.date}T12:00:00Z`));
                    const skin = day.due > 0 && day.done >= day.due ? "week-check" : day.done > 0 ? "week-partial" : "week-empty";
                    return (
                      <View
                        key={day.date}
                        accessible
                        accessibilityLabel={`${label}: ${t("room.weekProgress", { done: day.done, total: day.due })}`}
                        className="items-center"
                        style={{ flex: 1, gap: 2 * s, opacity: day.due === 0 ? 0.45 : 1 }}
                      >
                        <Text numberOfLines={1} className="font-body text-ink/80" style={{ fontSize: fs(12) }}>
                          {label}
                        </Text>
                        <SkinIcon skin={skin} size={Math.min(26 * s, week.width / 9)} />
                      </View>
                    );
                  })}
                </View>
              </NineSlice>

              {/* Sergi rafı: shelf-display; üç native yuva content rect içinde x=1/6, 1/2, 5/6 */}
              <NineSlice skin="shelf-display" scale={s} style={{ width: shelfZone.width }} contentClassName="flex-row">
                {[0, 1, 2].map((i) => {
                  const badge = shelf[i];
                  return (
                    <Pressable
                      key={i}
                      accessibilityRole="button"
                      accessibilityLabel={badge ? badge.title : `${t("room.displaySlot")} ${i + 1}`}
                      onPress={() => router.push("/child/collection")}
                      className="flex-1 items-center justify-end"
                      style={{ minHeight: 48 }}
                    >
                      {badge ? (
                        <>
                          <Collectible slug={badge.icon} size={Math.max(48, 64 * s)} style={{ marginTop: -34 * s }} />
                          <Text numberOfLines={1} className="font-body-bold text-cream" style={{ fontSize: fs(12) }}>
                            {badge.title}
                          </Text>
                        </>
                      ) : null}
                    </Pressable>
                  );
                })}
              </NineSlice>

              {/* Başardıklarım çekmecesi: bugünün gerçek özeti → Koleksiyonum (yıldız kulpu kaplamada) */}
              <SkinPressable
                skin="drawer-front"
                pressedSkin="drawer-front-pressed"
                scale={s}
                onPress={() => router.push("/child/collection")}
                style={{ width: shelfZone.width }}
                contentClassName="flex-row items-center"
              >
                <View className="flex-1">
                  <Text numberOfLines={1} className="font-display text-ink" style={{ fontSize: fs(24), lineHeight: fs(30) }}>
                    {t("room.myWins")}
                  </Text>
                  <Text numberOfLines={2} className="font-body text-ink" style={{ fontSize: fs(15) }}>
                    {t("room.todaySummary", { tasks: data.todayDone, stars: data.todayStarsEarned })}
                    {earnedCount > 0 ? ` · ${t("collection.badgeCount", { count: earnedCount })}` : ""}
                  </Text>
                </View>
                <Text className="font-display text-ink" style={{ fontSize: fs(28) }}>
                  ›
                </Text>
              </SkinPressable>
            </View>

            {/* Kitaplık: Prova kapısı; atanmış deneme varsa işaret */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                (assignedExams.data ?? 0) > 0
                  ? `${t("prova.title")}, ${t("prova.waitingCount", { count: assignedExams.data ?? 0 })}`
                  : t("prova.title")
              }
              onPress={() => router.push(actingAsParent ? "/parent/child-mode/prova" : "/child/prova")}
              style={{ position: "absolute", ...shelfRect }}
              className="items-center justify-start"
            >
              <View className="mt-1 flex-row items-center gap-1 rounded-full bg-white/90 px-3 py-1">
                <Text className="font-display text-ink" style={{ fontSize: fs(16) }}>
                  📚 {t("prova.title")}
                </Text>
                {(assignedExams.data ?? 0) > 0 ? (
                  <View className="h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1">
                    <Text className="text-xs font-bold text-white">{assignedExams.data}</Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          </>
        );
      }}
    </RoomScene>
  );
}
