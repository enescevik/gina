import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  noteHistorySchema,
  type Database,
  type NoteVisibility,
} from "@gina/core";
import { SetupWizard, ChoiceCard } from "@/components/setup/wizard";
import { Field } from "@/components/ui/field";
import { GuidedField } from "@/components/ui/guided-field";
import { ChildPicker, FormSection } from "@/components/ui/parent-screen";
import { SatinButton, u } from "@/components/planner/ui";
import { supabase } from "@/lib/supabase";
export type NoteRow = Database["public"]["Tables"]["notes"]["Row"];
export type NoteChild = {
  id: string;
  name: string;
  avatar: string | null;
  archived_at: string | null;
};
export type NoteAction = "save" | "archive" | "restore";
const visibilities: NoteVisibility[] = ["private", "family", "child"];

export function NoteEditor({
  row: initialRow,
  userId,
  familyId,
  profiles,
  initialChild,
  onClose,
  onSaved,
}: {
  row: NoteRow | null;
  userId: string;
  familyId: string;
  profiles: NoteChild[];
  initialChild: string | null;
  onClose: () => void;
  onSaved: (action: NoteAction) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const [row] = useState(initialRow);
  const [step, setStep] = useState(0),
    [action, setAction] = useState<NoteAction>("save");
  const [childId, setChildId] = useState(row ? row.child_id : initialChild);
  const [title, setTitle] = useState(row?.title ?? ""),
    [body, setBody] = useState(row?.body ?? ""),
    [subject, setSubject] = useState(row?.subject ?? "");
  const [visibility, setVisibility] = useState<NoteVisibility>(
    row?.visibility ?? "private",
  );
  const request = useRef<{ signature: string; id: string } | null>(null);
  const linked = profiles.find((c) => c.id === childId);
  const readOnly = !!row?.archived_at || !!linked?.archived_at;
  const value = {
    title: title.trim(),
    body: body.trim(),
    subject: subject.trim(),
    visibility,
  };
  const dirty = row
    ? JSON.stringify(value) !==
      JSON.stringify({
        title: row.title ?? "",
        body: row.body,
        subject: row.subject ?? "",
        visibility: row.visibility,
      })
    : !!(title || body || subject) ||
      childId !== initialChild ||
      visibility !== "private";
  const valid =
    !linked?.archived_at &&
    (action !== "save" ||
      (!readOnly &&
        !!body.trim() &&
        body.trim().length <= 4000 &&
        title.trim().length <= 120 &&
        subject.trim().length <= 80 &&
        (visibility !== "child" || !!childId) &&
        visibility !== "teacher" &&
        (!row || dirty)));
  const history = useInfiniteQuery({
    queryKey: ["notes", userId, familyId, "history", row?.id],
    enabled: !!row,
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc("note_history", {
        p_id: row!.id,
        ...(pageParam ? { p_before_revision: pageParam } : {}),
      });
      if (error) throw error;
      return noteHistorySchema.parse(data);
    },
    getNextPageParam: (last) =>
      last.has_more ? last.rows.at(-1)?.revision : undefined,
  });
  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...(row ? { p_id: row.id, p_revision: row.revision } : {}),
        ...(childId ? { p_child_id: childId } : {}),
        p_action: action,
        p_value: action === "save" ? value : {},
      };
      const signature = JSON.stringify(payload);
      if (request.current?.signature !== signature)
        request.current = { signature, id: randomUUID() };
      const { error } = await supabase.rpc("save_parent_note", {
        ...payload,
        p_request_id: request.current.id,
      });
      if (error) throw error;
    },
    onSuccess: () => onSaved(action),
  });
  const error = save.error
    ? t(
        save.error.message.includes("note_changed")
          ? "noteEdit.changed"
          : save.error.message.includes("child_archived")
            ? "noteEdit.childArchived"
            : save.error.message.includes("plan_limit_notes")
              ? "noteEdit.limit"
              : "noteEdit.failed",
      )
    : null;
  const choose = (next: NoteAction) => {
    setAction(next);
    save.reset();
    setStep(1);
  };
  const summary = (item: {
    title: string | null;
    body: string;
    subject: string | null;
    visibility: string;
    archived_at?: string | null;
  }) => (
    <View style={{ gap: 10 }}>
      <Text style={u.heading}>{item.title || t("notes.untitled")}</Text>
      <Text style={u.copy} selectable>
        {item.body}
      </Text>
      <Text style={u.small}>
        {[
          item.subject,
          t(`note.visibility.${item.visibility}`),
          item.archived_at ? t("noteEdit.archived") : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </Text>
    </View>
  );
  return (
    <SetupWizard
      title={t(row ? "noteEdit.details" : "notes.new")}
      steps={[t("noteEdit.content"), t("noteEdit.review")]}
      step={step}
      setStep={(next) => {
        setStep(next);
        if (next === 0) setAction("save");
      }}
      dirty={dirty}
      busy={save.isPending}
      valid={valid}
      hideContinue={step === 0 && readOnly}
      onSave={() => save.mutate()}
      onClose={onClose}
      error={error}
      saveLabel={t(`noteEdit.action.${action}`)}
    >
      {step === 0 ? (
        <>
          {linked?.archived_at ? (
            <Text style={u.copy}>{t("noteEdit.childArchived")}</Text>
          ) : null}
          {readOnly ? (
            summary(row!)
          ) : (
            <>
              {!row ? (
                <ChildPicker
                  profiles={profiles.filter((c) => !c.archived_at)}
                  selected={childId}
                  onSelect={(id) => {
                    setChildId(id);
                    setSubject("");
                    if (!id && visibility === "child") setVisibility("private");
                  }}
                  allLabel={t("noteEdit.general")}
                />
              ) : (
                <Text style={u.small}>
                  {linked?.name ?? t("noteEdit.general")}
                </Text>
              )}
              <Field
                label={t("notes.title")}
                hint={t("noteEdit.optional")}
                value={title}
                onChangeText={setTitle}
                maxLength={120}
              />
              <Field
                label={t("notes.body")}
                value={body}
                onChangeText={setBody}
                multiline
                maxLength={4000}
                placeholder={t("noteEdit.example")}
                hint={`${body.length} / 4000`}
              />
              <FormSection title={t("notes.subject")} initiallyOpen={!!subject}>
                {childId ? (
                  <GuidedField
                    childId={childId}
                    kind="subject"
                    label={t("notes.subject")}
                    value={subject}
                    onChange={setSubject}
                  />
                ) : (
                  <Field
                    label={t("notes.subject")}
                    value={subject}
                    onChangeText={setSubject}
                    maxLength={80}
                  />
                )}
                {subject ? (
                  <SatinButton
                    secondary
                    title={t("noteEdit.clearSubject")}
                    onPress={() => setSubject("")}
                  />
                ) : null}
              </FormSection>
              <Text style={u.heading}>{t("noteEdit.audience")}</Text>
              {visibilities
                .filter((v) => v !== "child" || !!childId)
                .map((v) => (
                  <ChoiceCard
                    key={v}
                    title={t(`note.visibility.${v}`)}
                    body={t(`noteEdit.audience.${v}`)}
                    selected={visibility === v}
                    onPress={() => setVisibility(v)}
                  />
                ))}
            </>
          )}
          {row ? (
            <>
              <FormSection title={t("noteEdit.history")}>
                <Text style={u.small}>{t("noteEdit.historyHelp")}</Text>
                {history.isPending ? (
                  <Text style={u.small}>{t("release.loading")}</Text>
                ) : null}
                {history.isError ? (
                  <>
                    <Text style={u.error}>{t("release.loadError")}</Text>
                    <SatinButton
                      secondary
                      title={t("common.retry")}
                      onPress={() => void history.refetch()}
                    />
                  </>
                ) : null}
                {history.data?.pages[0]?.rows.length === 0 ? (
                  <Text style={u.copy}>{t("noteEdit.noHistory")}</Text>
                ) : null}
                {history.data?.pages
                  .flatMap((page) => page.rows)
                  .map((item) => (
                    <View key={item.revision} style={u.card}>
                      <Text style={u.bold}>
                        {t(`noteEdit.event.${item.action}`)} ·{" "}
                        {t("noteEdit.version", { count: item.revision })}
                      </Text>
                      <Text style={u.small}>
                        {new Intl.DateTimeFormat(i18n.language, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(item.created_at))}
                      </Text>
                      {item.before_value ? (
                        <FormSection title={t("noteEdit.before")}>
                          {summary(item.before_value)}
                        </FormSection>
                      ) : null}
                      {summary(item.after_value)}
                    </View>
                  ))}
                {history.hasNextPage ? (
                  <SatinButton
                    secondary
                    title={t("noteEdit.more")}
                    disabled={history.isFetchingNextPage}
                    onPress={() => void history.fetchNextPage()}
                  />
                ) : null}
              </FormSection>
              {!linked?.archived_at ? (
                <SatinButton
                  secondary
                  title={t(
                    row.archived_at
                      ? "noteEdit.action.restore"
                      : "noteEdit.action.archive",
                  )}
                  disabled={dirty}
                  onPress={() =>
                    choose(row.archived_at ? "restore" : "archive")
                  }
                />
              ) : null}
              {dirty && !readOnly ? (
                <Text style={u.small}>{t("noteEdit.saveFirst")}</Text>
              ) : null}
            </>
          ) : null}
        </>
      ) : (
        <>
          <View style={u.card}>
            {summary(action === "save" ? value : row!)}
            <Text style={u.small}>{linked?.name ?? t("noteEdit.general")}</Text>
          </View>
          <Text style={u.heading}>
            {t(
              action === "save"
                ? "noteEdit.audience"
                : `noteEdit.action.${action}`,
            )}
          </Text>
          <Text style={u.copy}>
            {t(
              action === "save"
                ? `noteEdit.audience.${visibility}`
                : `noteEdit.confirm.${action}`,
            )}
          </Text>
          <Text style={u.small}>{t("noteEdit.historyHelp")}</Text>
        </>
      )}
    </SetupWizard>
  );
}

/** A new opening fetches a fresh snapshot. Later refetches must not overwrite a draft. */
export function OwnedNoteLoader(
  props: Omit<Parameters<typeof NoteEditor>[0], "row"> & { id: string },
) {
  const { t } = useTranslation();
  const [opening] = useState(randomUUID);
  const q = useQuery({
    queryKey: ["note_open", props.userId, props.familyId, props.id, opening],
    staleTime: Infinity,
    gcTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("id", props.id)
        .eq("author_user_id", props.userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  if (q.data) return <NoteEditor {...props} row={q.data} />;
  return (
    <SetupWizard
      title={t("noteEdit.details")}
      steps={[t("noteEdit.content")]}
      step={0}
      setStep={() => {}}
      dirty={false}
      busy={false}
      valid={false}
      hideContinue
      onClose={props.onClose}
      onSave={() => {}}
    >
      <Text style={u.copy}>
        {t(
          q.isPending
            ? "release.loading"
            : q.isError
              ? "release.loadError"
              : "noteEdit.unavailable",
        )}
      </Text>
      {q.isError ? (
        <SatinButton
          title={t("common.retry")}
          onPress={() => void q.refetch()}
        />
      ) : null}
    </SetupWizard>
  );
}

/** Read fresh data under RLS: removing a share also removes it from an open viewer. */
export function SharedNoteViewer({
  id,
  userId,
  familyId,
  onClose,
}: {
  id: string;
  userId: string;
  familyId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ["notes", userId, familyId, "detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("title,body,subject,visibility")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  return (
    <SetupWizard
      title={t("noteEdit.details")}
      steps={[t("noteEdit.content")]}
      step={0}
      setStep={() => {}}
      dirty={false}
      busy={false}
      valid={false}
      hideContinue
      onClose={onClose}
      onSave={() => {}}
    >
      {q.isPending ? (
        <Text style={u.copy}>{t("release.loading")}</Text>
      ) : q.isError ? (
        <>
          <Text style={u.error}>{t("release.loadError")}</Text>
          <SatinButton
            title={t("common.retry")}
            onPress={() => void q.refetch()}
          />
        </>
      ) : q.data ? (
        <View style={u.card}>
          <Text style={u.heading}>{q.data.title || t("notes.untitled")}</Text>
          <Text style={u.copy} selectable>
            {q.data.body}
          </Text>
          <Text style={u.small}>
            {[q.data.subject, t(`note.visibility.${q.data.visibility}`)]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          <Text style={u.small}>{t("noteEdit.sharedReadOnly")}</Text>
        </View>
      ) : (
        <Text style={u.copy}>{t("noteEdit.unavailable")}</Text>
      )}
    </SetupWizard>
  );
}
