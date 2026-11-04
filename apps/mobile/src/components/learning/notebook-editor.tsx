import { SafeAreaView } from "react-native-safe-area-context";
import { NOTEBOOK_MODAL_PROPS, notebookRevealOffset } from "./notebook-layout";
import { useRouteMotion } from "@/lib/use-route-motion";
import { type ComponentRef, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  type GestureResponderEvent,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { randomUUID } from "expo-crypto";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Eraser,
  Hand,
  Minus,
  MoreHorizontal,
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
  underlay,
  annotation = false,
  showInk = true,
}: {
  document: NotebookDocument;
  onChange: (doc: NotebookDocument) => void;
  disabled?: boolean;
  insertion?: NotebookInsertion | null;
  onInserted?: () => void;
  underlay?: NotebookDocument;
  annotation?: boolean;
  showInk?: boolean;
}) {
  const { t } = useTranslation();
  const { animation } = useRouteMotion();
  const { width: screenWidth } = useWindowDimensions();

  const [optionsOpen, setOptionsOpen] = useState(false);
  const [penOptions, setPenOptions] = useState(false);
  const [penSize, setPenSize] = useState(4);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState<typeof NOTEBOOK_COLORS[number]>(
    annotation ? NOTEBOOK_COLORS[2] : NOTEBOOK_COLORS[0],
  );
  const [viewportWidth, setViewportWidth] = useState(320);
  const [viewportHeight, setViewportHeight] = useState(0);
  const verticalScroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const horizontalScroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const scrollOffset = useRef({ x: 0, y: 0 });
  const [visibleY, setVisibleY] = useState(0);
  const [revealId, setRevealId] = useState<string | null>(null);
  const roomy = viewportWidth >= 600;
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
  useLayoutEffect(() => { current.current = document; }, [document]);
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
  const maxScrollY = Math.max(0, width * 1.4 - viewportHeight);
  const canPageUp = visibleY > 2;
  const canPageDown = visibleY < maxScrollY - 2;
  function pageBy(direction: -1 | 1) {
    finish();
    setRevealId(null);
    const y = Math.max(0, Math.min(maxScrollY,
      scrollOffset.current.y + direction * viewportHeight * .8));
    verticalScroll.current?.scrollTo({ y, animated: false });
    scrollOffset.current.y = y;
    setVisibleY(y);
  }
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
      setRevealId(insertion.id);
    } else setMessage(t("notebook.full"));
    onInserted?.();
  }, [insertion, disabled, onChange, onInserted, t]);
  useEffect(() => {
    if (!revealId || viewportHeight <= 0 || textEditor || optionsOpen) return;
    const element = document.elements.find((item) => item.id === revealId);
    if (!element) return;
    const bounds = elementBounds(element);
    const pending = requestAnimationFrame(() => {
      if (gesture.current) return;
      const x = notebookRevealOffset(
        bounds.x * scale, bounds.width * scale, viewportWidth,
        width, scrollOffset.current.x,
      );
      const y = notebookRevealOffset(
        bounds.y * scale, bounds.height * scale, viewportHeight,
        width * 1.4, scrollOffset.current.y,
      );
      horizontalScroll.current?.scrollTo({ x, animated: false });
      verticalScroll.current?.scrollTo({ y, animated: false });
      scrollOffset.current = { x, y };
      // Keep the target through the selection toolbar's next layout pass.
      // A new pen/selection gesture or manual scroll ends this reveal intent.
    });
    return () => cancelAnimationFrame(pending);
  }, [
    revealId, document, viewportHeight, viewportWidth,
    width, scale, textEditor, optionsOpen,
  ]);
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
          size: penSize,
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
    setRevealId(next.id);
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
        }] as const).filter(({ key }) => roomy || key !== "select").map(({ key, Icon }) => (
          <ToolButton
            key={key}
            label={t(`notebook.${key}`)}
            active={tool === key}
            disabled={disabled}
            onPress={() => {
              finish();
              setRevealId(null);
              setPenOptions(
                key === "pen" && tool === "pen" ? !penOptions : false,
              );
              setTool(key);
              if (key !== "select") setSelected([]);
            }}
          >
            <Icon size={22} color={tool === key ? "#fff" : p.ink} />
          </ToolButton>
        ))}
        <ToolButton
          label={t(annotation ? "parentReview.note" : "notebook.text")}
          disabled={disabled}
          onPress={() =>
            setTextEditor({
              text: selectedText?.type === "text" ? selectedText.text : "",
              id: selectedText?.id,
            })}
        >
          <Type size={22} color={p.ink} />
          {(roomy || screenWidth >= 320) && (
            <Text style={s.toolLabel}>
              {t(annotation ? "parentReview.note" : "notebook.textShort")}
            </Text>
          )}
        </ToolButton>
        {!annotation && screenWidth >= 360 && (
          <>
            <ToolButton
              label={t("notebook.symbols")}
              disabled={disabled}
              onPress={() => setTextEditor({ text: "" })}
            >
              <Sigma size={22} color={p.ink} />
              {(roomy || screenWidth >= 360) && (
                <Text style={s.toolLabel}>{t("notebook.symbolsShort")}</Text>
              )}
            </ToolButton>
          </>
        )}
        <View style={{ flex: 1 }} />
        {roomy && (
          <>
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
          </>
        )}
        {annotation && roomy && [2, 1].map(i => <Pressable key={i} accessibilityRole="button" accessibilityLabel={t(`notebook.color${i}`)} accessibilityState={{ selected: color === NOTEBOOK_COLORS[i], disabled }} disabled={disabled} style={s.colorTouch} onPress={() => { finish(); setColor(NOTEBOOK_COLORS[i]); setTool("pen"); }}><View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: NOTEBOOK_COLORS[i], borderWidth: color === NOTEBOOK_COLORS[i] ? 3 : 0, borderColor: "#fff", outlineWidth: color === NOTEBOOK_COLORS[i] ? 1 : 0, outlineColor: p.purple }}/></Pressable>)}
        <ToolButton
          label={t("notebook.moreTools")}
          onPress={() => setOptionsOpen(true)}
        >
          <MoreHorizontal size={22} color={p.ink} />
        </ToolButton>
      </View>
      {(penOptions || selected.length > 0) && (
        <View style={s.options}>
          {penOptions && tool === "pen"
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
                <ToolButton
                  label={t("notebook.thickness", { size: penSize })}
                  onPress={() =>
                    setPenSize((v) => v === 8 ? 2 : v === 2 ? 4 : 8)}
                >
                  <View
                    style={{
                      width: 22,
                      height: penSize,
                      borderRadius: 4,
                      backgroundColor: color,
                    }}
                  />
                </ToolButton>
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
              shown.elements.find((e) => e.id === selected[0])?.type !==
                "stroke"
            ? (
              <>
                <ToolButton
                  label={t("notebook.smaller")}
                  disabled={disabled ||
                    !resizeNotebookItem(document, selected[0]!, 0.85)}
                  onPress={() => {
                    const next = resizeNotebookItem(
                      document,
                      selected[0]!,
                      0.85,
                    );
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
                    const next = resizeNotebookItem(
                      document,
                      selected[0]!,
                      1.15,
                    );
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
        </View>
      )}
      {!!message && (
        <Text style={s.hint} accessibilityLiveRegion="polite">{message}</Text>
      )}
      <Modal
        {...NOTEBOOK_MODAL_PROPS}
        visible={optionsOpen || !!textEditor}
        transparent
        animationType={animation}
        onRequestClose={() => {
          setOptionsOpen(false);
          setTextEditor(null);
        }}
      >
        <KeyboardAvoidingView
          style={s.scrim}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <SafeAreaView style={s.modalViewport}>
              {textEditor
                ? (
                  <View style={[s.modal, s.textModal]}>
                    <View style={s.modalHeading}>
                      <Text style={s.title}>{t("notebook.addText")}</Text>
                      <ToolButton
                        label={t("common.cancel")}
                        onPress={() => setTextEditor(null)}
                      >
                        <X size={24} color={p.ink} />
                      </ToolButton>
                    </View>
                    <ScrollView
                      style={s.textScroll}
                      contentContainerStyle={s.textContent}
                      keyboardShouldPersistTaps="handled"
                      keyboardDismissMode="none"
                    >
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
                          accessibilityLabel={t("notebook.insertSymbol", {
                            symbol,
                          })}
                          onPress={() =>
                            setTextEditor((v) =>
                              v
                                ? {
                                  ...v,
                                  text: (v.text + symbol).slice(0, 200),
                                }
                                : v
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
                    </ScrollView>
                    <SatinButton
                      title={t("notebook.addToPage")}
                      disabled={!textEditor?.text.trim()}
                      onPress={saveText}
                      icon={<Check size={21} color="#fff" />}
                    />
                  </View>
                )
                : (
                  <ScrollView
                    style={{ width: "100%" }}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={s.modalScroll}
                  >
                  <View style={s.modal}>
                    <View style={s.modalHeading}>
                      <Text style={s.title}>{t("notebook.moreTools")}</Text>
                      <ToolButton
                        label={t("notebook.close")}
                        onPress={() => setOptionsOpen(false)}
                      >
                        <X size={22} color={p.ink} />
                      </ToolButton>
                    </View>
                    <View style={[s.options, { flexWrap: "wrap" }]}>
                      <ToolButton label={t("notebook.select")} active={tool === "select"} disabled={disabled} onPress={() => { finish(); setTool("select"); setPenOptions(false); setOptionsOpen(false); }}><Scan size={22} color={tool === "select" ? "#fff" : p.ink}/><Text style={[s.toolLabel, tool === "select" && { color: "#fff" }]}>{t("notebook.select")}</Text></ToolButton>
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

                      <ToolButton
                        label={t("notebook.hand")}
                        active={tool === "hand"}
                        onPress={() => {
                          finish();
                          setTool("hand");
                          setOptionsOpen(false);
                        }}
                      >
                        <Hand
                          size={22}
                          color={tool === "hand" ? "#fff" : p.ink}
                        />
                      </ToolButton>
                      <ToolButton
                        label={t("notebook.zoom", { percent: zoom * 100 })}
                        onPress={() => {
                          finish();
                          setZoom((z) => z === 2 ? 1 : z + .5);
                          setTool("hand");
                          setOptionsOpen(false);
                        }}
                      >
                        <ZoomIn size={22} color={p.purple} />
                        <Text style={s.toolLabel}>{zoom * 100}%</Text>
                      </ToolButton>
                    </View>
                    <ToolButton
                      label={t("notebook.symbols")}
                      disabled={disabled}
                      onPress={() => {
                        setOptionsOpen(false);
                        setTextEditor({ text: "" });
                      }}
                    >
                      <Sigma size={22} color={p.ink} />
                      <Text style={s.toolLabel}>
                        {t("notebook.symbolsShort")}
                      </Text>
                    </ToolButton>
                    <Text style={s.hint}>{t(`notebook.hint.${tool}`)}</Text>
                  </View>
                  </ScrollView>
                )}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
      <View
        onLayout={(e) => {
          setViewportWidth(e.nativeEvent.layout.width);
        }}
        style={{
          flex: 1,
          minHeight: 0,
          borderRadius: 18,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: p.line,
        }}
      >
        <ScrollView
          ref={verticalScroll}
          onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
          onScrollBeginDrag={() => setRevealId(null)}
          onScroll={(e) => {
            scrollOffset.current.y = e.nativeEvent.contentOffset.y;
            setVisibleY(e.nativeEvent.contentOffset.y);
          }}
          scrollEventThrottle={16}
          nestedScrollEnabled
          scrollEnabled={tool === "hand" || disabled}
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1, minHeight: 0 }}
        >
          <ScrollView
            ref={horizontalScroll}
            onScrollBeginDrag={() => setRevealId(null)}
            onScroll={(e) => {
              scrollOffset.current.x = e.nativeEvent.contentOffset.x;
            }}
            scrollEventThrottle={16}
            horizontal
            nestedScrollEnabled
            scrollEnabled={tool === "hand" || disabled}
            contentContainerStyle={{ width, height: width * 1.4 }}
          >
            <View
              accessibilityLabel={t("notebook.page")}
              style={{ width, height: width * 1.4 }}
              onStartShouldSetResponder={(e) => !disabled && tool !== "hand" &&
                e.nativeEvent.touches.length <= 1}
              onMoveShouldSetResponder={() => !disabled && tool !== "hand"}
              onResponderTerminationRequest={() => false}
              onResponderGrant={(e) => {
                setRevealId(null);
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
              {underlay
                ? (
                  <View style={StyleSheet.absoluteFill}>
                    <NotebookPage document={underlay} width={width} />
                  </View>
                )
                : null}
              <NotebookPage
                document={showInk ? shown : { ...shown, elements: [] }}
                width={width}
                grid={!underlay}
                transparent={!!underlay}
              />
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
                      strokeWidth={penSize}
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
      {viewportHeight > 0 && maxScrollY > 2 && (
        <View style={s.pageNavigation}>
          <ToolButton label={t("notebook.pageUp")} disabled={!canPageUp}
            onPress={() => pageBy(-1)}>
            <ChevronUp size={22} color={p.purple} />
          </ToolButton>
          <Text style={s.pageNavigationText}>
            {t(canPageDown ? "notebook.moreBelow" : "notebook.pageEnd")}
          </Text>
          <ToolButton label={t("notebook.pageDown")} disabled={!canPageDown}
            onPress={() => pageBy(1)}>
            <ChevronDown size={22} color={p.purple} />
          </ToolButton>
        </View>
      )}
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
        backgroundColor: active ? p.purple : "transparent",
        opacity: disabled ? .35 : 1,
      }]}
    >
      {children}
    </Pressable>
  );
}
const s = StyleSheet.create({
  pageNavigation: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pageNavigationText: {
    flex: 1,
    textAlign: "center",
    fontFamily: "Nunito_600SemiBold",
    fontSize: 14,
    color: p.muted,
  },
  toolbar: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    borderRadius: 22,
    marginBottom: 12,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderColor: p.line,
    backgroundColor: p.lilac,
  },
  toolLabel: { fontFamily: "Nunito_700Bold", fontSize: 14, color: p.ink },
  tool: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 8,
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
  modalViewport: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  textModal: { maxHeight: "100%", flexShrink: 1 },
  textScroll: { flexShrink: 1 },
  textContent: { gap: 16 },
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
  title: { flexShrink: 1, fontFamily: "Nunito_700Bold", fontSize: 22, color: p.ink },
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
