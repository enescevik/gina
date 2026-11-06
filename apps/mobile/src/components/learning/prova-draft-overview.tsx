import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, Trash2, Image as ImageIcon } from 'lucide-react-native';
import type { ProvaBlock } from '@gina/core';
import { Pressable } from '@/components/ui/pressable';
import { p, SatinButton } from '@/components/planner/ui';
import { SubjectIcon } from '@/components/subject-icon';
import type { DraftRecord } from '@/lib/prova-draft';
import { b } from './prova-builder-ui';
import { loadBuilderMaterial, questionsOf, type BuilderMaterial } from './prova-builder-data';

const sources = ['library', 'ai', 'manual', 'document'] as const;
const sourceColors = { library: '#75CBB5', ai: '#9277DF', manual: '#DFB16B', document: '#74ACD0' };

/** Use the same ordered material as the editor; target is not a count of saved questions. */
export function summarizeDraft(draft: DraftRecord, material: BuilderMaterial) {
  let next = 1;
  const counts = { library: 0, ai: 0, manual: 0, document: 0 };
  const rows: { id: string; kind: ProvaBlock['kind']; source: ProvaBlock['source']; title: string; first: number; last: number; prompts: string[] }[] = [];
  let incomplete = false;
  for (const block of draft.content.blocks) {
    const questions = questionsOf(block, material);
    const group = material.groups.find(g => g.id === block.id);
    if (!questions.length || (block.kind === 'group' && questions.length !== group?.question_source_members.length)) incomplete = true;
    if (!questions.length) continue;
    counts[block.source] += questions.length;
    const title = block.kind === 'group' ? group?.title ?? '' : questions[0].topic || questions[0].stem;
    const last = rows[rows.length - 1];
    if (block.kind === 'question' && last?.kind === 'question' && last.source === block.source && last.title === title) {
      last.last = next;
      last.prompts.push(questions[0].stem);
    } else {
      rows.push({ id: block.id, kind: block.kind, source: block.source, title, first: next, last: next + questions.length - 1, prompts: questions.map(q => q.stem) });
    }
    next += questions.length;
  }
  return { rows, counts, total: next - 1, incomplete };
}

export function DraftOverview({ drafts, familyId, wide, children, onDiscard }: {
  drafts: DraftRecord[]; familyId: string; wide: boolean; children?: React.ReactNode; onDiscard: (draft: DraftRecord) => void;
}) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = drafts.find(d => d.id === selectedId) ?? drafts[0];
  const blocks = drafts.flatMap(d => d.content.blocks);
  const material = useQuery({
    queryKey: ['prova_hub_material', familyId, drafts.map(d => [d.id, d.version, d.content.blocks])],
    enabled: drafts.length > 0,
    queryFn: () => loadBuilderMaterial(blocks),
  });
  const details = selected && material.data ? summarizeDraft(selected, material.data) : null;
  const count = (n: number) => t('prova.questionCount', { count: n });
  const inside = <View testID="prova-draft-inside" style={s.inside}>
    <View style={s.heading}><Text style={b.h2}>{t('provaHub.inside')}</Text>{details && !details.incomplete && <Text style={s.small}>{count(details.total)}</Text>}</View>
    {drafts.length > 1 && <Text style={s.small}>{selected.content.title || t('provaBuilder.untitled')}</Text>}
    <View style={s.sheet}>
      {material.isPending ? <ActivityIndicator accessibilityLabel={t('common.loading')} color={p.purple} style={{ margin: 24 }} />
        : material.error ? <View style={{ paddingVertical: 20, gap: 12 }}><Text style={b.error}>{t('provaHub.loadError')}</Text><SatinButton secondary title={t('common.retry')} onPress={() => void material.refetch()}/></View>
        : <>
          {details?.incomplete && <Text accessibilityRole="alert" style={[b.error, { paddingVertical: 12 }]}>{t('provaHub.incomplete')}</Text>}
          {!details?.rows.length && !details?.incomplete && <Text style={[b.muted, { paddingVertical: 24 }]}>{t('provaHub.noQuestions')}</Text>}
          {details?.rows.map(row => row.kind === 'group' ? <View key={row.id} style={s.group}>
            <View style={b.row}><ImageIcon size={21} color={p.ink}/><View style={{ flex: 1 }}><Text style={b.bold}>{row.title}</Text><Text style={s.small}>{t('provaHub.shared', { range: row.first === row.last ? row.first : `${row.first}–${row.last}` })}</Text></View></View>
            <View style={s.groupItems}>{row.prompts.map((prompt, i) => <Text key={i} style={s.prompt}>{row.first + i}. {prompt}</Text>)}</View>
          </View> : <View key={row.id} style={s.question}>
            <Text style={s.number}>{row.first === row.last ? row.first : `${row.first}–${row.last}`}</Text><View style={{ flex: 1 }}><Text style={b.bold}>{row.title}</Text><Text style={s.small}>{t(`provaHub.source.${row.source}`)}</Text></View>
          </View>)}
        </>}
    </View>
    <Text style={s.small}>{t('provaHub.insideHint')}</Text>
  </View>;
  return <View style={[s.columns, wide && { flexDirection: 'row' }]}>
    <View style={{ flex: 1.15, minWidth: 0, gap: 18 }}>
      <View style={s.heading}><Text style={b.h2}>{t('provaBuilder.drafts')}</Text><Text style={s.small}>{t('provaHub.draftCount', { count: drafts.length })}</Text></View>
      {drafts.map(d => {
        const summary = material.data ? summarizeDraft(d, material.data) : null;
        return <View key={d.id} style={s.card}>
          <View style={s.cardBody}>
            <View style={s.heading}><View style={[b.row, { flex: 1 }]}><SubjectIcon subject={d.content.subjects[0] ?? ''} size={22}/><Text style={[b.bold, { color: '#37756C', flex: 1 }]}>{d.content.subjects.join(' · ') || t('provaBuilder.untitled')}</Text></View><Text style={s.badge}>{t('provaHub.draft')}</Text></View>
            <Text style={[b.h2, { fontSize: wide ? 28 : 25, lineHeight: wide ? 34 : 32 }]}>{d.content.title || t(`provaBuilder.${d.content.purpose}`)}</Text>
            <Text style={s.small}>{d.content.grade ? t('provaHub.gradeContext', { grade: d.content.grade }) : t(`provaBuilder.${d.content.purpose}`)}</Text>
            <View style={s.facts}>
              <Text style={b.copy}>{summary && !summary.incomplete ? <><Text style={s.factNumber}>{summary.total}</Text> {t('provaHub.questionUnit', { count: summary.total })}</> : t('provaHub.target', { count: d.content.target })}</Text>
              {d.content.topics.length > 0 && <Text style={[b.copy, s.factDivider]}><Text style={s.factNumber}>{d.content.topics.length}</Text> {t('provaHub.topicUnit', { count: d.content.topics.length })}</Text>}
              <Text style={[b.copy, s.factDivider]}>{d.content.minutes ? `${d.content.minutes} ${t('prova.min')}` : t('provaBuilder.untimed')}</Text>
            </View>
            {summary && !summary.incomplete ? <>
              <View accessible={false} style={s.mix}>{sources.filter(k => summary.counts[k] > 0).map(k => <View key={k} style={{ flex: summary.counts[k], backgroundColor: sourceColors[k] }}/>)}</View>
              <Text style={s.small}>{sources.filter(k => summary.counts[k] > 0).map(k => t(`provaHub.mix.${k}`, { count: summary.counts[k] })).join(' · ') || t('provaHub.noQuestions')}</Text>
            </> : <Text style={s.small}>{t(material.error ? 'provaHub.loadError' : summary?.incomplete ? 'provaHub.incomplete' : 'common.loading')}</Text>}
            {(drafts.length > 1 && wide) && <Pressable accessibilityRole="button" accessibilityState={{ selected: d.id === selected.id }} aria-pressed={d.id === selected.id} style={s.inspect} onPress={() => setSelectedId(d.id)}><Text style={[b.bold, { color: p.purple }]}>{t('provaHub.inspect')}</Text><ArrowRight size={18} color={p.purple}/></Pressable>}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`${t('lifecycle.removeDraft')} — ${d.content.title || t('provaBuilder.untitled')}`} onPress={() => onDiscard(d)} style={[s.inspect,{paddingHorizontal:20,justifyContent:'flex-start'}]}><Trash2 size={18} color={p.muted}/><Text style={s.small}>{t('lifecycle.removeDraft')}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`${d.content.title || t('provaBuilder.untitled')} — ${t('provaBuilder.resume')}`} style={s.resume} onPress={() => router.push({ pathname: '/parent/prova/builder', params: { draftId: d.id } })}><Text style={[b.bold, { color: p.purple }]}>{t('provaBuilder.resume')}</Text><ArrowRight size={20} color={p.purple}/></Pressable>
        </View>;
      })}
      {children}
    </View>
    {wide ? <View style={s.aside}>{inside}</View> : null}
  </View>;
}
const s = StyleSheet.create({
  columns: { gap: 32, alignItems: 'stretch' },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  small: { fontFamily: 'Nunito_600SemiBold', fontSize: 14, lineHeight: 21, color: p.muted, flexShrink: 1 },
  card: { borderRadius: 26, borderWidth: 1, borderColor: '#E6DEED', backgroundColor: '#fff', overflow: 'hidden', boxShadow: '0 8px 22px #20195104' },
  cardBody: { padding: 20, gap: 10 },
  badge: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, lineHeight: 20, paddingVertical: 4, paddingHorizontal: 10, backgroundColor: '#F2EBFA', borderRadius: 10, color: '#6D538E' },
  factNumber: { fontFamily: 'Nunito_800ExtraBold', fontSize: 24, lineHeight: 30 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16, marginVertical: 5 },
  factDivider: { borderLeftWidth: 1, borderLeftColor: '#D4CCD9', paddingLeft: 16 },
  mix: { flexDirection: 'row', height: 5, borderRadius: 8, overflow: 'hidden' },
  resume: { minHeight: 60, paddingHorizontal: 24, paddingVertical: 14, backgroundColor: '#F5EFFF', borderTopWidth: 1, borderTopColor: '#E8E1EF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  inspect: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  aside: { flex: 1, minWidth: 0, borderLeftWidth: 1, borderLeftColor: '#E6DFED', paddingLeft: 32 },
  inside: { gap: 14 },
  sheet: { backgroundColor: '#FFFEFA', borderWidth: 1, borderColor: '#E7DFD4', borderRadius: 18, paddingHorizontal: 20, boxShadow: '0 6px 0 -3px #EEE8E0' },
  question: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EEE7DF' },
  number: { fontFamily: 'Nunito_800ExtraBold', color: '#827592', fontSize: 18, minWidth: 38 },
  group: { padding: 12, marginVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: '#D9C9F1', backgroundColor: '#F7F2FC' },
  groupItems: { borderLeftWidth: 2, borderLeftColor: '#D6C8ED', marginTop: 12, marginLeft: 7, paddingLeft: 15, gap: 7 },
  prompt: { fontFamily: 'Nunito_600SemiBold', fontSize: 15, lineHeight: 23, color: '#5C4D78' },
});
