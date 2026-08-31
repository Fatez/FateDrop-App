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

    refresh();
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    const tokenSubscription = Notifications.addPushTokenListener(() => refresh(true));

    return () => {
      appStateSubscription.remove();
      tokenSubscription.remove();
    };
  }, [pushEnabled, signedIn]);

  return children;
}
