import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {View,Text} from 'react-native';
import {Pressable} from './ui/pressable';
import type {GeneratedQuestion} from '@/lib/prova-ai';
export function QuestionCard({ index, question: q }: { index: number; question: GeneratedQuestion }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <View className="gap-2 rounded-parent border border-mist bg-white p-3">
      <Text className="font-body text-xs text-gray-500">
        {index}. {q.topic} · {t(`prova.kind.${q.kind}`)} · {t(`prova.difficulty.${q.difficulty}`)}
      </Text>
      <Text className="font-body-bold text-base text-ink">{q.stem}</Text>
      {q.choices?.map((c) => (
        <Text key={c.key} className={c.key === q.correct_key ? "font-body-bold text-green" : "text-ink"}>
          {c.key}) {c.text}
        </Text>
      ))}
      {q.kind === "open_ended" && q.expected_answer ? (
        <Text className="font-body text-sm text-ink">
          <Text className="font-body-bold">{t("prova.expected")}: </Text>
          {q.expected_answer}
        </Text>
      ) : null}
      <Pressable accessibilityRole="button" style={{ minHeight: 48, justifyContent: "center" }} accessibilityState={{ expanded: open }} onPress={() => setOpen((v) => !v)}>
        <Text className="font-body-bold text-teal-dark">{open ? t("prova.ai.hideSolution") : t("prova.ai.showSolution")}</Text>
      </Pressable>
      {open ? (
        <View className="gap-1">
          {q.solution ? (
            <Text className="font-body text-sm text-gray-600">
              <Text className="font-body-bold">{t("prova.solution")}: </Text>
              {q.solution}
            </Text>
          ) : null}
          {q.explanation ? <Text className="font-body text-sm text-gray-600">{q.explanation}</Text> : null}
          {q.source_urls.length ? <Text className="font-body text-xs text-gray-500">{t("prova.ai.sources")}: {q.source_urls.join(", ")}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}
