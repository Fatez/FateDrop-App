const SAVED_EVENTS_KEY = '@fatedrop/saved-encounter-ids/v1';

function isSafeExternalUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:'; } catch { return false; }
}
function formatEventDate(startValue, endValue) {
  const start = new Date(startValue), end = new Date(endValue);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return 'Date to be confirmed';
  const day = new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/London'});
  const time = new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'});
  const sameDay = start.toLocaleDateString('en-CA',{timeZone:'Europe/London'}) === end.toLocaleDateString('en-CA',{timeZone:'Europe/London'});
  return sameDay ? `${day.format(start)}, ${time.format(start)}–${time.format(end)}` : `${day.format(start)} – ${day.format(end)}`;
}
async function loadSavedEventIds(storage) {
  try { const value=JSON.parse((await storage.getItem(SAVED_EVENTS_KEY)) || '[]');return Array.isArray(value)?value.filter(id=>typeof id==='string'):[]; } catch { return []; }
}
async function saveEventIds(storage, ids) { await storage.setItem(SAVED_EVENTS_KEY, JSON.stringify([...new Set(ids)])); }
module.exports={SAVED_EVENTS_KEY,isSafeExternalUrl,formatEventDate,loadSavedEventIds,saveEventIds};
