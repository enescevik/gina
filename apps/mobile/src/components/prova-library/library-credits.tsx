import { type ReactNode, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Minus, Plus, Sparkles } from "lucide-react-native";
import {
  type FamilyLibraryCredits,
  familyLibraryCreditsSchema,
  type PolicyPreview,
} from "@gina/core";
import { Pressable } from "@/components/ui/pressable";
import { p, SatinButton, u } from "@/components/planner/ui";
import { useFamilyTimezone } from "@/lib/family";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

// Every key starts with "learning_library" so the existing invalidations after a library
// import (packages and single items) re-read the server summary instead of guessing locally.
export const creditsKey = (family?: string | null) => [
  "learning_library",
  "credits",
  family,
];

const used = (c: FamilyLibraryCredits) => c.monthly.used + c.bonus.used;

/** Mutations that can spend library allowance: package units (journal command) or a single item. */
function isAcquisition(m: { options: { mutationKey?: readonly unknown[] }; state: { variables?: unknown } }) {
  if (m.options.mutationKey?.[0] === "library_acquire") return true;
  const v = m.state.variables;
  return !!v && typeof v === "object" && "p_unit_keys" in v && "p_package_id" in v;
}

export function useLibraryCredits() {
  const { claims } = useSession();
  return useQuery({
    queryKey: creditsKey(claims?.family_id),
    enabled: !!claims?.family_id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("family_library_credits");
      if (error) throw error;
      return familyLibraryCreditsSchema.parse(data);
    },
  });
}

export function LibraryCredits() {
  const { t, i18n } = useTranslation();
  const timeZone = useFamilyTimezone();
  const cache = useQueryClient();
  const credits = useLibraryCredits();
  const before = useRef<number | null>(null);
  const [delta, setDelta] = useState<{ spent: number; remaining: number } | null>(null);
  const refetch = credits.refetch;
  const { claims } = useSession();
  const family = claims?.family_id;
  useEffect(() =>
    cache.getMutationCache().subscribe((event) => {
      if (event.type !== "updated" || !isAcquisition(event.mutation)) return;
      const current = cache.getQueryData<FamilyLibraryCredits>(creditsKey(family));
      if (event.action.type === "pending" && current) {
        before.current = used(current);
        setDelta(null);
      }
      if (event.action.type === "success" && before.current !== null) {
        const start = before.current;
        before.current = null;
        // Always re-read the authoritative summary after an import.
        void refetch().then((r) => {
          if (r.data) {
            setDelta({ spent: used(r.data) - start, remaining: r.data.total_remaining });
          }
        });
      }
      if (event.action.type === "error") before.current = null;
    }), [cache, refetch, family]);
  const date = (s: string) =>
    new Date(s).toLocaleDateString(i18n.language, {
      timeZone,
      day: "numeric",
      month: "long",
    });
  if (credits.isPending) {
    return (
      <View style={u.card}>
        <Text style={u.copy}>{t("common.loading")}</Text>
      </View>
    );
  }
  if (credits.error || !credits.data) {
    return (
      <View style={u.card} testID="library-credits">
        <Text accessibilityRole="alert" style={u.error}>{t("libraryCredits.failed")}</Text>
        <SatinButton secondary title={t("common.retry")} onPress={() => void credits.refetch()} />
      </View>
    );
  }
  const c = credits.data;
  const nearestBonus = c.bonus.grants.find((g) => g.remaining > 0);
  const next = c.contributions.next_milestones[0];
  return (
    <View style={[u.card, { backgroundColor: "#F3FBF7", borderColor: "#CBEBDD" }]} testID="library-credits">
      <Text accessibilityRole="header" style={u.heading}>{t("libraryCredits.title")}</Text>
      <Text style={[u.title, { fontSize: 26, lineHeight: 32 }]}>
        {t("libraryCredits.total", { count: c.total_remaining })}
      </Text>
      <View style={{ gap: 6 }}>
        <Text style={u.bold}>
          {t("libraryCredits.monthly", {
            used: c.monthly.used,
            limit: c.monthly.limit,
            remaining: c.monthly.remaining,
          })}
        </Text>
        <Text style={u.copy}>{t("libraryCredits.renews", { date: date(c.monthly.renews_at) })}</Text>
        <Text style={u.copy}>
          {c.bonus.earned > 0
            ? t("libraryCredits.bonus", { remaining: c.bonus.remaining, earned: c.bonus.earned })
            : t("libraryCredits.bonusNone")}
        </Text>
        {nearestBonus
          ? <Text style={u.small}>{t("libraryCredits.bonusEnds", { date: date(nearestBonus.ends_at) })}</Text>
          : null}
      </View>
      {delta
        ? (
          <View
            accessibilityLiveRegion="polite"
            testID="library-credit-delta"
            style={{ backgroundColor: p.mint, borderRadius: 18, padding: 14 }}
          >
            <Text style={u.bold}>
              {delta.spent <= 0
                ? t("libraryCredits.sameUnit")
                : t("libraryCredits.charged", { count: delta.spent, remaining: delta.remaining })}
            </Text>
          </View>
        )
        : null}
      <View style={{ height: 1, backgroundColor: p.line }} />
      <Text style={u.copy}>
        {t("libraryCredits.contributions", {
          accepted: c.contributions.accepted_questions,
          credited: c.contributions.credited_sets,
          pending: c.contributions.pending_sets,
        })}
      </Text>
      <Text style={u.bold} testID="library-next-milestone">
        {next
          ? t("libraryCredits.next", {
            remaining: next.remaining_to_next,
            reward: t(`libraryCredits.reward.${next.kind}`, {
              amount: next.kind === "plan" ? Math.min(next.amount, next.valid_days) : next.amount,
            }),
          })
          : t("libraryCredits.noMilestone")}
      </Text>
    </View>
  );
}

export function PolicyPreviewCard({ initial }: { initial: number }) {
  const { t } = useTranslation();
  const { claims } = useSession();
  const [count, setCount] = useState<number | null>(null);
  const shown = count ?? Math.max(1, initial);
  const preview = useQuery({
    queryKey: ["learning_library", "policy", claims?.family_id, shown],
    enabled: !!claims?.family_id,
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("library_policy_preview", {
        p_accepted_count: shown,
      });
      if (error) throw error;
      return data as unknown as PolicyPreview;
    },
  });
  const reward = (kind: string, amount: number) => t(`libraryCredits.reward.${kind}`, { amount });
  const data = preview.data;
  const enabled = data?.rules.filter((r) => r.enabled) ?? [];
  const stepper = (label: string, value: number, icon: ReactNode) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={value < 0 || value > 500}
      onPress={() => setCount(value)}
      style={[u.iconButton, { opacity: value < 0 || value > 500 ? 0.4 : 1 }]}
    >
      {icon}
    </Pressable>
  );
  return (
    <View style={u.card} testID="library-policy-preview">
      <View style={u.row}>
        <Sparkles size={24} color={p.purple} />
        <Text accessibilityRole="header" style={[u.heading, { flex: 1 }]}>
          {t("libraryCredits.policyTitle")}
        </Text>
      </View>
      <Text style={u.copy}>{t("libraryCredits.policyHelp")}</Text>
      <View style={[u.row, { flexWrap: "wrap" }]}>
        {stepper(t("libraryCredits.decrease"), shown - 1, <Minus size={22} color={p.purple} />)}
        <Text
          accessibilityLiveRegion="polite"
          style={[u.bold, { fontSize: 18, flexShrink: 1 }]}
          testID="library-policy-count"
        >
          {t("libraryCredits.policyCount", { count: shown })}
        </Text>
        {stepper(t("libraryCredits.increase"), shown + 1, <Plus size={22} color={p.purple} />)}
      </View>
      {preview.error && !data
        ? (
          <>
            <Text accessibilityRole="alert" style={u.error}>{t("libraryCredits.failed")}</Text>
            <SatinButton secondary title={t("common.retry")} onPress={() => void preview.refetch()} />
          </>
        )
        : !data
        ? <Text style={u.copy}>{t("common.loading")}</Text>
        : !enabled.length
        ? <Text style={u.copy}>{t("libraryCredits.policyNone")}</Text>
        : (
          <>
            <Text style={u.bold} testID="library-policy-totals">
              {t("libraryCredits.policyTotals", {
                library: data.totals.library,
                ai: data.totals.ai_questions,
                days: data.totals.plan_days,
              })}
            </Text>
            {enabled.map((r) => (
              <Text key={r.index} style={u.copy}>
                {t("libraryCredits.policyRule", {
                  threshold: r.threshold,
                  reward: reward(r.kind, r.amount),
                  milestones: r.milestones,
                })}
              </Text>
            ))}
            {data.next
              ? (
                <Text style={u.copy}>
                  {t("libraryCredits.policyNext", {
                    count: data.next.count,
                    remaining: data.next.remaining,
                    rewards: data.next.grants.map((g) => reward(g.kind, g.amount)).join(", "),
                  })}
                </Text>
              )
              : null}
          </>
        )}
      <Text style={u.small}>{t("libraryCredits.disclaimer")}</Text>
    </View>
  );
}
