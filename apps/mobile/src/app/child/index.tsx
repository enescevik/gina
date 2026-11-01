import { useQuery, useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";

import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/avatar";
import { ErrorText } from "@/components/ui/screen";
import { ChildScreen as Screen, childStyles } from "@/components/room/child-screen";
import { deviceAccess } from "@/lib/family-experience";
import { refreshClaims } from "@/lib/session";
import { supabase } from "@/lib/supabase";

/** Tablet: "Kim giriyor?" — profil seçimi, sonra PIN. */
export default function ChildPickerScreen() {
  const { t } = useTranslation();
  const children = useQuery({
    queryKey: ["child_device_profiles"],
    // Parent can change the allowlist/PIN policy while this screen is already open.
    refetchInterval: query=>query.state.data?.children.length===0?5000:30000,
    refetchIntervalInBackground:false,
    queryFn: () => deviceAccess(),
  });
  const enter=useMutation({mutationFn:async(id:string)=>{
    const {data,error}=await supabase.rpc('child_pin_login',{p_child_id:id,p_pin:''});
    if(error)throw error;if(!data)throw new Error(t('child.wrongPin'));
    await refreshClaims();router.replace('/child/today');
  },onError:()=>{void children.refetch();}});

  return (
    <Screen tone="child" loading={children.isLoading} title={t("child.pickProfile")}>
      <ErrorText error={children.error ?? enter.error} />
      {children.error ? <Button title={t("common.retry")} onPress={() => void children.refetch()} /> : null}
      <View className="flex-row flex-wrap gap-4">
        {children.data?.children.map((child) => (
          <Pressable
            key={child.id}
            accessibilityRole="button"
            style={[childStyles.card, { flexGrow: 1, flexBasis: 180, minHeight: 176, alignItems: "center", justifyContent: "center" }]}
            disabled={enter.isPending}
            onPress={() => child.needs_pin ? router.push({ pathname: "/child/pin", params: { childId: child.id, name: child.name } }) : enter.mutate(child.id)}
          >
            <View className="mb-3">
              <Avatar slug={child.avatar} size={72} />
            </View>
            <Text className="text-xl font-body-bold text-ink">{child.name}</Text>
            <Text style={{fontFamily:"Nunito_400Regular",fontSize:15,color:"#625C85",marginTop:8}}>{t(child.needs_pin?"experience.device.withPin":"experience.device.tapToEnter")}</Text>
          </Pressable>
        ))}
      </View>
      {children.data?.children.length === 0 ? (
        <Text className="font-body text-base text-gray-500">{t("experience.device.waitingProfiles")}</Text>
      ) : null}
    </Screen>
  );
}
