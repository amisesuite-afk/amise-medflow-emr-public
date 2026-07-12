/**
 * Matches patient input (symptoms, free text, appointment type) against
 * the clinical pathway registry and returns ranked results.
 *
 * Consumed by both the dashboard (React hook) and the API server.
 */

import { CLINICAL_PATHWAYS, PathwayDefinition } from './pathways';
import type { AppointmentType } from './rules';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PathwayMatchInput {
  /** Symptom keys from the APCQ questionnaire / triage intake. */
  symptoms: string[];
  /** Free-text description of the chief complaint. */
  freeText: string;
  /** Appointment type selected by the triage engine. */
  appointmentType?: AppointmentType;
}

export interface PathwayMatch {
  /** The matched pathway definition. */
  pathway: PathwayDefinition;
  /** Relevance score (higher = better match). */
  score: number;
  /** Which trigger symptoms or keywords actually matched. */
  matchedTriggers: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalise a string for keyword comparison: lowercase, collapse whitespace,
 * strip common punctuation.
 */
function norm(s: string): string {
  return s.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
}

/**
 * Check whether `haystack` contains the keyword `needle` as a whole phrase.
 * Uses a simple substring match after normalisation rather than a regex
 * (avoids escaping issues with user input).
 */
function containsPhrase(haystack: string, needle: string): boolean {
  return haystack.includes(needle);
}

/**
 * Map appointment types to pathway specialties for a bonus score when
 * the appointment type aligns with the pathway specialty.
 */
const APPOINTMENT_SPECIALTY_MAP: Partial<Record<AppointmentType, string[]>> = {
  ercp_workup: ['endoscopy', 'hepatobiliary'],
  ercp: ['endoscopy', 'hepatobiliary'],
  breast: ['breast'],
  post_op: ['general_surgery'],
  diabetic_foot: ['vascular'],
};

// ---------------------------------------------------------------------------
// Core matcher
// ---------------------------------------------------------------------------

/**
 * Match the patient's symptoms and free text against all clinical pathways.
 *
 * Scoring:
 * - Each matched triggerSymptom contributes 10 points.
 * - Each matched triggerKeyword contributes 5 points.
 * - If the appointment type aligns with the pathway specialty, +8 bonus.
 * - Pathways with no matches are excluded.
 *
 * Returns results sorted by score descending (best match first).
 */
export function matchPathways(input: PathwayMatchInput): PathwayMatch[] {
  const normFreeText = norm(input.freeText);
  const normSymptoms = new Set(input.symptoms.map(s => norm(s)));

  // Build a combined text blob from symptoms and free text for keyword matching
  const combinedText = norm([input.freeText, ...input.symptoms].join(' '));

  const results: PathwayMatch[] = [];

  for (const pathway of CLINICAL_PATHWAYS) {
    let score = 0;
    const matchedTriggers: string[] = [];

    // 1. Symptom intersection (exact match on symptom keys)
    for (const triggerSymptom of pathway.triggerSymptoms) {
      if (normSymptoms.has(norm(triggerSymptom))) {
        score += 10;
        matchedTriggers.push(triggerSymptom);
      }
    }

    // 2. Keyword matching against combined text
    for (const keyword of pathway.triggerKeywords) {
      const normKeyword = norm(keyword);
      if (containsPhrase(combinedText, normKeyword)) {
        score += 5;
        matchedTriggers.push(keyword);
      }
    }

    // 3. Also check free text against individual triggerSymptom strings
    //    (some symptom strings like "abdominal_pain" may appear as
    //    "abdominal pain" in free text)
    for (const triggerSymptom of pathway.triggerSymptoms) {
      const readable = norm(triggerSymptom.replace(/_/g, ' '));
      if (!matchedTriggers.includes(triggerSymptom) && containsPhrase(normFreeText, readable)) {
        score += 7;
        matchedTriggers.push(triggerSymptom + ' (free-text)');
      }
    }

    // 4. Appointment type bonus
    if (input.appointmentType) {
      const alignedSpecialties = APPOINTMENT_SPECIALTY_MAP[input.appointmentType];
      if (alignedSpecialties && alignedSpecialties.includes(pathway.specialty)) {
        score += 8;
        matchedTriggers.push(`appointment_type:${input.appointmentType}`);
      }
    }

    // Only include pathways with at least one match
    if (score > 0) {
      results.push({
        pathway,
        score,
        matchedTriggers,
      });
    }
  }

  // Sort by score descending; break ties alphabetically by pathway name
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.pathway.name.localeCompare(b.pathway.name);
  });

  return results;
}
