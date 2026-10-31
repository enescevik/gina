import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { noteVisibilitySchema, type NoteVisibility } from "@gina/core";

import { ConfirmAction } from "@/components/ui/confirm-action";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ErrorText } from "@/components/ui/screen";
import { ParentScreen as Screen, parentStyles, FormSection, ChildPicker, EmptyCard } from "@/components/ui/parent-screen";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

const VISIBILITIES: NoteVisibility[] = noteVisibilitySchema.options.filter((v) => v !== "teacher");

/** Veli notları: kişisel / aile / çocuğa açık; çocuk ve ders etiketiyle. */
export default function ParentNotesScreen() {
  const { t, i18n } = useTranslation();
  const { session, claims } = useSession();
  const familyId = claims?.family_id ?? "";
  const queryClient = useQueryClient();

  const [childId, setChildId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("");
  const [visibility, setVisibility] = useState<NoteVisibility>("family");

  const children = useQuery({
    queryKey: ["children"],
    queryFn: async () => {
      const { data, error } = await supabase.from("children").select("id, name, grade, avatar").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const notes = useQuery({
    queryKey: ["notes", familyId, childId],
    enabled: !!familyId,
    queryFn: async () => {
      let query = supabase
        .from("notes")
        .select("id, title, body, subject, visibility, child_id, updated_at, children!notes_child_id_fkey(name)")
        .order("updated_at", { ascending: false })
        .limit(100);
      if (childId) query = query.eq("child_id", childId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const addNote = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("notes").insert({
        family_id: familyId,
        child_id: childId,
        author_user_id: session?.user.id ?? null,
        title: title.trim() || null,
        body: body.trim(),
        subject: subject.trim() || null,
        visibility,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle("");
      setBody("");
      setSubject("");
      void queryClient.invalidateQueries({ queryKey: ["notes", familyId] });
    },
  });

  const removeNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["notes", familyId] }),
  });

  const dateFormat = new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "short" });

  return (
    <Screen title={t("parent.notes")} subtitle={t("parentV5.notesSubtitle")} loading={children.isLoading || notes.isLoading} error={children.error ?? notes.error} onRetry={() => { void children.refetch(); void notes.refetch(); }}>
      <ChildPicker profiles={children.data ?? []} selected={childId} onSelect={setChildId} allLabel={t("calendar.allFamily")} />

      <FormSection title={t("notes.new")}>
        <Field label={t("notes.title")} value={title} onChangeText={setTitle} />
        <Field label={t("notes.body")} value={body} onChangeText={setBody} multiline className="min-h-24" />
        <Field label={t("notes.subject")} value={subject} onChangeText={setSubject} placeholder={t("notes.subjectPlaceholder")} />
        <View className="flex-row flex-wrap gap-2">
          {VISIBILITIES.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              onPress={() => setVisibility(option)}
              className={`min-h-12 items-center justify-center rounded-full px-3 py-2 ${visibility === option ? "bg-teal-dark border border-teal-dark" : "bg-white border border-[#527E72]"}`}
            >
              <Text className={visibility === option ? "font-body-bold text-white" : "font-body text-ink"}>{t(`note.visibility.${option}`)}</Text>
            </Pressable>
          ))}
        </View>
        <Button title={t("common.save")} loading={addNote.isPending} disabled={!body.trim()} onPress={() => addNote.mutate()} />
      </FormSection>

      {notes.data?.length === 0 ? <EmptyCard title={t("notes.none")} slug="display-bookworm" /> : null}
      {notes.data?.map((note) => (
        <View key={note.id} style={parentStyles.card}>
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 text-base font-body-bold text-ink">{note.title ?? t("notes.untitled")}</Text>
            <Text className="font-body text-xs text-gray-500">{dateFormat.format(new Date(note.updated_at))}</Text>
          </View>
          <Text className="font-body text-sm text-ink">{note.body}</Text>
          <View className="flex-row items-center gap-2">
            <Text className="font-body flex-1 text-xs text-gray-500">
              {[note.children?.name, note.subject, t(`note.visibility.${note.visibility}`)].filter(Boolean).join(" · ")}
            </Text>
            <ConfirmAction title={t("common.delete")} busy={removeNote.isPending} onConfirm={() => removeNote.mutate(note.id)} />
          </View>
        </View>
      ))}



      <ErrorText error={children.error ?? notes.error ?? addNote.error ?? removeNote.error} />
      <Button variant="ghost" title={t("parent.home")} onPress={() => router.back()} />
    </Screen>
  );
}
