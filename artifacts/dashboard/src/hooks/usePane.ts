import { useCallback, useEffect, useRef } from 'react';
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
import { useAppContext } from '@/context/AppContext';

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
  const { paneState, setPaneState, setPaneTop, setPaneConverged } = useAppContext();

  // Initialise from context (null = new patient)
  const state: PaneState = paneState ?? makeInitState(age, sex);

  // Re-initialise priors when age/sex become available, but only before any Q is answered.
  const prevAgeRef = useRef(age);
  const prevSexRef = useRef(sex);
  useEffect(() => {
    if (prevAgeRef.current === age && prevSexRef.current === sex) return;
    prevAgeRef.current = age;
    prevSexRef.current = sex;
    setPaneState(prev => {
      if (prev && prev.iteration > 0) return prev; // preserve in-progress session
      return makeInitState(age, sex);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [age, sex]);

  // Derive disease list with modifiers applied (used at init; state holds the result)
  const diseases = applyModifiers(DISEASES, age, sex);

  const nextQuestion = nextBestQuestion(state, diseases, FEATURES);
  const top = topDiagnoses(state, diseases, 3);
  const converged = isConverged(state);

  // Propagate top/converged to AppContext so AssessmentTab can read them
  useEffect(() => {
    setPaneTop(top);
    setPaneConverged(converged);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [converged, top.map(r => r.probability).join(',')]);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [converged, state.iteration]);

  const answer = useCallback((featureId: string, observed: boolean) => {
    setPaneState(prev => {
      const current = prev ?? makeInitState(age, sex);
      return updatePosterior(current, applyModifiers(DISEASES, age, sex), featureId, observed);
    });
  }, [age, sex, setPaneState]);

  const reset = useCallback(() => {
    setPaneState(prev => {
      if (prev && prev.iteration > 0 && !loggedRef.current) {
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
      return null; // triggers re-init from null → makeInitState in next render
    });
  }, [age, sex, encounterId, patientId, setPaneState]);

  const exportDifferential = useCallback(
    () => exportSummary(state, diseases, FEATURES, 3),
    [state, diseases],
  );

  return { state, nextQuestion, top, converged, answer, reset, exportDifferential };
}
