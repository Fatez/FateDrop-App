export function retailOfferViewState(input: {
  loading: boolean;
  status?: string | null;
  visibleCount: number;
}): 'loading' | 'empty' | 'unavailable' | 'available' | 'filtered';
