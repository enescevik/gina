import { Volume2, VolumeX } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import type { RoomAtmosphere } from "@/lib/use-room-atmosphere";
import type { RoomAudio } from "@/lib/use-room-audio";
import { AtmosphereStatus } from "./atmosphere-status";
export function AtmosphereControls({
  atmosphere,
  audio,
}: {
  atmosphere: RoomAtmosphere;
  audio: RoomAudio;
}) {
  const { t } = useTranslation();
  const Icon = audio.listening ? Volume2 : VolumeX;
  return (
    <View style={{ gap: 3 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 10,
          paddingVertical: 4,
          backgroundColor: "#FFF8EF",
          borderRadius: 16,
          borderColor: "#E2CFB2",
          borderWidth: 1,
        }}
      >
        <AtmosphereStatus atmosphere={atmosphere} />
        {audio.allowed ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(
              audio.listening ? "atmosphere.soundOff" : "atmosphere.soundOn",
            )}
            accessibilityState={{ selected: audio.listening }}
            onPress={audio.toggle}
            style={{
              minWidth: 48,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon size={22} color="#0B7F7F" />
          </Pressable>
        ) : null}
      </View>
      {audio.error && audio.allowed ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{
            fontFamily: "Nunito_600SemiBold",
            color: "#7D382E",
            fontSize: 12,
            backgroundColor: "#FFF8EF",
          }}
        >
          {t("atmosphere.soundError")}
        </Text>
      ) : null}
    </View>
  );
}
