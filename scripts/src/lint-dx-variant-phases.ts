/**
 * Deterministic port of emr-review's Category 2 check (.claude/skills/emr-review/SKILL.md):
 * dx-variants.ts's allowedPhases must match the evidence-based reference table,
 * so the generated plan never surfaces a management step that's wrong for the
 * confirmed sub-diagnosis (e.g. offering immediate surgery through an
 * appendicular phlegmon).
 *
 * The reference table below is the SKILL.md table's source of truth, kept in
 * sync by hand — see SKILL.md for the methodology (each row is verified
 * against the real ManagementProtocol.management[] phase tags, not just
 * guideline text in the abstract). Variants not listed here are intentionally
 * out of scope (no citation to check against yet, e.g. breast/thyroid) and
 * are reported as unaudited, not failed.
 *
 * Also checks each DxVariantGroup's `diseaseIds` against pane-engine's real
 * disease registry. detectDxVariants() matches diseaseId.startsWith(id) as
 * its first, fastest signal, before falling back to icdPrefixes — an entry
 * that doesn't match any real diseaseId doesn't error, it just silently never
 * fires and falls through to the ICD check. This exact bug shipped
 * undetected: the Hernia group's diseaseIds were all reversed-word-order
 * typos ('hernia_inguinal' vs the real 'inguinal_hernia'), so the fast path
 * never matched anything and every hernia diagnosis fell through to ICD
 * matching alone, only working when the ICD code happened to already be set.
 *
 * Runs only against the shipped state of dx-variants.ts (not a PR diff) --
 * same as the migration-grant lint, it's a standing invariant check, not a
 * diff-only check.
 */

import { DX_VARIANT_GROUPS } from '../../artifacts/dashboard/src/lib/dx-variants';
import { DISEASES } from '../../lib/pane-engine/src/vademecum/index';

const REFERENCE_PHASES: Record<string, string[]> = {
  appendicitis_uncomplicated: ['immediate', 'surgical', 'followup'],
  appendicitis_phlegmon: ['immediate', 'conservative'],
  appendicitis_abscess: ['immediate', 'conservative'],
  appendicitis_localised_peritonitis: ['immediate', 'surgical', 'followup'],
  appendicitis_generalised_peritonitis: ['immediate', 'surgical'],

  cholecystitis_grade1: ['immediate', 'surgical', 'followup'],
  cholecystitis_grade2: ['immediate', 'surgical', 'followup'],
  cholecystitis_grade3: ['immediate', 'conservative', 'surgical', 'followup'],

  cholangitis_grade1: ['immediate', 'conservative', 'followup'],
  cholangitis_grade2: ['immediate', 'surgical', 'followup'],
  cholangitis_grade3: ['immediate', 'surgical'],

  hernia_reducible: ['surgical', 'followup'],
  hernia_incarcerated: ['immediate', 'conservative', 'surgical', 'followup'],
  hernia_strangulated: ['immediate', 'surgical'],

  sbo_adhesional: ['immediate', 'conservative', 'followup'],
  sbo_strangulation: ['immediate', 'surgical'],
  lbo_malignant: ['immediate', 'surgical', 'followup'],

  diverticulitis_uncomplicated: ['conservative', 'followup'],
  diverticulitis_abscess: ['immediate', 'conservative', 'followup'],
  diverticulitis_peritonitis: ['immediate', 'surgical'],

  pancreatitis_mild: ['immediate', 'conservative', 'followup'],
  pancreatitis_moderate: ['immediate', 'conservative', 'followup'],
  pancreatitis_severe: ['immediate', 'surgical', 'followup'],

  ugib_nonvariceal_stable: ['immediate', 'surgical', 'followup'],
  ugib_variceal: ['immediate', 'surgical', 'followup'],
};

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every(x => setB.has(x));
}

function checkPhases(): boolean {
  const allVariants = DX_VARIANT_GROUPS.flatMap(g => g.variants.map(v => ({ group: g, variant: v })));
  const covered = allVariants.filter(({ variant }) => variant.id in REFERENCE_PHASES);
  const unaudited = allVariants.filter(({ variant }) => !(variant.id in REFERENCE_PHASES));

  const mismatches = covered.filter(
    ({ variant }) => !sameSet(variant.allowedPhases, REFERENCE_PHASES[variant.id]),
  );

  console.log(
    `Checked ${covered.length} variant(s) against the evidence-based reference table ` +
    `(${unaudited.length} unaudited, no citation yet: ${unaudited.map(u => u.variant.id).join(', ') || 'none'}).`,
  );

  if (mismatches.length === 0) {
    console.log('✓ Every audited variant\'s allowedPhases matches the reference table.');
    return true;
  }

  console.error(`\n✗ ${mismatches.length} variant(s) have allowedPhases that don't match the reference table:\n`);
  for (const { group, variant } of mismatches) {
    console.error(`  - ${variant.id}  (${group.baseDiagnosis} — ${variant.label})`);
    console.error(`      code:      [${variant.allowedPhases.join(', ')}]`);
    console.error(`      reference: [${REFERENCE_PHASES[variant.id].join(', ')}]`);
  }
  console.error(
    '\nSee .claude/skills/emr-review/SKILL.md for the reference table and the methodology behind it. ' +
    'If the code is actually correct and the reference table is stale, update both ' +
    'SKILL.md and scripts/src/lint-dx-variant-phases.ts together — never just silence this check.',
  );
  return false;
}

function checkDiseaseIds(): boolean {
  const realIds = new Set(DISEASES.map(d => d.id));

  const failures: { group: string; entry: string }[] = [];
  for (const g of DX_VARIANT_GROUPS) {
    for (const entry of g.diseaseIds) {
      // Mirrors detectDxVariants()'s own match: diseaseId.startsWith(entry).
      // An entry only needs to be a valid prefix of at least one real id.
      const matches = [...realIds].some(id => id.startsWith(entry));
      if (!matches) failures.push({ group: g.baseDiagnosis, entry });
    }
  }

  console.log(
    `Checked ${DX_VARIANT_GROUPS.reduce((n, g) => n + g.diseaseIds.length, 0)} diseaseIds entr(y/ies) ` +
    `across ${DX_VARIANT_GROUPS.length} group(s) against ${realIds.size} real pane-engine disease id(s).`,
  );

  if (failures.length === 0) {
    console.log('✓ Every diseaseIds entry matches at least one real pane-engine disease id.');
    return true;
  }

  console.error(`\n✗ ${failures.length} diseaseIds entr(y/ies) don't match any real pane-engine disease id:\n`);
  for (const { group, entry } of failures) {
    console.error(`  - "${entry}"  (${group} group)`);
  }
  console.error(
    '\nThese entries never fire in detectDxVariants() — they silently fall through to the ' +
    'icdPrefixes check instead of erroring, so this class of bug ships unnoticed. Fix the id ' +
    'to match the real disease id in lib/pane-engine/src/vademecum/specialties/*.ts.',
  );
  return false;
}

function main() {
  const phasesOk = checkPhases();
  console.log('');
  const diseaseIdsOk = checkDiseaseIds();
  if (!phasesOk || !diseaseIdsOk) process.exit(1);
}

main();
