/**
 * NEWS2 — Royal College of Physicians, National Early Warning Score (NEWS) 2, December 2017.
 *
 * Every boundary case below is ported one-for-one from the iOS reference suite
 * `ios/AmiseMedFlowTests/NEWS2Tests.swift` (which tests `NEWS2Chart.swift`), so web and iOS are
 * held to identical vectors. Change both suites together.
 *
 * `entry()` mirrors the iOS empty VitalsEntry: no observations, Alert, on room air, Scale 1.
 * Each parameter is tested on its own: fields left null contribute nothing, so a
 * single-parameter entry scores exactly that parameter's points.
 *
 * The final block checks that all three dashboard NEWS2 surfaces (the shared engine,
 * `scoreNews2` in clinical-scores.ts and `news2Score`/`interpretNews2` in clinical-scales.ts)
 * agree — hazard log H-04 was three implementations that disagreed.
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateNews2,
  type News2Input,
  type News2Avpu,
} from '@workspace/triage-engine';
import { scoreNews2 } from '@/lib/clinical-scores';
import { news2Score, evaluateNews2Inputs, interpretNews2 } from '@/lib/clinical-scales';

/** Empty entry: no observations, alert, on room air (iOS VitalsEntry defaults). */
function entry(over: Partial<News2Input> = {}): News2Input {
  return { avpu: 'A', onOxygen: false, useSpO2Scale2: false, ...over };
}

/** A full set of observations that scores 0. */
function normalEntry(over: Partial<News2Input> = {}): News2Input {
  return entry({
    respiratoryRate: 16,
    spo2: 98,
    systolicBP: 120,
    heartRate: 70,
    temperatureCelsius: 37.0,
    ...over,
  });
}

const score = (i: News2Input) => evaluateNews2(i).total;
const redFlag = (i: News2Input) => evaluateNews2(i).hasSingleParameterScore3;
const risk = (i: News2Input) => evaluateNews2(i).bandLabel;

const NON_ALERT: News2Avpu[] = ['C', 'V', 'P', 'U'];

// ── Single parameters (RCP chart boundaries) ────────────────────────────────

describe('NEWS2 single parameters (RCP Chart 1)', () => {
  it('respiratory rate boundaries', () => {
    const cases: [number, number][] = [[8, 3], [9, 1], [11, 1], [12, 0], [20, 0], [21, 2], [24, 2], [25, 3]];
    for (const [rr, points] of cases) expect(score(entry({ respiratoryRate: rr })), `RR ${rr}`).toBe(points);
  });

  it('SpO₂ Scale 1 boundaries', () => {
    const cases: [number, number][] = [[91, 3], [92, 2], [93, 2], [94, 1], [95, 1], [96, 0], [100, 0]];
    for (const [spo2, points] of cases) expect(score(entry({ spo2 })), `SpO2 ${spo2} on air`).toBe(points);
  });

  it('SpO₂ Scale 2 on oxygen follows the RCP chart (+2 for oxygen)', () => {
    const cases: [number, number][] = [[80, 3], [83, 3], [84, 2], [85, 2], [86, 1], [87, 1], [88, 0], [92, 0],
      [93, 1], [94, 1], [95, 2], [96, 2], [97, 3], [100, 3]];
    for (const [spo2, points] of cases) {
      expect(score(entry({ spo2, onOxygen: true, useSpO2Scale2: true })), `Scale 2 SpO2 ${spo2} on O2`).toBe(points + 2);
    }
  });

  it('SpO₂ Scale 2 on air: 93 and above scores 0; low end same as on oxygen', () => {
    const cases: [number, number][] = [[83, 3], [84, 2], [85, 2], [86, 1], [87, 1], [88, 0], [92, 0],
      [93, 0], [95, 0], [97, 0], [100, 0]];
    for (const [spo2, points] of cases) {
      expect(score(entry({ spo2, useSpO2Scale2: true })), `Scale 2 SpO2 ${spo2} on air`).toBe(points);
    }
  });

  it('supplemental oxygen alone keeps Scale 1 (Scale 2 is opt-in only)', () => {
    expect(evaluateNews2(entry()).spo2Scale).toBe(1);
    const cases: [number, number][] = [[91, 3], [92, 2], [93, 2], [94, 1], [95, 1], [96, 0], [97, 0], [100, 0]];
    for (const [spo2, points] of cases) {
      expect(score(entry({ spo2, onOxygen: true })), `Scale 1 SpO2 ${spo2} on O2`).toBe(points + 2);
    }
    expect(redFlag(entry({ spo2: 88, onOxygen: true })), 'SpO2 88% on Scale 1 scores 3').toBe(true);
  });

  it('supplemental oxygen alone scores 2', () => {
    expect(score(entry({ onOxygen: true }))).toBe(2);
  });

  it('systolic BP boundaries', () => {
    const cases: [number, number][] = [[90, 3], [91, 2], [100, 2], [101, 1], [110, 1], [111, 0], [219, 0], [220, 3]];
    for (const [sbp, points] of cases) expect(score(entry({ systolicBP: sbp })), `SBP ${sbp}`).toBe(points);
  });

  it('heart rate boundaries', () => {
    const cases: [number, number][] = [[40, 3], [41, 1], [50, 1], [51, 0], [90, 0], [91, 1],
      [110, 1], [111, 2], [130, 2], [131, 3]];
    for (const [hr, points] of cases) expect(score(entry({ heartRate: hr })), `HR ${hr}`).toBe(points);
  });

  it('temperature boundaries', () => {
    const cases: [number, number][] = [[35.0, 3], [35.1, 1], [36.0, 1], [36.1, 0], [38.0, 0],
      [38.1, 1], [39.0, 1], [39.1, 2]];
    for (const [t, points] of cases) expect(score(entry({ temperatureCelsius: t })), `Temp ${t}`).toBe(points);
  });

  it('consciousness scores 3 for anything but Alert (new confusion included)', () => {
    expect(score(entry())).toBe(0);
    for (const level of NON_ALERT) expect(score(entry({ avpu: level })), `AVPU ${level}`).toBe(3);
  });
});

// ── Aggregate score and risk band ───────────────────────────────────────────

describe('NEWS2 aggregate and band (RCP Chart 3)', () => {
  it('normal observations score 0, low risk', () => {
    const v = normalEntry();
    expect(score(v)).toBe(0);
    expect(redFlag(v)).toBe(false);
    expect(risk(v)).toBe('Low');
  });

  it('aggregate 4 without red flag is low', () => {
    const v = normalEntry({ respiratoryRate: 22, heartRate: 115 });
    expect(score(v)).toBe(4);
    expect(redFlag(v)).toBe(false);
    expect(risk(v)).toBe('Low');
  });

  it('aggregate 5 is medium', () => {
    const v = normalEntry({ respiratoryRate: 22, heartRate: 115, temperatureCelsius: 38.5 });
    expect(score(v)).toBe(5);
    expect(redFlag(v)).toBe(false);
    expect(risk(v)).toBe('Medium');
  });

  it('aggregate 7 is high', () => {
    const v = normalEntry({ respiratoryRate: 22, heartRate: 115, systolicBP: 105, temperatureCelsius: 38.5, spo2: 95 });
    expect(score(v)).toBe(7);
    expect(redFlag(v)).toBe(false);
    expect(risk(v)).toBe('High');
  });

  it('maximum score on air', () => {
    const v = entry({
      respiratoryRate: 30, spo2: 85, systolicBP: 80, heartRate: 140, temperatureCelsius: 34.0, avpu: 'U',
    });
    expect(score(v)).toBe(18); // 3 × 6 parameters, on air
    expect(risk(v)).toBe('High');
  });
});

// ── Single-parameter red flag (a 3 in any one parameter) ────────────────────

describe('NEWS2 single-parameter red flag', () => {
  const extremes: [string, Partial<News2Input>][] = [
    ['RR 8', { respiratoryRate: 8 }],
    ['RR 25', { respiratoryRate: 25 }],
    ['SpO2 91', { spo2: 91 }],
    ['SBP 90', { systolicBP: 90 }],
    ['SBP 220', { systolicBP: 220 }],
    ['HR 40', { heartRate: 40 }],
    ['HR 131', { heartRate: 131 }],
    ['Temp 35.0', { temperatureCelsius: 35.0 }],
    ['AVPU voice', { avpu: 'V' }],
    ['AVPU confused', { avpu: 'C' }],
  ];

  it('each extreme parameter raises the red flag and is low-medium, never low', () => {
    for (const [label, over] of extremes) {
      const v = normalEntry(over);
      const r = evaluateNews2(v);
      expect(r.hasSingleParameterScore3, label).toBe(true);
      expect(r.bandLabel, label).not.toBe('Low');
      expect(r.band, label).toBe('low_medium');
      expect(r.bandLabel, label).toBe('Low-medium');
    }
  });

  it('a single 3 flags even when every other parameter (including RR) is missing', () => {
    const setters: [string, Partial<News2Input>][] = [
      ['SBP 90', { systolicBP: 90 }],
      ['SBP 220', { systolicBP: 220 }],
      ['AVPU voice', { avpu: 'V' }],
      ['AVPU confused', { avpu: 'C' }],
      ['SpO2 91', { spo2: 91 }],
      ['HR 40', { heartRate: 40 }],
      ['HR 131', { heartRate: 131 }],
      ['Temp 35.0', { temperatureCelsius: 35.0 }],
      ['RR 8', { respiratoryRate: 8 }],
    ];
    for (const [label, over] of setters) {
      const r = evaluateNews2(entry(over));
      expect(r.hasSingleParameterScore3, label).toBe(true);
      expect(r.band, label).toBe('low_medium');
      expect(r.isComplete, label).toBe(false);
    }
  });

  it('Scale 2 extremes raise the red flag', () => {
    expect(redFlag(entry({ useSpO2Scale2: true, spo2: 83 })), 'Scale 2 SpO2 83').toBe(true);
    expect(redFlag(entry({ useSpO2Scale2: true, spo2: 97, onOxygen: true })), 'Scale 2 SpO2 97 on O2').toBe(true);
    expect(redFlag(entry({ useSpO2Scale2: true, spo2: 90, onOxygen: true })), 'Scale 2 SpO2 90 on O2 in target').toBe(false);
  });

  it('red flag does not lower a medium or high aggregate', () => {
    const v = normalEntry({ systolicBP: 90, heartRate: 115 });
    expect(score(v)).toBe(5);
    expect(risk(v)).toBe('Medium');
    const w = { ...v, respiratoryRate: 22 };
    expect(score(w)).toBe(7);
    expect(risk(w)).toBe('High');
  });

  it('values just inside the red-flag limits do not raise it', () => {
    const setters: [string, Partial<News2Input>][] = [
      ['RR 9', { respiratoryRate: 9 }],
      ['RR 24', { respiratoryRate: 24 }],
      ['SpO2 92', { spo2: 92 }],
      ['SBP 91', { systolicBP: 91 }],
      ['SBP 219', { systolicBP: 219 }],
      ['HR 41', { heartRate: 41 }],
      ['HR 130', { heartRate: 130 }],
      ['Temp 35.1', { temperatureCelsius: 35.1 }],
      ['Temp 39.5', { temperatureCelsius: 39.5 }], // 2 points, not 3
    ];
    for (const [label, over] of setters) expect(redFlag(normalEntry(over)), label).toBe(false);
  });

  it('supplemental oxygen (max 2) is never a single-parameter 3', () => {
    expect(redFlag(normalEntry({ onOxygen: true }))).toBe(false);
  });
});

// ── Completeness (missing parameters count as 0 but are reported) ───────────

describe('NEWS2 completeness marker', () => {
  it('full observations are complete', () => {
    const r = evaluateNews2(normalEntry());
    expect(r.isComplete).toBe(true);
    expect(r.missingParameters).toEqual([]);
    expect(r.incompleteNote).toBeNull();
    expect(r.summary).toBe('NEWS2 0 (Low)');
  });

  it('missing parameters are listed in chart order', () => {
    const r = evaluateNews2(entry({ systolicBP: 120, heartRate: 115 }));
    expect(r.total, 'missing parameters count as 0; the number is unchanged').toBe(2);
    expect(r.isComplete).toBe(false);
    expect(r.missingParameters).toEqual(['RR', 'SpO₂', 'Temp']);
    expect(r.incompleteNote).toBe('incomplete: RR, SpO₂, Temp not recorded');
    expect(r.summary).toBe('NEWS2 2 (Low — incomplete: RR, SpO₂, Temp not recorded)');
  });

  it('an empty entry lists every scored parameter as missing', () => {
    expect(evaluateNews2(entry()).missingParameters).toEqual(['RR', 'SpO₂', 'BP', 'HR', 'Temp']);
  });

  // Web-only: the dashboard can show NEWS2 before consciousness / air-or-oxygen are charted.
  // Those are then reported as missing rather than silently assumed Alert / room air.
  it('unrecorded ACVPU and air/O₂ are reported as missing, in chart order', () => {
    const r = evaluateNews2({ respiratoryRate: 16, spo2: 98, systolicBP: 120, heartRate: 70, temperatureCelsius: 37 });
    expect(r.missingParameters).toEqual(['Air/O₂', 'ACVPU']);
    expect(r.total).toBe(0);
    expect(r.incompleteNote).toBe('incomplete: Air/O₂, ACVPU not recorded');
    expect(evaluateNews2({}).missingParameters).toEqual(['RR', 'SpO₂', 'Air/O₂', 'BP', 'HR', 'ACVPU', 'Temp']);
  });

  it('NaN / non-finite observations are treated as not recorded', () => {
    const r = evaluateNews2(normalEntry({ heartRate: Number.NaN }));
    expect(r.missingParameters).toEqual(['HR']);
  });
});

// ── Agreement between every dashboard NEWS2 surface ─────────────────────────

type Obs = { rr: number; spo2: number; o2: boolean; sbp: number; hr: number; temp: number; avpu: News2Avpu };
const PROFILES: Obs[] = [
  { rr: 16, spo2: 98, o2: false, sbp: 120, hr: 70, temp: 37.0, avpu: 'A' },
  { rr: 22, spo2: 95, o2: false, sbp: 105, hr: 115, temp: 38.5, avpu: 'A' },
  { rr: 8, spo2: 91, o2: false, sbp: 90, hr: 40, temp: 35.0, avpu: 'V' },
  { rr: 25, spo2: 90, o2: true, sbp: 220, hr: 131, temp: 39.1, avpu: 'U' },
  { rr: 11, spo2: 93, o2: true, sbp: 100, hr: 50, temp: 36.0, avpu: 'A' },
  { rr: 21, spo2: 97, o2: true, sbp: 111, hr: 91, temp: 38.1, avpu: 'C' },
];

describe('NEWS2 surfaces agree (H-04)', () => {
  for (const scale2 of [false, true]) {
    it(`shared engine, clinical-scores and clinical-scales agree (Scale ${scale2 ? 2 : 1})`, () => {
      for (const o of PROFILES) {
        const shared = evaluateNews2({
          respiratoryRate: o.rr, spo2: o.spo2, onOxygen: o.o2, useSpO2Scale2: scale2,
          systolicBP: o.sbp, heartRate: o.hr, temperatureCelsius: o.temp, avpu: o.avpu,
        });
        const scores = scoreNews2(
          { respiratoryRate: o.rr, spo2: o.spo2, systolicBp: o.sbp, heartRate: o.hr, temperatureC: o.temp },
          { avpu: o.avpu, onOxygen: o.o2, useSpO2Scale2: scale2 },
        );
        const scalesInput = {
          respiratoryRate: o.rr, spo2: o.spo2, supplementalO2: o.o2, useSpO2Scale2: scale2,
          systolicBp: o.sbp, heartRate: o.hr, temperatureC: o.temp, consciousnessAvpu: o.avpu,
        };
        const scalesEval = evaluateNews2Inputs(scalesInput);
        const label = JSON.stringify({ ...o, scale2 });
        expect(scores.score, label).toBe(shared.total);
        expect(news2Score(scalesInput), label).toBe(shared.total);
        expect(scores.clinical_risk, label).toBe(shared.band);
        expect(scalesEval.band, label).toBe(shared.band);
        expect(scores.has_single_parameter_3, label).toBe(shared.hasSingleParameterScore3);
        expect(interpretNews2(scalesEval).color, label).toBe(shared.colour);
        expect(scores.complete, label).toBe(true);
      }
    });
  }

  it('clinical-scores scoreNews2 now counts consciousness and oxygen (H-04 regression)', () => {
    const vitals = { respiratoryRate: 16, spo2: 96, systolicBp: 120, heartRate: 70, temperatureC: 37 };
    // Previously scored 0 / LOW for a newly confused patient on oxygen.
    const r = scoreNews2(vitals, { avpu: 'C', onOxygen: true });
    expect(r.score).toBe(5);
    expect(r.clinical_risk).toBe('medium');
    expect(r.has_single_parameter_3).toBe(true);
    // Previously SpO₂ was dropped entirely on Scale 2.
    const s2 = scoreNews2({ ...vitals, spo2: 83 }, { avpu: 'A', onOxygen: false, useSpO2Scale2: true });
    expect(s2.breakdown['SpO₂']).toBe(3);
    expect(s2.clinical_risk).toBe('low_medium');
    // Not supplying ACVPU / air-O₂ is flagged, never assumed.
    const partial = scoreNews2(vitals);
    expect(partial.complete).toBe(false);
    expect(partial.missing_inputs).toEqual(['Air/O₂', 'ACVPU']);
  });

  it('clinical-scales interpretNews2 applies the single-parameter rule (H-04 regression)', () => {
    // Total 3 made of one red parameter used to read "Low Risk".
    const e = evaluateNews2Inputs({
      respiratoryRate: 16, spo2: 98, supplementalO2: false, systolicBp: 90, heartRate: 70,
      temperatureC: 37, consciousnessAvpu: 'A',
    });
    expect(e.total).toBe(3);
    const r = interpretNews2(e);
    expect(r.band).toMatch(/LOW-MEDIUM/);
    expect(r.color).toBe('amber');
  });
});
