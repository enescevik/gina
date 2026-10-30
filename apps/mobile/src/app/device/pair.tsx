import { router } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { ErrorText, Screen } from "@/components/ui/screen";
import { refreshClaims, useSession } from "@/lib/session";
import { unregisterPush } from "@/lib/push";
import { supabase } from "@/lib/supabase";

/**
 * Çocuk tableti kurulumu: anonim oturum açılır, 6 haneli kod üretilir,
 * veli telefonundan "Cihaz ekle" ile kod girilince claim'ler yenilenir ve çocuk alanına geçilir.
 */
export default function PairScreen() {
  const { t } = useTranslation();
  const { session, claims, loading, isAnonymous } = useSession();
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (loading || session) return;
    void supabase.auth.signInAnonymously().then(({ error: e }) => e && setError(e));
  }, [loading, session]);

  useEffect(() => {
    if (claims?.role === "device") router.replace("/child");
  }, [claims?.role]);

  useEffect(() => {
    if (!code) return;
    const timer = setInterval(() => {
      void refreshClaims()
        .then((next) => {
          if (next?.role === "device") {
            clearInterval(timer);
            router.replace("/child");
          }
        })
        .catch(setError);
    }, 5000);
    return () => clearInterval(timer);
  }, [code]);

  async function requestCode() {
    setBusy(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("request_pairing", { p_device_name: "Tablet" });
      if (rpcError) throw rpcError;
      setCode(data);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen tone="child" title={t("device.pairTitle")}>
      <Text className="font-body text-base text-ink dark:text-night-text">
        {t("device.pairHelp")}
      </Text>
      {code ? (
        <View className="items-center rounded-child bg-white p-8 dark:bg-night-surface">
          <Text className="text-5xl font-body-bold tracking-widest text-teal-dark">{code}</Text>
          <Text className="font-body mt-3 text-sm text-gray-500">{t("device.waiting")}</Text>
        </View>
      ) : (
        <Button size="child" title={t("device.getCode")} loading={busy || !isAnonymous} onPress={requestCode} />
      )}
      <ErrorText error={error} />
      <Button
        variant="ghost"
        title={t("device.thisIsParentPhone")}
        onPress={() => void unregisterPush().then(() => supabase.auth.signOut()).then(() => router.replace("/(auth)/sign-in"))}
      />
    </Screen>
  );
}
