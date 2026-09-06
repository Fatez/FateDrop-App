import { Stack } from 'expo-router';

import FateBindersScreen from '@/screens/fate-binders-screen-v2';

export default function BindersRoute() {
  return <>
    <Stack.Screen options={{ headerShown: false }} />
    <FateBindersScreen />
  </>;
}
