/**
 * Native clinical document parser.
 * Extracts structured fields from Markdown text (markitdown output) using
 * regex/pattern matching — zero tokens, zero API calls.
 *
 * Returns an `ExtractedData` payload and a `confidence` score (0–1).
 * Callers use confidence to decide whether to fall back to Claude.
 */

export interface ExtractedData {
  patientName:       string | null;
  diagnosis:         string | null;
  staging:           string | null;
  histology:         string | null;
  mmrStatus:         string | null;
  treatmentSummary:  string[];
  currentAssessment: string | null;
  plan:              string | null;
  medications:       string[];
  investigations:    string[];
  surveillancePlan:  string[];
  pendingActions:    string[];
  keyFlags:          string[];
  prognosis:         string | null;
  fullText:          string;
}

export interface ParseResult {
  extracted:  ExtractedData;
  confidence: number; // 0–1
}

// ─── helpers ────────────────────────────────────────────────────────────────

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return null;
}

function listMatches(text: string, patterns: RegExp[]): string[] {
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      return m[1]
        .split(/\n|;|,(?=\s[A-Z])/g)
        .map(s => s.replace(/^[-•*\d.]\s*/, '').trim())
        .filter(s => s.length > 2 && s.length < 200);
    }
  }
  return [];
}

function sectionText(text: string, headings: string[]): string | null {
  const escaped = headings.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp(
    `(?:${escaped})[:\\s]*([\\s\\S]{10,600}?)(?=\\n(?:[A-Z][A-Za-z ]{2,30}:|##|\\*\\*[A-Z])|$)`,
    'i',
  );
  const m = text.match(re);
  return m?.[1]?.trim() ?? null;
}

// ─── main parser ────────────────────────────────────────────────────────────

export function parseClinicalDocument(markdown: string): ParseResult {
  const t = markdown;

  // Patient name — try common label patterns, then "Re:" / salutation lines
  const patientName = firstMatch(t, [
    /(?:patient\s*name|patient|name|full\s*name)\s*[:\-]\s*([A-Z][a-zA-Z'\- ]{2,60})/i,
    /\bRe\s*:\s*([A-Z][a-zA-Z'\- ]{2,60})/i,
    /Dear\s+(?:Dr\.?\s+\w+\s*,\s*)?(?:re\s*:\s*)?([A-Z][a-zA-Z'\- ]{2,60})/i,
  ]);

  // Diagnosis
  const diagnosis = firstMatch(t, [
    /(?:diagnosis|impression|primary\s*diagnosis|working\s*diagnosis)\s*[:\-]\s*(.{5,200})/i,
    /(?:assessment)\s*[:\-]\s*(.{5,200})/i,
  ]);

  // Staging
  const staging = firstMatch(t, [
    /\bstage\s*[:\-]?\s*((?:I{1,3}V?|IV|[0-4])(?:\s*[A-C])?)\b/i,
    /\b(pT\d[a-z]?\s*N\d\s*M\d[a-z]?)\b/i,
  ]);

  // Histology
  const histology = firstMatch(t, [
    /(?:histology|histopathology|pathology|cell\s*type)\s*[:\-]\s*(.{5,150})/i,
    /\b(adenocarcinoma|squamous\s*cell|carcinoma|lymphoma|melanoma|sarcoma|glioma|mesothelioma)\b/i,
  ]);

  // MMR / mismatch repair
  const mmrStatus = firstMatch(t, [
    /(?:mmr|mismatch\s*repair|microsatellite)\s*[:\-]\s*(.{3,100})/i,
    /\b(MSI-H|MSI-L|MSS|dMMR|pMMR)\b/i,
  ]);

  // Medications
  const medications = listMatches(t, [
    /(?:medications?|current\s*medications?|drugs?|pharmacotherapy)\s*[:\-]\s*([\s\S]{5,600}?)(?=\n[A-Z][A-Za-z ]{2,30}:|$)/i,
  ]);

  // Investigations
  const investigations = listMatches(t, [
    /(?:investigations?|results?|laboratory|labs?|imaging)\s*[:\-]\s*([\s\S]{5,600}?)(?=\n[A-Z][A-Za-z ]{2,30}:|$)/i,
  ]);

  // Plan
  const plan = sectionText(t, ['Plan', 'Management', 'Recommendations', 'Proposed management']);

  // Current assessment
  const currentAssessment = sectionText(t, ['Current assessment', 'Clinical summary', 'Summary', 'Assessment and plan']);

  // Surveillance plan
  const surveillancePlan = listMatches(t, [
    /(?:surveillance|follow[- ]up\s*plan|monitoring)\s*[:\-]\s*([\s\S]{5,400}?)(?=\n[A-Z][A-Za-z ]{2,30}:|$)/i,
  ]);

  // Pending actions
  const pendingActions = listMatches(t, [
    /(?:pending|outstanding|action\s*items?|to\s*do)\s*[:\-]\s*([\s\S]{5,400}?)(?=\n[A-Z][A-Za-z ]{2,30}:|$)/i,
  ]);

  // Prognosis
  const prognosis = firstMatch(t, [
    /(?:prognosis|outlook|expected\s*outcome)\s*[:\-]\s*(.{5,200})/i,
  ]);

  // Key flags — scan for explicit red-flag language
  const keyFlags: string[] = [];
  const flagPatterns: [RegExp, string][] = [
    [/\ballerg(?:y|ic)\s+to\s+([^.\n]{3,80})/gi,       'Allergy: $1'],
    [/\bDNR\b|\bdo\s+not\s+resuscitate\b/i,             'DNR order documented'],
    [/\bwarfarin\b|\banticoagulat/i,                    'Anticoagulation — check INR before procedure'],
    [/\bimmunosuppress/i,                               'Immunosuppressed — infection risk'],
    [/\bdiabetes\b|\bT2DM\b|\bT1DM\b/i,                'Diabetes — perioperative glucose management'],
    [/\bpenicillin\s+allerg/i,                          'Penicillin allergy'],
    [/\blatex\s+allerg/i,                               'Latex allergy'],
    [/\bpregnant\b|\bpregnancy\b/i,                     'Pregnancy documented'],
    [/\bCKD\b|\brenal\s+fail/i,                         'Renal impairment — dose-adjust renally cleared drugs'],
    [/\bhepatic\s+fail|\bcirrhosis\b|\bchild[- ]pugh\b/i, 'Hepatic impairment'],
  ];
  for (const [re, label] of flagPatterns) {
    const m = t.match(re);
    if (m) keyFlags.push(label.replace('$1', m[1] ?? ''));
  }

  // Treatment summary — chronological event lines
  const treatmentSummary = listMatches(t, [
    /(?:treatment\s*summary|clinical\s*history|history\s*of\s*present\s*illness|past\s*surgical\s*history)\s*[:\-]\s*([\s\S]{10,800}?)(?=\n[A-Z][A-Za-z ]{2,30}:|$)/i,
  ]);

  // ─── confidence score ──────────────────────────────────────────────────────
  // Each successfully extracted primary field adds weight.
  // 0.4 = definitely send to Claude; 0.75+ = good enough native.
  let score = 0;
  if (patientName)        score += 0.25;
  if (diagnosis)          score += 0.20;
  if (plan)               score += 0.15;
  if (medications.length) score += 0.10;
  if (currentAssessment)  score += 0.10;
  if (investigations.length) score += 0.10;
  if (staging)            score += 0.05;
  if (histology)          score += 0.05;

  const extracted: ExtractedData = {
    patientName,
    diagnosis,
    staging,
    histology,
    mmrStatus,
    treatmentSummary,
    currentAssessment,
    plan,
    medications,
    investigations,
    surveillancePlan,
    pendingActions,
    keyFlags,
    prognosis,
    fullText: markdown,
  };

  return { extracted, confidence: Math.min(score, 1) };
}
