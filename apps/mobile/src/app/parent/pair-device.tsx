import { useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Text } from "react-native";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { InfoCard, ParentScreen, parentStyles } from "@/components/ui/parent-screen";
import { ErrorText } from "@/components/ui/screen";
import { PairingSteps } from "@/components/device/pairing-steps";
import { supabase } from "@/lib/supabase";

const expired = (error: unknown) => /invalid_or_expired_code/.test(String((error as { message?: string } | null)?.message ?? ""));

/**
 * Parent side of device pairing. Reached by scanning the child device's QR with the phone camera
 * (the link carries only the short-lived code) or by typing the 6-digit code. Pairing never
 * happens silently: the parent confirms, then chooses children and the PIN rule.
 */
export default function PairDeviceScreen() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ code?: string }>();
  const fromQr = typeof params.code === "string" && /^\d{6}$/.test(params.code);
  const [code, setCode] = useState(fromQr ? (params.code as string) : "");
  const sending = useRef(false);
  const pair = useMutation({
    mutationFn: async (value: string) => {
      const { data, error } = await supabase.rpc("pair_child_device", { p_code: value });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (deviceId) => {
      void qc.invalidateQueries({ queryKey: ["devices"] });
      if (deviceId) router.replace({ pathname: "/parent/device-access", params: { deviceId } });
    },
    onSettled: () => { sending.current = false; },
  });
  const valid = /^\d{6}$/.test(code);
  return (
    <ParentScreen title={t("u02.parentPair.title")} subtitle={t("u02.parentPair.body")}>
      <PairingSteps current={3} />
      <InfoCard title={t("u02.parentPair.cameraTitle")} body={t("u02.parentPair.cameraBody")} />
      {fromQr ? <Text accessibilityLiveRegion="polite" style={parentStyles.muted}>{t("u02.parentPair.fromQr")}</Text> : null}
      <Field
        label={t("unified.pairCode")}
        keyboardType="number-pad"
        autoComplete="off"
        maxLength={6}
        editable={!pair.isPending}
        value={code}
        onChangeText={(v) => { setCode(v.replace(/\D/g, "").slice(0, 6)); pair.reset(); }}
      />
      {expired(pair.error)
        ? <InfoCard title={t("u02.parentPair.expiredTitle")} body={t("u02.parentPair.expiredBody")} />
        : <ErrorText error={pair.error} />}
      <Button
        title={t("u02.parentPair.confirm")}
        disabled={!valid}
        loading={pair.isPending}
        onPress={() => {
          if (!valid || sending.current) return;
          sending.current = true;
          pair.mutate(code);
        }}
      />
      <Text style={parentStyles.muted}>{t("u02.parentPair.next")}</Text>
      <Button variant="ghost" title={t("common.cancel")} disabled={pair.isPending} onPress={() => (router.canGoBack() ? router.back() : router.replace("/parent"))} />
    </ParentScreen>
  );
}
