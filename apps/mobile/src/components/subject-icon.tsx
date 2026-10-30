import { View } from "react-native";

import { ILLUSTRATED_SUBJECTS, isIllustratedSubjectsSlug, type IllustratedSubjectsSlug } from "@/generated/illustrated/subjects";

import SvgGenericSubject from "../../../../packages/assets/icons/tasks/color/homework-general.svg";
import SvgCitizenship from "../../../../packages/assets/icons/subjects/color/citizenship.svg";
import SvgElective from "../../../../packages/assets/icons/subjects/color/elective.svg";
import SvgEnglish from "../../../../packages/assets/icons/subjects/color/english.svg";
import SvgFreeActivity from "../../../../packages/assets/icons/subjects/color/free-activity.svg";
import SvgGuidance from "../../../../packages/assets/icons/subjects/color/guidance.svg";
import SvgIct from "../../../../packages/assets/icons/subjects/color/ict.svg";
import SvgLifeScience from "../../../../packages/assets/icons/subjects/color/life-science.svg";
import SvgMath from "../../../../packages/assets/icons/subjects/color/math.svg";
import SvgMusic from "../../../../packages/assets/icons/subjects/color/music.svg";
import SvgPhysicalEducation from "../../../../packages/assets/icons/subjects/color/physical-education.svg";
import SvgPlayPhysical from "../../../../packages/assets/icons/subjects/color/play-physical.svg";
import SvgReligionEthics from "../../../../packages/assets/icons/subjects/color/religion-ethics.svg";
import SvgScience from "../../../../packages/assets/icons/subjects/color/science.svg";
import SvgSocialStudies from "../../../../packages/assets/icons/subjects/color/social-studies.svg";
import SvgStudyHall from "../../../../packages/assets/icons/subjects/color/study-hall.svg";
import SvgTechnologyDesign from "../../../../packages/assets/icons/subjects/color/technology-design.svg";
import SvgTrafficSafety from "../../../../packages/assets/icons/subjects/color/traffic-safety.svg";
import SvgTurkish from "../../../../packages/assets/icons/subjects/color/turkish.svg";
import SvgVisualArts from "../../../../packages/assets/icons/subjects/color/visual-arts.svg";

import { IllustratedImage, shouldUseIllustrated, type IconVariant } from "./illustrated-image";

const SUBJECT_SVGS: Record<IllustratedSubjectsSlug, typeof SvgGenericSubject> = {
  "citizenship": SvgCitizenship,
  "elective": SvgElective,
  "english": SvgEnglish,
  "free-activity": SvgFreeActivity,
  "guidance": SvgGuidance,
  "ict": SvgIct,
  "life-science": SvgLifeScience,
  "math": SvgMath,
  "music": SvgMusic,
  "physical-education": SvgPhysicalEducation,
  "play-physical": SvgPlayPhysical,
  "religion-ethics": SvgReligionEthics,
  "science": SvgScience,
  "social-studies": SvgSocialStudies,
  "study-hall": SvgStudyHall,
  "technology-design": SvgTechnologyDesign,
  "traffic-safety": SvgTrafficSafety,
  "turkish": SvgTurkish,
  "visual-arts": SvgVisualArts,
};

/** Arama için: küçük harf, Türkçe karakterler sadeleşir, noktalama boşluk olur. */
function normalize(text: string): string {
  return text
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Ders adı serbest metin (grades.subject, exam_blueprints.subject). Manifest label_tr + İngilizce/kısa yazımlar → manifest slug'ı.
// Uzun ifade önce denenir (ör. "sosyal bilgiler" "bilgi"den önce); yeni slug uydurulmaz.
const SUBJECT_ALIASES: [string, IllustratedSubjectsSlug][] = (
  [
    ["din kulturu ve ahlak bilgisi", "religion-ethics"],
    ["oyun ve fiziki etkinlikler", "play-physical"],
    ["bilisim teknolojileri", "ict"],
    ["teknoloji ve tasarim", "technology-design"],
    ["trafik guvenligi", "traffic-safety"],
    ["serbest etkinlik", "free-activity"],
    ["sosyal bilgiler", "social-studies"],
    ["social studies", "social-studies"],
    ["gorsel sanatlar", "visual-arts"],
    ["visual arts", "visual-arts"],
    ["beden egitimi", "physical-education"],
    ["physical education", "physical-education"],
    ["hayat bilgisi", "life-science"],
    ["life science", "life-science"],
    ["fen bilimleri", "science"],
    ["secmeli ders", "elective"],
    ["secmeli", "elective"],
    ["elective", "elective"],
    ["vatandaslik", "citizenship"],
    ["citizenship", "citizenship"],
    ["din kulturu", "religion-ethics"],
    ["religion", "religion-ethics"],
    ["ingilizce", "english"],
    ["english", "english"],
    ["matematik", "math"],
    ["mathematics", "math"],
    ["math", "math"],
    ["turkce", "turkish"],
    ["turkish", "turkish"],
    ["science", "science"],
    ["fen", "science"],
    ["sosyal", "social-studies"],
    ["muzik", "music"],
    ["music", "music"],
    ["resim", "visual-arts"],
    ["bilisim", "ict"],
    ["ict", "ict"],
    ["rehberlik", "guidance"],
    ["guidance", "guidance"],
    ["etut", "study-hall"],
    ["study hall", "study-hall"],
    ["beden", "physical-education"],
    ["trafik", "traffic-safety"],
  ] as [string, IllustratedSubjectsSlug][]
).map(([k, v]) => [normalize(k), v]);

/** Ders adı veya slug → manifest slug'ı; eşleşme yoksa null (genel simge gösterilir). */
export function resolveSubjectSlug(subject: string | null | undefined): IllustratedSubjectsSlug | null {
  if (!subject) return null;
  if (isIllustratedSubjectsSlug(subject)) return subject;
  const n = normalize(subject);
  if (!n) return null;
  for (const [alias, slug] of SUBJECT_ALIASES) {
    if (n === alias || n.startsWith(`${alias} `)) return slug;
  }
  return null;
}

export interface SubjectIconProps {
  /** Ders slug'ı ya da serbest ders adı ("Matematik", "Fen Bilimleri 4"). */
  subject: string | null | undefined;
  size?: number;
  /** auto: ≥64 dp resimli WebP; svg: native; illustrated: ≥48 dp resim (altında SVG). */
  variant?: IconVariant;
  accessibilityLabel?: string;
}

/** Ders ikonu: bilinmeyen ders genel ödev simgesine (native SVG) düşer. */
export function SubjectIcon({ subject, size = 40, variant = "auto", accessibilityLabel }: SubjectIconProps) {
  const slug = resolveSubjectSlug(subject);
  if (slug && shouldUseIllustrated(variant, size, true)) {
    return <IllustratedImage source={ILLUSTRATED_SUBJECTS[slug]} size={size} accessibilityLabel={accessibilityLabel} />;
  }
  const Svg = slug ? SUBJECT_SVGS[slug] : SvgGenericSubject;
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
