/**
 * DiagnosticDatabase.json (iOS differential) checked against the Swift Codable structs that
 * read it, plus the 2.0.0 content rules. Used by lint-guideline-registry.ts (fails the build)
 * and diagnostic-database-schema.test.ts.
 *
 * decodeProblems() mirrors, field by field:
 *   BayesianDiagnosisEngine.CandidateDatabase { version: String, pools: [String: PoolSpec],
 *     matrix: MatrixSpec? }
 *   PoolSpec { candidates: [CandidateSpec] }
 *   CandidateSpec { name, icd: String; logPrior: Int; urgency: Int?; features: [FeatureSpec];
 *     applicability: Applicability?; supersedes: [String]? }
 *   FeatureSpec { key, value: String; logLR: Int; evidenceLabel: String; citation: String?;
 *     maskedBy: [String]? }
 *   Applicability { sex: String?; minAgeYears, maxAgeYears: Int?; pregnancy: String? }
 *   MatrixSpec { version, authority: String; systemIndex, specialtyIndex, ccToSystems,
 *     urgencyIndex: [String: [String]] }
 *   (BayesianDiagnosisEngine+Database.swift, +Routing.swift). Swift's JSONDecoder rejects the
 *   whole file on the first mismatch and the engine's `try?` turns that into "no database":
 *   the differential then silently uses its built-in fallback lists.
 * The top-level "presentations" list is decoded separately (PresentationFile, +Routing.swift):
 *   presentations: [{ id: String, keywords: [String], candidates: [String] }]?
 * Extra keys are ignored by JSONDecoder and are allowed here.
 *
 * contentProblems() checks the 2.0.0 rules that the Swift code relies on but the decoder cannot:
 * presentations and supersedes name real candidates, curated features carry a likelihood ratio
 * and a citation that agree with logLR, applicability values are ones the engine understands; and
 * the 2.1.0 ones (BayesianDiagnosisEngine+Context.swift): a "postOpDay" value is "a-b" days, and
 * "maskedBy" names known masking contexts on a negative feature only.
 */

export interface DecodeProblem {
  kind: string;
  count: number;
  example: string;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isInt = (v: unknown) => typeof v === 'number' && Number.isInteger(v);
const isStrArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);
const absent = (v: unknown) => v === undefined || v === null;

/** log units per natural-log unit: logLR = round(ln(LR) × 5) (BayesianDiagnosisEngine.logUnitsPerNat). */
export const LOG_UNITS_PER_NAT = 5;
export const CORE_POOL = 'coreConditions';

/** Feature keys the curated pool may use (cases in BayesianDiagnosisEngine+Scoring.swift). */
export const CORE_FEATURE_KEYS = new Set([
  'complaint', 'finding', 'findingAbsent', 'notFinding', 'associations', 'site', 'character',
  'onset', 'radiation', 'timing', 'age_over', 'age_under', 'sex_male', 'sex_female', 'inv',
  'postOpDay',
]);

/** BayesianDiagnosisEngine.MaskingContext raw values (a negative feature's "maskedBy"). */
export const MASKING_CONTEXTS = new Set(['elderly', 'immunosuppressed', 'diabetes', 'female']);

/**
 * Integer fields written with a decimal point or exponent ("logLR": 3.0). JSON.parse cannot tell
 * 3.0 from 3, so the raw text is checked; Swift's Int decoding of such literals is not something
 * the app should depend on.
 */
export function nonIntegerLiterals(rawText: string): string[] {
  const re = /"(logLR|logPrior|urgency|minAgeYears|maxAgeYears)"\s*:\s*(-?\d+(?:\.\d+)?[eE][-+]?\d+|-?\d+\.\d+)/g;
  const out: string[] = [];
  for (const m of rawText.matchAll(re)) out.push(`${m[1]}: ${m[2]}`);
  return out;
}

export function decodeProblems(db: unknown, rawText?: string): DecodeProblem[] {
  const problems = new Map<string, DecodeProblem>();
  const note = (kind: string, example: string) => {
    const p = problems.get(kind);
    if (p) p.count++; else problems.set(kind, { kind, count: 1, example });
  };
  if (!isObj(db)) {
    note('the file is not a JSON object', '(root)');
    return [...problems.values()];
  }
  if (!isStr(db.version)) note('top-level "version" missing or not a string', 'version');
  if (!isObj(db.pools)) note('top-level "pools" missing or not an object', 'pools');
  else {
    for (const [pool, spec] of Object.entries(db.pools)) {
      const cands = isObj(spec) ? spec.candidates : undefined;
      if (!Array.isArray(cands)) { note('pool without a "candidates" array', pool); continue; }
      cands.forEach((c: unknown, ci: number) => {
        const at = `pools.${pool}.candidates[${ci}]`;
        if (!isObj(c)) { note('candidate is not an object', at); return; }
        if (!isStr(c.name)) note('candidate "name" missing or not a string', at);
        if (!isStr(c.icd)) note('candidate "icd" missing or not a string', at);
        if (!isInt(c.logPrior)) note('candidate "logPrior" missing or not an integer', `${at}.logPrior`);
        if (!absent(c.urgency) && !isInt(c.urgency)) note('candidate "urgency" not an integer', `${at}.urgency`);
        if (!absent(c.supersedes) && !isStrArray(c.supersedes)) note('candidate "supersedes" not an array of strings', `${at}.supersedes`);
        if (!absent(c.applicability)) {
          const a = c.applicability;
          if (!isObj(a)) note('candidate "applicability" not an object', `${at}.applicability`);
          else {
            if (!absent(a.sex) && !isStr(a.sex)) note('applicability "sex" not a string', `${at}.applicability.sex`);
            if (!absent(a.pregnancy) && !isStr(a.pregnancy)) note('applicability "pregnancy" not a string', `${at}.applicability.pregnancy`);
            if (!absent(a.minAgeYears) && !isInt(a.minAgeYears)) note('applicability "minAgeYears" not an integer', `${at}.applicability`);
            if (!absent(a.maxAgeYears) && !isInt(a.maxAgeYears)) note('applicability "maxAgeYears" not an integer', `${at}.applicability`);
          }
        }
        if (!Array.isArray(c.features)) { note('candidate "features" missing or not an array', at); return; }
        c.features.forEach((f: unknown, fi: number) => {
          const fat = `${at}.features[${fi}]`;
          if (!isObj(f)) { note('feature is not an object', fat); return; }
          if (!isStr(f.key)) note('feature "key" missing or not a string', fat);
          if (!isStr(f.value)) note('feature "value" missing or not a string', `${fat}.value`);
          if (!isInt(f.logLR)) note('feature "logLR" missing or not an integer', `${fat}.logLR`);
          if (!isStr(f.evidenceLabel)) note('feature "evidenceLabel" missing or not a string', fat);
          if (!absent(f.citation) && !isStr(f.citation)) note('feature "citation" not a string', `${fat}.citation`);
          if (!absent(f.maskedBy) && !isStrArray(f.maskedBy)) note('feature "maskedBy" not an array of strings', `${fat}.maskedBy`);
        });
      });
    }
  }
  if (!absent(db.matrix)) {
    const mx = db.matrix;
    if (!isObj(mx)) note('"matrix" is not an object', 'matrix');
    else {
      if (!isStr(mx.version) || !isStr(mx.authority)) note('matrix "version"/"authority" missing or not a string', 'matrix');
      for (const k of ['systemIndex', 'specialtyIndex', 'ccToSystems', 'urgencyIndex']) {
        const v = mx[k];
        if (!isObj(v) || !Object.values(v).every(isStrArray)) note(`matrix "${k}" is not { string: [string] }`, `matrix.${k}`);
      }
    }
  }
  if (!absent(db.presentations)) {
    const ps = db.presentations;
    if (!Array.isArray(ps)) note('"presentations" is not an array', 'presentations');
    else ps.forEach((p: unknown, i: number) => {
      if (!isObj(p) || !isStr(p.id) || !isStrArray(p.keywords) || !isStrArray(p.candidates)) {
        note('presentation is not { id: String, keywords: [String], candidates: [String] }', `presentations[${i}]`);
      }
    });
  }
  if (rawText !== undefined) {
    for (const lit of nonIntegerLiterals(rawText)) note('integer field written as a decimal', lit);
  }
  return [...problems.values()];
}

/** 2.0.0 content rules (only meaningful once decodeProblems() is empty). */
export function contentProblems(db: Obj): string[] {
  const out: string[] = [];
  const pools = db.pools as Record<string, { candidates: Obj[] }>;
  const legacyNames = new Set<string>();
  for (const [name, pool] of Object.entries(pools)) {
    if (name !== CORE_POOL) for (const c of pool.candidates) legacyNames.add(c.name as string);
  }
  const core = pools[CORE_POOL];
  if (!core) return [`pool "${CORE_POOL}" is missing`];
  const coreNames = new Set<string>();
  for (const c of core.candidates) {
    const name = c.name as string;
    if (coreNames.has(name)) out.push(`${CORE_POOL}: duplicate candidate "${name}"`);
    coreNames.add(name);
    if (!isStr(c.source) || !/\b(19|20)\d\d\b/.test(c.source)) out.push(`${CORE_POOL}/${name}: "source" must name a guideline or study with its year`);
    if (![0, -5, -10].includes(c.logPrior as number)) out.push(`${CORE_POOL}/${name}: logPrior ${c.logPrior} is not a prevalence tier (0, -5, -10)`);
    for (const s of (c.supersedes as string[] | undefined) ?? []) {
      if (!legacyNames.has(s)) out.push(`${CORE_POOL}/${name}: supersedes "${s}", which is not a candidate in any other pool`);
    }
    const a = c.applicability as Obj | undefined;
    if (a) {
      if (!absent(a.sex) && !['female', 'male'].includes(a.sex as string)) out.push(`${CORE_POOL}/${name}: applicability.sex "${a.sex}"`);
      if (!absent(a.pregnancy) && !['required', 'possible', 'excluded'].includes(a.pregnancy as string)) out.push(`${CORE_POOL}/${name}: applicability.pregnancy "${a.pregnancy}"`);
    }
    for (const f of c.features as Obj[]) {
      const where = `${CORE_POOL}/${name}/${f.key}`;
      if (!CORE_FEATURE_KEYS.has(f.key as string)) out.push(`${where}: key not handled by the curated scoring cases`);
      if (!isStr(f.citation) || f.citation.trim() === '') out.push(`${where}: no citation`);
      const lr = f.likelihoodRatio;
      if (typeof lr !== 'number' || !(lr > 0)) out.push(`${where}: no likelihoodRatio`);
      else if (Math.round(Math.log(lr) * LOG_UNITS_PER_NAT) !== f.logLR) {
        out.push(`${where}: logLR ${f.logLR} does not equal round(ln(${lr}) × ${LOG_UNITS_PER_NAT})`);
      }
      if (isStr(f.value) && /[|&]\s*$|^\s*[|&]|\|\|/.test(f.value)) out.push(`${where}: empty alternative in "${f.value}"`);
      if (f.key === 'postOpDay' && !(isStr(f.value) && /^\d+-\d+$/.test(f.value))) {
        out.push(`${where}: postOpDay value "${f.value}" is not "a-b" (days after the operation)`);
      }
      if (!absent(f.maskedBy)) {
        const masks = f.maskedBy as string[];
        for (const m of masks) if (!MASKING_CONTEXTS.has(m)) out.push(`${where}: maskedBy "${m}" is not a masking context`);
        if (!(typeof f.logLR === 'number' && f.logLR < 0)) out.push(`${where}: maskedBy on a feature that is not negative (only negative evidence is masked)`);
      }
    }
  }
  const presentations = (db.presentations as Obj[] | undefined) ?? [];
  if (presentations.length === 0) out.push('no "presentations": every complaint would fall back to the legacy routes');
  const ids = new Set<string>();
  for (const p of presentations) {
    if (ids.has(p.id as string)) out.push(`presentation "${p.id}" appears twice`);
    ids.add(p.id as string);
    for (const n of p.candidates as string[]) {
      if (!coreNames.has(n)) out.push(`presentation "${p.id}": "${n}" is not a ${CORE_POOL} candidate`);
    }
    if ((p.keywords as string[]).some(k => k.trim() === '' || k !== k.toLowerCase())) {
      out.push(`presentation "${p.id}": keywords must be non-empty and lower case`);
    }
  }
  return out;
}
