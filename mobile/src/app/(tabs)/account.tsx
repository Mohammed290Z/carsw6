import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Divider, Field, Notice, Row, Txt } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { SITE_URL } from '@/lib/config';
import { useFleet } from '@/lib/fleet';
import { LANGS, useI18n } from '@/lib/i18n';
import { enablePush, forgetPush, pushStatus } from '@/lib/push';
import { color, HIT, space } from '@/lib/theme';

const PHONE = /^\+?[0-9 ().-]{8,25}$/;

export default function Account() {
  const insets = useSafeAreaInsets();
  const { t, lang, setLang } = useI18n();
  const { session, signOut } = useAuth();
  const { fleet } = useFleet();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const [push, setPush] = useState<'on' | 'off' | 'unsupported'>('unsupported');

  const userId = session?.user.id;
  useFocusEffect(useCallback(() => {
    pushStatus().then(setPush);
    if (!userId) return;
    api.profile().then(p => { if (p) { setEmail(p.email); setName(p.name ?? ''); setPhone(p.phone ?? ''); } }).catch(() => {});
  }, [userId]));

  const save = async () => {
    if (phone.trim() && !PHONE.test(phone.trim())) return setMsg({ text: t('err.phone'), tone: 'error' });
    setSaving(true); setMsg(null);
    try { await api.saveProfile(name, phone, lang); setMsg({ text: t('account.saved'), tone: 'ok' }); }
    catch (e) { setMsg({ text: t(e instanceof ApiError ? e.key : 'err.generic'), tone: 'error' }); }
    finally { setSaving(false); }
  };
  const chooseLang = (l: typeof lang) => { setLang(l); if (session) api.saveProfile(name, phone, l).catch(() => {}); };
  const out = async () => { await forgetPush(); await signOut(); setName(''); setPhone(''); setEmail(''); };
  const del = () => {
    const go = async () => {
      try { await forgetPush(); await api.deleteAccount(); await signOut(); }
      catch (e) { setMsg({ text: t(e instanceof ApiError ? e.key : 'err.generic'), tone: 'error' }); }
    };
    if (Platform.OS === 'web') { if (globalThis.confirm?.(`${t('account.deleteQ')}\n${t('account.deleteBody')}`)) go(); return; }
    Alert.alert(t('account.deleteQ'), t('account.deleteBody'), [
      { text: t('cancel'), style: 'cancel' }, { text: t('account.deleteYes'), style: 'destructive', onPress: go },
    ]);
  };
  const link = (icon: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void) => (
    <Pressable onPress={onPress} accessibilityRole="link" style={styles.link}>
      <Ionicons name={icon} size={20} color={color.textDim} />
      <Txt v="label" style={{ flex: 1 }}>{label}</Txt>
      <Ionicons name="open-outline" size={16} color={color.textDim} />
    </Pressable>
  );

  return (
    <ScrollView style={{ backgroundColor: color.bg }} contentContainerStyle={{ padding: space.m, paddingTop: insets.top + space.m, gap: space.l, paddingBottom: space.xl }}
      keyboardShouldPersistTaps="handled">
      <Txt v="display">{t('account.title')}</Txt>

      {session ? (
        <Card style={{ gap: space.m }}>
          <Txt v="h3">{t('account.profile')}</Txt>
          <Txt v="small" style={{ color: color.textDim }}>{email || session.user.email}</Txt>
          <Field label={t('book.name')} value={name} onChangeText={setName} autoComplete="name" />
          <Field label={t('book.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+212 6…" />
          {msg && <Notice text={msg.text} tone={msg.tone} />}
          <Button title={t('account.save')} onPress={save} loading={saving} />
        </Card>
      ) : (
        <Card style={{ gap: space.m }}>
          <Txt style={{ color: color.textDim }}>{t('account.guest')}</Txt>
          <Button title={t('account.signIn')} onPress={() => router.push('/sign-in')} />
        </Card>
      )}

      <Card style={{ gap: space.s }}>
        <Txt v="h3">{t('account.language')}</Txt>
        {LANGS.map(l => (
          <Pressable key={l.id} onPress={() => chooseLang(l.id)} accessibilityRole="radio" accessibilityState={{ selected: lang === l.id }} style={styles.link}>
            <Txt v="label" style={{ flex: 1, color: lang === l.id ? color.accent : color.text }}>{l.label}</Txt>
            {lang === l.id && <Ionicons name="checkmark" size={20} color={color.accent} />}
          </Pressable>
        ))}
      </Card>

      {session && push !== 'unsupported' && (
        <Card style={{ gap: space.s }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt v="h3">{t('account.notifications')}</Txt>
            <Txt v="small" style={{ color: push === 'on' ? color.ok : color.textDim }}>{t(push === 'on' ? 'account.notifOn' : 'account.notifOff')}</Txt>
          </Row>
          <Txt v="small" style={{ color: color.textDim }}>{t('notif.why')}</Txt>
          {push === 'off' && <Button kind="ghost" title={t('account.enable')} onPress={async () => {
            const ok = await enablePush().catch(() => false);
            if (!ok && Platform.OS !== 'web') Linking.openSettings();
            setPush(await pushStatus());
          }} />}
        </Card>
      )}

      <Card style={{ gap: 0 }}>
        <Txt v="h3" style={{ marginBottom: space.s }}>{t('account.help')}</Txt>
        {fleet.business.whatsapp && <>{link('logo-whatsapp', t('res.contact'), () => Linking.openURL(`https://wa.me/${fleet.business.whatsapp}`))}<Divider /></>}
        {link('globe-outline', t('account.website'), () => Linking.openURL(SITE_URL))}<Divider />
        {link('document-text-outline', t('account.legal'), () => Linking.openURL(`${SITE_URL}legal.html`))}
      </Card>

      {session && (
        <View style={{ gap: space.s }}>
          <Button kind="ghost" title={t('account.signOut')} onPress={out} icon="log-out-outline" />
          <Button kind="danger" title={t('account.delete')} onPress={del} />
        </View>
      )}
      <Txt v="small" center style={{ color: color.textFaint }}>{`CARSW6 · v${Constants.expoConfig?.version ?? ''}`}</Txt>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  link: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: HIT + 8 },
});
