// Shared building blocks. Every text goes through <Txt> so it gets the right font for the language
// (Bodoni/Instrument for Latin, Naskh/Plex Arabic for Arabic) and the right alignment in RTL.
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator, Platform, Pressable, StyleProp, StyleSheet, Text, TextInput, TextInputProps,
  TextStyle, View, ViewStyle,
} from 'react-native';
import { useI18n } from '@/lib/i18n';
import { color, font, HIT, radius, space } from '@/lib/theme';

type Variant = 'body' | 'small' | 'label' | 'eyebrow' | 'title' | 'display' | 'h2' | 'h3' | 'price';

export function Txt({ v = 'body', style, children, center, numberOfLines, selectable }: {
  v?: Variant; style?: StyleProp<TextStyle>; children: ReactNode; center?: boolean; numberOfLines?: number; selectable?: boolean;
}) {
  const { rtl } = useI18n();
  const serif = v === 'title' || v === 'display' || v === 'h2' || v === 'h3' || v === 'price';
  const family = rtl
    ? (serif ? (v === 'h3' || v === 'price' ? font.arSerifMedium : font.arSerif) : v === 'label' || v === 'eyebrow' ? font.arSansMedium : font.arSans)
    : (serif ? (v === 'display' ? font.serifItalic : v === 'h3' || v === 'price' ? font.serifMedium : font.serif)
      : v === 'label' || v === 'eyebrow' ? font.sansMedium : font.sans);
  return (
    <Text
      numberOfLines={numberOfLines}
      selectable={selectable}
      style={[
        styles[v], { fontFamily: family, textAlign: center ? 'center' : rtl ? 'right' : 'left', writingDirection: rtl ? 'rtl' : 'ltr' },
        rtl && serif && { lineHeight: (styles[v].fontSize ?? 16) * 1.45, letterSpacing: 0 },
        rtl && v === 'eyebrow' && { textTransform: 'none', letterSpacing: 0, fontSize: 13 },
        style,
      ]}
    >{children}</Text>
  );
}

/** Lays children out right-to-left in Arabic (flex rows, start/end paddings follow). */
export function Dir({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { rtl } = useI18n();
  return <View style={[{ flex: 1, direction: rtl ? 'rtl' : 'ltr' }, style]}>{children}</View>;
}

export const Row = ({ children, style, gap = space.s }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) =>
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;

type BtnKind = 'primary' | 'ghost' | 'danger' | 'quiet';
export function Button({ title, onPress, kind = 'primary', loading, disabled, icon, style, small, accessibilityLabel }: {
  title: string; onPress?: () => void; kind?: BtnKind; loading?: boolean; disabled?: boolean;
  icon?: ComponentProps<typeof Ionicons>['name']; style?: StyleProp<ViewStyle>; small?: boolean; accessibilityLabel?: string;
}) {
  const fg = kind === 'primary' ? color.onPrimary : kind === 'danger' ? color.error : color.text;
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={() => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); onPress?.(); }}
      style={({ pressed }) => [
        styles.btn, small && styles.btnSmall,
        kind === 'primary' && { backgroundColor: color.primary },
        kind === 'ghost' && { borderWidth: 1, borderColor: color.lineStrong },
        kind === 'danger' && { borderWidth: 1, borderColor: color.errorLine },
        kind === 'quiet' && { minHeight: HIT, paddingHorizontal: space.s },
        pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }, off && { opacity: 0.5 }, style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <Row gap={8} style={{ justifyContent: 'center' }}>
          {icon && <Ionicons name={icon} size={18} color={fg} />}
          <Txt v="label" style={{ color: fg, fontSize: small ? 14 : 16 }} center>{title}</Txt>
        </Row>
      )}
    </Pressable>
  );
}

export function Chip({ label, count, active, onPress }: { label: string; count?: number; active?: boolean; onPress: () => void }) {
  const { fmt } = useI18n();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!active }} onPress={onPress}
      style={[styles.chip, active && { backgroundColor: color.primary, borderColor: color.primary }]}>
      <Txt v="label" style={{ color: active ? color.onPrimary : color.textDim, fontSize: 14 }}>{label}</Txt>
      {count != null && <Txt v="small" style={{ color: active ? color.onPrimaryDim : color.textFaint }}>{fmt(count)}</Txt>}
    </Pressable>
  );
}

export function Field({ label, error, style, ...props }: Omit<TextInputProps, 'style'> & { label: string; error?: string | null; style?: StyleProp<ViewStyle> }) {
  const { rtl } = useI18n();
  return (
    <View style={[{ gap: 8 }, style]}>
      <Txt v="small" style={{ color: color.textDim }}>{label}</Txt>
      <TextInput
        placeholderTextColor={color.textFaint}
        {...props}
        accessibilityLabel={label}
        style={[styles.input, { textAlign: rtl && props.keyboardType !== 'phone-pad' && props.keyboardType !== 'email-address' ? 'right' : 'left',
          fontFamily: rtl ? font.arSans : font.sans }, error ? { borderColor: color.error } : null]}
      />
      {error ? <Txt v="small" style={{ color: color.error }}>{error}</Txt> : null}
    </View>
  );
}

export const Card = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) =>
  <View style={[styles.card, style]}>{children}</View>;

export const Divider = () => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: color.line }} />;

export function Loading() {
  const { t } = useI18n();
  return <View style={styles.center}><ActivityIndicator color={color.accent} size="large" /><Txt v="small" style={{ color: color.textDim, marginTop: space.s }}>{t('loading')}</Txt></View>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <View style={[styles.center, { gap: space.m, padding: space.l }]}>
      <Ionicons name="cloud-offline-outline" size={32} color={color.textDim} />
      <Txt center style={{ color: color.textDim }}>{message}</Txt>
      {onRetry && <Button kind="ghost" title={t('retry')} onPress={onRetry} />}
    </View>
  );
}

export function Notice({ text, tone = 'info' }: { text: string; tone?: 'info' | 'error' | 'ok' }) {
  const c = tone === 'error' ? color.error : tone === 'ok' ? color.ok : color.textDim;
  return (
    <Row style={[styles.notice, { borderColor: tone === 'info' ? color.line : c }]} gap={10}>
      <Ionicons name={tone === 'error' ? 'alert-circle-outline' : tone === 'ok' ? 'checkmark-circle-outline' : 'information-circle-outline'} size={18} color={c} />
      <Txt v="small" style={{ color: tone === 'info' ? color.textDim : c, flex: 1 }}>{text}</Txt>
    </Row>
  );
}

const STATUS_COLOR: Record<string, string> = {
  new: color.textDim, confirmed: color.text, paid: color.ok, delivered: color.ok, returned: color.textFaint, cancelled: color.error,
};
export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const c = STATUS_COLOR[status] ?? color.textDim;
  return (
    <View style={[styles.badge, { borderColor: c }]}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c }} />
      <Txt v="small" style={{ color: c, fontSize: 12 }}>{t(`status.${status}`)}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { color: color.text, fontSize: 16, lineHeight: 23 },
  small: { color: color.text, fontSize: 14, lineHeight: 20 },
  label: { color: color.text, fontSize: 15, lineHeight: 20 },
  eyebrow: { color: color.textDim, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { color: color.text, fontSize: 30, lineHeight: 34 },
  display: { color: color.text, fontSize: 40, lineHeight: 42, letterSpacing: -0.6 },
  h2: { color: color.text, fontSize: 26, lineHeight: 30 },
  h3: { color: color.text, fontSize: 21, lineHeight: 26 },
  price: { color: color.accent, fontSize: 24, lineHeight: 28 },
  btn: { minHeight: 52, borderRadius: radius.pill, paddingHorizontal: space.l, alignItems: 'center', justifyContent: 'center' },
  btnSmall: { minHeight: HIT, paddingHorizontal: space.m },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: HIT, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1, borderColor: color.line },
  input: { minHeight: 52, borderRadius: radius.s, borderWidth: 1, borderColor: color.line, backgroundColor: color.bg,
    color: color.text, fontSize: 16, paddingHorizontal: space.m },
  card: { borderRadius: radius.l, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface, padding: space.m },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.l },
  notice: { borderWidth: 1, borderRadius: radius.s, padding: 12, alignItems: 'flex-start' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
});
