import {EmailVerification} from "@/components/email-verification";
import { Redirect, router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { RoomChildHome } from "@/components/room/child-home";
import { InfoCard, parentStyles } from "@/components/ui/parent-screen";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ChildScreen as Screen } from "@/components/room/child-screen";
import { ErrorText } from "@/components/ui/screen";
import { useChildMode } from "@/lib/child-mode";
import { supabase } from "@/lib/supabase";

/** Veli telefonunda kilitli çocuk görünümü; çıkış veli PIN'i ister. */
export default function ChildModeTodayScreen() {
  const { t } = useTranslation();
  const { session } = useSession();
  const socialOnly=!!session?.user.identities?.length&&!session.user.identities.some(i=>i.provider==='email');
  const [password,setPassword] = useState("");
  const { actingChild, exit } = useChildMode();
  const [asking, setAsking] = useState(false);
  const [forgot,setForgot] = useState(false);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);


  if (!actingChild) return <Redirect href="/parent/child-mode" />;

  if (!asking) {
    return <RoomChildHome childId={actingChild.id} childName={actingChild.name} actingAsParent onParentExit={() => setAsking(true)} />;
  }

  async function confirmExit() {
    if (busy || !/^\d{4}$/.test(pin)) return;
    setBusy(true);
    setError(null);
    try {
      const { data: ok, error: rpcError } = await supabase.rpc("verify_parent_pin", { p_pin: pin });
      if (rpcError) throw rpcError;
      if (!ok) {
        setError(new Error(t("childMode.wrongParentPin")));
        setPin("");
        return;
      }
      await exit();
      router.replace("/parent");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen tone="child" title={t("child.hello", { name: actingChild.name })}>
      {asking ? (
        <View style={parentStyles.card}>
          <Text style={parentStyles.title}>{t("childMode.parentPin")}</Text><Text style={parentStyles.copy}>{t("unified.parentExitHelp")}</Text>
          <Field label={t("childMode.parentPin")} keyboardType="number-pad" secureTextEntry maxLength={4} editable={!busy} value={pin} onChangeText={value => setPin(value.replace(/\D/g, ""))} className="text-center text-2xl tracking-widest" />
          <ErrorText error={error} />
          <Button title={t("childMode.exit")} loading={busy} disabled={pin.length !== 4} onPress={confirmExit} />
          <Button variant="ghost" title={t("common.cancel")} disabled={busy} onPress={() => { setAsking(false); setPin(""); setError(null);setForgot(false);setPassword(""); }} />
          <Button variant="ghost" title={t("unified.forgotParentPin")} disabled={busy} onPress={()=>setForgot(!forgot)}/>
          {forgot ? <InfoCard title={t("unified.forgotParentPin")} body={t("unified.forgotParentPinHelp")}>
            {socialOnly ? <EmailVerification onVerified={async()=>{await exit();router.replace('/parent/menu?section=security');}}/> : <>
            <Field label={t("auth.password")} secureTextEntry autoComplete="current-password" value={password} onChangeText={setPassword} editable={!busy}/>
            <Button variant="secondary" title={t("unified.verifyParentPassword")} disabled={!password || !session?.user.email} loading={busy} onPress={async()=>{
              if(busy || !session?.user.email || !password)return;
              setBusy(true);setError(null);
              try {
                const {data,error:authError}=await supabase.auth.signInWithPassword({email:session.user.email,password});
                if(authError)throw authError;
                if(data.user?.id !== session.user.id)throw new Error("unauthenticated");
                await exit();setPassword("");router.replace({pathname:"/parent/menu",params:{section:"security"}});
              }catch(e){setError(e);}finally{setBusy(false);}
            }}/></>}
          </InfoCard>:null}
        </View>
      ) : (
        <Button variant="ghost" title={t("childMode.exit")} onPress={() => setAsking(true)} />
      )}
    </Screen>
  );
}
