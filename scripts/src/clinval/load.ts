/**
 * Clinical validation — vignette loading and structural validation.
 *
 * The vignettes live in the iOS test bundle folder so both harnesses read the same files:
 *   ios/AmiseMedFlowTests/ClinicalValidation/Vignettes/<id>.json
 * The JSON Schema (docs/clinical-validation/vignette.schema.json) is the reference; this module
 * checks what the graders rely on (no schema library is installed in this workspace).
 */

import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listExpectations } from './grade';
import type { Vignette } from './types';

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const VIGNETTE_DIR = join(REPO_ROOT, 'ios', 'AmiseMedFlowTests', 'ClinicalValidation', 'Vignettes');

const CATEGORIES = new Set(['hpb', 'gi-emergency', 'colorectal', 'upper-gi', 'hernia', 'breast-endocrine',
  'trauma-burns', 'soft-tissue', 'vascular', 'anorectal', 'urology', 'general-medicine', 'other']);
const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SCORE_RE = /^([a-z0-9]+(-[a-z0-9]+)*|(ios|web):[A-Za-z0-9]+)$/;
const LEVELS = new Set(['routine', 'priority', 'urgent', 'emergency']);

export interface LoadedVignette { file: string; vignette: Vignette }

export function validateVignette(v: Vignette, file: string, allIds: Set<string>): string[] {
  const errors: string[] = [];
  const err = (m: string) => errors.push(`${basename(file)}: ${m}`);
  if (v.schemaVersion !== 1) err('schemaVersion must be 1');
  if (!ID_RE.test(v.id ?? '')) err(`id '${v.id}' is not kebab-case`);
  if (basename(file, '.json') !== v.id) err(`id '${v.id}' does not match the file name`);
  if (!v.condition || v.condition.length < 3) err('condition missing');
  if (!CATEGORIES.has(v.category)) err(`unknown category '${v.category}'`);
  if (v.permutationOf !== null && !allIds.has(v.permutationOf)) err(`permutationOf '${v.permutationOf}' is not a known vignette id`);
  if (v.permutationOf === v.id) err('a vignette cannot be a permutation of itself');
  if (!v.inputs?.patient || typeof v.inputs.patient.ageYears !== 'number') err('inputs.patient.ageYears missing');
  if (!['male', 'female', 'unspecified'].includes(v.inputs?.patient?.sex)) err('inputs.patient.sex invalid');
  if (!v.inputs?.chiefComplaint) err('inputs.chiefComplaint missing');
  if (typeof v.inputs?.hpi !== 'string') err('inputs.hpi missing');
  if (!v.inputs?.encounter?.setting) err('inputs.encounter.setting missing');
  if (!Array.isArray(v.guideline) || v.guideline.length === 0) err('guideline[] must cite at least one source');
  if (!v.rationale || v.rationale.length < 10) err('rationale missing');
  const guidelineIds = new Set((v.guideline ?? []).map(g => g.id));
  for (const g of v.guideline ?? []) {
    if (!g.id || !g.name || !g.year || !g.section) err(`guideline '${g.id}' needs id, name, year and section`);
  }

  const seen = new Set<string>();
  for (const [kind, exp] of listExpectations(v)) {
    const where = `${kind} '${exp.id}'`;
    if (!ID_RE.test(exp.id ?? '')) err(`${where}: id is not kebab-case`);
    if (seen.has(exp.id)) err(`${where}: duplicate expectation id`);
    seen.add(exp.id);
    if (exp.severity !== 'critical' && exp.severity !== 'quality') err(`${where}: severity must be critical or quality`);
    for (const ref of exp.guidelineRefs ?? []) {
      if (!guidelineIds.has(ref)) err(`${where}: guidelineRef '${ref}' is not in guideline[]`);
    }
    for (const p of exp.platforms ?? []) if (p !== 'ios' && p !== 'web') err(`${where}: unknown platform '${p}'`);
    const e = exp as unknown as Record<string, unknown>;
    for (const field of ['match', 'unless']) {
      const alts = e[field];
      if (alts === undefined) continue;
      if (!Array.isArray(alts) || alts.length === 0) { err(`${where}: ${field} must be a non-empty array`); continue; }
      for (const alt of alts as string[]) {
        if (typeof alt !== 'string' || !alt) err(`${where}: empty ${field} alternative`);
        else if (alt.startsWith('re:')) {
          try { new RegExp(alt.slice(3), 'i'); } catch (x) { err(`${where}: bad regex ${alt}: ${String(x)}`); }
        }
      }
    }
    if (['mustRankTopK', 'mustNotMiss', 'mustAlarm', 'mustNotAlarm', 'redFlags', 'investigationInclude',
      'investigationExclude', 'managementInclude', 'managementExclude', 'reasoningInclude', 'reasoningExclude',
      'missingTop', 'missingInclude', 'missingExclude'].includes(kind) && !Array.isArray(e.match)) {
      err(`${where}: match is required`);
    }
    if (kind === 'mustRankTopK' && typeof e.k !== 'number') err(`${where}: k is required`);
    if ((kind === 'scoreRecommended' || kind === 'scoreValue') && !SCORE_RE.test(String(e.score))) err(`${where}: bad score key '${String(e.score)}'`);
    if (kind === 'scoreValue') {
      if (e.mode !== 'calculator' && e.mode !== 'autofill') err(`${where}: mode must be calculator or autofill`);
      if (e.equals === undefined && e.min === undefined && e.max === undefined) err(`${where}: needs equals, min or max`);
      if (e.mode === 'calculator' && !v.inputs.scoreForms?.[String(e.score)]) err(`${where}: calculator mode needs inputs.scoreForms['${String(e.score)}']`);
    }
    if (kind === 'emergencyLevel') {
      if (e.atLeast === undefined && e.atMost === undefined) err(`${where}: needs atLeast or atMost`);
      for (const f of ['atLeast', 'atMost']) if (e[f] !== undefined && !LEVELS.has(String(e[f]))) err(`${where}: bad ${f}`);
    }
    if ((kind === 'pathway' || kind === 'dxVariant') && typeof e.equals !== 'string') err(`${where}: equals is required`);
  }
  return errors;
}

export function loadVignettes(dir = VIGNETTE_DIR): { vignettes: LoadedVignette[]; errors: string[] } {
  const files = readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  const vignettes: LoadedVignette[] = [];
  const errors: string[] = [];
  for (const f of files) {
    const file = join(dir, f);
    try {
      vignettes.push({ file, vignette: JSON.parse(readFileSync(file, 'utf8')) as Vignette });
    } catch (x) {
      errors.push(`${f}: invalid JSON: ${String(x)}`);
    }
  }
  const ids = new Set(vignettes.map(l => l.vignette.id));
  if (ids.size !== vignettes.length) errors.push('duplicate vignette ids');
  for (const l of vignettes) errors.push(...validateVignette(l.vignette, l.file, ids));
  return { vignettes, errors };
}
