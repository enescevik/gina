import { useState } from "react";
import { clueCells, trUpper, type CrosswordAnswer, type CrosswordPayload } from "@gina/core";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, TextInput, View } from "react-native";
import { qt } from "./ui";

export function CrosswordQuestion({ payload, answer, disabled, onChange }: {
  payload: CrosswordPayload;
  answer?: CrosswordAnswer;
  disabled: boolean;
  onChange: (answer: CrosswordAnswer) => void;
}) {
  const { t } = useTranslation();
  const clues = payload.clues.map((clue, index) => ({ ...clue, index: index + 1, cells: clueCells(clue) }));
  const cells = answer?.cells ?? {};
  function enter(ids: string[], input: string) {
    const letters = [...trUpper(input)].filter(letter => /^[A-ZÇĞİÖŞÜ]$/.test(letter));
    const next = { ...cells };
    ids.forEach((id, index) => {
      if (letters[index]) next[id] = letters[index];
      else delete next[id];
    });
    onChange({ type: "crossword", v: 1, cells: next });
  }
  return <View style={{ gap: 12 }}>
    <ScrollView horizontal keyboardShouldPersistTaps="handled" accessibilityLabel={t("prova.qt.crossword.grid")}>
      <View accessible={false} style={{ gap: 2 }}>
        {Array.from({ length: payload.rows }, (_, row) => <View key={row} style={{ flexDirection: "row", gap: 2 }}>
          {Array.from({ length: payload.cols }, (_, col) => {
            const id = `r${row + 1}_c${col + 1}`;
            const relevant = clues.filter(clue => clue.cells.includes(id));
            if (!relevant.length) return <View key={id} aria-hidden style={{ width: 48, height: 48, backgroundColor: qt.line }} />;
            const label = t("prova.qt.crossword.cell", { row: row + 1, col: col + 1 });
            const starts = relevant.filter(clue => clue.cells[0] === id).map(clue => clue.index).join(",");
            return <View key={id} style={{ width: 48, height: 48, borderWidth: 1, borderColor: qt.line, borderRadius: 5 }}>
              {starts ? <Text aria-hidden style={{ position: "absolute", top: 1, left: 3, fontSize: 10, color: qt.ink }}>{starts}</Text> : null}
              <TextInput accessibilityLabel={label} value={cells[id] ?? ""} onChangeText={value => enter([id], value)}
                maxLength={1} editable={!disabled} autoCorrect={false} autoCapitalize="characters"
                style={{ flex: 1, textAlign: "center", color: qt.ink, fontSize: 22 }} />
            </View>;
          })}
        </View>)}
      </View>
    </ScrollView>
    {clues.map(clue => {
      const label = `${clue.index}. ${t(`prova.qt.crossword.${clue.dir}`)} · ${clue.text}`;
      // Edit the word as a separate field so assistive technology can bypass the grid.
      return <CrosswordClueInput key={clue.id} label={label} length={clue.length}
        letters={clue.cells.map(id => cells[id] ?? "").join("")}
        disabled={disabled} onCommit={value => enter(clue.cells, value)} />;
    })}
  </View>;
}


function CrosswordClueInput({ label, length, letters, disabled, onCommit }: {
  label: string; length: number; letters: string; disabled: boolean; onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return <View style={{ gap: 4 }}>
    <Text style={{ color: qt.ink, fontSize: 16 }}>{label}</Text>
    <TextInput accessibilityLabel={label} value={draft ?? letters}
      onFocus={() => setDraft(letters)}
      onChangeText={value => {
        setDraft(value);
        onCommit(value);
      }}
      onBlur={() => setDraft(null)}
      autoCorrect={false} autoCapitalize="characters" maxLength={length} editable={!disabled}
      style={{ minHeight: 48, borderWidth: 1, borderColor: qt.line, borderRadius: 10, paddingHorizontal: 12, color: qt.ink, fontSize: 18 }} />
  </View>;
}
