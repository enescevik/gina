import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {Image,Text,View} from "react-native";
import { useTranslation } from "react-i18next";
import { InfoCard } from "@/components/ui/parent-screen";

import { Button } from "@/components/ui/button";
import { PinEntry } from "@/components/ui/pin-entry";
import { ErrorText } from "@/components/ui/screen";
import { ChildScreen as Screen } from "@/components/room/child-screen";
import { refreshClaims } from "@/lib/session";
import { supabase } from "@/lib/supabase";

export default function ChildPinScreen() {
  const { t } = useTranslation();
  const { childId, name } = useLocalSearchParams<{ childId: string; name?: string }>();
  const [help,setHelp]=useState(false);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit() {
    if (busy || !childId || !/^\d{4}$/.test(pin)) return;
    setBusy(true);
    setError(null);
    try {
      const { data: ok, error: rpcError } = await supabase.rpc("child_pin_login", { p_child_id: childId, p_pin: pin });
      if (rpcError) throw rpcError;
      if (!ok) {
        setError(new Error(t("child.wrongPin")));
        setPin("");
        return;
      }
      await refreshClaims();
      router.replace("/child/today");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen tone="child" title={name ? t("child.hello", { name }) : t("child.enterPin")}>
      <View style={{alignItems:"center",gap:12}}>
        <Image accessible={false} source={require('../../../../../packages/assets/brand/growing-friend/contextual/device.png')} resizeMode="contain" style={{width:156,height:156}}/>
        <Text style={{fontFamily:"Nunito_600SemiBold",fontSize:17,color:"#625C85",textAlign:"center"}}>{t('experience.pin.prompt')}</Text>
      </View>
      <PinEntry label={t("childV5.pinLabel")} value={pin} onChange={setPin} disabled={busy} onSubmit={()=>void submit()}/>
      <ErrorText error={error} />
      <Button size="child" title={t("unified.enterMyWorld")} loading={busy} disabled={!childId || pin.length !== 4} onPress={submit} />
      <Button variant="ghost" title={t('experience.pin.help')} onPress={()=>setHelp(!help)}/>
      {help?<InfoCard title={t("unified.pinHelpTitle")} body={t("unified.childPinInstruction")}/>:null}
      <Button variant="ghost" title={t("common.cancel")} disabled={busy} onPress={() => router.back()} />
    </Screen>
  );
}
