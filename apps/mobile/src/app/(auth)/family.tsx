import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ErrorText, Screen } from "@/components/ui/screen";
import { refreshClaims } from "@/lib/session";
import { unregisterPush } from "@/lib/push";
import { supabase } from "@/lib/supabase";

/** Giriş yapmış ama henüz bir ailesi olmayan veli: aile kurar ya da davet koduyla katılır. */
export default function FamilyScreen() {
  const { t } = useTranslation();
  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<unknown>(null);

  async function run(kind: "create" | "join") {
    setBusy(kind);
    setError(null);
    try {
      const { error: rpcError } =
        kind === "create"
          ? await supabase.rpc("create_family", { p_name: familyName.trim() })
          : await supabase.rpc("join_family", { p_invite_code: inviteCode.trim() });
      if (rpcError) throw rpcError;
      await refreshClaims();
      router.replace("/");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen title={t("app.name")}>
      <View className="gap-3 rounded-parent bg-teal-light p-4">
        <Text className="text-lg font-body-bold text-ink">{t("auth.createFamily")}</Text>
        <Field label={t("family.name")} value={familyName} onChangeText={setFamilyName} placeholder={t("family.namePlaceholder")} />
        <Button title={t("auth.createFamily")} loading={busy === "create"} disabled={!familyName.trim()} onPress={() => run("create")} />
      </View>
      <View className="gap-3 rounded-parent bg-mist p-4">
        <Text className="text-lg font-body-bold text-ink">{t("auth.joinFamily")}</Text>
        <Field
          label={t("parent.inviteCode")}
          autoCapitalize="characters"
          value={inviteCode}
          onChangeText={setInviteCode}
          placeholder={t("family.invitePlaceholder")}
        />
        <Button variant="secondary" title={t("auth.joinFamily")} loading={busy === "join"} disabled={!inviteCode.trim()} onPress={() => run("join")} />
      </View>
      <ErrorText error={error} />
      <Button variant="ghost" title={t("auth.signOut")} onPress={() => void unregisterPush().then(() => supabase.auth.signOut()).then(() => router.replace("/"))} />
    </Screen>
  );
}
