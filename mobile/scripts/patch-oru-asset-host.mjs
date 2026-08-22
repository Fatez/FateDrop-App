import { readFileSync, writeFileSync } from 'node:fs';

const stagePath = 'mobile/components/companion-stage.tsx';
let stage = readFileSync(stagePath, 'utf8');

const oldBase = "const REMOTE_ASSET_BASE = String(process.env.EXPO_PUBLIC_COMPANION_ASSET_BASE_URL ?? '').replace(/\\\/$/, '');";
const newBase = "const DEFAULT_FATEDROP_WEB_URL = 'https://fatedrop-web.fatedrop-web.workers.dev';\nconst FATEDROP_WEB_URL = String(process.env.EXPO_PUBLIC_FATEDROP_WEB_URL || DEFAULT_FATEDROP_WEB_URL).replace(/\\\/$/, '');\nconst REMOTE_ASSET_BASE = String(process.env.EXPO_PUBLIC_COMPANION_ASSET_BASE_URL || `${FATEDROP_WEB_URL}/assets/companions`).replace(/\\\/$/, '');";

if (!stage.includes(oldBase)) {
  if (!stage.includes("/assets/companions")) throw new Error('Expected legacy companion asset-base line was not found.');
} else {
  stage = stage.replace(oldBase, newBase);
}

stage = stage.replace('Preparing the Koru & Friends stage…', 'Preparing the Oru & Friends stage…');

if (!stage.includes("EXPO_PUBLIC_FATEDROP_WEB_URL || DEFAULT_FATEDROP_WEB_URL")) throw new Error('Website-host fallback was not installed.');
if (!stage.includes("/assets/companions")) throw new Error('Canonical website asset path was not installed.');
if (stage.includes('Preparing the Koru & Friends stage…')) throw new Error('Old loading copy survived patch.');

writeFileSync(stagePath, stage);
console.log('Oru & Friends mobile renderer now follows the canonical FateDrop web asset host.');
