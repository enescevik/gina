import { useState } from "react";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { ArrowRightLeft, Check, TriangleAlert, UserPlus, Users } from "lucide-react-native";
import { InfoCard, NavigationCard, parentStyles } from "@/components/ui/parent-screen";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { ErrorText } from "@/components/ui/screen";
import { myFamilies, type FamilyChoice } from "@/lib/family-experience";
import { refreshClaims } from "@/lib/session";
import { supabase } from "@/lib/supabase";

type Mode = "switch" | "join";

/**
 * Family switching and joining are two different actions with their own result summary.
 * Neither merges data: each family keeps its children, tasks, stars and devices.
 */
export function FamilyHub() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>("switch");
  const families = useQuery({ queryKey: ["my_families"], queryFn: myFamilies });
  // Only the open family is readable; its names/devices describe what stays behind.
  const current = useQuery({
    queryKey: ["family_hub_current"],
    queryFn: async () => {
      const [children, devices] = await Promise.all([
        supabase.from("children").select("id,name").is("archived_at", null).order("sort_order"),
        supabase.from("devices").select("id").is("revoked_at", null),
      ]);
      if (children.error) throw children.error;
      if (devices.error) throw devices.error;
      return { children: children.data.map((c) => c.name), devices: devices.data.length };
    },
  });
  const active = families.data?.find((f) => f.active);
  const others = families.data?.filter((f) => !f.active) ?? [];
  const [target, setTarget] = useState<FamilyChoice | null>(null);
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<{ code: string; family: FamilyChoice } | null>(null);

  const finish = async () => {
    await refreshClaims();
    qc.clear();
    router.replace("/parent");
  };
  const switchFamily = useMutation({
    mutationFn: async (family: FamilyChoice) => {
      const { error } = await supabase.rpc("select_family", { p_family_id: family.id });
      if (error) throw error;
      await finish();
    },
  });
  const inspect = useMutation({
    mutationFn: async (requested: string) => {
      const { data, error } = await supabase.rpc("preview_family_invite", { p_invite_code: requested });
      if (error) throw error;
      const result = data as unknown as FamilyChoice;
      if (result.error) throw new Error(t(`experience.errors.${result.error}`));
      return result;
    },
    onSuccess: (family, requested) => setPreview({ code: requested, family }),
  });
  const join = useMutation({
    mutationFn: async () => {
      if (!preview) return;
      const { data, error } = await supabase.rpc("join_family", { p_invite_code: preview.code });
      if (error) throw error;
      if (!data) throw new Error(t("experience.errors.invalid_invite_code"));
      await finish();
    },
  });
  const busy = switchFamily.isPending || join.isPending || inspect.isPending;
  const keep = {
    name: active?.name ?? "",
    children: current.data?.children.length ? current.data.children.join(", ") : t("u02.family.noChildren"),
    devices: current.data?.devices ?? 0,
  };
  const ownChildren = families.data?.reduce((n, f) => n + f.children, 0) ?? 0;

  return (
    <>
      <View accessibilityRole="tablist" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {([["switch", ArrowRightLeft], ["join", UserPlus]] as const).map(([key, Icon]) => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === key }}
            aria-selected={mode === key}
            disabled={busy}
            onPress={() => { setMode(key); setTarget(null); switchFamily.reset(); }}
            style={{ flexGrow: 1, flexBasis: "45%", minHeight: 60, padding: 12, borderRadius: 19, borderWidth: 1, borderColor: mode === key ? "#78C7AE" : "#E5DEED", backgroundColor: mode === key ? "#DDF5EB" : "#FFFFFF", flexDirection: "row", alignItems: "center", gap: 10 }}
          >
            <Icon size={22} color="#6042DE" />
            <Text style={[parentStyles.copy, { flex: 1, fontFamily: "Nunito_800ExtraBold" }]}>{t(`u02.family.tab.${key}`)}</Text>
          </Pressable>
        ))}
      </View>

      {active ? (
        <View testID="family-current" style={[parentStyles.card, { gap: 8 }]}>
          <Text style={parentStyles.muted}>{t("experience.family.current")}</Text>
          <Text style={parentStyles.title}>{active.name}</Text>
          <Text style={parentStyles.copy}>{t("u02.family.currentCounts", { children: t("experience.family.children", { count: current.data?.children.length ?? active.children }), devices: keep.devices })}</Text>
          {current.data?.children.length ? <Text style={parentStyles.muted}>{keep.children}</Text> : null}
        </View>
      ) : null}
      <ErrorText error={families.error ?? current.error} />
      {families.error || current.error ? <Button variant="ghost" title={t("common.retry")} onPress={() => { void families.refetch(); void current.refetch(); }} /> : null}

      {mode === "switch" ? (
        <>
          <InfoCard title={t("u02.family.switchTitle")} body={t("u02.family.switchExplain")} />
          {!families.isLoading && !others.length ? (
            <InfoCard title={t("u02.family.onlyOneTitle")} body={t("u02.family.onlyOneBody")}>
              <Button variant="secondary" title={t("u02.family.tab.join")} onPress={() => setMode("join")} />
            </InfoCard>
          ) : null}
          {others.map((f) => (
            <NavigationCard key={f.id} title={f.name} body={t("experience.family.children", { count: f.children })} icon={target?.id === f.id ? <Check color="#247A68" /> : <Users color="#6042DE" />} onPress={() => { if (!busy) { setTarget(f); switchFamily.reset(); } }} />
          ))}
          {target ? (
            <View testID="family-switch-impact" style={[parentStyles.card, { gap: 12, borderColor: "#A89BD4" }]}>
              <Text accessibilityRole="header" style={parentStyles.title}>{t("c06.family.switchTo", { name: target.name })}</Text>
              <Impact lines={[
                t("u02.family.opens", { name: target.name, children: t("experience.family.children", { count: target.children }) }),
                t("c06.family.staysBehind", keep),
                t("u02.family.noMerge"),
                t("u02.family.devicesStay"),
                t("u02.family.switchBack"),
              ]} />
              <ErrorText error={switchFamily.error} />
              <Button title={t("c06.family.switchAction", { name: target.name })} loading={switchFamily.isPending} disabled={busy} onPress={() => switchFamily.mutate(target)} />
              <Button variant="ghost" title={t("common.cancel")} disabled={busy} onPress={() => setTarget(null)} />
            </View>
          ) : null}
        </>
      ) : (
        <>
          <View style={parentStyles.form}>
            <Text style={parentStyles.title}>{t("experience.family.joinTitle")}</Text>
            <Text style={parentStyles.muted}>{t("auth1.family.codeHelpPath")}</Text>
            <Field label={t("parent.inviteCode")} maxLength={8} autoCapitalize="characters" autoComplete="off" editable={!busy} value={code}
              onChangeText={(v) => { setCode(v.replace(/[^a-f0-9]/gi, "").toUpperCase()); setPreview(null); inspect.reset(); join.reset(); }} />
            <Button title={t("experience.family.preview")} loading={inspect.isPending} disabled={code.length !== 8 || busy} onPress={() => inspect.mutate(code)} />
            <ErrorText error={inspect.error} />
          </View>
          {preview ? (
            <View testID="family-join-impact" style={[parentStyles.card, { gap: 12, borderColor: "#A89BD4" }]}>
              <Text accessibilityRole="header" style={parentStyles.title}>{preview.family.name}</Text>
              <Text style={parentStyles.copy}>{t("experience.family.children", { count: preview.family.children })}</Text>
              {preview.family.already_member ? (
                <>
                  <InfoCard title={t("u02.family.alreadyTitle")} body={t("u02.family.alreadyBody")} />
                  <Button variant="secondary" title={t("u02.family.tab.switch")} onPress={() => { setMode("switch"); setPreview(null); }} />
                </>
              ) : (
                <>
                  {active && ownChildren > 0 ? (
                    <View testID="family-two-families" style={{ gap: 10, padding: 16, borderRadius: 20, backgroundColor: "#FFF9EC", borderWidth: 1, borderColor: "#E4C27A" }}>
                      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                        <TriangleAlert size={22} color="#7A5410" />
                        <Text style={[parentStyles.copy, { flex: 1, fontFamily: "Nunito_800ExtraBold" }]}>{t("u02.family.twoTitle")}</Text>
                      </View>
                      <Text style={parentStyles.copy}>{t("u02.family.twoCounts", { mine: active.name, mineChildren: t("experience.family.children", { count: current.data?.children.length ?? active.children }), theirs: preview.family.name, theirChildren: t("experience.family.children", { count: preview.family.children }) })}</Text>
                      <Text style={parentStyles.muted}>{t("u02.family.twoSeparate")}</Text>
                      <Text style={parentStyles.muted}>{t("u02.family.twoDuplicates")}</Text>
                    </View>
                  ) : null}
                  <Impact lines={[
                    t("c06.family.joinOpens", { name: preview.family.name }),
                    active ? t("c06.family.joinKeeps", { name: active.name }) : t("u02.family.joinFirst"),
                    t("u02.family.noMerge"),
                  ]} />
                  <ErrorText error={join.error} />
                  <Button title={t("c06.family.joinAction", { name: preview.family.name })} loading={join.isPending} disabled={busy} onPress={() => join.mutate()} />
                </>
              )}
              <Button variant="ghost" title={t("common.cancel")} disabled={busy} onPress={() => setPreview(null)} />
            </View>
          ) : null}
        </>
      )}
    </>
  );
}

function Impact({ lines }: { lines: string[] }) {
  return (
    <View accessibilityRole="list" style={{ gap: 8 }}>
      {lines.map((line) => (
        <View key={line} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 9, backgroundColor: "#6042DE" }} />
          <Text style={[parentStyles.copy, { flex: 1 }]}>{line}</Text>
        </View>
      ))}
    </View>
  );
}
