import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { router, useFocusEffect, usePreventRemove } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  AppState,
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
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  MessageCircle,
  MoreHorizontal,
  Search,
} from "lucide-react-native";
import {
  definitiveHelpFailure,
  helpArticleSchema,
  type HelpCommand,
  helpCommandSchema,
  helpThreadSchema,
  helpTicketSchema,
  type PendingHelpCommand,
} from "@gina/core";
import { IconButton, p, SatinButton } from "@/components/planner/ui";
import { b, BuilderChoice } from "@/components/learning/prova-builder-ui";
import { Pressable } from "@/components/ui/pressable";
import { Field } from "@/components/ui/field";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { createHelpOutbox, sendHelpCommand } from "@/lib/help";

type Draft = {
  kind: "support" | "idea";
  category: "account" | "device" | "learning" | "billing" | "other";
  subject: string;
  body: string;
};
const fresh = (kind: Draft["kind"]): Draft => ({
  kind,
  category: kind === "idea" ? "other" : "account",
  subject: "",
  body: "",
});
export default function HelpScreen() {
  const { session, claims } = useSession();
  if (!session || !claims?.family_id || claims.role !== "parent") return null;
  return (
    <HelpWorkspace
      key={`${session.user.id}:${claims.family_id}`}
      user={session.user.id}
      family={claims.family_id}
    />
  );
}
function HelpWorkspace({ user, family }: { user: string; family: string }) {
  const { t, i18n } = useTranslation(), cache = useQueryClient();
  const { width, fontScale } = useWindowDimensions(),
    wide = width >= 950 && fontScale < 1.4;
  const outbox = useMemo(() => createHelpOutbox(user, family), [user, family]);
  const [initial] = useState(() => {
    try {
      return { pending: outbox.restore(), error: false };
    } catch {
      return { pending: null, error: true };
    }
  });
  const initialCommand = initial.pending?.payload;
  const [tab, setTab] = useState<"faq" | "tickets">(
      initialCommand?.action === "reply" ? "tickets" : "faq",
    ),
    [ticket, setTicket] = useState<string | null>(
      initialCommand?.action === "reply" ? initialCommand.ticket : null,
    );
  const [draft, setDraft] = useState<Draft | null>(
      initialCommand?.action === "create" ? initialCommand : null,
    ),
    [reply, setReply] = useState(
      initialCommand?.action === "reply" ? initialCommand.body : "",
    ),
    [search, setSearch] = useState(""),
    [article, setArticle] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingHelpCommand | null>(
      initial.pending,
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [storageError, setStorageError] = useState(initial.error);
  const [overflow, setOverflow] = useState(false),
    [closeConfirm, setCloseConfirm] = useState(false),
    [leave, setLeave] = useState<{ action: () => void; route: boolean } | null>(
      null,
    ),
    [exit, setExit] = useState<(() => void) | null>(null);
  const [focused, setFocused] = useState(false),
    [foreground, setForeground] = useState(AppState.currentState === "active");
  const dirty = !!(draft?.subject || draft?.body || reply);
  usePreventRemove(
    (dirty || busy) && !exit,
    ({ repeat }) => setLeave({ action: repeat, route: true }),
  );
  useEffect(() => {
    exit?.();
  }, [exit]);
  useEffect(() => {
    if (Platform.OS !== "web" || !dirty) return;
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty]);
  const refresh = useCallback(() => {
    void cache.invalidateQueries({ queryKey: ["help", family] });
  }, [cache, family]);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    refresh();
    return () => setFocused(false);
  }, [refresh]));
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      setForeground(state === "active");
      if (state === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);
  const interval = focused && foreground ? 30000 : false;
  const articles = useQuery({
    queryKey: ["help", family, "articles", i18n.language, Platform.OS],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_help_articles", {
        p_locale: i18n.language.startsWith("tr") ? "tr" : "en",
        p_platform: Platform.OS,
        p_editor: false,
      });
      if (error) throw error;
      return helpArticleSchema.array().parse(data);
    },
  });
  const tickets = useInfiniteQuery({
    queryKey: ["help", family, "tickets"],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc("list_help_tickets", {
        p_operator: false,
        p_offset: pageParam,
      });
      if (error) throw error;
      return helpTicketSchema.array().parse(data);
    },
    getNextPageParam: (last, pages) =>
      last.length === 50 ? pages.length * 50 : undefined,
    refetchInterval: interval,
    refetchIntervalInBackground: false,
  });
  const thread = useInfiniteQuery({
    queryKey: ["help", family, "thread", ticket],
    enabled: !!ticket,
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc("get_help_ticket", {
        p_ticket_id: ticket!,
        ...(pageParam !== undefined ? { p_before: pageParam } : {}),
      });
      if (error) throw error;
      return helpThreadSchema.parse(data);
    },
    getNextPageParam: (last) =>
      last.messages.length === 100
        ? Math.min(...last.messages.map((m) => m.sequence))
        : undefined,
    refetchInterval: interval,
    refetchIntervalInBackground: false,
  });
  const current = thread.data?.pages[0];
  const messages = [
    ...new Map(
      thread.data?.pages.flatMap((page) => page.messages).filter((m) =>
        m.visibility === "family"
      ).map((m) => [m.sequence, m]),
    ).values(),
  ].sort((a, b) => a.sequence - b.sequence);
  const rows = [
    ...new Map(tickets.data?.pages.flat().map((row) => [row.id, row])).values(),
  ];
  const locked = busy || !!pending || storageError;
  const go = (action: () => void) => {
    if (busy) return;
    if (dirty) setLeave({ action, route: false });
    else action();
  };
  const select = (id: string) =>
    go(() => {
      setDraft(null);
      setReply("");
      setTicket(id);
      setOverflow(false);
      setCloseConfirm(false);
      setError("");
    });
  const create = (kind: Draft["kind"]) => {
    if (pending) return;
    go(() => {
      setDraft(fresh(kind));
      setReply("");
      setError("");
    });
  };
  const back = () =>
    go(() => {
      if (draft) {
        setDraft(null);
        setError("");
      } else if (ticket) {
        setTicket(null);
        setReply("");
        setCloseConfirm(false);
        setError("");
      } else if (router.canGoBack()) router.back();
      else router.replace("/parent/menu");
    });
  async function send(command?: HelpCommand) {
    if (busy || storageError) return;
    setBusy(true);
    setError("");
    let saved: PendingHelpCommand | undefined;
    try {
      saved = pending ?? outbox.prepare(command!);
      setPending(saved);
      const receipt = await sendHelpCommand(saved);
      outbox.acknowledge(saved.id);
      setPending(null);
      setDraft(null);
      setReply("");
      setTab("tickets");
      setTicket(receipt.id);
      setCloseConfirm(false);
      setOverflow(false);
      refresh();
    } catch (e) {
      if (saved && definitiveHelpFailure(e)) {
        try {
          outbox.acknowledge(saved.id);
          setPending(null);
        } catch {
          setStorageError(true);
        }
        const msg = e && typeof e === "object" && "message" in e
          ? String(e.message)
          : "";
        setError(
          msg.includes("help_changed")
            ? "changed"
            : msg.includes("help_rate_limited")
            ? "rateLimit"
            : "rejected",
        );
        refresh();
      } else setError(saved ? "uncertain" : "localError");
    } finally {
      setBusy(false);
    }
  }
  const draftCommand = draft
    ? helpCommandSchema.safeParse({ action: "create", ...draft })
    : null;
  const status = (value: string) => (
    <View style={s.status}>
      <Text style={s.statusText}>{t(`help.status.${value}`)}</Text>
    </View>
  );
  const textAction = (label: string, action: () => void, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={action}
      style={[s.textAction, disabled && { opacity: .45 }]}
    >
      <Text style={[b.bold, { color: p.purple }]}>{label}</Text>
    </Pressable>
  );
  const failure = (retry: () => void) => (
    <View style={s.state}>
      <Text style={b.copy} accessibilityRole="alert">
        {t("help.loadError")}
      </Text>
      <SatinButton secondary title={t("common.retry")} onPress={retry} />
    </View>
  );
  const loading = (
    <View style={s.state} accessibilityLiveRegion="polite">
      <ActivityIndicator color={p.purple} />
      <Text style={b.copy}>{t("help.loading")}</Text>
    </View>
  );
  const conversation = (
    <View style={[s.card, { flex: 1 }, wide && { gap: 16, padding: 24, minHeight: 620 }]}>
      {thread.isPending
        ? loading
        : thread.isError
        ? failure(() =>
          void thread.refetch()
        )
        : current
        ? (
          <>
            <View style={s.row}>
              <View style={{ flex: 1, gap: 8 }}>
                <Text accessibilityRole="header" style={b.h2}>
                  {current.subject}
                </Text>
                {status(current.status)}
              </View>
              {wide && current.status !== "closed" ? textAction(t("help.close"), () => setCloseConfirm(true), locked) : <IconButton
                label={t("help.options")}
                onPress={() => setOverflow(!overflow)}
              >
                <MoreHorizontal color={p.purple} />
              </IconButton>}
            </View>
            {overflow && !wide && current.status !== "closed" &&
              textAction(t("help.close"), () => setCloseConfirm(true), locked)}
            <View style={s.disclosure}>
              <Text style={s.small}>{t("help.familyPrivacy")}</Text>
            </View>
            {closeConfirm && (
              <View style={s.callout}>
                <Text style={b.bold}>{t("help.closeConfirm")}</Text>
                <Text style={b.copy}>{t("help.closeBody")}</Text>
                <SatinButton
                  secondary
                  title={t("help.close")}
                  disabled={locked}
                  onPress={() =>
                    void send({
                      action: "reply",
                      ticket: current.id,
                      revision: current.revision,
                      body: t("help.closedMessage"),
                      status: "closed",
                    })}
                />
                {textAction(
                  t("common.cancel"),
                  () => setCloseConfirm(false),
                  busy,
                )}
              </View>
            )}
            {thread.hasNextPage && (
              <SatinButton
                secondary
                title={t("help.older")}
                busy={thread.isFetchingNextPage}
                onPress={() => void thread.fetchNextPage()}
              />
            )}
            {thread.isFetchNextPageError && (
              <Text accessibilityRole="alert" style={s.error}>
                {t("help.loadError")}
              </Text>
            )}
            {messages.map((m) => (
              <View
                key={m.sequence}
                style={[s.bubble, m.author_role === "support" && s.support]}
              >
                <View style={[s.row, { flexWrap: "wrap" }]}>
                  <Text style={b.bold}>
                    {t(`help.author.${m.author_role}`)}
                  </Text>
                  <Text style={s.small}>
                    {new Date(m.created_at).toLocaleString(i18n.language, {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
                <Text selectable style={b.copy}>{m.body}</Text>
              </View>
            ))}
            {current.status === "closed" || current.status === "resolved"
              ? (
                <View style={s.callout}>
                  <Text style={b.copy}>{t("help.reopenBody")}</Text>
                  <SatinButton
                    secondary
                    title={t("help.reopen")}
                    disabled={locked}
                    onPress={() =>
                      void send({
                        action: "reply",
                        ticket: current.id,
                        revision: current.revision,
                        body: t("help.reopenedMessage"),
                        status: "open",
                      })}
                  />
                </View>
              )
              : (
                <View style={[s.composer, { flexDirection: wide || fontScale < 1.3 ? "row" : "column" }]}>
                  <TextInput
                    accessibilityLabel={t("help.reply")}
                    placeholder={t("help.replyPlaceholder")}
                    value={reply}
                    onChangeText={setReply}
                    multiline
                    maxLength={6000}
                    editable={!locked}
                    style={[b.copy, s.reply, !wide && fontScale >= 1.3 && { flex: 0, alignSelf: "stretch" }]}
                  />
                  <SatinButton
                    title={t("help.send")}
                    busy={busy}
                    disabled={locked || !reply.trim()}
                    onPress={() =>
                      void send({
                        action: "reply",
                        ticket: current.id,
                        revision: current.revision,
                        body: reply,
                      })}
                  />
                </View>
              )}
          </>
        )
        : null}
    </View>
  );
  const list = (
    <View style={[s.card, wide && { width: 320, minHeight: 620 }]}>
      <View style={s.row}>
        <Text accessibilityRole="header" style={[b.h2, { flex: 1 }]}>
          {t("help.tickets")}
        </Text>
        {textAction(t("help.new"), () => create("support"), !!pending)}
      </View>
      {tickets.isPending
        ? loading
        : tickets.isError
        ? failure(() => void tickets.refetch())
        : !rows.length
        ? (
          <View style={s.state}>
            <MessageCircle size={40} color={p.purple} />
            <Text style={b.bold}>{t("help.noTickets")}</Text>
            <Text style={b.copy}>{t("help.noTicketsBody")}</Text>
          </View>
        )
        : rows.map((row) => (
          <Pressable
            key={row.id}
            accessibilityRole="button"
            accessibilityState={{ selected: row.id === ticket }}
            onPress={() => select(row.id)}
            style={[
              s.ticket,
              row.id === ticket &&
              { backgroundColor: p.lilac, borderColor: "#C9B9EC" },
            ]}
          >
            <Text style={s.small}>{t(`help.kind.${row.kind}`)}</Text>
            <Text style={b.bold}>{row.subject}</Text>
            {status(row.status)}
          </Pressable>
        ))}
      {tickets.hasNextPage && (
        <SatinButton
          secondary
          title={t("help.more")}
          busy={tickets.isFetchingNextPage}
          onPress={() => void tickets.fetchNextPage()}
        />
      )}
    </View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.cream }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[s.page, {
            paddingHorizontal: wide ? 32 : 18,
          }]}
        >
          <View style={s.row}>
            <IconButton label={t("common.back")} onPress={back}>
              <ArrowLeft color={p.ink} />
            </IconButton>
            <Image
              source={require(
                "../../../../../packages/assets/brand/growing-friend/logo.png",
              )}
              resizeMode="contain"
              accessibilityLabel={t("app.name")}
              style={{ width: 96, height: 40 }}
            />
            <Text style={b.bold}>{t(ticket ? "help.tickets" : "help.title")}</Text>
          </View>
          {leave && (
            <View style={s.callout}>
              <Text style={b.bold}>{t("help.leaveTitle")}</Text>
              <Text style={b.copy}>
                {pending ? t("help.leavePending") : t("help.leaveBody")}
              </Text>
              <SatinButton
                secondary
                title={t("help.stay")}
                onPress={() => setLeave(null)}
              />
              {textAction(t("help.leave"), () => {
                const action = leave;
                setLeave(null);
                setDraft(null);
                setReply("");
                if (action.route) setExit(() => action.action);
                else action.action();
              }, busy)}
            </View>
          )}
          {storageError && (
            <Text accessibilityRole="alert" style={s.error}>
              {t("help.localError")}
            </Text>
          )}
          {pending && (
            <View style={s.callout} accessibilityLiveRegion="polite">
              <Text style={b.bold}>{t("help.pendingTitle")}</Text>
              <Text style={b.copy}>{t("help.pendingBody")}</Text>
              <SatinButton
                title={t("help.retrySend")}
                busy={busy}
                disabled={storageError}
                onPress={() => void send()}
              />
            </View>
          )}
          {!!error && (
            <Text accessibilityRole="alert" style={s.error}>
              {t(`help.${error}`)}
            </Text>
          )}
          {draft
            ? (
              <View
                style={[s.card, {
                  maxWidth: 760,
                  width: "100%",
                  alignSelf: "center",
                }]}
              >
                <Text style={b.h1}>{t(`help.kind.${draft.kind}`)}</Text>
                <Text style={b.copy}>{t("help.composeBody")}</Text>
                <Text style={s.small}>{t("help.familyPrivacy")}</Text>
                <Text style={b.bold}>{t("help.category")}</Text>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                >
                  {([
                    "account",
                    "device",
                    "learning",
                    "billing",
                    "other",
                  ] as const).map((category) => (
                    <BuilderChoice
                      key={category}
                      label={t(`help.category.${category}`)}
                      selected={draft.category === category}
                      disabled={locked}
                      onPress={() => setDraft({ ...draft, category })}
                    />
                  ))}
                </View>
                <Field
                  label={t("help.subject")}
                  hint={t("help.subjectHint")}
                  value={draft.subject}
                  onChangeText={(subject) => setDraft({ ...draft, subject })}
                  maxLength={160}
                  editable={!locked}
                />
                <Field
                  label={t("help.body")}
                  hint={t("help.privateHint")}
                  value={draft.body}
                  onChangeText={(body) => setDraft({ ...draft, body })}
                  maxLength={6000}
                  multiline
                  editable={!locked}
                  style={{ minHeight: 180, textAlignVertical: "top" }}
                />
                <SatinButton
                  title={t("help.submit")}
                  busy={busy}
                  disabled={locked || !draftCommand?.success}
                  onPress={() => {
                    if (draftCommand?.success) void send(draftCommand.data);
                  }}
                />
              </View>
            )
            : (
              <>
                {!ticket && (
                  <>
                    <View style={{ gap: 4 }}>
                      <Text accessibilityRole="header" style={b.h1}>
                        {t(tab === "faq" ? "help.heading" : "help.tickets")}
                      </Text>
                      {tab === "faq" && <Text style={b.copy}>{t("help.subtitle")}</Text>}
                    </View>
                    {tab === "faq" && (
                      <View style={s.search}>
                        <Search color={p.muted} size={22} />
                        <TextInput
                          accessibilityLabel={t("help.search")}
                          placeholder={t("help.search")}
                          placeholderTextColor={p.muted}
                          value={search}
                          onChangeText={setSearch}
                          style={[b.copy, { flex: 1, minWidth: 0, minHeight: 48 }]}
                        />
                      </View>
                    )}
                    <View style={s.tabs}>
                      {(["faq", "tickets"] as const).map((value) => (
                        <Pressable
                          key={value}
                          accessibilityRole="tab"
                          accessibilityState={{ selected: tab === value }}
                          onPress={() =>
                            go(() => {
                              setTab(value);
                              setTicket(null);
                              setReply("");
                            })}
                          style={[
                            s.tab,
                            tab === value && { backgroundColor: p.purple },
                          ]}
                        >
                          <Text
                            style={[b.bold, {
                              color: tab === value ? "#FFFFFF" : p.ink,
                            }]}
                          >
                            {t(`help.${value}`)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}
                {tab === "faq"
                  ? (
                    <View
                      style={{
                        maxWidth: 860,
                        width: "100%",
                        gap: 20,
                      }}
                    >
                      <View style={s.card}>
                      {articles.isPending
                        ? loading
                        : articles.isError
                        ? failure(() => void articles.refetch())
                        : (() => {
                          const found = articles.data?.filter((a) =>
                            `${a.title} ${a.body}`.toLocaleLowerCase(
                              i18n.language,
                            ).includes(search.toLocaleLowerCase(i18n.language))
                          ) ?? [];
                          return found.length
                            ? found.map((a) => (
                              <View key={a.id} style={s.faq}>
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityState={{
                                    expanded: article === a.id,
                                  }}
                                  onPress={() =>
                                    setArticle(article === a.id ? null : a.id)}
                                  style={[s.row, { minHeight: 56 }]}
                                >
                                  <Text style={[b.bold, { flex: 1 }]}>
                                    {a.title}
                                  </Text>
                                  {article === a.id
                                    ? <ChevronDown color={p.purple} />
                                    : <ChevronRight color={p.purple} />}
                                </Pressable>
                                {article === a.id && (
                                  <Text selectable style={b.copy}>
                                    {a.body}
                                  </Text>
                                )}
                              </View>
                            ))
                            : (
                              <Text style={b.copy}>
                                {t(
                                  search ? "help.noResults" : "help.noArticles",
                                )}
                              </Text>
                            );
                        })()}
                      </View>
                      <View style={s.callout}>
                        <Text style={b.h2}>{t("help.notFound")}</Text>
                        <SatinButton
                          title={t("help.support")}
                          disabled={!!pending}
                          onPress={() => create("support")}
                        />
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        disabled={!!pending}
                        onPress={() => create("idea")}
                        style={s.textAction}
                      >
                        <Lightbulb color={p.purple} />
                        <Text style={[b.bold, { color: p.purple }]}>
                          {t("help.idea")}
                        </Text>
                      </Pressable>
                    </View>
                  )
                  : (
                    <View
                      style={{
                        flexDirection: wide ? "row" : "column",
                        gap: 20,
                        alignItems: "stretch",
                      }}
                    >
                      {(!ticket || wide) && list}
                      {ticket ? conversation : wide
                        ? (
                          <View
                            style={[s.card, {
                              flex: 1,
                              alignItems: "center",
                              justifyContent: "center",
                              minHeight: 300,
                            }]}
                          >
                            <MessageCircle size={48} color={p.purple} />
                            <Text style={b.h2}>{t("help.chooseTicket")}</Text>
                            <Text style={b.copy}>
                              {t("help.noTicketsBody")}
                            </Text>
                          </View>
                        )
                        : null}
                    </View>
                  )}
              </>
            )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  page: {
    width: "100%",
    maxWidth: 1240,
    alignSelf: "center",
    paddingTop: 10,
    paddingBottom: 28,
    gap: 16,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  card: {
    backgroundColor: "#FFFEFB",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: p.line,
    padding: 18,
    gap: 14,
    minWidth: 0,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: p.lilac,
    padding: 4,
    borderRadius: 27,
    maxWidth: 520,
  },
  tab: {
    flex: 1,
    minHeight: 50,
    padding: 12,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  textAction: {
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  callout: {
    backgroundColor: "#E9F7F0",
    padding: 16,
    borderRadius: 22,
    gap: 12,
  },
  disclosure: { paddingVertical: 4 },
  search: {
    flexDirection: "row", alignItems: "center", gap: 12,
    minHeight: 58, paddingHorizontal: 16, borderRadius: 20,
    borderWidth: 1, borderColor: p.line, backgroundColor: "#FFFEFB", maxWidth: 860,
  },
  composer: { alignItems: "flex-end", gap: 10, marginTop: "auto", paddingTop: 16 },
  reply: {
    flex: 1, minWidth: 0, minHeight: 56, maxHeight: 160, textAlignVertical: "top",
    padding: 14, borderRadius: 20, borderWidth: 1, borderColor: p.line,
    backgroundColor: "#FFFEFB",
  },
  small: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 14,
    lineHeight: 21,
    color: p.muted,
  },
  faq: { borderBottomWidth: 1, borderColor: p.line, paddingBottom: 12, gap: 8 },
  state: { alignItems: "center", padding: 20, gap: 12 },
  status: {
    alignSelf: "flex-start",
    borderRadius: 12,
    backgroundColor: "#EAE4F6",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: {
    fontFamily: "Nunito_700Bold",
    fontSize: 13,
    lineHeight: 19,
    color: "#4D368E",
  },
  ticket: {
    minHeight: 100,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: p.line,
    padding: 14,
    gap: 8,
  },
  bubble: {
    alignSelf: "flex-end",
    maxWidth: "88%",
    backgroundColor: "#F5F2ED",
    borderRadius: 20,
    padding: 14,
    gap: 8,
  },
  support: { backgroundColor: "#F0E9FD", alignSelf: "flex-start" },
  error: {
    fontFamily: "Nunito_700Bold",
    fontSize: 16,
    lineHeight: 24,
    color: "#A43135",
  },
});
