import { useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { b, BuilderChoice } from "@/components/learning/prova-builder-ui";
import {
  ScenarioFitCard,
  useScenarioFit,
} from "@/components/learning/scenario-fit-review";
import { EmptyCard, ParentScreen } from "@/components/ui/parent-screen";

/** D1 / C05: veli soru-kazanım uygunluğu incelemesi (gerekçeli karar; AI önerisi ayrı). */
export default function ScenarioFitScreen() {
  const { t } = useTranslation();
  const [state, setState] = useState<"pending" | "reviewed">("pending");
  const list = useScenarioFit(state);
  const s = list.data?.summary;
  return (
    <ParentScreen
      title={t("d1.fit.title")}
      subtitle={t("d1.fit.subtitle")}
      loading={list.isPending}
      error={list.error}
      onRetry={() => void list.refetch()}
    >
      <View style={{ gap: 14 }}>
        <Text style={b.muted}>{t("d1.fit.help")}</Text>
        <View style={b.wrap}>
          <BuilderChoice
            label={t("d1.fit.tabPending", { count: s?.pending_human_review ?? 0 })}
            selected={state === "pending"}
            onPress={() => setState("pending")}
          />
          <BuilderChoice
            label={t("d1.fit.tabReviewed", {
              count: (s?.fit ?? 0) + (s?.not_fit ?? 0) + (s?.needs_revision ?? 0),
            })}
            selected={state === "reviewed"}
            onPress={() => setState("reviewed")}
          />
        </View>
        {list.data && !list.data.items.length
          ? (
            <EmptyCard
              title={t(state === "pending" ? "d1.fit.emptyPending" : "d1.fit.emptyReviewed")}
            />
          )
          : null}
        {list.data?.items.map((item) => (
          <ScenarioFitCard
            key={`${item.question_id}:${item.revision}`}
            item={item}
          />
        ))}
      </View>
    </ParentScreen>
  );
}
