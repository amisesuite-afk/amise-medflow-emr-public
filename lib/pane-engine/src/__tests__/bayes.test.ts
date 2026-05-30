import { describe, expect, it } from 'vitest';
import { initPaneState, updatePosterior } from '../engine/bayes.js';
import { DISEASES } from '../vademecum/index.js';

describe('initPaneState', () => {
  it('posteriors sum to 1', () => {
    const state = initPaneState(DISEASES);
    const sum = Object.values(state.posteriors).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it('iteration starts at 0', () => {
    expect(initPaneState(DISEASES).iteration).toBe(0);
  });

  it('answered map starts empty', () => {
    expect(Object.keys(initPaneState(DISEASES).answered)).toHaveLength(0);
  });
});

describe('updatePosterior', () => {
  it('posteriors still sum to 1 after an update', () => {
    const state0 = initPaneState(DISEASES);
    const state1 = updatePosterior(state0, DISEASES, 'rlq_pain', true);
    const sum = Object.values(state1.posteriors).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it('RLQ pain being present raises appendicitis posterior', () => {
    const s0 = initPaneState(DISEASES);
    const s1 = updatePosterior(s0, DISEASES, 'rlq_pain', true);
    expect(s1.posteriors['appendicitis']).toBeGreaterThan(s0.posteriors['appendicitis']);
  });

  it('RUQ pain being present raises cholecystitis posterior', () => {
    const s0 = initPaneState(DISEASES);
    const s1 = updatePosterior(s0, DISEASES, 'ruq_pain', true);
    expect(s1.posteriors['cholecystitis']).toBeGreaterThan(s0.posteriors['cholecystitis']);
  });

  it('absence of a highly-sensitive feature lowers the target disease posterior', () => {
    // RLQ pain sensitivity for appendicitis = 0.90 → absence (1-0.90=0.10) penalises heavily
    const s0 = initPaneState(DISEASES);
    const s1 = updatePosterior(s0, DISEASES, 'rlq_pain', false);
    expect(s1.posteriors['appendicitis']).toBeLessThan(s0.posteriors['appendicitis']);
  });

  it('iteration increments on each update', () => {
    let state = initPaneState(DISEASES);
    expect(state.iteration).toBe(0);
    state = updatePosterior(state, DISEASES, 'fever', true);
    expect(state.iteration).toBe(1);
    state = updatePosterior(state, DISEASES, 'rlq_pain', true);
    expect(state.iteration).toBe(2);
  });

  it('answered map records each observation', () => {
    let state = initPaneState(DISEASES);
    state = updatePosterior(state, DISEASES, 'rlq_pain', true);
    expect(state.answered['rlq_pain']).toBe(true);
    state = updatePosterior(state, DISEASES, 'fever', false);
    expect(state.answered['fever']).toBe(false);
  });

  it('cumulative appendicitis evidence makes appendicitis the leading diagnosis', () => {
    let state = initPaneState(DISEASES);
    for (const [fid, obs] of [
      ['rlq_pain', true],
      ['fever', true],
      ['anorexia', true],
      ['nausea_vomiting', true],
      ['rebound_tenderness', true],
    ] as Array<[string, boolean]>) {
      state = updatePosterior(state, DISEASES, fid, obs);
    }
    const appProb = state.posteriors['appendicitis'];
    expect(appProb).toBeGreaterThan(state.posteriors['cholecystitis']);
    expect(appProb).toBeGreaterThan(state.posteriors['peptic_ulcer']);
  });

  it('cumulative biliary evidence makes cholecystitis the leading seeded diagnosis', () => {
    let state = initPaneState(DISEASES);
    for (const [fid, obs] of [
      ['ruq_pain', true],
      ['murphy_sign', true],
      ['fatty_food_trigger', true],
      ['fever', true],
    ] as Array<[string, boolean]>) {
      state = updatePosterior(state, DISEASES, fid, obs);
    }
    const cholProb = state.posteriors['cholecystitis'];
    expect(cholProb).toBeGreaterThan(state.posteriors['appendicitis']);
    expect(cholProb).toBeGreaterThan(state.posteriors['peptic_ulcer']);
  });
});
