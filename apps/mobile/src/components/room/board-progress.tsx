import { View } from "react-native";

import { SkinIcon } from "@/components/room/nine-slice";

/**
 * Pano başlığındaki günlük ilerleme (dekoratif; sayı zaten «x / y tamamlandı» metninde).
 *
 * TODO(BRIEF 13 / C): referanstaki teal çubuk için Codex `progress-bar-teal-track` + `progress-bar-teal-fill`
 * kaplamalarını teslim edince skins.ts'e ekle ve aşağıdaki gövdeyi tek satırla değiştir:
 *   return <SkinProgress value={total > 0 ? done / total : 0} scale={s} track="progress-bar-teal-track" fill="progress-bar-teal-fill" />;
 * (SkinProgress'e track/fill parametresi eklemek yeterli; dış ölçü ve erişilebilirlik aynı kalır.)
 */
export function BoardProgress({
  total,
  s = 1,
  statuses,
}: {
  /** Çubuk varyantı için (done / total); noktalı hâlde statuses yeterli. */
  done: number;
  total: number;
  s?: number;
  statuses: readonly boolean[];
}) {
  if (total === 0) return null;
  return (
    <View
      className="flex-row flex-wrap"
      style={{ gap: 6 * s }}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {statuses.map((isDone, i) => (
        <SkinIcon key={i} skin={isDone ? "progress-dot-filled" : "progress-dot-empty"} size={16 * s} />
      ))}
    </View>
  );
}
