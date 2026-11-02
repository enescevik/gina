import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type ComponentRef,
} from "react";
import { usePreventRemove } from "expo-router";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Check, X } from "lucide-react-native";
import { IconButton, SatinButton, p, u } from "@/components/planner/ui";
import { Pressable } from "@/components/ui/pressable";

export function SetupWizard({
  title,
  steps,
  step,
  setStep,
  dirty,
  busy,
  valid,
  onSave,
  onClose,
  error,
  children,
  saveLabel,
}: {
  title: string;
  steps: string[];
  step: number;
  setStep: (step: number) => void;
  dirty: boolean;
  busy: boolean;
  valid: boolean;
  onSave: () => void;
  onClose: () => void;
  error?: string | null;
  children: ReactNode;
  saveLabel?: string;
}) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const wide = width >= 700 && height >= 600;
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [leave, setLeave] = useState<(() => void) | null>(null);
  const askLeave = (action: () => void) => {
    if (!busy) {
      if (dirty) setLeave(() => action);
      else action();
    }
  };
  usePreventRemove(dirty || busy, ({ repeat }) => {
    if (!busy) setLeave(() => repeat);
  });
  useEffect(() => {
    if (Platform.OS !== "web" || !dirty) return;
    const fn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [dirty]);
  function move(next: number) {
    setStep(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }
  return (
    <Modal
      transparent
      animationType="none"
      supportedOrientations={["portrait", "landscape"]}
      onRequestClose={() => askLeave(onClose)}
    >
      <SafeAreaProvider>
        <SafeAreaView
          style={{
            flex: 1,
            backgroundColor: "#20195180",
            padding: wide ? 24 : 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{
              width: "100%",
              maxWidth: 720,
              flex: wide ? undefined : 1,
              height: wide ? Math.min(800, height - 64) : undefined,
            }}
          >
            <View
              accessibilityViewIsModal
              style={{
                flex: 1,
                backgroundColor: p.cream,
                borderRadius: wide ? 30 : 0,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  paddingHorizontal: 20,
                  paddingTop: 12,
                  paddingBottom: 10,
                  gap: 10,
                  borderBottomWidth: 1,
                  borderColor: p.line,
                }}
              >
                <View style={u.row}>
                  <Text accessibilityRole="header" style={[u.heading, u.fill]}>
                    {title}
                  </Text>
                  <IconButton
                    label={t("common.cancel")}
                    disabled={busy}
                    onPress={() => askLeave(onClose)}
                  >
                    <X color={p.ink} />
                  </IconButton>
                </View>
                <Text accessibilityLiveRegion="polite" style={u.small}>
                  {t("betaUx.step", { current: step + 1, total: steps.length })}{" "}
                  · {steps[step]}
                </Text>
                <View style={[u.row, { gap: 6 }]}>
                  {steps.map((label, i) => (
                    <View
                      key={label}
                      style={{
                        flex: 1,
                        height: 4,
                        borderRadius: 4,
                        backgroundColor: i <= step ? p.purple : "#E5DEEF",
                      }}
                    />
                  ))}
                </View>
              </View>
              <ScrollView
                ref={scroll}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ padding: 20, gap: 18, flexGrow: 1 }}
              >
                {leave ? (
                  <View style={u.card}>
                    <Text style={u.heading}>{t("planner.discardTitle")}</Text>
                    <Text style={u.copy}>{t("planner.discardBody")}</Text>
                    <SatinButton
                      title={t("planner.keepEditing")}
                      onPress={() => setLeave(null)}
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
                  </View>
                ) : (
                  <View
                    pointerEvents={busy ? "none" : "auto"}
                    style={{ gap: 18 }}
                  >
                    {children}
                  </View>
                )}
                {error && (
                  <Text accessibilityRole="alert" style={u.error}>
                    {error}
                  </Text>
                )}
              </ScrollView>
              <View style={[u.footer, { gap: 12 }]}>
                {step > 0 && (
                  <IconButton
                    label={t("common.back")}
                    disabled={busy || !!leave}
                    onPress={() => move(step - 1)}
                  >
                    <ArrowLeft color={p.purple} />
                  </IconButton>
                )}
                <SatinButton
                  title={
                    step === steps.length - 1
                      ? (saveLabel ?? t("common.save"))
                      : t("betaUx.continue")
                  }
                  style={u.fill}
                  disabled={!valid || busy || !!leave}
                  busy={busy}
                  onPress={() => {
                    Keyboard.dismiss();
                    if (step === steps.length - 1) onSave();
                    else move(step + 1);
                  }}
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

export function ChoiceCard({
  title,
  body,
  art,
  selected,
  onPress,
  multiple = false,
}: {
  title: string;
  body?: string;
  art?: ReactNode;
  selected: boolean;
  onPress: () => void;
  multiple?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={multiple ? "checkbox" : "button"}
      accessibilityState={multiple ? { checked: selected } : { selected }}
      aria-checked={multiple ? selected : undefined}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 64,
        padding: 14,
        gap: 12,
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1.5,
        borderRadius: 22,
        backgroundColor: selected ? "#F0ECFC" : "#fff",
        borderColor: selected ? p.purple : p.line,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {art}
      <View style={u.fill}>
        <Text style={u.bold}>{title}</Text>
        {body && <Text style={u.small}>{body}</Text>}
      </View>
      {selected && <Check color={p.purple} size={20} />}
    </Pressable>
  );
}
