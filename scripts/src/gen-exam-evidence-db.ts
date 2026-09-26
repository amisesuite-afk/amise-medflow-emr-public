/**
 * iOS DiagnosticDatabase.json 2.2.0 — examination-sign and decision-rule features (evidence-exam).
 *
 *   pnpm --filter @workspace/scripts exec tsx src/gen-exam-evidence-db.ts
 *
 * Reads clinical-content/rules/exam-signs.json and decision-rules.json and writes, into every
 * candidate whose name matches a target group's iOS name fragments:
 *   { key: "sign", value: "<sign id>:present" | "<sign id>:absent", logLR = round(5 × ln LR) }
 *     for each sign with its own likelihood ratios (engine "lr"); ":absent" only when
 *     negativeMeaningful. A second target (alsoTargets) gets its own LR+ (LR- derived from the
 *     shared specificity). A finding-level sign (ascites, dehydration) applies its LR to the
 *     diagnoses that almost always show the finding (the group's iOS list).
 *   { key: "rule", value: "<rule id>:<band id>", logLR } for each diagnostic rule with an iOS
 *     parameter (the stored calculator result), band LR ≥ 1 or negativeMeaningful.
 * plus the curated candidate "Abdominal Wall Pain (Anterior Cutaneous Nerve Entrapment)" in
 * coreConditions (abdominalPain presentation), the target of Carnett's sign.
 *
 * Idempotent: previous "sign"/"rule" features and the curated candidate are replaced. The
 * formatting (2-space JSON, no trailing newline) matches the committed file, so the diff is only
 * the change. scripts/src/exam-evidence-db.test.ts fails when the file is not what this produces.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
export const DB_FILE = join(REPO_ROOT, 'ios/AmiseMedFlow/Resources/DiagnosticDatabase.json');
const SIGNS_FILE = join(REPO_ROOT, 'clinical-content/rules/exam-signs.json');
const RULES_FILE = join(REPO_ROOT, 'clinical-content/rules/decision-rules.json');

export const EVIDENCE_DB_VERSION = '2.2.0';
const UPDATED = '2026-09-26';
const NOTE_220 = ' 2.2.0: examination-sign ("sign", value "<id>:present|absent") and decision-rule ("rule", value "<rule>:<band>") features from clinical-content/rules/exam-signs.json and decision-rules.json (logLR = round(5 × ln LR), likelihoodRatio and citation on each; absent signs only where the absence is meaningful), and the curated Abdominal Wall Pain (ACNES) candidate. Change log: docs/clinical-validation/changes/evidence-exam.md.';
export const ACNES_NAME = 'Abdominal Wall Pain (Anterior Cutaneous Nerve Entrapment)';

type Obj = Record<string, unknown>;
interface Lr { point: number }
interface Sign {
  id: string; name: string; engine: string; negativeMeaningful: boolean; source: string;
  target: { group: string; paneFeature?: string }; alsoTargets?: { group: string; lrPositive: Lr }[];
  lrPositive: Lr | null; lrNegative: Lr | null;
}
interface Group { label: string; ios: string[] }
interface Band { id: string; label: string; lr: Lr | null }
interface Rule {
  id: string; name: string; kind: string; source: string; negativeMeaningful: boolean;
  target: { ios: string[] }; ios: { param: string } | null; bands: Band[];
}
interface Feature { key: string; value: string; logLR: number; evidenceLabel: string; citation: string; likelihoodRatio: number }

export const logLR = (lr: number) => Math.round(Math.log(lr) * 5);
const round3 = (x: number) => Math.round(x * 1000) / 1000;

function specificity(lrPos: number, lrNeg: number): number {
  return (lrPos - 1) / (lrPos - lrNeg);
}

/** A fragment matches at the start of a word ("thyroid carcinoma" is not "parathyroid carcinoma"). */
export function matches(name: string, fragments: string[]): boolean {
  const n = name.toLowerCase();
  return fragments.some(f => new RegExp(`(^|[^a-z0-9])${f.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(n));
}

/** Features to add to a candidate named `name`. */
export function evidenceFeaturesFor(name: string, signs: Sign[], groups: Record<string, Group>, rules: Rule[]): Feature[] {
  const out: Feature[] = [];
  const push = (key: string, value: string, lr: number, label: string, citation: string) => {
    const l = logLR(lr);
    if (l !== 0) out.push({ key, value, logLR: l, evidenceLabel: label, citation, likelihoodRatio: round3(lr) });
  };
  for (const s of signs) {
    if (s.engine !== 'lr' || !s.lrPositive || !s.lrNegative) continue;
    const spec = specificity(s.lrPositive.point, s.lrNegative.point);
    let lrPos: number | null = null;
    let lrNeg: number | null = null;
    if (matches(name, groups[s.target.group]?.ios ?? [])) {
      lrPos = s.lrPositive.point;
      lrNeg = s.lrNegative.point;
    } else {
      for (const a of s.alsoTargets ?? []) {
        if (!matches(name, groups[a.group]?.ios ?? [])) continue;
        const sens = Math.min(0.95, a.lrPositive.point * (1 - spec));
        lrPos = sens / (1 - spec);
        lrNeg = (1 - sens) / spec;
        break;
      }
    }
    if (lrPos === null || lrNeg === null) continue;
    push('sign', `${s.id}:present`, lrPos, `${s.name} (examined)`, s.source);
    if (s.negativeMeaningful) push('sign', `${s.id}:absent`, lrNeg, `${s.name} absent (examined)`, s.source);
  }
  for (const r of rules) {
    if (r.kind !== 'diagnostic' || !r.ios || !matches(name, r.target.ios)) continue;
    for (const b of r.bands) {
      if (!b.lr || (b.lr.point < 1 && !r.negativeMeaningful)) continue;
      push('rule', `${r.id}:${b.id}`, b.lr.point, `${r.name}: ${b.label}`, r.source);
    }
  }
  return out;
}

function acnesCandidate(): Obj {
  const takada = 'Takada T et al. Carnett\'s sign in chronic abdominal pain, J Gen Intern Med 2011; Scheltinga MR, Roumen RM. Anterior cutaneous nerve entrapment syndrome (ACNES), Hernia 2018';
  return {
    name: ACNES_NAME,
    icd: 'G58.8',
    logPrior: -5,
    prevalenceTier: 'uncommon',
    urgency: 0,
    systems: ['gastrointestinal'],
    specialties: ['generalSurgery'],
    source: `Prior tier uncommon. ${takada}.`,
    features: [
      {
        key: 'complaint',
        value: 'abdom|tummy|belly|stomach|iliac fossa|rif|ruq|luq|rlq|llq|right lower|left lower|right upper|left upper|periumbilical',
        logLR: 1, likelihoodRatio: 1.3,
        evidenceLabel: 'Abdominal pain as the presenting complaint',
        citation: 'Presentation-match weight: expert estimate pending the surgeon\'s review (no published likelihood ratio)',
      },
      {
        key: 'finding',
        value: 'pinpoint|one spot|fingertip|tender spot|trigger point|localised tenderness|localized tenderness',
        logLR: 5, likelihoodRatio: 3,
        evidenceLabel: 'Pain and tenderness at one fingertip-sized spot',
        citation: takada,
      },
      {
        key: 'associations',
        value: 'fever',
        logLR: -6, likelihoodRatio: 0.3,
        evidenceLabel: 'Fever (points to a visceral or infective cause)',
        citation: takada,
      },
    ],
  };
}

export function buildEvidenceDatabase(db: Obj, signsFile: Obj, rulesFile: Obj): Obj {
  const signs = signsFile.signs as Sign[];
  const groups = signsFile.targetGroups as Record<string, Group>;
  const rules = rulesFile.rules as Rule[];
  const pools = db.pools as Record<string, { candidates: Obj[] }>;
  const core = pools.coreConditions;
  core.candidates = core.candidates.filter(c => c.name !== ACNES_NAME);
  core.candidates.push(acnesCandidate());
  for (const pool of Object.values(pools)) {
    for (const c of pool.candidates) {
      const kept = (c.features as Feature[]).filter(f => f.key !== 'sign' && f.key !== 'rule');
      c.features = [...kept, ...evidenceFeaturesFor(c.name as string, signs, groups, rules)];
    }
  }
  const presentations = db.presentations as { id: string; candidates: string[] }[];
  const abdo = presentations.find(p => p.id === 'abdominalPain');
  if (abdo && !abdo.candidates.includes(ACNES_NAME)) abdo.candidates.push(ACNES_NAME);
  const note = String(db.note ?? '');
  return {
    ...db,
    version: EVIDENCE_DB_VERSION,
    updated: UPDATED,
    lastUpdated: UPDATED,
    note: note.includes(' 2.2.0:') ? note : note + NOTE_220,
  };
}

export function generatedDatabaseText(currentText: string): string {
  const db = JSON.parse(currentText) as Obj;
  const signs = JSON.parse(readFileSync(SIGNS_FILE, 'utf8')) as Obj;
  const rules = JSON.parse(readFileSync(RULES_FILE, 'utf8')) as Obj;
  return JSON.stringify(buildEvidenceDatabase(db, signs, rules), null, 2);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const current = readFileSync(DB_FILE, 'utf8');
  const next = generatedDatabaseText(current);
  writeFileSync(DB_FILE, next);
  const db = JSON.parse(next) as Obj;
  let signs = 0; let ruleFeatures = 0;
  for (const pool of Object.values(db.pools as Record<string, { candidates: { features: Feature[] }[] }>)) {
    for (const c of pool.candidates) for (const f of c.features) { if (f.key === 'sign') signs++; if (f.key === 'rule') ruleFeatures++; }
  }
  console.log(`DiagnosticDatabase.json ${EVIDENCE_DB_VERSION}: ${signs} sign features, ${ruleFeatures} rule features`);
}
