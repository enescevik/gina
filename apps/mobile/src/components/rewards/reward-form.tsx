import { useEffect, useRef, useState, type ComponentRef } from "react";
import { usePreventRemove } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Image, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { Field } from "@/components/ui/field";
import { Pressable } from "@/components/ui/pressable";
import { IconButton, SatinButton, p, u } from "@/components/planner/ui";
import { supabase } from "@/lib/supabase";
import { REWARD_ICONS, RewardCost, RewardTile } from "./reward-visuals";
export function RewardForm({ familyId, onClose, onCreated }: { familyId: string; onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const wide = width >= 700;
  const cache = useQueryClient();
  const [title, setTitle] = useState("");
  const [cost, setCost] = useState("10");
  const [icon, setIcon] = useState("reward-mystery-box");
  const [leave, setLeave] = useState<(() => void) | null>(null);
  const saving = useRef(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const dirty = title !== "" || cost !== "10" || icon !== "reward-mystery-box";
  const validCost = /^\d{1,3}$/.test(cost) && Number(cost) >= 1;
  const add = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !validCost || !familyId) throw Error("invalid");
      const { error } = await supabase.from("family_rewards").insert({ family_id: familyId, title: title.trim(), icon, cost_stars: Number(cost), created_by: null });
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([["family_rewards_all", familyId], ["family_rewards"], ["child_goal"]].map(queryKey => cache.invalidateQueries({ queryKey })));
      onCreated();
    },
    onSettled: () => { saving.current = false; },
  });
  const busy = add.isPending;
  function askLeave(action: () => void) { setLeave(() => action); scroll.current?.scrollTo({ y: 0, animated: false }); }
  function close() { if (!busy) { if (dirty) askLeave(onClose); else onClose(); } }
  usePreventRemove(dirty || busy, ({ repeat }) => { if (!busy) askLeave(repeat); });
  useEffect(() => {
    if (Platform.OS !== "web" || !dirty) return;
    const fn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [dirty]);
  return <Modal transparent animationType="none" supportedOrientations={["portrait", "landscape"]} onRequestClose={close}>
    <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: "#20195166", justifyContent: "center", padding: wide ? 24 : 0 }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%", maxWidth: 620, alignSelf: "center", maxHeight: "100%", height: wide ? Math.min(height - 96, 860) : undefined, flex: wide ? undefined : 1 }}>
        <View style={{ backgroundColor: p.cream, borderRadius: wide ? 30 : 24, overflow: "hidden", flexShrink: 1, flex: 1 }}>
          <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 18 }}>
            <View style={u.row}><Text accessibilityRole="header" style={[u.title, u.fill]}>{t("rewardPremium.new")}</Text><IconButton label={t("common.cancel")} disabled={busy} onPress={close}><X color={p.ink} /></IconButton></View>
            {leave ? <View style={u.card}><Text style={u.heading}>{t("planner.discardTitle")}</Text><Text style={u.copy}>{t("planner.discardBody")}</Text><SatinButton title={t("planner.keepEditing")} onPress={() => setLeave(null)} /><SatinButton secondary title={t("planner.discard")} onPress={() => { const action = leave; setLeave(null); action(); }} /></View> : null}
            <View pointerEvents={busy || leave ? "none" : "auto"} style={{ gap: 18, opacity: leave ? .45 : 1 }}>
              <View style={u.row}><Text style={[u.copy, u.fill]}>{t("rewardPremium.formHint")}</Text><Image accessible={false} source={require("../../../../../packages/assets/brand/growing-friend/reading.png")} style={{ height: 92, width: 132 }} resizeMode="contain" /></View>
              <Field label={t("rewardPremium.name")} value={title} onChangeText={setTitle} placeholder={t("rewards.titlePlaceholder")} editable={!busy} />
              <Text style={u.bold}>{t("rewards.chooseIcon")}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, maxWidth: 296 }}>{REWARD_ICONS.map(slug => <Pressable key={slug} accessibilityRole="button" accessibilityLabel={t(`rewardIcon.${slug}`)} accessibilityState={{ selected: icon === slug, disabled: busy }} disabled={busy} onPress={() => setIcon(slug)} style={{ padding: 3, borderRadius: 21, borderWidth: 2, borderColor: icon === slug ? p.purple : "transparent" }}><RewardTile slug={slug} size={56} /></Pressable>)}</View>
              <Field label={t("rewards.cost")} keyboardType="number-pad" maxLength={3} value={cost} onChangeText={setCost} editable={!busy} />
              {!validCost ? <Text accessibilityRole="alert" style={u.error}>{t("rewardPremium.invalidCost")}</Text> : null}
              <View style={[u.card, { backgroundColor: "#F0EAFB", boxShadow: "none" }]}><Text style={u.bold}>{t("rewardPremium.preview")}</Text><View style={u.row}><RewardTile slug={icon} size={68} /><View style={[u.fill, { gap: 5 }]}><Text style={u.bold}>{title.trim() || t("rewards.titlePlaceholder")}</Text>{validCost ? <RewardCost count={Number(cost)} /> : <Text style={u.small}>{t("rewardPremium.invalidCost")}</Text>}</View></View></View>
            </View>
          </ScrollView>
          {add.error ? <Text accessibilityRole="alert" style={[u.error, { paddingHorizontal: 20, paddingVertical: 8 }]}>{t(add.error.message === "invalid" ? "rewards.invalid" : "rewardPremium.saveError")}</Text> : null}
          <View style={u.footer}><SatinButton secondary title={t("common.cancel")} disabled={busy} onPress={close} /><SatinButton title={t("rewardPremium.save")} style={u.fill} busy={busy} disabled={busy || !title.trim() || !validCost || !!leave} onPress={() => { if (saving.current) return; saving.current = true; add.mutate(); }} /></View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView></SafeAreaProvider>
  </Modal>;
}
