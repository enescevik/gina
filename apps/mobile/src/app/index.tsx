import { Redirect } from "expo-router";
import { ActivityIndicator, Platform, View } from "react-native";
import { readAuthRedirectError, type AuthRedirectError } from "@gina/core";

import { usePairingLinkCapture, usePendingPairing } from "@/components/device/pending-pairing";
import { useSession } from "@/lib/session";

/** An auth redirect that falls back to the site root (expired/used e-mail link) keeps its reason for sign-in. */
function rootRedirectError(): AuthRedirectError | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  return readAuthRedirectError(window.location.search, window.location.hash);
}

/** Rol yönlendirmesi: JWT'deki `gina` claim'ine göre doğru alana gider. */
export default function Index() {
  const { session, claims, loading, isAnonymous } = useSession();
  // A child device QR opened while signed out lands here; keep its code for after sign-in.
  usePairingLinkCapture();
  const pendingPairing = usePendingPairing();

  if (loading || (claims?.role === "parent" && pendingPairing === undefined)) {
    return (
      <View className="flex-1 items-center justify-center bg-cream dark:bg-night">
        <ActivityIndicator color="#6042DE" />
      </View>
    );
  }
  if (!session) {
    const redirectError = rootRedirectError();
    return <Redirect href={redirectError ? { pathname: "/(auth)/sign-in", params: redirectError } : "/(auth)/sign-in"} />;
  }
  // Never pairs by itself: the pair screen shows the device and family and asks to confirm.
  if (claims?.role === "parent") return <Redirect href={pendingPairing ? { pathname: "/parent/pair-device", params: { resume: "1" } } : "/parent"} />;
  if (claims?.role === "device") return <Redirect href={claims.child_id ? "/child/today" : "/child"} />;
  if (isAnonymous) return <Redirect href="/device/pair" />;
  return <Redirect href="/(auth)/family" />;
}
