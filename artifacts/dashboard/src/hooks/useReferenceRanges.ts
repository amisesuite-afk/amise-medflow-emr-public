import { useEffect, useState } from 'react';
import type { ReferenceRange } from '@workspace/triage-engine/reference-ranges';
import { loadReferenceRanges, subscribeReferenceRanges, type RangeLoad } from '@/lib/reference-ranges-store';

const EMPTY: RangeLoad = { available: false, practice: [], rows: [], error: null };

/**
 * The practice reference ranges (empty until loaded, or when the table is absent: every lookup
 * then uses the built-in defaults). Shared, in-memory, one fetch per page load; an admin save
 * refreshes every user of the hook.
 */
export function useReferenceRangeData(): RangeLoad & { loaded: boolean } {
  const [state, setState] = useState<RangeLoad & { loaded: boolean }>({ ...EMPTY, loaded: false });
  useEffect(() => {
    let alive = true;
    void loadReferenceRanges().then(r => { if (alive) setState({ ...r, loaded: true }); });
    const off = subscribeReferenceRanges(r => { if (alive) setState({ ...r, loaded: true }); });
    return () => { alive = false; off(); };
  }, []);
  return state;
}

/** Just the live practice ranges, for the lookups. */
export function useReferenceRanges(): ReferenceRange[] {
  return useReferenceRangeData().practice;
}
