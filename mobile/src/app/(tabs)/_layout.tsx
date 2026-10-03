import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useI18n } from '@/lib/i18n';
import { color, font } from '@/lib/theme';

export default function TabsLayout() {
  const { t, rtl } = useI18n();
  const icon = (name: keyof typeof Ionicons.glyphMap) => function TabIcon({ color: c, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={c as string} size={size} />;
  };
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: color.bg, borderTopColor: color.line },
      tabBarActiveTintColor: color.accent, tabBarInactiveTintColor: color.textDim,
      tabBarLabelStyle: { fontFamily: rtl ? font.arSansMedium : font.sansMedium, fontSize: 12 },
      sceneStyle: { backgroundColor: color.bg },
    }}>
      <Tabs.Screen name="index" options={{ title: t('tab.explore'), tabBarIcon: icon('car-sport-outline') }} />
      <Tabs.Screen name="bookings" options={{ title: t('tab.bookings'), tabBarIcon: icon('calendar-outline') }} />
      <Tabs.Screen name="account" options={{ title: t('tab.account'), tabBarIcon: icon('person-circle-outline') }} />
    </Tabs>
  );
}
