import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { TaskIcon } from "@/components/task-icon";
import { NineSlice, SkinIcon, SkinPressable } from "@/components/room/nine-slice";
import type { ChildTodayData } from "@/lib/use-child-today";

type Task = Pick<ChildTodayData["due"][number], "id" | "title" | "icon" | "stars" | "status">;

const STATUS_ORDER = { returned: 0, todo: 1, done: 2, approved: 3 } as const;

/** Panoda sıradaki iş ilk bakışta görünsün: iade/yapılacak → onay bekleyen → onaylanan (kendi içinde sıra korunur). */
export function sortForBoard<T extends { status: Task["status"] }>(tasks: readonly T[]): T[] {
  return tasks
    .map((task, index) => ({ task, index }))
    .sort((a, b) => STATUS_ORDER[a.task.status ?? "todo"] - STATUS_ORDER[b.task.status ?? "todo"] || a.index - b.index)
    .map(({ task }) => task);
}

/** Kart sağındaki durum kaplaması; kaplamadaki tik/kum saati/ok üstüne ikinci ikon çizilmez. */
export function statusSkin(status: Task["status"]) {
  return status === "approved" ? "status-done" : status === "done" ? "status-waiting" : status === "returned" ? "status-returned" : null;
}

/** Panodaki tek görev kâğıdı: task-card (+pressed), sağda Başla çipi ya da durum kaplaması. */
export function SkinTaskCard({
  task,
  s,
  isNext,
  completing,
  onComplete,
  stacked = false,
  large = false,
  height,
}: {
  task: Task;
  s: number;
  isNext: boolean;
  completing: boolean;
  onComplete: () => void;
  /** Dar ekran/büyük yazı: çip ve durum metnin altına iner, başlık tam genişlikte sarar. */
  stacked?: boolean;
  /** Geniş oda panosu (onaylı referans): iki büyük kâğıt; ~68 dp resimli ikon, büyük başlık. */
  large?: boolean;
  /** Panoda kâğıt yüksekliği (görünür alana tam iki kart sığsın diye); verilmezse içerik kadar. */
  height?: number;
}) {
  const { t } = useTranslation();
  const fs = (n: number) => Math.round(n * s);
  const actionable = task.status === null || task.status === "returned";
  const status = statusSkin(task.status);
  const subtitle =
    task.status === "approved"
      ? t("child.approved")
      : task.status === "done"
        ? t("child.waitingApproval")
        : task.status === "returned"
          ? t("child.returnedTryAgain")
          : t("room.plusStars", { count: task.stars });
  return (
    <SkinPressable
      skin="task-card"
      pressedSkin="task-card-pressed"
      scale={s}
      disabled={!actionable || completing}
      onPress={onComplete}
      accessibilityLabel={`${task.title}, ${subtitle}`}
      accessibilityHint={actionable ? t("room.tapWhenDone") : undefined}
      accessibilityState={{ disabled: !actionable || completing }}
      style={height ? { height } : undefined}
      contentClassName="flex-row items-center"
      contentStyle={{ gap: (large ? 16 : 12) * s }}
    >
      {({ pressed }) => {
        const trailing = (
          <>
            {status ? <SkinIcon skin={status} size={Math.round(40 * s)} /> : null}
            {actionable ? (
              <NineSlice
                skin={completing ? "chip-start-disabled" : pressed ? "chip-start-pressed" : "chip-start"}
                scale={s}
                contentClassName="items-center justify-center"
              >
                <Text className="font-display text-white" style={{ fontSize: fs(large ? 22 : isNext ? 20 : 18), lineHeight: fs(large ? 28 : 24) }}>
                  {t("child.markDone")}
                </Text>
              </NineSlice>
            ) : null}
          </>
        );
        return (
          <>
            <TaskIcon slug={task.icon} size={Math.max(48, Math.round((large ? 72 : 60) * s))} variant="illustrated" />
            <View className="flex-1">
              <Text numberOfLines={stacked ? undefined : 2} className="font-display-semi text-ink" style={{ fontSize: fs(large ? 26 : 24), lineHeight: fs(large ? 32 : 30) }}>
                {task.title}
              </Text>
              <Text
                numberOfLines={stacked ? undefined : 2}
                className={`font-body-bold ${task.status === "returned" ? "text-danger" : task.status === "approved" ? "text-teal-dark" : "text-ink/80"}`}
                style={{ fontSize: fs(large ? 20 : 18) }}
              >
                {subtitle}
              </Text>
              {stacked && (status || actionable) ? (
                <View className="flex-row items-center justify-end" style={{ gap: 8 * s, marginTop: 6 * s }}>
                  {trailing}
                </View>
              ) : null}
            </View>
            {stacked ? null : trailing}
          </>
        );
      }}
    </SkinPressable>
  );
}
