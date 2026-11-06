import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { aiUsageRows, parseAiUsage } from "@gina/core";

import { parentStyles } from "@/components/ui/parent-screen";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

const MB = 1024 * 1024;

/**
 * C08 — ailenin bu dönemki AI kullanımı, yenilenme tarihi ve dosya/medya sınırı. Tek kaynak `get_ai_usage()`
 * (özellik → yetenek → paket → girdi sınırı DB'de çözülür). Sunulmayan özellik (ör. 7 günlük ipucu) veya
 * paketinde olmayan özellik satır olarak görünmez; yanıt okunamazsa kart hiç gösterilmez.
 */
export function AiUsageCard() {
  const { t, i18n } = useTranslation();
  const { claims, session } = useSession();
  const isParent = claims?.role === "parent" && !!claims.family_id;
  const usage = useQuery({
    queryKey: ["ai_usage", session?.user.id, claims?.family_id],
    enabled: isParent,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_ai_usage");
      if (error) throw error;
      return parseAiUsage(data);
    },
  });
  const value = usage.data;
  if (!isParent || !value) return null;
  const rows = aiUsageRows(value);
  const date = new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "long" }).format(new Date(value.renews_at));
  return (
    <View style={parentStyles.card} testID="ai-usage-card" accessibilityLabel={t("c08.usage.title")}>
      <Text accessibilityRole="header" style={parentStyles.title}>{t("c08.usage.title")}</Text>
      {!value.enabled || rows.length === 0
        ? <Text style={parentStyles.copy}>{t("c08.usage.none")}</Text>
        : (
          <>
            {value.paused ? <Text accessibilityRole="alert" style={parentStyles.copy}>{t("c08.usage.paused")}</Text> : null}
            {rows.map((row) => (
              <View key={row.key} style={{ gap: 2 }} testID={`ai-usage-${row.key}`}>
                <Text style={[parentStyles.copy, { fontFamily: "Nunito_800ExtraBold" }]}>{t(`c08.usage.row.${row.key}`)}</Text>
                <Text style={parentStyles.copy}>
                  {t("c08.usage.counts", { used: row.used, limit: row.limit, remaining: row.remaining })}
                </Text>
              </View>
            ))}
            <Text style={parentStyles.copy}>{t("c08.usage.renews", { date })}</Text>
            {value.media
              ? (
                <Text style={parentStyles.copy} testID="ai-usage-media">
                  {t("c08.usage.media", {
                    files: value.media.max_files,
                    total: Math.round(value.media.max_total_bytes / MB),
                    image: Math.round(value.media.max_image_bytes / MB),
                    pdf: Math.round(value.media.max_pdf_bytes / MB),
                    pages: value.media.max_pdf_pages,
                  })}
                </Text>
              )
              : null}
            <Text style={parentStyles.copy}>{t("c08.usage.cost")}</Text>
          </>
        )}
    </View>
  );
}
