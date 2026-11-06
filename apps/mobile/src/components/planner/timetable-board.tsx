import {
  type ComponentRef,
  type ReactNode,
  type Ref,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  PanResponder,
  Platform,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  ArrowDownUp,
  GripVertical,
  MoreHorizontal,
  Undo2,
  X,
} from "lucide-react-native";
import {
  type BellPattern,
  changeTimetableBreak,
  clockMinutes,
  editTimetableCell,
  inferBellPattern,
  isClock,
  type LessonSettings,
  scheduleTimetable,
  swapTimetableCells,
  type TimetableCell,
  subjectDisplay,
  timetableDay,
} from "@gina/core";
import { TimeChoice } from "@/components/ui/date-time-choice";
import { DecisionSheet } from "@/components/ui/decision-sheet";
import { Field } from "@/components/ui/field";
import { Pressable } from "@/components/ui/pressable";
import { Toggle } from "@/components/ui/toggle";
import { NumberChoice } from "@/components/ui/number-choice";
import { IconButton, p, SatinButton, Tag, u } from "./ui";
import {
  cellDoubts,
  emptyCellId,
  moveTimetableCellToDay,
  readEmptyCellId,
} from "./planner-moves";
import { bindingFor, DeviceBindingImport, SubjectMatch, useSubjectBindings } from "./subject-match";
export { TimeChoice } from "@/components/ui/date-time-choice";

export function BellEditor({
  rows,
  settings,
  day,
  onApply,
  onCancel,
}: {
  rows: TimetableCell[];
  settings: LessonSettings;
  day: number;
  onApply: (pattern: BellPattern, days: number[]) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [pattern, setPattern] = useState<BellPattern>(() =>
    inferBellPattern(rows, day, settings)
  );
  const [all, setAll] = useState(false);
  const days = all ? [1, 2, 3, 4, 5, 6, 7] : [day];
  let preview: TimetableCell[] = [], error = "";
  try {
    preview = scheduleTimetable(rows, days, pattern);
  } catch {
    error = t("planner.invalid");
  }
  const firstDay =
    days.find((d) =>
      preview.some((r) => r.day === d && r.included !== false)
    ) ?? day;
  return (
    <DecisionSheet visible title={t("weekReview.bells")} onClose={onCancel} footer={<View style={[u.row, { alignItems: "stretch" }]}>
      <SatinButton secondary title={t("common.cancel")} onPress={onCancel} style={{ flex: 1 }}/>
      <SatinButton disabled={!!error} title={t("experience.applyBellDraft")} onPress={() => onApply(pattern, days)} style={{ flex: 2 }}/>
    </View>}>
      <Text style={u.copy}>{t("weekReview.bellsHelp")}</Text>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Tag
          label={t("weekReview.allDays")}
          selected={all}
          onPress={() => setAll(true)}
        />
        <Tag
          label={t("planner.day" + day)}
          selected={!all}
          onPress={() => setAll(false)}
        />
      </View>
      <TimeChoice
        label={t("planner.firstLesson")}
        value={pattern.start}
        onChange={(start) => setPattern({ ...pattern, start })}
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 20 }}>
        <View style={{ flex: 1, minWidth: 240 }}>
          <NumberChoice
            showHint={false}
            label={t("planner.duration")}
            value={pattern.duration}
            onChange={(duration) => setPattern({ ...pattern, duration })}
            min={5}
            max={180}
            presets={[30, 35, 40, 45, 50]}
            unit={t("weekReview.minute")}
          />
        </View>
        <View style={{ flex: 1, minWidth: 240 }}>
          <NumberChoice
            showHint={false}
            label={t("planner.break")}
            value={pattern.break}
            onChange={(v) => setPattern({ ...pattern, break: v })}
            min={0}
            max={120}
            presets={[5, 10, 15, 20]}
            unit={t("weekReview.minute")}
          />
        </View>
      </View>
      <Toggle label={t("experience.longBreak")} value={pattern.lunchAfter > 0} onChange={value => setPattern({ ...pattern, lunchAfter: value ? 4 : 0 })}/>
      {pattern.lunchAfter > 0 && <><Text style={u.bold}>{t("weekReview.lunchAfter")}</Text>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
          <Tag
            key={n}
            selected={pattern.lunchAfter === n}
            label={n
              ? t("weekReview.afterPeriod", { n })
              : t("weekReview.noLunch")}
            onPress={() => setPattern({ ...pattern, lunchAfter: n })}
          />
        ))}
      </View></>}
      {pattern.lunchAfter > 0
        ? (
          <NumberChoice
            showHint={false}
            label={t("weekReview.lunchDuration")}
            value={pattern.lunchMinutes}
            onChange={(lunchMinutes) =>
              setPattern({ ...pattern, lunchMinutes })}
            min={0}
            max={180}
            presets={[30, 40, 50, 60]}
            unit={t("weekReview.minute")}
          />
        )
        : null}
      <Text style={u.bold}>
        {t("weekReview.previewDay", { day: t("planner.day" + firstDay) })}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {timetableDay(preview, firstDay).filter((r) => r.included !== false)
          .map((r, i) => (
            <View
              key={r.id}
              style={{ padding: 10, borderRadius: 12, backgroundColor: "#fff" }}
            >
              <Text style={u.small}>{i + 1}. {r.start}–{r.end}</Text>
            </View>
          ))}
      </View>
      <Text style={u.small}>{t("weekReview.replaceTimes")}</Text>
      <Text style={u.small}>{t("experience.bellDraft")}</Text>
      {error ? <Text style={u.error}>{error}</Text> : null}
    </DecisionSheet>
  );
}

function WeekViewport(
  { week, height, dragging, children, scrollRef, onOffset, onSize }: {
    week: boolean;
    height: number;
    dragging: boolean;
    children: ReactNode;
    scrollRef: Ref<ComponentRef<typeof ScrollView>>;
    onOffset: (y: number) => void;
    onSize: (viewport: number | null, content: number | null) => void;
  },
) {
  return week
    ? (
      <ScrollView
        ref={scrollRef}
        nestedScrollEnabled
        stickyHeaderIndices={[0]}
        scrollEnabled={!dragging}
        scrollEventThrottle={16}
        onScroll={(e) => onOffset(e.nativeEvent.contentOffset.y)}
        onLayout={(e) => onSize(e.nativeEvent.layout.height, null)}
        onContentSizeChange={(_w, h) => onSize(null, h)}
        style={{ maxHeight: Math.max(320, height - 320) }}
      >
        {children}
      </ScrollView>
    )
    : <View>{children}</View>;
}

type Rect = { x: number; y: number; w: number; h: number };
function DragHandle(
  { onStart, onMove, onEnd, onCancel, disabled, testID }: {
    testID?: string;
    onStart: () => void;
    onMove: (x: number, y: number) => void;
    onEnd: (x: number, y: number) => void;
    onCancel: () => void;
    disabled: boolean;
  },
) {
  const current = useRef({ onStart, onMove, onEnd, onCancel, disabled });
  useLayoutEffect(() => {
    current.current = { onStart, onMove, onEnd, onCancel, disabled };
  });
  // PanResponder stores these event callbacks; it never calls them during render.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => !current.current.disabled,
      onMoveShouldSetPanResponder: () => !current.current.disabled,
      onPanResponderGrant: () => current.current.onStart(),
      onPanResponderMove: (_, g) => current.current.onMove(g.moveX, g.moveY),
      onPanResponderRelease: (_, g) => current.current.onEnd(g.moveX, g.moveY),
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => current.current.onCancel(),
    })
  );
  return (
    <View
      {...pan.panHandlers}
      testID={testID}
      accessible={false}
      aria-hidden
      style={{
        width: 48,
        height: 48,
        alignItems: "center",
        justifyContent: "center",
        ...(Platform.OS === "web" ? { touchAction: "none" as const } : {}),
        opacity: disabled ? .3 : 1,
      }}
    >
      <GripVertical size={21} color={p.muted} />
    </View>
  );
}
/** Same week grid and clock logic is used before importing and after saving. */
export function TimetableBoard<T extends TimetableCell>({
  rows,
  onChange,
  settings,
  onSettingsChange,
  disabled = false,
  onDragChange,
  allowExclude = false,
  onAdd,
  onReveal,
  extraAction,
  subjects,
}: {
  rows: T[];
  onChange: (next: T[]) => void;
  settings: LessonSettings;
  onSettingsChange?: (s: LessonSettings) => void;
  disabled?: boolean;
  onDragChange?: (v: boolean) => void;
  allowExclude?: boolean;
  onAdd?: (day: number) => void;
  onReveal?: (top: number) => void;
  extraAction?: ReactNode;
  /** Enables parent-confirmed catalogue matching (S04 suggest_subject) for this child. */
  subjects?: { childId: string; grade?: number | null };
}) {
  const { t, i18n } = useTranslation(), { width, height } = useWindowDimensions();
  const bindings = useSubjectBindings(subjects?.childId);
  const [mode, setMode] = useState<"day" | "week">(
      width >= 850 ? "week" : "day",
    ),
    [day, setDay] = useState(1),
    [weekend, setWeekend] = useState(rows.some((r) => (r.day ?? 0) > 5));
  const [editing, setEditing] = useState<T | null>(null),
    [bells, setBells] = useState(false),
    [shift, setShift] = useState(true),
    [arrange, setArrange] = useState(false),
    [more, setMore] = useState(false),
    [moving, setMoving] = useState<string | null>(null),
    [dragging, setDragging] = useState<string | null>(null),
    [hover, setHover] = useState<string | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [undo, setUndo] = useState<
    { rows: T[]; settings: LessonSettings } | null
  >(null);
  const board = useRef<ComponentRef<typeof View>>(null);
  const [boardWidth, setBoardWidth] = useState(width - 40);
  const nodes = useRef(new Map<string, ComponentRef<typeof View>>()),
    rects = useRef(new Map<string, Rect>());
  const hScroll = useRef<ComponentRef<typeof ScrollView>>(null),
    vScroll = useRef<ComponentRef<typeof ScrollView>>(null),
    hFrame = useRef<ComponentRef<typeof View>>(null);
  // Scroll offsets now / at drag start, viewport and content sizes, and the pointer, so a
  // drop target is still found after the grid scrolled under the finger.
  const offset = useRef({ x: 0, y: 0 }), startOffset = useRef({ x: 0, y: 0 }),
    size = useRef({ w: 0, cw: 0, h: 0, ch: 0 }),
    frames = useRef<{ h: Rect | null; v: Rect | null }>({ h: null, v: null }),
    pointer = useRef<{ x: number; y: number } | null>(null),
    ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => {
    if (ticker.current) clearInterval(ticker.current);
  }, []);
  const days = weekend ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5],
    visible = mode === "week" ? days : [day];
  const filled = Math.max(
    1,
    ...visible.map((d) => timetableDay(rows, d).length),
  );
  // While arranging, one extra empty row means every day always has a free cell to move into.
  const count = arrange || moving ? Math.min(16, filled + 1) : filled;
  const widthCell = mode === "week"
    ? Math.max(148, (boardWidth - 50) / visible.length)
    : Math.max(210, boardWidth - 50);
  function commit(next: T[], nextSettings?: LessonSettings) {
    setUndo({ rows, settings });
    onChange(next);
    if (nextSettings) onSettingsChange?.(nextSettings);
    setError("");
    setNotice(t("weekReview.changed"));
  }
  function exchange(from: string, to: string) {
    const empty = readEmptyCellId(to);
    if (empty) {
      moveTo(from, empty.day, empty.slot);
      return;
    }
    if (from !== to) commit(swapTimetableCells(rows, from, to));
    setMoving(null);
  }
  function moveTo(id: string, d: number, slot: number) {
    setMoving(null);
    try {
      const next = moveTimetableCellToDay(rows, id, d, settings, slot);
      commit(next);
      const moved = next.find((r) => r.id === id);
      setNotice(t(moved?.start ? "u05.moved" : "u05.movedUntimed"));
    } catch {
      setError(t("planner.dayFull"));
    }
  }
  function stopTicker() {
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
    pointer.current = null;
  }
  function finishDrag() {
    stopTicker();
    setDragging(null);
    setHover(null);
    onDragChange?.(false);
  }
  function hit(x: number, y: number) {
    const ax = x + offset.current.x - startOffset.current.x,
      ay = y + offset.current.y - startOffset.current.y;
    return [...rects.current.entries()].find(([, r]) =>
      ax >= r.x && ax <= r.x + r.w && ay >= r.y && ay <= r.y + r.h
    )?.[0];
  }
  /** Near a viewport edge the grid scrolls by itself while the finger is held there. */
  function autoScroll() {
    const at = pointer.current, edge = 56, step = 24;
    if (!at) return;
    const { h, v } = frames.current;
    let dx = 0, dy = 0;
    if (h) dx = at.x < h.x + edge ? -step : at.x > h.x + h.w - edge ? step : 0;
    if (v) dy = at.y < v.y + edge ? -step : at.y > v.y + v.h - edge ? step : 0;
    const maxX = Math.max(0, size.current.cw - size.current.w),
      maxY = Math.max(0, size.current.ch - size.current.h);
    const x = Math.min(maxX, Math.max(0, offset.current.x + dx)),
      y = Math.min(maxY, Math.max(0, offset.current.y + dy));
    if (x === offset.current.x && y === offset.current.y) return;
    if (x !== offset.current.x) hScroll.current?.scrollTo({ x, animated: false });
    if (y !== offset.current.y) vScroll.current?.scrollTo({ y, animated: false });
    offset.current = { x, y };
    setHover(hit(at.x, at.y) ?? null);
  }
  function open(row: T) {
    if (disabled) return;
    if (moving) {
      exchange(moving, row.id);
      return;
    }
    setEditing({ ...row });
    setBells(false);
    board.current?.measureInWindow((_x, y) => onReveal?.(y));
    setShift(true);
    setError("");
  }
  const missing = rows.filter((r) =>
    r.included !== false && !!r.day && (!isClock(r.start) || !isClock(r.end))
  ).length;
  const activeDay = editing?.day ?? day;
  const daily = timetableDay(rows, activeDay).filter((r) =>
      r.included !== false
    ),
    index = daily.findIndex((r) => r.id === editing?.id),
    following = daily[index + 1];
  const current = rows.find((r) => r.id === editing?.id);
  const gap =
    current && following && isClock(current.end) && isClock(following.start)
      ? clockMinutes(following.start) - clockMinutes(current.end)
      : null;
  return (
    <View
      ref={board}
      onLayout={(e) => setBoardWidth(e.nativeEvent.layout.width)}
      style={{ gap: 14 }}
    >
      <View
        style={[u.row, { flexWrap: "wrap", justifyContent: "space-between" }]}
      >
        {width >= 600
          ? <Text style={u.heading}>{t("planner.weekOverview")}</Text>
          : null}
        <View style={[u.row, { flexWrap: "wrap", gap: 8 }]}>
          <Tag
            label={t("weekReview.dayView")}
            selected={mode === "day"}
            onPress={() => {
              setMode("day");
              setMoving(null);
            }}
          />
          <Tag
            label={t("weekReview.weekView")}
            selected={mode === "week"}
            onPress={() => {
              setMode("week");
              setMoving(null);
            }}
          />
        </View>
      </View>
      <Text style={u.small}>
        {t(arrange ? "weekReview.gridHelp" : "weekReview.tapShort")}
      </Text>
      {arrange
        ? <Text style={u.small}>{t("u05.dragScrollHelp")}</Text>
        : null}
      <View style={[u.row, { flexWrap: "wrap", gap: 8 }]}>
        <Tag
          label={t("weekReview.arrange")}
          selected={arrange}
          onPress={() => {
            setArrange(!arrange);
            setMoving(null);
            setEditing(null);
          }}
        />
        <Tag
          label={t(width < 600 ? "weekReview.hoursShort" : "weekReview.bells")}
          selected={bells}
          onPress={() => {
            if (!disabled) {
              setBells(!bells);
              setEditing(null);
            }
          }}
        />
        <View
          style={[u.row, {
            display: width >= 600 || more ? "flex" : "none",
            flexWrap: "wrap",
          }]}
        >
          <Tag
            label={t(
              weekend ? "planner.hideWeekend" : "planner.showWeekend",
            )}
            onPress={() => {
              setWeekend(!weekend);
              setDay(1);
            }}
          />
          {extraAction}
        </View>
        {width < 600
          ? (
            <IconButton
              label={t("weekReview.more")}
              onPress={() => setMore(!more)}
            >
              <MoreHorizontal color={p.purple} />
            </IconButton>
          )
          : null}
        {undo
          ? (
            <Pressable
              disabled={disabled}
              accessibilityRole="button"
              onPress={() => {
                onChange(undo.rows);
                onSettingsChange?.(undo.settings);
                setUndo(null);
                setEditing(null);
                setNotice("");
              }}
              style={[u.link, u.row]}
            >
              <Undo2 size={18} color={p.purple} />
              <Text style={u.linkText}>{t("weekReview.undo")}</Text>
            </Pressable>
          )
          : null}
      </View>
      {mode === "day"
        ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={[u.row, { gap: 6 }]}>
              {days.map((d) => (
                <Tag
                  key={d}
                  selected={d === day}
                  label={t("weekday." + d)}
                  onPress={() => {
                    setDay(d);
                    setEditing(null);
                  }}
                />
              ))}
            </View>
          </ScrollView>
        )
        : null}
      {bells
        ? (
          <BellEditor
            rows={rows}
            settings={settings}
            day={day}
            onCancel={() => setBells(false)}
            onApply={(pattern, selectedDays) => {
              try {
                commit(scheduleTimetable(rows, selectedDays, pattern), {
                  start: pattern.start,
                  duration: pattern.duration,
                  break: pattern.break,
                });
                setBells(false);
              } catch {
                setError(t("planner.dayFull"));
              }
            }}
          />
        )
        : null}
      {editing
        ? (
          <View style={[u.card, { gap: 14, borderColor: p.purple }]}>
            <View style={u.row}>
              <Text style={[u.heading, { flex: 1 }]}>
                {t("weekReview.editLesson")}
              </Text>
              <IconButton
                label={t("common.cancel")}
                onPress={() => setEditing(null)}
              >
                <X color={p.ink} />
              </IconButton>
            </View>
            {editing.originalTitle && editing.originalTitle !== editing.title
              ? (
                <Text style={u.small}>
                  {t("weekReview.nameMapping", {
                    from: editing.originalTitle,
                    to: editing.title,
                  })}
                </Text>
              )
              : null}
            {editing.note ? <Text style={u.small}>{editing.note}</Text> : null}
            <Field
              label={t("planner.subject")}
              value={editing.title}
              maxLength={120}
              onChangeText={(title) => setEditing({ ...editing, title })}
            />
            {subjects && bindings.enabled
              ? (
                <SubjectMatch
                  title={editing.title}
                  childId={subjects.childId}
                  grade={subjects.grade}
                  binding={bindingFor(bindings.map, editing.title)}
                  onBind={(b) => bindings.bind(editing.title, b)}
                />
              )
              : null}
            <ScrollView horizontal>
              <View style={u.row}>
                {["math", "turkish", "science", "english", "music", "art"].map(
                  (k) => (
                    <Tag
                      key={k}
                      label={t("planner.subject_" + k)}
                      onPress={() =>
                        setEditing({
                          ...editing,
                          title: t("planner.subject_" + k),
                        })}
                    />
                  ),
                )}
              </View>
            </ScrollView>
            <View style={[u.row, { flexWrap: "wrap" }]}>
              {days.map((d) => (
                <Tag
                  key={d}
                  selected={editing.day === d}
                  label={t("weekday." + d)}
                  onPress={() => setEditing({ ...editing, day: d })}
                />
              ))}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
              <TimeChoice
                label={t("calendar.start")}
                value={editing.start ?? ""}
                onChange={(start) => setEditing({ ...editing, start })}
              />
              <TimeChoice
                label={t("calendar.end")}
                value={editing.end ?? ""}
                onChange={(end) => setEditing({ ...editing, end })}
              />
            </View>
            <Tag
              label={t("weekReview.shiftLater")}
              selected={shift}
              onPress={() => setShift(!shift)}
            />
            {allowExclude
              ? (
                <Tag
                  label={t(
                    editing.included === false
                      ? "weekReview.excluded"
                      : "import.includeLesson",
                  )}
                  selected={editing.included !== false}
                  onPress={() =>
                    setEditing({
                      ...editing,
                      included: editing.included === false,
                    })}
                />
              )
              : null}
            {error
              ? <Text accessibilityRole="alert" style={u.error}>{error}</Text>
              : null}
            <SatinButton
              title={t("planner.keepLesson")}
              onPress={() => {
                if (
                  !editing.title.trim() ||
                  ((editing.start || editing.end) &&
                    (!isClock(editing.start) || !isClock(editing.end) ||
                      editing.end <= editing.start))
                ) {
                  setError(t("planner.invalid"));
                  return;
                }
                try {
                  commit(
                    editTimetableCell(rows, {
                      ...editing,
                      title: editing.title.trim(),
                    }, shift),
                  );
                  setEditing(null);
                } catch {
                  setError(t("planner.dayFull"));
                }
              }}
            />
            {!allowExclude
              ? (
                <SatinButton
                  secondary
                  title={t("planner.removeLesson")}
                  onPress={() => {
                    commit(rows.filter((r) => r.id !== editing.id));
                    setEditing(null);
                  }}
                />
              )
              : null}
            {gap !== null && gap >= 0 && gap <= 180
              ? (
                <View
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: p.line,
                    paddingTop: 14,
                    gap: 10,
                  }}
                >
                  <NumberChoice
                    label={t("weekReview.breakAfter")}
                    value={gap}
                    min={0}
                    max={180}
                    presets={[5, 10, 15, 20, 40, 60]}
                    unit={t("weekReview.minute")}
                    onChange={(minutes) => {
                      try {
                        commit(changeTimetableBreak(rows, editing.id, minutes));
                      } catch {
                        setError(t("planner.dayFull"));
                      }
                    }}
                  />
                  <Text style={u.small}>{t("weekReview.breakHelp")}</Text>
                </View>
              )
              : null}
          </View>
        )
        : null}
      {moving
        ? (
          <View
            style={[u.row, {
              backgroundColor: p.mint,
              padding: 12,
              borderRadius: 14,
            }]}
          >
            <Text style={[u.bold, { flex: 1 }]}>
              {t("u05.chooseTargetEmpty")}
            </Text>
            <IconButton
              label={t("common.cancel")}
              onPress={() => setMoving(null)}
            >
              <X color={p.ink} />
            </IconButton>
          </View>
        )
        : null}
      {subjects
        ? <DeviceBindingImport bindings={bindings} titles={rows.map((r) => r.title)} />
        : null}
      {subjects && bindings.error
        ? (
          <Text accessibilityRole="alert" style={[u.small, { color: "#B42318" }]}>
            {t(String((bindings.error as Error).message).includes("subject_link_changed") ? "c02.linkConflict" : "c02.linkError")}
          </Text>
        )
        : null}
      {missing && !bells
        ? (
          <View
            style={[u.row, {
              flexWrap: "wrap",
              gap: 10,
              padding: 12,
              borderRadius: 16,
              backgroundColor: "#FFF0DB",
            }]}
          >
            <AlertCircle size={20} color="#955623" />
            <Text style={[u.small, { flex: 1, minWidth: 200, color: "#6E3F17" }]}>
              {t("u05.missingTimes", { count: missing })}
            </Text>
            <Tag
              label={t("u05.openBells")}
              disabled={disabled}
              onPress={() => {
                setBells(true);
                setEditing(null);
              }}
            />
          </View>
        )
        : null}
      {mode === "week" && width < 900
        ? <Text style={u.small}>{t("weekReview.swipeWeek")}</Text>
        : null}
      <View ref={hFrame} testID="tt-frame">
      <ScrollView
        ref={hScroll}
        horizontal
        scrollEnabled={!dragging}
        showsHorizontalScrollIndicator={mode === "week"}
        scrollEventThrottle={16}
        onScroll={(e) => {
          offset.current = { ...offset.current, x: e.nativeEvent.contentOffset.x };
        }}
        onLayout={(e) => {
          size.current.w = e.nativeEvent.layout.width;
        }}
        onContentSizeChange={(w) => {
          size.current.cw = w;
        }}
      >
        <View
          style={{
            borderWidth: 1,
            borderColor: p.line,
            borderRadius: 20,
            overflow: "hidden",
            backgroundColor: "#fff",
          }}
        >
          <WeekViewport
            week={mode === "week"}
            height={height}
            dragging={!!dragging}
            scrollRef={vScroll}
            onOffset={(y) => {
              offset.current = { ...offset.current, y };
            }}
            onSize={(viewport, content) => {
              if (viewport !== null) size.current.h = viewport;
              if (content !== null) size.current.ch = content;
            }}
          >
            <View style={{ flexDirection: "row", backgroundColor: p.lilac }}>
              <View style={{ width: 48 }} />
              {visible.map((d) => (
                <View
                  key={d}
                  style={{
                    width: widthCell,
                    padding: 14,
                    borderLeftWidth: 1,
                    borderColor: "#E1D8F1",
                  }}
                >
                  <Text style={u.bold}>{t("planner.day" + d)}</Text>
                </View>
              ))}
            </View>
            {Array.from(
              { length: count },
              (_, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: "row",
                    borderTopWidth: 1,
                    borderColor: p.line,
                  }}
                >
                  <View
                    style={{
                      width: 48,
                      paddingTop: 18,
                      alignItems: "center",
                      backgroundColor: p.cream,
                    }}
                  >
                    <Text style={u.bold}>{i + 1}</Text>
                  </View>
                  {visible.map((d) => {
                    const row = timetableDay(rows, d)[i];
                    const cellId = row?.id ?? emptyCellId(d, i);
                    const doubts = row ? cellDoubts(row) : [];
                    const named = doubts.filter((x) => x !== "time");
                    const bound = row && subjects
                      ? bindingFor(bindings.map, row.title)
                      : null;
                    const catalogLabel = bound
                      ? (i18n.language.startsWith("en")
                        ? bound.label_en
                        : bound.label_tr)
                      : null;
                    const movingRow = moving
                      ? rows.find((r) => r.id === moving)
                      : undefined;
                    return (
                      <View
                        key={d}
                        testID={"tt-cell-" + cellId}
                        ref={(node) => {
                          if (node) nodes.current.set(cellId, node);
                          else nodes.current.delete(cellId);
                        }}
                        style={{
                          width: widthCell,
                          minHeight: 72,
                          borderLeftWidth: 1,
                          borderColor: p.line,
                          padding: 8,
                          backgroundColor: hover === cellId
                            ? p.mint
                            : row?.included === false
                            ? "#F2F0F2"
                            : "#fff",
                        }}
                      >
                        {row
                          ? (
                            <>
                              <Pressable
                                disabled={disabled}
                                accessibilityRole="button"
                                accessibilityLabel={`${t("planner.day" + d)}, ${
                                  i + 1
                                }, ${row.title}, ${
                                  row.start ?? t("weekReview.noTime")
                                }${
                                  named.length
                                    ? ", " + t("u05.doubtLabel", {
                                      reasons: named.map((x) =>
                                        t("u05.doubt" + x[0].toUpperCase() + x.slice(1))
                                      ).join(", "),
                                    })
                                    : ""
                                }`}
                                onLongPress={() => {
                                  if (row.included !== false) {
                                    setMoving(row.id);
                                    setArrange(true);
                                  }
                                }}
                                onPress={() => open(row)}
                                style={{
                                  gap: 6,
                                  minHeight: 48,
                                  padding: 4,
                                  opacity: row.included === false ? .5 : 1,
                                }}
                              >
                                <Text
                                  style={[u.bold, {
                                    fontSize: 16,
                                    color: dragging === row.id
                                      ? p.purple
                                      : p.ink,
                                  }]}
                                >
                                  {catalogLabel ?? row.title}
                                </Text>
                                <Text
                                  style={[u.small, {
                                    fontSize: 13,
                                    color: !row.start || !row.end
                                      ? "#955623"
                                      : p.muted,
                                  }]}
                                >
                                  {row.start && row.end
                                    ? `${row.start}–${row.end}`
                                    : t("weekReview.noTime")}
                                </Text>
                                {catalogLabel
                                  ? (
                                    <Text style={[u.small, { fontSize: 12 }]}>
                                      {subjectDisplay({ title: row.title, subject_label_tr: catalogLabel }).original
                                        ? t("c02.originalText", { text: row.title })
                                        : t("u05.catalogBound", { label: catalogLabel })}
                                    </Text>
                                  )
                                  : null}
                                {named.length
                                  ? (
                                    <View
                                      style={[u.row, {
                                        gap: 4,
                                        alignSelf: "flex-start",
                                        paddingHorizontal: 8,
                                        paddingVertical: 2,
                                        borderRadius: 10,
                                        backgroundColor: "#FFF0DB",
                                      }]}
                                    >
                                      <AlertCircle size={13} color="#955623" />
                                      <Text
                                        style={[u.small, {
                                          fontSize: 12,
                                          color: "#6E3F17",
                                        }]}
                                      >
                                        {t("u05.doubt")} · {named.map((x) =>
                                          t("u05.doubt" + x[0].toUpperCase() + x.slice(1))
                                        ).join(", ")}
                                      </Text>
                                    </View>
                                  )
                                  : null}
                              </Pressable>
                              {arrange
                                ? (
                                  <View
                                    style={{
                                      flexDirection: "row",
                                      justifyContent: "space-between",
                                    }}
                                  >
                                    <Pressable
                                      disabled={disabled ||
                                        row.included === false}
                                      accessibilityRole="button"
                                      accessibilityLabel={t(
                                        "weekReview.moveLesson",
                                        {
                                          title: row.title,
                                        },
                                      )}
                                      onPress={() =>
                                        setMoving(
                                          moving === row.id ? null : row.id,
                                        )}
                                      style={{
                                        minWidth: 48,
                                        minHeight: 48,
                                        justifyContent: "center",
                                        alignItems: "center",
                                      }}
                                    >
                                      <ArrowDownUp size={19} color={p.purple} />
                                    </Pressable>
                                    <DragHandle
                                      testID={"tt-handle-" + row.id}
                                      disabled={disabled ||
                                        row.included === false}
                                      onStart={() => {
                                        rects.current.clear();
                                        for (
                                          const [id, node] of nodes.current
                                        ) {
                                          node.measureInWindow((x, y, w, h) =>
                                            rects.current.set(id, {
                                              x,
                                              y,
                                              w,
                                              h,
                                            })
                                          );
                                        }
                                        startOffset.current = { ...offset.current };
                                        hFrame.current?.measureInWindow((x, y, w, h) => {
                                          const frame = { x, y, w, h };
                                          frames.current = {
                                            h: frame,
                                            v: mode === "week" ? frame : null,
                                          };
                                        });
                                        if (ticker.current) clearInterval(ticker.current);
                                        ticker.current = setInterval(autoScroll, 50);
                                        setDragging(row.id);
                                        setMoving(null);
                                        onDragChange?.(true);
                                      }}
                                      onMove={(x, y) => {
                                        pointer.current = { x, y };
                                        setHover(hit(x, y) ?? null);
                                      }}
                                      onEnd={(x, y) => {
                                        const target = hit(x, y);
                                        finishDrag();
                                        if (target) exchange(row.id, target);
                                      }}
                                      onCancel={finishDrag}
                                    />
                                  </View>
                                )
                                : null}
                            </>
                          )
                          : movingRow && !disabled
                          ? (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={t("u05.moveHereLabel", {
                                title: movingRow.title,
                                day: t("planner.day" + d),
                                n: i + 1,
                              })}
                              onPress={() => moveTo(movingRow.id, d, i)}
                              style={{
                                minHeight: 56,
                                borderRadius: 14,
                                borderWidth: 1.5,
                                borderStyle: "dashed",
                                borderColor: p.purple,
                                alignItems: "center",
                                justifyContent: "center",
                                padding: 8,
                              }}
                            >
                              <Text style={[u.bold, { color: p.purple }]}>
                                {t("u05.moveHere")}
                              </Text>
                            </Pressable>
                          )
                          : (
                            <Text style={[u.small, { padding: 12 }]}>
                              {t("weekReview.emptySlot")}
                            </Text>
                          )}
                      </View>
                    );
                  })}
                </View>
              ),
            )}
          </WeekViewport>
        </View>
      </ScrollView>
      </View>
      {rows.filter((r) => !r.day).map((row) => (
        <SatinButton
          key={row.id}
          secondary
          title={t("weekReview.assignDay", { title: row.title })}
          onPress={() => open(row)}
        />
      ))}
      {onAdd
        ? (
          <SatinButton
            secondary
            disabled={disabled}
            title={t("planner.addLesson")}
            onPress={() => onAdd(day)}
          />
        )
        : null}
      {notice
        ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[u.small, { color: "#197465" }]}
          >
            {notice}
          </Text>
        )
        : null}
      {error
        ? <Text accessibilityRole="alert" style={u.error}>{error}</Text>
        : null}
    </View>
  );
}
