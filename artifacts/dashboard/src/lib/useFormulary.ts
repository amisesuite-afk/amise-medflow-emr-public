/**
 * React hook for searching and filtering the practice formulary.
 *
 * Wraps the pure helper functions from `@workspace/triage-engine` in
 * a hook-friendly API with `useMemo` to avoid redundant re-computation.
 */

import { useMemo, useCallback } from 'react';
import {
  type Medication,
  FORMULARY,
  searchMedications as _searchMedications,
  getMedicationByCode as _getMedicationByCode,
  getMedicationsByClass as _getMedicationsByClass,
  getSurgicallyRelevant as _getSurgicallyRelevant,
} from '@workspace/triage-engine';

export type { Medication };

export interface UseFormularyReturn {
  /** All medications in the formulary. */
  medications: Medication[];
  /** Case-insensitive search across generic name, brand names, class, and subclass. */
  searchMedications: (query: string) => Medication[];
  /** Look up a single medication by its internal code (e.g. 'MED-001'). */
  getMedicationByCode: (code: string) => Medication | undefined;
  /** Return all medications belonging to a therapeutic class. */
  getByClass: (className: string) => Medication[];
  /** Return medications tagged with a specific surgical-relevance tag. */
  getSurgicallyRelevant: (tag: string) => Medication[];
}

export function useFormulary(): UseFormularyReturn {
  const medications = useMemo(() => FORMULARY, []);

  const searchMedications = useCallback(
    (query: string): Medication[] => _searchMedications(query),
    [],
  );

  const getMedicationByCode = useCallback(
    (code: string): Medication | undefined => _getMedicationByCode(code),
    [],
  );

  const getByClass = useCallback(
    (className: string): Medication[] => _getMedicationsByClass(className),
    [],
  );

  const getSurgicallyRelevant = useCallback(
    (tag: string): Medication[] => _getSurgicallyRelevant(tag),
    [],
  );

  return {
    medications,
    searchMedications,
    getMedicationByCode,
    getByClass,
    getSurgicallyRelevant,
  };
}
