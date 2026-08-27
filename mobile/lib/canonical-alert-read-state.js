const CANONICAL_ALERT_STAGES = ['WHISPER', 'ECHO', 'MANIFESTED', 'VANISHED'];
const MAX_SEEN_ALERT_IDS = 500;

function detectedAtMs(value) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function newestDetectedAt(alerts, previous) {
  let newest = previous ?? null;
  let newestMs = detectedAtMs(newest) ?? Number.NEGATIVE_INFINITY;
  for (const alert of alerts) {
    const currentMs = detectedAtMs(alert?.detectedAt);
    if (currentMs != null && currentMs > newestMs) {
      newest = alert.detectedAt;
      newestMs = currentMs;
    }
  }
  return newest;
}

function cleanSeenAlertIds(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((id) => typeof id === 'string' && id.length > 0))).slice(0, MAX_SEEN_ALERT_IDS);
}

function emptyStageReadState() {
  return { seenAlertIds: [], seenThroughDetectedAt: null };
}

function emptyStages() {
  return Object.fromEntries(CANONICAL_ALERT_STAGES.map((stage) => [stage, emptyStageReadState()]));
}

function normalizeStageReadState(value) {
  if (!value || typeof value !== 'object') return emptyStageReadState();
  return {
    seenAlertIds: cleanSeenAlertIds(value.seenAlertIds),
    seenThroughDetectedAt: typeof value.seenThroughDetectedAt === 'string' ? value.seenThroughDetectedAt : null,
  };
}

function normalizeCanonicalAlertReadState(value, userId) {
  if (!value || typeof value !== 'object' || value.userId !== userId) return null;

  if (value.version === 2 && value.stages && typeof value.stages === 'object') {
    return {
      version: 2,
      userId,
      stages: Object.fromEntries(CANONICAL_ALERT_STAGES.map((stage) => [stage, normalizeStageReadState(value.stages[stage])])),
      updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : 0,
    };
  }

  if (value.version === 1 && Array.isArray(value.seenAlertIds)) {
    const legacySeenAlertIds = cleanSeenAlertIds(value.seenAlertIds);
    const legacyCursor = typeof value.seenThroughDetectedAt === 'string' ? value.seenThroughDetectedAt : null;
    return {
      version: 2,
      userId,
      stages: Object.fromEntries(CANONICAL_ALERT_STAGES.map((stage) => [stage, {
        seenAlertIds: [...legacySeenAlertIds],
        seenThroughDetectedAt: legacyCursor,
      }])),
      updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : 0,
    };
  }

  return null;
}

function createCanonicalAlertReadState(userId, updatedAt = 0) {
  return { version: 2, userId, stages: emptyStages(), updatedAt };
}

function isUnread(alert, stageState) {
  if (stageState.seenAlertIds.includes(alert.id)) return false;
  const cursorMs = detectedAtMs(stageState.seenThroughDetectedAt);
  const alertMs = detectedAtMs(alert.detectedAt);
  if (cursorMs != null && alertMs != null && alertMs < cursorMs) return false;
  return true;
}

function countUnreadCanonicalAlertsByStageFromState(alerts, state) {
  const counts = Object.fromEntries(CANONICAL_ALERT_STAGES.map((stage) => [stage, 0]));
  for (const alert of alerts) {
    if (!alert || !CANONICAL_ALERT_STAGES.includes(alert.fateStage)) continue;
    const stageState = state?.stages?.[alert.fateStage] ?? emptyStageReadState();
    if (isUnread(alert, stageState)) counts[alert.fateStage] += 1;
  }
  return counts;
}

function markCanonicalAlertStageSeenInState(previous, userId, stage, alerts, updatedAt = Date.now()) {
  if (!CANONICAL_ALERT_STAGES.includes(stage)) return previous ?? createCanonicalAlertReadState(userId, updatedAt);
  const current = previous ?? createCanonicalAlertReadState(userId, updatedAt);
  const stageAlerts = alerts.filter((alert) => alert?.fateStage === stage);
  const priorStage = current.stages[stage] ?? emptyStageReadState();
  const seenAlertIds = Array.from(new Set([
    ...stageAlerts.map((alert) => alert.id).filter(Boolean),
    ...priorStage.seenAlertIds,
  ])).slice(0, MAX_SEEN_ALERT_IDS);
  return {
    ...current,
    userId,
    stages: {
      ...current.stages,
      [stage]: {
        seenAlertIds,
        seenThroughDetectedAt: newestDetectedAt(stageAlerts, priorStage.seenThroughDetectedAt),
      },
    },
    updatedAt,
  };
}

module.exports = {
  CANONICAL_ALERT_STAGES,
  countUnreadCanonicalAlertsByStageFromState,
  createCanonicalAlertReadState,
  markCanonicalAlertStageSeenInState,
  normalizeCanonicalAlertReadState,
};
