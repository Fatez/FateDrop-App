const ACTIVATION_PHASES = [
  'foundation',
  'catalogue_shadow',
  'browse_only',
  'monitoring_shadow',
  'alerts_enabled',
];

function capabilityGatesForPhase(activationPhase) {
  const phaseRank = ACTIVATION_PHASES.indexOf(activationPhase);
  if (phaseRank < 0) return null;
  return {
    catalogueIngestionEnabled: phaseRank >= 1,
    browseEnabled: phaseRank >= 2,
    retailerMonitoringEnabled: phaseRank >= 3,
    lifecycleAlertsEnabled: phaseRank >= 4,
  };
}

function inactiveCapability(code, interestSelectable = false) {
  return {
    code,
    activationPhase: 'foundation',
    interestSelectable,
    catalogueIngestionEnabled: false,
    browseEnabled: false,
    retailerMonitoringEnabled: false,
    lifecycleAlertsEnabled: false,
  };
}

function fallbackTcgCapabilities(definitions) {
  return Object.fromEntries(definitions.map((definition) => [
    definition.code,
    definition.live
      ? {
          code: definition.code,
          activationPhase: 'alerts_enabled',
          interestSelectable: true,
          catalogueIngestionEnabled: true,
          browseEnabled: true,
          retailerMonitoringEnabled: true,
          lifecycleAlertsEnabled: true,
        }
      : inactiveCapability(definition.code, true),
  ]));
}

function normalizeTcgCapabilityResponse(payload, definitions) {
  const fallback = fallbackTcgCapabilities(definitions);
  if (!payload || payload.success !== true || payload.contractVersion !== 1 || payload.source !== 'FATEDROP_CLOUD' || !Array.isArray(payload.tcgs)) {
    return { source: 'fallback', capabilities: fallback };
  }

  const knownCodes = new Set(definitions.map((definition) => definition.code));
  const seen = new Set();
  const capabilities = { ...fallback };
  for (const candidate of payload.tcgs) {
    const code = typeof candidate?.code === 'string' ? candidate.code.trim().toLowerCase() : '';
    if (!knownCodes.has(code)) continue;
    const phaseGates = capabilityGatesForPhase(candidate.activationPhase);
    if (seen.has(code) || !phaseGates) {
      return { source: 'fallback', capabilities: fallback };
    }
    seen.add(code);

    const contractMatchesPhase = Object.entries(phaseGates).every(([key, value]) => candidate[key] === value);
    if (!contractMatchesPhase) return { source: 'fallback', capabilities: fallback };
    capabilities[code] = {
      code,
      activationPhase: candidate.activationPhase,
      interestSelectable: candidate.interestSelectable === true,
      ...phaseGates,
    };
  }

  // A partial response cannot silently inherit a future game's local fallback.
  for (const definition of definitions) {
    if (!seen.has(definition.code) && definition.code !== 'pokemon') {
      capabilities[definition.code] = inactiveCapability(definition.code, true);
    }
  }
  return { source: 'cloud', capabilities };
}

function tcgCapabilityLabel(capability) {
  if (capability.lifecycleAlertsEnabled) return 'LIVE NOW';
  if (capability.retailerMonitoringEnabled) return 'MONITORING IN SHADOW';
  if (capability.browseEnabled) return 'BROWSE READY · ALERTS OFF';
  if (capability.catalogueIngestionEnabled) return 'CATALOGUE IN SHADOW';
  return capability.interestSelectable ? 'COMING SOON · INTEREST ONLY' : 'NOT AVAILABLE';
}

module.exports = {
  ACTIVATION_PHASES,
  fallbackTcgCapabilities,
  normalizeTcgCapabilityResponse,
  tcgCapabilityLabel,
};
