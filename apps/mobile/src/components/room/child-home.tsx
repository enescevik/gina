import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View, type ImageSourcePropType } from "react-native";

import Wordmark from "../../../../../packages/assets/brand/yan-yana/logo-wordmark.svg";

import { Collectible } from "@/components/collectible";
import { BoardProgress } from "@/components/room/board-progress";
import { ZONES, roomSkinScale } from "@/components/room/layout";
import { NineSlice, SkinIcon, SkinPressable, SkinProgress } from "@/components/room/nine-slice";
import { rewardTicketArt, shelfDisplayArt } from "@/components/room/room-art";
import { RoomScene, type CharacterKey } from "@/components/room/scene";
import { SkinTaskCard, sortForBoard } from "@/components/room/skin-task-card";
import { ErrorText } from "@/components/ui/screen";
import { useChildBadges } from "@/lib/use-child-badges";
import { useChildExamCount } from "@/lib/use-child-exam-count";
import { useChildGoal } from "@/lib/use-child-goal";
import { useChildRoomPrefs } from "@/lib/use-child-room-prefs";
import { childPath } from "@/lib/active-child";
import { useChildToday } from "@/lib/use-child-today";

/** Panoda görünür alana sığan görev kâğıdı sayısı (onaylı referans: iki büyük kâğıt; kalanı pano içinde kayar). */
const BOARD_VISIBLE_CARDS = 2;

/** Raftaki nesne: Codex display-* sergi görseli teslim edince otomatik kullanılır; yoksa madalya (BRIEF 13 / D.2). */
function ShelfObject({ badge, s }: { badge: { slug: string; icon: string }; s: number }) {
  const display = shelfDisplayArt(badge);
  if (!display) return <Collectible slug={badge.icon} size={Math.max(48, 64 * s)} style={{ marginTop: -34 * s }} />;
  const size = Math.max(56, 84 * s);
  return (
    <Image
      source={display}
      resizeMode="contain"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, marginTop: -50 * s }}
    />
  );
}

/** Bilet yanındaki ödül görseli yuvası; görsel yoksa yer kaplamaz. */
function TicketArt({ source, size }: { source: ImageSourcePropType | null; size: number }) {
  if (!source) return null;
  return (
    <Image
      source={source}
      resizeMode="contain"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
    />
  );
}

export interface RoomChildHomeProps {
  childId: string;
  childName: string;
  character?: CharacterKey;
  actingAsParent?: boolean;
  onParentExit: () => void;
  exitBusy?: boolean;
  actionError?: unknown;
}

/** Onaylı tasarımın (child-home-approved.png) gerçek verili hâli: pano, hedef bileti, Haftam, raf ve Başardıklarım. */
export function RoomChildHome({ childId, childName, character: providedCharacter, actingAsParent = false, onParentExit, exitBusy, actionError }: RoomChildHomeProps) {
  const { t, i18n } = useTranslation();
  const data = useChildToday(childId, actingAsParent);
  const badges = useChildBadges(childId, i18n.language);
  const shelf = (badges.data ?? []).filter((b) => b.earned).slice(0, 3);
  const earnedCount = (badges.data ?? []).filter((b) => b.earned).length;
  const assignedExams = useChildExamCount(childId);
  const goal = useChildGoal(childId);
  const weekday = new Intl.DateTimeFormat(i18n.language, { weekday: "short", timeZone: "UTC" });
  // Satır yoksa sütun varsayılanı ('cat') geçerlidir.
  const prefs = useChildRoomPrefs(childId);
  const pet = prefs.data?.petKey ?? "cat";
  const character = providedCharacter ?? (prefs.data?.characterKey === "girl" || prefs.data?.characterKey === "boy" ? prefs.data.characterKey : "unspecified");
  // Pano kaydırma alanının yüksekliği: iki kâğıt tam sığacak şekilde kart yüksekliği buradan hesaplanır.
  const [listHeight, setListHeight] = useState(0);

  return (
    <RoomScene character={character} pet={pet}>
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
        const ticketArt = rewardTicketArt(goalData?.rewardIcon);
        const ticketArtSize = Math.round(68 * s);
        const boardTasks = sortForBoard(data.due);
        const cardGap = 10 * s;
        // Kâğıdın minimum yüksekliği (task-card minimumLogicalSize ~57 dp) altına inilmez; çok kısa sahnede kart içerik kadar olur.
        const cardHeight = listHeight > 0 ? Math.max(96 * s, (listHeight - cardGap * (BOARD_VISIBLE_CARDS - 1) - 4) / BOARD_VISIBLE_CARDS) : undefined;

        return (
          <>
            {/* Üst çubuk: logo + selamlama solda; yıldız ve Ebeveyn hapları sağda */}
            <View style={{ position: "absolute", ...header }} className="flex-row items-center justify-between">
              <View className="flex-row items-center" style={{ gap: 16 * s }}>
                <Wordmark width={110 * s} height={48 * s} accessibilityLabel="Gina" />
                <View className="bg-ink/15" style={{ width: 2, height: 44 * s }} />
                {/* Onaylı referansta selamlamanın altında vurgu çizgisi yok (header-greeting-underline kullanılmıyor). */}
                <Text accessibilityRole="header" className="font-display text-ink" style={{ fontSize: fs(30), lineHeight: fs(38) }}>
                  {t("child.hello", { name: childName })}
                </Text>
              </View>
              <View className="flex-row items-center" style={{ gap: 12 * s }}>
                <View accessible accessibilityLabel={t("room.starCount", { count: data.stars })}>
                  <NineSlice skin="pill-star" scale={s} contentClassName="justify-center">
                    <Text className="font-body-bold text-ink" style={{ fontSize: fs(17) }}>
                      {t("room.starCount", { count: data.stars })}
                    </Text>
                  </NineSlice>
                </View>
                <SkinPressable
                  skin="pill-parent"
                  pressedSkin="pill-parent-pressed"
                  scale={s}
                  onPress={onParentExit} disabled={exitBusy}
                  accessibilityLabel={t("room.parentExit")}
                  contentClassName="justify-center"
                  hitSlop={6}
                >
                  <Text className="font-body-bold text-ink" style={{ fontSize: fs(17) }}>
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
              contentStyle={{ flex: 1, flexGrow: 1, paddingTop: 28 * s }}
            >
              <View style={{ height: 115 * s }}>
              <Text accessibilityRole="header" className="font-display text-ink" style={{ fontSize: fs(28), lineHeight: fs(36) }}>
                {t("room.todayTasks")}
              </Text>
              <Text className="font-body text-ink/80" style={{ fontSize: fs(17) }}>
                {t("room.completedOf", { done: doneCount, total: data.due.length })}
              </Text>
              <View style={{ marginTop: 6 * s, marginBottom: 10 * s }}>
                <BoardProgress
                  done={doneCount}
                  total={data.due.length}
                  s={s}
                  statuses={data.due.map((task) => task.status === "done" || task.status === "approved")}
                />
              </View>
              </View>
              <ErrorText error={actionError ?? data.error ?? goal.error ?? badges.error ?? assignedExams.error} />
              <ScrollView
                style={{ flex: 1 }}
                onLayout={(e) => setListHeight(e.nativeEvent.layout.height)}
                contentContainerStyle={{ gap: cardGap, paddingBottom: 4 }}
                snapToInterval={cardHeight ? cardHeight + cardGap : undefined}
                decelerationRate="fast"
                showsVerticalScrollIndicator={boardTasks.length > BOARD_VISIBLE_CARDS}
              >
                {data.loading ? <ActivityIndicator color="#0B7F7F" /> : null}
                {data.due.length === 0 && !data.loading && !data.error ? (
                  <Text className="font-body text-ink" style={{ fontSize: fs(18) }}>
                    {t("child.allDone")}
                  </Text>
                ) : null}
                {boardTasks.map((task) => (
                  <SkinTaskCard
                    key={task.id}
                    task={task}
                    s={s}
                    large
                    height={cardHeight}
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
                onPress={() => router.push(childPath("goal", actingAsParent))}
                accessibilityLabel={
                  goalData
                    ? `${t("room.myGoal")}: ${goalData.rewardTitle}, ${t("room.goalProgress", { stars: Math.min(data.stars, goalData.cost), cost: goalData.cost })}`
                    : `${t("room.myGoal")}: ${t("goal.pickCta")}`
                }
                style={{ width: goalRect.width, flexGrow: 272, flexBasis: 0 }}
                contentClassName="items-center justify-center"
                contentStyle={{ paddingTop: 24 * s, paddingBottom: 22 * s, paddingHorizontal: 22 * s, gap: 4 * s }}
              >
                {/* Sol/sağ ödül görseli yuvaları (BRIEF 13 / D.1): görsel yoksa hiç çizilmez, metin ortada kalır. */}
                <View pointerEvents="none" style={{ position: "absolute", left: 20 * s, bottom: 28 * s }}><TicketArt source={goalData ? ticketArt.left : null} size={ticketArtSize * .8} /></View>
                <View className="items-center justify-center" style={{ width: "100%", gap: 2 * s }}>
                <Text className="font-display text-ink" style={{ fontSize: fs(24), lineHeight: fs(28) }}>
                  {t("room.myGoal")}
                </Text>
                {goal.isLoading ? <ActivityIndicator color="#0B7F7F" /> : null}
                {goalData ? (
                  <>
                    <Text numberOfLines={1} adjustsFontSizeToFit className="font-display text-ink" style={{ fontSize: fs(25), lineHeight: fs(31) }}>
                      {goalData.rewardTitle}
                    </Text>
                    <Text className="font-body-bold text-ink" style={{ fontSize: fs(17) }}>
                      {t("room.goalProgress", { stars: Math.min(data.stars, goalData.cost), cost: goalData.cost })}
                    </Text>
                    <SkinProgress value={data.stars / goalData.cost} scale={s} style={{ width: "60%", marginVertical: 4 * s }} />
                    <Text className="font-display text-ink" style={{ fontSize: fs(20), lineHeight: fs(26) }}>
                      {remaining === 0 ? t("goal.reached") : t("room.starsLeft", { count: remaining })}
                    </Text>
                  </>
                ) : !goal.isLoading ? (
                  <Text className="font-body-bold text-teal-dark" style={{ fontSize: fs(18) }}>
                    {t("goal.pickCta")}
                  </Text>
                ) : null}
                </View>
                <View pointerEvents="none" style={{ position: "absolute", right: 20 * s, bottom: 28 * s }}><TicketArt source={goalData ? ticketArt.right : null} size={ticketArtSize * .8} /></View>
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

              <NineSlice skin="cabinet-display" scale={s} style={{ width: shelfZone.width, height: 220 * s }}
                contentClassName="flex-row items-end" contentStyle={{ gap: 4 * s, paddingBottom: 110 * s }}>
                {[0, 1, 2].map(i => <Pressable key={i} accessibilityRole="button" onPress={() => router.push(childPath("collection", actingAsParent))}
                  accessibilityLabel={shelf[i]?.title ?? t("room.displaySlot")} style={{ flex: 1, minHeight: 72 * s, alignItems: "center", justifyContent: "flex-end" }}>
                  {shelf[i] ? <>
                    <ShelfObject badge={shelf[i]} s={s} />
                    <Text numberOfLines={1} className="font-body-bold text-ink" style={{ fontSize: fs(12), paddingHorizontal: 4, backgroundColor: "#FFF1D4", borderRadius: 4 }}>{shelf[i].title}</Text>
                  </> : null}
                </Pressable>)}
                <Pressable accessibilityRole="button" accessibilityLabel={t("room.myCollection")} onPress={() => router.push(childPath("collection", actingAsParent))}
                  style={{ position: "absolute", left: 75 * s, right: 35 * s, bottom: 43 * s, minHeight: 50 * s, justifyContent: "center" }}>
                  <Text numberOfLines={1} className="font-display text-ink" style={{ fontSize: fs(22), lineHeight: fs(27) }}>{t("room.myWins")}</Text>
                  <Text className="font-body text-ink" style={{ fontSize: fs(13) }}>{t("collection.badgeCount", { count: earnedCount })}</Text>
                </Pressable>
              </NineSlice>
            </View>

            <SkinPressable skin="button-outline" pressedSkin="button-outline-pressed" scale={s}
              accessibilityLabel={t("childV5.customize")} onPress={() => router.push(childPath("room-preview", actingAsParent))}
              style={{ position: "absolute", left: frame.left + frame.width * .42, bottom: 10, minHeight: 48 }}>
              <Text className="font-body-bold text-ink">{t("childV5.customize")}</Text>
            </SkinPressable>
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
                  {t("prova.title")}
                </Text>
                {(assignedExams.data ?? 0) > 0 ? (
                  <View className="h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1">
                    <Text className="text-xs font-body-bold text-white">{assignedExams.data}</Text>
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
