import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { AccountDeletion } from "@/components/account-deletion";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ErrorText } from "@/components/ui/screen";
import { refreshClaims } from "@/lib/session";
import { unregisterPush } from "@/lib/push";
import { ParentScreen as Screen, parentStyles } from "@/components/ui/parent-screen";
import { supabase } from "@/lib/supabase";

/** Giriş yapmış ama henüz bir ailesi olmayan veli: aile kurar ya da davet koduyla katılır. */
export default function FamilyScreen() {
  const { t } = useTranslation();
  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | "out" | null>(null);
  const [error, setError] = useState<unknown>(null);

  async function run(kind: "create" | "join") {
    if (busy) return;
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
    <Screen navigation={false} title={t("accountV5.familyTitle")} subtitle={t("accountV5.familyBody")}>
      <View style={parentStyles.form}>
        <Text className="text-lg font-body-bold text-ink">{t("auth.createFamily")}</Text>
        <Field label={t("family.name")} maxLength={80} value={familyName} onChangeText={setFamilyName} placeholder={t("family.namePlaceholder")} />
        <Button title={t("auth.createFamily")} loading={busy === "create"} disabled={!!busy || !familyName.trim()} onPress={() => run("create")} />
      </View>
      <View style={parentStyles.card}>
        <Text className="text-lg font-body-bold text-ink">{t("auth.joinFamily")}</Text>
        <Field
          label={t("parent.inviteCode")}
          autoCapitalize="characters"
          value={inviteCode}
          maxLength={8} onChangeText={value => setInviteCode(value.replace(/[^a-f0-9]/gi, "").toUpperCase())}
          placeholder={t("family.invitePlaceholder")}
        />
        <Button variant="secondary" title={t("auth.joinFamily")} loading={busy === "join"} disabled={!!busy || !/^[A-F0-9]{8}$/i.test(inviteCode.trim())} onPress={() => run("join")} />
      </View>
      <ErrorText error={error} />
      <AccountDeletion />
      <Button variant="ghost" title={t("auth.signOut")} loading={busy === "out"} disabled={!!busy} onPress={async () => {
        setBusy("out"); setError(null);
        try { await unregisterPush(); const { error } = await supabase.auth.signOut(); if (error) throw error; router.replace("/"); }
        catch (e) { setError(e); } finally { setBusy(null); }
      }} />
    </Screen>
  );
}
