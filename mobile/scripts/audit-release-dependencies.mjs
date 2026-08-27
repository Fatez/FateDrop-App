import { spawnSync } from "node:child_process";

// These advisories are currently confined to Expo/Metro build tooling in SDK 54.
// npm's only automated remediation is a breaking Expo 57 upgrade, so beta CI
// permits these exact advisory IDs while continuing to fail closed on any new
// HIGH/CRITICAL advisory. Remove entries as the locked Expo stack is upgraded.
const ALLOWED_BUILD_TOOL_ADVISORIES = new Set([
  "GHSA-w3rx-r6r6-pgpr", // image-size ICNS parser DoS
  "GHSA-5p2g-fcmc-qvqq", // image-size JXL/HEIF parser DoS
  "GHSA-qx2v-qp2m-jg93", // PostCSS stringify XSS
  "GHSA-6g55-p6wh-862q", // PostCSS source map file disclosure
  "GHSA-fxqj-rqcc-2cmp", // PostCSS source map incomplete-fix disclosure
  "GHSA-r28c-9q8g-f849", // PostCSS source map path traversal
]);

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npmCommand, ["audit", "--omit=dev", "--json"], {
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024,
});

let report;
try {
  report = JSON.parse(result.stdout || "{}");
} catch (error) {
  console.error("Unable to parse npm audit JSON; failing closed.", error);
  process.exit(1);
}

if (report.error) {
  console.error("npm audit could not complete; failing closed.", report.error);
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities || {};
const serious = Object.entries(vulnerabilities).filter(([, vulnerability]) =>
  ["high", "critical"].includes(String(vulnerability?.severity || "").toLowerCase()),
);

function seriousAdvisoriesFor(packageName, seen = new Set()) {
  if (seen.has(packageName)) return new Set();
  seen.add(packageName);

  const vulnerability = vulnerabilities[packageName];
  const advisoryIds = new Set();
  for (const via of vulnerability?.via || []) {
    if (typeof via === "string") {
      for (const id of seriousAdvisoriesFor(via, seen)) advisoryIds.add(id);
      continue;
    }

    if (!["high", "critical"].includes(String(via?.severity || "").toLowerCase())) continue;
    const match = String(via?.url || "").match(/GHSA-[A-Za-z0-9-]+/i);
    if (match) advisoryIds.add(match[0]);
    else advisoryIds.add(`unidentified:${packageName}`);
  }
  return advisoryIds;
}

const unexpected = [];
const observedAllowed = new Set();
for (const [packageName] of serious) {
  const advisoryIds = seriousAdvisoriesFor(packageName);
  if (!advisoryIds.size) {
    unexpected.push(`${packageName}: no resolvable HIGH/CRITICAL advisory ID`);
    continue;
  }

  for (const advisoryId of advisoryIds) {
    if (ALLOWED_BUILD_TOOL_ADVISORIES.has(advisoryId)) observedAllowed.add(advisoryId);
    else unexpected.push(`${packageName}: ${advisoryId}`);
  }
}

if (unexpected.length) {
  console.error("Unexpected HIGH/CRITICAL mobile dependency advisories detected:");
  for (const item of [...new Set(unexpected)]) console.error(`- ${item}`);
  process.exit(1);
}

if (observedAllowed.size) {
  console.warn("Known Expo/Metro build-tool advisories remain temporarily accepted for SDK 54:");
  for (const advisoryId of [...observedAllowed].sort()) console.warn(`- ${advisoryId}`);
}

console.log("Mobile release dependency gate passed: no unexpected HIGH/CRITICAL advisories.");
