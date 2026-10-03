import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CarImage } from '@/components/CarImage';
import { Button, Card, ErrorState, Notice, Row, Txt } from '@/components/ui';
import { api, ApiError, Busy } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { addDays, fmtDate, today } from '@/lib/dates';
import { useFleet } from '@/lib/fleet';
import { useI18n } from '@/lib/i18n';
import { color, space } from '@/lib/theme';

export default function CarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { t, lang, fmt, money, locale } = useI18n();
  const { car: find } = useFleet();
  const { session } = useAuth();
  const car = find(id);
  const [busy, setBusy] = useState<Busy[] | null>(null);
  const [busyErr, setBusyErr] = useState<string | null>(null);

  const name = car?.name;
  const fetchBusy = useCallback(() => name ? api.busy(today(), addDays(today(), 60), name) : Promise.resolve([] as Busy[]), [name]);
  const onErr = useCallback((e: unknown) => setBusyErr(t(e instanceof ApiError ? e.key : 'err.generic')), [t]);
  useEffect(() => { let live = true; fetchBusy().then(b => live && setBusy(b), e => live && onErr(e)); return () => { live = false; }; }, [fetchBusy, onErr]);
  const load = () => { setBusyErr(null); setBusy(null); fetchBusy().then(setBusy, onErr); };

  if (!car) return <ErrorState message={t('noResults')} onRetry={() => router.back()} />;

  const book = () => {
    const target = { pathname: '/book/[id]' as const, params: { id: car.id } };
    if (session) router.push(target);
    else router.push({ pathname: '/sign-in', params: { next: `/book/${car.id}` } });
  };
  const spec = (label: string, value: string) => (
    <View style={styles.spec}><Txt v="small" style={{ color: color.textDim }}>{label}</Txt><Txt v="h3">{value}</Txt></View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}>
        <View style={{ paddingTop: insets.top + 48, backgroundColor: color.surface }}>
          <CarImage car={car} width={1200} height={250} />
        </View>
        <View style={{ padding: space.m, gap: space.l }}>
          <View style={{ gap: 4 }}>
            <Txt v="eyebrow">{car.make}</Txt>
            <Txt v="display">{car.model}</Txt>
            <Row gap={6} style={{ alignItems: 'baseline', marginTop: 4 }}>
              <Txt v="small" style={{ color: color.textDim }}>{t('from')}</Txt>
              <Txt v="price" style={{ fontSize: 28 }}>{fmt(car.price)}</Txt>
              <Txt v="small" style={{ color: color.textDim }}>{`${t('currency')} ${t('perDay')}`}</Txt>
            </Row>
          </View>
          <Txt style={{ color: color.textDim, fontSize: 17, lineHeight: 26 }}>{car.pitch[lang]}</Txt>
          <View style={styles.specs}>
            {spec(t('spec.power'), `${fmt(car.power)} ${t('unit.hp')}`)}
            {spec(t('spec.accel'), `${car.accel.toLocaleString(locale)} ${t('unit.s')}`)}
            {spec(t('spec.seats'), fmt(car.seats))}
            {spec(t('spec.deposit'), money(car.deposit))}
          </View>
          <Notice text={t('car.depositNote', { amount: money(car.deposit) })} />
          <Card style={{ gap: space.s }}>
            <Txt v="h3">{t('car.availability')}</Txt>
            {busyErr ? <ErrorState message={busyErr} onRetry={load} />
              : !busy ? <ActivityIndicator color={color.accent} />
                : busy.length === 0 ? <Txt style={{ color: color.ok }}>{t('car.freeNext')}</Txt>
                  : busy.map((b, i) => (
                    <Row key={i} gap={10}>
                      <View style={styles.busyDot} />
                      <Txt v="small" style={{ color: color.text }}>
                        {t('car.busyUntil', { a: fmtDate(b.start_at.slice(0, 10), locale), b: fmtDate(b.end_at.slice(0, 10), locale) })}
                      </Txt>
                    </Row>
                  ))}
          </Card>
        </View>
      </ScrollView>
      <View style={[styles.bar, { paddingBottom: insets.bottom + space.s }]}>
        <Button title={t('car.book')} onPress={book} icon="calendar" accessibilityLabel={`${t('car.book')} ${car.the[lang]}`} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  specs: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderColor: color.line },
  spec: { width: '50%', paddingVertical: 14, paddingEnd: space.m, borderBottomWidth: 1, borderColor: color.line, gap: 2 },
  busyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.error },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.m, paddingTop: space.s,
    backgroundColor: color.bar, borderTopWidth: 1, borderColor: color.line },
});
