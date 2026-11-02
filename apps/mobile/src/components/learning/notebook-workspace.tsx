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
import { ArrowLeft, BookOpen, Copy } from "lucide-react-native";
import { emptyNotebook, type NotebookDocument } from "@gina/core";
import { Pressable } from "@/components/ui/pressable";
import { p } from "@/components/planner/ui";
import { QuestionMedia } from "./question-media";
import { NotebookEditor, type NotebookInsertion } from "./notebook-editor";
import { NotebookSourcePicker } from "./notebook-source-picker";

export function NotebookWorkspace({
  title,
  questionId,
  stem,
  document,
  text,
  onChange,
  onTextChange,
  status,
  disabled,
  onExit,
  footer,
  alerts,
}: {
  title: string;
  questionId: string;
  stem: string;
  document?: NotebookDocument;
  text: string;
  onChange: (d: NotebookDocument) => void;
  onTextChange: (text: string) => void;
  status: string;
  disabled: boolean;
  onExit: () => void;
  footer: ReactNode;
  alerts: ReactNode;
}) {
  const { t } = useTranslation();
  const { width, height, fontScale } = useWindowDimensions();
  const wide = width >= 850 && width > height && fontScale < 1.4;
  const [tab, setTab] = useState<"question" | "notebook">("question");
  const [sourceOpen, setSourceOpen] = useState(false),
    [insertion, setInsertion] = useState<NotebookInsertion | null>(null);
  const [page] = useState(emptyNotebook);
  const question = (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={s.questionContent}
    >
      <View style={s.sourceHeading}>
        <BookOpen size={22} color={p.purple} />
        <Text style={s.sectionTitle}>{t("notebook.question")}</Text>
      </View>
      <Text selectable style={s.stem}>{stem}</Text>
      <QuestionMedia questionId={questionId} />
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => setSourceOpen(true)}
        style={s.take}
      >
        <Copy size={20} color={p.purple} />
        <Text style={s.takeText}>{t("notebook.takeFromQuestion")}</Text>
      </Pressable>
      <View style={s.encouragement}>
        <Image
          source={require(
            "../../../../../packages/assets/brand/growing-friend/reading.png",
          )}
          style={{ width: 112, height: 90 }}
          resizeMode="contain"
          accessible={false}
        />
        <Text style={s.soft}>{t("notebook.encouragement")}</Text>
      </View>
      <Text style={s.sectionTitle}>{t("prova.answerLabel")}</Text>
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
    </ScrollView>
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
          <Text accessibilityRole="header" style={s.title}>{title}</Text>
        </View>
        {!wide
          ? (
            <View style={s.tabs}>
              {(["question", "notebook"] as const).map((key) => (
                <Pressable
                  key={key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === key }}
                  onPress={() => setTab(key)}
                  style={[s.tab, tab === key && { backgroundColor: p.lilac }]}
                >
                  <Text style={[s.tabText, tab === key && { color: p.purple }]}>
                    {t(`notebook.${key}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )
          : null}
        <View style={[s.body, { flexDirection: wide ? "row" : "column" }]}>
          {wide || tab === "question"
            ? <View style={wide ? s.questionRail : s.fill}>{question}</View>
            : null}
          <View
            style={[
              s.paperShell,
              !wide && tab !== "notebook" && { display: "none" },
            ]}
          >
            {!wide
              ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setTab("question")}
                  style={s.context}
                >
                  <BookOpen size={18} color={p.purple} />
                  <Text numberOfLines={2} style={s.contextText}>{stem}</Text>
                  <Text style={s.takeText}>{t("notebook.showQuestion")}</Text>
                </Pressable>
              )
              : null}
            <View style={s.paperHeading}>
              <Text style={s.sectionTitle}>{t("notebook.title")}</Text>
              <BookOpen size={19} color={p.purple} />
            </View>
            <NotebookEditor
              document={document ?? page}
              onChange={onChange}
              disabled={disabled}
              insertion={insertion}
              onInserted={() => setInsertion(null)}
            />
          </View>
        </View>
        <View
          style={[
            s.footer,
            wide && { flexDirection: "row", alignItems: "center", gap: 20 },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text accessibilityLiveRegion="polite" style={s.status}>
              {status}
            </Text>
            {alerts}
          </View>
          <View style={wide ? { width: 360 } : undefined}>{footer}</View>
        </View>
        <NotebookSourcePicker
          questionId={questionId}
          stem={stem}
          visible={sourceOpen}
          onClose={() => setSourceOpen(false)}
          onInsert={(e) => {
            setInsertion(e);
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
    textAlign: "right",
  },
  tabs: { flexDirection: "row", padding: 8, gap: 8 },
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
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  questionRail: { width: "38%", maxWidth: 470, minWidth: 280 },
  questionContent: { padding: 14, gap: 16 },
  sourceHeading: { flexDirection: "row", gap: 10, alignItems: "center" },
  sectionTitle: { fontFamily: "Nunito_700Bold", fontSize: 20, color: p.ink },
  stem: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 21,
    lineHeight: 31,
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
    paddingVertical: 8,
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#FFF",
    overflow: "hidden",
    boxShadow: "0 3px 14px #20195108",
  },
  paperHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: p.line,
  },
  context: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F4F0FA",
  },
  contextText: {
    flex: 1,
    fontFamily: "Nunito_400Regular",
    fontSize: 13,
    color: p.muted,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    paddingTop: 8,
    gap: 6,
    borderTopWidth: 1,
    borderColor: p.line,
    backgroundColor: p.cream,
  },
  status: { fontFamily: "Nunito_400Regular", fontSize: 13, color: p.muted },
});
