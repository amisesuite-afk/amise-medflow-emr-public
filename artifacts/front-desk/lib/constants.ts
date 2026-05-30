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
  /diagnos/i,
  /your (result|test)/i,
  /EC\$?\s*\d+/i,
  /fee[s]?.*\$?/i,
  /medication dose/i,
  /mg\b/i,
];
