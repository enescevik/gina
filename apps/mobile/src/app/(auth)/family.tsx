import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { FamilyChoicePanel } from "@/components/family-choice";
import { AccountDeletion } from "@/components/account-deletion";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ErrorText } from "@/components/ui/screen";
import { refreshClaims, useSession } from "@/lib/session";
import { unregisterPush } from "@/lib/push";
import {
  ParentScreen as Screen,
  parentStyles,
} from "@/components/ui/parent-screen";
import { supabase } from "@/lib/supabase";

/** Giriş yapmış ama henüz bir ailesi olmayan veli: aile kurar ya da davet koduyla katılır. */
export default function FamilyScreen() {
  const { t } = useTranslation();
  const { session, isAnonymous } = useSession();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [familyName, setFamilyName] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | "out" | null>(null);
  const [error, setError] = useState<unknown>(null);

  async function createFamily() {
    if (busy) return;
    setBusy("create");
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc("create_family", {
        p_name: familyName.trim(),
      });
      if (rpcError) throw rpcError;
      await refreshClaims();
      router.replace("/");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }

  if (!session || isAnonymous) {
    return (
      <Screen
        navigation={false}
        title={t("unified.parentLogin")}
        subtitle={t("accountV5.registeredFamily")}
      >
        <Button
          title={t("auth.signIn")}
          onPress={() => router.replace("/(auth)/sign-in")}
        />
      </Screen>
    );
  }

  return (
    <Screen
      navigation={false}
      title={t("accountV5.familyTitle")}
      subtitle={t("accountV5.familyBody")}
    >
      <View style={{ flexDirection: "row", gap: 8 }}>
        {(["create", "join"] as const).map((option) => (
          <View key={option} style={{ flex: 1 }}>
            <Button
              title={t(
                option === "create" ? "auth.createFamily" : "auth.joinFamily",
              )}
              variant={mode === option ? "primary" : "secondary"}
              disabled={!!busy}
              onPress={() => {
                setMode(option);
                setError(null);
              }}
            />
          </View>
        ))}
      </View>
      {mode === "create"
        ? (
          <View style={parentStyles.form}>
            <Text style={parentStyles.copy}>
              {t("unified.familyCreateHelp")}
            </Text>
            <Text className="text-lg font-body-bold text-ink">
              {t("auth.createFamily")}
            </Text>
            <Field
              label={t("family.name")}
              maxLength={80}
              value={familyName}
              onChangeText={setFamilyName}
              placeholder={t("family.namePlaceholder")}
            />
            <Button
              title={t("auth.createFamily")}
              loading={busy === "create"}
              disabled={!!busy || !familyName.trim()}
              onPress={() => void createFamily()}
            />
          </View>
        )
        : <FamilyChoicePanel />}
      <ErrorText error={error} />
      <AccountDeletion />
      <Button
        variant="ghost"
        title={t("auth.signOut")}
        loading={busy === "out"}
        disabled={!!busy}
        onPress={async () => {
          setBusy("out");
          setError(null);
          try {
            await unregisterPush();
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            router.replace("/");
          } catch (e) {
            setError(e);
          } finally {
            setBusy(null);
          }
        }}
      />
    </Screen>
  );
}
