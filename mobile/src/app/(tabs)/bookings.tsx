import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CarImage } from '@/components/CarImage';
import { Button, ErrorState, Loading, Row, StatusBadge, Txt } from '@/components/ui';
import { api, ApiError, Reservation } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate, today } from '@/lib/dates';
import { byName, useFleet } from '@/lib/fleet';
import { useI18n } from '@/lib/i18n';
import { color, radius, space } from '@/lib/theme';

export default function Bookings() {
  const insets = useSafeAreaInsets();
  const { t, locale, money } = useI18n();
  const { session, ready } = useAuth();
  const { fleet } = useFleet();
  const [list, setList] = useState<Reservation[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const userId = session?.user.id;
  const load = useCallback(async () => {
    if (!userId) return;
    setErr(null);
    try { setList(await api.myReservations()); } catch (e) { setErr(t(e instanceof ApiError ? e.key : 'err.generic')); }
  }, [userId, t]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const top = <Txt v="display" style={{ paddingTop: insets.top + space.m, paddingBottom: space.m }}>{t('bookings.title')}</Txt>;
  if (!ready) return <Loading />;
  if (!session) return (
    <View style={{ flex: 1, padding: space.m }}>
      {top}
      <View style={{ gap: space.m, marginTop: space.l }}>
        <Txt style={{ color: color.textDim }}>{t('bookings.signIn')}</Txt>
        <Button title={t('account.signIn')} onPress={() => router.push('/sign-in')} />
      </View>
    </View>
  );
  if (err && !list) return <ErrorState message={err} onRetry={load} />;
  if (!list) return <Loading />;

  const now = today();
  const upcoming = list.filter(r => r.end_date >= now && r.status !== 'cancelled' && r.status !== 'returned')
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const past = list.filter(r => !upcoming.includes(r));
  const sections = [
    ...(upcoming.length ? [{ title: t('bookings.upcoming'), data: upcoming }] : []),
    ...(past.length ? [{ title: t('bookings.past'), data: past }] : []),
  ];

  return (
    <SectionList
      sections={sections}
      keyExtractor={r => r.ref}
      contentContainerStyle={{ paddingHorizontal: space.m, paddingBottom: space.xl }}
      ListHeaderComponent={top}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => <Txt v="eyebrow" style={{ marginTop: space.m, marginBottom: space.s }}>{section.title}</Txt>}
      ItemSeparatorComponent={() => <View style={{ height: space.s }} />}
      ListEmptyComponent={
        <View style={{ gap: space.m, marginTop: space.l }}>
          <Txt style={{ color: color.textDim }}>{t('bookings.empty')}</Txt>
          <Button kind="ghost" title={t('bookings.browse')} onPress={() => router.navigate('/')} />
        </View>
      }
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={color.accent}
        onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      renderItem={({ item: r }) => {
        const car = byName(fleet.cars, r.car);
        return (
          <Link href={{ pathname: '/booking/[ref]', params: { ref: r.ref } }} asChild>
            <Pressable accessibilityRole="link" style={({ pressed }) => [styles.item, pressed && { opacity: 0.8 }, r.status === 'cancelled' && { opacity: 0.6 }]}>
              <Row gap={space.m}>
                <View style={{ width: 96 }}>{car ? <CarImage car={car} height={60} ring={false} /> : null}</View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Txt v="label">{r.car}</Txt>
                  <Txt v="small" style={{ color: color.textDim }}>{`${fmtDate(r.start_date, locale)} → ${fmtDate(r.end_date, locale)} · ${money(r.estimate)}`}</Txt>
                  <StatusBadge status={r.status} />
                </View>
              </Row>
            </Pressable>
          </Link>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  item: { borderWidth: 1, borderColor: color.line, borderRadius: radius.m, padding: space.m, backgroundColor: color.surface },
});
