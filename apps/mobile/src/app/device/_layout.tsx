import { useRouteMotion } from "@/lib/use-route-motion";
import { Stack } from "expo-router";

export default function DeviceLayout() {
  const motion = useRouteMotion();
  return <Stack screenOptions={{ ...motion, headerShown: false }} />;
}
