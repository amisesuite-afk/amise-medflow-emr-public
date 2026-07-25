import { useMemo } from 'react';

interface Props {
  /** Allergy free-text from the patient record, e.g. "Penicillin, Sulfa, Latex" */
  allergies: string;
  medications: string[];
  medicationsText: string;
}

interface AllergyHit {
  allergen: string;
  matchedMed: string;
}

/** Tokenise a string into lower-case terms (comma/semicolon/newline separated). */
function tokenise(text: string): string[] {
  return text
    .split(/[\n,;\/]+/)
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length >= 3 && s !== 'nkda' && !s.includes('no known'));
}

/** Returns true if medToken contains allergenToken or vice versa (substring match). */
function matches(allergen: string, med: string): boolean {
  return med.includes(allergen) || allergen.includes(med);
}

function checkAllergyMedConflicts(
  allergyText: string,
  medications: string[],
  medicationsText: string,
): AllergyHit[] {
  const allergens = tokenise(allergyText);
  if (!allergens.length) return [];

  const allMeds = [
    ...medications.map(m => m.toLowerCase()),
    ...tokenise(medicationsText),
  ];

  const hits: AllergyHit[] = [];
  for (const allergen of allergens) {
    for (const med of allMeds) {
      if (matches(allergen, med)) {
        // De-duplicate: don't report the same allergen twice
        if (!hits.find(h => h.allergen === allergen && h.matchedMed === med)) {
          hits.push({ allergen, matchedMed: med });
        }
      }
    }
  }
  return hits;
}

export default function AllergyMedAlert({ allergies, medications, medicationsText }: Props) {
  const hits = useMemo(
    () => checkAllergyMedConflicts(allergies, medications, medicationsText),
    [allergies, medications, medicationsText],
  );

  if (!hits.length) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        ⚠ Allergy — medication conflict
      </div>
      {hits.map((hit, i) => (
        <div key={i} style={{
          background: '#fef2f2', border: '1.5px solid #fca5a5',
          borderRadius: 7, padding: '8px 12px', marginBottom: 6,
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', flexShrink: 0, marginTop: 4 }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#991b1b' }}>
              Known allergy to <em>{hit.allergen}</em> — medication <em>{hit.matchedMed}</em> may be contraindicated
            </div>
            <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 2 }}>
              Verify with prescribing clinician before proceeding. Remove the medication if this is an error.
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
