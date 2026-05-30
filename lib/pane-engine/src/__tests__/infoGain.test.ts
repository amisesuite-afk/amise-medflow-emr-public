import { describe, expect, it } from 'vitest';
import { initPaneState, updatePosterior } from '../engine/bayes.js';
import { isConverged, nextBestQuestion, topDiagnoses } from '../engine/infoGain.js';
import { MAX_QUESTIONS } from '../constants.js';
import { DISEASES, FEATURES } from '../vademecum/index.js';

describe('nextBestQuestion', () => {
  it('returns a valid Feature at game start', () => {
    const state = initPaneState(DISEASES);
    const q = nextBestQuestion(state, DISEASES, FEATURES);
    expect(q).not.toBeNull();
    expect(FEATURES.some(f => f.id === q!.id)).toBe(true);
  });

  it('never returns an already-answered feature', () => {
    let state = initPaneState(DISEASES);
    const first = nextBestQuestion(state, DISEASES, FEATURES)!;
    state = updatePosterior(state, DISEASES, first.id, true);
    const second = nextBestQuestion(state, DISEASES, FEATURES);
    expect(second?.id).not.toBe(first.id);
  });

  it('returns null when all features are answered', () => {
    let state = initPaneState(DISEASES);
    for (const f of FEATURES) {
      state = updatePosterior(state, DISEASES, f.id, false);
    }
    expect(nextBestQuestion(state, DISEASES, FEATURES)).toBeNull();
  });

  it('returns null when MAX_QUESTIONS is reached', () => {
    const state = { ...initPaneState(DISEASES), iteration: MAX_QUESTIONS };
    expect(nextBestQuestion(state, DISEASES, FEATURES)).toBeNull();
  });
});

describe('isConverged', () => {
  it('is not converged at initialisation', () => {
    expect(isConverged(initPaneState(DISEASES))).toBe(false);
  });

  it('is converged when iteration hits MAX_QUESTIONS', () => {
    const state = { ...initPaneState(DISEASES), iteration: MAX_QUESTIONS };
    expect(isConverged(state)).toBe(true);
  });

  it('is converged when a posterior crosses the threshold', () => {
    // Force a dominated state by setting posteriors directly
    const state = initPaneState(DISEASES);
    const dominated = {
      ...state,
      posteriors: { appendicitis: 0.90, cholecystitis: 0.05, peptic_ulcer: 0.03, _other_: 0.02 },
    };
    expect(isConverged(dominated)).toBe(true);
  });
});

describe('topDiagnoses', () => {
  it('excludes _other_ from results', () => {
    const state = initPaneState(DISEASES);
    const top = topDiagnoses(state, DISEASES);
    expect(top.every(r => r.disease.id !== '_other_')).toBe(true);
  });

  it('returns at most n results', () => {
    const state = initPaneState(DISEASES);
    expect(topDiagnoses(state, DISEASES, 2)).toHaveLength(2);
  });

  it('results are sorted descending by probability', () => {
    const state = initPaneState(DISEASES);
    const top = topDiagnoses(state, DISEASES);
    for (let i = 0; i < top.length - 1; i++) {
      expect(top[i].probability).toBeGreaterThanOrEqual(top[i + 1].probability);
    }
  });
});
