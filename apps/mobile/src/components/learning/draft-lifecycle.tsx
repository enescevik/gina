import { useRef, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import type { DraftRecord } from "@/lib/prova-draft";
import { DecisionSheet } from "@/components/ui/decision-sheet";
import { Button } from "@/components/ui/button";
import { parentStyles } from "@/components/ui/parent-screen";

type DiscardedDraft = DraftRecord & {
  discarded_at: string;
  updated_at: string;
};
type Cursor = { updated: string; id: string } | null;
export function DraftLifecycle({ familyId, childId, selected, onClose }: {
  familyId: string;
  childId: string | null;
  selected: DraftRecord | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const sending = useRef(false);
  const request = useRef<{ key: string; id: string } | null>(null);
  const trash = useInfiniteQuery({
    queryKey: ["discarded_prova_drafts", familyId, childId],
    enabled: open,
    initialPageParam: null as Cursor,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc(
        "get_discarded_prova_drafts",
        {
          ...(childId ? { p_child_id: childId } : {}),
          ...(pageParam
            ? { p_before_id: pageParam.id, p_before_updated: pageParam.updated }
            : {}),
        },
      );
      if (error) throw error;
      return data as unknown as DiscardedDraft[];
    },
    getNextPageParam: (page): Cursor | undefined =>
      page.length === 30
        ? {
          id: page[page.length - 1].id,
          updated: page[page.length - 1].updated_at,
        }
        : undefined,
  });
  const mutation = useMutation({
    mutationFn: async (
      { draft, removed }: { draft: DraftRecord; removed: boolean },
    ) => {
      const key = `${draft.id}:${draft.version}:${removed}`;
      if (request.current?.key !== key) {
        request.current = { key, id: randomUUID() };
      }
      const { error } = await supabase.rpc("set_prova_draft_discarded", {
        p_request_id: request.current.id,
        p_id: draft.id,
        p_version: draft.version,
        p_discarded: removed,
      });
      if (error) throw error;
    },
    onSuccess: (_, { removed }) => {
      request.current = null;
      setFeedback(
        t(removed ? "lifecycle.draftRemoved" : "lifecycle.draftRestored"),
      );
      onClose();
      void cache.invalidateQueries({ queryKey: ["prova_drafts", familyId] });
      void cache.invalidateQueries({
        queryKey: ["discarded_prova_drafts", familyId],
      });
    },
    onError: () => {
      void cache.invalidateQueries({ queryKey: ["prova_drafts", familyId] });
      void cache.invalidateQueries({
        queryKey: ["discarded_prova_drafts", familyId],
      });
    },
    onSettled: () => {
      sending.current = false;
    },
  });
  function apply(draft: DraftRecord, removed: boolean) {
    if (sending.current) return;
    sending.current = true;
    mutation.mutate({ draft, removed });
  }
  const rows = (trash.data?.pages.flat() ?? []).filter((d) =>
    !childId || d.content.childId === childId
  );
  const error = mutation.error
    ? t(
      ["prova_draft_changed", "prova_draft_submitted", "prova_draft_not_found"]
          .includes(mutation.error.message)
        ? "lifecycle.draftChanged"
        : "lifecycle.draftActionError",
    )
    : "";
  return (
    <View style={{ gap: 12 }}>
      {feedback
        ? (
          <Text accessibilityLiveRegion="polite" style={parentStyles.muted}>
            {feedback}
          </Text>
        )
        : null}
      <Button
        variant="ghost"
        title={t("lifecycle.removedDrafts")}
        onPress={() => {
          mutation.reset();
          setOpen(true);
        }}
      />
      <DecisionSheet
        visible={!!selected}
        title={t("lifecycle.removeDraft")}
        onClose={() => {
          if (!mutation.isPending) {
            mutation.reset();
            onClose();
          }
        }}
      >
        <Text style={parentStyles.title}>
          {selected?.content.title || t("provaBuilder.untitled")}
        </Text>
        <Text style={parentStyles.copy}>{t("lifecycle.removeDraftBody")}</Text>
        <Text style={parentStyles.muted}>{t("lifecycle.draftQuotaHelp")}</Text>
        {error
          ? (
            <Text accessibilityRole="alert" style={parentStyles.copy}>
              {error}
            </Text>
          )
          : null}
        <Button
          title={t("common.cancel")}
          disabled={mutation.isPending}
          onPress={() => {
            mutation.reset();
            onClose();
          }}
        />
        <Button
          variant="danger"
          title={t("lifecycle.removeDraft")}
          loading={mutation.isPending}
          onPress={() => selected && apply(selected, true)}
        />
      </DecisionSheet>
      <DecisionSheet
        visible={open && !selected}
        title={t("lifecycle.removedDrafts")}
        onClose={() => {
          if (!mutation.isPending) setOpen(false);
        }}
      >
        <Text style={parentStyles.muted}>{t("lifecycle.restoreHelp")}</Text>
        {trash.isPending
          ? <Text style={parentStyles.copy}>{t("common.loading")}</Text>
          : null}
        {!trash.isPending && !rows.length && !trash.error
          ? (
            <Text style={parentStyles.copy}>
              {t("lifecycle.noRemovedDrafts")}
            </Text>
          )
          : null}
        {trash.error
          ? (
            <Button
              variant="secondary"
              title={t("common.retry")}
              onPress={() => void trash.refetch()}
            />
          )
          : null}
        {rows.map((d) => (
          <View key={d.id} style={parentStyles.card}>
            <Text style={parentStyles.copy}>
              {d.content.title || t("provaBuilder.untitled")}
            </Text>
            <Text style={parentStyles.muted}>
              {d.content.subjects.join(" · ")}
            </Text>
            <Button
              variant="secondary"
              title={t("lifecycle.restoreDraft")}
              disabled={mutation.isPending}
              onPress={() => apply(d, false)}
            />
          </View>
        ))}
        {error
          ? (
            <Text accessibilityRole="alert" style={parentStyles.copy}>
              {error}
            </Text>
          )
          : null}
        {trash.hasNextPage
          ? (
            <Button
              variant="ghost"
              title={t("lifecycle.loadMore")}
              loading={trash.isFetchingNextPage}
              onPress={() => void trash.fetchNextPage()}
            />
          )
          : null}
        <Button
          title={t("common.close")}
          disabled={mutation.isPending}
          onPress={() => setOpen(false)}
        />
      </DecisionSheet>
    </View>
  );
}
