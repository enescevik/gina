import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { LockKeyhole, Users, Archive, ChevronRight } from "lucide-react-native";
import { Pressable } from "@/components/ui/pressable";
import {
  ParentScreen,
  ChildPicker,
  EmptyCard,
} from "@/components/ui/parent-screen";
import { SatinButton, p, u } from "@/components/planner/ui";
import {
  NoteEditor,
  OwnedNoteLoader,
  SharedNoteViewer,
  type NoteRow,
  type NoteAction,
} from "@/components/notes/note-editor";
import { useRealtimeInvalidate } from "@/lib/realtime";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

export default function ParentNotesScreen() {
  const { t, i18n } = useTranslation(),
    { session, claims } = useSession(),
    cache = useQueryClient();
  const userId = session?.user.id ?? "",
    familyId = claims?.family_id ?? "";
  const [childId, setChildId] = useState<string | null>(null),
    [archive, setArchive] = useState(false);
  const [selected, setSelected] = useState<NoteRow | "new" | null>(null),
    [notice, setNotice] = useState<NoteAction | null>(null);
  const prefix = ["notes", userId, familyId];
  useRealtimeInvalidate("note_sync", userId ? `user_id=eq.${userId}` : null, [
    prefix,
  ]);
  const children = useQuery({
    queryKey: ["note_children", userId, familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("children")
        .select("id,name,avatar,archived_at")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
  useRealtimeInvalidate(
    "children",
    familyId ? `family_id=eq.${familyId}` : null,
    [["note_children", userId, familyId]],
  );
  const notes = useInfiniteQuery({
    queryKey: [...prefix, "list", childId, archive],
    enabled: !!familyId,
    initialPageParam: undefined as
      { updated_at: string; id: string } | undefined,
    queryFn: async ({ pageParam }) => {
      let query = supabase
        .from("notes")
        .select("*")
        .order("updated_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(21);
      query = archive
        ? query.not("archived_at", "is", null)
        : query.is("archived_at", null);
      if (childId) query = query.eq("child_id", childId);
      if (pageParam)
        query = query.or(
          `updated_at.lt.${pageParam.updated_at},and(updated_at.eq.${pageParam.updated_at},id.lt.${pageParam.id})`,
        );
      const { data, error } = await query;
      if (error) throw error;
      return { rows: data.slice(0, 20), more: data.length > 20 };
    },
    getNextPageParam: (last) => (last.more ? last.rows.at(-1) : undefined),
  });
  async function saved(action: NoteAction) {
    setSelected(null);
    setNotice(action);
    await cache.invalidateQueries({ queryKey: prefix });
  }
  const profiles = children.data ?? [],
    rows = notes.data?.pages.flatMap((p) => p.rows) ?? [];
  const date = new Intl.DateTimeFormat(i18n.language, {
    day: "numeric",
    month: "short",
  });
  return (
    <>
      <ParentScreen
        title={t("parent.notes")}
        subtitle={t("noteEdit.help")}
        loading={children.isPending || notes.isPending}
        error={children.error ?? notes.error}
        onRetry={() => {
          void children.refetch();
          void notes.refetch();
        }}
      >
        <SatinButton
          title={t("notes.new")}
          onPress={() => {
            setNotice(null);
            setSelected("new");
          }}
        />
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[false, true].map((a) => (
            <Pressable
              key={String(a)}
              accessibilityRole="button"
              accessibilityState={{ selected: archive === a }}
              onPress={() => setArchive(a)}
              style={{
                flex: 1,
                minHeight: 52,
                padding: 12,
                borderRadius: 20,
                backgroundColor: archive === a ? p.purple : p.lilac,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={[u.bold, { color: archive === a ? "#fff" : p.ink }]}>
                {t(a ? "noteEdit.archive" : "noteEdit.active")}
              </Text>
            </Pressable>
          ))}
        </View>
        {profiles.length ? (
          <ChildPicker
            profiles={profiles.map((c) => ({
              ...c,
              name:
                c.name +
                (c.archived_at ? ` · ${t("noteEdit.archivedProfile")}` : ""),
            }))}
            selected={childId}
            onSelect={setChildId}
            allLabel={t("noteEdit.all")}
          />
        ) : null}
        {notice ? (
          <Text
            style={[u.copy, { color: p.purple }]}
            accessibilityLiveRegion="polite"
          >
            {t(`noteEdit.done.${notice}`)}
          </Text>
        ) : null}
        {rows.length === 0 ? (
          <EmptyCard
            slug="display-bookworm"
            title={t(archive ? "noteEdit.emptyArchive" : "notes.none")}
            body={t(archive ? "noteEdit.archiveHelp" : "noteEdit.emptyHelp")}
          />
        ) : null}
        {rows.map((note) => {
          const Icon = note.archived_at
            ? Archive
            : note.visibility === "private"
              ? LockKeyhole
              : Users;
          return (
            <Pressable
              key={note.id}
              accessibilityRole="button"
              accessibilityLabel={t("noteEdit.open", {
                title: note.title || t("notes.untitled"),
              })}
              onPress={() => {
                setNotice(null);
                setSelected(note);
              }}
              style={({ pressed }) => [
                u.card,
                { gap: 12, backgroundColor: pressed ? p.lilac : "#FFFFFF" },
              ]}
            >
              <View style={u.row}>
                <Icon color={p.purple} size={22} />
                <Text style={[u.bold, u.fill]}>
                  {note.title || t("notes.untitled")}
                </Text>
                <ChevronRight color={p.purple} size={20} />
              </View>
              <Text style={u.copy} numberOfLines={3}>
                {note.body}
              </Text>
              <Text style={u.small}>
                {[
                  profiles.find((c) => c.id === note.child_id)?.name,
                  note.subject,
                  t(`note.visibility.${note.visibility}`),
                  date.format(new Date(note.updated_at)),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </Pressable>
          );
        })}
        {notes.hasNextPage ? (
          <SatinButton
            secondary
            title={t("noteEdit.more")}
            disabled={notes.isFetchingNextPage}
            onPress={() => void notes.fetchNextPage()}
          />
        ) : null}
      </ParentScreen>
      {selected === "new" ? (
        <NoteEditor
          row={null}
          userId={userId}
          familyId={familyId}
          profiles={profiles}
          initialChild={
            profiles.find((c) => c.id === childId && !c.archived_at)?.id ?? null
          }
          onClose={() => setSelected(null)}
          onSaved={saved}
        />
      ) : selected?.author_user_id === userId ? (
        <OwnedNoteLoader
          id={selected.id}
          userId={userId}
          familyId={familyId}
          profiles={profiles}
          initialChild={null}
          onClose={() => setSelected(null)}
          onSaved={saved}
        />
      ) : selected ? (
        <SharedNoteViewer
          id={selected.id}
          userId={userId}
          familyId={familyId}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </>
  );
}
