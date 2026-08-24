const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const indiesRoute = fs.readFileSync(path.join(__dirname, '../app/(tabs)/indies.tsx'), 'utf8');
const indies = fs.readFileSync(path.join(__dirname, '../screens/indies-screen-v2.tsx'), 'utf8');
const directory = fs.readFileSync(path.join(__dirname, '../services/retailer-directory.ts'), 'utf8');
const encountersRoute = fs.readFileSync(path.join(__dirname, '../app/encounters/index.tsx'), 'utf8');
const encounters = fs.readFileSync(path.join(__dirname, '../screens/encounters-screen-v2.tsx'), 'utf8');
const moreRoute = fs.readFileSync(path.join(__dirname, '../app/(tabs)/more.tsx'), 'utf8');
const more = fs.readFileSync(path.join(__dirname, '../screens/more-screen-v2.tsx'), 'utf8');

test('Retailers uses the live Cloud directory rather than the legacy static screen', () => {
  assert.match(indiesRoute, /indies-screen-v2/);
  assert.match(indies, /fetchRetailerDirectory/);
  assert.match(directory, /\/api\/retailers/);
  assert.match(indies, /\['independent', 'specialist', 'regional'\]/);
  assert.match(indies, /retailerClass === 'national'/);
  assert.match(indies, /MONITOR HEALTHY/);
  assert.match(indies, /FateDrop does not substitute demo retailers into the live directory/);
  assert.match(indies, /physical presence is explicitly known/);
  assert.match(indies, /not a promise that these shops sell at RRP/);
});

test('Fate Encounters keeps live events and saved-event behaviour in the redesigned screen', () => {
  assert.match(encountersRoute, /encounters-screen-v2/);
  assert.match(encounters, /\/api\/calendar-events/);
  assert.match(encounters, /loadSavedEventIds/);
  assert.match(encounters, /saveEventIds/);
  assert.match(encounters, /does not fill the calendar with fictional listings/);
});

test('More becomes a focused account and collector-tools hub', () => {
  assert.match(moreRoute, /more-screen-v2/);
  assert.match(more, /COLLECTOR TOOLS/);
  assert.match(more, /ACCOUNT & EXPERIENCE/);
  assert.match(more, /Notification preferences/);
  assert.match(more, /Advanced systems stay behind the interface/);
});
