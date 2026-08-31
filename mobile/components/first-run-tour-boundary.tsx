import { router, usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { useFateDropId } from '@/contexts/fatedrop-id-context';
import { hasCompletedAppGuide } from '@/lib/onboarding-state';

export function FirstRunTourBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { snapshot, loading } = useFateDropId();

  useEffect(() => {
    let active = true;
    if (loading || !snapshot?.user || !snapshot.accessAllowed || snapshot.tcgPreferences?.onboardingCompleted !== true || pathname === '/onboarding' || pathname === '/tcg-onboarding') return () => { active = false; };

    void hasCompletedAppGuide().then((complete) => {
      if (!active || complete) return;
      router.replace('/onboarding');
    });

    return () => { active = false; };
  }, [loading, pathname, snapshot?.accessAllowed, snapshot?.tcgPreferences?.onboardingCompleted, snapshot?.user]);

  return <>{children}</>;
}
