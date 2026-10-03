import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CarImage } from '@/components/CarImage';
import { CryptoPay } from '@/components/CryptoPay';
import { Button, Card, Divider, ErrorState, Loading, Notice, Row, StatusBadge, Txt } from '@/components/ui';
import { api, ApiError, Reservation, ResEvent } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate, hhmm } from '@/lib/dates';
import { byName, useFleet } from '@/lib/fleet';
import { useI18n } from '@/lib/i18n';
import { enablePush, pushStatus } from '@/lib/push';
import { color, space } from '@/lib/theme';

export default function BookingScreen() {
  const { ref, new: fresh } = useLocalSearchParams<{ ref: string; new?: string }>();
  const insets = useSafeAreaInsets();
  const { t, locale, money } = useI18n();
  const { fleet } = useFleet();
  const { session } = useAuth();
  const [r, setR] = useState<Reservation | null>(null);
  const [events, setEvents] = useState<ResEvent[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [push, setPush] = useState<'on' | 'off' | 'unsupported'>('unsupported');

  const userId = session?.user.id;
  const load = useCallback(async () => {
    if (!userId) return;
    setErr(null);
    try {
      const all = await api.myReservations();
      const found = all.find(x => x.ref === String(ref).toUpperCase());
      if (!found) { setErr(t('err.generic')); return; }
      setR(found);
      setEvents(await api.events(found.ref));
    } catch (e) { setErr(t(e instanceof ApiError ? e.key : 'err.generic')); } finally { setLoading(false); }
  }, [ref, userId, t]);
  useFocusEffect(useCallback(() => { load(); pushStatus().then(setPush); }, [load]));

  if (!session) return <ErrorState message={t('bookings.signIn')} onRetry={() => router.push('/sign-in')} />;
  if (loading) return <Loading />;
  if (err || !r) return <ErrorState message={err ?? t('err.generic')} onRetry={load} />;

  const car = byName(fleet.cars, r.car);
  const cancel = () => {
    const go = async () => {
      setCancelling(true);
      try { await api.cancel(r.ref); setNotice(t('res.cancelled')); await load(); }
      catch (e) { setNotice(t(e instanceof ApiError ? e.key : 'err.generic')); }
      finally { setCancelling(false); }
    };
    if (Platform.OS === 'web') { if (globalThis.confirm?.(`${t('res.cancelQ')}\n${t('res.cancelBody')}`)) go(); return; }
    Alert.alert(t('res.cancelQ'), t('res.cancelBody'), [
      { text: t('res.keep'), style: 'cancel' }, { text: t('res.cancelYes'), style: 'destructive', onPress: go },
    ]);
  };
  const wa = fleet.business.whatsapp
    ? () => Linking.openURL(`https://wa.me/${fleet.business.whatsapp}?text=${encodeURIComponent(`${t('res.ref')} ${r.ref} — ${r.car}`)}`)
    : null;
  const active = r.status !== 'cancelled' && r.status !== 'returned';
  const showCrypto = active && r.payment === 'crypto' && r.payment_status !== 'paid' && fleet.business.cryptoWallets.length > 0;
  const payText = r.payment_status === 'paid' ? t('res.payNext.paid') : r.payment === 'crypto' ? t('res.payNext.crypto') : t('res.payNext.bank');
  const line = (label: string, value: string) => (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 10 }} gap={space.m}>
      <Txt v="small" style={{ color: color.textDim }}>{label}</Txt>
      <Txt v="label" style={{ flexShrink: 1, textAlign: 'right' }}>{value}</Txt>
    </Row>
  );

  return (
    <>
      <Stack.Screen options={{ title: r.ref }} />
      <ScrollView style={{ backgroundColor: color.bg }} contentContainerStyle={{ padding: space.m, gap: space.l, paddingBottom: insets.bottom + space.xl }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={color.accent} />}>
        {fresh === '1' && r.status === 'new' && (
          <Card style={{ gap: space.s, borderColor: color.accent }}>
            <Row gap={10}><Ionicons name="checkmark-circle" size={24} color={color.accent} /><Txt v="h3">{t('sent.title')}</Txt></Row>
            <Txt style={{ color: color.textDim }}>{t('sent.body', { ref: r.ref })}</Txt>
            {push === 'off' && (
              <>
                <Txt v="small" style={{ color: color.textDim }}>{t('notif.why')}</Txt>
                <Button kind="ghost" icon="notifications-outline" title={t('sent.notify')}
                  onPress={async () => { try { await enablePush(); } catch { /* permission refused */ } setPush(await pushStatus()); }} />
              </>
            )}
          </Card>
        )}
        {notice && <Notice text={notice} tone={notice === t('res.cancelled') ? 'ok' : 'error'} />}

        <View style={{ gap: space.s }}>
          <StatusBadge status={r.status} />
          {car ? <CarImage car={car} height={170} /> : null}
          <Txt v="eyebrow">{car?.make ?? ''}</Txt>
          <Txt v="title">{car?.model ?? r.car}</Txt>
          <Txt style={{ color: color.textDim }}>
            {`${fmtDate(r.start_date, locale, { weekday: 'short', day: 'numeric', month: 'long' })} · ${hhmm(r.start_time)}  →  ${fmtDate(r.end_date, locale, { weekday: 'short', day: 'numeric', month: 'long' })} · ${hhmm(r.end_time)}`}
          </Txt>
        </View>

        <Card>
          <Txt v="h3" style={{ marginBottom: 4 }}>{t('res.details')}</Txt>
          {line(t('res.ref'), r.ref)}<Divider />
          {line(t('book.place'), t(`place.${r.place}`))}<Divider />
          {r.flight ? <>{line(t('res.flight'), r.flight)}<Divider /></> : null}
          {line(t('sum.days'), t('days', r.days))}<Divider />
          {line(t('book.payment'), `${t(`pay.${r.payment}`)} · ${t(`pstatus.${r.payment_status}`)}`)}<Divider />
          {car ? <>{line(t('sum.deposit'), money(car.deposit))}<Divider /></> : null}
          <Row style={{ justifyContent: 'space-between', paddingTop: 12 }}>
            <Txt v="label">{t('sum.total')}</Txt><Txt v="price">{money(r.estimate)}</Txt>
          </Row>
        </Card>

        {active && <Notice text={payText} tone={r.payment_status === 'paid' ? 'ok' : 'info'} />}
        {showCrypto && <CryptoPay wallets={fleet.business.cryptoWallets} estimate={r.estimate} />}

        <Card style={{ gap: 12 }}>
          <Txt v="h3">{t('res.timeline')}</Txt>
          {events.map((e, i) => (
            <Row key={i} gap={12} style={{ alignItems: 'flex-start' }}>
              <View style={[styles.dot, i === events.length - 1 && { backgroundColor: color.accent }]} />
              <View style={{ flex: 1 }}>
                <Txt v="label">{e.kind === 'created' ? t('res.created') : e.kind === 'status' ? t(`status.${e.value}`) : t(`pstatus.${e.value}`)}</Txt>
                <Txt v="small" style={{ color: color.textDim }}>
                  {new Date(e.at).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </Txt>
              </View>
            </Row>
          ))}
        </Card>

        {wa && <Button kind="ghost" icon="logo-whatsapp" title={t('res.contact')} onPress={wa} />}
        {r.can_cancel
          ? <Button kind="danger" title={t('res.cancel')} onPress={cancel} loading={cancelling} />
          : active && <Txt v="small" center style={{ color: color.textDim }}>{t('res.notCancellable')}</Txt>}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6, backgroundColor: color.lineStrong },
});
