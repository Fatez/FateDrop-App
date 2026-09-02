import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { refreshStockAlertRegistration } from '@/lib/notifications';

export function PushRegistrationBoundary({ children }: React.PropsWithChildren) {
  const { signedIn, snapshot } = useFateDropId();
  const pushEnabled = snapshot?.notificationPreferences?.push === true;

  useEffect(() => {
    if (!signedIn || !pushEnabled) return undefined;

    const refresh = (force = false) => {
      void refreshStockAlertRegistration({ force }).catch(() => null);
    };

    // An account-level ON preference means this device should actively repair
    // its endpoint registration. Force the boot reconciliation so a stale or
    // missing endpoint cannot survive until the user toggles push OFF then ON.
    refresh(true);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      // Foregrounding is a low-frequency, user-driven boundary and is the safest
      // place to re-upsert the current Expo token. The server registration path
      // is idempotent, so forcing here repairs delivery without creating alerts.
      if (state === 'active') refresh(true);
    });
    const tokenSubscription = Notifications.addPushTokenListener(() => refresh(true));

    return () => {
      appStateSubscription.remove();
      tokenSubscription.remove();
    };
  }, [pushEnabled, signedIn]);

  return children;
}
