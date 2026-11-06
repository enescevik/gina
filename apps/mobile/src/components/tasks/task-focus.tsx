import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { Timer } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { advanceFocus, changeFocus, FOCUS_MINUTES, startFocus, type FocusAction, type FocusState } from '@gina/core';
import { c, s } from '@/components/child-home/theme';
import { Button } from '@/components/ui/button';
import { Pressable } from '@/components/ui/pressable';
import { focusScope, focusStorage } from '@/lib/focus-storage';
import { useSession } from '@/lib/session';

type Task = { id: string; title: string; status: string | null };
export function TaskFocus({ childId, day, tasks, selectedId, onSelect }: {
  childId: string; day: string; tasks: Task[]; selectedId: string | null; onSelect: (id: string) => void;
}) {
  const { session, claims } = useSession();
  if (!session || !claims?.family_id) return null;
  const scope = focusScope(session.user.id, claims.family_id, childId, day);
  return <FocusPanel key={scope} scope={scope} tasks={tasks} selectedId={selectedId} onSelect={onSelect} />;
}
/**
 * Read-only: is a focus timer stored for this child/day? Lets the home screen say a timer is still open after the
 * task sheet was closed (closing the sheet never stops or changes the timer). Never writes.
 */
export function useOpenFocus(childId: string, day: string) {
  const { session, claims } = useSession();
  const scope = session && claims?.family_id && childId && day ? focusScope(session.user.id, claims.family_id, childId, day) : null;
  const [open, setOpen] = useState<{ taskId: string; phase: FocusState['phase']; running: boolean } | null>(null);
  useEffect(() => {
    if (!scope) return;
    const storage = focusStorage(scope);
    const read = () => {
      try { const x = storage.read(); setOpen(x ? { taskId: x.taskId, phase: advanceFocus(x, Date.now()).phase, running: x.runningSince !== null } : null); }
      catch { setOpen(null); }
    };
    read();
    const interval = setInterval(read, 2000);
    return () => clearInterval(interval);
  }, [scope]);
  return scope ? open : null;
}
function FocusPanel({ scope, tasks, selectedId, onSelect }: {
  scope: string; tasks: Task[]; selectedId: string | null; onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  const storage = useMemo(() => focusStorage(scope), [scope]);
  const [state, setState] = useState<FocusState | null>(null);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [minutes, setMinutes] = useState(10);
  const [ending, setEnding] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const tick = useEffectEvent(() => {
    const time = Date.now();
    setNow(time);
    if (!state || state.runningSince === null || error) return;
    const next = advanceFocus(state, time);
    // Store only transitions; the visible countdown does not write every second.
    if (next.runningSince !== null) { setState(next); return; }
    try { storage.write(next); setState(next); } catch { setError(true); }
  });
  const checkpoint = useEffectEvent(() => {
    if (!state || error) return;
    const next = advanceFocus(state, Date.now());
    try { storage.write(next); setState(next); } catch { setError(true); }
  });
  useEffect(() => {
    const reload = () => {
      try { setState(storage.read()); setError(false); }
      catch { setError(true); }
      setNow(Date.now()); setReady(true);
    };
    reload();
    const subscription = AppState.addEventListener('change', status => { if (status === 'active') reload(); else checkpoint(); });
    const interval = setInterval(() => tick(), 1000);
    return () => { subscription.remove(); clearInterval(interval); };
  }, [storage]);
  const current = state ? advanceFocus(state, now) : null;
  const available = tasks.filter(task => task.status === null || task.status === 'returned');
  const target = available.find(task => task.id === selectedId);
  const activeTask = tasks.find(task => task.id === current?.taskId);
  const eligible = activeTask && (activeTask.status === null || activeTask.status === 'returned');
  const save = (value: FocusState | null) => {
    try { storage.write(value); setState(value); setNow(Date.now()); setEnding(false); setError(false); }
    catch { setError(true); }
  };
  const act = (action: FocusAction) => { if (state && !error) save(changeFocus(state, action, Date.now())); };
  if (!ready || (!target && !current && !error)) return null;
  if (!current && !error && !expanded) return <Button variant="secondary" title={t('focus.choose')} onPress={() => setExpanded(true)} />;
  const remaining = current?.phase === 'break' ? current.breakRemainingMs : current?.remainingMs ?? minutes * 60_000;
  const seconds = Math.ceil(remaining / 1000);
  const display = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  const phase = current?.phase === 'finished' ? 'finished' : current?.phase === 'break' ? 'rest' : current?.runningSince != null ? 'running' : current ? 'paused' : 'title';
  return <View style={styles.panel} testID="task-focus">
    <View style={s.row}><Timer size={24} color={c.purple} /><Text accessibilityRole="header" style={[s.heading, { flex: 1 }]}>{t(`focus.${phase}`)}</Text></View>
    <Text style={[s.text, s.bold]}>{current ? activeTask?.title ?? t('focus.unavailable') : target?.title}</Text>
    <Text style={styles.time} accessibilityLabel={t('focus.remaining', { minutes: Math.floor(seconds / 60), seconds: seconds % 60 })}>{display}</Text>
    {!current && <View style={styles.options}>{FOCUS_MINUTES.map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{selected: minutes === value}} aria-pressed={minutes === value} onPress={() => setMinutes(value)} style={[styles.option, minutes === value && styles.selected]}><Text style={[s.text, {color: minutes === value ? c.white : c.ink}, s.bold, minutes === value && {color:c.white}]}>{t('focus.minutes', {count:value})}</Text></Pressable>)}</View>}
    <Text style={s.text}>{t(current?.phase === 'finished' ? 'focus.finishedHelp' : current?.phase === 'break' ? 'focus.restHelp' : current ? 'focus.activeHelp' : 'focus.help')}</Text>
    {error && !ending ? <View style={{gap:8}}><Text accessibilityRole="alert" style={s.text}>{t('focus.storageError')}</Text><Button variant="ghost" title={t('focus.reset')} onPress={() => setEnding(true)} /><Button variant="secondary" title={t('common.retry')} onPress={() => { try {setState(storage.read()); setError(false);setNow(Date.now());} catch {setError(true);} }} /></View>
      : ending ? <View style={{gap:8}}><Text style={s.text}>{t('focus.endHelp')}</Text><Button variant="secondary" title={t('focus.confirmEnd')} onPress={() => save(null)}/><Button variant="ghost" title={t('common.cancel')} onPress={() => setEnding(false)}/></View>
      : !current ? <Button title={t('focus.start')} disabled={!target} onPress={() => { if(target) save(startFocus(target.id, minutes, Date.now())); }} />
      : current.phase === 'finished' ? <Button variant="secondary" title={t('focus.back')} onPress={() => {const id=current.taskId;save(null);onSelect(id);}} />
      : <>
        {!eligible ? <Text style={s.text}>{t('focus.taskChanged')}</Text> : <>
          {/* Molada birincil eylem molayı bitirmek: molayı "duraklatmak" çocuğa anlamlı bir seçenek değildi. */}
          {current.phase === 'break'
            ? <Button title={t('focus.return')} onPress={() => act('return')} />
            : <Button title={t(current.runningSince !== null ? 'focus.pause' : 'focus.resume')} onPress={() => act(current.runningSince !== null ? 'pause' : 'resume')} />}
          <View style={[s.row, {flexWrap:'wrap', justifyContent:'space-between'}]}>
            {current.phase === 'break' ? null : <Button variant="ghost" title={t('focus.break')} onPress={() => act('break')}/>}
            <Button variant="ghost" title={t('focus.end')} onPress={() => setEnding(true)}/>
          </View>
          {selectedId !== current.taskId && <Button variant="ghost" title={t('focus.openTask')} onPress={() => onSelect(current.taskId)}/>}
        </>}
        {!eligible && <Button variant="secondary" title={t('focus.end')} onPress={() => setEnding(true)}/>}
      </>}
    <Text style={s.small}>{t('focus.local')}</Text>
  </View>;
}
const styles = StyleSheet.create({
  panel: { backgroundColor: '#F0ECFC', borderRadius: 22, padding: 16, gap: 12 },
  time: {fontFamily:'Nunito_800ExtraBold',fontSize:56,lineHeight:68,color:c.ink,textAlign:'center',fontVariant:['tabular-nums']},
  options: {flexDirection:'row',flexWrap:'wrap',gap:8,justifyContent:'center'},
  option: {flex:1,minWidth:52,minHeight:48,paddingHorizontal:6,alignItems:'center',justifyContent:'center',borderRadius:16,backgroundColor:c.white},
  selected: {backgroundColor:c.purple},
});
