/**
 * React hook for searching and filtering ICD-10 coded conditions.
 *
 * Wraps the pure helper functions from `@workspace/triage-engine` in
 * a hook-friendly API with `useCallback` to keep references stable.
 */

import { useMemo, useCallback } from 'react';
import {
  type ConditionCode,
  CONDITION_CODES,
  searchConditions as _searchConditions,
  getByICD10 as _getByICD10,
  getConditionsByCategory as _getConditionsByCategory,
} from '@workspace/triage-engine';

export type { ConditionCode };

export interface UseConditionCodesReturn {
  /** All condition codes in the catalog. */
  conditions: ConditionCode[];
  /** Case-insensitive search across ICD-10 code, description, short name, and common presentations. */
  searchConditions: (query: string) => ConditionCode[];
  /** Look up a single condition by its ICD-10 code. */
  getByICD10: (code: string) => ConditionCode | undefined;
  /** Return all conditions in a given category (e.g. 'Gastrointestinal', 'Breast'). */
  getByCategory: (category: string) => ConditionCode[];
}

export function useConditionCodes(): UseConditionCodesReturn {
  const conditions = useMemo(() => CONDITION_CODES, []);

  const searchConditions = useCallback(
    (query: string): ConditionCode[] => _searchConditions(query),
    [],
  );

  const getByICD10 = useCallback(
    (code: string): ConditionCode | undefined => _getByICD10(code),
    [],
  );

  const getByCategory = useCallback(
    (category: string): ConditionCode[] => _getConditionsByCategory(category),
    [],
  );

  return {
    conditions,
    searchConditions,
    getByICD10,
    getByCategory,
  };
}
