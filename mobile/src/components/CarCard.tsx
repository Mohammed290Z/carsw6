import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Car } from '@/lib/fleet';
import { useI18n } from '@/lib/i18n';
import { color, radius, space } from '@/lib/theme';
import { CarImage } from './CarImage';
import { Row, Txt } from './ui';

export function CarCard({ car }: { car: Car }) {
  const { t, fmt, locale } = useI18n(); const f = fmt;
  return (
    <Link href={{ pathname: '/car/[id]', params: { id: car.id } }} asChild>
      <Pressable accessibilityRole="link" accessibilityLabel={`${car.make} ${car.model}, ${t('from')} ${fmt(car.price)} ${t('currency')} ${t('perDay')}`}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
        <CarImage car={car} height={150} />
        <View style={{ gap: 2, marginTop: space.s }}>
          <Txt v="eyebrow">{car.make}</Txt>
          <Txt v="h3">{car.model}</Txt>
          <Txt v="small" style={{ color: color.textDim }}>{`${f(car.power)} ${t('unit.hp')} · ${car.accel.toLocaleString(locale)} ${t('unit.s')} · ${car.seats} ${t('spec.seats').toLowerCase()}`}</Txt>
        </View>
        <Row style={{ justifyContent: 'space-between', marginTop: space.s }}>
          <Row gap={6} style={{ alignItems: 'baseline' }}>
            <Txt v="small" style={{ color: color.textDim }}>{t('from')}</Txt>
            <Txt v="price">{fmt(car.price)}</Txt>
            <Txt v="small" style={{ color: color.textDim }}>{`${t('currency')} ${t('perDay')}`}</Txt>
          </Row>
        </Row>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.l, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface, padding: space.m },
});
