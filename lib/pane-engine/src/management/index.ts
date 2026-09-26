import { generalSurgeryProtocols } from './protocols/generalSurgery.js';
import { hepatobiliaryProtocols } from './protocols/hepatobiliary.js';
import { colorectalProtocols, herniaProtocols, breastProtocols } from './protocols/colorectalHerniaBreast.js';
import { endocrineProtocols } from './protocols/endocrine.js';
import { vascularProtocols } from './protocols/vascular.js';
import { gynaecologyProtocols } from './protocols/gynaecology.js';
import { traumaProtocols } from './protocols/trauma.js';
import { upperGIProtocols } from './protocols/upperGI.js';
import { skinSoftTissueProtocols } from './protocols/skinSoftTissue.js';
import { urologyProtocols } from './protocols/urology.js';
import { postOpWoundsProtocols } from './protocols/postOpWounds.js';
import { surgicalAdditionsProtocols } from './protocols/surgicalAdditions.js';
import { acuteMedicineProtocols } from './protocols/acuteMedicine.js';
import { obstetricPaediatricProtocols } from './protocols/obstetricPaediatric.js';

export type {
  ManagementProtocol, InvestigationItem, ManagementStep, ProtocolMedication, ProtocolKind, PatientCondition,
} from './types.js';
export {
  adaptProtocolForPatient, adaptPlanText, adaptInvestigationForPatient, allergyProfile, pregnancyFor, gestationFromText, procedureFor, hasOperativeSteps,
  ALLERGY_CLASSES, PLAN_SAFETY_VERSION, PAEDIATRIC_FLUID,
} from './planSafety.js';
export type {
  PlanPatientContext, AdaptedProtocol, AdaptOptions, WithheldItem, SafetyNote, SafetyKind, PregnancyStatus, ProcedureKind, AllergyClass,
} from './planSafety.js';

/**
 * Version of the management protocol content (lib/pane-engine/src/management/protocols/*.ts and
 * planSafety.ts). Registered in clinical-content/registry.json as "pane-engine-management-protocols";
 * bump together with the registry entry and add a changelog line there.
 */
export const MANAGEMENT_PROTOCOLS_VERSION = '1.1.0';

// Order matters only for ties between equally long ICD prefixes: the earlier protocol wins
// (e.g. K92.2 → lower GI bleeding before upper GI haemorrhage; C20 → rectal carcinoma).
const ALL_PROTOCOLS = [
  ...surgicalAdditionsProtocols,
  ...acuteMedicineProtocols,
  ...obstetricPaediatricProtocols,
  ...generalSurgeryProtocols,
  ...hepatobiliaryProtocols,
  ...colorectalProtocols,
  ...herniaProtocols,
  ...breastProtocols,
  ...endocrineProtocols,
  ...vascularProtocols,
  ...gynaecologyProtocols,
  ...traumaProtocols,
  ...upperGIProtocols,
  ...skinSoftTissueProtocols,
  ...urologyProtocols,
  ...postOpWoundsProtocols,
];

const _byDiseaseId = new Map(ALL_PROTOCOLS.map(p => [p.diseaseId, p]));

/**
 * PANE disease ids whose management is an existing protocol under another id (the differential
 * gained these nodes in 2026-09; see docs/clinical-validation/changes/fix-web-differential.md).
 *
 * Suggested investigations are now seeded from one diagnosis only — the confirmed one, else the
 * PANE leader — adapted to the patient, with no stat test from an unconfirmed diagnosis
 * (dashboard plan-builder.ts seedInvestigations; docs/clinical-validation/changes/
 * web-plan-filter-everywhere.md). With that:
 *   - `anaplastic_thyroid` → thyroid_carcinoma is aliased: it only seeds when it leads (a neck
 *     haematoma after thyroidectomy leads with postop_haematoma), and that protocol has no stat
 *     test and carries the anaplastic / airway lines.
 *   - `sah` is still NOT aliased: the PANE engine ranks it first (34%) in the low-risk vasovagal
 *     syncope vignette, so before a diagnosis is confirmed the Assessment reference panel and the
 *     Ambient preview would show the SAH emergency protocol ("call 911") for that patient. Seeding
 *     itself would be safe (the immediate CT head is a stat test, held back). Confirmed SAH
 *     (ICD I60) already resolves to subarachnoid_haemorrhage. Revisit once the syncope ranking is
 *     fixed in the differential.
 */
export const PROTOCOL_ALIASES: Readonly<Record<string, string>> = {
  acs: 'acute_coronary_syndrome',
  aki: 'acute_kidney_injury',
  anaplastic_thyroid: 'thyroid_carcinoma',
  asthma_exacerbation: 'acute_asthma',
  cardiac_syncope: 'syncope',
  cauda_equina: 'cauda_equina_syndrome',
  cdiff_colitis: 'clostridioides_difficile',
  diabetic_foot_infection: 'diabetic_foot',
  dka: 'diabetic_ketoacidosis',
  femoral_artery_aneurysm: 'aortic_aneurysm',
  food_bolus: 'food_bolus_obstruction',
  gastroenteritis: 'infective_colitis',
  hhs: 'hyperosmolar_hyperglycaemic_state',
  infected_obstructed_kidney: 'obstructed_infected_kidney',
  meningitis: 'bacterial_meningitis',
  mscc: 'metastatic_spinal_cord_compression',
  phaeochromocytoma: 'adrenal_incidentaloma',
  postop_collection: 'surgical_site_infection',
  postop_pneumonia: 'pneumonia',
  seizure: 'first_seizure',
  sigmoid_volvulus: 'bowel_obstruction',
  stroke: 'acute_stroke',
  superficial_thrombophlebitis: 'superficial_vein_thrombosis',
  tia: 'transient_ischaemic_attack',
  toxic_megacolon: 'ulcerative_colitis',
};

export function getProtocol(diseaseId: string) {
  return _byDiseaseId.get(diseaseId) ?? _byDiseaseId.get(PROTOCOL_ALIASES[diseaseId] ?? '') ?? null;
}

/** "K35.89 — Acute appendicitis" / "k35.89" / "K3589" → "K3589". */
export function normaliseIcd(code: string): string {
  return code.split(/\s[—–-]\s|\s/)[0].trim().toUpperCase().replace(/\./g, '');
}

function prefixMatchLength(p: { icd10Prefixes: string[] }, code: string): number {
  let best = 0;
  for (const raw of p.icd10Prefixes) {
    const prefix = normaliseIcd(raw);
    if (prefix && code.startsWith(prefix) && prefix.length > best) best = prefix.length;
  }
  return best;
}

/**
 * The protocol whose ICD-10 prefix is the longest match for the code (dots ignored): K83.01
 * (primary sclerosing cholangitis) no longer resolves to acute cholangitis (K83.0), and I71.3
 * resolves to the aortic aneurysm protocol. Ties go to the earlier protocol in ALL_PROTOCOLS.
 */
export function getProtocolByIcd(icdCode: string) {
  const code = normaliseIcd(icdCode);
  if (!code) return null;
  let best: (typeof ALL_PROTOCOLS)[number] | null = null;
  let bestLen = 0;
  for (const p of ALL_PROTOCOLS) {
    const len = prefixMatchLength(p, code);
    if (len > bestLen) { best = p; bestLen = len; }
  }
  return best;
}

/** Longest prefix of the protocol in the same 3-character ICD-10 category as the code (0 if none). */
function sameCategoryLength(p: { icd10Prefixes: string[] }, code: string): number {
  let best = 0;
  for (const raw of p.icd10Prefixes) {
    const prefix = normaliseIcd(raw);
    if (prefix.slice(0, 3) === code.slice(0, 3) && prefix.length > best) best = prefix.length;
  }
  return best;
}

/**
 * The protocol for a confirmed diagnosis (locked working diagnosis and/or recorded ICD-10 code).
 * The disease id wins unless the recorded ICD code maps to a different protocol that the disease's
 * own protocol does not cover, at least as specifically as the disease's own codes in that ICD
 * category — then the code is the more specific statement of what the clinician confirmed
 * (working diagnosis "upper GI bleed" + I85.11 → the variceal protocol; "diverticulitis" + K57.31
 * diverticular bleeding → lower GI bleeding; "liver abscess" + A06.4 → amoebic abscess). A generic
 * code in the same category does not override a specific disease: "post-operative ileus" (K56.0)
 * recorded with K56.7 stays the ileus protocol, not bowel obstruction (K56).
 */
export function resolveProtocol(diseaseId?: string | null, icdCode?: string | null) {
  const byId = diseaseId ? getProtocol(diseaseId) : null;
  const byIcd = icdCode ? getProtocolByIcd(icdCode) : null;
  if (!byId) return byIcd;
  if (!byIcd || byIcd === byId || !icdCode) return byId;
  const code = normaliseIcd(icdCode);
  if (prefixMatchLength(byId, code) > 0) return byId;
  return prefixMatchLength(byIcd, code) >= sameCategoryLength(byId, code) ? byIcd : byId;
}

export function getAllProtocols() {
  return ALL_PROTOCOLS;
}
