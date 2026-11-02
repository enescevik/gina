import { useRouteMotion } from "@/lib/use-route-motion";
import { useEffect, useRef, useState } from "react";
import {
  type GestureResponderEvent,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { randomUUID } from "expo-crypto";
import {
  Check,
  Eraser,
  Hand,
  Minus,
  Pencil,
  Plus,
  Redo2,
  Scan,
  Sigma,
  Trash2,
  Type,
  Undo2,
  X,
  ZoomIn,
} from "lucide-react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { useTranslation } from "react-i18next";
import {
  elementBounds,
  insertNotebookElement,
  moveElements,
  NOTEBOOK_COLORS,
  type NotebookDocument,
  type NotebookElement,
  type NotebookPoint,
  notebookSchema,
  resizeNotebookItem,
  strokeNear,
  strokePath,
} from "@gina/core";
import { Pressable } from "@/components/ui/pressable";
import { p, SatinButton } from "@/components/planner/ui";
import { NotebookPage } from "./notebook-page";

export type NotebookInsertion = Extract<
  NotebookElement,
  { type: "source" | "text" }
>;
const symbols = [
  "+",
  "−",
  "×",
  "÷",
  "=",
  "≠",
  "≈",
  "<",
  ">",
  "≤",
  "≥",
  "°",
  "∠",
  "∥",
  "⊥",
  "√",
  "π",
  "²",
  "³",
  "½",
  "¼",
  "|AB|",
  "→",
  "Δ",
];
type Tool = "pen" | "eraser" | "select" | "hand";
export function NotebookEditor({
  document,
  onChange,
  disabled = false,
  insertion,
  onInserted,
}: {
  document: NotebookDocument;
  onChange: (doc: NotebookDocument) => void;
  disabled?: boolean;
  insertion?: NotebookInsertion | null;
  onInserted?: () => void;
}) {
  const { t } = useTranslation();
  const { animation } = useRouteMotion();
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState<typeof NOTEBOOK_COLORS[number]>(
    NOTEBOOK_COLORS[0],
  );
  const [viewportWidth, setViewportWidth] = useState(320);
  const [zoom, setZoom] = useState(1);
  const width = viewportWidth * zoom;
  const [selected, setSelected] = useState<string[]>([]);
  const [live, setLive] = useState<NotebookPoint[]>([]);
  const [preview, setPreview] = useState<NotebookDocument | null>(null);
  const [selection, setSelection] = useState<
    { x: number; y: number; width: number; height: number } | null
  >(null);
  const [message, setMessage] = useState("");
  const [textEditor, setTextEditor] = useState<
    { id?: string; text: string } | null
  >(null);
  const [past, setPast] = useState<NotebookDocument[]>([]),
    [future, setFuture] = useState<NotebookDocument[]>([]);
  const current = useRef(document);
  current.current = document;
  const gesture = useRef<
    {
      start: NotebookPoint;
      points: NotebookPoint[];
      base: NotebookDocument;
      moving: boolean;
      erased: Set<string>;
      identifier: number;
    } | null
  >(null);
  const frame = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const consumed = useRef<string | null>(null);
  const scale = width / 1000;
  const commit = (next: NotebookDocument) => {
    if (disabled || JSON.stringify(next) === JSON.stringify(current.current)) {
      return;
    }
    if (!notebookSchema.safeParse(next).success) {
      setMessage(t("notebook.full"));
      return;
    }
    setPast((prev) => [...prev.slice(-24), current.current]);
    setFuture([]);
    setMessage("");
    onChange(next);
  };
  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);
  useEffect(() => {
    if (!insertion || consumed.current === insertion.id || disabled) return;
    consumed.current = insertion.id;
    const next = insertNotebookElement(current.current, insertion);
    if (next) {
      setPast((prev) => [...prev.slice(-24), current.current]);
      setFuture([]);
      onChange(next);
      setSelected([insertion.id]);
      setTool("select");
    } else setMessage(t("notebook.full"));
    onInserted?.();
  }, [insertion, disabled, onChange, onInserted, t]);
  function point(e: GestureResponderEvent): NotebookPoint {
    return [
      Math.round(
        Math.max(0, Math.min(1000, e.nativeEvent.locationX / scale)) * 10,
      ) / 10,
      Math.round(
        Math.max(0, Math.min(1400, e.nativeEvent.locationY / scale)) * 10,
      ) / 10,
    ];
  }
  function update(e: GestureResponderEvent) {
    const g = gesture.current;
    if (!g) return;
    if (e.nativeEvent.touches.length > 1) {
      finish();
      return;
    }
    const xy = point(e);
    if (tool === "pen") {
      const last = g.points.at(-1)!;
      if (Math.hypot(xy[0] - last[0], xy[1] - last[1]) < 1.2) return;
      if (g.points.length >= 2000) {
        finish();
        setMessage(t("notebook.strokeLimit"));
        return;
      }
      g.points.push(xy);
    } else if (tool === "eraser") {
      g.base.elements.forEach((el) => {
        if (strokeNear(el, xy, 14)) g.erased.add(el.id);
      });
    }
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (gesture.current !== g) return;
      if (tool === "pen") setLive([...g.points]);
      else if (tool === "eraser") {
        setPreview({
          ...g.base,
          elements: g.base.elements.filter((el) => !g.erased.has(el.id)),
        });
      } else if (tool === "select") {
        if (g.moving) {
          setPreview(
            moveElements(
              g.base,
              selected,
              xy[0] - g.start[0],
              xy[1] - g.start[1],
            ),
          );
        } else {setSelection({
            x: Math.min(xy[0], g.start[0]),
            y: Math.min(xy[1], g.start[1]),
            width: Math.abs(xy[0] - g.start[0]),
            height: Math.abs(xy[1] - g.start[1]),
          });}
      }
    });
  }
  function finish(e?: GestureResponderEvent) {
    const g = gesture.current;
    if (!g) return;
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    const end = e ? point(e) : g.points.at(-1)!;
    if (tool === "pen") {
      if (
        e && g.points.length < 2000 &&
        Math.hypot(end[0] - g.points.at(-1)![0], end[1] - g.points.at(-1)![1]) >
          0.5
      ) g.points.push(end);
      commit({
        ...g.base,
        elements: [...g.base.elements, {
          id: randomUUID(),
          type: "stroke",
          color,
          size: 4,
          points: g.points,
        }],
      });
    } else if (tool === "eraser") {
      commit({
        ...g.base,
        elements: g.base.elements.filter((el) => !g.erased.has(el.id)),
      });
    } else if (tool === "select") {
      if (g.moving) {
        commit(
          moveElements(
            g.base,
            selected,
            end[0] - g.start[0],
            end[1] - g.start[1],
          ),
        );
      } else {
        const x = Math.min(end[0], g.start[0]),
          y = Math.min(end[1], g.start[1]),
          w = Math.abs(end[0] - g.start[0]),
          h = Math.abs(end[1] - g.start[1]);
        setSelected(
          g.base.elements.filter((el) => {
            const b = elementBounds(el);
            return w < 8 && h < 8
              ? x >= b.x - 8 && x <= b.x + b.width + 8 && y >= b.y - 8 &&
                y <= b.y + b.height + 8
              : b.x >= x && b.y >= y && b.x + b.width <= x + w &&
                b.y + b.height <= y + h;
          }).map((el) => el.id),
        );
      }
    }
    gesture.current = null;
    setLive([]);
    setPreview(null);
    setSelection(null);
  }
  function saveText() {
    if (!textEditor?.text.trim()) return;
    const existing = document.elements.find((e) => e.id === textEditor.id);
    const text = textEditor.text.trim();
    const textHeight = Math.max(
      140,
      (text.split("\n").reduce(
        (n, line) => n + Math.max(1, Math.ceil(line.length / 26)),
        0,
      ) + 1) * 68,
    );
    if (textHeight > 1240) {
      setMessage(t("notebook.longText"));
      return;
    }
    const next: NotebookElement = {
      id: textEditor.id ?? randomUUID(),
      type: "text",
      x: existing && existing.type !== "stroke" ? existing.x : 90,
      y: existing && existing.type !== "stroke"
        ? Math.min(existing.y, 1400 - textHeight)
        : 80,
      width: 800,
      height: textHeight,
      size: 48,
      color,
      text,
    };
    const changed = existing
      ? {
        ...document,
        elements: document.elements.map((e) => e.id === next.id ? next : e),
      }
      : insertNotebookElement(document, next);
    if (!changed) {
      setMessage(t("notebook.full"));
      return;
    }
    commit(changed);
    setTextEditor(null);
    setSelected([next.id]);
    setTool("select");
  }
  const shown = preview ?? document;
  const selectedText = document.elements.find((e) =>
    selected.length === 1 && e.id === selected[0] && e.type === "text"
  );
  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <View style={s.toolbar}>
        {([{ key: "pen", Icon: Pencil }, { key: "eraser", Icon: Eraser }, {
          key: "select",
          Icon: Scan,
        }, { key: "hand", Icon: Hand }] as const).map(({ key, Icon }) => (
          <ToolButton
            key={key}
            label={t(`notebook.${key}`)}
            active={tool === key}
            disabled={disabled}
            onPress={() => {
              finish();
              setTool(key);
              if (key !== "select") setSelected([]);
            }}
          >
            <Icon size={22} color={tool === key ? p.purple : p.muted} />
          </ToolButton>
        ))}
        <ToolButton
          label={t("notebook.text")}
          disabled={disabled}
          onPress={() =>
            setTextEditor({
              text: selectedText?.type === "text" ? selectedText.text : "",
              id: selectedText?.id,
            })}
        >
          <Type size={22} color={p.muted} />
        </ToolButton>
        <ToolButton
          label={t("notebook.undo")}
          disabled={disabled || !past.length}
          onPress={() => {
            setFuture((f) => [document, ...f].slice(0, 25));
            onChange(past.at(-1)!);
            setPast((p) => p.slice(0, -1));
            setSelected([]);
          }}
        >
          <Undo2 size={22} color={p.muted} />
        </ToolButton>
        <ToolButton
          label={t("notebook.redo")}
          disabled={disabled || !future.length}
          onPress={() => {
            setPast((p) => [...p, document]);
            onChange(future[0]!);
            setFuture((f) => f.slice(1));
            setSelected([]);
          }}
        >
          <Redo2 size={22} color={p.muted} />
        </ToolButton>
      </View>
      <View style={s.options}>
        {tool === "pen"
          ? (
            <>
              {NOTEBOOK_COLORS.map((c, i) => (
                <Pressable
                  key={c}
                  accessibilityRole="button"
                  accessibilityLabel={t(`notebook.color${i}`)}
                  accessibilityState={{ selected: color === c, disabled }}
                  disabled={disabled}
                  onPress={() => setColor(c)}
                  style={s.colorTouch}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: c,
                      outlineWidth: color === c ? 2 : 0,
                      outlineColor: c,
                      outlineOffset: 3,
                    }}
                  />
                </Pressable>
              ))}
            </>
          )
          : (
            <Text
              style={{
                flex: 1,
                paddingLeft: 8,
                fontFamily: "Nunito_600SemiBold",
                color: p.muted,
              }}
            >
              {t(`notebook.${tool}`)}
            </Text>
          )}
        <View style={{ flex: 1 }} />
        {selected.length === 1 &&
            shown.elements.find((e) => e.id === selected[0])?.type !== "stroke"
          ? (
            <>
              <ToolButton
                label={t("notebook.smaller")}
                disabled={disabled ||
                  !resizeNotebookItem(document, selected[0]!, 0.85)}
                onPress={() => {
                  const next = resizeNotebookItem(document, selected[0]!, 0.85);
                  if (next) commit(next);
                }}
              >
                <Minus size={22} color={p.purple} />
              </ToolButton>
              <ToolButton
                label={t("notebook.larger")}
                disabled={disabled ||
                  !resizeNotebookItem(document, selected[0]!, 1.15)}
                onPress={() => {
                  const next = resizeNotebookItem(document, selected[0]!, 1.15);
                  if (next) commit(next);
                }}
              >
                <Plus size={22} color={p.purple} />
              </ToolButton>
            </>
          )
          : null}
        {selected.length > 0
          ? (
            <ToolButton
              label={t("notebook.deleteSelection")}
              disabled={disabled}
              onPress={() => {
                commit({
                  ...document,
                  elements: document.elements.filter((e) =>
                    !selected.includes(e.id)
                  ),
                });
                setSelected([]);
              }}
            >
              <Trash2 size={21} color="#BA5348" />
            </ToolButton>
          )
          : null}
        <ToolButton
          label={t("notebook.symbols")}
          disabled={disabled}
          onPress={() => setTextEditor({ text: "" })}
        >
          <Sigma size={22} color={p.purple} />
        </ToolButton>
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#FFF",
        }}
      >
        <Text style={[s.hint, { flex: 1 }]} accessibilityLiveRegion="polite">
          {message || t(`notebook.hint.${tool}`)}
        </Text>
        <ToolButton
          label={t("notebook.zoom", { percent: zoom * 100 })}
          onPress={() => {
            finish();
            setZoom((z) => z === 2 ? 1 : z + .5);
            setTool("hand");
          }}
        >
          <ZoomIn size={20} color={p.purple} />
          <Text style={{ fontSize: 11, color: p.muted }}>{zoom * 100}%</Text>
        </ToolButton>
      </View>
      <View
        onLayout={(e) => setViewportWidth(e.nativeEvent.layout.width)}
        style={{ flex: 1, minHeight: 0 }}
      >
        <ScrollView
          nestedScrollEnabled
          scrollEnabled={tool === "hand" || disabled}
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1, minHeight: 0 }}
        >
          <ScrollView
            horizontal
            nestedScrollEnabled
            scrollEnabled={tool === "hand" || disabled}
            contentContainerStyle={{ width, height: width * 1.4 }}
          >
            <View
              accessibilityLabel={t("notebook.page")}
              style={{ width, height: width * 1.4 }}
              onStartShouldSetResponder={(e) =>
                !disabled && tool !== "hand" &&
                e.nativeEvent.touches.length <= 1}
              onMoveShouldSetResponder={() => !disabled && tool !== "hand"}
              onResponderTerminationRequest={() => false}
              onResponderGrant={(e) => {
                const xy = point(e);
                const moving = selected.some((id) => {
                  const el = document.elements.find((el) => el.id === id);
                  if (!el) return false;
                  const b = elementBounds(el);
                  return xy[0] >= b.x - 12 && xy[0] <= b.x + b.width + 12 &&
                    xy[1] >= b.y - 12 && xy[1] <= b.y + b.height + 12;
                });
                gesture.current = {
                  start: xy,
                  points: [xy],
                  base: current.current,
                  moving,
                  erased: new Set(),
                  identifier: e.nativeEvent.identifier,
                };
                if (tool === "pen") setLive([xy]);
                if (tool === "eraser") update(e);
              }}
              onResponderMove={update}
              onResponderRelease={finish}
              onResponderTerminate={() => finish()}
            >
              <NotebookPage document={shown} width={width} />
              <Svg
                pointerEvents="none"
                width={width}
                height={width * 1.4}
                viewBox="0 0 1000 1400"
                style={StyleSheet.absoluteFill}
              >
                {live.length
                  ? (
                    <Path
                      d={strokePath(live)}
                      stroke={color}
                      strokeWidth={4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  )
                  : null}
                {shown.elements.filter((e) => selected.includes(e.id)).map(
                  (e) => {
                    const b = elementBounds(e);
                    return (
                      <Rect
                        key={e.id}
                        x={b.x - 6}
                        y={b.y - 6}
                        width={b.width + 12}
                        height={b.height + 12}
                        stroke={p.purple}
                        strokeWidth={2}
                        strokeDasharray="8 5"
                        fill="none"
                      />
                    );
                  },
                )}
                {selection
                  ? (
                    <Rect
                      {...selection}
                      stroke={p.purple}
                      strokeWidth={2}
                      fill="#6042DE15"
                    />
                  )
                  : null}
              </Svg>
            </View>
          </ScrollView>
        </ScrollView>
      </View>
      <Modal
        visible={!!textEditor}
        transparent
        animationType={animation}
        onRequestClose={() => setTextEditor(null)}
      >
        <View style={s.scrim}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.modalScroll}
          >
            <View style={s.modal}>
              <View style={s.modalHeading}>
                <Text style={s.title}>{t("notebook.addText")}</Text>
                <ToolButton
                  label={t("common.cancel")}
                  onPress={() => setTextEditor(null)}
                >
                  <X size={24} color={p.ink} />
                </ToolButton>
              </View>
              <TextInput
                autoFocus
                multiline
                maxLength={200}
                value={textEditor?.text ?? ""}
                onChangeText={(text) =>
                  setTextEditor((v) => v ? { ...v, text } : v)}
                accessibilityLabel={t("notebook.addText")}
                placeholder={t("notebook.textPlaceholder")}
                style={s.input}
              />
              <View style={s.symbols}>
                {symbols.map((symbol) => (
                  <Pressable
                    key={symbol}
                    accessibilityRole="button"
                    accessibilityLabel={t("notebook.insertSymbol", { symbol })}
                    onPress={() =>
                      setTextEditor((v) =>
                        v ? { ...v, text: (v.text + symbol).slice(0, 200) } : v
                      )}
                    style={s.symbol}
                  >
                    <Text style={s.symbolText}>{symbol}</Text>
                  </Pressable>
                ))}
              </View>
              {message
                ? (
                  <Text
                    accessibilityRole="alert"
                    style={{ color: "#BA5348", fontSize: 16 }}
                  >
                    {message}
                  </Text>
                )
                : null}
              <SatinButton
                title={t("notebook.addToPage")}
                disabled={!textEditor?.text.trim()}
                onPress={saveText}
                icon={<Check size={21} color="#fff" />}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
function ToolButton(
  { label, active, disabled, onPress, children }: {
    label: string;
    active?: boolean;
    disabled?: boolean;
    onPress: () => void;
    children: React.ReactNode;
  },
) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.tool, {
        backgroundColor: active ? p.lilac : "transparent",
        opacity: disabled ? .35 : 1,
      }]}
    >
      {children}
    </Pressable>
  );
}
const s = StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: p.line,
    backgroundColor: "#FFF",
  },
  tool: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  options: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    backgroundColor: "#FFF",
  },
  colorTouch: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: {
    fontFamily: "Nunito_400Regular",
    fontSize: 13,
    color: p.muted,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "#FFF",
  },
  scrim: { flex: 1, backgroundColor: "#20195180" },
  modalScroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modal: {
    width: "100%",
    maxWidth: 560,
    padding: 20,
    borderRadius: 26,
    backgroundColor: p.cream,
    gap: 16,
  },
  modalHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontFamily: "Nunito_700Bold", fontSize: 22, color: p.ink },
  input: {
    fontFamily: "Nunito_400Regular",
    fontSize: 22,
    color: p.ink,
    minHeight: 100,
    padding: 16,
    borderWidth: 1,
    borderColor: p.line,
    borderRadius: 16,
    backgroundColor: "#FFF",
    textAlignVertical: "top",
  },
  symbols: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  symbol: {
    minWidth: 48,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: p.lilac,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  symbolText: { fontSize: 22, color: p.ink },
});
