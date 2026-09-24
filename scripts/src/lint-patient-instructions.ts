/**
 * Hazard H-10 check for patient-facing preparation text outside the api-server.
 *
 * The api-server prep templates are covered by vitest
 * (artifacts/api-server/src/test/outbound-safety.test.ts). The front-desk
 * Next.js app has no test runner, so its instruction set is checked here:
 *
 *   - artifacts/front-desk/lib/instructions.ts (emailed automatically on booking)
 *   - front-desk pages that show prep text to patients
 *   - the dashboard's staff prep reference text (read to patients by phone)
 *
 * Rules (Dr Kabiye's decisions, CLAUDE.md Tone rule):
 *   1. No sentence pairs insulin, a diabetes medicine or a blood thinner with
 *      take / hold / stop / adjust / skip (or close synonyms). "If you take
 *      insulin ... please call the clinic" and "Are you taking blood thinners?"
 *      are allowed: they ask, they don't instruct.
 *   2. No "nil by mouth from midnight" / "fast from midnight" anywhere.
 *   3. Colonoscopy uses the approved clear-fluid wording; minor procedures say
 *      no fasting is needed; the diabetic foot clinic carries no fasting or
 *      sedation text.
 *   4. Every booking type in front-desk APPOINTMENT_TYPES has an explicit
 *      entry in APPOINTMENT_INSTRUCTIONS, every mapped instruction set exists,
 *      and consultation-style visits (thyroid clinic, pre-op assessment, …)
 *      resolve to text with no fasting or sedation.
 *   5. Dr Kabiye's preparation decisions, in the booking email and the
 *      dashboard staff text: ERCP work-up is the ERCP procedure at Tapion under
 *      general anaesthesia (6 h / 2 h fast, escort for 24 h, call-the-clinic
 *      lines, no sedation wording); flexible sigmoidoscopy allows a light
 *      breakfast (no 6 h fast); the pre-op ASSESSMENT visit has no fasting;
 *      fasting bloods (lab_fasting) carry the 8–10 h wording and the other lab
 *      types stay neutral.
 *
 * Run: pnpm --filter @workspace/scripts run lint:patient-instructions
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APPOINTMENT_INSTRUCTIONS,
  PROCEDURE_INSTRUCTIONS,
  getInstructionsForAppointment,
  type ProcedureInstructions,
} from '../../artifacts/front-desk/lib/instructions';
import { APPOINTMENT_TYPES } from '../../artifacts/front-desk/lib/scheduling';

// scripts/src/lint-patient-instructions.ts -> scripts/src -> scripts -> repo root
const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');

const SOURCE_FILES = [
  'artifacts/front-desk/app/services/endoscopy/page.tsx',
  'artifacts/front-desk/app/services/ercp/page.tsx',
  'artifacts/front-desk/app/services/diabetic-foot/page.tsx',
  'artifacts/front-desk/app/services/breast-clinic/page.tsx',
  'artifacts/front-desk/app/pathway/page.tsx',
  'artifacts/front-desk/app/book/BookingForm.tsx',
  'artifacts/dashboard/src/pages/tabs/BookingInboxTab.tsx',
];

const MEDICINE =
  /\b(insulin|diabet\w*\s+(medic\w*|tablets?|pills?)|diabetes medicines?|blood[- ]?thinn\w*|anticoagula\w*|antiplatelet\w*|warfarin|coumadin|apixaban|eliquis|rivaroxaban|xarelto|dabigatran|clopidogrel|plavix|aspirin|metformin|gliclazide)\b/i;
const INSTRUCTION =
  /\b(take|takes|taken|taking|hold|holding|held|stop|stops|stopped|stopping|adjust\w*|skip\w*|omit\w*|withh[eo]ld\w*|pause\w*|continue\w*|discontinue\w*)\b/i;
// Asking whether the patient takes a medicine is not an instruction.
const ALLOWED_PHRASES = [
  /\b(if|whether) you (take|are taking)\b/gi,
  /\bare you taking\b/gi,
  /\bdo you (regularly )?take\b/gi,
];
const MIDNIGHT_FAST = /\b(nil by mouth|nothing by mouth|nothing to eat or drink|fast(ing)?|no food or drink)\b[^.\n]{0,40}\bmidnight\b|\b(from|after) midnight\b/i;

function sentences(text: string): string[] {
  return text.split(/\n|(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
}

function stripSource(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')  // JSX comments
    .replace(/\/\*[\s\S]*?\*\//g, ' ')      // block comments
    .replace(/^\s*\/\/.*$/gm, ' ')          // line comments
    .replace(/<[^>\n]+>/g, ' ');            // JSX tags
}

export function medicationInstructionViolations(text: string): string[] {
  const out: string[] = [];
  for (const s of sentences(text)) {
    if (!MEDICINE.test(s)) continue;
    let scrubbed = s;
    for (const re of ALLOWED_PHRASES) scrubbed = scrubbed.replace(re, ' ');
    if (INSTRUCTION.test(scrubbed)) out.push(s);
  }
  return out;
}

const failures: string[] = [];

// ── Self-test: the rules must flag the unsafe wording this check replaced ─────
const MUST_FLAG = [
  'Diabetic patients: adjust your insulin or oral medications as directed.',
  'On the procedure day, hold your morning diabetes medications unless told otherwise.',
  'Diabetic medications: hold morning insulin/tablets on the day of surgery unless instructed otherwise.',
  'Blood thinners: stop as instructed by Dr Kabiye.',
  'Stop blood-thinning medications as directed by Dr Kabiye.',
  'Diabetic medication should NOT be taken on the day of the procedure.',
];
for (const bad of MUST_FLAG) {
  if (medicationInstructionViolations(bad).length === 0) failures.push(`self-test: rule missed unsafe text: "${bad}"`);
}
if (!MIDNIGHT_FAST.test('Nil by mouth from midnight.')) failures.push('self-test: midnight rule missed "Nil by mouth from midnight."');

// ── Front-desk instruction set (emailed automatically) ────────────────────────
for (const [key, inst] of Object.entries(PROCEDURE_INSTRUCTIONS)) {
  const all = [
    ...inst.beforeVisit, ...inst.onTheDay, ...(inst.afterCare ?? []),
    ...inst.whatToBring, ...inst.urgentSigns, ...(inst.notes ? [inst.notes] : []),
  ].join('\n');
  for (const s of medicationInstructionViolations(all)) failures.push(`instructions.ts ${key}: medication instruction: "${s}"`);
  for (const s of sentences(all)) if (MIDNIGHT_FAST.test(s)) failures.push(`instructions.ts ${key}: fasting from midnight: "${s}"`);
}

const INSTRUCTIONS_BY_KEY: Readonly<Record<string, ProcedureInstructions | undefined>> = PROCEDURE_INSTRUCTIONS;
const MAPPING_BY_TYPE: Readonly<Record<string, string | null | undefined>> = APPOINTMENT_INSTRUCTIONS;
const has = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key);

const joined = (key: string) => {
  const inst = INSTRUCTIONS_BY_KEY[key];
  if (!inst) { failures.push(`instructions.ts: missing "${key}" entry`); return ''; }
  return [...inst.beforeVisit, ...inst.onTheDay].join('\n');
};
if (!joined('colonoscopy').includes('finish your bowel prep as directed. Clear fluids only, then nothing to drink for 2 hours before your appointment time.')) {
  failures.push('instructions.ts colonoscopy: missing the approved clear-fluid wording');
}
if (!joined('minor_procedure').includes('No fasting is needed. Please eat a light meal before your appointment.')) {
  failures.push('instructions.ts minor_procedure: missing "No fasting is needed. Please eat a light meal before your appointment."');
}
if (/\b(fast\w*|nil by mouth|nothing to eat|sedation)\b/i.test(joined('diabetic_foot'))) {
  failures.push('instructions.ts diabetic_foot: must carry no fasting or sedation text');
}

// ── Booking type → instruction set mapping ────────────────────────────────────
// Instructions must never be looked up by the raw booking type (that sent
// thyroid SURGERY fasting text to Thyroid CLINIC patients, and New Consultation
// text to OGD / flexi-sig / pre-op patients). Every APPOINTMENT_TYPES key needs
// an explicit entry in APPOINTMENT_INSTRUCTIONS (null = neutral set), and every
// mapped instruction key must exist.
for (const type of Object.keys(APPOINTMENT_TYPES)) {
  if (!has(APPOINTMENT_INSTRUCTIONS, type)) {
    failures.push(`APPOINTMENT_INSTRUCTIONS: booking type "${type}" has no explicit mapping (use null for the neutral set)`);
  }
}
for (const [type, key] of Object.entries(MAPPING_BY_TYPE)) {
  if (!has(APPOINTMENT_TYPES, type)) {
    failures.push(`APPOINTMENT_INSTRUCTIONS: "${type}" is not a booking type in APPOINTMENT_TYPES`);
  }
  if (key !== null && (key === undefined || !has(PROCEDURE_INSTRUCTIONS, key))) {
    failures.push(`APPOINTMENT_INSTRUCTIONS: "${type}" maps to instruction set "${String(key)}", which does not exist`);
  }
}

// Clinically pinned mappings (Dr Kabiye's review, instruction-mapping fix).
const PINNED: Record<string, string | null> = {
  ogd:       'gastroscopy',
  flexi_sig: 'flexi_sig',
  pre_op:    'pre_op_assessment',
  thyroid:   'thyroid_clinic',
};
for (const [type, key] of Object.entries(PINNED)) {
  if (MAPPING_BY_TYPE[type] !== key) {
    failures.push(`APPOINTMENT_INSTRUCTIONS: "${type}" must map to "${key}", found "${String(MAPPING_BY_TYPE[type])}"`);
  }
}

// Consultation-style visits that must never carry fasting or sedation text.
const NO_FAST = /\b(nothing to eat|nil by mouth|nothing by mouth|sedation)\b/i;
for (const type of ['thyroid', 'pre_op', 'new_consult', 'follow_up', 'breast', 'telephone']) {
  const inst = getInstructionsForAppointment(type);
  const text = [...inst.beforeVisit, ...inst.onTheDay].join('\n');
  if (NO_FAST.test(text)) failures.push(`booking type "${type}" (${inst.displayName}): must carry no fasting or sedation text`);
}
if (!joined('pre_op_assessment').includes('No fasting is needed for this visit unless the clinic has told you otherwise.')) {
  failures.push('instructions.ts pre_op_assessment: missing "No fasting is needed for this visit unless the clinic has told you otherwise."');
}
if (NO_FAST.test(joined('general_appointment'))) {
  failures.push('instructions.ts general_appointment: the neutral set must carry no fasting or sedation text');
}
// ── Dr Kabiye's preparation decisions ─────────────────────────────────────────
// (The api-server sms.ts templates are held to the same decisions by
// artifacts/api-server/src/test/outbound-safety.test.ts.)
const FASTING_TEXT = 'Nothing to eat for 6 hours and nothing to drink for 2 hours before your appointment time';
const SIX_HOUR_FAST = /\bnothing to eat for 6 hours\b/i;
const ANY_FAST = /\b(nothing to eat|nothing to drink|nil by mouth|nothing by mouth)\b/i;
const everything = (key: string) => {
  const inst = INSTRUCTIONS_BY_KEY[key];
  if (!inst) { failures.push(`instructions.ts: missing "${key}" entry`); return ''; }
  return [
    ...inst.beforeVisit, ...inst.onTheDay, ...(inst.afterCare ?? []),
    ...inst.whatToBring, ...inst.urgentSigns, ...(inst.notes ? [inst.notes] : []),
  ].join('\n');
};

// 1. ERCP work-up is the ERCP procedure itself, at Tapion, under general
//    anaesthesia: GA fasting, escort for 24 h, call-the-clinic lines, no
//    sedation wording (also for the staff-scheduled `ercp` set).
for (const key of ['ercp_workup', 'ercp']) {
  const inst = INSTRUCTIONS_BY_KEY[key];
  const text = everything(key);
  if (!inst?.location.includes('Tapion')) failures.push(`instructions.ts ${key}: location must be Tapion Hospital`);
  if (!/general anaesthe/i.test(text)) failures.push(`instructions.ts ${key}: must say the ERCP is done under general anaesthesia`);
  if (!joined(key).includes(FASTING_TEXT)) failures.push(`instructions.ts ${key}: missing the standard 6 h food / 2 h clear-fluid fasting line`);
  if (!/take you home, and stay with you for 24 hours/.test(text)) failures.push(`instructions.ts ${key}: missing "a responsible adult must bring you … take you home, and stay with you for 24 hours"`);
  if (!text.includes('If you take blood thinners, please call the clinic before your appointment for instructions.')) failures.push(`instructions.ts ${key}: missing the blood-thinners call-the-clinic line`);
  if (/\bsedat\w*/i.test(text)) failures.push(`instructions.ts ${key}: ERCP is done under general anaesthesia — no sedation wording`);
}
if (MAPPING_BY_TYPE.ercp_workup !== 'ercp_workup') failures.push('APPOINTMENT_INSTRUCTIONS: "ercp_workup" must map to "ercp_workup"');
if (APPOINTMENT_TYPES.ercp_workup.location !== 'tapion') failures.push('scheduling.ts APPOINTMENT_TYPES.ercp_workup: location must be tapion');

// 2. Flexible sigmoidoscopy: light breakfast on the morning — no 6-hour fast.
{
  const text = everything('flexi_sig');
  if (!text.includes('Light breakfast only on the morning of the procedure')) failures.push('instructions.ts flexi_sig: missing the light-breakfast line');
  if (SIX_HOUR_FAST.test(text)) failures.push('instructions.ts flexi_sig: must carry no 6-hour fasting line (light breakfast is allowed)');
}

// 3. Pre-operative ASSESSMENT visit: no fasting (booking type and instruction set).
for (const text of [everything('pre_op_assessment'), (() => {
  const inst = getInstructionsForAppointment('pre_op');
  return [...inst.beforeVisit, ...inst.onTheDay, ...(inst.afterCare ?? []), ...inst.whatToBring, ...inst.urgentSigns].join('\n');
})()]) {
  if (ANY_FAST.test(text) || /\bsedation\b/i.test(text)) {
    failures.push('pre_op / pre_op_assessment: the assessment visit must carry no fasting or sedation text');
    break;
  }
}

// 4. Fasting blood test: its own 8–10 h wording; other lab types stay neutral.
if (MAPPING_BY_TYPE.lab_fasting !== 'lab_fasting') failures.push('APPOINTMENT_INSTRUCTIONS: "lab_fasting" must map to "lab_fasting"');
if (!joined('lab_fasting').includes('Nothing to eat for 8–10 hours before your blood test. You may drink plain water. Please call the clinic if you take insulin or diabetes medicines, for instructions before fasting.')) {
  failures.push('instructions.ts lab_fasting: missing the approved 8–10 h fasting-bloods wording');
}
if (/\b(sedation|bowel prep\w*|6 hours)\b/i.test(everything('lab_fasting'))) failures.push('instructions.ts lab_fasting: must carry no procedure / colonoscopy preparation text');
for (const type of ['lab_collection', 'lab_urine', 'lab_histology']) {
  if (MAPPING_BY_TYPE[type] !== null) failures.push(`APPOINTMENT_INSTRUCTIONS: "${type}" must stay on the neutral set (null)`);
}

// 5. Dashboard staff prep reference text (read to patients by phone) must say
//    the same as the patient text.
{
  const src = readFileSync(join(REPO_ROOT, 'artifacts/dashboard/src/pages/tabs/BookingInboxTab.tsx'), 'utf8');
  const block = src.match(/const PREP_INSTRUCTIONS: Record<string, string> = \{([\s\S]*?)\n\};/)?.[1];
  const staff: Record<string, string> = {};
  for (const m of (block ?? '').matchAll(/^\s*(\w+):\s*'([^']*)',?\s*$/gm)) staff[m[1]] = m[2];
  if (!block) failures.push('BookingInboxTab.tsx: could not find the PREP_INSTRUCTIONS staff text block');
  const s = (k: string) => staff[k] ?? (failures.push(`BookingInboxTab.tsx PREP_INSTRUCTIONS: missing "${k}"`), '');
  if (!/Tapion/.test(s('ercp_workup')) || !SIX_HOUR_FAST.test(s('ercp_workup')) || /sedat/i.test(s('ercp_workup'))) {
    failures.push('BookingInboxTab.tsx ercp_workup: must name Tapion, carry the 6 h fast, and have no sedation wording');
  }
  if (!/light breakfast/i.test(s('flexi_sig')) || /clear fluids only on (the )?morning/i.test(s('flexi_sig'))) {
    failures.push('BookingInboxTab.tsx flexi_sig: must say light breakfast on the morning (not clear fluids only)');
  }
  if (ANY_FAST.test(s('pre_op')) || !/no fasting/i.test(s('pre_op'))) {
    failures.push('BookingInboxTab.tsx pre_op: the assessment visit must say no fasting');
  }
  if (!/8–10 hours/.test(s('lab_fasting'))) failures.push('BookingInboxTab.tsx lab_fasting: must carry the 8–10 h fasting-bloods wording');
}

// Unknown types get the neutral set — never another type's preparation.
if (getInstructionsForAppointment('__lint_unknown_type__') !== PROCEDURE_INSTRUCTIONS.general_appointment) {
  failures.push('getInstructionsForAppointment: unknown booking types must fall back to general_appointment');
}

// ── Pages and staff reference text ────────────────────────────────────────────
for (const rel of SOURCE_FILES) {
  const text = stripSource(readFileSync(join(REPO_ROOT, rel), 'utf8'));
  for (const s of medicationInstructionViolations(text)) failures.push(`${rel}: medication instruction: "${s}"`);
  for (const s of sentences(text)) if (MIDNIGHT_FAST.test(s)) failures.push(`${rel}: fasting from midnight: "${s}"`);
}

if (failures.length) {
  console.error(`✗ lint:patient-instructions — ${failures.length} problem(s) (hazard H-10):`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error('\nPatient-facing text must not tell a patient to take, hold, stop, skip or adjust insulin, diabetes medicines or blood thinners.');
  console.error('Use the approved wording: "MEDICATIONS: If you take insulin, blood thinners or diabetes medicines, please call the clinic before your procedure for instructions."');
  process.exit(1);
}
console.log(`✓ lint:patient-instructions — ${Object.keys(PROCEDURE_INSTRUCTIONS).length} instruction sets, ${Object.keys(APPOINTMENT_TYPES).length} booking-type mappings and ${SOURCE_FILES.length} source files clean.`);
