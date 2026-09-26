import { useMemo } from 'react';
import type { PlanPatientContext } from '@workspace/pane-engine';
import { useAppContext } from '@/context/AppContext';
import { planPatientContext } from '@/lib/plan-builder';

/**
 * The patient on record, as the pane-engine plan-safety filters read it (allergies, pregnancy,
 * age, medicines, history, eGFR). Used by PlanTab, the ManagementPanel and PrescriptionsTab so the
 * protocol text shown is adapted to this patient.
 */
export function usePlanPatientContext(): PlanPatientContext {
  const {
    age, sex, pregnancyPossible, allergies, medications, medicationsText, comorbidities,
    pmhNotes, hpiNotes, freeText, surgicalHistory, assessment, extractedLabs,
  } = useAppContext();
  return useMemo(
    () => planPatientContext({
      age, sex, pregnancyPossible, allergies, medications, medicationsText, comorbidities,
      pmhNotes, hpiNotes, freeText, surgicalHistory, assessment, extractedLabs,
    }),
    [age, sex, pregnancyPossible, allergies, medications, medicationsText, comorbidities,
      pmhNotes, hpiNotes, freeText, surgicalHistory, assessment, extractedLabs],
  );
}
