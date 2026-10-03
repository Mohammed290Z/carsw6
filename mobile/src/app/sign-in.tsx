import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Button, Field, Notice, Txt } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { color, space } from '@/lib/theme';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function SignIn() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { t } = useI18n();
  const { sendCode, verify, session } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => { if (!cooldown) return; const id = setTimeout(() => setCooldown(c => c - 1), 1000); return () => clearTimeout(id); }, [cooldown]);
  // signed in: go where the customer was heading (e.g. the booking form)
  useEffect(() => {
    if (!session) return;
    if (next && next.startsWith('/')) router.replace(next as any);
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [session, next]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr(null);
    try { await fn(); } catch (e) { setErr(t(e instanceof ApiError ? e.key : 'err.generic')); } finally { setBusy(false); }
  };
  const send = () => {
    if (!EMAIL.test(email.trim())) return setErr(t('signin.badEmail'));
    run(async () => { await sendCode(email); setStep('code'); setCode(''); setCooldown(60); });
  };
  const check = () => run(() => verify(email, code));

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: space.m, gap: space.l }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: space.s }}>
          <Txt v="title">{t('signin.title')}</Txt>
          <Txt style={{ color: color.textDim }}>{step === 'email' ? t('signin.lede') : t('signin.sent', { email: email.trim() })}</Txt>
        </View>
        {step === 'email' ? (
          <>
            <Field label={t('signin.email')} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false}
              keyboardType="email-address" autoComplete="email" textContentType="emailAddress" returnKeyType="send" onSubmitEditing={send} />
            {err && <Notice tone="error" text={err} />}
            <Button title={t('signin.send')} onPress={send} loading={busy} />
          </>
        ) : (
          <>
            <Field label={t('signin.code')} value={code} onChangeText={v => setCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6} autoFocus
              style={{}} returnKeyType="done" onSubmitEditing={check} />
            {err && <Notice tone="error" text={err} />}
            <Button title={t('signin.verify')} onPress={check} loading={busy} disabled={code.length !== 6} />
            <Button kind="ghost" title={cooldown ? `${t('signin.resend')} (${cooldown})` : t('signin.resend')} disabled={!!cooldown || busy} onPress={send} />
            <Button kind="quiet" title={t('signin.change')} onPress={() => { setStep('email'); setErr(null); }} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
