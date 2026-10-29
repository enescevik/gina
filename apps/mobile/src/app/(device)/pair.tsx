import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { ErrorText, Screen } from "@/components/ui/screen";
import { refreshClaims, useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

/**
 * Çocuk tableti kurulumu: anonim oturum açılır, 6 haneli kod üretilir,
 * veli telefonundan "Cihaz ekle" ile kod girilince claim'ler yenilenir ve çocuk alanına geçilir.
 */
export default function PairScreen() {
  const { session, claims, loading, isAnonymous } = useSession();
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (loading || session) return;
    void supabase.auth.signInAnonymously().then(({ error: e }) => e && setError(e));
  }, [loading, session]);

  useEffect(() => {
    if (claims?.role === "device") router.replace("/(child)");
  }, [claims?.role]);

  useEffect(() => {
    if (!code) return;
    const timer = setInterval(() => {
      void refreshClaims()
        .then((next) => {
          if (next?.role === "device") {
            clearInterval(timer);
            router.replace("/(child)");
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
    <Screen tone="child" title="Tableti aileye bağla">
      <Text className="text-base text-ink dark:text-night-text">
        Veli telefonunda Gina&apos;yı aç, &laquo;Cihaz ekle&raquo; de ve buradaki kodu gir. Kod 10 dakika geçerli.
      </Text>
      {code ? (
        <View className="items-center rounded-child bg-white p-8 dark:bg-night-surface">
          <Text className="text-5xl font-bold tracking-widest text-teal-dark">{code}</Text>
          <Text className="mt-3 text-sm text-gray-500">Eşleşme bekleniyor…</Text>
        </View>
      ) : (
        <Button size="child" title="Eşleştirme kodu al" loading={busy || !isAnonymous} onPress={requestCode} />
      )}
      <ErrorText error={error} />
      <Button
        variant="ghost"
        title="Bu cihaz veli telefonu"
        onPress={() => void supabase.auth.signOut().then(() => router.replace("/(auth)/sign-in"))}
      />
    </Screen>
  );
}
