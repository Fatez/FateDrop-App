export type CanonicalAlertStage = 'WHISPER' | 'ECHO' | 'MANIFESTED' | 'VANISHED';

export type CanonicalAlertReadStageState = {
  seenAlertIds: string[];
  seenThroughDetectedAt: string | null;
};

export type CanonicalAlertReadState = {
  version: 2;
  userId: string;
  stages: Record<CanonicalAlertStage, CanonicalAlertReadStageState>;
  updatedAt: number;
};

export type CanonicalAlertReadItem = {
  id: string;
  fateStage: CanonicalAlertStage;
  detectedAt: string;
};

export const CANONICAL_ALERT_STAGES: CanonicalAlertStage[];

export function createCanonicalAlertReadState(userId: string, updatedAt?: number): CanonicalAlertReadState;
export function normalizeCanonicalAlertReadState(value: unknown, userId: string): CanonicalAlertReadState | null;
export function countUnreadCanonicalAlertsByStageFromState(
  alerts: CanonicalAlertReadItem[],
  state: CanonicalAlertReadState | null,
): Record<CanonicalAlertStage, number>;
export function markCanonicalAlertStageSeenInState(
  previous: CanonicalAlertReadState | null,
  userId: string,
  stage: CanonicalAlertStage,
  alerts: CanonicalAlertReadItem[],
  updatedAt?: number,
): CanonicalAlertReadState;
