import { NOTEBOOK_MODAL_PROPS } from "@/components/learning/notebook-layout";
import { TimeChoice, TimetableBoard } from "./timetable-board";
import { TimetableImportEntry, TimetableSourceLinks } from "./timetable-import";
import { type ComponentRef, useEffect, useMemo, useRef, useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Check, Copy, Pencil, Trash2, X } from "lucide-react-native";
import {
  type Lesson,
  type LessonSettings,
  nextLessonTimes,
  type TimetableCommand,
  validateLessons,
  validLessonSettings,
} from "@gina/core";
import { Avatar } from "@/components/avatar";
import { Field } from "@/components/ui/field";
import { Pressable } from "@/components/ui/pressable";
import { timetableJournal } from "@/lib/timetable-command";
import { useSession } from "@/lib/session";
import { useSchoolTimetable } from "@/lib/school-timetable";
import { IconButton, p, PlannerHero, SatinButton, Tag, u } from "./ui";
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
  const { session, claims } = useSession();
  const query = useSchoolTimetable(props.child.id);
  const { t } = useTranslation();
  if (!query.data) {
    return (
      <SafeAreaView style={u.root}>
        <View style={[u.content, { paddingTop: 24 }]}>
          <Text style={u.heading}>{t("planner.program")}</Text>
          {query.isLoading ? <ActivityIndicator color={p.purple} /> : (
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
  }
  return (
    <LoadedEditor
      key={`${session?.user.id}:${claims?.family_id}:${props.child.id}`}
      {...props}
      query={query}
      initial={query.data}
    />
  );
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
  const cache = useQueryClient();
  const { session, claims } = useSession();
  const journal = useMemo(
    () =>
      timetableJournal(
        session?.user.id ?? "",
        claims?.family_id ?? "",
        child.id,
      ),
    [session?.user.id, claims?.family_id, child.id],
  );
  const [recovery] = useState(() => {
    try {
      return { command: journal.read(), error: false };
    } catch {
      return { command: null, error: true };
    }
  });
  const [pending, setPending] = useState<TimetableCommand | null>(
    recovery.command,
  );
  const recovered = recovery.command
    ? {
      revision: recovery.command.p_revision,
      lessons: recovery.command.p_lessons,
      settings: recovery.command.p_settings,
    }
    : initial;
  const [draft, setDraft] = useState<Draft | null>(recovered);
  const [baseline, setBaseline] = useState(JSON.stringify(initial));
  const [day, setDay] = useState(1);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null),
    scrollY = useRef(0);
  const [saved, setSaved] = useState(false);
  const [newer, setNewer] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [copy, setCopy] = useState(false);
  const [targets, setTargets] = useState<number[]>([]);
  const [sheetError, setSheetError] = useState("");
  const [leave, setLeave] = useState<(() => void) | null>(null);
  const dirty = !!draft && JSON.stringify(draft) !== baseline;
  const locked = busy || !!pending || recovery.error;
  usePreventRemove(
    (dirty && !pending && !recovery.error) || busy,
    ({ repeat }) => {
      if (!busy) setLeave(() => repeat);
    },
  );
  useEffect(() => {
    if (Platform.OS !== "web" || !dirty || pending || recovery.error) return;
    const fn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [dirty, pending, recovery.error]);
  function requestLeave(action: () => void) {
    if (busy) return;
    if (dirty && !pending && !recovery.error) setLeave(() => action);
    else action();
  }
  function change(next: Draft) {
    if (locked) return;
    setDraft(next);
    setSaved(false);
    setNewer(false);
    setError("");
  }
  async function save() {
    if (!draft || busy || recovery.error) return;
    if (!pending) {
      const validation = validateLessons(draft.lessons);
      if (validation || !validLessonSettings(draft.settings)) {
        setError(t(`planner.${validation ?? "invalid"}`));
        return;
      }
    }
    setBusy(true);
    setError("");
    setConflict(false);
    try {
      const command = pending ?? journal.prepare({
        p_child_id: child.id,
        p_revision: draft.revision,
        p_lessons: draft.lessons,
        p_settings: draft.settings,
      });
      setPending(command);
      const receipt = await journal.send(command);
      setPending(null);
      const acknowledged = {
        lessons: command.p_lessons,
        settings: command.p_settings,
        revision: receipt.revision,
      };
      const fresh = await query.refetch();
      // An old successful receipt must not replace a newer parent's/child's edit.
      const current = fresh.data ??
        cache.getQueryData<Draft>(["school_timetable", child.id]);
      const next = current && current.revision >= receipt.revision
        ? current
        : acknowledged;
      setNewer(!!current && current.revision > receipt.revision);
      setDraft(next);
      setBaseline(JSON.stringify(next));
      setSaved(true);
      cache.setQueryData(["school_timetable", child.id], next);
      if (fresh.error) setError(t("timetableRecovery.refresh"));
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["events"] }),
        cache.invalidateQueries({ queryKey: ["child_events"] }),
      ]);
    } catch (e) {
      let stored = false;
      try {
        const command = journal.read();
        setPending(command);
        stored = !!command;
      } catch {
        setError(t("timetableRecovery.storage"));
        return;
      }
      const msg = (e as Error).message;
      setConflict(msg.includes("timetable_conflict"));
      setError(
        t(
          stored
            ? "timetableRecovery.pendingBody"
            : msg.includes("timetable_conflict")
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
    if (!draft || locked) return;
    const times = nextLessonTimes(draft.lessons, d, draft.settings);
    if (!times) {
      setError(t("planner.dayFull"));
      return;
    }
    setSheetError("");
    setLesson({ id: newKey(), day: d, title: "", ...times });
  }
  function keepLesson() {
    if (!draft || !lesson || locked) return;
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
  const rows = (d: number) =>
    (draft?.lessons ?? [])
      .filter((l) => l.day === d)
      .sort((a, b) => a.start.localeCompare(b.start));
  const sheetOpen = !!lesson || copy || !!leave;
  const closeSheet = () => {
    setLesson(null);
    setCopy(false);
    setLeave(null);
    setSheetError("");
  };
  return (
    <SafeAreaView style={u.root}>
      <KeyboardAvoidingView
        style={u.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scroll}
          onScroll={(e) => {
            scrollY.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          scrollEnabled={!dragging}
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
          {!draft?.lessons.length
            ? (
              <PlannerHero
                title={t("planner.childWeek", { name: child.name })}
                subtitle={t("planner.programSubtitle")}
              />
            )
            : null}
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
              {saved
                ? <Check size={15} color="#197465" />
                : <Pencil size={15} color="#197465" />}
              <Text style={u.small}>
                {t(
                  busy
                    ? "timetableRecovery.saving"
                    : pending
                    ? "timetableRecovery.waiting"
                    : saved
                    ? "planner.saved"
                    : dirty
                    ? "planner.editing"
                    : "planner.weekly",
                )}
              </Text>
            </View>
          </View>
          {query.isLoading
            ? <ActivityIndicator color={p.purple} />
            : query.error
            ? (
              <View style={u.card}>
                <Text style={u.error}>{t("planner.loadError")}</Text>
                <SatinButton
                  title={t("common.retry")}
                  onPress={() => {
                    void query.refetch();
                  }}
                />
              </View>
            )
            : null}
          {(pending && !busy) || recovery.error
            ? (
              <View style={[u.card, { backgroundColor: p.lilac }]}>
                <Text style={u.bold}>
                  {t(
                    recovery.error
                      ? "timetableRecovery.storageTitle"
                      : "timetableRecovery.pendingTitle",
                  )}
                </Text>
                <Text style={u.copy}>
                  {t(
                    recovery.error
                      ? "timetableRecovery.storage"
                      : "timetableRecovery.pendingBody",
                  )}
                </Text>
              </View>
            )
            : null}
          {newer
            ? <Text style={u.copy}>{t("timetableRecovery.newer")}</Text>
            : null}
          {draft
            ? (
              <View
                pointerEvents={locked ? "none" : "auto"}
                style={{ gap: 18 }}
              >
                <TimetableBoard
                  extraAction={
                    <TimetableImportEntry
                      compact
                      childId={child.id}
                      initial={draft}
                      disabled={dirty || locked}
                      onSaved={(next) => {
                        setDraft(next);
                        setBaseline(JSON.stringify(next));
                        setSaved(true);
                        cache.setQueryData(
                          ["school_timetable", child.id],
                          next,
                        );
                        void cache.invalidateQueries({ queryKey: ["events"] });
                        void cache.invalidateQueries({
                          queryKey: ["child_events"],
                        });
                        void cache.invalidateQueries({
                          queryKey: ["timetable_sources", child.id],
                        });
                      }}
                    />
                  }
                  key={`${child.id}:${draft.revision}`}
                  onReveal={(top) =>
                    scroll.current?.scrollTo({
                      y: Math.max(0, scrollY.current + top - 110),
                      animated: false,
                    })}
                  rows={draft.lessons}
                  settings={draft.settings}
                  disabled={locked}
                  onDragChange={setDragging}
                  onChange={(lessons) => change({ ...draft, lessons })}
                  onSettingsChange={(settings) =>
                    setDraft((current) =>
                      current ? { ...current, settings } : current
                    )}
                  onAdd={(d) => add(d)}
                />
                <Pressable
                  disabled={locked}
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
                <Text style={u.small}>{t("planner.sharedHelp")}</Text>
                <TimetableSourceLinks childId={child.id} />
                {!pending && query.data &&
                    query.data.revision !== draft.revision
                  ? <Text style={u.error}>{t("planner.remoteChange")}</Text>
                  : null}
              </View>
            )
            : null}
          {error && !pending
            ? (
              <Text accessibilityRole="alert" style={u.error}>
                {error}
              </Text>
            )
            : null}
          {!pending && !recovery.error &&
              (conflict ||
                (query.data && query.data.revision !== draft?.revision))
            ? (
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
                  })}
              />
            )
            : null}
        </ScrollView>
        <View style={[u.footer, { justifyContent: "center" }]}>
          <SatinButton
            secondary
            title={t(
              pending || recovery.error ? "common.back" : "common.cancel",
            )}
            disabled={busy}
            onPress={() => requestLeave(onClose)}
          />
          <SatinButton
            title={t(pending ? "timetableRecovery.retry" : "planner.save")}
            disabled={recovery.error || (!pending && (!dirty || !!query.error))}
            busy={busy}
            onPress={() => {
              void save();
            }}
            style={{ flex: 1, maxWidth: 420 }}
          />
        </View>
      </KeyboardAvoidingView>
      <Modal
        {...NOTEBOOK_MODAL_PROPS}
        visible={sheetOpen}
        transparent
        animationType="none"
        onRequestClose={closeSheet}
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
                      : "planner.copyDay",
                  )}
                </Text>
                <IconButton label={t("common.cancel")} onPress={closeSheet}>
                  <X color={p.ink} />
                </IconButton>
              </View>
              {leave
                ? (
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
                )
                : null}
              {lesson
                ? (
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
                              })}
                          />
                        ))}
                      </View>
                    </ScrollView>
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 14,
                        flexWrap: "wrap",
                      }}
                    >
                      <TimeChoice
                        label={t("calendar.start")}
                        value={lesson.start}
                        onChange={(start) => setLesson({ ...lesson, start })}
                      />
                      <TimeChoice
                        label={t("calendar.end")}
                        value={lesson.end}
                        onChange={(end) => setLesson({ ...lesson, end })}
                      />
                    </View>
                    <SatinButton
                      title={t("planner.keepLesson")}
                      onPress={keepLesson}
                    />
                    {draft?.lessons.some((l) => l.id === lesson.id)
                      ? (
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
                      )
                      : null}
                  </>
                )
                : null}
              {copy
                ? (
                  <>
                    <Text style={u.copy}>
                      {t("planner.copyHelp", { day: t(`planner.day${day}`) })}
                    </Text>
                    <Text style={u.bold}>{t("weekReview.copyFrom")}</Text>
                    <View style={[u.row, { flexWrap: "wrap" }]}>
                      {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                        <Tag
                          key={d}
                          selected={d === day}
                          label={t("weekday." + d)}
                          onPress={() => {
                            setDay(d);
                            setTargets([]);
                          }}
                        />
                      ))}
                    </View>
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
                              )}
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
                            }))
                          ),
                        ];
                        const err = validateLessons(lessons);
                        if (err) {
                          setSheetError(t(`planner.${err}`));
                          return;
                        }
                        change({ ...draft, lessons });
                        setCopy(false);
                      }}
                    />
                  </>
                )
                : null}
              {sheetError
                ? (
                  <Text accessibilityRole="alert" style={u.error}>
                    {sheetError}
                  </Text>
                )
                : null}
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
