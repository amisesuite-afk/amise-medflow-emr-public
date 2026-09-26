/**
 * Outcomes loop — the PANE side: ICD-10 → PANE disease id (where it maps to exactly one node),
 * a diagnosis search for the final-diagnosis form, and the read-only model view the shrinkage
 * proposals compare against. Pure (no '@/' imports); the calibration script uses it too.
 * It reads the model; it never changes it.
 */
import {
  DISEASES, PANE_MODEL_VERSION, PRIOR_TIER, baseRate, featureLikelihood,
} from '@workspace/pane-engine';
import { CONDITION_CODES, searchConditions } from '@workspace/triage-engine';
import { normaliseIcd10 } from '@workspace/triage-engine/outcomes';
import type { ShrinkageModel } from '@workspace/triage-engine/outcomes';

const BY_ID = new Map(DISEASES.map(d => [d.id, d]));
const BY_ICD = new Map<string, string[]>();
for (const d of DISEASES) {
  const code = normaliseIcd10(d.icd10);
  if (!code) continue;
  BY_ICD.set(code, [...(BY_ICD.get(code) ?? []), d.id]);
}

/** The PANE node for an ICD-10 code, only when exactly one node carries that code. */
export function paneIdForIcd(icd10: string): string | null {
  const code = normaliseIcd10(icd10);
  const ids = code ? BY_ICD.get(code) : undefined;
  return ids && ids.length === 1 ? ids[0] : null;
}

export function paneLabel(id: string | null | undefined): string | null {
  return id ? BY_ID.get(id)?.label ?? null : null;
}

export interface DiagnosisOption {
  icd10: string;
  diseaseId: string | null;
  label: string;
  source: 'pane' | 'catalogue' | 'code';
}

/** Search for the final-diagnosis form: PANE nodes first, then the ICD-10 catalogue, then a bare code. */
export function searchFinalDiagnoses(query: string, limit = 12): DiagnosisOption[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const out: DiagnosisOption[] = [];
  const seen = new Set<string>();
  const push = (o: DiagnosisOption) => {
    const key = `${o.icd10}|${o.diseaseId ?? ''}`;
    if (seen.has(key) || out.length >= limit) return;
    seen.add(key);
    out.push(o);
  };
  for (const d of DISEASES) {
    const icd = normaliseIcd10(d.icd10);
    if (!icd || d.id === '_other_') continue;
    if (d.label.toLowerCase().includes(q) || icd.toLowerCase().startsWith(q) || d.id.includes(q.replace(/\s+/g, '_'))) {
      push({ icd10: icd, diseaseId: d.id, label: d.label, source: 'pane' });
    }
  }
  for (const c of searchConditions(query).slice(0, limit)) {
    const icd = normaliseIcd10(c.icd10);
    if (icd) push({ icd10: icd, diseaseId: paneIdForIcd(icd), label: c.shortName || c.description, source: 'catalogue' });
  }
  const bare = normaliseIcd10(query);
  if (bare) {
    const known = CONDITION_CODES.find(c => normaliseIcd10(c.icd10) === bare);
    push({ icd10: bare, diseaseId: paneIdForIcd(bare), label: known?.shortName ?? 'ICD-10 code', source: 'code' });
  }
  return out;
}

/** The current PANE model as the shrinkage proposals see it (read-only). */
export function paneShrinkageModel(): ShrinkageModel {
  const priors: Record<string, number> = {};
  for (const d of DISEASES) if (d.id !== '_other_' && d.prior > 0) priors[d.id] = d.prior;
  return {
    engine: 'pane',
    modelVersion: PANE_MODEL_VERSION,
    priors,
    tiers: { ...PRIOR_TIER },
    likelihood: (diseaseId, featureId) => {
      const node = BY_ID.get(diseaseId);
      return node ? featureLikelihood(node, featureId) : null;
    },
    baseRate: featureId => baseRate(featureId),
    diseaseForIcd: paneIdForIcd,
  };
}
