// Push notifications for booking updates (sent by supabase/functions/notify-customer).
// Asked for in context (after a booking, or from Account), never on first launch.
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';
import { store } from './store';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

const projectId = (): string | undefined =>
  (Constants.expoConfig?.extra as any)?.eas?.projectId ?? (Constants as any).easConfig?.projectId;

/** Push works here at all? (real device, iOS/Android, app linked to an EAS project) */
export const pushSupported = () => Platform.OS !== 'web' && Device.isDevice && !!projectId();

export async function pushStatus(): Promise<'on' | 'off' | 'unsupported'> {
  if (!pushSupported()) return 'unsupported';
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted' && store.get('push.token') ? 'on' : 'off';
}

/** Ask permission if needed, then register this phone for the signed-in customer. */
export async function enablePush(): Promise<boolean> {
  if (!pushSupported()) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('bookings', {
      name: 'Réservations', importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 200, 150, 200], lightColor: '#EADBBF',
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return false;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId: projectId()! })).data;
  await api.registerDevice(token, Platform.OS === 'ios' ? 'ios' : 'android');
  store.set('push.token', token);
  return true;
}

/** On sign-out: stop sending this customer's notifications to this phone. */
export async function forgetPush() {
  const token = store.get('push.token');
  if (token) { try { await api.unregisterDevice(token); } catch { /* offline: the server drops dead tokens anyway */ } }
  store.remove('push.token');
}

/** Re-register silently at start if permission was given before (tokens can change). */
export async function refreshPush() {
  if (!pushSupported()) return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted' && store.get('push.token')) { try { await enablePush(); } catch { /* next time */ } }
}
