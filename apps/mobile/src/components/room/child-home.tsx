import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";

import LogoMark from "../../../../../packages/assets/brand/yan-yana/logo-mark.svg";

import { TaskIcon } from "@/components/task-icon";
import { ZONES } from "@/components/room/layout";
import { RoomScene, type CharacterKey } from "@/components/room/scene";
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
  const { t } = useTranslation();
  const data = useChildToday(childId, actingAsParent);

  return (
    <RoomScene character={character}>
      {({ rect }) => {
        const header = rect(ZONES.header);
        const board = rect(ZONES.taskBoard);
        const goal = rect(ZONES.goal);
        const week = rect(ZONES.week);
        const drawer = rect(ZONES.treasureDrawer);
        const slots = ZONES.displaySlots.map(rect);
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
                  <Text className="text-base">⭐</Text>
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

            {/* Hedef bileti: hedef modeli henüz yok — yapı duruyor, 'yakında' etiketi */}
            <View style={{ position: "absolute", ...goal }} className="justify-center rounded-parent p-2">
              <Text className="font-display text-base text-ink">{t("room.myGoal")}</Text>
              <Text className="text-sm text-ink">{t("room.goalComingSoon")}</Text>
              <Text className="mt-1 text-xs text-gray-700">⭐ {t("room.starCount", { count: data.stars })}</Text>
            </View>

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

            {/* Sergi yuvaları: rozet modeli yakında */}
            {slots.map((slot, i) => (
              <View key={i} style={{ position: "absolute", ...slot }} className="items-center justify-center opacity-60">
                <Text className="text-xs text-gray-700">{t("room.soon")}</Text>
              </View>
            ))}

            {/* Başardıklarım çekmecesi: bugünün gerçek özeti */}
            <Pressable accessibilityRole="button" style={{ position: "absolute", ...drawer }} className="flex-row items-center justify-center gap-2">
              <Text className="font-display text-sm text-ink">⭐ {t("room.myWins")}</Text>
              <Text className="text-xs text-ink">
                {t("room.todaySummary", { tasks: data.todayDone, stars: data.todayStarsEarned })}
              </Text>
            </Pressable>
          </>
        );
      }}
    </RoomScene>
  );
}
