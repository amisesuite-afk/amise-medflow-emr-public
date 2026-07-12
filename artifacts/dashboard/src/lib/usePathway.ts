/**
 * React hook that matches the current patient's symptoms, free text, and
 * appointment type against the clinical pathway registry and returns the
 * top-matched pathway along with section guidance helpers.
 *
 * Reads from AppContext (symptoms, freeText, triageResult.appointmentType)
 * and calls matchPathways() from the shared triage engine.
 */

import { useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { matchPathways, type PathwayMatch } from '@workspace/triage-engine';
import type { PathwayDefinition, PathwayField, PathwaySectionId } from '@workspace/triage-engine';

export interface UsePathwayResult {
  /** The top-matched pathway, or null if nothing matched. */
  activePathway: PathwayDefinition | null;
  /** All matched pathways, sorted by relevance (best first). */
  matchedPathways: PathwayMatch[];
  /** EMR section ids that the active pathway marks as required. */
  requiredSections: PathwaySectionId[];
  /** Returns field guidance for a given section, or undefined if none. */
  sectionGuidance: (section: string) => PathwayField | undefined;
}

export function usePathway(): UsePathwayResult {
  const { symptoms, freeText, triageResult } = useAppContext();

  const matchedPathways = useMemo(() => {
    return matchPathways({
      symptoms,
      freeText,
      appointmentType: triageResult.appointmentType,
    });
  }, [symptoms, freeText, triageResult.appointmentType]);

  const activePathway = matchedPathways.length > 0
    ? matchedPathways[0]!.pathway
    : null;

  const requiredSections: PathwaySectionId[] = useMemo(() => {
    return activePathway?.requiredSections ?? [];
  }, [activePathway]);

  const sectionGuidance = useMemo(() => {
    const fieldMap = new Map<string, PathwayField>();
    if (activePathway) {
      for (const field of activePathway.fields) {
        fieldMap.set(field.section, field);
      }
    }
    return (section: string): PathwayField | undefined => fieldMap.get(section);
  }, [activePathway]);

  return {
    activePathway,
    matchedPathways,
    requiredSections,
    sectionGuidance,
  };
}
