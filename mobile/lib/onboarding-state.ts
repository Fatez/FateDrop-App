import AsyncStorage from '@react-native-async-storage/async-storage';

export const APP_GUIDE_VERSION = 1;
export const APP_GUIDE_STORAGE_KEY = `fatedrop.app-guide.v${APP_GUIDE_VERSION}.complete`;

export async function hasCompletedAppGuide() {
  try {
    return (await AsyncStorage.getItem(APP_GUIDE_STORAGE_KEY)) === '1';
  } catch {
    // A storage failure should never break FateDrop. In that case the guide can
    // be shown again rather than treating an unknown local state as completed.
    return false;
  }
}

export async function completeAppGuide() {
  try {
    await AsyncStorage.setItem(APP_GUIDE_STORAGE_KEY, '1');
  } catch {
    // Completion state is convenience-only and contains no identity or account
    // data. Failure to persist it must not block the collector from the app.
  }
}
