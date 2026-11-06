import { channelErrorKey, preferenceCell, type MyNotificationChannels, type NotificationChannel, type NotificationPurpose } from "@gina/core";
import { useMutation } from "@tanstack/react-query";
import { Lock } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { parentStyles } from "@/components/ui/parent-screen";
import { Toggle } from "@/components/ui/toggle";
import { supabase } from "@/lib/supabase";

const PURPOSES: NotificationPurpose[] = ["service", "announcement", "marketing"];
const CHANNELS: NotificationChannel[] = ["in_app", "push", "email", "sms"];

/**
 * Channel × purpose matrix. Each purpose is its own card (phone width), each channel a row.
 * Locked rows say why (required, verify first, push settings above, legal review) instead of a dead switch.
 * Every change is logged server-side with the consent wording version.
 */
export function ChannelPreferences({ view, onSaved }: { view: MyNotificationChannels; onSaved: (next: MyNotificationChannels) => void }) {
  const { t } = useTranslation();
  const save = useMutation({
    mutationFn: async ({ channel, purpose, enabled }: { channel: NotificationChannel; purpose: NotificationPurpose; enabled: boolean }) => {
      const { data, error } = await supabase.rpc("set_notification_preference", { p_channel: channel, p_purpose: purpose, p_enabled: enabled });
      if (error) throw error;
      return data as unknown as MyNotificationChannels;
    },
    onSuccess: (next) => onSaved(next),
  });
  const message = save.error && typeof save.error === "object" && "message" in save.error ? String(save.error.message) : null;

  return <View style={{ gap: 16 }}>
    {PURPOSES.map(purpose => <View key={purpose} testID={`purpose-${purpose}`} style={parentStyles.card}>
      <View style={{ gap: 4 }}>
        <Text accessibilityRole="header" style={[parentStyles.copy, { fontFamily: "Nunito_800ExtraBold" }]}>{t(`channels.purpose.${purpose}`)}</Text>
        <Text style={parentStyles.muted}>{t(`channels.purpose.${purpose}Hint`)}</Text>
      </View>
      {CHANNELS.map(channel => {
        const cell = preferenceCell(view, channel, purpose);
        const label = t(`channels.channel.${channel}`);
        if (cell.state === "locked") {
          return <View key={channel} testID={`pref-${channel}-${purpose}`} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52 }}>
            <View style={{ width: 51, alignItems: "center" }}><Lock size={20} color="#756397" /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: "Nunito_600SemiBold", fontSize: 17, color: "#201951" }}>{label} · {t(cell.value ? "channels.state.on" : "channels.state.off")}</Text>
              <Text style={parentStyles.muted}>{t(`channels.locked.${cell.reason}`)}</Text>
            </View>
          </View>;
        }
        return <View key={channel} testID={`pref-${channel}-${purpose}`} style={{ gap: 2 }}>
          <Toggle label={label} value={cell.value} disabled={save.isPending} onChange={enabled => save.mutate({ channel, purpose, enabled })} />
          {cell.note ? <Text style={parentStyles.muted}>{t(`channels.note.${cell.note}`)}</Text> : null}
        </View>;
      })}
    </View>)}
    {save.isSuccess ? <Text testID="channel-pref-saved" accessibilityLiveRegion="polite" style={parentStyles.muted}>{t("channels.saved")}</Text> : null}
    {save.error ? <Text accessibilityRole="alert" style={[parentStyles.copy, { color: "#A43135" }]}>{t(channelErrorKey(message))}</Text> : null}
  </View>;
}
