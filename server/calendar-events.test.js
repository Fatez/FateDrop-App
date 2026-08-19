const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { readCalendarEvents, filterCalendarEvents } = require('./calendar-events');

const event = (id, start, end, extra = {}) => ({ id, name: id, startDateTime: start, endDateTime: end, ...extra });
const now = new Date('2026-12-31T12:00:00Z');

test('events sort chronologically and expired events are excluded', () => {
  const events = [event('later','2027-02-01T10:00:00Z','2027-02-01T17:00:00Z'), event('old','2026-01-01T10:00:00Z','2026-01-01T17:00:00Z'), event('first','2027-01-01T10:00:00Z','2027-01-01T17:00:00Z')];
  assert.deepEqual(filterCalendarEvents(events, {}, now).map(item => item.id), ['first','later']);
});
test('region and category filters are case insensitive', () => {
  const events = [event('a','2027-01-01T10:00:00Z','2027-01-01T17:00:00Z',{region:'London',categories:['Card show']})];
  assert.equal(filterCalendarEvents(events,{region:'london',category:'card show'},now).length,1);
});
test('month filter handles a year boundary', () => {
  const events = [event('dec','2027-12-31T10:00:00Z','2028-01-01T17:00:00Z'),event('jan','2028-01-01T10:00:00Z','2028-01-01T17:00:00Z')];
  assert.deepEqual(filterCalendarEvents(events,{month:'2028-01'},now).map(item=>item.id),['jan']);
});
test('missing optional fields are safe', () => assert.equal(filterCalendarEvents([event('a','2027-01-01','2027-01-02')],{},now).length,1));
test('malformed data returns an empty list', () => { const file=path.join(os.tmpdir(),`fatedrop-${Date.now()}.json`);fs.writeFileSync(file,'{bad');assert.deepEqual(readCalendarEvents(file),[]);fs.unlinkSync(file); });
