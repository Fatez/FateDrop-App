import { Stack } from 'expo-router';

import FateBindersScreen from '@/screens/fate-binders-screen';

export default function BindersRoute() {
  return <>
    <Stack.Screen options={{ headerShown: false }} />
    <FateBindersScreen />
  </>;
}
