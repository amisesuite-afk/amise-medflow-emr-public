/**
 * Prior tiers (pane model 1.0.0).
 *
 * Every disease's prior is one of these relative base rates for an undifferentiated adult
 * outpatient / acute-referral population in Saint Lucia (among the patients the node applies to:
 * women for gynaecological nodes, possibly pregnant women for obstetric nodes, infants for
 * pyloric stenosis). The tier is chosen from the disease's frequency as a cause of presentation,
 * not from its specialty, so no specialty is boosted as a block. Age, sex and pregnancy adjust
 * these through engine/modifiers.ts. Caribbean adjustment: diabetes-related emergencies (DKA,
 * HHS, hypoglycaemia, diabetic foot infection) sit one tier higher than UK figures would suggest
 * (IDF Diabetes Atlas, 10th ed. 2021: adult diabetes prevalence in the Caribbean ≈ 10–15 %).
 *
 * Tiers are approximations for ranking, not calibrated probabilities — they need sign-off.
 *
 * Before 1.0.0 the surgical nodes carried priors 3–15× higher than these tiers (cholecystitis
 * 0.15, GORD 0.12, peptic ulcer 0.10), which made them the default answer for any presentation
 * with few findings (clinval C6).
 */
export const PRIOR_TIER = {
  /** Very common cause of presentation (GORD, UTI, gastroenteritis, haemorrhoids, lipoma). */
  common: 0.03,
  /** Frequent (appendicitis, cholecystitis, pneumonia, cellulitis, inguinal hernia, ACS). */
  frequent: 0.015,
  /** Uncommon (pancreatitis, PE, stroke, DKA, pyelonephritis, SBO). */
  uncommon: 0.007,
  /** Rare (AAA rupture, dissection, SAH, torsion, cauda equina, mesenteric ischaemia). */
  rare: 0.003,
  /** Very rare (Boerhaave, Fournier's, malrotation, phaeochromocytoma). */
  veryRare: 0.001,
} as const;
