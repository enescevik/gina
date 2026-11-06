import { useRouteMotion } from "@/lib/use-route-motion";
import { Stack } from "expo-router";
import { usePairingLinkCapture } from "@/components/device/pending-pairing";

export default function AuthLayout() {
  const motion = useRouteMotion();
  // A pairing QR can reopen the app while sign-in/family setup is on screen.
  usePairingLinkCapture();
  return <Stack screenOptions={{ ...motion, headerShown: false }} />;
}
