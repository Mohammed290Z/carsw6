import { BodoniModa_400Regular, BodoniModa_400Regular_Italic, BodoniModa_500Medium } from '@expo-google-fonts/bodoni-moda';
import { IBMPlexSansArabic_400Regular, IBMPlexSansArabic_500Medium, IBMPlexSansArabic_600SemiBold } from '@expo-google-fonts/ibm-plex-sans-arabic';
import { InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold } from '@expo-google-fonts/instrument-sans';
import { NotoNaskhArabic_400Regular, NotoNaskhArabic_500Medium } from '@expo-google-fonts/noto-naskh-arabic';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Dir } from '@/components/ui';
import { AuthProvider, useAuth } from '@/lib/auth';
import { FleetProvider } from '@/lib/fleet';
import { I18nProvider, useI18n } from '@/lib/i18n';
import { refreshPush } from '@/lib/push';
import { color, font } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Nav() {
  const { t, rtl } = useI18n();
  const { session } = useAuth();
  // tapping a booking notification opens that booking
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const open = (n: Notifications.Notification | undefined) => {
      const ref = n?.request.content.data?.ref;
      if (typeof ref === 'string') router.push({ pathname: '/booking/[ref]', params: { ref } });
    };
    const last = Notifications.getLastNotificationResponse();
    if (last) open(last.notification);
    const sub = Notifications.addNotificationResponseReceivedListener(r => open(r.notification));
    return () => sub.remove();
  }, []);
  const userId = session?.user.id;
  useEffect(() => { if (userId) refreshPush(); }, [userId]);

  const header = {
    headerStyle: { backgroundColor: color.bg }, headerTintColor: color.text, headerShadowVisible: false,
    headerTitleStyle: { fontFamily: rtl ? font.arSansMedium : font.sansMedium, fontSize: 16 },
    headerBackTitle: t('back'), contentStyle: { backgroundColor: color.bg },
  };
  return (
    <Dir>
      <StatusBar style="light" />
      <Stack screenOptions={header}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="car/[id]" options={{ title: '', headerTransparent: true }} />
        <Stack.Screen name="book/[id]" options={{ title: t('book.title') }} />
        <Stack.Screen name="booking/[ref]" options={{ title: '' }} />
        <Stack.Screen name="sign-in" options={{ presentation: 'modal', title: t('signin.title') }} />
      </Stack>
    </Dir>
  );
}

export default function Root() {
  const [loaded, error] = useFonts({
    BodoniModa_400Regular, BodoniModa_400Regular_Italic, BodoniModa_500Medium,
    InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold,
    NotoNaskhArabic_400Regular, NotoNaskhArabic_500Medium,
    IBMPlexSansArabic_400Regular, IBMPlexSansArabic_500Medium, IBMPlexSansArabic_600SemiBold,
  });
  useEffect(() => { if (loaded || error) SplashScreen.hideAsync().catch(() => {}); }, [loaded, error]);
  if (!loaded && !error) return null;   // splash stays up; system fonts if loading failed
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AuthProvider>
          <FleetProvider>
            <Nav />
          </FleetProvider>
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
