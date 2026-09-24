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
 *
 * Run: pnpm --filter @workspace/scripts run lint:patient-instructions
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROCEDURE_INSTRUCTIONS } from '../../artifacts/front-desk/lib/instructions';

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

const joined = (key: string) => {
  const inst = PROCEDURE_INSTRUCTIONS[key];
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
console.log(`✓ lint:patient-instructions — ${Object.keys(PROCEDURE_INSTRUCTIONS).length} instruction sets and ${SOURCE_FILES.length} source files clean.`);
