import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Button } from "./ui/button";
import { Field } from "./ui/field";
import { Toggle } from "./ui/toggle";
import { parentStyles } from "./ui/parent-screen";
import { supabase } from "@/lib/supabase";

/** Available before family setup as well as in the parent menu. No client-side admin key. */
export function AccountDeletion() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const remove = useMutation({
    mutationFn: async () => {
      if (!confirmed || !password) throw new Error("confirmation_required");
      const { data, error } = await supabase.functions.invoke("delete-account", { body: { confirm: true, password } });
      if (error || data?.ok !== true) throw error ?? new Error("deletion_failed");
      setDeleted(true); setPassword("");
      // The server has already deleted Auth and its refresh tokens. Local cleanup must not mask success.
      const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
      if (signOutError) throw signOutError;
      router.replace("/(auth)/sign-in");
    },
  });
  if (deleted) return <View style={parentStyles.card}><Text style={parentStyles.copy}>{t("accountV5.deleteDone")}</Text>
    <Button title={t("auth.signIn")} onPress={async () => { await supabase.auth.signOut({ scope: "local" }); router.replace("/(auth)/sign-in"); }} /></View>;
  if (!open) return <Button variant="ghost" title={t("accountV5.deleteTitle")} onPress={() => setOpen(true)} />;
  return <View style={parentStyles.card}>
    <Text style={parentStyles.title}>{t("accountV5.deleteTitle")}</Text>
    <Text style={parentStyles.copy}>{t("accountV5.deleteBody")}</Text>
    <Text style={parentStyles.copy}>{t("accountV5.deleteStore")}</Text>
    <Text style={parentStyles.muted}>{t("accountV5.deletePassword")}</Text>
    <Field label={t("auth.password")} secureTextEntry autoComplete="current-password" value={password} onChangeText={setPassword} editable={!remove.isPending} />
    <Toggle label={t("accountV5.deleteConfirm")} value={confirmed} onChange={setConfirmed} disabled={remove.isPending} />
    {remove.error ? <Text accessibilityRole="alert" style={[parentStyles.copy, { color: "#A43135" }]}>{t("accountV5.deleteFailed")}</Text> : null}
    <Button variant="danger" title={t("accountV5.deleteNow")} loading={remove.isPending} disabled={!confirmed || !password} onPress={() => remove.mutate()} />
    <Button variant="ghost" title={t("common.cancel")} disabled={remove.isPending} onPress={() => { setOpen(false); setPassword(""); setConfirmed(false); remove.reset(); }} />
  </View>;
}
