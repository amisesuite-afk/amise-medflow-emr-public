import { useCallback, useState } from 'react';
import {
  DISEASES,
  FEATURES,
  initPaneState,
  isConverged,
  nextBestQuestion,
  topDiagnoses,
  updatePosterior,
} from '@workspace/pane-engine';
import type { Feature, PaneState, RankedDiagnosis } from '@workspace/pane-engine';

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
  /** Reset the engine to priors. */
  reset: () => void;
}

export function usePane(): UsePaneReturn {
  const [state, setState] = useState<PaneState>(() => initPaneState(DISEASES));

  const nextQuestion = nextBestQuestion(state, DISEASES, FEATURES);
  const top = topDiagnoses(state, DISEASES, 3);
  const converged = isConverged(state);

  const answer = useCallback((featureId: string, observed: boolean) => {
    setState(prev => updatePosterior(prev, DISEASES, featureId, observed));
  }, []);

  const reset = useCallback(() => {
    setState(initPaneState(DISEASES));
  }, []);

  return { state, nextQuestion, top, converged, answer, reset };
}
