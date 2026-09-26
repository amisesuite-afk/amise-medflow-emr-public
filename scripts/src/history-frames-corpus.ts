/**
 * The chief complaints the history-frame audit runs over: every CC chip and questionnaire
 * category on iOS, and every CC template and SmartSymptomPicker symptom on the web. Parsed from
 * source so a new complaint joins the audit without a list to keep in step.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const ROOT = join(import.meta.dirname, '..', '..');

export interface CorpusEntry {
  complaint: string;
  /** Specialty group of an iOS CC chip (ConsultationView's selectedSpecialtyHint). */
  system?: string;
  source: 'ios.ccChip' | 'ios.questionnaire' | 'web.ccTemplate' | 'web.symptom';
  /** Web CC template id (web.ccTemplate only). */
  templateId?: string;
}

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

/** iOS: CCSpecialtyGroup(name: "…", …) { CCSurgicalChip(label: "…") }. */
export function iosCcChips(): CorpusEntry[] {
  const src = read('ios/AmiseMedFlow/Views/Consultation/ConsultationViewChipData.swift');
  const out: CorpusEntry[] = [];
  let system: string | undefined;
  for (const line of src.split('\n')) {
    const g = /CCSpecialtyGroup\(name:\s*"([^"]+)"/.exec(line);
    if (g) { system = g[1]; continue; }
    const c = /CCSurgicalChip\(label:\s*"([^"]+)"/.exec(line);
    if (c && system) out.push({ complaint: c[1]!, system, source: 'ios.ccChip' });
  }
  return out;
}

/** iOS: EncounterQuestionnaire CCCategory raw values (front-desk questionnaire). */
export function iosQuestionnaire(): CorpusEntry[] {
  const src = read('ios/AmiseMedFlow/Services/EncounterQuestionnaire.swift');
  const block = src.slice(src.indexOf('enum CCCategory'), src.indexOf('var isPainType'));
  return [...block.matchAll(/case\s+\w+\s*=\s*"([^"]+)"/g)].map(m => ({ complaint: m[1]!, source: 'ios.questionnaire' as const }));
}

/** Web: cc-matrices.ts CC_TEMPLATES ids and names. */
export function webTemplates(): CorpusEntry[] {
  const src = read('artifacts/dashboard/src/lib/cc-matrices.ts');
  const out: CorpusEntry[] = [];
  const re = /id:\s*'([^']+)',\s*\n\s*name:\s*(['"])(.+?)\2,/g;
  for (const m of src.matchAll(re)) out.push({ complaint: m[3]!, templateId: m[1]!, source: 'web.ccTemplate' });
  return out;
}

/** Web: symptoms-db.ts SYMPTOM_GROUPS symptoms (SmartSymptomPicker; each can become a CC entry). */
export function webSymptoms(): CorpusEntry[] {
  const src = read('artifacts/dashboard/src/data/symptoms-db.ts');
  const out: CorpusEntry[] = [];
  for (const m of src.matchAll(/symptoms:\s*\[([\s\S]*?)\]/g)) {
    for (const s of m[1]!.matchAll(/'([^']+)'/g)) out.push({ complaint: s[1]!, source: 'web.symptom' });
  }
  return out;
}

export function corpus(): CorpusEntry[] {
  const seen = new Set<string>();
  const out: CorpusEntry[] = [];
  for (const e of [...iosCcChips(), ...iosQuestionnaire(), ...webTemplates(), ...webSymptoms()]) {
    const k = `${e.source}|${e.complaint}|${e.system ?? ''}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}
