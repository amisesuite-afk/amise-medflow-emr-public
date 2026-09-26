/**
 * NEWS2 — single shared TypeScript implementation.
 *
 * Standard: Royal College of Physicians. National Early Warning Score (NEWS) 2:
 * Standardising the assessment of acute-illness severity in the NHS. Updated report
 * of a working party. London: RCP, December 2017. Chart 1 (scoring), Chart 2
 * (clinical response thresholds / monitoring frequency), Chart 3 (clinical response).
 *
 * This is the web twin of the iOS reference `ios/AmiseMedFlow/Services/NEWS2Chart.swift`
 * and must stay in exact parity with it: same boundaries, same Scale 1 default, same
 * single-parameter red flag, same bands, same "incomplete" wording. The test vectors in
 * `artifacts/dashboard/src/lib/__tests__/news2.test.ts` are ported one-for-one from
 * `ios/AmiseMedFlowTests/NEWS2Tests.swift` — change both together.
 *
 * Every dashboard NEWS2 surface (ClinicalScoresPanel via `scoreNews2`, ScalesTab via
 * `news2Score`/`interpretNews2`, ClinicalAlgorithmPanel's NEWS2 calculator) calls
 * `evaluateNews2` so they can never disagree again (hazard log H-04).
 *
 * Decision support only: this returns a number, a band and a prompt for display. It
 * never escalates, orders or records anything on its own.
 *
 * Pure, deterministic, no network.
 */

/** ACVPU (RCP NEWS2 2017): Alert, new Confusion, Voice, Pain, Unresponsive. */
export type News2Avpu = 'A' | 'C' | 'V' | 'P' | 'U';

export const NEWS2_AVPU_LABELS: Record<News2Avpu, string> = {
  A: 'Alert',
  C: 'Confused (new)',
  V: 'Responds to voice',
  P: 'Responds to pain',
  U: 'Unresponsive',
};

/**
 * RCP NEWS2 clinical risk (Chart 3):
 * - aggregate 0–4 → low
 * - a score of 3 in any single parameter (aggregate below 5) → low-medium: urgent ward-based response
 * - aggregate 5–6 → medium: key threshold for urgent response
 * - aggregate 7 or more → high: emergency response
 */
export type News2Band = 'low' | 'low_medium' | 'medium' | 'high';

export const NEWS2_BAND_ORDER: Record<News2Band, number> = { low: 0, low_medium: 1, medium: 2, high: 3 };

/** Short label shown next to the score ("NEWS2 3 (Low-medium)") — same strings as iOS NEWS2Band.label. */
export const NEWS2_BAND_LABEL: Record<News2Band, string> = {
  low: 'Low',
  low_medium: 'Low-medium',
  medium: 'Medium',
  high: 'High',
};

/** RCP clinical response for the band — same strings as iOS NEWS2Band.clinicalResponse. */
export const NEWS2_BAND_RESPONSE: Record<News2Band, string> = {
  low: 'Ward-based response',
  low_medium: 'Urgent ward-based response',
  medium: 'Key threshold for urgent response',
  high: 'Urgent or emergency response',
};

/** One-line escalation prompt for banners — same strings as iOS NEWS2Band.prompt. */
export const NEWS2_BAND_PROMPT: Record<News2Band, string> = {
  low: 'NEWS2 low — ward-based response.',
  low_medium: 'Single parameter scoring 3 (low-medium) — urgent ward-based response.',
  medium: 'NEWS2 5–6 (medium) — key threshold for urgent response.',
  high: 'NEWS2 ≥7 (high) — urgent or emergency response.',
};

/** Three-colour display mapping (green / amber / red). Low-medium and medium share amber. */
export const NEWS2_BAND_COLOUR: Record<News2Band, 'green' | 'amber' | 'red'> = {
  low: 'green',
  low_medium: 'amber',
  medium: 'amber',
  high: 'red',
};

/** Labels used in `missingParameters`, in RCP chart order. */
export const NEWS2_PARAMETER_LABELS = {
  respiration: 'RR',
  spo2: 'SpO₂',
  oxygen: 'Air/O₂',
  systolicBP: 'BP',
  heartRate: 'HR',
  consciousness: 'ACVPU',
  temperature: 'Temp',
} as const;

export interface News2Input {
  respiratoryRate?: number | null;
  spo2?: number | null;
  /**
   * Supplemental oxygen. `null`/`undefined` = not recorded → scored 0 AND listed as missing.
   * (iOS always has a value; the web panels can be opened before it has been charted, and
   * silently assuming "air" is exactly the under-scoring H-04 describes.)
   */
  onOxygen?: boolean | null;
  /**
   * SpO₂ Scale 2 — ONLY for confirmed hypercapnic respiratory failure, on a clinician's
   * explicit decision (RCP NEWS2 2017, Chart 1 note / section 5). Defaults to Scale 1.
   * Being on oxygen does NOT switch the scale.
   */
  useSpO2Scale2?: boolean;
  systolicBP?: number | null;
  heartRate?: number | null;
  temperatureCelsius?: number | null;
  /** ACVPU. `null`/`undefined` = not recorded → scored 0 AND listed as missing. */
  avpu?: News2Avpu | null;
}

export interface News2Evaluation {
  /** Aggregate score. Parameters that were not recorded contribute 0. */
  total: number;
  /** True when any single parameter scores 3 (RCP "red score"). */
  hasSingleParameterScore3: boolean;
  /** Parameters that were not recorded, in chart order (e.g. ["RR", "SpO₂"]). */
  missingParameters: string[];
  isComplete: boolean;
  band: News2Band;
  bandLabel: string;
  clinicalResponse: string;
  prompt: string;
  /** RCP Chart 2 minimum monitoring frequency for this aggregate / red score. */
  monitoringFrequency: string;
  colour: 'green' | 'amber' | 'red';
  /** "incomplete: RR, SpO₂ not recorded", or null when every parameter was recorded. */
  incompleteNote: string | null;
  /** "NEWS2 5 (Medium)" or "NEWS2 2 (Low — incomplete: RR, SpO₂ not recorded)". */
  summary: string;
  /** Which SpO₂ scale was applied. */
  spo2Scale: 1 | 2;
  // Individual parameter points (0 when the parameter was not recorded).
  respirationPoints: number;
  spo2Points: number;
  oxygenPoints: number;
  systolicBPPoints: number;
  heartRatePoints: number;
  temperaturePoints: number;
  consciousnessPoints: number;
  /** Recorded parameters only, chart order, label → points (for breakdown badges). */
  breakdown: Record<string, number>;
}

// Observations are charted as whole numbers (RCP Chart 1). Fractional input is rounded to
// the nearest whole number before banding so e.g. 20.4 /min cannot fall between rows.
const whole = (v: number): number => Math.round(v);

const isNum = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v);

/** RCP NEWS2 Chart 1 — respiration rate (per minute): ≤8 → 3, 9–11 → 1, 12–20 → 0, 21–24 → 2, ≥25 → 3. */
export function news2RespirationPoints(rr: number): number {
  const v = whole(rr);
  if (v <= 8) return 3;
  if (v <= 11) return 1;
  if (v <= 20) return 0;
  if (v <= 24) return 2;
  return 3;
}

/**
 * RCP NEWS2 Chart 1 — SpO₂ (%).
 * Scale 1 (default, everyone unless a clinician has opted the patient into Scale 2):
 *   ≤91 → 3, 92–93 → 2, 94–95 → 1, ≥96 → 0.
 * Scale 2 (ONLY confirmed hypercapnic respiratory failure, on a clinician's decision):
 *   ≤83 → 3, 84–85 → 2, 86–87 → 1, 88–92 → 0, ≥93 on air → 0,
 *   93–94 on oxygen → 1, 95–96 on oxygen → 2, ≥97 on oxygen → 3.
 */
export function news2Spo2Points(spo2: number, useScale2: boolean, onOxygen: boolean): number {
  const v = whole(spo2);
  if (!useScale2) {
    if (v <= 91) return 3;
    if (v <= 93) return 2;
    if (v <= 95) return 1;
    return 0;
  }
  if (v <= 83) return 3;
  if (v <= 85) return 2;
  if (v <= 87) return 1;
  if (v <= 92) return 0;
  // 93 and above scores only when the patient is on oxygen.
  if (!onOxygen) return 0;
  if (v <= 94) return 1;
  if (v <= 96) return 2;
  return 3;
}

/** RCP NEWS2 Chart 1 — air or oxygen: any supplemental oxygen → 2. Applies on both SpO₂ scales. */
export function news2OxygenPoints(onOxygen: boolean): number {
  return onOxygen ? 2 : 0;
}

/** RCP NEWS2 Chart 1 — systolic BP (mmHg): ≤90 → 3, 91–100 → 2, 101–110 → 1, 111–219 → 0, ≥220 → 3. */
export function news2SystolicBPPoints(sbp: number): number {
  const v = whole(sbp);
  if (v <= 90) return 3;
  if (v <= 100) return 2;
  if (v <= 110) return 1;
  if (v <= 219) return 0;
  return 3;
}

/** RCP NEWS2 Chart 1 — pulse (per minute): ≤40 → 3, 41–50 → 1, 51–90 → 0, 91–110 → 1, 111–130 → 2, ≥131 → 3. */
export function news2HeartRatePoints(hr: number): number {
  const v = whole(hr);
  if (v <= 40) return 3;
  if (v <= 50) return 1;
  if (v <= 90) return 0;
  if (v <= 110) return 1;
  if (v <= 130) return 2;
  return 3;
}

/**
 * RCP NEWS2 Chart 1 — temperature (°C, charted to one decimal place):
 * ≤35.0 → 3, 35.1–36.0 → 1, 36.1–38.0 → 0, 38.1–39.0 → 1, ≥39.1 → 2.
 */
export function news2TemperaturePoints(celsius: number): number {
  const t = Math.round(celsius * 10) / 10;
  if (t <= 35.0) return 3;
  if (t <= 36.0) return 1;
  if (t <= 38.0) return 0;
  if (t <= 39.0) return 1;
  return 2;
}

/** RCP NEWS2 Chart 1 — consciousness: Alert → 0; new Confusion, Voice, Pain, Unresponsive → 3. */
export function news2ConsciousnessPoints(avpu: News2Avpu): number {
  return avpu === 'A' ? 0 : 3;
}

/**
 * RCP NEWS2 Chart 3 — aggregate → band. A single parameter scoring 3 lifts a low aggregate
 * to low-medium; it never lowers a medium or high aggregate.
 */
export function news2Band(total: number, hasSingleParameterScore3: boolean): News2Band {
  if (total >= 7) return 'high';
  if (total >= 5) return 'medium';
  if (hasSingleParameterScore3) return 'low_medium';
  return 'low';
}

/** RCP NEWS2 Chart 2 — minimum frequency of monitoring. */
export function news2MonitoringFrequency(total: number, hasSingleParameterScore3: boolean): string {
  if (total >= 7) return 'Continuous monitoring of vital signs';
  if (total >= 5 || hasSingleParameterScore3) return 'Minimum 1-hourly';
  if (total >= 1) return 'Minimum 4–6-hourly';
  return 'Minimum 12-hourly';
}

/**
 * Full NEWS2 (RCP 2017). Unrecorded parameters (null/undefined/NaN) score 0 and are listed in
 * `missingParameters`. The single-parameter red flag is evaluated over whatever WAS recorded,
 * so a 3 in any one parameter always flags regardless of how many others are missing.
 */
export function evaluateNews2(input: News2Input): News2Evaluation {
  const L = NEWS2_PARAMETER_LABELS;
  const missing: string[] = [];
  const breakdown: Record<string, number> = {};
  const useScale2 = input.useSpO2Scale2 === true;
  const onOxygenKnown = typeof input.onOxygen === 'boolean';
  const onOxygen = input.onOxygen === true;

  let rr = 0;
  if (isNum(input.respiratoryRate)) { rr = news2RespirationPoints(input.respiratoryRate); breakdown[L.respiration] = rr; }
  else missing.push(L.respiration);

  let sp = 0;
  if (isNum(input.spo2)) { sp = news2Spo2Points(input.spo2, useScale2, onOxygen); breakdown[L.spo2] = sp; }
  else missing.push(L.spo2);

  const o2 = news2OxygenPoints(onOxygen);
  if (onOxygenKnown) breakdown[L.oxygen] = o2;
  else missing.push(L.oxygen);

  let bp = 0;
  if (isNum(input.systolicBP)) { bp = news2SystolicBPPoints(input.systolicBP); breakdown[L.systolicBP] = bp; }
  else missing.push(L.systolicBP);

  let hr = 0;
  if (isNum(input.heartRate)) { hr = news2HeartRatePoints(input.heartRate); breakdown[L.heartRate] = hr; }
  else missing.push(L.heartRate);

  let cons = 0;
  if (input.avpu) { cons = news2ConsciousnessPoints(input.avpu); breakdown[L.consciousness] = cons; }
  else missing.push(L.consciousness);

  let temp = 0;
  if (isNum(input.temperatureCelsius)) { temp = news2TemperaturePoints(input.temperatureCelsius); breakdown[L.temperature] = temp; }
  else missing.push(L.temperature);

  const total = rr + sp + o2 + bp + hr + temp + cons;
  // Supplemental oxygen scores at most 2, so it can never be a single-parameter 3.
  const single3 = [rr, sp, bp, hr, temp, cons].some(p => p >= 3);
  const band = news2Band(total, single3);
  const incompleteNote = missing.length > 0 ? `incomplete: ${missing.join(', ')} not recorded` : null;
  const bandLabel = NEWS2_BAND_LABEL[band];

  return {
    total,
    hasSingleParameterScore3: single3,
    missingParameters: missing,
    isComplete: missing.length === 0,
    band,
    bandLabel,
    clinicalResponse: NEWS2_BAND_RESPONSE[band],
    prompt: NEWS2_BAND_PROMPT[band],
    monitoringFrequency: news2MonitoringFrequency(total, single3),
    colour: NEWS2_BAND_COLOUR[band],
    incompleteNote,
    summary: incompleteNote
      ? `NEWS2 ${total} (${bandLabel} — ${incompleteNote})`
      : `NEWS2 ${total} (${bandLabel})`,
    spo2Scale: useScale2 ? 2 : 1,
    respirationPoints: rr,
    spo2Points: sp,
    oxygenPoints: o2,
    systolicBPPoints: bp,
    heartRatePoints: hr,
    temperaturePoints: temp,
    consciousnessPoints: cons,
    breakdown,
  };
}
