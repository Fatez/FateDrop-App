import { Stack } from 'expo-router';
import ScanCardScreen from '@/screens/scan-card-screen';
export default function ScanCardRoute() { return <><Stack.Screen options={{ headerShown: false }} /><ScanCardScreen /></>; }
