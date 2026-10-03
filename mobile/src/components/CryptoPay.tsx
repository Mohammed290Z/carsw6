// Paying a crypto booking straight to the business wallet — the same flow as the website: pick a
// coin, see the amount at today's rate, copy the address or scan the QR code.
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Wallet } from '@/lib/fleet';
import { useI18n } from '@/lib/i18n';
import { color, HIT, radius, space } from '@/lib/theme';
import { Button, Card, Notice, Row, Txt } from './ui';

type Rates = Record<string, number | null>;
let cache: { at: number; rates: Rates } | null = null;
async function loadRates(wallets: Wallet[]): Promise<Rates> {
  if (cache && Date.now() - cache.at < 10 * 60_000) return cache.rates;
  const ids = [...new Set(wallets.map(w => w.rateId))].join(',');
  const [fx, px] = await Promise.all([
    fetch('https://open.er-api.com/v6/latest/MAD').then(r => r.json()),
    fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`).then(r => r.json()),
  ]);
  const usdPerMad = fx?.rates?.USD;
  const rates = Object.fromEntries(wallets.map(w => [w.coin, usdPerMad && px?.[w.rateId]?.usd ? usdPerMad / px[w.rateId].usd : null]));
  cache = { at: Date.now(), rates };
  return rates;
}

export function CryptoPay({ wallets, estimate }: { wallets: Wallet[]; estimate: number }) {
  const { t, money } = useI18n();
  const [i, setI] = useState(0);
  const [rates, setRates] = useState<Rates | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => { loadRates(wallets).then(setRates).catch(() => setRates({})); }, [wallets]);
  const w = wallets[i];
  const rate = rates?.[w.coin];
  const amount = rate ? (estimate * rate).toFixed(w.decimals) : null;
  const copy = async (what: string, value: string) => { await Clipboard.setStringAsync(value); setCopied(what); setTimeout(() => setCopied(null), 1600); };

  return (
    <Card style={{ gap: space.m, borderColor: color.accent }}>
      <Txt v="h3">{t('cpay.title')}</Txt>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        {wallets.map((x, j) => (
          <Pressable key={x.coin} onPress={() => setI(j)} accessibilityRole="tab" accessibilityState={{ selected: i === j }}
            style={[styles.coin, i === j && { backgroundColor: color.primary }]}>
            <Txt v="label" style={{ color: i === j ? color.onPrimary : color.text }}>{x.coin}</Txt>
          </Pressable>
        ))}
      </Row>
      <View style={{ gap: 4 }}>
        <Txt v="small" style={{ color: color.textDim }}>{t('cpay.send')}</Txt>
        <Txt v="price" selectable style={{ writingDirection: 'ltr' }}>{amount ? `${amount} ${w.coin}` : money(estimate)}</Txt>
        <Txt v="small" style={{ color: color.textDim }}>{rates == null ? t('loading') : amount ? t('cpay.approx', { mad: money(estimate) }) : t('cpay.norate')}</Txt>
        {amount && <Button small kind="ghost" title={copied === 'amount' ? t('cpay.copied') : t('cpay.copyAmount')} onPress={() => copy('amount', amount)} style={{ alignSelf: 'flex-start', marginTop: 6 }} />}
      </View>
      <View style={styles.qr}><QRCode value={w.address} size={168} backgroundColor="#fff" color="#000000" /></View>
      <View style={{ gap: 6 }}>
        <Txt v="small" style={{ color: color.textDim }}>{t('cpay.address', { coin: w.coin, network: w.network })}</Txt>
        <Txt selectable style={styles.addr}>{w.address}</Txt>
        <Button title={copied === 'addr' ? t('cpay.copied') : t('cpay.copy')} icon="copy-outline" onPress={() => copy('addr', w.address)} />
      </View>
      <Notice tone="error" text={t('cpay.warn', { coin: w.coin, network: w.network })} />
    </Card>
  );
}

const styles = StyleSheet.create({
  coin: { minHeight: HIT, paddingHorizontal: 18, borderRadius: radius.pill, borderWidth: 1, borderColor: color.line, justifyContent: 'center' },
  qr: { alignSelf: 'center', padding: 12, backgroundColor: '#fff', borderRadius: radius.s },
  addr: { fontFamily: 'Courier', fontSize: 14, color: color.text, padding: 12, borderRadius: radius.s, backgroundColor: color.surface, writingDirection: 'ltr', textAlign: 'left' },
});
