import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";

import { TaskIcon } from "@/components/task-icon";
import { WIDE_LAYOUT_MIN_DP, ZONES } from "@/components/room/layout";
import { RoomScene, type CharacterKey } from "@/components/room/scene";
import { Screen } from "@/components/ui/screen";

// Sahte veri: prototip yalnız düzeni gösterir (docs/design/room-v2, Sıra 1); DB'ye bağlanmaz.
const MOCK_TASKS = [
  { id: "1", icon: "make-bed", title: "Yatağını topla", status: "todo" as const },
  { id: "2", icon: "brush-teeth", title: "Dişlerini fırçala", status: "done" as const },
  { id: "3", icon: "read-book", title: "Kitap oku", status: "approved" as const },
  { id: "4", icon: "pack-school-bag", title: "Okul çantanı hazırla", status: "todo" as const },
];
const MOCK = { name: "Deniz", stars: 14, goalTitle: "Sinema bileti", goalRemaining: 6, weekDone: 9, weekTotal: 16 };

const STATUS_EMOJI = { todo: "⬜️", done: "⏳", approved: "✅" } as const;

function TaskRows({ compact }: { compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <>
      {MOCK_TASKS.map((task) => (
        <Pressable
          key={task.id}
          accessibilityRole="button"
          accessibilityLabel={`${task.title}: ${task.status === "todo" ? t("room.tapWhenDone") : task.status === "done" ? t("child.waitingApproval") : t("child.approved")}`}
          className="min-h-12 flex-row items-center gap-2 rounded-parent bg-white/90 px-2 py-1"
          style={{ minHeight: 48 }}
        >
          <TaskIcon slug={task.icon} size={compact ? 24 : 30} />
          <Text numberOfLines={2} className={`flex-1 font-semibold text-ink ${compact ? "text-xs" : "text-sm"}`}>
            {task.title}
          </Text>
          <Text className="text-base">{STATUS_EMOJI[task.status]}</Text>
        </Pressable>
      ))}
    </>
  );
}

/** Oyun odası ana ekran prototipi (geniş düzen: tam oda; dar düzen: aynı mobilya dili dikey akışta). */
export default function RoomPreviewScreen() {
  const { t } = useTranslation();
  const { width, fontScale } = useWindowDimensions();
  const [character, setCharacter] = useState<CharacterKey>("unspecified");
  const wide = width >= WIDE_LAYOUT_MIN_DP && fontScale <= 1.2;

  const characterPicker = (
    <View className="flex-row gap-2">
      {(["unspecified", "girl", "boy"] as CharacterKey[]).map((key) => (
        <Pressable
          key={key}
          accessibilityRole="button"
          onPress={() => setCharacter(key)}
          className={`rounded-full px-3 py-2 ${character === key ? "bg-teal" : "bg-white/80"}`}
        >
          <Text className={character === key ? "text-xs font-semibold text-white" : "text-xs text-ink"}>{t(`room.character.${key}`)}</Text>
        </Pressable>
      ))}
    </View>
  );

  if (!wide) {
    // Dar/dikey ya da büyük yazı: oda görseli dekoratif başlık, paneller dikey akışta (crop yok).
    return (
      <Screen tone="child" title={t("child.hello", { name: MOCK.name })}>
        <View className="gap-3 rounded-child bg-blue-light p-4">
          <Text className="text-lg font-bold text-ink">{t("room.todayTasks")}</Text>
          <TaskRows />
        </View>
        <View className="gap-1 rounded-child bg-orange-light p-4">
          <Text className="text-lg font-bold text-ink">{t("room.myGoal")}</Text>
          <Text className="text-base text-ink">{MOCK.goalTitle}</Text>
          <Text className="text-sm text-gray-700">{t("room.starsLeft", { count: MOCK.goalRemaining })}</Text>
        </View>
        <View className="flex-row gap-3">
          <View className="flex-1 rounded-child bg-green-light p-4">
            <Text className="font-bold text-ink">{t("room.myWeek")}</Text>
            <Text className="text-sm text-ink">{t("room.weekProgress", { done: MOCK.weekDone, total: MOCK.weekTotal })}</Text>
          </View>
          <View className="flex-1 rounded-child bg-purple-light p-4">
            <Text className="font-bold text-ink">⭐ {MOCK.stars}</Text>
            <Text className="text-sm text-ink">{t("room.myTreasure")} · {t("room.myCollection")}</Text>
          </View>
        </View>
        {characterPicker}
        <Text className="text-xs text-gray-500">{t("room.previewNote")}</Text>
      </Screen>
    );
  }

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
            <View style={{ position: "absolute", ...header }} className="flex-row items-center justify-between">
              <Text className="text-xl font-bold text-ink">{t("child.hello", { name: MOCK.name })}</Text>
              <View className="flex-row items-center gap-3">
                {characterPicker}
                <Pressable accessibilityRole="button" className="min-h-12 justify-center rounded-button bg-white/90 px-4">
                  <Text className="font-semibold text-teal-dark">{t("room.parentExit")}</Text>
                </Pressable>
              </View>
            </View>

            <View style={{ position: "absolute", ...board }} accessibilityLabel={t("room.todayTasks")}>
              <Text className="mb-1 text-base font-bold text-ink">{t("room.todayTasks")}</Text>
              <ScrollView contentContainerStyle={{ gap: 6 }}>
                <TaskRows compact />
              </ScrollView>
            </View>

            <Pressable accessibilityRole="button" style={{ position: "absolute", ...goal }} className="justify-center rounded-parent p-2">
              <Text className="text-sm font-bold text-ink">{t("room.myGoal")}: {MOCK.goalTitle}</Text>
              <Text className="text-xs text-ink">{t("room.starsLeft", { count: MOCK.goalRemaining })}</Text>
              <Text className="text-xs text-gray-700">⭐ {MOCK.stars}</Text>
            </Pressable>

            <Pressable accessibilityRole="button" style={{ position: "absolute", ...week }} className="justify-center rounded-parent p-1">
              <Text className="text-xs font-bold text-ink">{t("room.myWeek")}</Text>
              <Text className="text-xs text-ink">{t("room.weekProgress", { done: MOCK.weekDone, total: MOCK.weekTotal })}</Text>
            </Pressable>

            {slots.map((slot, i) => (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={`${t("room.displaySlot")} ${i + 1}`}
                style={{ position: "absolute", ...slot }}
                className="items-center justify-center"
              >
                <Text className="text-lg">{["🎬", "🚲", "🎮"][i]}</Text>
              </Pressable>
            ))}

            <Pressable accessibilityRole="button" style={{ position: "absolute", ...drawer }} className="flex-row items-center justify-center gap-2">
              <Text className="text-sm font-bold text-ink">{t("room.myTreasure")}</Text>
              <Text className="text-sm text-ink">·</Text>
              <Text className="text-sm font-bold text-ink">{t("room.myCollection")}</Text>
            </Pressable>
          </>
        );
      }}
    </RoomScene>
  );
}
