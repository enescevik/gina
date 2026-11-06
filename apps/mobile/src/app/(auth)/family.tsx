import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Home, UserPlus } from "lucide-react-native";

import { FamilyChoicePanel } from "@/components/family-choice";
import { AccountDeletion } from "@/components/account-deletion";
import { AuthIssueText, classifyAuthIssue, type AuthIssue } from "@/components/social-sign-in";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ErrorText } from "@/components/ui/screen";
import { refreshClaims, useSession } from "@/lib/session";
import { unregisterPush } from "@/lib/push";
import {
  NavigationCard,
  ParentScreen as Screen,
  parentStyles,
} from "@/components/ui/parent-screen";
import { supabase } from "@/lib/supabase";

/**
 * Giriş yapmış ama henüz bir ailesi olmayan veli. Önce niyet: yeni aile kur ya da mevcut aileye katıl.
 * Hesap silme ve çıkış bu kurulumun ana eylemi değildir; altta "Hesap seçenekleri" içinde durur.
 */
export default function FamilyScreen() {
  const { t } = useTranslation();
  const { session, isAnonymous } = useSession();
  const [mode, setMode] = useState<"create" | "join" | null>(null);
  const [familyName, setFamilyName] = useState("");
  const [busy, setBusy] = useState<"create" | "out" | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [issue, setIssue] = useState<AuthIssue | null>(null);
  const [showDeletion, setShowDeletion] = useState(false);

  async function signOut(reason?: "session_expired") {
    setBusy("out");
    setError(null);
    try {
      await unregisterPush().catch(() => undefined);
      // An expired session cannot reach the server; clear only this device then.
      const { error } = await supabase.auth.signOut(reason ? { scope: "local" } : undefined);
      if (error) throw error;
      router.replace(reason ? { pathname: "/(auth)/sign-in", params: { reason } } : "/");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }

  async function createFamily() {
    if (busy) return;
    setBusy("create");
    setError(null);
    setIssue(null);
    try {
      const { error: rpcError } = await supabase.rpc("create_family", {
        p_name: familyName.trim(),
      });
      if (rpcError) throw rpcError;
      await refreshClaims();
      router.replace("/");
    } catch (e) {
      const next = classifyAuthIssue(e);
      if (next === "session_expired" || next === "offline") setIssue(next);
      else setError(e);
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
      {mode === null
        ? (
          <View style={{ gap: 12 }}>
            <Text accessibilityRole="header" style={parentStyles.title}>{t("u01.familyIntentTitle")}</Text>
            <NavigationCard
              title={t("u01.familyCreateTitle")}
              body={t("u01.familyCreateBody")}
              icon={<Home color="#6042DE" />}
              onPress={() => setMode("create")}
            />
            <NavigationCard
              title={t("u01.familyJoinTitle")}
              body={t("u01.familyJoinBody")}
              icon={<UserPlus color="#6042DE" />}
              onPress={() => setMode("join")}
            />
          </View>
        )
        : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <Text accessibilityRole="header" style={[parentStyles.title, { flexShrink: 1 }]}>
              {t(mode === "create" ? "u01.familyCreateTitle" : "u01.familyJoinTitle")}
            </Text>
            <Button
              variant="ghost"
              title={t("u01.familyChange")}
              disabled={!!busy}
              onPress={() => { setMode(null); setError(null); setIssue(null); }}
            />
          </View>
        )}
      {mode === "create"
        ? (
          <View style={parentStyles.form}>
            <Text style={parentStyles.copy}>
              {t("unified.familyCreateHelp")}
            </Text>
            <Field
              label={t("family.name")}
              maxLength={80}
              value={familyName}
              onChangeText={setFamilyName}
              placeholder={t("u01.familyNamePlaceholder")}
              returnKeyType="go"
              onSubmitEditing={() => { if (familyName.trim()) void createFamily(); }}
            />
            <Button
              title={t("auth.createFamily")}
              loading={busy === "create"}
              disabled={!!busy || !familyName.trim()}
              onPress={() => void createFamily()}
            />
          </View>
        )
        : mode === "join" ? <FamilyChoicePanel /> : null}
      <ErrorText error={error} />
      <AuthIssueText issue={issue} />
      {issue === "session_expired"
        ? <Button title={t("u01.signInAgain")} loading={busy === "out"} onPress={() => void signOut("session_expired")} />
        : null}
      <View style={[parentStyles.card, { gap: 8, marginTop: 24 }]}>
        <Text style={parentStyles.title}>{t("u01.accountOptions")}</Text>
        <Text style={parentStyles.muted}>{t("u01.accountOptionsBody", { email: session.user.email ?? "" })}</Text>
        <Button
          variant="secondary"
          title={t("auth.signOut")}
          loading={busy === "out"}
          disabled={!!busy}
          onPress={() => void signOut()}
        />
        <Button
          variant="ghost"
          title={t(showDeletion ? "u01.hideDeletion" : "u01.showDeletion")}
          aria-expanded={showDeletion}
          accessibilityState={{ expanded: showDeletion }}
          disabled={!!busy}
          onPress={() => setShowDeletion(value => !value)}
        />
        {showDeletion ? <AccountDeletion /> : null}
      </View>
    </Screen>
  );
}
