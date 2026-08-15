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
 * Runs only against the shipped state of dx-variants.ts (not a PR diff) --
 * same as the migration-grant lint, it's a standing invariant check, not a
 * diff-only check.
 */

import { DX_VARIANT_GROUPS } from '../../artifacts/dashboard/src/lib/dx-variants';

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

function main() {
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
    return;
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
  process.exit(1);
}

main();
