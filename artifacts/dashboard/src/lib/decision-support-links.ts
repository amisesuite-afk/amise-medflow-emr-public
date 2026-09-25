/**
 * Loose coupling between the Plan-step decision support ("Test further" band) and the
 * diagnostic-reasoning panel's best next discriminating test (information gain), which another
 * part of the app owns. That panel may register a provider; decision support then shows its
 * suggestion next to the band. No provider (or a provider that throws) → the decision's own
 * guideline test is shown. No hard dependency either way.
 */

export interface BestNextTest {
  label: string;
  /** Short note, e.g. "largest expected information gain". */
  note?: string;
}

export type BestNextTestProvider = (diagnosis: { diseaseId: string | null; name: string }) => BestNextTest | null;

let provider: BestNextTestProvider | null = null;

export function setBestNextTestProvider(p: BestNextTestProvider | null): void {
  provider = p;
}

export function bestNextTest(diagnosis: { diseaseId: string | null; name: string }): BestNextTest | null {
  if (!provider) return null;
  try {
    const r = provider(diagnosis);
    return r && typeof r.label === 'string' && r.label.trim() ? r : null;
  } catch {
    return null;
  }
}
