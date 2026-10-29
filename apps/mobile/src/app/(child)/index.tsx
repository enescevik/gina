import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { ErrorText, Screen } from "@/components/ui/screen";
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
    <Screen tone="child" title={t("child.pickProfile")}>
      <ErrorText error={children.error} />
      <View className="flex-row flex-wrap gap-4">
        {children.data?.map((child) => (
          <Pressable
            key={child.id}
            accessibilityRole="button"
            className="min-h-32 min-w-40 flex-1 items-center justify-center rounded-child bg-white p-6 active:bg-teal-light dark:bg-night-surface"
            onPress={() => router.push({ pathname: "/(child)/pin", params: { childId: child.id, name: child.name } })}
          >
            <View className="mb-3 h-16 w-16 rounded-full bg-teal-light" />
            <Text className="text-xl font-bold text-ink dark:text-night-text">{child.name}</Text>
          </Pressable>
        ))}
      </View>
      {children.data?.length === 0 ? (
        <Text className="text-base text-gray-500">{t("child.noChildren")}</Text>
      ) : null}
    </Screen>
  );
}
