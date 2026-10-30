import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";

import LogoMark from "../../../../../packages/assets/brand/yan-yana/logo-mark.svg";

import { Collectible } from "@/components/collectible";
import { TaskIcon } from "@/components/task-icon";
import { ZONES } from "@/components/room/layout";
import { RoomScene, type CharacterKey } from "@/components/room/scene";
import { supabase } from "@/lib/supabase";
import { useChildBadges } from "@/lib/use-child-badges";
import { useChildGoal } from "@/lib/use-child-goal";
import { useChildToday } from "@/lib/use-child-today";

export interface RoomChildHomeProps {
  childId: string;
  childName: string;
  character?: CharacterKey;
  actingAsParent?: boolean;
  onParentExit: () => void;
}

const DAY_LETTERS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

/** Onaylı tasarımın (resim 1) gerçek verili hâli: pano, hedef bileti, Haftam, Başardıklarım. */
export function RoomChildHome({ childId, childName, character = "unspecified", actingAsParent = false, onParentExit }: RoomChildHomeProps) {
  const { t, i18n } = useTranslation();
  const data = useChildToday(childId, actingAsParent);
  const badges = useChildBadges(childId, i18n.language);
  const shelf = (badges.data ?? []).filter((b) => b.earned).slice(0, 3);
  const earnedCount = (badges.data ?? []).filter((b) => b.earned).length;
  const assignedExams = useQuery({
    queryKey: ["child_exam_count", childId],
    enabled: !!childId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("exams")
        .select("id", { count: "exact", head: true })
        .eq("child_id", childId)
        .eq("status", "assigned");
      if (error) throw error;
      return count ?? 0;
    },
  });
  const goal = useChildGoal(childId);

  return (
    <RoomScene character={character}>
      {({ rect }) => {
        const header = rect(ZONES.header);
        const board = rect(ZONES.taskBoard);
        const goalRect = rect(ZONES.goal);
        const week = rect(ZONES.week);
        const drawer = rect(ZONES.treasureDrawer);
        const slots = ZONES.displaySlots.map(rect);
        const shelfRect = rect(ZONES.bookshelf);
        return (
          <>
            {/* Üst çubuk: logo + selamlama solda; yıldız ve Ebeveyn sağda */}
            <View style={{ position: "absolute", ...header }} className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <LogoMark width={40} height={40} />
                <Text className="font-display text-2xl text-ink">{t("child.hello", { name: childName })}</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <View className="min-h-12 flex-row items-center gap-1 rounded-full bg-star/20 px-4">
                  <Collectible slug="star-filled" size={26} />
                  <Text className="font-body-bold text-base text-ink">{t("room.starCount", { count: data.stars })}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={onParentExit}
                  className="min-h-12 flex-row items-center gap-1 rounded-full bg-teal-light px-4"
                >
                  <Text className="text-base">🔒</Text>
                  <Text className="text-base font-semibold text-teal-dark">{t("room.parentExit")}</Text>
                </Pressable>
              </View>
            </View>

            {/* Görev panosu */}
            <View style={{ position: "absolute", ...board }}>
              <Text className="font-display text-lg text-ink">{t("room.todayTasks")}</Text>
              <Text className="mb-1 text-sm text-gray-700">
                {t("room.completedOf", { done: data.todayDone, total: data.due.length })}
              </Text>
              <View className="mb-2 flex-row gap-1">
                {data.due.map((task) => (
                  <View
                    key={task.id}
                    className={`h-3 w-3 rounded-full ${task.status === "approved" || task.status === "done" ? "bg-teal" : "border border-gray-400 bg-white"}`}
                  />
                ))}
              </View>
              <ScrollView contentContainerStyle={{ gap: 6 }}>
                {data.due.length === 0 && !data.loading ? (
                  <Text className="text-sm text-gray-700">{t("child.allDone")}</Text>
                ) : null}
                {data.due.map((task) => {
                  const actionable = task.status === null || task.status === "returned";
                  return (
                    <Pressable
                      key={task.id}
                      accessibilityRole="button"
                      disabled={!actionable || data.completing}
                      onPress={() => data.complete(task.id)}
                      className={`min-h-12 flex-row items-center gap-2 rounded-parent px-2 py-1 ${
                        task.status === "approved" ? "bg-green-light" : task.status === "done" ? "bg-star/30" : task.status === "returned" ? "bg-coral-light" : "bg-white/95"
                      }`}
                    >
                      <TaskIcon slug={task.icon} size={28} />
                      <View className="flex-1">
                        <Text numberOfLines={1} className="font-body-bold text-sm text-ink">
                          {task.title}
                        </Text>
                        <Text className="text-xs text-gray-700">
                          {task.status === "approved"
                            ? t("child.approved")
                            : task.status === "done"
                              ? t("child.waitingApproval")
                              : task.status === "returned"
                                ? t("child.returnedTryAgain")
                                : t("room.plusStars", { count: task.stars })}
                        </Text>
                      </View>
                      {actionable ? (
                        <View className="rounded-button bg-teal px-3 py-1.5">
                          <Text className="text-xs font-bold text-white">{task.status === "returned" ? "🔁" : t("room.start")}</Text>
                        </View>
                      ) : (
                        <Text className="text-lg">{task.status === "approved" ? "✅" : "⏳"}</Text>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Hedef bileti */}
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/child/goal")}
              style={{ position: "absolute", ...goalRect }}
              className="justify-center rounded-parent p-2"
            >
              <Text className="font-display text-base text-ink">{t("room.myGoal")}</Text>
              {goal.data ? (
                <>
                  <Text className="font-body-bold text-sm text-ink">{goal.data.rewardTitle}</Text>
                  <View className="mt-1 h-2 overflow-hidden rounded-full bg-white/80">
                    <View
                      className="h-2 rounded-full bg-star"
                      style={{ width: `${Math.min(100, Math.round((data.stars / goal.data.cost) * 100))}%` }}
                    />
                  </View>
                  <Text className="mt-0.5 text-xs text-gray-700">
                    {data.stars >= goal.data.cost
                      ? t("goal.reached")
                      : t("room.starsLeft", { count: goal.data.cost - data.stars })}
                    {"  ·  "}⭐ {data.stars}/{goal.data.cost}
                  </Text>
                </>
              ) : (
                <Text className="text-sm text-teal-dark">{t("goal.pickCta")}</Text>
              )}
            </Pressable>

            {/* Haftam duvar takvimi */}
            <View style={{ position: "absolute", ...week }} className="justify-center">
              <Text className="font-display text-sm text-ink">{t("room.myWeek")}</Text>
              <View className="mt-1 flex-row justify-between">
                {data.weekSummary.map((day, i) => (
                  <View key={day.date} className="items-center" style={{ width: `${100 / 7}%` }}>
                    <Text className="text-[9px] text-gray-700">{DAY_LETTERS[i]}</Text>
                    <Text className="text-xs">
                      {day.due === 0 ? "·" : day.done >= day.due ? "✅" : day.done > 0 ? "◐" : "○"}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Sergi yuvaları: en yeni kazanılan üç rozet (resimli v3); boş yuva sade kalır */}
            {slots.map((slot, i) => {
              const badge = shelf[i];
              return (
                <Pressable
                  key={i}
                  accessibilityRole="button"
                  accessibilityLabel={badge ? badge.title : `${t("room.displaySlot")} ${i + 1}`}
                  onPress={() => router.push("/child/collection")}
                  style={{ position: "absolute", ...slot }}
                  className="items-center justify-end"
                >
                  {badge ? <Collectible slug={badge.icon} size={Math.min(slot.width, slot.height) * 0.95} /> : null}
                </Pressable>
              );
            })}

            {/* Kitaplık: Prova kapısı; atanmış deneme varsa işaret */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("prova.title")}
              onPress={() => router.push(actingAsParent ? "/parent/child-mode/prova" : "/child/prova")}
              style={{ position: "absolute", ...shelfRect }}
              className="items-center justify-start"
            >
              <View className="mt-1 flex-row items-center gap-1 rounded-full bg-white/90 px-3 py-1">
                <Text className="font-display text-sm text-ink">📚 {t("prova.title")}</Text>
                {(assignedExams.data ?? 0) > 0 ? (
                  <View className="h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1">
                    <Text className="text-xs font-bold text-white">{assignedExams.data}</Text>
                  </View>
                ) : null}
              </View>
            </Pressable>

            {/* Başardıklarım çekmecesi: bugünün gerçek özeti → Koleksiyonum */}
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/child/collection")}
              style={{ position: "absolute", ...drawer }}
              className="flex-row items-center justify-center gap-2"
            >
              <Collectible slug="star-filled" size={Math.min(28, drawer.height)} />
              <View>
                <Text className="font-display text-sm text-ink">{t("room.myWins")}</Text>
                <Text className="text-xs text-ink">
                  {t("room.todaySummary", { tasks: data.todayDone, stars: data.todayStarsEarned })}
                  {earnedCount > 0 ? ` · ${t("collection.badgeCount", { count: earnedCount })}` : ""}
                </Text>
              </View>
            </Pressable>
          </>
        );
      }}
    </RoomScene>
  );
}
