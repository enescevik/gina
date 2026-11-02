import { TimetableImportEntry, TimetableSourceLinks } from "./timetable-import";
import { useEffect, useState } from "react";
import { usePreventRemove } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react-native";
import {
  nextLessonTimes,
  validateLessons,
  validLessonSettings,
  type Lesson,
  type LessonSettings,
  type Json,
} from "@gina/core";
import { Avatar } from "@/components/avatar";
import { SubjectIcon } from "@/components/subject-icon";
import { Field } from "@/components/ui/field";
import { Pressable } from "@/components/ui/pressable";
import { supabase } from "@/lib/supabase";
import { useSchoolTimetable } from "@/lib/school-timetable";
import { IconButton, PlannerHero, SatinButton, Tag, p, u } from "./ui";
export interface PlannerChild {
  grade?: number | null;
  id: string;
  name: string;
  avatar: string | null;
}
interface Draft {
  lessons: Lesson[];
  settings: LessonSettings;
  revision: number;
}
const newKey = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
type EditorProps = {
  child: PlannerChild;
  profiles: PlannerChild[];
  onClose: () => void;
  onSwitch: (c: PlannerChild) => void;
};
export function TimetableEditor(props: EditorProps) {
  const query = useSchoolTimetable(props.child.id);
  const { t } = useTranslation();
  if (!query.data)
    return (
      <SafeAreaView style={u.root}>
        <View style={[u.content, { paddingTop: 24 }]}>
          <Text style={u.heading}>{t("planner.program")}</Text>
          {query.isLoading ? (
            <ActivityIndicator color={p.purple} />
          ) : (
            <>
              <Text style={u.error}>{t("planner.loadError")}</Text>
              <SatinButton
                title={t("common.retry")}
                onPress={() => {
                  void query.refetch();
                }}
              />
            </>
          )}
          <SatinButton
            secondary
            title={t("common.back")}
            onPress={props.onClose}
          />
        </View>
      </SafeAreaView>
    );
  return <LoadedEditor {...props} query={query} initial={query.data} />;
}
function LoadedEditor({
  child,
  profiles,
  onClose,
  onSwitch,
  query,
  initial,
}: EditorProps & {
  query: ReturnType<typeof useSchoolTimetable>;
  initial: Draft;
}) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const wide = width >= 1000;
  const cache = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(initial);
  const [baseline, setBaseline] = useState(JSON.stringify(initial));
  const [day, setDay] = useState(1);
  const [weekend, setWeekend] = useState(
    initial.lessons.some((l) => l.day > 5),
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [settings, setSettings] = useState<LessonSettings | null>(null);
  const [copy, setCopy] = useState(false);
  const [targets, setTargets] = useState<number[]>([]);
  const [sheetError, setSheetError] = useState("");
  const [leave, setLeave] = useState<(() => void) | null>(null);
  const dirty = !!draft && JSON.stringify(draft) !== baseline;
  usePreventRemove(dirty || busy, ({ repeat }) => {
    if (!busy) setLeave(() => repeat);
  });
  useEffect(() => {
    if (Platform.OS !== "web" || !dirty) return;
    const fn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [dirty]);
  function requestLeave(action: () => void) {
    if (busy) return;
    if (dirty) setLeave(() => action);
    else action();
  }
  function change(next: Draft) {
    setDraft(next);
    setSaved(false);
    setError("");
  }
  async function save() {
    if (!draft) return;
    const validation = validateLessons(draft.lessons);
    if (validation || !validLessonSettings(draft.settings)) {
      setError(t(`planner.${validation ?? "invalid"}`));
      return;
    }
    setBusy(true);
    setError("");
    setConflict(false);
    try {
      const { data, error: err } = await supabase.rpc("save_school_timetable", {
        p_child_id: child.id,
        p_revision: draft.revision,
        p_lessons: draft.lessons as unknown as Json,
        p_settings: draft.settings as unknown as Json,
      });
      if (err) throw err;
      const next = { ...draft, revision: data };
      setDraft(next);
      setBaseline(JSON.stringify(next));
      setSaved(true);
      cache.setQueryData(["school_timetable", child.id], next);
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["events"] }),
        cache.invalidateQueries({ queryKey: ["child_events"] }),
      ]);
    } catch (e) {
      const msg = (e as Error).message;
      setConflict(msg.includes("timetable_conflict"));
      setError(
        t(
          msg.includes("timetable_conflict")
            ? "planner.conflict"
            : msg.includes("timetable_overlap")
              ? "planner.overlap"
              : "planner.saveError",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  function add(d = day) {
    if (!draft) return;
    const times = nextLessonTimes(draft.lessons, d, draft.settings);
    if (!times) {
      setError(t("planner.dayFull"));
      return;
    }
    setSheetError("");
    setLesson({ id: newKey(), day: d, title: "", ...times });
  }
  function keepLesson() {
    if (!draft || !lesson) return;
    const next = [
      ...draft.lessons.filter((l) => l.id !== lesson.id),
      { ...lesson, title: lesson.title.trim() },
    ];
    const err = validateLessons(next);
    if (err) {
      setSheetError(t(`planner.${err}`));
      return;
    }
    change({ ...draft, lessons: next });
    setLesson(null);
  }
  const days = weekend ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5];
  const rows = (d: number) =>
    (draft?.lessons ?? [])
      .filter((l) => l.day === d)
      .sort((a, b) => a.start.localeCompare(b.start));
  const sheetOpen = !!lesson || !!settings || copy || !!leave;
  const closeSheet = () => {
    setLesson(null);
    setSettings(null);
    setCopy(false);
    setLeave(null);
    setSheetError("");
  };
  const dayName = (d: number) => t(`weekday.${d}`);
  function renderRows(d: number) {
    const list = rows(d);
    return (
      <View style={{ gap: 10 }}>
        {list.length ? (
          list.map((l, i) => (
            <View
              key={l.id}
              style={[
                u.card,
                u.row,
                { padding: wide ? 10 : 12, borderRadius: 22, gap: 10 },
              ]}
            >
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: i % 2 ? p.mint : p.lilac,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={[u.bold, { color: p.purple }]}>{i + 1}</Text>
              </View>
              {!wide ? (
                <SubjectIcon subject={l.title} size={34} variant="svg" />
              ) : null}
              <View style={u.fill}>
                <Text style={u.bold}>{l.title}</Text>
                <Text style={[u.small, { marginTop: 3 }]}>
                  {l.start} – {l.end}
                </Text>
              </View>
              <IconButton
                label={t("planner.editLesson", { title: l.title })}
                onPress={() => {
                  setLesson({ ...l });
                  setSheetError("");
                }}
              >
                <Pencil size={18} color={p.purple} />
              </IconButton>
            </View>
          ))
        ) : (
          <Text style={[u.copy, { paddingVertical: 20 }]}>
            {t("planner.noLessons")}
          </Text>
        )}
        <SatinButton
          secondary
          title={t("planner.addLesson")}
          icon={<Plus size={19} color={p.purple} />}
          onPress={() => add(d)}
        />
      </View>
    );
  }
  return (
    <SafeAreaView style={u.root}>
      <KeyboardAvoidingView
        style={u.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        contentContainerStyle={u.content}
        >
          <View style={u.topbar}>
            <IconButton
              label={t("common.back")}
              onPress={() => requestLeave(onClose)}
            >
              <ArrowLeft color={p.purple} />
            </IconButton>
            <Text style={[u.bold, { fontSize: 20 }]}>
              {t("planner.program")}
            </Text>
            <View style={{ width: 48 }} />
          </View>
          <PlannerHero
            title={t("planner.childWeek", { name: child.name })}
            subtitle={t("planner.programSubtitle")}
          />
          <View
            style={[
              u.row,
              { justifyContent: "space-between", flexWrap: "wrap" },
            ]}
          >
            <View style={[u.row, { flexWrap: "wrap" }]}>
              {profiles.map((c) => (
                <Tag
                  key={c.id}
                  label={c.name}
                  selected={c.id === child.id}
                  onPress={() => {
                    if (c.id !== child.id) requestLeave(() => onSwitch(c));
                  }}
                >
                  <Avatar slug={c.avatar} size={30} />
                </Tag>
              ))}
            </View>
            <View
              style={[
                u.row,
                { backgroundColor: p.mint, borderRadius: 20, padding: 10 },
              ]}
            >
              {saved ? (
                <Check size={15} color="#197465" />
              ) : (
                <Pencil size={15} color="#197465" />
              )}
              <Text style={u.small}>
                {t(
                  saved
                    ? "planner.saved"
                    : dirty
                      ? "planner.editing"
                      : "planner.weekly",
                )}
              </Text>
            </View>
          </View>
          {query.isLoading ? (
            <ActivityIndicator color={p.purple} />
          ) : query.error ? (
            <View style={u.card}>
              <Text style={u.error}>{t("planner.loadError")}</Text>
              <SatinButton
                title={t("common.retry")}
                onPress={() => {
                  void query.refetch();
                }}
              />
            </View>
          ) : null}
          {draft ? (
            <View pointerEvents={busy ? "none" : "auto"} style={{ gap: 18 }}>
              <TimetableImportEntry
                  childId={child.id}
                  initial={draft}
                  disabled={dirty || busy}
                  onSaved={(next) => {
                    setDraft(next);
                    setBaseline(JSON.stringify(next));
                    setSaved(true);
                    setWeekend(next.lessons.some((l) => l.day > 5));
                    cache.setQueryData(["school_timetable", child.id], next);
                    void cache.invalidateQueries({ queryKey: ["events"] });
                    void cache.invalidateQueries({
                      queryKey: ["child_events"],
                    });
                    void cache.invalidateQueries({
                      queryKey: ["timetable_sources", child.id],
                    });
                  }}
                />
                <TimetableSourceLinks childId={child.id} />
                {!wide ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={u.row}>
                    {days.map((d) => (
                      <Pressable
                        key={d}
                        accessibilityRole="button"
                        accessibilityState={{ selected: d === day }}
                        onPress={() => setDay(d)}
                        style={{
                          minWidth: 52,
                          minHeight: 50,
                          backgroundColor: d === day ? p.purple : "#F1EDF5",
                          borderRadius: 17,
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 8,
                        }}
                      >
                        <Text
                          style={[
                            u.bold,
                            { color: d === day ? "#fff" : p.ink },
                          ]}
                        >
                          {dayName(d)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              ) : null}
              <View
                style={[
                  u.row,
                  { justifyContent: "space-between", flexWrap: "wrap" },
                ]}
              >
                <Text style={u.heading}>
                  {wide ? t("planner.weekOverview") : t(`planner.day${day}`)}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setCopy(true);
                    setTargets([]);
                    setSheetError("");
                  }}
                  style={[u.row, u.link]}
                >
                  <Copy size={19} color={p.purple} />
                  <Text style={u.linkText}>{t("planner.copyDay")}</Text>
                </Pressable>
              </View>
              {wide ? (
                <ScrollView horizontal>
                  <View
                    style={{ flexDirection: "row", gap: 14, paddingBottom: 14 }}
                  >
                    {days.map((d) => (
                      <View key={d} style={{ width: 202, gap: 12 }}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ selected: day === d }}
                          onPress={() => setDay(d)}
                          style={[
                            u.tag,
                            {
                              backgroundColor: day === d ? p.lilac : "#F5F1F7",
                            },
                          ]}
                        >
                          <Text style={u.bold}>{t(`planner.day${d}`)}</Text>
                        </Pressable>
                        {renderRows(d)}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              ) : (
                renderRows(day)
              )}
              <Pressable
                accessibilityRole="button"
                style={[u.row, u.card, { padding: 12 }]}
                onPress={() => {
                  setSettings({ ...draft.settings });
                  setSheetError("");
                }}
              >
                <Clock size={22} color={p.ink} />
                <Text style={[u.bold, u.fill]}>{t("planner.hours")}</Text>
                <ChevronRight size={20} color={p.purple} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: weekend }}
                style={u.link}
                onPress={() => {
                  setWeekend(!weekend);
                  if (day > 5) setDay(1);
                }}
              >
                <Text style={u.linkText}>
                  {t(weekend ? "planner.hideWeekend" : "planner.showWeekend")}
                </Text>
              </Pressable>
              <Text style={u.small}>{t("planner.sharedHelp")}</Text>
              {query.data && query.data.revision !== draft.revision ? (
                <Text style={u.error}>{t("planner.remoteChange")}</Text>
              ) : null}
            </View>
          ) : null}
          {error ? (
            <Text accessibilityRole="alert" style={u.error}>
              {error}
            </Text>
          ) : null}
          {conflict || (query.data && query.data.revision !== draft?.revision) ? (
            <SatinButton
              secondary
              title={t("planner.reload")}
              onPress={() =>
                requestLeave(() => {
                  void query.refetch().then((r) => {
                    if (r.data) {
                      setDraft(r.data);
                      setBaseline(JSON.stringify(r.data));
                      setConflict(false);
                      setError("");
                    }
                  });
                })
              }
            />
          ) : null}
        </ScrollView>
        <View style={[u.footer, { justifyContent: "center" }]}>
          <SatinButton
            secondary
            title={t("common.cancel")}
            disabled={busy}
            onPress={() => requestLeave(onClose)}
          />
          <SatinButton
            title={t("planner.save")}
            disabled={!dirty || !!query.error}
            busy={busy}
            onPress={() => {
              void save();
            }}
            style={{ flex: 1, maxWidth: 420 }}
          />
        </View>
      </KeyboardAvoidingView>
      <Modal
        visible={sheetOpen}
        transparent
        animationType="none"
        onRequestClose={closeSheet}
        supportedOrientations={["portrait", "landscape"]}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#20195166",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{
              maxHeight: "95%",
              width: "100%",
              maxWidth: 560,
              alignSelf: "center",
            }}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[u.card, { padding: 22, gap: 18 }]}
            >
              <View style={[u.row, { justifyContent: "space-between" }]}>
                <Text style={[u.heading, u.fill]}>
                  {t(
                    leave
                      ? "planner.discardTitle"
                      : lesson
                        ? "planner.lesson"
                        : settings
                          ? "planner.hours"
                          : "planner.copyDay",
                  )}
                </Text>
                <IconButton label={t("common.cancel")} onPress={closeSheet}>
                  <X color={p.ink} />
                </IconButton>
              </View>
              {leave ? (
                <>
                  <Text style={u.copy}>{t("planner.discardBody")}</Text>
                  <SatinButton
                    title={t("planner.keepEditing")}
                    onPress={closeSheet}
                  />
                  <SatinButton
                    secondary
                    title={t("planner.discard")}
                    onPress={() => {
                      const action = leave;
                      setLeave(null);
                      action();
                    }}
                  />
                </>
              ) : null}
              {lesson ? (
                <>
                  <Field
                    label={t("planner.subject")}
                    maxLength={120}
                    value={lesson.title}
                    onChangeText={(v) => setLesson({ ...lesson, title: v })}
                  />
                  <ScrollView horizontal>
                    <View style={u.row}>
                      {[
                        "math",
                        "turkish",
                        "life",
                        "science",
                        "english",
                        "art",
                        "music",
                      ].map((key) => (
                        <Tag
                          key={key}
                          label={t(`planner.subject_${key}`)}
                          onPress={() =>
                            setLesson({
                              ...lesson,
                              title: t(`planner.subject_${key}`),
                            })
                          }
                        />
                      ))}
                    </View>
                  </ScrollView>
                  <View style={u.row}>
                    <View style={u.fill}>
                      <Field
                        label={t("calendar.start")}
                        value={lesson.start}
                        onChangeText={(v) => setLesson({ ...lesson, start: v })}
                        maxLength={5}
                        placeholder="09:00"
                        keyboardType="numbers-and-punctuation"
                      />
                    </View>
                    <View style={u.fill}>
                      <Field
                        label={t("calendar.end")}
                        value={lesson.end}
                        onChangeText={(v) => setLesson({ ...lesson, end: v })}
                        maxLength={5}
                        placeholder="09:40"
                        keyboardType="numbers-and-punctuation"
                      />
                    </View>
                  </View>
                  <SatinButton
                    title={t("planner.keepLesson")}
                    onPress={keepLesson}
                  />
                  {draft?.lessons.some((l) => l.id === lesson.id) ? (
                    <SatinButton
                      secondary
                      title={t("planner.removeLesson")}
                      icon={<Trash2 size={18} color={p.purple} />}
                      onPress={() => {
                        change({
                          ...draft,
                          lessons: draft.lessons.filter(
                            (l) => l.id !== lesson.id,
                          ),
                        });
                        setLesson(null);
                      }}
                    />
                  ) : null}
                </>
              ) : null}
              {settings ? (
                <>
                  <Field
                    label={t("planner.firstLesson")}
                    value={settings.start}
                    onChangeText={(v) => setSettings({ ...settings, start: v })}
                    maxLength={5}
                  />
                  <Field
                    label={t("planner.duration")}
                    value={String(settings.duration)}
                    onChangeText={(v) =>
                      setSettings({ ...settings, duration: Number(v) })
                    }
                    keyboardType="number-pad"
                  />
                  <Field
                    label={t("planner.break")}
                    value={String(settings.break)}
                    onChangeText={(v) =>
                      setSettings({ ...settings, break: Number(v) })
                    }
                    keyboardType="number-pad"
                  />
                  <Text style={u.copy}>{t("planner.hoursHelp")}</Text>
                  <SatinButton
                    title={t("common.save")}
                    onPress={() => {
                      if (!validLessonSettings(settings)) {
                        setSheetError(t("planner.invalid"));
                        return;
                      }
                      if (draft) change({ ...draft, settings });
                      setSettings(null);
                    }}
                  />
                </>
              ) : null}
              {copy ? (
                <>
                  <Text style={u.copy}>
                    {t("planner.copyHelp", { day: t(`planner.day${day}`) })}
                  </Text>
                  <View style={[u.row, { flexWrap: "wrap" }]}>
                    {[1, 2, 3, 4, 5, 6, 7]
                      .filter((d) => d !== day)
                      .map((d) => (
                        <Tag
                          key={d}
                          label={t(`planner.day${d}`)}
                          selected={targets.includes(d)}
                          onPress={() =>
                            setTargets(
                              targets.includes(d)
                                ? targets.filter((x) => x !== d)
                                : [...targets, d],
                            )
                          }
                        />
                      ))}
                  </View>
                  <SatinButton
                    title={t("planner.copyConfirm")}
                    disabled={!targets.length || !rows(day).length}
                    onPress={() => {
                      if (!draft) return;
                      const lessons = [
                        ...draft.lessons.filter(
                          (l) => !targets.includes(l.day),
                        ),
                        ...targets.flatMap((d) =>
                          rows(day).map((l) => ({
                            ...l,
                            id: newKey(),
                            day: d,
                          })),
                        ),
                      ];
                      const err = validateLessons(lessons);
                      if (err) {
                        setSheetError(t(`planner.${err}`));
                        return;
                      }
                      change({ ...draft, lessons });
                      if (targets.some((d) => d > 5)) setWeekend(true);
                      setCopy(false);
                    }}
                  />
                </>
              ) : null}
              {sheetError ? (
                <Text accessibilityRole="alert" style={u.error}>
                  {sheetError}
                </Text>
              ) : null}
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
