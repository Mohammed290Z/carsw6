// A car standing on the site's gold ring: the same cut-out photos, wheels inside a glowing ellipse.
import { Image } from 'expo-image';
import { Platform, StyleSheet, View } from 'react-native';
import { Car, imageUri } from '@/lib/fleet';
import { useI18n } from '@/lib/i18n';
import { color } from '@/lib/theme';

export function CarImage({ car, width = 800, height, ring = true }: { car: Car; width?: number; height: number; ring?: boolean }) {
  const { lang } = useI18n();
  const ringH = ring ? height * 0.18 : 0;
  return (
    <View style={{ height, alignItems: 'center', justifyContent: 'flex-end' }}>
      {ring && <View style={[styles.glow, { bottom: ringH * 0.4 }]} />}
      {ring && <View style={[styles.ring, { height: ringH, bottom: 0 }]} />}
      <Image
        source={{ uri: imageUri(car, width) }}
        accessibilityLabel={car.alt[lang]}
        contentFit="contain" contentPosition="bottom" cachePolicy="memory-disk"
        // expo-image's web cross-fade can stay stuck at opacity 0 for cached images; fade on phones only
        transition={Platform.OS === 'web' ? 0 : 250}
        style={{ width: '88%', height: height - ringH * 0.15, marginBottom: ringH * 0.15, position: 'relative', zIndex: 1 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', width: '60%', height: '55%', borderRadius: 999, backgroundColor: color.glow },
  ring: { position: 'absolute', width: '78%', borderRadius: 999, borderWidth: 1.5, borderColor: color.ring,
    boxShadow: color.ringGlow },
});
