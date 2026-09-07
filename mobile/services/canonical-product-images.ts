import { ApiCatalogueRepository } from '@/services/catalogue';
import type { ProductOffer } from '@/types/domain';

const catalogue = new ApiCatalogueRepository();
const OFFICIAL_IMAGE_RETAILERS = new Set(['pokemon-center-uk']);
const imageCache = new Map<string, string | null>();
const imageFlights = new Map<string, Promise<string | null>>();

function text(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

function isRemoteImage(value: string | null | undefined) {
  const url = text(value);
  return /^https:\/\//i.test(url) ? url : null;
}

function likelyTransparentAsset(url: string) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return pathname.endsWith('.png') || pathname.endsWith('.webp');
  } catch {
    return false;
  }
}

function scoreCandidate(offer: ProductOffer, fallbackImageUrl: string | null) {
  const imageUrl = isRemoteImage(offer.imageUrl);
  if (!imageUrl) return -1;
  let score = 0;
  if (OFFICIAL_IMAGE_RETAILERS.has(offer.retailerId)) score += 1000;
  if (likelyTransparentAsset(imageUrl)) score += 120;
  if (fallbackImageUrl && imageUrl === fallbackImageUrl) score -= 25;
  return score;
}

export function chooseExactCanonicalProductImage({
  productId,
  fallbackImageUrl,
  candidates,
}: {
  productId: string | null | undefined;
  fallbackImageUrl: string | null | undefined;
  candidates: ProductOffer[];
}) {
  const exactProductId = text(productId);
  const fallback = isRemoteImage(fallbackImageUrl);
  if (!exactProductId) return fallback;

  const exactCandidates = candidates
    .filter((offer) => offer.canonicalProductId === exactProductId && Boolean(isRemoteImage(offer.imageUrl)))
    .sort((left, right) => scoreCandidate(right, fallback) - scoreCandidate(left, fallback));

  const best = exactCandidates[0];
  const bestImage = best ? isRemoteImage(best.imageUrl) : null;

  // Do not swap one ordinary retailer JPEG for another. The resolver only replaces
  // the observed retailer image when the exact canonical product has either an
  // official-source image or a likely transparent asset. Otherwise the original
  // evidence image remains untouched.
  if (bestImage && (OFFICIAL_IMAGE_RETAILERS.has(best.retailerId) || likelyTransparentAsset(bestImage))) {
    return bestImage;
  }
  return fallback;
}

export async function resolveExactCanonicalProductImage({
  productId,
  title,
  fallbackImageUrl,
  tcgCode,
}: {
  productId: string | null | undefined;
  title: string | null | undefined;
  fallbackImageUrl: string | null | undefined;
  tcgCode: string | null | undefined;
}) {
  const exactProductId = text(productId);
  const query = text(title);
  const fallback = isRemoteImage(fallbackImageUrl);

  // This pilot uses the existing Pokémon catalogue contract. Other TCGs fail
  // closed to their observed image until the catalogue query accepts tcgCode.
  if (!exactProductId || !query || text(tcgCode).toLowerCase() !== 'pokemon') return fallback;
  if (imageCache.has(exactProductId)) return imageCache.get(exactProductId) ?? fallback;

  const inFlight = imageFlights.get(exactProductId);
  if (inFlight) return (await inFlight) ?? fallback;

  const flight = catalogue.list({ query, limit: 100 })
    .then((page) => chooseExactCanonicalProductImage({
      productId: exactProductId,
      fallbackImageUrl: fallback,
      candidates: page.offers,
    }))
    .catch(() => fallback)
    .finally(() => imageFlights.delete(exactProductId));

  imageFlights.set(exactProductId, flight);
  const resolved = await flight;
  imageCache.set(exactProductId, resolved);
  return resolved ?? fallback;
}
