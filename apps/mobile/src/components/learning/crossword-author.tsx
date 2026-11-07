import { trUpper, type CrosswordPayload } from "@gina/core";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { parentStyles } from "@/components/ui/parent-screen";

type ClueDraft = { id: string; dir: "across" | "down"; row: string; col: string; text: string; answer: string };
export type CrosswordDraft = { rows: string; cols: string; clues: ClueDraft[]; next: number };

const newClue = (id: number): ClueDraft => ({ id: `clue${id}`, dir: "across", row: "1", col: "1", text: "", answer: "" });
export const newCrosswordDraft = (): CrosswordDraft => ({ rows: "5", cols: "5", clues: [newClue(1)], next: 2 });

export function buildCrossword(draft: CrosswordDraft) {
  const payload: CrosswordPayload = {
    rows: Number(draft.rows), cols: Number(draft.cols),
    clues: draft.clues.map(clue => ({ id: clue.id, dir: clue.dir, row: Number(clue.row), col: Number(clue.col),
      length: trUpper(clue.answer).length, text: clue.text.trim() })),
  };
  return { payload, answer_key: { answers: Object.fromEntries(draft.clues.map(clue => [clue.id, trUpper(clue.answer)])) } };
}

export function CrosswordAuthor({ draft, onChange, disabled }: {
  draft: CrosswordDraft; onChange: (draft: CrosswordDraft) => void; disabled: boolean;
}) {
  const { t } = useTranslation();
  function changeClue(id: string, changes: Partial<ClueDraft>) {
    onChange({ ...draft, clues: draft.clues.map(clue => clue.id === id ? { ...clue, ...changes } : clue) });
  }
  return <View style={{ gap: 12 }}>
    <Field label={t("prova.qt.crossword.rows")} value={draft.rows} onChangeText={rows => onChange({ ...draft, rows })} keyboardType="number-pad" maxLength={2} editable={!disabled} />
    <Field label={t("prova.qt.crossword.cols")} value={draft.cols} onChangeText={cols => onChange({ ...draft, cols })} keyboardType="number-pad" maxLength={2} editable={!disabled} />
    {draft.clues.map((clue, index) => <View key={clue.id} style={parentStyles.card}>
      <Text style={parentStyles.muted}>{t("prova.qt.crossword.clue", { number: index + 1 })}</Text>
      <Button title={t(`prova.qt.crossword.${clue.dir}`)} variant="secondary" disabled={disabled}
        onPress={() => changeClue(clue.id, { dir: clue.dir === "across" ? "down" : "across" })} />
      <Field label={t("prova.qt.crossword.startRow")} value={clue.row} onChangeText={row => changeClue(clue.id, { row })} keyboardType="number-pad" maxLength={2} editable={!disabled} />
      <Field label={t("prova.qt.crossword.startCol")} value={clue.col} onChangeText={col => changeClue(clue.id, { col })} keyboardType="number-pad" maxLength={2} editable={!disabled} />
      <Field label={t("prova.qt.crossword.hint")} value={clue.text} onChangeText={text => changeClue(clue.id, { text })} maxLength={300} editable={!disabled} />
      <Field label={t("prova.qt.crossword.word")} value={clue.answer} onChangeText={answer => changeClue(clue.id, { answer })} maxLength={12} editable={!disabled} />
      {draft.clues.length > 1 && <Button title={t("common.delete")} variant="ghost" disabled={disabled}
        onPress={() => onChange({ ...draft, clues: draft.clues.filter(item => item.id !== clue.id) })} />}
    </View>)}
    {draft.clues.length < 20 && <Button title={t("prova.qt.crossword.add")} variant="secondary" disabled={disabled}
      onPress={() => onChange({ ...draft, clues: [...draft.clues, newClue(draft.next)], next: draft.next + 1 })} />}
  </View>;
}
