/**
 * API base URL, split by execution context:
 *
 * - Browser: same-origin ('') so /api/* requests go through the Next.js
 *   rewrite (next.config.ts) and are proxied server-side to Render. Client
 *   networks that blocklist *.onrender.com (some ISP/DNS filters do — the
 *   domain is widely abused for phishing) never see that hostname.
 * - Server (API routes / SSR): absolute Render URL — server-to-server calls
 *   are unaffected by client-side blocklists, and Node's fetch() requires an
 *   absolute URL anyway.
 *
 * NEXT_PUBLIC_API_URL still overrides the browser value for non-Vercel
 * deployments; API_SERVER_URL overrides the server value.
 */
export const API_BASE =
  typeof window === 'undefined'
    ? process.env.API_SERVER_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      'https://amise-medflow-api.onrender.com'
    : process.env.NEXT_PUBLIC_API_URL ?? '';

export const SITE_LABELS: Record<string, string> = {
  rodney_bay: 'Rodney Bay',
  tapion: 'Tapion / ERCP',
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
  // Procedure-prep adjustments: never let a draft specify anticoagulant/diabetes
  // medication stop-timing, dose changes, or bowel-prep product substitutions —
  // those are clinical decisions for Dr Kabiye, not the assistant.
  /\b(stop|hold|discontinue|restart|resume)\b[^.]{0,40}\b(warfarin|coumadin|apixaban|eliquis|rivaroxaban|xarelto|dabigatran|pradaxa|edoxaban|lixiana|clopidogrel|plavix|ticagrelor|aspirin|heparin|enoxaparin|lovenox|insulin|metformin|gliclazide)\b/i,
  /\b(switch|change)\b[^.]{0,30}\b(insulin|dose|medication|prep)\b[^.]{0,20}\bto\b/i,
  /\b(use|take|switch to)\b[^.]{0,20}\b(golytely|moviprep|miralax|picolax|citromag|fleet|dulcolax|peglyte|pico.?salax)\b/i,
];
