import { useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  HeartHandshake,
  RotateCcw,
} from "lucide-react-native";
import { Pressable } from "@/components/ui/pressable";
import { IconButton, SatinButton } from "@/components/planner/ui";
import { colors as c, styles as s } from "./theme";

type Props = {
  from: string;
  to: string;
  childName?: string;
  counts: { approved: number; pending: number; returned: number };
};
/** A shared conversation, not an assessment, ranking or AI inference. No conversation is recorded. */
export function FamilyWeekReview({ from, to, childName, counts }: Props) {
  const { t, i18n } = useTranslation();
  const { width, fontScale } = useWindowDimensions();
  const wide = width >= 900 && fontScale < 1.4;
  const statusIcons = { approved: Check, pending: Clock3, returned: RotateCcw };
  const [open, setOpen] = useState(false), [step, setStep] = useState(0);
  const total = counts.approved + counts.pending + counts.returned;
  const format = (day: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(new Date(day + "T12:00:00Z"));
  return (
    <View testID="family-week-review" style={s.summary}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("familyWeek.title")}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={[s.row, { minHeight: 56, gap: 14 }]}
      >
        <HeartHandshake size={28} color={c.green} />
        <View style={s.fill}>
          <Text style={s.sectionTitle}>{t("familyWeek.title")}</Text>
          <Text style={s.small}>
            {t(childName ? "familyWeek.child" : "familyWeek.family", {
              name: childName,
            })}
          </Text>
        </View>
        {open
          ? <ChevronUp size={23} color={c.purple} />
          : <ChevronDown size={23} color={c.purple} />}
      </Pressable>
      {open
        ? (
          <View style={{ gap: 18 }}>
            <Text style={s.small}>{format(from)} – {format(to)}</Text>
            {total
              ? (
                <>
                  <View
                    style={{
                      flexDirection: wide ? "row" : "column",
                      flexWrap: "wrap",
                      gap: wide ? 24 : 6,
                    }}
                  >
                    {(["approved", "pending", "returned"] as const).filter(
                      (status) => counts[status] > 0,
                    ).map((status) => {
                      const Icon = statusIcons[status];
                      return (
                        <View
                          key={status}
                          style={[s.row, { minHeight: 32, flexShrink: 1 }]}
                        >
                          <Icon
                            size={20}
                            color={status === "approved" ? c.green : c.purple}
                          />
                          <Text style={[s.text, s.bold]}>
                            {t("familyWeek." + status, {
                              count: counts[status],
                            })}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                  <Text style={s.small}>{t("familyWeek.recordedOnly")}</Text>
                </>
              )
              : <Text style={s.text}>{t("familyWeek.empty")}</Text>}
            <View style={[s.card, { gap: 16 }]}>
              <Text style={s.small}>
                {t("familyWeek.step", { current: step + 1, total: 3 })}
              </Text>
              <Text
                accessibilityRole="header"
                accessibilityLiveRegion="polite"
                style={s.sectionTitle}
              >
                {t("familyWeek.question" + step)}
              </Text>
              <Text style={s.text}>{t("familyWeek.hint" + step)}</Text>
              <View
                style={[s.row, { justifyContent: "space-between", gap: 12 }]}
              >
                <IconButton
                  label={t("familyWeek.previous")}
                  disabled={step === 0}
                  onPress={() => setStep(step - 1)}
                >
                  <ArrowLeft size={22} color={c.purple} />
                </IconButton>
                {step < 2
                  ? (
                    <SatinButton
                      title={t("familyWeek.next")}
                      onPress={() => setStep(step + 1)}
                      icon={<ArrowRight color={c.white} size={20} />}
                      style={{ flex: 1, maxWidth: 360 }}
                    />
                  )
                  : (
                    <SatinButton
                      title={t("familyWeek.plan")}
                      onPress={() => router.push("/parent/calendar")}
                      style={{ flex: 1, maxWidth: 360 }}
                    />
                  )}
              </View>
            </View>
            <Text style={s.small}>{t("familyWeek.privacy")}</Text>
          </View>
        )
        : null}
    </View>
  );
}
