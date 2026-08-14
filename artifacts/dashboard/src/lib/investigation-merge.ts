// Shared dedup logic for merging investigation labels into ctx.orderedInvestigations.
//
// Multiple ManagementProtocol entries for clinically overlapping diagnoses
// (e.g. cholecystitis, cholangitis, choledocholithiasis) word the same test
// panel slightly differently — 'LFTs, bilirubin, ALP, GGT' vs 'LFTs,
// bilirubin (conjugated), ALP, GGT'; 'Amylase (exclude pancreatitis)' vs
// 'Amylase / lipase (exclude pancreatitis)'. An exact-string dedup lets both
// through as the differential shifts between protocols during a consultation.
// This compares normalized word sets instead, so near-identical labels are
// recognised as the same order.

const STOPWORDS = new Set(['if', 'before', 'exclude', 'excludes', 'and', 'or', 'the', 'a', 'an', 'to', 'assess', 'unavailable']);

function normalizeWords(label: string): Set<string> {
  const stripped = label
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')      // drop parenthetical explanations entirely
    .replace(/[×x]\s*\d+/g, ' ')     // drop "x2" / "× 2" multipliers
    .replace(/[^a-z0-9\s]/g, ' ');   // strip remaining punctuation (commas, slashes)
  return new Set(
    stripped.split(/\s+/).filter(Boolean).filter(w => !STOPWORDS.has(w)),
  );
}

/** True if `label` is substantially the same test panel as something already in `existing`. */
export function isAlreadyOrdered(label: string, existing: string[]): boolean {
  const words = normalizeWords(label);
  if (!words.size) return false;
  for (const ex of existing) {
    const exWords = normalizeWords(ex);
    if (!exWords.size) continue;
    let overlap = 0;
    for (const w of words) if (exWords.has(w)) overlap++;
    const ratio = overlap / Math.min(words.size, exWords.size);
    if (ratio >= 0.6) return true;
  }
  return false;
}

/** Filters `candidates` down to labels not already present (by fuzzy match) in `existing`. */
export function filterNewInvestigations(candidates: string[], existing: string[]): string[] {
  const result: string[] = [];
  for (const c of candidates) {
    if (!isAlreadyOrdered(c, existing) && !isAlreadyOrdered(c, result)) result.push(c);
  }
  return result;
}

/**
 * Splits protocol-suggested investigations into what should auto-populate the
 * ordered list ('stat'/'urgent' — essential, time-critical regardless of
 * which candidate diagnosis turns out to be right) vs what should only be
 * offered as a one-tap suggestion ('routine' — secondary, doesn't need to
 * land in the record until a clinician actually wants it). Auto-adding every
 * tier for every differential in play is what turns the ordered list into
 * noise as the differential shifts during a consultation.
 */
export function splitEssentialSecondary<T extends { label: string; urgency: 'stat' | 'urgent' | 'routine' }>(
  items: T[],
): { essential: T[]; secondary: T[] } {
  const essential: T[] = [];
  const secondary: T[] = [];
  for (const item of items) {
    (item.urgency === 'routine' ? secondary : essential).push(item);
  }
  return { essential, secondary };
}
