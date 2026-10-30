import { View } from "react-native";

import { ILLUSTRATED_TASKS, isIllustratedTasksSlug, type IllustratedTasksSlug } from "@/generated/illustrated/tasks";

import { IllustratedImage, shouldUseIllustrated, type IconVariant } from "./illustrated-image";

import IconBedtime from "../../../../packages/assets/icons/tasks/color/bedtime.svg";
import IconBrushTeeth from "../../../../packages/assets/icons/tasks/color/brush-teeth.svg";
import IconClearTable from "../../../../packages/assets/icons/tasks/color/clear-table.svg";
import IconDrawing from "../../../../packages/assets/icons/tasks/color/drawing.svg";
import IconDrinkWater from "../../../../packages/assets/icons/tasks/color/drink-water.svg";
import IconEatBreakfast from "../../../../packages/assets/icons/tasks/color/eat-breakfast.svg";
import IconExercise from "../../../../packages/assets/icons/tasks/color/exercise.svg";
import IconFeedPet from "../../../../packages/assets/icons/tasks/color/feed-pet.svg";
import IconFillWaterBottle from "../../../../packages/assets/icons/tasks/color/fill-water-bottle.svg";
import IconGetDressed from "../../../../packages/assets/icons/tasks/color/get-dressed.svg";
import IconHomeworkEnglish from "../../../../packages/assets/icons/tasks/color/homework-english.svg";
import IconHomeworkGeneral from "../../../../packages/assets/icons/tasks/color/homework-general.svg";
import IconHomeworkMath from "../../../../packages/assets/icons/tasks/color/homework-math.svg";
import IconHomeworkScience from "../../../../packages/assets/icons/tasks/color/homework-science.svg";
import IconHomeworkTurkish from "../../../../packages/assets/icons/tasks/color/homework-turkish.svg";
import IconMakeBed from "../../../../packages/assets/icons/tasks/color/make-bed.svg";
import IconPackSchoolBag from "../../../../packages/assets/icons/tasks/color/pack-school-bag.svg";
import IconPajamas from "../../../../packages/assets/icons/tasks/color/pajamas.svg";
import IconPracticeInstrument from "../../../../packages/assets/icons/tasks/color/practice-instrument.svg";
import IconPutAwayTablet from "../../../../packages/assets/icons/tasks/color/put-away-tablet.svg";
import IconReadBook from "../../../../packages/assets/icons/tasks/color/read-book.svg";
import IconScreenTime from "../../../../packages/assets/icons/tasks/color/screen-time.svg";
import IconSetTable from "../../../../packages/assets/icons/tasks/color/set-table.svg";
import IconTakeOutTrash from "../../../../packages/assets/icons/tasks/color/take-out-trash.svg";
import IconTaskCustom from "../../../../packages/assets/icons/tasks/color/task-custom.svg";
import IconTidyRoom from "../../../../packages/assets/icons/tasks/color/tidy-room.svg";
import IconTidyToys from "../../../../packages/assets/icons/tasks/color/tidy-toys.svg";
import IconWashFace from "../../../../packages/assets/icons/tasks/color/wash-face.svg";
import IconWashHands from "../../../../packages/assets/icons/tasks/color/wash-hands.svg";
import IconWaterPlants from "../../../../packages/assets/icons/tasks/color/water-plants.svg";

const TASK_ICONS = {
  "bedtime": IconBedtime,
  "brush-teeth": IconBrushTeeth,
  "clear-table": IconClearTable,
  "drawing": IconDrawing,
  "drink-water": IconDrinkWater,
  "eat-breakfast": IconEatBreakfast,
  "exercise": IconExercise,
  "feed-pet": IconFeedPet,
  "fill-water-bottle": IconFillWaterBottle,
  "get-dressed": IconGetDressed,
  "homework-english": IconHomeworkEnglish,
  "homework-general": IconHomeworkGeneral,
  "homework-math": IconHomeworkMath,
  "homework-science": IconHomeworkScience,
  "homework-turkish": IconHomeworkTurkish,
  "make-bed": IconMakeBed,
  "pack-school-bag": IconPackSchoolBag,
  "pajamas": IconPajamas,
  "practice-instrument": IconPracticeInstrument,
  "put-away-tablet": IconPutAwayTablet,
  "read-book": IconReadBook,
  "screen-time": IconScreenTime,
  "set-table": IconSetTable,
  "take-out-trash": IconTakeOutTrash,
  "task-custom": IconTaskCustom,
  "tidy-room": IconTidyRoom,
  "tidy-toys": IconTidyToys,
  "wash-face": IconWashFace,
  "wash-hands": IconWashHands,
  "water-plants": IconWaterPlants,
} as const;

type SvgTaskSlug = keyof typeof TASK_ICONS;

// Yalnız resimli kaynağı olan yeni slug'lar küçük boyutta en yakın eski SVG'ye düşer (slug değişmez, yalnız görünüm).
const SVG_FALLBACK: Partial<Record<IllustratedTasksSlug, SvgTaskSlug>> = {
  "homework-life-science": "homework-general",
  "homework-social": "homework-general",
  "study": "homework-general",
  "practice-test": "homework-general",
  "vocabulary": "homework-english",
  "write-journal": "homework-general",
  "read-aloud": "read-book",
  "bedtime-story": "read-book",
  "comb-hair": "wash-face",
  "take-shower": "wash-face",
  "unload-dishwasher": "clear-table",
  "carry-groceries": "set-table",
  "tidy-desk": "tidy-room",
  "sweep-floor": "tidy-room",
  "laundry-basket": "tidy-room",
  "charge-tablet": "put-away-tablet",
  "football-practice": "exercise",
  "swimming": "exercise",
  "cycling": "exercise",
  "play-outside": "exercise",
  "dance": "exercise",
  "crafts": "drawing",
  "walk-dog": "feed-pet",
  "feed-fish": "feed-pet",
  "pack-lunchbox": "pack-school-bag",
  "eat-fruit": "eat-breakfast",
  "finish-meal": "eat-breakfast",
};

/** Görev ikonu slug'ı: resimli v3 manifestindeki 66 slug (DB task_templates.icon değerleri). */
export type TaskIconSlug = IllustratedTasksSlug;
/** Seçicide gösterilecek slug'lar: manifest sırası. */
export { ILLUSTRATED_TASKS_SLUGS as TASK_ICON_SLUGS } from "@/generated/illustrated/tasks";

export interface TaskIconProps {
  slug: string | null | undefined;
  /** dp; varsayılan 40 (native SVG). */
  size?: number;
  /**
   * auto (varsayılan): ≥64 dp resimli WebP, altında native SVG; yalnız resimli kaynağı olan slug 48 dp'den itibaren resim.
   * svg: her zaman native SVG (gezinme/aksiyon). illustrated: büyük kart/raf; 48 dp altında yine SVG'ye düşer.
   */
  variant?: IconVariant;
  accessibilityLabel?: string;
}

/** Görev ikonu; bilinmeyen slug task-custom simgesine düşer. */
export function TaskIcon({ slug, size = 40, variant = "auto", accessibilityLabel }: TaskIconProps) {
  const key = slug ?? "task-custom";
  const hasSvg = Object.prototype.hasOwnProperty.call(TASK_ICONS, key);
  const svgKey: SvgTaskSlug | undefined =
    hasSvg ? (key as SvgTaskSlug) : isIllustratedTasksSlug(key) ? SVG_FALLBACK[key] : undefined;
  const illustrated = isIllustratedTasksSlug(key) && shouldUseIllustrated(variant, size, true, hasSvg);
  if (illustrated) {
    return <IllustratedImage source={ILLUSTRATED_TASKS[key as IllustratedTasksSlug]} size={size} accessibilityLabel={accessibilityLabel} />;
  }
  const Svg = TASK_ICONS[svgKey ?? "task-custom"];
  return (
    <View
      style={{ width: size, height: size }}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? "auto" : "no-hide-descendants"}
    >
      <Svg width={size} height={size} />
    </View>
  );
}
