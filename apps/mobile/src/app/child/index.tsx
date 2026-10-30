import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { Avatar } from "@/components/avatar";
import { ErrorText } from "@/components/ui/screen";
import { ChildScreen as Screen, childStyles } from "@/components/room/child-screen";
import { supabase } from "@/lib/supabase";

/** Tablet: "Kim giriyor?" — profil seçimi, sonra PIN. */
export default function ChildPickerScreen() {
  const { t } = useTranslation();
  const children = useQuery({
    queryKey: ["children"],
    queryFn: async () => {
      const { data, error } = await supabase.from("children").select("id, name, avatar, grade").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  return (
    <Screen tone="child" loading={children.isLoading} title={t("child.pickProfile")}>
      <ErrorText error={children.error} />
      <View className="flex-row flex-wrap gap-4">
        {children.data?.map((child) => (
          <Pressable
            key={child.id}
            accessibilityRole="button"
            style={[childStyles.card, { flexGrow: 1, flexBasis: 180, minHeight: 176, alignItems: "center", justifyContent: "center" }]}
            onPress={() => router.push({ pathname: "/child/pin", params: { childId: child.id, name: child.name } })}
          >
            <View className="mb-3">
              <Avatar slug={child.avatar} size={72} />
            </View>
            <Text className="text-xl font-bold text-ink">{child.name}</Text>
          </Pressable>
        ))}
      </View>
      {children.data?.length === 0 ? (
        <Text className="text-base text-gray-500">{t("child.noChildren")}</Text>
      ) : null}
    </Screen>
  );
}
