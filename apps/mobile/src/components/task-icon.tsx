import { View } from "react-native";

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

export type TaskIconSlug = keyof typeof TASK_ICONS;
export const TASK_ICON_SLUGS = Object.keys(TASK_ICONS) as TaskIconSlug[];

export interface TaskIconProps {
  slug: string | null | undefined;
  size?: number;
}

/** Görev ikonu (renkli set); bilinmeyen slug task-custom simgesine düşer. */
export function TaskIcon({ slug, size = 40 }: TaskIconProps) {
  const Svg = TASK_ICONS[(slug ?? "task-custom") as TaskIconSlug] ?? TASK_ICONS["task-custom"];
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} />
    </View>
  );
}
