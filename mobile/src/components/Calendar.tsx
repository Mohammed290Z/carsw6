// Month calendar for picking a rental's start and end days. Days the car is booked all day are
// struck through and can't be picked or spanned; days only partly booked (a return at 10:00, a
// pick-up at 18:00) show a dot and stay selectable — the times decide, and are checked on submit.
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { addDays, iso, parse } from '@/lib/dates';
import { useI18n } from '@/lib/i18n';
import { color, HIT } from '@/lib/theme';
import { Row, Txt } from './ui';

export type DayState = 'free' | 'partial' | 'full';

export function Calendar({ min, dayState, start, end, onChange }: {
  min: string; dayState: (d: string) => DayState; start: string | null; end: string | null;
  onChange: (start: string | null, end: string | null) => void;
}) {
  const { locale, rtl, t } = useI18n();
  const [month, setMonth] = useState(() => (start ?? min).slice(0, 7));
  const first = useMemo(() => parse(`${month}-01`), [month]);
  const weeks = useMemo(() => {
    const lead = (first.getDay() + 6) % 7;                 // weeks start on Monday
    const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const cells: (string | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= days; d++) cells.push(iso(new Date(first.getFullYear(), first.getMonth(), d)));
    while (cells.length % 7) cells.push(null);
    return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  }, [first]);
  const dow = useMemo(() => Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: 'narrow' })), [locale]);
  const shift = (n: number) => { const d = new Date(first.getFullYear(), first.getMonth() + n, 1); setMonth(iso(d).slice(0, 7)); };
  const canBack = month > min.slice(0, 7);

  const spansFull = (a: string, b: string) => { for (let d = a; d <= b; d = addDays(d, 1)) if (dayState(d) === 'full') return true; return false; };
  const pick = (d: string) => {
    if (!start || end || d <= start) return onChange(d, null);       // (re)start the range
    if (spansFull(start, d)) return onChange(d, null);               // can't run through a booked day
    onChange(start, d);
  };

  return (
    <View>
      <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="‹" disabled={!canBack} onPress={() => shift(-1)} style={[styles.nav, !canBack && { opacity: 0.3 }]}>
          <Ionicons name={rtl ? 'chevron-forward' : 'chevron-back'} size={20} color={color.text} />
        </Pressable>
        <Txt v="h3" style={{ fontSize: 19 }}>{first.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</Txt>
        <Pressable accessibilityRole="button" accessibilityLabel="›" onPress={() => shift(1)} style={styles.nav}>
          <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={20} color={color.text} />
        </Pressable>
      </Row>
      <Row gap={0}>{dow.map((d, i) => <Txt key={i} v="small" center style={styles.dow}>{d}</Txt>)}</Row>
      {weeks.map((w, i) => (
        <Row key={i} gap={0}>
          {w.map((d, j) => {
            if (!d) return <View key={j} style={styles.cell} />;
            const state = dayState(d), past = d < min, disabled = past || state === 'full';
            const isEdge = d === start || d === end, inRange = !!(start && end && d > start && d < end);
            return (
              <Pressable key={j} disabled={disabled} onPress={() => pick(d)}
                accessibilityRole="button" accessibilityState={{ disabled, selected: isEdge }}
                accessibilityLabel={`${parse(d).toLocaleDateString(locale, { day: 'numeric', month: 'long' })}${state === 'full' ? `, ${t('book.busyDay')}` : ''}`}
                style={[styles.cell, inRange && styles.inRange]}>
                <View style={[styles.day, isEdge && styles.edge]}>
                  <Txt v="label" center style={[
                    { color: isEdge ? color.onPrimary : disabled ? color.disabled : color.text },
                    state === 'full' && !past && { textDecorationLine: 'line-through', color: color.struck },
                  ]}>{String(parse(d).getDate())}</Txt>
                  {state === 'partial' && !past && <View style={[styles.dot, isEdge && { backgroundColor: color.onPrimary }]} />}
                </View>
              </Pressable>
            );
          })}
        </Row>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center', borderRadius: HIT / 2, borderWidth: 1, borderColor: color.line },
  dow: { flex: 1, color: color.textDim, paddingVertical: 6 },
  cell: { flex: 1, height: HIT + 2, alignItems: 'center', justifyContent: 'center' },
  inRange: { backgroundColor: color.accentSoft },
  day: { width: HIT - 2, height: HIT - 2, borderRadius: (HIT - 2) / 2, alignItems: 'center', justifyContent: 'center' },
  edge: { backgroundColor: color.primary },
  dot: { position: 'absolute', bottom: 6, width: 4, height: 4, borderRadius: 2, backgroundColor: color.error },
});
