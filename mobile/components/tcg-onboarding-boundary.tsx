import { router, usePathname } from 'expo-router';
import { useEffect, type PropsWithChildren } from 'react';
import { useFateDropId } from '@/contexts/fatedrop-id-context';

export function TcgOnboardingBoundary({children}:PropsWithChildren){
  const {snapshot,loading}=useFateDropId();
  const pathname=usePathname();
  useEffect(()=>{
    if(loading||!snapshot?.user||!snapshot.accessAllowed||pathname==='/tcg-onboarding')return;
    if(snapshot.tcgPreferences?.onboardingCompleted!==true)router.replace('/tcg-onboarding');
  },[loading,pathname,snapshot]);
  return children;
}
