import type { TcgCode } from '@/constants/tcg-registry';

export type TcgActivationPhase = 'foundation' | 'catalogue_shadow' | 'browse_only' | 'monitoring_shadow' | 'alerts_enabled';
export type TcgCapability = {
  code: TcgCode;
  activationPhase: TcgActivationPhase;
  interestSelectable: boolean;
  catalogueIngestionEnabled: boolean;
  browseEnabled: boolean;
  retailerMonitoringEnabled: boolean;
  lifecycleAlertsEnabled: boolean;
};
export type TcgCapabilityDefinition = { code: TcgCode; live: boolean };
export type TcgCapabilitySnapshot = { source: 'cloud' | 'fallback'; capabilities: Record<TcgCode, TcgCapability> };

export const ACTIVATION_PHASES: readonly TcgActivationPhase[];
export function fallbackTcgCapabilities(definitions: readonly TcgCapabilityDefinition[]): Record<TcgCode, TcgCapability>;
export function normalizeTcgCapabilityResponse(payload: unknown, definitions: readonly TcgCapabilityDefinition[]): TcgCapabilitySnapshot;
export function tcgCapabilityLabel(capability: TcgCapability): string;
