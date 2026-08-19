const fs = require('fs');

function isValidEvent(event) {
  return Boolean(event && typeof event.id === 'string' && typeof event.name === 'string' &&
    Number.isFinite(Date.parse(event.startDateTime)) && Number.isFinite(Date.parse(event.endDateTime)));
}

function readCalendarEvents(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed) ? parsed.filter(isValidEvent) : [];
  } catch {
    return [];
  }
}

function filterCalendarEvents(events, filters = {}, now = new Date()) {
  const value = text => String(text || '').toLowerCase();
  return events.filter(isValidEvent).filter(event => {
    if (new Date(event.endDateTime) < now) return false;
    if (filters.region && value(event.region) !== value(filters.region)) return false;
    if (filters.category && !event.categories?.some(item => value(item) === value(filters.category))) return false;
    if (filters.tcg && !event.supportedTcgs?.some(item => value(item) === value(filters.tcg))) return false;
    if (filters.month && event.startDateTime.slice(0, 7) !== filters.month) return false;
    if (filters.free === 'true' && !/\bfree\b/i.test(event.ticketPriceText || '')) return false;
    if (filters.vendors === 'true' && event.vendorApplicationsStatus !== 'open') return false;
    return true;
  }).sort((a, b) => Date.parse(a.startDateTime) - Date.parse(b.startDateTime));
}

module.exports = { isValidEvent, readCalendarEvents, filterCalendarEvents };
