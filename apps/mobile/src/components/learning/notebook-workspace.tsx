import { notebookLayout } from "./notebook-layout";
import { SharedContext, useQuestionContext } from "./question-context";
import { randomUUID } from "expo-crypto";
import { notebookTokens } from "./notebook-tokens";
import { type ReactNode, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Coffee,
  Copy,
  Maximize2,
  Minimize2,
  Plus,
  Type,
} from "lucide-react-native";
import { emptyNotebook, type NotebookDocument } from "@gina/core";
import { Pressable } from "@/components/ui/pressable";
import { p } from "@/components/planner/ui";
import { QuestionMedia } from "./question-media";
import { NotebookEditor, type NotebookInsertion } from "./notebook-editor";
import { NotebookSourcePicker } from "./notebook-source-picker";

export function NotebookWorkspace({
  title,
  progress,
  questionId,
  stem,
  document,
  text,
  onChange,
  onTextChange,
  status,
  saved,
  disabled,
  onExit,
  footer,
  alerts,
}: {
  title: string;
  progress?: string;
  questionId: string;
  stem: string;
  document?: NotebookDocument;
  text: string;
  onChange: (d: NotebookDocument) => void;
  onTextChange: (text: string) => void;
  status: string;
  saved?: boolean;
  disabled: boolean;
  onExit: () => void;
  footer: ReactNode;
  alerts: ReactNode;
}) {
  const { t } = useTranslation();
  const { width, height, fontScale } = useWindowDimensions();
  const layout = notebookLayout(width, height, fontScale);
  const wide = layout === "side-by-side";
  const stacked = layout === "stacked";
  const tabbed = layout === "tabs";
  const [tab, setTab] = useState<"question" | "notebook">("question");
  const [expanded, setExpanded] = useState(false);
  const [questionExpanded, setQuestionExpanded] = useState(false);
  const questionFocused = stacked && questionExpanded;
  const compactSummary = stacked && !questionFocused && fontScale < 1.4;
  const [contextOpen, setContextOpen] = useState(true);
  const [answerOpen, setAnswerOpen] = useState(!!text);
  const shared = useQuestionContext(questionId);
  const prompt = shared.data?.prompt ?? stem;
  const tokens = notebookTokens(
    shared.data ? `${shared.data.body}\n${prompt}` : stem,
  );
  const [sourceOpen, setSourceOpen] = useState(false),
    [insertion, setInsertion] = useState<NotebookInsertion | null>(null);
  const [page] = useState(emptyNotebook);
  const encouragement = (
    <View style={s.encouragement}>
      <Image
        source={require(
          "../../../../../packages/assets/brand/growing-friend/reading.png",
        )}
        style={{ width: wide ? 150 : 135, height: wide ? 100 : 110 }}
        resizeMode="contain"
        accessible={false}
      />
      <View style={s.bubble}>
        <Text style={[s.soft, { color: p.ink }]}>
          {t("notebook.encouragement")}
        </Text>
      </View>
    </View>
  );
  const question = (
    <View style={s.fill}>
      <View style={s.sourceHeading}>
        <BookOpen size={22} color={p.purple} />
        <Text style={s.sectionTitle}>{t("notebook.question")}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("notebook.takeFromQuestion")}
          disabled={disabled}
          onPress={() => setSourceOpen(true)}
          style={[s.take, { marginLeft: "auto" }]}
        >
          <Copy size={20} color={p.purple} />
          {(wide || stacked) && <Text style={s.takeText}>{t("notebook.copyShort")}</Text>}
        </Pressable>
        {stacked && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(questionFocused ? "notebook.backToNotebook" : "notebook.fullQuestion")}
            accessibilityState={{ expanded: questionFocused }}
            onPress={() => setQuestionExpanded(!questionExpanded)}
            style={s.take}
          >
            {questionFocused ? <Minimize2 size={20} color={p.purple} /> : <Maximize2 size={20} color={p.purple} />}
            <Text style={s.takeText}>{t(questionFocused ? "notebook.backToNotebook" : "notebook.fullQuestion")}</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("notebook.keyboardAnswer")}
          accessibilityState={{ expanded: answerOpen }}
          onPress={() => setAnswerOpen(!answerOpen)}
          style={s.smallButton}
        >
          <Type size={21} color={p.purple} />
        </Pressable>
      </View>
      <ScrollView
        style={s.fill}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[s.questionContent, wide && { flexGrow: 1 }]}
      >
        {answerOpen && (
          <>
            <Text style={s.soft}>{t("notebook.answerTextHint")}</Text>
            <TextInput
              multiline
              accessibilityLabel={t("prova.answerLabel")}
              value={text}
              editable={!disabled}
              maxLength={20000}
              onChangeText={onTextChange}
              placeholder={t("prova.writeAnswer")}
              placeholderTextColor={p.muted}
              style={s.answer}
            />
          </>
        )}
        {shared.data ? <SharedContext context={shared.data} /> : null}
        <View style={compactSummary ? s.questionSummary : { gap: 10 }}>
          <QuestionMedia
            style={[s.diagram, compactSummary && s.summaryImage]}
            questionId={questionId}
            notebook
            maxImageHeight={compactSummary ? 120 : wide ? 160 : undefined}
          />
          <Text selectable style={[s.stem, compactSummary && { flex: 1 }]}>{prompt}</Text>
        </View>
        {tokens.length > 0 && (
          <View style={{ gap: 6 }}>
            <Text style={s.sectionTitle}>{t("notebook.givens")}</Text>
            <View style={[s.chips, wide && { flexDirection: "column", alignItems: "flex-start" }]}>
              {tokens.map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityLabel={t("notebook.addGiven", { value })}
                  disabled={disabled}
                  style={s.chip}
                  onPress={() => {
                    setInsertion({
                      id: randomUUID(),
                      type: "text",
                      text: value,
                      x: 90,
                      y: 120,
                      width: 700,
                      height: 100,
                      size: 48,
                      color: "#201951",
                    });
                    setQuestionExpanded(false);
                    setTab("notebook");
                  }}
                >
                  <Text style={s.takeText}>{value}</Text>
                  <Plus size={19} color={p.purple} />
                </Pressable>
              ))}
            </View>
          </View>
        )}
        {(tabbed || wide) && <View style={wide ? { marginTop: "auto" } : undefined}>{encouragement}</View>}
      </ScrollView>
    </View>
  );
  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView
        style={s.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={s.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("notebook.pause")}
            onPress={onExit}
            style={s.back}
          >
            <ArrowLeft color={p.purple} size={22} />
          </Pressable>
          <Image
            source={require(
              "../../../../../packages/assets/brand/growing-friend/logo.png",
            )}
            style={{ width: 100, height: 42 }}
            resizeMode="contain"
            accessible={false}
          />
          {wide && (
            <Text numberOfLines={1} accessibilityRole="header" style={s.title}>
              {title}
            </Text>
          )}
          <Text style={s.progress}>{progress ?? title}</Text>
          {wide && (
            <Pressable
              accessibilityRole="button"
              onPress={onExit}
              style={s.take}
            >
              <Coffee size={20} color={p.ink} />
              <Text style={s.takeText}>{t("notebook.pause")}</Text>
            </Pressable>
          )}
        </View>
        {tabbed
          ? (
            <View style={s.tabs}>
              {(["question", "notebook"] as const).map((key) => (
                <Pressable
                  key={key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === key }}
                  onPress={() => setTab(key)}
                  style={[s.tab, tab === key && { backgroundColor: p.purple }]}
                >
                  <Text style={[s.tabText, tab === key && { color: "#fff" }]}>
                    {t(`notebook.${key}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )
          : null}
        <View style={[s.body, { flexDirection: wide ? "row" : "column" }]}>
          {((wide || stacked) && !expanded) || (tabbed && tab === "question")
            ? (
              <View
                key="question"
                style={questionFocused
                  ? s.fill
                  : wide
                  ? s.questionRail
                  : stacked
                  ? s.questionStack
                  : s.fill}
              >
                {question}
              </View>
            )
            : null}
          <View
            key="notebook"
            style={[
              s.paperShell,
              questionFocused && { display: "none" },
              tabbed && tab !== "notebook" && { display: "none" },
            ]}
          >
            {tabbed && (
              <View style={s.context}>
                {contextOpen && (
                  <View style={{ width: 100 }}>
                    <QuestionMedia questionId={questionId} compact />
                  </View>
                )}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setTab("question")}
                  style={{
                    flex: 1,
                    minHeight: 48,
                    justifyContent: "center",
                    gap: 4,
                  }}
                >
                  {contextOpen && (
                    <Text numberOfLines={2} style={s.contextText}>
                      {shared.data ? shared.data.title : stem}
                    </Text>
                  )}
                  <Text style={s.takeText}>{t("notebook.showQuestion")}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t(
                    contextOpen
                      ? "notebook.hidePreview"
                      : "notebook.showPreview",
                  )}
                  accessibilityState={{ expanded: contextOpen }}
                  style={s.smallButton}
                  onPress={() => setContextOpen(!contextOpen)}
                >
                  {contextOpen
                    ? <ChevronUp size={19} color={p.ink} />
                    : <ChevronDown size={19} color={p.ink} />}
                </Pressable>
              </View>
            )}
            {(wide || stacked) && (
              <View style={s.paperHeading}>
                <Text style={s.sectionTitle}>{t("notebook.title")}</Text>
                <Text
                  accessibilityLiveRegion="polite"
                  style={[s.status, !saved && { backgroundColor: p.lilac }]}
                >
                  {status}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  style={s.take}
                  onPress={() => setExpanded(!expanded)}
                >
                  {expanded
                    ? <Minimize2 size={18} color={p.purple} />
                    : <Maximize2 size={18} color={p.purple} />}
                  <Text style={s.takeText}>
                    {t(expanded ? "notebook.restore" : "notebook.expand")}
                  </Text>
                </Pressable>
              </View>
            )}
            <NotebookEditor
              document={document ?? page}
              onChange={(next) => {
                setTab("notebook");
                onChange(next);
              }}
              disabled={disabled}
              insertion={insertion}
              onInserted={() => setInsertion(null)}
            />
          </View>
        </View>
        <View style={s.footer}>
          {tabbed && (
            <Text
              accessibilityLiveRegion="polite"
              style={[
                s.status,
                { flexShrink: 1 },
                !saved && { backgroundColor: p.lilac },
              ]}
            >
              {status}
            </Text>
          )}
          <View style={{ flex: 1, alignItems: "flex-end" }}>{footer}</View>
        </View>
        <View style={{ paddingHorizontal: 16 }}>{alerts}</View>
        <NotebookSourcePicker
          questionId={questionId}
          stem={stem}
          visible={sourceOpen}
          onClose={() => setSourceOpen(false)}
          onInsert={(e) => {
            setInsertion(e);
            setQuestionExpanded(false);
            setTab("notebook");
          }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: p.cream },
  fill: { flex: 1, minHeight: 0, minWidth: 0 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderColor: p.line,
  },
  back: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: p.lilac,
  },
  title: {
    fontFamily: "Nunito_700Bold",
    fontSize: 20,
    color: p.ink,
    flex: 1,
    textAlign: "left",
  },
  tabs: { flexDirection: "row", padding: 4, marginHorizontal: 16, marginTop: 8, gap: 4, borderRadius: 22, backgroundColor: p.lilac },
  tab: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: { fontFamily: "Nunito_700Bold", fontSize: 18, color: p.muted },
  body: {
    flex: 1,
    minHeight: 0,
    gap: 0,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  questionStack: {
    height: "34%",
    minHeight: 280,
    maxHeight: 360,
    marginBottom: 10,
  },
  questionRail: { width: "35%", maxWidth: 470, minWidth: 280, minHeight: 0 },
  questionContent: { padding: 12, gap: 10 },
  questionSummary: { flexDirection: "row", gap: 16, alignItems: "flex-start" },
  summaryImage: { width: "32%", maxWidth: 220 },
  sourceHeading: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
    backgroundColor: p.lilac,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  sectionTitle: { fontFamily: "Nunito_800ExtraBold", fontSize: 22, color: p.ink },
  stem: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 21,
    lineHeight: 28,
    color: p.ink,
  },
  take: {
    minHeight: 48,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: p.lilac,
  },
  takeText: { fontFamily: "Nunito_700Bold", fontSize: 14, color: p.purple },
  encouragement: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 0,
    paddingHorizontal: 12,
  },
  soft: {
    fontFamily: "Nunito_400Regular",
    fontSize: 15,
    lineHeight: 22,
    color: p.muted,
    flexShrink: 1,
  },
  answer: {
    minHeight: 110,
    fontFamily: "Nunito_400Regular",
    fontSize: 18,
    lineHeight: 26,
    color: p.ink,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: p.line,
    borderRadius: 18,
    padding: 16,
    textAlignVertical: "top",
  },
  paperShell: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    borderWidth: 1,
    borderColor: "#E5DDED",
    borderRadius: 24,
    padding: 12,
    backgroundColor: p.cream,
    overflow: "hidden",
    boxShadow: "0 3px 14px #20195108",
  },
  paperHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingBottom: 10,
    gap: 8,
    borderColor: p.line,
  },
  context: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F4F0FA",
    borderRadius: 18,
    marginBottom: 10,
  },
  contextText: {
    flex: 1,
    fontFamily: "Nunito_400Regular",
    fontSize: 13,
    color: p.muted,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 10,
    paddingTop: 8,
    gap: 6,
    borderTopWidth: 1,
    borderColor: p.line,
    backgroundColor: p.cream,
  },
  status: {
    fontFamily: "Nunito_700Bold",
    fontSize: 12,
    color: p.muted,
    backgroundColor: "#E5F5EB",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  diagram: {
    borderWidth: 1,
    borderColor: "#DBCCF4",
    borderRadius: 20,
    padding: 10,
    gap: 6,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    borderRadius: 24,
    backgroundColor: p.lilac,
  },
  bubble: {
    flex: 1,
    backgroundColor: "#E1F4EA",
    borderRadius: 22,
    padding: 14,
  },
  progress: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 16,
    color: p.ink,
    backgroundColor: p.lilac,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginLeft: "auto",
  },
  smallButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
});
