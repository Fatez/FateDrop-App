const IPV4_LITERAL = /^\d{1,3}(?:\.\d{1,3}){3}$/;

function forbiddenHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true;
  // Retailer links should use ordinary public hostnames. Reject literal IPs so a
  // notification cannot point the device at loopback/private/link-local ranges.
  if (IPV4_LITERAL.test(host) || host.startsWith('[') || host.includes(':')) return true;
  return false;
}

export function safeExternalHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    if (forbiddenHostname(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}
