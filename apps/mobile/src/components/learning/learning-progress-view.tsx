import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ChevronUp,
} from "lucide-react-native";
import {
  type LearningProgress,
  progressNextStep,
  type ProgressTopic,
  progressTopicKey,
} from "@gina/core";
import { p, SatinButton } from "@/components/planner/ui";
import { b } from "./prova-builder-ui";
import { Pressable } from "@/components/ui/pressable";

type Evidence = ProgressTopic["evidence"][number];
export const progressColors = {
  correct: "#90DDB4",
  partial: "#FFDF8E",
  wrong: "#EBA4B7",
  blank: "#D8CCEC",
};
const states = ["correct", "partial", "wrong", "blank"] as const;
function dateLabel(day: string, language: string) {
  return new Date(day + "T12:00:00Z").toLocaleDateString(language, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
function weekBounds(week: string, report: LearningProgress) {
  const end = new Date(week + "T12:00:00Z");
  end.setUTCDate(end.getUTCDate() + 6);
  return [
    week < report.from ? report.from : week,
    end.toISOString().slice(0, 10) > report.through
      ? report.through
      : end.toISOString().slice(0, 10),
  ];
}
function weekRange(week: string, report: LearningProgress, language: string) {
  const [first, last] = weekBounds(week, report);
  return `${dateLabel(first, language)} – ${dateLabel(last, language)}`;
}
function compactWeek(week: string, report: LearningProgress, language: string) {
  const [first, last] = weekBounds(week, report);
  if (first.slice(0, 7) !== last.slice(0, 7)) {
    return `${dateLabel(first, language)}\n${dateLabel(last, language)}`;
  }
  const month = new Date(first + "T12:00:00Z").toLocaleDateString(language, {
    month: "short",
    timeZone: "UTC",
  });
  return `${Number(first.slice(8))}–${Number(last.slice(8))}\n${month}`;
}
export function ReportPicker<T extends string | number>(
  { label, value, options, onChange }: {
    label: string;
    value: T;
    options: { value: T; label: string }[];
    onChange: (value: T) => void;
  },
) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 8, minWidth: 0 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${
          options.find((o) => o.value === value)?.label ?? value
        }`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={s.picker}
      >
        <Text style={[b.bold, { flex: 1 }]}>
          {options.find((o) => o.value === value)?.label ?? value}
        </Text>
        {open
          ? <ChevronUp size={20} color={p.ink} />
          : <ChevronDown size={20} color={p.ink} />}
      </Pressable>
      {open
        ? (
          <View style={s.options}>
            <ScrollView style={{ maxHeight: 270 }} nestedScrollEnabled>
              {options.map((option) => (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: value === option.value }}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  style={[
                    s.option,
                    value === option.value && { backgroundColor: p.lilac },
                  ]}
                >
                  <Text style={b.copy}>{option.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )
        : null}
    </View>
  );
}
export function ProgressSummary({ report }: { report: LearningProgress }) {
  const { t } = useTranslation(), { fontScale } = useWindowDimensions();
  return (
    <View
      style={{ flexDirection: fontScale >= 1.4 ? "column" : "row", gap: 12 }}
    >
      {([
        ["unique", report.summary.unique_questions],
        ["repeat", report.summary.repeats],
        ["pending", report.summary.pending],
      ] as const).map(([key, value]) => (
        <View key={key} style={s.stat}>
          <Text style={s.number}>{value}</Text>
          <Text style={s.statLabel}>{t(`learningProgress.${key}`)}</Text>
        </View>
      ))}
    </View>
  );
}
function Counts(
  { value }: {
    value:
      | LearningProgress["summary"]
      | LearningProgress["weeks"][number]
      | ProgressTopic;
  },
) {
  const { t } = useTranslation();
  return (
    <View style={s.legend}>
      {states.map((key) => (
        <View key={key} style={s.legendItem}>
          <View style={[s.dot, { backgroundColor: progressColors[key] }]} />
          <Text style={s.small}>
            {t(`learningProgress.${key}`)} {value[key]}
          </Text>
        </View>
      ))}
    </View>
  );
}
export function ProgressChart({ report }: { report: LearningProgress }) {
  const { t, i18n } = useTranslation(), { fontScale } = useWindowDimensions();
  const [selected, setSelected] = useState<string | null>(null),
    [width, setWidth] = useState(300);
  const max = Math.max(4, ...report.weeks.map((w) => w.total - w.pending));
  const tick = Math.ceil(max / 4), ceiling = tick * 4, plot = 168;
  const chartWidth = Math.max(width - 34, report.weeks.length * 52);
  const chosen = report.weeks.find((w) => w.week_start === selected);
  const language = i18n.resolvedLanguage ?? "tr";
  return (
    <View
      style={s.card}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width - 36)}
    >
      <Text accessibilityRole="header" style={b.h2}>
        {t("learningProgress.chartTitle")}
      </Text>
      <View style={{ flexDirection: "row", paddingTop: 6 }}>
        <View accessible={false} style={{ width: 34, height: plot }}>
          {[4, 3, 2, 1, 0].map((n) => (
            <Text
              key={n}
              style={[s.small, {
                position: "absolute",
                top: plot * (1 - n / 4) - 8,
                lineHeight: 16,
                fontSize: 12,
              }]}
            >
              {tick * n}
            </Text>
          ))}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={report.weeks.length * 52 > width - 34}
          style={{ flex: 1 }}
        >
          <View style={{ width: chartWidth }}>
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 0,
                height: plot,
                width: "100%",
                justifyContent: "space-between",
              }}
            >
              {[0, 1, 2, 3, 4].map((n) => (
                <View
                  key={n}
                  style={{ height: 1, backgroundColor: "#E5DCF0" }}
                />
              ))}
            </View>
            <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
              {report.weeks.map((w) => {
                const range = weekRange(w.week_start, report, language);
                const a11y = `${range}. ${
                  states.map((key) =>
                    `${t(`learningProgress.${key}`)}: ${w[key]}`
                  ).join(", ")
                }. ${t("learningProgress.pending")}: ${w.pending}`;
                return (
                  <Pressable
                    key={w.week_start}
                    accessibilityRole="button"
                    accessibilityLabel={a11y}
                    accessibilityState={{ selected: selected === w.week_start }}
                    onPress={() =>
                      setSelected(
                        selected === w.week_start ? null : w.week_start,
                      )}
                    style={{
                      width: chartWidth / report.weeks.length,
                      minWidth: 48,
                      paddingHorizontal: 8,
                    }}
                  >
                    <View
                      style={{
                        height: plot,
                        justifyContent: "flex-end",
                        alignItems: "center",
                      }}
                    >
                      <View
                        style={{
                          width: "100%",
                          maxWidth: 66,
                          flexDirection: "column-reverse",
                          borderTopLeftRadius: 6,
                          borderTopRightRadius: 6,
                          overflow: "hidden",
                          outlineWidth: selected === w.week_start ? 2 : 0,
                          outlineColor: p.purple,
                          outlineOffset: 3,
                        }}
                      >
                        {states.map((key) => (
                          <View
                            key={key}
                            style={{
                              height: plot * w[key] / ceiling,
                              backgroundColor: progressColors[key],
                            }}
                          />
                        ))}
                      </View>
                    </View>
                    <Text
                      style={[s.small, {
                        textAlign: "center",
                        fontSize: 12,
                        lineHeight: 17,
                        marginTop: 9,
                        minHeight: 36 * fontScale,
                      }]}
                    >
                      {compactWeek(w.week_start, report, language)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </View>
      <Counts value={report.summary} />
      {chosen
        ? (
          <View accessibilityLiveRegion="polite" style={s.chartDetail}>
            <Text style={b.bold}>
              {weekRange(chosen.week_start, report, language)}
            </Text>
            <Counts value={chosen} />
            <Text style={s.small}>
              {t("learningProgress.pendingCount", { count: chosen.pending })}
            </Text>
          </View>
        )
        : null}
      {report.weeks.length * 52 > width - 34
        ? <Text style={s.small}>{t("learningProgress.chartScroll")}</Text>
        : null}
      <Text style={s.note}>{t("learningProgress.chartNote")}</Text>
    </View>
  );
}
export function ProgressNextStep(
  { report, openEvidence, openProvas }: {
    report: LearningProgress;
    openEvidence: (e: Evidence) => void;
    openProvas: () => void;
  },
) {
  const { t } = useTranslation(), next = progressNextStep(report);
  const available = next.kind !== "observe" ? next.evidence : [];
  return (
    <View style={[s.card, { flex: 1 }]}>
      <Text accessibilityRole="header" style={b.h2}>
        {t("learningProgress.nextTitle")}
      </Text>
      <Text style={b.copy}>
        {next.kind === "review"
          ? t("learningProgress.reviewNext", { count: next.count })
          : next.kind === "practice"
          ? t("learningProgress.practiceNext", {
            topic: next.topic.topic,
            count: next.evidence.length,
          })
          : t("learningProgress.observeNext")}
      </Text>
      <View style={{ flex: 1, minHeight: 4 }} />
      <SatinButton
        title={t(
          available.length
            ? "learningProgress.reviewAction"
            : "learningProgress.provasAction",
        )}
        onPress={() => available[0] ? openEvidence(available[0]) : openProvas()}
      />
    </View>
  );
}
export function ProgressTopics(
  { report, openEvidence }: {
    report: LearningProgress;
    openEvidence: (e: Evidence) => void;
  },
) {
  const { t, i18n } = useTranslation(),
    [expanded, setExpanded] = useState<string | null>(null);
  return (
    <View
      style={{
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: p.line,
        paddingTop: 18,
      }}
    >
      <Text accessibilityRole="header" style={b.h2}>
        {t("learningProgress.topicsTitle")}
      </Text>
      <View style={[s.card, { gap: 0, paddingVertical: 0 }]}>
        {report.topics.map((topic, index) => {
          const key = progressTopicKey(topic), open = expanded === key;
          return (
            <View
              key={key}
              style={index > 0
                ? { borderTopWidth: 1, borderTopColor: p.line }
                : undefined}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("learningProgress.inspectTopic", {
                  topic: topic.topic,
                })}
                accessibilityState={{ expanded: open }}
                onPress={() => setExpanded(open ? null : key)}
                style={s.topicRow}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={s.topicTitle}>{topic.topic}</Text>
                  <Text style={s.small}>
                    {topic.subject} ·{" "}
                    {t("learningProgress.grade", { count: topic.grade })}
                  </Text>
                  {report.topics.filter((other) =>
                      other.grade === topic.grade &&
                      other.subject === topic.subject &&
                      other.topic === topic.topic
                    ).length > 1
                    ? (
                      <Text style={s.note}>
                        {topic.curriculum
                          ? t("learningProgress.program", {
                            name: topic.curriculum,
                          })
                          : t("learningProgress.programUnknown")}
                      </Text>
                    )
                    : null}
                  <Text style={s.small}>
                    {t("learningProgress.observations", { count: topic.total })}
                    {topic.pending > 0
                      ? ` · ${
                        t("learningProgress.pendingCount", {
                          count: topic.pending,
                        })
                      }`
                      : topic.limited_observation
                      ? ` · ${t("learningProgress.limited")}`
                      : ""}
                  </Text>
                </View>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 2 }}
                >
                  <Text style={s.link}>{t("learningProgress.inspect")}</Text>
                  {open
                    ? <ChevronUp size={19} color={p.purple} />
                    : <ChevronRight size={19} color={p.purple} />}
                </View>
              </Pressable>
              {open
                ? (
                  <View style={s.topicDetails}>
                    <Text style={s.note}>
                      {topic.curriculum
                        ? t("learningProgress.program", {
                          name: topic.curriculum,
                        })
                        : t("learningProgress.programUnknown")}
                    </Text>
                    <Counts value={topic} />
                    <Text style={s.small}>
                      {t("learningProgress.uniqueCount", {
                        count: topic.unique_questions,
                      })}
                      {topic.limited_observation
                        ? ` · ${t("learningProgress.limitedExplanation")}`
                        : ""}
                    </Text>
                    <Text style={b.bold}>
                      {t("learningProgress.evidenceTitle")}
                    </Text>
                    {topic.evidence.map((e, i) => (
                      <Pressable
                        key={`${e.attempt_id}:${e.question_id}`}
                        accessibilityRole="button"
                        accessibilityLabel={t("learningProgress.openEvidence", {
                          number: i + 1,
                          state: t(`learningProgress.${e.state}`),
                        })}
                        onPress={() => openEvidence(e)}
                        style={s.evidence}
                      >
                        <View style={{ flex: 1, gap: 4 }}>
                          <Text style={b.bold}>
                            {t(`learningProgress.${e.state}`)}
                          </Text>
                          <Text style={s.small}>
                            {new Date(e.finished_at).toLocaleDateString(
                              i18n.resolvedLanguage ?? "tr",
                              {
                                day: "numeric",
                                month: "short",
                                timeZone: report.timezone,
                              },
                            )}
                          </Text>
                        </View>
                        <ArrowRight size={22} color={p.purple} />
                      </Pressable>
                    ))}
                    <Text style={s.note}>
                      {t("learningProgress.evidenceNote")}
                    </Text>
                  </View>
                )
                : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    borderRadius: 23,
    backgroundColor: "#FFFEFB",
    borderWidth: 1,
    borderColor: "#E3D8EF",
    padding: 18,
    gap: 16,
  },
  stat: {
    flex: 1,
    minWidth: 0,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E7DCF7",
    backgroundColor: "#F6F0FC",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    gap: 0,
  },
  number: {
    fontFamily: "Baloo2_700Bold",
    fontSize: 34,
    lineHeight: 42,
    color: p.ink,
  },
  statLabel: {
    fontFamily: "Nunito_700Bold",
    fontSize: 15,
    lineHeight: 21,
    color: p.ink,
    textAlign: "center",
  },
  picker: {
    minHeight: 50,
    borderRadius: 15,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#FFFEFB",
    borderWidth: 1,
    borderColor: "#D8CBEA",
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  options: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#D8CBEA",
    overflow: "hidden",
    backgroundColor: "#FFFEFB",
  },
  option: { minHeight: 50, padding: 12, justifyContent: "center" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 12, height: 12, borderRadius: 3 },
  small: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 14,
    lineHeight: 20,
    color: p.ink,
  },
  note: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 14,
    lineHeight: 21,
    color: p.muted,
  },
  chartDetail: {
    borderRadius: 14,
    backgroundColor: p.lilac,
    padding: 12,
    gap: 8,
  },
  topicRow: {
    minHeight: 92,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  topicTitle: {
    fontFamily: "Baloo2_700Bold",
    fontSize: 22,
    lineHeight: 28,
    color: p.ink,
  },
  link: { fontFamily: "Nunito_800ExtraBold", fontSize: 16, color: p.purple },
  topicDetails: { gap: 12, paddingBottom: 20 },
  evidence: {
    minHeight: 60,
    borderWidth: 1,
    borderColor: p.line,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F8F5FC",
  },
});
