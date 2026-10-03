import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, DayState } from '@/components/Calendar';
import { CarImage } from '@/components/CarImage';
import { PickerSheet } from '@/components/Sheet';
import { Button, Card, Divider, ErrorState, Field, Notice, Row, Txt } from '@/components/ui';
import { api, ApiError, Busy } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { addDays, busySpan, diffDays, fmtDate, parse, span, TIMES, today } from '@/lib/dates';
import { useFleet } from '@/lib/fleet';
import { useI18n } from '@/lib/i18n';
import { color, HIT, radius, space } from '@/lib/theme';

const PHONE = /^\+?[0-9 ().-]{8,25}$/;
const DAY = 864e5;

export default function Book() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { t, lang, locale, money } = useI18n();
  const { car: find, fleet } = useFleet();
  const { session } = useAuth();
  const car = find(id);
  const [min] = useState(today);   // today in Casablanca, fixed for this screen

  const [busy, setBusy] = useState<Busy[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('10:00');
  const [place, setPlace] = useState('airport');
  const [flight, setFlight] = useState('');
  const [payment, setPayment] = useState<'bank' | 'crypto'>('bank');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [sheet, setSheet] = useState<null | 'startTime' | 'endTime' | 'place'>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  const crypto = fleet.business.acceptCrypto && fleet.business.cryptoWallets.length > 0;

  // when the car is taken, for the calendar (the next 400 days)
  const carName = car?.name;
  useEffect(() => {
    if (!carName) return;
    let live = true;
    api.busy(min, addDays(min, 400), carName).then(
      b => { if (live) setBusy(b); },
      e => { if (live) setLoadErr(t(e instanceof ApiError ? e.key : 'err.generic')); });
    return () => { live = false; };
  }, [carName, min, t]);
  const load = () => {
    if (!carName) return;
    setLoadErr(null);
    api.busy(min, addDays(min, 400), carName).then(setBusy, e => setLoadErr(t(e instanceof ApiError ? e.key : 'err.generic')));
  };
  // prefill from the profile (or the last booking's details)
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    api.profile().then(p => { if (p?.name) setName(n => n || p.name!); if (p?.phone) setPhone(v => v || p.phone!); }).catch(() => {});
  }, [userId]);

  const spans = useMemo(() => (busy ?? []).map(b => busySpan(b.start_at, b.end_at)), [busy]);
  const dayState = useCallback((d: string): DayState => {
    const a = parse(d).getTime(), b = a + DAY;
    let state: DayState = 'free';
    for (const [s, e] of spans) {
      if (s <= a && e >= b) return 'full';
      if (s < b && e > a) state = 'partial';
    }
    return state;
  }, [spans]);

  // opened without an account (e.g. a deep link): sign in first, then come back here
  useEffect(() => { if (!session) router.replace({ pathname: '/sign-in', params: { next: `/book/${id}` } }); }, [session, id]);

  if (!car) return <ErrorState message={t('noResults')} onRetry={() => router.back()} />;
  if (!session) return null;

  const days = start && end ? diffDays(start, end) : 0;
  const fee = fleet.places.find(p => p.id === place)?.fee ?? 0;
  const estimate = days * car.price + fee;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!start || !end || days < 1) e.dates = t('err.dates');
    else if (start < min) e.dates = t('err.past');
    else if (days > 90) e.dates = t('err.long');
    else {
      const [a, b] = span(start, startTime, end, endTime);
      if (b <= a) e.dates = t('err.dates');
      else if (spans.some(([s, f]) => s < b && f > a)) e.dates = t('err.overlap');
    }
    if (name.trim().length < 2) e.name = t('err.name');
    if (!PHONE.test(phone.trim()) || phone.replace(/\D/g, '').length < 8) e.phone = t('err.phone');
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async () => {
    setSubmitErr(null);
    if (!validate() || !start || !end) return;
    setSending(true);
    try {
      const ref = await api.submit({
        car: car.name, start, startTime, end, endTime, place, flight: place === 'airport' ? flight.trim() : '',
        payment, name: name.trim(), phone: phone.trim(), lang, days, estimate,
      });
      api.saveProfile(name.trim(), phone.trim(), lang).catch(() => {});   // prefill next time
      router.replace({ pathname: '/booking/[ref]', params: { ref, new: '1' } });
    } catch (e) {
      const key = e instanceof ApiError ? e.key : 'err.generic';
      setSubmitErr(t(key));
      if (key === 'err.unavailable') load();   // someone else just got these dates: refresh the calendar
    } finally { setSending(false); }
  };

  const select = (label: string, value: string, onPress: () => void) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} style={styles.select}>
      <View style={{ flex: 1 }}>
        <Txt v="small" style={{ color: color.textDim }}>{label}</Txt>
        <Txt v="label">{value}</Txt>
      </View>
      <Ionicons name="chevron-down" size={18} color={color.textDim} />
    </Pressable>
  );
  const sumRow = (a: string, b: string, strong = false) => (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 8 }}>
      <Txt v={strong ? 'label' : 'small'} style={{ color: strong ? color.text : color.textDim, flex: 1 }}>{a}</Txt>
      <Txt v={strong ? 'price' : 'label'}>{b}</Txt>
    </Row>
  );
  const placeLabel = (id: string) => {
    const f = fleet.places.find(p => p.id === id)?.fee ?? 0;
    return `${t(`place.${id}`)}${f ? ` (+${money(f)})` : ''}`;
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={{ padding: space.m, gap: space.l, paddingBottom: insets.bottom + space.xl }} keyboardShouldPersistTaps="handled">
        <Row gap={space.m}>
          <View style={{ width: 110 }}><CarImage car={car} height={70} ring={false} /></View>
          <View style={{ flex: 1 }}>
            <Txt v="eyebrow">{car.make}</Txt>
            <Txt v="h3">{car.model}</Txt>
            <Txt v="small" style={{ color: color.accent }}>{`${money(car.price)} ${t('perDay')}`}</Txt>
          </View>
        </Row>

        <Card style={{ gap: space.m }}>
          <Txt v="h3">{t('book.dates')}</Txt>
          <Txt v="small" style={{ color: color.textDim }}>{!start || end ? t('book.pickStart') : t('book.pickEnd')}</Txt>
          {loadErr ? <ErrorState message={loadErr} onRetry={load} />
            : !busy ? <ActivityIndicator color={color.accent} style={{ height: 300 }} />
              : <Calendar min={min} dayState={dayState} start={start} end={end} onChange={(a, b) => { setStart(a); setEnd(b); setErrors(x => ({ ...x, dates: '' })); }} />}
          <Row gap={space.s}>
            <View style={{ flex: 1 }}>
              {select(t('book.start'), `${start ? fmtDate(start, locale) : '—'} · ${startTime}`, () => setSheet('startTime'))}
            </View>
            <View style={{ flex: 1 }}>
              {select(t('book.end'), `${end ? fmtDate(end, locale) : '—'} · ${endTime}`, () => setSheet('endTime'))}
            </View>
          </Row>
          {errors.dates ? <Notice tone="error" text={errors.dates} /> : null}
        </Card>

        <Card style={{ gap: space.m }}>
          {select(t('book.place'), placeLabel(place), () => setSheet('place'))}
          {place === 'airport' && <Field label={t('book.flight')} value={flight} onChangeText={setFlight} autoCapitalize="characters" maxLength={20} placeholder="AT 201" />}
          {crypto && (
            <View style={{ gap: 8 }}>
              <Txt v="small" style={{ color: color.textDim }}>{t('book.payment')}</Txt>
              <Row gap={space.s}>
                {(['bank', 'crypto'] as const).map(p => (
                  <Pressable key={p} onPress={() => setPayment(p)} accessibilityRole="radio" accessibilityState={{ selected: payment === p }}
                    style={[styles.choice, payment === p && styles.choiceOn]}>
                    <Txt v="label">{t(`pay.${p}`)}</Txt>
                    <Txt v="small" style={{ color: color.textDim }}>{p === 'bank' ? t('pay.bankSub') : fleet.business.cryptoWallets.map(w => w.coin).join(', ')}</Txt>
                  </Pressable>
                ))}
              </Row>
            </View>
          )}
        </Card>

        <Card style={{ gap: space.m }}>
          <Txt v="h3">{t('book.you')}</Txt>
          <Field label={t('book.name')} value={name} onChangeText={setName} autoComplete="name" textContentType="name" error={errors.name} />
          <Field label={t('book.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber"
            placeholder="+212 6…" error={errors.phone} />
        </Card>

        <Card>
          <Txt v="h3" style={{ marginBottom: 4 }}>{t('book.summary')}</Txt>
          {sumRow(t('sum.rate'), money(car.price))}
          {sumRow(t('sum.days'), days ? t('days', days) : '—')}
          {sumRow(t('sum.delivery'), fee ? money(fee) : t('sum.free'))}
          {sumRow(t('sum.deposit'), money(car.deposit))}
          <Divider />
          {sumRow(t('sum.total'), days ? money(estimate) : '—', true)}
          <Txt v="small" style={{ color: color.textDim, marginTop: 6 }}>{t('book.note')}</Txt>
        </Card>

        {submitErr && <Notice tone="error" text={submitErr} />}
        <Button title={sending ? t('book.sending') : t('book.submit')} onPress={submit} loading={sending} />
      </ScrollView>

      <PickerSheet visible={sheet === 'startTime'} title={t('book.start')} value={startTime}
        options={TIMES.map(x => ({ id: x, label: x }))} onPick={setStartTime} onClose={() => setSheet(null)} />
      <PickerSheet visible={sheet === 'endTime'} title={t('book.end')} value={endTime}
        options={TIMES.map(x => ({ id: x, label: x }))} onPick={setEndTime} onClose={() => setSheet(null)} />
      <PickerSheet visible={sheet === 'place'} title={t('book.place')} value={place}
        options={fleet.places.map(p => ({ id: p.id, label: t(`place.${p.id}`), sub: p.fee ? `+${money(p.fee)}` : t('sum.free') }))}
        onPick={setPlace} onClose={() => setSheet(null)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  select: { flexDirection: 'row', alignItems: 'center', minHeight: 56, borderWidth: 1, borderColor: color.line, borderRadius: radius.s, paddingHorizontal: space.m, gap: 8 },
  choice: { flex: 1, minHeight: HIT + 20, borderWidth: 1, borderColor: color.line, borderRadius: radius.s, padding: 12, gap: 2 },
  choiceOn: { borderColor: color.accent, backgroundColor: color.accentSoft },
});
