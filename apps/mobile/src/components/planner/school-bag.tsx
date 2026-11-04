import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePreventRemove } from "expo-router";
import { randomUUID } from "expo-crypto";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Backpack,
  CheckCircle2,
  Plus,
  Trash2,
} from "lucide-react-native";
import {
  type SchoolBagCommand,
  type SchoolBagSource,
  schoolBagSourceSchema,
} from "@gina/core";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { schoolBagJournal } from "@/lib/school-bag-command";
import { Field } from "@/components/ui/field";
import { Toggle } from "@/components/ui/toggle";
import { SubjectIcon } from "@/components/subject-icon";
import { IconButton, p, SatinButton, u } from "./ui";
import type { PlannerChild } from "./timetable-editor";

type Props = { child: PlannerChild; day: string; onClose: () => void };
export function SchoolBag(props: Props) {
  const { session, claims } = useSession(), { t } = useTranslation();
  const query = useQuery({
    queryKey: ["school_bag", claims?.family_id, props.child.id, props.day],
    enabled: !!claims?.family_id,
    refetchInterval: 20000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_school_bag", {
        p_child_id: props.child.id,
        p_day: props.day,
      });
      if (error) throw error;
      return schoolBagSourceSchema.parse(data);
    },
  });
  if (!query.data) {
    return (
      <SafeAreaView style={u.root}>
        <View style={u.content}>
          <IconButton label={t("common.back")} onPress={props.onClose}>
            <ArrowLeft color={p.purple} />
          </IconButton>
          <Text style={u.heading}>{t("schoolBag.title")}</Text>
          {query.isPending ? <ActivityIndicator color={p.purple} /> : (
            <>
              <Text style={u.error}>{t("schoolBag.loadError")}</Text>
              <SatinButton
                title={t("common.retry")}
                onPress={() => void query.refetch()}
              />
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }
  return (
    <BagEditor
      key={`${session?.user.id}:${claims?.family_id}:${props.child.id}:${props.day}`}
      {...props}
      initial={query.data}
      query={query}
    />
  );
}
function BagEditor(
  { child, day, onClose, initial, query }: Props & {
    initial: SchoolBagSource;
    query: ReturnType<typeof useQuery<SchoolBagSource>>;
  },
) {
  const { t, i18n } = useTranslation(),
    { session, claims } = useSession(),
    { width, fontScale } = useWindowDimensions();
  const wide = width >= 900 && fontScale < 1.4;
  const journal = useMemo(
    () =>
      schoolBagJournal(
        session?.user.id ?? "",
        claims?.family_id ?? "",
        child.id,
        day,
      ),
    [session?.user.id, claims?.family_id, child.id, day],
  );
  const [recovery] = useState(() => {
    try {
      return { command: journal.read(), error: false };
    } catch {
      return { command: null, error: true };
    }
  });
  const [pending, setPending] = useState<SchoolBagCommand | null>(
    recovery.command,
  );
  const [source, setSource] = useState(initial),
    [items, setItems] = useState(recovery.command?.p_items ?? initial.items),
    [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [leave, setLeave] = useState<(() => void) | null>(null);
  const dirty = JSON.stringify(items) !== JSON.stringify(source.items) ||
    !!label.trim();
  const programChanged = source.saved_program_revision !== null &&
    source.saved_program_revision !== source.program_revision;
  const locked = busy || !!pending || recovery.error || !source.editable;
  const remoteChanged = !!query.data &&
    (query.data.revision !== source.revision ||
      query.data.program_revision !== source.program_revision);
  const requestLeave = (action: () => void) => {
    if (busy) return;
    if (dirty && !pending && !recovery.error) setLeave(() => action);
    else action();
  };
  usePreventRemove(
    (dirty && !pending && !recovery.error) || busy,
    ({ repeat }) => {
      if (!busy) setLeave(() => repeat);
    },
  );
  useEffect(() => {
    if (Platform.OS !== "web" || !dirty || pending || recovery.error) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty, pending, recovery.error]);
  function change(next: SchoolBagSource["items"]) {
    if (locked) return;
    setItems(next);
    setSaved(false);
    setError("");
  }
  function add(value: string) {
    const clean = value.trim();
    if (
      !clean || clean.length > 80 || items.length >= 30 ||
      items.some((i) => i.label === clean)
    ) {
      setError(t("schoolBag.invalidItem"));
      return;
    }
    change([...items, { id: randomUUID(), label: clean, checked: false }]);
    setLabel("");
  }
  async function reload() {
    const fresh = await query.refetch();
    if (fresh.data && !fresh.error) {
      setSource(fresh.data);
      setItems(fresh.data.items);
      setLabel("");
      setConfirmed(false);
      setError("");
      setSaved(false);
    } else setError(t("schoolBag.loadError"));
  }
  async function save() {
    if (
      busy || recovery.error ||
      (!pending &&
        (locked || label.trim() || (!dirty && !programChanged) ||
          (programChanged && !confirmed)))
    ) return;
    setBusy(true);
    setError("");
    try {
      const command = pending ??
        journal.prepare({
          p_child_id: child.id,
          p_day: day,
          p_revision: source.revision,
          p_program_revision: source.program_revision,
          p_items: items,
        });
      setPending(command);
      const receipt = await journal.send(command);
      setPending(null);
      const fresh = await query.refetch();
      const next = fresh.data && fresh.data.revision >= receipt.revision
        ? fresh.data
        : {
          ...source,
          revision: receipt.revision,
          saved_program_revision: command.p_program_revision,
          items: command.p_items,
        };
      setSource(next);
      setItems(next.items);
      setConfirmed(false);
      setSaved(true);
      if (fresh.error) setError(t("schoolBag.refresh"));
    } catch (e) {
      try {
        const c = journal.read();
        setPending(c);
        if (c) return;
      } catch {
        setError(t("timetableRecovery.storage"));
        return;
      }
      const message = (e as Error).message;
      setError(
        t(
          message === "bag_changed" || message === "bag_program_changed"
            ? "schoolBag.changed"
            : message === "bag_date"
            ? "schoolBag.readonly"
            : "schoolBag.saveError",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  const formatted = new Intl.DateTimeFormat(i18n.language, {
    day: "numeric",
    month: "long",
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(day + "T12:00:00Z"));
  const checked = items.filter((i) => i.checked).length;
  const panels = [
    <View
      key="lessons"
      style={[u.card, { flex: wide ? 0.8 : undefined, gap: 14 }]}
    >
      <Text style={u.heading}>{t("schoolBag.lessons")}</Text>
      <Text style={u.small}>{t("schoolBag.programHelp")}</Text>
      {source.lessons.length
        ? source.lessons.map((lesson) => (
          <View
            key={lesson.id}
            style={[u.row, { paddingVertical: 8, gap: 14 }]}
          >
            <SubjectIcon
              subject={lesson.title}
              size={32}
              variant="svg"
              appearance="planner"
            />
            <View style={u.fill}>
              <Text style={u.bold}>{lesson.title}</Text>
              <Text style={u.small}>{lesson.start} – {lesson.end}</Text>
            </View>
          </View>
        ))
        : <Text style={u.copy}>{t("schoolBag.noLessons")}</Text>}
    </View>,
    <View
      key="items"
      style={[u.card, { flex: wide ? 1.2 : undefined, gap: 14 }]}
    >
      <View
        style={[u.row, {
          justifyContent: "space-between",
          flexWrap: "wrap",
        }]}
      >
        <Text style={u.heading}>{t("schoolBag.list")}</Text>
        {items.length
          ? (
            <Text style={u.small}>
              {t("schoolBag.count", {
                ready: checked,
                total: items.length,
              })}
            </Text>
          )
          : null}
      </View>
      {items.length
        ? items.map((item) => (
          <View
            key={item.id}
            style={[u.row, {
              gap: 8,
              backgroundColor: item.checked ? "#EAF7F0" : p.cream,
              borderRadius: 18,
              paddingHorizontal: 10,
            }]}
          >
            <View style={u.fill}>
              <Toggle
                label={item.label}
                value={item.checked}
                disabled={locked}
                onChange={(checked) =>
                  change(
                    items.map((i) => i.id === item.id ? { ...i, checked } : i),
                  )}
              />
            </View>
            {!locked
              ? (
                <IconButton
                  label={t("schoolBag.remove", { name: item.label })}
                  onPress={() => change(items.filter((i) => i.id !== item.id))}
                >
                  <Trash2 size={19} color={p.muted} />
                </IconButton>
              )
              : null}
          </View>
        ))
        : (
          <View style={{ gap: 8, paddingVertical: 16 }}>
            <Text style={u.bold}>{t("schoolBag.emptyTitle")}</Text>
            <Text style={u.copy}>{t("schoolBag.emptyBody")}</Text>
          </View>
        )}
      {!locked
        ? (
          <>
            <View style={[u.row, { alignItems: "flex-end" }]}>
              <View style={u.fill}>
                <Field
                  label={t("schoolBag.itemLabel")}
                  value={label}
                  maxLength={80}
                  onChangeText={setLabel}
                  placeholder={t("schoolBag.placeholder")}
                  onSubmitEditing={() => add(label)}
                />
              </View>
              <IconButton
                label={t("schoolBag.add")}
                disabled={!label.trim() || items.length >= 30}
                onPress={() => add(label)}
              >
                <Plus color={p.purple} />
              </IconButton>
            </View>
            {label.trim()
              ? (
                <Text style={u.small}>
                  {t("schoolBag.addBeforeSave")}
                </Text>
              )
              : null}
            <Text style={u.small}>{t("schoolBag.limit")}</Text>
          </>
        )
        : null}
      {items.length > 0 && checked === items.length
        ? (
          <View style={u.row}>
            <CheckCircle2 color="#218574" size={24} />
            <Text style={[u.bold, u.fill]}>
              {t(
                dirty ? "schoolBag.allCheckedDraft" : "schoolBag.allChecked",
              )}
            </Text>
          </View>
        )
        : null}
    </View>,
  ];
  return (
    <SafeAreaView style={u.root}>
      <KeyboardAvoidingView
        style={u.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[u.content, { gap: 20 }]}
        >
          <View style={u.topbar}>
            <IconButton
              label={t("common.back")}
              onPress={() => requestLeave(onClose)}
            >
              <ArrowLeft color={p.purple} />
            </IconButton>
            <Text style={[u.bold, { fontSize: 20 }]}>
              {t("schoolBag.title")}
            </Text>
            <View style={{ width: 48 }} />
          </View>
          <View style={[u.row, { gap: 18 }]}>
            <View
              style={{
                width: 68,
                height: 68,
                borderRadius: 24,
                backgroundColor: p.mint,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Backpack size={34} color={p.ink} />
            </View>
            <View style={u.fill}>
              <Text style={u.title}>
                {t("schoolBag.childTitle", { name: child.name })}
              </Text>
              <Text style={u.copy}>{formatted}</Text>
            </View>
          </View>
          <Text style={u.copy}>{t("schoolBag.help")}</Text>
          {recovery.error
            ? (
              <Text accessibilityRole="alert" style={u.error}>
                {t("timetableRecovery.storage")}
              </Text>
            )
            : null}
          {pending && !busy
            ? (
              <View style={[u.card, { backgroundColor: p.lilac }]}>
                <Text style={u.bold}>{t("schoolBag.pendingTitle")}</Text>
                <Text style={u.copy}>{t("schoolBag.pendingBody")}</Text>
              </View>
            )
            : null}
          {!source.editable
            ? <Text style={u.copy}>{t("schoolBag.readonly")}</Text>
            : null}
          {programChanged
            ? (
              <View style={{ gap: 10 }}>
                <Text style={u.error}>{t("schoolBag.programChanged")}</Text>
                {!locked
                  ? (
                    <Toggle
                      label={t("schoolBag.confirmProgram")}
                      value={confirmed}
                      onChange={setConfirmed}
                    />
                  )
                  : null}
              </View>
            )
            : null}
          <View
            style={{
              flexDirection: wide ? "row" : "column",
              gap: 20,
              alignItems: "stretch",
            }}
          >
            {wide ? panels : [...panels].reverse()}
          </View>
          {saved
            ? (
              <Text accessibilityLiveRegion="polite" style={u.copy}>
                {t("schoolBag.saved")}
              </Text>
            )
            : null}
          {error && !pending
            ? <Text accessibilityRole="alert" style={u.error}>{error}</Text>
            : null}
          {remoteChanged && !pending
            ? (
              <Text accessibilityLiveRegion="polite" style={u.copy}>
                {t("schoolBag.remoteChanged")}
              </Text>
            )
            : null}
          {(remoteChanged || query.error || error) && !pending
            ? (
              <SatinButton
                secondary
                title={t("schoolBag.reload")}
                disabled={busy}
                onPress={() => requestLeave(() => void reload())}
              />
            )
            : null}
        </ScrollView>
        <View
          style={[u.footer, {
            justifyContent: "center",
            gap: 12,
            flexWrap: "wrap",
          }]}
        >
          {leave
            ? (
              <>
                <Text style={u.copy}>{t("planner.discardBody")}</Text>
                <SatinButton
                  secondary
                  title={t("planner.keepEditing")}
                  onPress={() => setLeave(null)}
                />
                <SatinButton
                  title={t("planner.discard")}
                  onPress={() => {
                    const action = leave;
                    setLeave(null);
                    action();
                  }}
                />
              </>
            )
            : (
              <>
                <SatinButton
                  secondary
                  title={t("common.back")}
                  disabled={busy}
                  onPress={() => requestLeave(onClose)}
                />
                {source.editable || pending
                  ? (
                    <SatinButton
                      title={t(pending ? "schoolBag.retry" : "schoolBag.save")}
                      busy={busy}
                      disabled={recovery.error ||
                        (!pending &&
                          (locked || (!dirty && !programChanged) ||
                            !!label.trim() || (programChanged && !confirmed)))}
                      onPress={() => void save()}
                      style={{ flex: 1, maxWidth: 420 }}
                    />
                  )
                  : null}
              </>
            )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
