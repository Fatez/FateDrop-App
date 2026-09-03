import { safeExternalHttpsUrl } from '@/lib/external-url-security';

export type ManualEchoScope = 'online_retailer_readiness' | 'physical_branch';
export type ManualEchoSource = 'operator_manual' | 'official_retailer_page';

export type ManualEchoInput = {
  scope: ManualEchoScope;
  sourceType: ManualEchoSource;
  retailerId: string;
  retailerName: string;
  signalTitle: string;
  sourceUrl: string;
  timingLabel: string;
  expiresAt: string;
  targetBranches: string;
  evidenceBasis: string;
  note: string;
};

export type ManualGlobalEchoInput = {
  headline: string;
  message: string;
  sourceUrl: string;
  expiresAt?: string;
};

export type ManualGlobalEchoRevisionInput = {
  operatorIssue: number | string;
  retailerName: string;
  headline: string;
  message: string;
  sourceUrl: string;
};

function clean(value: string, max: number) {
  return value.trim().slice(0, max);
}

function branchList(value: string) {
  return [...new Set(value.split(/\r?\n/).map(branch => clean(branch, 180)).filter(Boolean))].slice(0, 100);
}

function retailerSlug(value: string) {
  return clean(value, 120).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function buildManualEchoIntake(input: ManualEchoInput, now = Date.now()) {
  const retailerName = clean(input.retailerName, 120);
  const suppliedRetailerId = clean(input.retailerId, 120);
  const retailerId = suppliedRetailerId || retailerSlug(retailerName);
  const rawProductTitle = clean(input.signalTitle, 220);
  const sourceUrl = input.sourceUrl.trim() ? safeExternalHttpsUrl(input.sourceUrl) : null;
  const expectedLabel = clean(input.timingLabel, 120);
  const evidenceBasis = clean(input.evidenceBasis, 700);
  const targetBranches = branchList(input.targetBranches);
  const expiry = Date.parse(input.expiresAt);

  if (!retailerName || !retailerId) throw new Error('Retailer name is required.');
  if (input.scope === 'physical_branch' && !suppliedRetailerId) throw new Error('Physical Echo requires the canonical FateDrop retailer ID.');
  if (!rawProductTitle) throw new Error('Describe the movement or product intelligence.');
  if (input.sourceUrl.trim() && !sourceUrl) throw new Error('Source URL must be a public HTTPS page.');
  if (!sourceUrl && !evidenceBasis) throw new Error('Add a source URL or describe the evidence received.');
  if (input.scope === 'physical_branch' && !targetBranches.length) throw new Error('Add at least one exact branch name for physical Echo.');
  if (!expectedLabel) throw new Error('Add a short timing or movement label.');
  if (!Number.isFinite(expiry) || expiry <= now) throw new Error('Evidence expiry must be a future ISO date/time.');

  const physicalEvidenceState = input.scope === 'physical_branch'
    ? input.sourceType === 'official_retailer_page' ? 'expected' : 'reported'
    : undefined;
  const body = {
    schemaVersion: 1,
    testOnly: false,
    tcgCode: 'pokemon',
    retailerId,
    retailerName,
    rawProductTitle,
    kind: 'echo',
    availabilityScope: input.scope,
    ...(physicalEvidenceState ? { physicalEvidenceState } : {}),
    sourceType: input.sourceType,
    sourceUrl,
    sourceLabel: input.sourceType === 'official_retailer_page' ? `${retailerName} official retailer intelligence` : 'FateDrop operator intelligence',
    explicitTcgRelevance: true,
    expectedLabel,
    expiresAt: new Date(expiry).toISOString(),
    confidence: input.sourceType === 'official_retailer_page' ? 0.68 : 0.72,
    targetBranches,
    evidenceBasis: evidenceBasis || 'Authorised FateDrop operator observed credible movement. This is readiness intelligence, not confirmed stock.',
    note: clean(input.note, 300) || 'Echo readiness only. Availability is not confirmed; check the retailer before acting.',
  };
  const issueTitle = `[FATEDROP ECHO] ${retailerName} · ${rawProductTitle}`.slice(0, 240);
  const issueBody = JSON.stringify(body, null, 2);
  const issueUrl = `https://github.com/Fatez/Fatedrop-Cloud/issues/new?title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(issueBody)}`;
  return {
    issueTitle,
    issueBody,
    issueUrl,
    stage: 'ECHO' as const,
    physicalEvidenceState: physicalEvidenceState || null,
    shareText: `${issueTitle}\n\n${issueBody}`,
  };
}

export function buildManualGlobalEchoIntake(input: ManualGlobalEchoInput, now = Date.now()) {
  const headline = clean(input.headline, 220);
  const message = clean(input.message, 120).replace(/\.+$/, '');
  const sourceUrl = input.sourceUrl.trim();

  if (!headline) throw new Error('Add the alert headline.');
  if (!message) throw new Error('Add the short alert message.');
  if (!sourceUrl) throw new Error('Add the HTTPS link customers should check.');

  return buildManualEchoIntake({
    scope: 'online_retailer_readiness',
    sourceType: 'operator_manual',
    retailerId: 'fatedrop-intelligence',
    retailerName: 'FateDrop Intelligence',
    signalTitle: headline,
    sourceUrl,
    timingLabel: message,
    expiresAt: input.expiresAt || new Date(now + 6 * 60 * 60 * 1000).toISOString(),
    targetBranches: '',
    evidenceBasis: 'Authorised FateDrop operator supplied time-sensitive collector intelligence for global Echo delivery.',
    note: 'Global operator Echo only. Follow the linked source and do not treat this message as confirmed stock.',
  }, now);
}

export function buildManualGlobalEchoRevisionIntake(input: ManualGlobalEchoRevisionInput) {
  const operatorIssue = Number(String(input.operatorIssue).trim());
  const retailerName = clean(input.retailerName, 120);
  const headline = clean(input.headline, 220);
  const message = clean(input.message, 120).replace(/\.+$/, '');
  const sourceUrl = input.sourceUrl.trim() ? safeExternalHttpsUrl(input.sourceUrl) : null;

  if (!Number.isInteger(operatorIssue) || operatorIssue <= 0) throw new Error('Add the original active Echo issue number.');
  if (!retailerName) throw new Error('Add the retailer name shown on the active Echo.');
  if (!headline) throw new Error('Add the corrected alert headline.');
  if (!message) throw new Error('Add the corrected short message.');
  if (input.sourceUrl.trim() && !sourceUrl) throw new Error('Source URL must be a public HTTPS page.');

  const body = {
    schemaVersion: 1,
    revisionOnly: true,
    revisionOfIssue: operatorIssue,
    retailerName,
    rawProductTitle: headline,
    expectedLabel: message,
    sourceUrl,
    note: 'Owner-authorised correction to the active Echo presentation. This revision must not create a second signal or request another push.',
  };
  const issueTitle = `[FATEDROP ECHO EDIT] #${operatorIssue} · ${headline}`.slice(0, 240);
  const issueBody = JSON.stringify(body, null, 2);
  const issueUrl = `https://github.com/Fatez/Fatedrop-Cloud/issues/new?title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(issueBody)}`;
  return {
    issueTitle,
    issueBody,
    issueUrl,
    stage: 'ECHO' as const,
    revisionOnly: true as const,
    revisionOfIssue: operatorIssue,
    shareText: `${issueTitle}\n\n${issueBody}`,
  };
}
