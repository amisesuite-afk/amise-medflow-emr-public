import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DISEASES,
  FEATURES,
  applyModifiers,
  exportSummary,
  initPaneState,
  isConverged,
  nextBestQuestion,
  topDiagnoses,
  updatePosterior,
} from '@workspace/pane-engine';
import type { Feature, PaneState, RankedDiagnosis } from '@workspace/pane-engine';
import { logPaneSession } from '@/lib/db';

export interface PaneOpts {
  age?: number | null;
  sex?: string;
  encounterId?: string | null;
  patientId?: string | null;
}

export interface UsePaneReturn {
  state: PaneState;
  /** The next most informative question to ask, or null when converged. */
  nextQuestion: Feature | null;
  /** Top-3 diagnoses ranked by posterior probability (excludes _other_). */
  top: RankedDiagnosis[];
  /** True when the engine has converged or hit the question cap. */
  converged: boolean;
  /** Record a yes/no answer for the current question. */
  answer: (featureId: string, observed: boolean) => void;
  /** Reset to priors (logs current session if > 0 questions answered). */
  reset: () => void;
  /** Generate a structured plain-text PANE summary for the differentials field. */
  exportDifferential: () => string;
}

function makeInitState(age: number | null, sex: string): PaneState {
  return initPaneState(applyModifiers(DISEASES, age, sex));
}

export function usePane(opts: PaneOpts = {}): UsePaneReturn {
  const { age = null, sex = 'unknown', encounterId = null, patientId = null } = opts;

  const [state, setState] = useState<PaneState>(() => makeInitState(age, sex));

  // Re-initialise priors when age/sex become available, but only before any Q is answered.
  const prevAgeRef = useRef(age);
  const prevSexRef = useRef(sex);
  useEffect(() => {
    if (prevAgeRef.current === age && prevSexRef.current === sex) return;
    prevAgeRef.current = age;
    prevSexRef.current = sex;
    setState(prev => {
      if (prev.iteration > 0) return prev; // preserve in-progress session
      return makeInitState(age, sex);
    });
  }, [age, sex]);

  // Derive disease list with modifiers applied (used at init; state holds the result)
  const diseases = applyModifiers(DISEASES, age, sex);

  const nextQuestion = nextBestQuestion(state, diseases, FEATURES);
  const top = topDiagnoses(state, diseases, 3);
  const converged = isConverged(state);

  // Audit-log once when the engine converges
  const loggedRef = useRef(false);
  useEffect(() => {
    if (!converged || loggedRef.current || state.iteration === 0) return;
    loggedRef.current = true;
    logPaneSession({
      encounter_id:  encounterId,
      patient_id:    patientId,
      answered:      state.answered,
      top_diagnoses: top.map(r => ({
        id: r.disease.id, label: r.disease.label,
        icd10: r.disease.icd10, probability: r.probability,
      })),
      iteration: state.iteration,
      converged: true,
    });
  }, [converged, state, top, encounterId, patientId]);

  const answer = useCallback((featureId: string, observed: boolean) => {
    setState(prev => updatePosterior(prev, applyModifiers(DISEASES, age, sex), featureId, observed));
  }, [age, sex]);

  const reset = useCallback(() => {
    setState(prev => {
      if (prev.iteration > 0 && !loggedRef.current) {
        const currentTop = topDiagnoses(prev, applyModifiers(DISEASES, age, sex), 3);
        logPaneSession({
          encounter_id:  encounterId,
          patient_id:    patientId,
          answered:      prev.answered,
          top_diagnoses: currentTop.map(r => ({
            id: r.disease.id, label: r.disease.label,
            icd10: r.disease.icd10, probability: r.probability,
          })),
          iteration: prev.iteration,
          converged: false,
        });
      }
      loggedRef.current = false;
      return makeInitState(age, sex);
    });
  }, [age, sex, encounterId, patientId]);

  const exportDifferential = useCallback(
    () => exportSummary(state, diseases, FEATURES, 3),
    [state, diseases],
  );

  return { state, nextQuestion, top, converged, answer, reset, exportDifferential };
}
