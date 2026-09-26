/**
 * History frames: the shared complaint → frame vectors (HistoryFrameVectors.json, also run by
 * HistoryFrameTests.swift), the mismatch audit and the Swift twin. See history-frames-audit.ts.
 */

import { describe, expect, it } from 'vitest';
import {
  HISTORY_FRAMES, classifyComplaint, getFrame, resolveFrame, toggleWebAnswer,
} from '../../lib/triage-engine/src/history-frames/index';
import {
  checkChipMapping, checkFrameStructure, checkSwiftTwin, checkVectors, checkVignettes, loadVectors,
} from './history-frames-audit';

describe('history frames — shared vectors', () => {
  it('has a reviewed vector for every complaint on both platforms and the classifier agrees', () => {
    expect(loadVectors().length).toBeGreaterThan(400);
    expect(checkVectors()).toEqual([]);
  });

  it('owner report: a cough gets the cough history, not abdominal SOCRATES', () => {
    const r = resolveFrame('Cough', 'Respiratory');
    expect(r.frame.id).toBe('cough');
    expect(r.frame.title).toBe('Cough history');
    const labels = r.dimensions.flatMap(d => d.options.map(o => o.label));
    for (const s of ['RUQ', 'LUQ', 'RLQ', 'LLQ', 'Epigastric', 'Periumbilical', 'Suprapubic', 'Loin', 'Groin']) {
      expect(labels).not.toContain(s);
    }
    expect(r.dimensions.some(d => d.id === 'radiation')).toBe(false);
  });

  it('pain keeps SOCRATES with the regional sites (the walkthrough RUQ case)', () => {
    const r = resolveFrame('Right upper quadrant pain for 3 days');
    expect(r.frame.id).toBe('pain.abdomen');
    expect(r.frame.title).toBe('SOCRATES');
    expect(r.dimensions[0]!.id).toBe('onset');
    expect(r.frame.dimensions.find(d => d.id === 'site')!.options[0]!.label).toBe('RUQ');
  });

  it('primary symptom plus the other symptoms\' key questions', () => {
    const r = resolveFrame('Cough with haemoptysis and weight loss');
    expect(r.frame.id).toBe('cough');
    expect(r.dimensions.some(d => d.id === 'weight_loss.amount' && d.secondary)).toBe(true);
    expect(resolveFrame('Abdominal pain and vomiting').dimensions.some(d => d.id === 'vomiting.content')).toBe(true);
    expect(classifyComplaint('Painful lump in the groin').frameId).toBe('lump.hernia');
    expect(classifyComplaint('Pain', 'Musculoskeletal').frameId).toBe('pain.joint');
    expect(classifyComplaint('Painless jaundice').frameId).toBe('jaundice');
  });

  it('one-tap override keeps the automatic choice for reference', () => {
    const r = resolveFrame('Cough', undefined, 'dyspnoea');
    expect(r.frame.id).toBe('dyspnoea');
    expect(r.choice.frameId).toBe('cough');
  });

  it('web toggling honours single-select and exclusive chips', () => {
    const cough = getFrame('cough')!;
    const character = cough.dimensions.find(d => d.id === 'character')!;
    expect(toggleWebAnswer('Dry cough', character, 'Productive cough')).toBe('Productive cough');
    const relieving = getFrame('pain.abdomen')!.dimensions.find(d => d.id === 'relieving')!;
    expect(toggleWebAnswer('Rest, Antacids', relieving, 'Nothing')).toBe('Nothing');
    expect(toggleWebAnswer('Nothing', relieving, 'Rest')).toBe('Rest');
    expect(toggleWebAnswer('Rest, typed detail', relieving, 'Antacids')).toBe('Rest, typed detail, Antacids');
  });
});

describe('history frames — mismatch audit', () => {
  it('frame structure: SOCRATES only for pain, no radiation outside pain, no abdominal sites elsewhere, no duplicates or contradictions', () => {
    expect(checkFrameStructure()).toEqual([]);
  });

  it('every chip reaches an engine feature on each platform or is marked record only', () => {
    expect(checkChipMapping()).toEqual([]);
  }, 60_000);

  it('the Swift twin is current', () => {
    expect(checkSwiftTwin()).toEqual([]);
  });

  it('vignette SOCRATES values are chip values (or legacy aliases) and web details are picker options', () => {
    expect(checkVignettes()).toEqual([]);
  });

  it('every frame has a unique id and at least one question', () => {
    const ids = HISTORY_FRAMES.map(f => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of HISTORY_FRAMES) expect(f.dimensions.length).toBeGreaterThan(0);
  });
});
