import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ErrorText } from "@/components/ui/screen";
import { ParentScreen as Screen, parentStyles } from "@/components/ui/parent-screen";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

/** Satırları "Konu; sayı" biçiminden blueprint satırlarına çevirir. */
function parseBlueprintRows(text: string): { topic: string; count: number }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [topic, count] = line.split(/[;|\t]/).map((p) => p.trim());
      return { topic: topic ?? "", count: Number(count ?? "1") };
    })
    .filter((r) => r.topic.length > 0);
}

/** Senaryo ekle: MEB konu-soru dağılım tablosundan konu başına soru sayısı. */
export default function BlueprintScreen() {
  const { t } = useTranslation();
  const { claims, session } = useSession();
  const familyId = claims?.family_id ?? "";
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("5");
  const [name, setName] = useState("");
  const [rowsText, setRowsText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");

  const rows = parseBlueprintRows(rowsText);

  const save = useMutation({
    mutationFn: async () => {
      if (!subject.trim() || !name.trim() || !Number.isInteger(Number(grade)) || Number(grade) < 1 || Number(grade) > 12 || rows.length === 0 || rows.some(row => !Number.isInteger(row.count) || row.count < 1 || row.count > 60)) throw new Error(t("prova.blueprintInvalid"));
      const { error } = await supabase.from("exam_blueprints").insert({
        family_id: familyId,
        subject: subject.trim(),
        grade: Number(grade) || 5,
        name: name.trim(),
        rows,
        source_url: sourceUrl.trim() || null,
        created_by: session?.user.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["blueprints", familyId] });
      router.back();
    },
  });

  return (
    <Screen title={t("prova.newBlueprint")}>
      <View style={parentStyles.card}>
      <Field label={t("grades.subject")} value={subject} onChangeText={setSubject} placeholder={t("provaV5.subjectExample")} />
      <Field label={t("prova.grade")} keyboardType="number-pad" maxLength={2} value={grade} onChangeText={setGrade} />
      <Field label={t("prova.blueprintName")} value={name} onChangeText={setName} />
      <Field
        label={t("prova.rows")}
        value={rowsText}
        onChangeText={setRowsText}
        multiline
        className="min-h-32"
        placeholder={t("provaV5.rowsExample")}
      />
      <Text className="font-body text-sm text-gray-600">{t("prova.rowsParsed", { count: rows.length, total: rows.reduce((s, r) => s + r.count, 0) })}</Text>
      <Field label={t("prova.source")} value={sourceUrl} onChangeText={setSourceUrl} autoCapitalize="none" />
      <ErrorText error={save.error} />
      <Button title={t("common.save")} loading={save.isPending} onPress={() => save.mutate()} />
      <Button variant="ghost" title={t("common.cancel")} onPress={() => router.back()} />
    </View>
    </Screen>
  );
}
