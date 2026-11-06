import { useEffect, useState } from "react";
import { Redirect, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { p, SatinButton } from "@/components/planner/ui";
import { fetchProvaDrafts } from "@/lib/prova-draft";
import { provaErrorMessage } from "@/lib/prova-ai";

/**
 * C04: legacy Prova entry links (AI üretimi, senaryo/grup aracı) open the parent's current
 * unsubmitted draft instead of starting a second, blank workspace. Only when there is no
 * open draft does the builder start a new one. Nothing is saved here; a carried group is
 * offered in the builder and added only when the parent confirms.
 */
export function ProvaDraftEntry() {
  const { t } = useTranslation();
  const { groupId, childId } = useLocalSearchParams<
    { groupId?: string; childId?: string }
  >();
  const [target, setTarget] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    fetchProvaDrafts().then((drafts) => {
      if (!live) return;
      const open = drafts.filter((d) =>
        !d.submitted_at && (!childId || d.content.childId === childId)
      )[0];
      setTarget({
        ...(open ? { draftId: open.id } : {}),
        ...(groupId ? { groupId } : {}),
        ...(childId ? { childId } : {}),
      });
    }).catch((e) => live && setError(e));
    return () => {
      live = false;
    };
  }, [groupId, childId, attempt]);
  if (target) {
    return <Redirect href={{ pathname: "/parent/prova/builder", params: target }} />;
  }
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: p.cream, padding: 22, gap: 16 }}
    >
      <View accessibilityLiveRegion="polite" style={{ gap: 12 }}>
        <Text style={{ fontFamily: "Nunito_700Bold", fontSize: 17, color: p.ink }}>
          {error ? provaErrorMessage(error) : t("provaC04.openingDraft")}
        </Text>
        {error
          ? (
            <SatinButton
              title={t("common.retry")}
              onPress={() => {
                setError(null);
                setAttempt((n) => n + 1);
              }}
            />
          )
          : null}
      </View>
    </SafeAreaView>
  );
}
