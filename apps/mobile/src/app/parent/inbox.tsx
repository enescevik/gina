import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Bell, GraduationCap } from "lucide-react-native";
import { ParentScreen, EmptyCard } from "@/components/ui/parent-screen";
import { p, u, SatinButton } from "@/components/planner/ui";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
type Item = {
  id: string;
  kind: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
  archived_at: string | null;
  child_id: string | null;
};
type Inbox = { unread: number; rows: Item[] };
export default function ParentInbox() {
  const { t, i18n } = useTranslation(),
    { claims, session } = useSession(),
    cache = useQueryClient();
  const [archived, setArchived] = useState(false),
    [cursor, setCursor] = useState<{ at: string; id: string } | null>(null),
    [open, setOpen] = useState<string | null>(null);
  const q = useQuery({
    queryKey: [
      "parent_inbox",
      session?.user.id,
      claims?.family_id,
      archived,
      cursor,
    ],
    enabled: !!claims?.family_id,
    refetchInterval: 60000,
    queryFn: async () => {
      const r = await supabase.rpc("parent_inbox", {
        p_archived: archived,
        ...(cursor ? { p_before: cursor.at, p_before_id: cursor.id } : {}),
      });
      if (r.error) throw r.error;
      return r.data as unknown as Inbox;
    },
  });
  const mark = useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive?: boolean }) => {
      const r = await supabase.rpc("mark_parent_inbox", {
        p_id: id,
        p_archived: archive ?? null,
      });
      if (r.error) throw r.error;
    },
    onSuccess: () => cache.invalidateQueries({ queryKey: ["parent_inbox"] }),
  });
  return (
    <ParentScreen
      title={t("inbox.title")}
      subtitle={t("inbox.subtitle")}
      loading={q.isLoading}
      error={q.error}
      onRetry={() => void q.refetch()}
    >
      <View style={[u.row, { flexWrap: "wrap" }]}>
        <SatinButton
          secondary
          title={t(archived ? "inbox.showCurrent" : "inbox.showArchive")}
          onPress={() => {
            setArchived(!archived);
            setCursor(null);
            setOpen(null);
          }}
        />
        <SatinButton
          secondary
          title={t("inbox.preferences")}
          onPress={() => router.push("/parent/notifications")}
        />
      </View>
      {!archived && (
        <Text style={u.small}>
          {t("inbox.unread", { count: q.data?.unread ?? 0 })}
        </Text>
      )}
      {mark.error && (
        <Text accessibilityRole="alert" style={u.error}>
          {t("inbox.saveError")}
        </Text>
      )}
      {!q.data?.rows.length && (
        <EmptyCard title={t("inbox.empty")} body={t("inbox.emptyBody")} />
      )}
      {q.data?.rows.map((item) => {
        const Icon = item.kind === "announcement" ? Bell : GraduationCap;
        return (
          <View
            key={item.id}
            style={[
              u.card,
              {
                gap: 12,
                borderLeftWidth: 4,
                borderLeftColor: item.read_at ? p.line : p.purple,
              },
            ]}
          >
            <View style={u.row}>
              <Icon color={p.purple} size={24} />
              <Text style={[u.bold, u.fill]}>{item.title}</Text>
            </View>
            <Text style={u.small}>
              {new Intl.DateTimeFormat(i18n.language, {
                dateStyle: "medium",
              }).format(new Date(item.created_at))}
              {!item.read_at ? ` · ${t("inbox.new")}` : ""}
            </Text>
            {open === item.id ? (
              <>
                <Text style={u.copy}>{item.body}</Text>
                {item.child_id && (
                  <SatinButton
                    title={t("inbox.education")}
                    onPress={() =>
                      router.push({
                        pathname: "/parent/education",
                        params: { childId: item.child_id! },
                      })
                    }
                  />
                )}
                <View style={[u.row, { flexWrap: "wrap" }]}>
                  <SatinButton
                    secondary
                    title={t(archived ? "inbox.restore" : "inbox.archive")}
                    disabled={mark.isPending}
                    onPress={() =>
                      mark.mutate({ id: item.id, archive: !archived })
                    }
                  />
                  <SatinButton
                    secondary
                    title={t("inbox.close")}
                    onPress={() => setOpen(null)}
                  />
                </View>
              </>
            ) : (
              <SatinButton
                secondary
                title={t("inbox.read")}
                onPress={() => {
                  setOpen(item.id);
                  if (!item.read_at) mark.mutate({ id: item.id });
                }}
              />
            )}
          </View>
        );
      })}
      <View style={[u.row, { flexWrap: "wrap" }]}>
        {cursor && (
          <SatinButton
            secondary
            title={t("inbox.firstPage")}
            onPress={() => {
              setCursor(null);
              setOpen(null);
            }}
          />
        )}
        {q.data?.rows.length === 30 && (
          <SatinButton
            secondary
            title={t("inbox.older")}
            onPress={() => {
              const last = q.data?.rows.at(-1);
              if (!last) return;
              setCursor({ at: last.created_at, id: last.id });
              setOpen(null);
            }}
          />
        )}
      </View>
    </ParentScreen>
  );
}
