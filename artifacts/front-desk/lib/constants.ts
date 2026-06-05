export const SITE_LABELS: Record<string, string> = {
  rodney_bay: 'Rodney Bay',
  tapion: 'Tapion / ERCP',
  castries: 'Castries',
};

export const INTAKE_SECTIONS: Record<string, string> = {
  A: 'Identity',
  B: 'Contact',
  C: 'Chief complaint',
  D: 'Symptom detail',
  E: 'Red-flag screen',
  F: 'Medical context',
  G: 'Scheduling',
};

export const FORBIDDEN_PATTERNS: RegExp[] = [
  // Diagnoses
  /\bdiagnos/i,
  /\b(you (have|may have|likely have) (cancer|tumou?r|malignancy))\b/i,
  /\b(i diagnose|i can confirm you have)\b/i,
  // Test / result disclosure
  /\b(your (biopsy|histology|test|blood|scan|x.ray) result)\b/i,
  /\b(the result (is|shows|confirms))\b/i,
  // Fees / financial
  /\$\s*\d/,
  /\b(EC\$|XCD|USD)\s*\d/i,
  /\bfee[s]?\b.*\d/i,
  // Drug doses
  /\b(take|increase|decrease|stop)\s+\d+\s*mg\b/i,
  /\b\d+\s*mg\b/i,
  /\bmedication dose\b/i,
];
