/**
 * Printed note: plan lines that only repeat an investigation already listed under
 * "Investigations requested" (UX review M12). The note used to print both, with a banner
 * "Investigations already ordered above — plan sections 1–2 may overlap".
 *
 * Only a WHOLE plan line that is exactly an ordered item (ignoring a bullet / number and case) is
 * left out of the printed plan. Anything else — a line with more words, context, a date — is kept.
 * The plan stored in the record is never changed; this applies to the printout only.
 */

function normalise(line: string): string {
  return line
    .replace(/^\s*(?:[-•*·–]|\d+[.)])\s*/, '')   // bullet or "1." / "1)"
    .replace(/[.;:,\s]+$/, '')                    // trailing punctuation
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function dedupePlanAgainstOrders(plan: string, ordered: readonly string[]): { plan: string; removed: number } {
  const orders = new Set(ordered.map(normalise).filter(Boolean));
  if (orders.size === 0 || !plan) return { plan, removed: 0 };
  let removed = 0;
  const kept = plan.split('\n').filter(line => {
    const n = normalise(line);
    if (n && orders.has(n)) { removed++; return false; }
    return true;
  });
  return { plan: kept.join('\n'), removed };
}
