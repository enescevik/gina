import type { ReactNode } from "react";
import { router } from "expo-router";
import { ArrowLeft, Menu } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/avatar";
import { Collectible } from "@/components/collectible";
import { LoadingStar } from "@/components/collectible-motion";
import { Button } from "./button";
import { ErrorText } from "./screen";

export interface ParentScreenProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  home?: boolean;
  navigation?: boolean;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
}
/** Approved v5 paper surface. Text stays native; only the window vignette is raster art. */
export function ParentScreen({ title, subtitle, children, home = false, navigation = true, loading, error, onRetry }: ParentScreenProps) {
  const { t } = useTranslation();
  return <SafeAreaView style={styles.root}>
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={styles.fill} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <Image source={require("../../../../../packages/assets/rooms/v2/parent-header-v5.webp")} accessible={false} pointerEvents="none" resizeMode="contain" style={styles.art} />
          <View style={styles.topbar}>
            {navigation ? <Pressable accessibilityRole="button" accessibilityLabel={t(home ? "parent.menu" : "common.back")}
              onPress={() => home ? router.push("/parent/menu") : router.canGoBack() ? router.back() : router.replace("/parent")}
              style={({ pressed }) => [styles.back, { opacity: pressed ? .65 : 1 }]}>
              {home ? <Menu size={23} color="#294A48" /> : <ArrowLeft size={23} color="#294A48" />}
            </Pressable> : null}
            <Text style={styles.eyebrow}>{t(navigation ? "release.parentSpace" : "app.name")}</Text>
          </View>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.body}>
          {loading ? <View style={styles.state} accessibilityLiveRegion="polite"><LoadingStar size={64} accessibilityLabel={t("release.loading")} /><Text style={styles.copy}>{t("release.loading")}</Text></View>
            : error ? <View style={styles.state}><Collectible slug="display-bookworm" size={96} /><Text style={styles.sectionTitle}>{t("release.loadError")}</Text><ErrorText error={error} />{onRetry ? <Button title={t("common.retry")} onPress={onRetry} /> : null}</View>
              : children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export function EmptyCard({ title, body, slug = "display-first-task", children }: { title: string; body?: string; slug?: string; children?: ReactNode }) {
  return <View style={styles.state}><Collectible slug={slug} size={88} /><Text style={styles.sectionTitle}>{title}</Text>{body ? <Text style={[styles.copy, { textAlign: "center" }]}>{body}</Text> : null}{children}</View>;
}

export function ChildPicker({ profiles, selected, onSelect, allLabel }: {
  profiles: { id: string; name: string; avatar?: string | null }[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  allLabel?: string;
}) {
  const options = allLabel ? [{ id: null, name: allLabel, avatar: null }, ...profiles] : profiles;
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
    {options.map(child => <Pressable key={child.id ?? "all"} accessibilityRole="button" accessibilityState={{ selected: selected === child.id }} aria-pressed={selected === child.id}
      onPress={() => onSelect(child.id)} style={({ pressed }) => ({ minHeight: 52, paddingLeft: child.id ? 4 : 16, paddingRight: 16, paddingVertical: 4, borderRadius: 28, borderWidth: 1,
        borderColor: selected === child.id ? "#0B7F7F" : "#D7CDBB", backgroundColor: selected === child.id ? "#0B7F7F" : "#FFFCF6", flexDirection: "row", alignItems: "center", gap: 8, opacity: pressed ? .8 : 1 })}>
      {child.id ? <Avatar slug={child.avatar} size={40} /> : null}<Text style={{ fontFamily: "Nunito_700Bold", fontSize: 17, color: selected === child.id ? "#FFFFFF" : "#294A48" }}>{child.name}</Text>
    </Pressable>)}
  </View>;
}

export const parentStyles = StyleSheet.create({
  card: { backgroundColor: "#FFFCF6", borderColor: "#E4DAC8", borderWidth: 1, borderRadius: 16, padding: 17, gap: 12, boxShadow: "0 3px 0 rgba(145,112,65,0.07)" },
  form: { backgroundColor: "#E6F3ED", borderColor: "#C4DCD0", borderWidth: 1, borderRadius: 16, padding: 17, gap: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56 },
  title: { fontFamily: "Baloo2_700Bold", fontSize: 24, lineHeight: 30, color: "#294A48" },
  copy: { fontFamily: "Nunito_400Regular", fontSize: 17, lineHeight: 25, color: "#294A48" },
  muted: { fontFamily: "Nunito_400Regular", fontSize: 15, lineHeight: 22, color: "#63736B" },
});
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFF8EF" }, fill: { flex: 1 },
  page: { width: "100%", maxWidth: 760, alignSelf: "center", paddingBottom: 32 },
  header: { minHeight: 186, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 22, overflow: "hidden" },
  art: { position: "absolute", width: 320, height: 205, right: -64, top: -4, opacity: .9 },
  topbar: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 14 },
  back: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 24, borderWidth: 1, borderColor: "#D7CDBB", backgroundColor: "#FFFAF0" },
  eyebrow: { fontFamily: "Nunito_700Bold", fontSize: 11, letterSpacing: 1.4, color: "#63736B", backgroundColor: "#FFF8EF", borderRadius: 8, padding: 5 },
  title: { fontFamily: "Baloo2_700Bold", fontSize: 32, lineHeight: 36, color: "#294A48", maxWidth: "68%" },
  subtitle: { fontFamily: "Nunito_400Regular", fontSize: 15, lineHeight: 22, color: "#63736B", maxWidth: "68%", marginTop: 5 },
  body: { paddingHorizontal: 20, gap: 14 },
  state: { alignItems: "center", gap: 14, borderRadius: 16, borderWidth: 1, borderColor: "#E4DAC8", backgroundColor: "#FFFCF6", padding: 24, minHeight: 230 },
  sectionTitle: { fontFamily: "Baloo2_700Bold", fontSize: 23, lineHeight: 29, color: "#294A48", textAlign: "center" },
  copy: { fontFamily: "Nunito_400Regular", fontSize: 17, lineHeight: 25, color: "#63736B" },
});
