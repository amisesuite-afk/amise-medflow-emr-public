import type { DiseaseNode } from '../types.js';

export interface PriorModifier {
  diseaseId: string;
  /** Multiplicative adjustment — e.g. 2.0 doubles the prior. */
  multiplier: number;
  condition: {
    /** Only apply when sex matches exactly. 'unknown' never matches. */
    sex?: 'male' | 'female';
    /** Only apply when age >= ageMin (skipped if age is null). */
    ageMin?: number;
    /** Only apply when age <= ageMax (skipped if age is null). */
    ageMax?: number;
  };
}

/**
 * Evidence-informed prior modifiers for a surgical OPD in Saint Lucia.
 * Sources: global epidemiology + Caribbean burden-of-disease data.
 * Multiple matching modifiers compound multiplicatively.
 */
export const SURGICAL_OPD_MODIFIERS: PriorModifier[] = [
  // Appendicitis — peak incidence 10–35 y; M:F ≈ 1.4:1
  { diseaseId: 'appendicitis', multiplier: 2.2, condition: { ageMin: 10, ageMax: 35 } },
  { diseaseId: 'appendicitis', multiplier: 1.4, condition: { sex: 'male' } },
  { diseaseId: 'appendicitis', multiplier: 0.5, condition: { ageMin: 60 } },

  // Cholecystitis — female predominance; peak 30–70 y
  { diseaseId: 'cholecystitis', multiplier: 2.0, condition: { sex: 'female' } },
  { diseaseId: 'cholecystitis', multiplier: 1.6, condition: { ageMin: 30, ageMax: 70 } },

  // Colorectal cancer — extremely rare <40; exponential rise after 50
  { diseaseId: 'colorectal_cancer', multiplier: 0.08, condition: { ageMin: 0, ageMax: 40 } },
  { diseaseId: 'colorectal_cancer', multiplier: 2.5, condition: { ageMin: 50, ageMax: 64 } },
  { diseaseId: 'colorectal_cancer', multiplier: 4.0, condition: { ageMin: 65 } },

  // Inguinal / femoral hernia — M >> F (lifetime ratio ~8:1)
  { diseaseId: 'inguinal_hernia', multiplier: 5.0, condition: { sex: 'male' } },
  { diseaseId: 'inguinal_hernia', multiplier: 0.3, condition: { sex: 'female' } },
  { diseaseId: 'inguinal_hernia', multiplier: 1.8, condition: { ageMin: 50 } },

  // Diverticulitis — uncommon <40; sharply higher after 60
  { diseaseId: 'diverticulitis', multiplier: 0.15, condition: { ageMin: 0, ageMax: 40 } },
  { diseaseId: 'diverticulitis', multiplier: 2.0, condition: { ageMin: 60, ageMax: 79 } },
  { diseaseId: 'diverticulitis', multiplier: 3.5, condition: { ageMin: 80 } },

  // GORD — M slightly > F; prevalence rises with age
  { diseaseId: 'gord', multiplier: 1.3, condition: { sex: 'male' } },
  { diseaseId: 'gord', multiplier: 1.4, condition: { ageMin: 45 } },

  // Pancreatitis — M slightly > F
  { diseaseId: 'pancreatitis', multiplier: 1.2, condition: { sex: 'male' } },

  // Cholangitis — rises sharply after 60
  { diseaseId: 'cholangitis', multiplier: 1.8, condition: { ageMin: 60 } },
];

/**
 * Return a new diseases array with priors adjusted for the patient's age and sex,
 * then renormalised so all priors sum to 1.
 *
 * Age-conditional modifiers are skipped when age is null (unknown).
 * Sex-conditional modifiers are skipped when sex is 'unknown' or 'other'.
 */
export function applyModifiers(
  diseases: DiseaseNode[],
  age: number | null,
  sex: string,
  modifiers: PriorModifier[] = SURGICAL_OPD_MODIFIERS,
): DiseaseNode[] {
  const adjusted = diseases.map(disease => {
    let mult = 1.0;
    for (const mod of modifiers) {
      if (mod.diseaseId !== disease.id) continue;
      const { sex: mSex, ageMin, ageMax } = mod.condition;
      // Skip age-dependent modifiers when age is unknown
      const isAgeCond = ageMin !== undefined || ageMax !== undefined;
      if (isAgeCond && age === null) continue;
      if (ageMin !== undefined && age! < ageMin) continue;
      if (ageMax !== undefined && age! > ageMax) continue;
      // Skip sex-dependent modifiers when sex is not binary-known
      if (mSex !== undefined && sex !== mSex) continue;
      mult *= mod.multiplier;
    }
    return { ...disease, prior: Math.max(1e-9, disease.prior * mult) };
  });

  const total = adjusted.reduce((s, d) => s + d.prior, 0);
  return total > 0 ? adjusted.map(d => ({ ...d, prior: d.prior / total })) : adjusted;
}
