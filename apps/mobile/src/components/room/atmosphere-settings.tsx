import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, Pressable, Text, View } from "react-native";
import { WEATHER_CITIES } from "@gina/core";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { useRoomSettings } from "@/lib/use-room-atmosphere";
import { Button } from "../ui/button";
import { Field } from "../ui/field";
import { Toggle } from "../ui/toggle";
import { ErrorText } from "../ui/screen";
import { parentStyles } from "../ui/parent-screen";

const normalize = (s: string) =>
  s
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i");
export function AtmosphereSettings() {
  const { t } = useTranslation();
  const { claims } = useSession();
  const cache = useQueryClient();
  const settings = useRoomSettings();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [linkError, setLinkError] = useState<unknown>();
  const save = useMutation({
    mutationFn: async (value: {
      city_id?: string | null;
      sound_enabled?: boolean;
      motion_enabled?: boolean;
    }) => {
      if (!claims?.family_id || !settings.isSuccess)
        throw new Error(t("release.genericError"));
      const { error } = await supabase
        .from("family_room_settings")
        .upsert({
          family_id: claims.family_id,
          ...settings.data,
          ...value,
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
    },
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["room_settings"] });
      setExpanded(false);
    },
  });
  const city = WEATHER_CITIES.find((c) => c.id === settings.data?.city_id);
  const disabled = save.isPending || !settings.isSuccess;
  const cities = WEATHER_CITIES.filter((c) =>
    normalize(c.name).includes(normalize(search)),
  ).slice(0, 8);
  return (
    <View style={parentStyles.card}>
      <Text style={parentStyles.title}>{t("atmosphere.settingsTitle")}</Text>
      <Text style={parentStyles.copy}>{t("atmosphere.privacy")}</Text>
      <Button
        title={
          city
            ? `${t("atmosphere.city")}: ${city.name}`
            : t("atmosphere.chooseCity")
        }
        variant="secondary"
        disabled={disabled}
        onPress={() => setExpanded(!expanded)}
      />
      {expanded ? (
        <View style={{ gap: 8 }}>
          <Field
            label={t("atmosphere.searchCity")}
            value={search}
            onChangeText={setSearch}
            editable={!save.isPending}
          />
          {cities.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={item.name}
              disabled={save.isPending}
              onPress={() => save.mutate({ city_id: item.id })}
              style={{
                minHeight: 48,
                padding: 12,
                borderRadius: 12,
                backgroundColor: item.id === city?.id ? "#D9F4F2" : "#FFFCF6",
              }}
            >
              <Text style={parentStyles.copy}>{item.name}</Text>
            </Pressable>
          ))}
          {!cities.length ? (
            <Text style={parentStyles.copy}>{t("atmosphere.noCity")}</Text>
          ) : null}
          <Button
            title={t("atmosphere.clearCity")}
            variant="ghost"
            disabled={save.isPending}
            onPress={() => save.mutate({ city_id: null })}
          />
        </View>
      ) : null}
      <Toggle
        label={t("atmosphere.motion")}
        value={settings.data?.motion_enabled ?? true}
        disabled={disabled}
        onChange={(motion_enabled) => save.mutate({ motion_enabled })}
      />
      <Toggle
        label={t("atmosphere.sound")}
        value={settings.data?.sound_enabled ?? false}
        disabled={disabled}
        onChange={(sound_enabled) => save.mutate({ sound_enabled })}
      />
      <Text style={parentStyles.muted}>{t("atmosphere.soundHelp")}</Text>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t("atmosphere.source")}
        style={{ minHeight: 48, justifyContent: "center" }}
        onPress={() => {
          void Linking.openURL("https://api.met.no/doc/License").catch(
            setLinkError,
          );
        }}
      >
        <Text style={[parentStyles.muted, { color: "#0B7F7F" }]}>
          {t("atmosphere.source")}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="link"
        style={{ minHeight: 48, justifyContent: "center" }}
        onPress={() => {
          void Linking.openURL("https://www.geonames.org/about.html").catch(
            setLinkError,
          );
        }}
      >
        <Text style={[parentStyles.muted, { color: "#0B7F7F" }]}>
          {t("atmosphere.citiesSource")}
        </Text>
      </Pressable>
      <Button
        title={t("atmosphere.soundSource")}
        variant="ghost"
        onPress={() => router.push("/parent/room-credits")}
      />
      <ErrorText error={settings.error ?? save.error ?? linkError} />
      {settings.error ? (
        <Button
          title={t("common.retry")}
          onPress={() => {
            void settings.refetch();
          }}
        />
      ) : null}
    </View>
  );
}
