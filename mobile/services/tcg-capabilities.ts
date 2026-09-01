import { SIGNAL_ENGINE_URL } from '@/constants/api';
import { TCG_REGISTRY } from '@/constants/tcg-registry';
import { fallbackTcgCapabilities, normalizeTcgCapabilityResponse, type TcgCapabilitySnapshot } from '@/lib/tcg-capabilities';

export const FALLBACK_TCG_CAPABILITY_SNAPSHOT: TcgCapabilitySnapshot = {
  source: 'fallback',
  capabilities: fallbackTcgCapabilities(TCG_REGISTRY),
};

export async function fetchTcgCapabilitySnapshot(): Promise<TcgCapabilitySnapshot> {
  const response = await fetch(`${SIGNAL_ENGINE_URL}/api/tcgs`, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`TCG capability registry HTTP ${response.status}`);
  const result = normalizeTcgCapabilityResponse(await response.json(), TCG_REGISTRY);
  if (result.source !== 'cloud') throw new Error('Unsupported FateDrop TCG capability contract.');
  return result;
}
