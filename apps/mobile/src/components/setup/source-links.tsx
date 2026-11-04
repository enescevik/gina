import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Linking, Text, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { FileText } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { sourceAction } from "@/lib/learning-files";
import { p, SatinButton, u } from "@/components/planner/ui";
type SourceLink = {
  item_id: string;
  source_id: string;
  name: string;
  mime: string;
};
export function useSetupSources(
  kind: "task" | "reward" | "goal",
  ids: string[],
) {
  const { claims, session } = useSession();
  const stableIds = [...new Set(ids)].sort();
  return useQuery({
    queryKey: [
      "setup_sources",
      session?.user.id,
      claims?.family_id,
      kind,
      stableIds,
    ],
    enabled: claims?.role === "parent" && stableIds.length > 0,
    queryFn: async () => {
      const rows: SourceLink[] = [];
      for (let i = 0; i < stableIds.length; i += 100) {
        const { data, error } = await supabase.rpc("get_setup_sources", {
          p_kind: kind,
          p_ids: stableIds.slice(i, i + 100),
        });
        if (error) throw error;
        rows.push(...data as unknown as SourceLink[]);
      }
      return rows;
    },
  });
}
export function SetupSourceLinks({ sources }: { sources: SourceLink[] }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<string | null>(null),
    [failed, setFailed] = useState(false);
  const {claims,session}=useSession();
  const expanded=useQuery({queryKey:["source_set_links",session?.user.id,claims?.family_id,sources.map(s=>s.source_id).sort()],enabled:claims?.role==="parent"&&sources.length>0,queryFn:async()=>{
    const result:SourceLink[]=[];
    for(const s of sources){const r=await supabase.rpc("get_learning_source_set",{p_source:s.source_id});if(r.error)throw r.error;for(const m of r.data as unknown as {id:string;name:string;mime:string}[]){if(!result.some(v=>v.source_id===m.id))result.push({item_id:s.item_id,source_id:m.id,name:m.name,mime:m.mime});}}
    return result;
  }});
  if (!sources.length) return null;
  return (
    <View style={{ gap: 6 }}>
      {(expanded.data??sources).map((s) => (
        <Pressable
          key={s.source_id}
          accessibilityRole="button"
          accessibilityLabel={t("setupDocument.open", { name: s.name })}
          accessibilityState={{ disabled: !!busy, busy: busy === s.source_id }}
          disabled={!!busy}
          style={{
            minHeight: 48,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 18,
            backgroundColor: p.lilac,
          }}
          onPress={() => {
            setBusy(s.source_id);
            setFailed(false);
            void sourceAction<{ url: string }>({
              action: "view",
              id: s.source_id,
            }).then(({ url }) => Linking.openURL(url)).catch(() =>
              setFailed(true)
            ).finally(() => setBusy(null));
          }}
        >
          <FileText size={18} color={p.purple} />
          <Text
            numberOfLines={2}
            style={[u.small, { color: p.purple, flex: 1 }]}
          >
            {busy === s.source_id
              ? t("release.loading")
              : t("setupDocument.open", { name: s.name })}
          </Text>
        </Pressable>
      ))}
      {expanded.error?<Text style={u.error}>{t("setupDocument.loadError")}</Text>:null}
      {failed
        ? (
          <Text accessibilityRole="alert" style={u.error}>
            {t("sources.sourceFailed")}
          </Text>
        )
        : null}
    </View>
  );
}
export function RewardSourceLinks({ id }: { id: string }) {
  const q = useSetupSources("reward", [id]);
  return (
    <>
      <SourceLoadError error={q.error} retry={() => void q.refetch()} />
      <SetupSourceLinks sources={q.data ?? []} />
    </>
  );
}
export function SourceLoadError(
  { error, retry }: { error: unknown; retry: () => void },
) {
  const { t } = useTranslation();
  return error
    ? (
      <View>
        <Text accessibilityRole="alert" style={u.error}>
          {t("setupDocument.loadError")}
        </Text>
        <SatinButton secondary title={t("common.retry")} onPress={retry} />
      </View>
    )
    : null;
}
