import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, Text, View } from "react-native";
import { ParentScreen, parentStyles } from "@/components/ui/parent-screen";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/screen";
const credits = [
  { key: "rainCredit", url: "https://commons.wikimedia.org/wiki/File:Sound_of_rain.ogg", license: "https://creativecommons.org/licenses/by-sa/3.0/" },
  { key: "windCredit", url: "https://soundbible.com/1810-Wind.html", license: "https://creativecommons.org/licenses/by/3.0/" },
  { key: "catCredit", url: "https://commons.wikimedia.org/wiki/File:Whiskers%27_purr.ogg", license: null },
];
export default function RoomCredits() {
  const { t } = useTranslation(); const [error, setError] = useState<unknown>();
  const open = (url: string) => { void Linking.openURL(url).catch(setError); };
  return <ParentScreen title={t("atmosphere.credits")} subtitle={t("atmosphere.creditsIntro")}>
    {credits.map(item => <View key={item.key} style={parentStyles.card}>
      <Text style={parentStyles.copy}>{t(`atmosphere.${item.key}`)}</Text>
      <Button title="Wikimedia / SoundBible" variant="secondary" onPress={() => open(item.url)} />
      {item.license ? <Button title={t("atmosphere.license")} variant="ghost" onPress={() => open(item.license!)} /> : null}
    </View>)}
    <ErrorText error={error} />
  </ParentScreen>;
}
