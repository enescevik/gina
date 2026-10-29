import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { noteVisibilitySchema, type NoteVisibility } from "@gina/core";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ErrorText, Screen } from "@/components/ui/screen";
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
      const { data, error } = await supabase.from("children").select("id, name").order("sort_order");
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
    <Screen title={t("parent.notes")}>
      <View className="flex-row flex-wrap gap-2">
        <Pressable accessibilityRole="button" onPress={() => setChildId(null)} className={`rounded-full px-4 py-2 ${childId === null ? "bg-teal" : "bg-mist"}`}>
          <Text className={childId === null ? "font-semibold text-white" : "text-ink"}>{t("calendar.allFamily")}</Text>
        </Pressable>
        {children.data?.map((child) => (
          <Pressable
            key={child.id}
            accessibilityRole="button"
            onPress={() => setChildId(child.id)}
            className={`rounded-full px-4 py-2 ${childId === child.id ? "bg-teal" : "bg-mist"}`}
          >
            <Text className={childId === child.id ? "font-semibold text-white" : "text-ink"}>{child.name}</Text>
          </Pressable>
        ))}
      </View>

      {notes.data?.length === 0 ? <Text className="text-gray-500">{t("notes.none")}</Text> : null}
      {notes.data?.map((note) => (
        <View key={note.id} className="gap-1 rounded-parent border border-mist p-3">
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 text-base font-semibold text-ink dark:text-night-text">{note.title ?? t("notes.untitled")}</Text>
            <Text className="text-xs text-gray-500">{dateFormat.format(new Date(note.updated_at))}</Text>
          </View>
          <Text className="text-sm text-ink dark:text-night-text">{note.body}</Text>
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 text-xs text-gray-500">
              {[note.children?.name, note.subject, t(`note.visibility.${note.visibility}`)].filter(Boolean).join(" · ")}
            </Text>
            <Button variant="ghost" title={t("common.delete")} onPress={() => removeNote.mutate(note.id)} />
          </View>
        </View>
      ))}

      <View className="gap-3 rounded-parent bg-teal-light p-4">
        <Text className="text-lg font-semibold text-ink">{t("notes.new")}</Text>
        <Field label={t("notes.title")} value={title} onChangeText={setTitle} />
        <Field label={t("notes.body")} value={body} onChangeText={setBody} multiline className="min-h-24" />
        <Field label={t("notes.subject")} value={subject} onChangeText={setSubject} placeholder={t("notes.subjectPlaceholder")} />
        <View className="flex-row flex-wrap gap-2">
          {VISIBILITIES.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              onPress={() => setVisibility(option)}
              className={`rounded-full px-3 py-2 ${visibility === option ? "bg-teal" : "bg-white"}`}
            >
              <Text className={visibility === option ? "font-semibold text-white" : "text-ink"}>{t(`note.visibility.${option}`)}</Text>
            </Pressable>
          ))}
        </View>
        <Button title={t("common.save")} loading={addNote.isPending} disabled={!body.trim()} onPress={() => addNote.mutate()} />
      </View>

      <ErrorText error={children.error ?? notes.error ?? addNote.error ?? removeNote.error} />
      <Button variant="ghost" title={t("parent.home")} onPress={() => router.back()} />
    </Screen>
  );
}
