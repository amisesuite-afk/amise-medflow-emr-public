/**
 * React hook for searching and filtering the surgical procedure catalog.
 *
 * Wraps the pure helper functions from `@workspace/triage-engine` in
 * a hook-friendly API with `useCallback` to keep references stable.
 */

import { useMemo, useCallback } from 'react';
import {
  type SurgicalProcedure,
  SURGICAL_CATALOG,
  searchProcedures as _searchProcedures,
  getProcedureByCode as _getProcedureByCode,
  getProceduresByCategory as _getProceduresByCategory,
} from '@workspace/triage-engine';

export type { SurgicalProcedure };

export interface UseSurgicalCatalogReturn {
  /** All procedures in the catalog. */
  procedures: SurgicalProcedure[];
  /** Case-insensitive search across procedure name and category. */
  searchProcedures: (query: string) => SurgicalProcedure[];
  /** Return all procedures in a given category (e.g. 'endoscopy', 'anorectal'). */
  getByCategory: (category: string) => SurgicalProcedure[];
  /** Look up a single procedure by its CPT code. */
  getByCPT: (code: string) => SurgicalProcedure | undefined;
}

export function useSurgicalCatalog(): UseSurgicalCatalogReturn {
  const procedures = useMemo(() => SURGICAL_CATALOG, []);

  const searchProcedures = useCallback(
    (query: string): SurgicalProcedure[] => _searchProcedures(query),
    [],
  );

  const getByCategory = useCallback(
    (category: string): SurgicalProcedure[] => _getProceduresByCategory(category),
    [],
  );

  const getByCPT = useCallback(
    (code: string): SurgicalProcedure | undefined => _getProcedureByCode(code),
    [],
  );

  return {
    procedures,
    searchProcedures,
    getByCategory,
    getByCPT,
  };
}
