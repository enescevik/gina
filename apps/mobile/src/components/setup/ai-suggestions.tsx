import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { invokeProvaAi } from "@/lib/prova-ai";
import { SatinButton, p, u } from "@/components/planner/ui";
import { ChoiceCard } from "./wizard";
export type SetupSuggestion = {
  title: string;
  reason: string;
  stars: number;
  icon: string;
};
export function AiSuggestions({
  kind,
  grade,
  age,
  interests = [],
  onChoose,
}: {
  kind: "task" | "reward";
  grade?: number | null;
  age?: number;
  interests?: string[];
  onChoose: (item: SetupSuggestion) => void;
}) {
  const { t, i18n } = useTranslation();
  const { claims } = useSession();
  const cache = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const request = useRef({ body: "", id: randomUUID() });
  const ent = useQuery({
    queryKey: ["setup_ai_entitlement", claims?.family_id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_setup_ai_entitlement");
      if (error) throw error;
      return data as unknown as { limit: number; remaining: number };
    },
  });
  const generate = useMutation({
    mutationFn: async () => {
      const body = {
        kind,
        grade: grade ?? null,
        age_band:
          age == null
            ? null
            : age < 6
              ? "2-5"
              : age < 10
                ? "6-9"
                : age < 14
                  ? "10-13"
                  : "14-18",
        interests,
        locale: i18n.language.startsWith("en") ? "en" : "tr",
      };
      const key = JSON.stringify(body);
      if (request.current.body !== key)
        request.current = { body: key, id: randomUUID() };
      return invokeProvaAi<{ suggestions: SetupSuggestion[] }>(
        "setup-suggestions",
        { ...body, request_id: request.current.id },
      );
    },
    onSuccess: () => {
      setSelected(null);
      void cache.invalidateQueries({ queryKey: ["setup_ai_entitlement"] });
    },
  });
  return (
    <View style={[u.card, { backgroundColor: "#F0ECFC", gap: 12 }]}>
      <View style={u.row}>
        <Sparkles color={p.purple} size={22} />
        <Text style={u.bold}>{t("betaUx.aiIdeas")}</Text>
      </View>
      <Text style={u.small}>{t("betaUx.aiPrivacy")}</Text>
      {ent.error ? (
        <SatinButton
          secondary
          title={t("common.retry")}
          onPress={() => void ent.refetch()}
        />
      ) : (
        <Text style={u.small}>
          {ent.data
            ? t(ent.data.limit ? "betaUx.aiRemaining" : "betaUx.aiPlan", {
                count: ent.data.remaining,
              })
            : t("release.loading")}
        </Text>
      )}
      <SatinButton
        secondary
        title={t(
          generate.isPending ? "betaUx.aiPreparing" : "betaUx.aiGenerate",
        )}
        busy={generate.isPending}
        disabled={!ent.data?.remaining || generate.isPending}
        onPress={() => {
          if (generate.isSuccess) request.current.body = "";
          generate.mutate();
        }}
      />
      {generate.error && (
        <Text accessibilityRole="alert" style={u.error}>
          {generate.error.message}
        </Text>
      )}
      {generate.data?.suggestions.map((item, index) => (
        <ChoiceCard
          key={`${index}-${item.title}`}
          title={item.title}
          body={`${item.reason} · ${t("room.starCount", { count: item.stars })}`}
          selected={selected === item.title}
          onPress={() => {
            setSelected(item.title);
            onChoose(item);
          }}
        />
      ))}
      {generate.data && <Text style={u.small}>{t("betaUx.aiDraftOnly")}</Text>}
    </View>
  );
}
