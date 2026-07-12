import { useState, useMemo } from 'react';
import CollapsibleCard from '@/components/CollapsibleCard';

// ─── Types ────────────────────────────────────────────────────────────────────

type AcidBaseDisorder =
  | 'Metabolic Acidosis'
  | 'Metabolic Alkalosis'
  | 'Respiratory Acidosis'
  | 'Respiratory Alkalosis'
  | 'Normal'
  | 'Mixed';

interface AbgResult {
  primary: AcidBaseDisorder;
  isMixed: boolean;
  mixedDetails: string[];
  compensationStatus: 'Appropriately compensated' | 'Over-compensated' | 'Under-compensated' | 'Uncompensated' | 'N/A';
  compensationDetail: string;
  aaGradient: number | null;
  aaStatus: string;
  pfRatio: number | null;
  pfStatus: string;
  oxygenStatus: string;
  severity: 'normal' | 'mild' | 'moderate' | 'severe';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseN(s: string): number | null {
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}
function fmt2(n: number): string { return (Math.round(n * 100) / 100).toFixed(2); }
function fmt1(n: number): string { return (Math.round(n * 10) / 10).toFixed(1); }
function fmtInt(n: number): string { return Math.round(n).toString(); }

// ─── ABG Interpretation ───────────────────────────────────────────────────────

function interpretAbg(
  pH: number,
  paCO2: number,
  hco3: number,
  paO2: number | null,
  fiO2: number,    // 0.21–1.0
  age: number,
  chronic: boolean,
): AbgResult {
  const mixedDetails: string[] = [];

  // ── Primary disorder ──
  let primary: AcidBaseDisorder = 'Normal';
  const acidosis = pH < 7.35;
  const alkalosis = pH > 7.45;
  const respAcid = paCO2 > 45;
  const respAlk  = paCO2 < 35;
  const metAcid  = hco3 < 22;
  const metAlk   = hco3 > 26;

  if (!acidosis && !alkalosis) {
    // pH normal — check for compensated or mixed disorders
    if (respAcid && metAlk) {
      mixedDetails.push('Compensated respiratory acidosis OR mixed respiratory acidosis + metabolic alkalosis');
    } else if (respAlk && metAcid) {
      mixedDetails.push('Compensated respiratory alkalosis OR mixed respiratory alkalosis + metabolic acidosis');
    }
    primary = mixedDetails.length ? 'Mixed' : 'Normal';
  } else if (acidosis) {
    if (respAcid && !metAcid) primary = 'Respiratory Acidosis';
    else if (metAcid && !respAcid) primary = 'Metabolic Acidosis';
    else if (respAcid && metAcid) {
      primary = 'Mixed';
      mixedDetails.push('Mixed respiratory acidosis + metabolic acidosis (pH severely depressed)');
    } else {
      primary = 'Mixed';
    }
  } else {
    // alkalosis
    if (respAlk && !metAlk) primary = 'Respiratory Alkalosis';
    else if (metAlk && !respAlk) primary = 'Metabolic Alkalosis';
    else if (respAlk && metAlk) {
      primary = 'Mixed';
      mixedDetails.push('Mixed respiratory alkalosis + metabolic alkalosis (pH markedly elevated)');
    } else {
      primary = 'Mixed';
    }
  }

  // ── Compensation ──
  let compensationStatus: AbgResult['compensationStatus'] = 'N/A';
  let compensationDetail = '';
  const ΔPCO2 = paCO2 - 40;
  const ΔHCO3 = hco3 - 24;

  if (primary === 'Metabolic Acidosis') {
    // Winters formula: expected PaCO2 = 1.5 × HCO3 + 8 ± 2
    const expectedPCO2Lo = 1.5 * hco3 + 6;
    const expectedPCO2Hi = 1.5 * hco3 + 10;
    compensationDetail = `Expected PaCO₂ = 1.5 × HCO₃⁻ + 8 ± 2 = ${fmt1(expectedPCO2Lo)}–${fmt1(expectedPCO2Hi)} mmHg`;
    if (paCO2 >= expectedPCO2Lo && paCO2 <= expectedPCO2Hi) {
      compensationStatus = 'Appropriately compensated';
    } else if (paCO2 < expectedPCO2Lo) {
      compensationStatus = 'Over-compensated';
      mixedDetails.push('PaCO₂ lower than expected — co-existing respiratory alkalosis');
    } else {
      compensationStatus = 'Under-compensated';
      mixedDetails.push('PaCO₂ higher than expected — co-existing respiratory acidosis');
    }
  } else if (primary === 'Metabolic Alkalosis') {
    // Expected PaCO2 = 40 + 0.7 × ΔHCO3 ± 5 (or 0.7 × HCO3 + 21 ± 2)
    const expectedPCO2 = 40 + 0.7 * ΔHCO3;
    compensationDetail = `Expected PaCO₂ ≈ 40 + 0.7 × ΔHCO₃⁻ = ${fmt1(expectedPCO2)} ± 5 mmHg`;
    if (Math.abs(paCO2 - expectedPCO2) <= 5) {
      compensationStatus = 'Appropriately compensated';
    } else if (paCO2 < expectedPCO2 - 5) {
      compensationStatus = 'Over-compensated';
      mixedDetails.push('PaCO₂ lower than expected — co-existing respiratory alkalosis');
    } else {
      compensationStatus = 'Under-compensated';
      mixedDetails.push('PaCO₂ higher than expected — co-existing respiratory acidosis');
    }
  } else if (primary === 'Respiratory Acidosis') {
    if (chronic) {
      // Chronic: ΔHCO3 ≈ 0.35 × ΔPaCO2 (per 10 mmHg ≈ 3.5 mEq/L)
      const expectedHCO3 = 24 + 0.35 * ΔPCO2;
      compensationDetail = `Chronic: Expected HCO₃⁻ ≈ 24 + 0.35 × ΔPaCO₂ = ${fmt1(expectedHCO3)} ± 3 mEq/L`;
      if (Math.abs(hco3 - expectedHCO3) <= 3) compensationStatus = 'Appropriately compensated';
      else if (hco3 > expectedHCO3 + 3) { compensationStatus = 'Over-compensated'; mixedDetails.push('HCO₃⁻ higher than expected — co-existing metabolic alkalosis'); }
      else { compensationStatus = 'Under-compensated'; mixedDetails.push('HCO₃⁻ lower than expected — co-existing metabolic acidosis'); }
    } else {
      // Acute: ΔHCO3 ≈ 0.1 × ΔPaCO2
      const expectedHCO3 = 24 + 0.1 * ΔPCO2;
      compensationDetail = `Acute: Expected HCO₃⁻ ≈ 24 + 0.1 × ΔPaCO₂ = ${fmt1(expectedHCO3)} ± 3 mEq/L`;
      if (Math.abs(hco3 - expectedHCO3) <= 3) compensationStatus = 'Appropriately compensated';
      else if (hco3 > expectedHCO3 + 3) { compensationStatus = 'Over-compensated'; mixedDetails.push('HCO₃⁻ higher than expected — consider chronic component or metabolic alkalosis'); }
      else { compensationStatus = 'Under-compensated'; mixedDetails.push('HCO₃⁻ lower than expected — co-existing metabolic acidosis'); }
    }
  } else if (primary === 'Respiratory Alkalosis') {
    if (chronic) {
      const expectedHCO3 = 24 + 0.5 * ΔPCO2; // ΔPCO2 is negative
      compensationDetail = `Chronic: Expected HCO₃⁻ ≈ 24 + 0.5 × ΔPaCO₂ = ${fmt1(expectedHCO3)} ± 3 mEq/L`;
      if (Math.abs(hco3 - expectedHCO3) <= 3) compensationStatus = 'Appropriately compensated';
      else if (hco3 < expectedHCO3 - 3) { compensationStatus = 'Over-compensated'; mixedDetails.push('HCO₃⁻ lower than expected — co-existing metabolic acidosis'); }
      else { compensationStatus = 'Under-compensated'; mixedDetails.push('HCO₃⁻ higher than expected — co-existing metabolic alkalosis'); }
    } else {
      const expectedHCO3 = 24 + 0.2 * ΔPCO2;
      compensationDetail = `Acute: Expected HCO₃⁻ ≈ 24 + 0.2 × ΔPaCO₂ = ${fmt1(expectedHCO3)} ± 3 mEq/L`;
      if (Math.abs(hco3 - expectedHCO3) <= 3) compensationStatus = 'Appropriately compensated';
      else if (hco3 < expectedHCO3 - 3) { compensationStatus = 'Over-compensated'; mixedDetails.push('HCO₃⁻ lower than expected — co-existing metabolic acidosis'); }
      else { compensationStatus = 'Under-compensated'; mixedDetails.push('HCO₃⁻ higher than expected — co-existing metabolic alkalosis'); }
    }
  }

  // ── A-a gradient ──
  // PAO2 = FiO2 × (713) - PaCO2 / 0.8  (sea-level, 37°C, saturated water vapour 47 mmHg)
  let aaGradient: number | null = null;
  let aaStatus = '';
  let pfRatio: number | null = null;
  let pfStatus = '';
  let oxygenStatus = '';

  if (paO2 !== null) {
    const pao2Alveolar = fiO2 * 713 - paCO2 / 0.8;
    aaGradient = pao2Alveolar - paO2;
    const normalAa = 2.5 + 0.21 * age;
    if (aaGradient <= normalAa) aaStatus = `Normal (≤ ${fmt1(normalAa)} expected for age ${age})`;
    else if (aaGradient <= 30) aaStatus = `Mildly elevated (normal < ${fmt1(normalAa)} for age)`;
    else if (aaGradient <= 60) aaStatus = 'Moderately elevated — V/Q mismatch or diffusion defect';
    else aaStatus = 'Markedly elevated — severe V/Q mismatch, shunt, or ARDS';

    pfRatio = (paO2 / fiO2);
    if (pfRatio >= 400) { pfStatus = 'Normal'; }
    else if (pfRatio >= 300) { pfStatus = 'Mild hypoxaemia (or mild ARDS if bilateral infiltrates)'; }
    else if (pfRatio >= 200) { pfStatus = 'Moderate ARDS'; }
    else if (pfRatio >= 100) { pfStatus = 'Severe ARDS'; }
    else { pfStatus = 'Critical — P/F < 100'; }

    if (paO2 >= 80) oxygenStatus = 'Normal oxygenation';
    else if (paO2 >= 60) oxygenStatus = 'Mild hypoxaemia (60–79 mmHg)';
    else if (paO2 >= 40) oxygenStatus = 'Moderate hypoxaemia (40–59 mmHg)';
    else oxygenStatus = 'Severe hypoxaemia (< 40 mmHg)';
  }

  // ── Overall severity ──
  let severity: AbgResult['severity'] = 'normal';
  if (pH < 7.1 || pH > 7.7) severity = 'severe';
  else if (pH < 7.2 || pH > 7.6) severity = 'moderate';
  else if (pH < 7.35 || pH > 7.45) severity = 'mild';

  const isMixed = primary === 'Mixed' || mixedDetails.length > 0;

  return { primary, isMixed, mixedDetails, compensationStatus, compensationDetail, aaGradient, aaStatus, pfRatio, pfStatus, oxygenStatus, severity };
}

// ─── Anion Gap ────────────────────────────────────────────────────────────────

interface AgResult {
  ag: number;
  agCorrected: number | null;
  agStatus: string;
  deltaDelta: number | null;
  deltaDeltaInterpretation: string;
  hagmaDdx: string[];
  nagmaDdx: string[];
}

function calcAnionGap(
  na: number, cl: number, hco3: number,
  albumin: number | null,
): AgResult {
  const ag = na - cl - hco3;
  const agCorrected = albumin !== null ? ag + 2.5 * (4 - albumin) : null;
  const effectiveAg = agCorrected ?? ag;
  const agHigh = effectiveAg > 12;

  const agStatus = agHigh
    ? `Elevated (${agCorrected ? 'corrected ' : ''}AG = ${fmt1(effectiveAg)}) — High Anion Gap Metabolic Acidosis (HAGMA)`
    : `Normal (${agCorrected ? 'corrected ' : ''}AG = ${fmt1(effectiveAg)}) — consider Non-Anion Gap Metabolic Acidosis (NAGMA) or normal`;

  let deltaDelta: number | null = null;
  let deltaDeltaInterpretation = '';

  if (agHigh && hco3 < 22) {
    deltaDelta = (effectiveAg - 12) / (24 - hco3);
    if (deltaDelta < 1) {
      deltaDeltaInterpretation = 'Δ/Δ < 1: Concurrent non-AG metabolic acidosis (HAGMA + NAGMA)';
    } else if (deltaDelta <= 2) {
      deltaDeltaInterpretation = 'Δ/Δ 1–2: Pure HAGMA (expected)';
    } else {
      deltaDeltaInterpretation = 'Δ/Δ > 2: HAGMA + concurrent metabolic alkalosis';
    }
  }

  const hagmaDdx = [
    'Lactic acidosis (sepsis, ischaemia, metformin, cyanide)',
    'Ketoacidosis (DKA, starvation, alcohol)',
    'Uraemia / renal failure',
    'Salicylate toxicity',
    'Methanol / ethylene glycol ingestion',
    'Oxoproline (paracetamol-associated)',
  ];
  const nagmaDdx = [
    'Diarrhoea / GI bicarbonate loss',
    'Renal tubular acidosis (Type 1, 2, 4)',
    'Ureteroenterostomy / urinary diversion',
    'Post-hypocapnia',
    'Addison\'s disease / hypoaldosteronism',
    'Normal saline excess (hyperchloraemic)',
  ];

  return { ag, agCorrected, agStatus, deltaDelta, deltaDeltaInterpretation, hagmaDdx, nagmaDdx };
}

// ─── Electrolyte correctors ───────────────────────────────────────────────────

// Corrected calcium (mmol/L) for hypoalbuminaemia
// Formula: Ca_corrected = Ca_measured + 0.02 × (40 − albumin_g/L)
function correctedCalcium(ca: number, albumin: number): number {
  return ca + 0.02 * (40 - albumin);
}

// Corrected sodium (mmol/L) for hyperglycaemia
// Formula: Na_corrected = Na_measured + 0.3 × (glucose − 5.5)   [glucose in mmol/L]
function correctedSodium(na: number, glucose: number): number {
  return na + 0.3 * (glucose - 5.5);
}

// Calculated serum osmolality (mOsm/kg) — all values in mmol/L
// Posm = 2 × Na + glucose + urea
function calcOsmolality(na: number, glucose: number, urea: number): number {
  return 2 * na + glucose + urea;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BloodGasTab() {
  // ── ABG inputs ──
  const [pH, setPH]           = useState('');
  const [pco2, setPco2]       = useState('');
  const [hco3, setHco3]       = useState('');
  const [po2, setPo2]         = useState('');
  const [fiO2Str, setFiO2]    = useState('0.21');
  const [ageStr, setAgeStr]   = useState('');
  const [chronic, setChronic] = useState(false);

  // ── Anion Gap inputs ──
  const [naStr, setNaStr]     = useState('');
  const [clStr, setClStr]     = useState('');
  const [hco3AgStr, setHco3AgStr] = useState('');
  const [albStr, setAlbStr]   = useState('');

  // ── Electrolyte correctors ──
  const [caNaStr, setCaNaStr] = useState(''); // Na for Ca correction
  const [caAlbStr, setCaAlbStr] = useState(''); // albumin
  const [caMeasStr, setCaMeasStr] = useState(''); // measured Ca
  const [caNaCorrStr, setCaNaCorrStr] = useState(''); // Na for sodium correction
  const [gluStr, setGluStr]   = useState('');
  const [ureaStr, setUreaStr] = useState('');
  const [measOsmStr, setMeasOsmStr] = useState('');

  // ── Derived: ABG ──
  const abgResult = useMemo(() => {
    const phN  = parseN(pH);
    const pco2N = parseN(pco2);
    const hco3N = parseN(hco3);
    const po2N  = parseN(po2);
    const fiO2N = parseN(fiO2Str);
    const ageN  = parseN(ageStr) ?? 40;
    if (phN === null || pco2N === null || hco3N === null || fiO2N === null) return null;
    return interpretAbg(phN, pco2N, hco3N, po2N, Math.min(Math.max(fiO2N, 0.21), 1.0), ageN, chronic);
  }, [pH, pco2, hco3, po2, fiO2Str, ageStr, chronic]);

  // ── Derived: Anion Gap ──
  const agResult = useMemo(() => {
    const na  = parseN(naStr);
    const cl  = parseN(clStr);
    const hco = parseN(hco3AgStr);
    const alb = parseN(albStr);
    if (na === null || cl === null || hco === null) return null;
    return calcAnionGap(na, cl, hco, alb);
  }, [naStr, clStr, hco3AgStr, albStr]);

  // ── Derived: electrolytes ──
  const caCorrected = useMemo(() => {
    const ca = parseN(caMeasStr);
    const alb = parseN(caAlbStr);
    if (ca === null || alb === null) return null;
    return correctedCalcium(ca, alb);
  }, [caMeasStr, caAlbStr]);

  const naCorrected = useMemo(() => {
    const na = parseN(caNaCorrStr);
    const glu = parseN(gluStr);
    if (na === null || glu === null) return null;
    return correctedSodium(na, glu);
  }, [caNaCorrStr, gluStr]);

  const osmCalc = useMemo(() => {
    const na = parseN(naStr || caNaCorrStr);
    const glu = parseN(gluStr);
    const urea = parseN(ureaStr);
    if (na === null || glu === null || urea === null) return null;
    const calc = calcOsmolality(na, glu, urea);
    const meas = parseN(measOsmStr);
    const osmGap = meas !== null ? meas - calc : null;
    return { calc, osmGap };
  }, [naStr, caNaCorrStr, gluStr, ureaStr, measOsmStr]);

  const severityColor: Record<string, string> = {
    normal: '#15803d', mild: '#b45309', moderate: '#b45309', severe: '#dc2626',
  };
  const compColor: Record<string, string> = {
    'Appropriately compensated': '#15803d',
    'Over-compensated': '#7c3aed',
    'Under-compensated': '#b45309',
    'Uncompensated': '#dc2626',
    'N/A': '#64748b',
  };
  const disorderColor: Record<string, string> = {
    'Normal': '#15803d',
    'Metabolic Acidosis': '#dc2626',
    'Metabolic Alkalosis': '#1d4ed8',
    'Respiratory Acidosis': '#b45309',
    'Respiratory Alkalosis': '#7c3aed',
    'Mixed': '#dc2626',
  };

  return (
    <div className="gap-y">

      {/* Header */}
      <div style={{ background: '#0f172a', borderRadius: 10, padding: '16px 20px', color: '#fff' }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>Blood Gas & Acid-Base Interpreter</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
          ABG interpretation · Anion gap · Delta-delta · Electrolyte correctors — clinical verification required
        </div>
      </div>

      {/* ── ABG Interpreter ─────────────────────────────────────────────── */}
      <CollapsibleCard title="Arterial Blood Gas Interpretation">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 12 }}>
          <Field label="pH">
            <input style={inp} type="number" step="0.01" min="6.5" max="8.0"
              value={pH} onChange={e => setPH(e.target.value)} placeholder="7.35–7.45" />
          </Field>
          <Field label="PaCO₂ (mmHg)">
            <input style={inp} type="number" step="0.5" min="10" max="120"
              value={pco2} onChange={e => setPco2(e.target.value)} placeholder="35–45" />
          </Field>
          <Field label="HCO₃⁻ (mEq/L)">
            <input style={inp} type="number" step="0.5" min="5" max="55"
              value={hco3} onChange={e => setHco3(e.target.value)} placeholder="22–26" />
          </Field>
          <Field label="PaO₂ (mmHg)">
            <input style={inp} type="number" step="1" min="20" max="600"
              value={po2} onChange={e => setPo2(e.target.value)} placeholder="80–100" />
          </Field>
          <Field label="FiO₂ (0.21–1.0)">
            <input style={inp} type="number" step="0.01" min="0.21" max="1.0"
              value={fiO2Str} onChange={e => setFiO2(e.target.value)} placeholder="0.21" />
          </Field>
          <Field label="Patient age (yr)">
            <input style={inp} type="number" min="1" max="120"
              value={ageStr} onChange={e => setAgeStr(e.target.value)} placeholder="for A-a" />
          </Field>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 14, fontSize: 13, color: '#334155' }}>
          <input type="checkbox" checked={chronic} onChange={e => setChronic(e.target.checked)} style={{ width: 15, height: 15 }} />
          <span>Chronic respiratory disorder (use chronic compensation formulas)</span>
        </label>

        {abgResult ? (
          <>
            {/* Primary result */}
            <div style={{
              background: abgResult.severity === 'normal' ? '#f0fdf4' : abgResult.severity === 'severe' ? '#fef2f2' : '#fefce8',
              border: `2px solid ${severityColor[abgResult.severity]}30`,
              borderLeft: `4px solid ${severityColor[abgResult.severity]}`,
              borderRadius: 10, padding: '14px 18px', marginBottom: 10,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Primary Disorder</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: disorderColor[abgResult.primary] || '#0f172a' }}>
                    {abgResult.primary}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Compensation</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: compColor[abgResult.compensationStatus] }}>
                    {abgResult.compensationStatus}
                  </div>
                </div>
              </div>
              {abgResult.compensationDetail && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#475569', background: '#fff8', borderRadius: 6, padding: '6px 10px' }}>
                  {abgResult.compensationDetail}
                </div>
              )}
            </div>

            {/* Mixed disorder details */}
            {abgResult.isMixed && abgResult.mixedDetails.length > 0 && (
              <div style={{ marginBottom: 10, background: '#fdf4ff', border: '1px solid #e9d5ff', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', marginBottom: 4 }}>⚠ Mixed Disorder / Additional Component</div>
                {abgResult.mixedDetails.map((d, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#4c1d95' }}>• {d}</div>
                ))}
              </div>
            )}

            {/* Oxygenation row */}
            {abgResult.pfRatio !== null && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, marginBottom: 10 }}>
                <SmallChip label="PaO₂ status" value={abgResult.oxygenStatus}
                  color={abgResult.oxygenStatus.startsWith('Normal') ? '#15803d' : '#dc2626'} />
                <SmallChip label={`P/F ratio (PaO₂/FiO₂)`} value={`${fmtInt(abgResult.pfRatio!)}`}
                  color={abgResult.pfRatio! >= 400 ? '#15803d' : abgResult.pfRatio! >= 200 ? '#b45309' : '#dc2626'}
                  sub={abgResult.pfStatus} />
                {abgResult.aaGradient !== null && (
                  <SmallChip label="A-a gradient" value={`${fmt1(abgResult.aaGradient)} mmHg`}
                    color={abgResult.aaStatus.startsWith('Normal') ? '#15803d' : '#b45309'}
                    sub={abgResult.aaStatus} />
                )}
              </div>
            )}

            {/* Normal reference */}
            <div style={{ fontSize: 11, color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 12px' }}>
              Normal: pH 7.35–7.45 · PaCO₂ 35–45 mmHg · HCO₃⁻ 22–26 mEq/L · PaO₂ 80–100 mmHg (room air) · BE ±2
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Enter pH, PaCO₂, and HCO₃⁻ to interpret.</div>
        )}
      </CollapsibleCard>

      {/* ── Anion Gap ───────────────────────────────────────────────────── */}
      <CollapsibleCard title="Anion Gap & Delta-Delta Ratio">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 12 }}>
          <Field label="Na⁺ (mmol/L)">
            <input style={inp} type="number" min="100" max="180" value={naStr}
              onChange={e => setNaStr(e.target.value)} placeholder="135–145" />
          </Field>
          <Field label="Cl⁻ (mmol/L)">
            <input style={inp} type="number" min="70" max="140" value={clStr}
              onChange={e => setClStr(e.target.value)} placeholder="95–105" />
          </Field>
          <Field label="HCO₃⁻ (mEq/L)">
            <input style={inp} type="number" min="5" max="55" value={hco3AgStr}
              onChange={e => setHco3AgStr(e.target.value)} placeholder="22–26" />
          </Field>
          <Field label="Albumin (g/dL) — optional">
            <input style={inp} type="number" step="0.1" min="1" max="6" value={albStr}
              onChange={e => setAlbStr(e.target.value)} placeholder="4.0" />
          </Field>
        </div>

        {agResult ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, marginBottom: 10 }}>
              <SmallChip label="Anion Gap" value={`${fmt1(agResult.ag)} mEq/L`}
                color={agResult.ag > 12 ? '#dc2626' : '#15803d'} />
              {agResult.agCorrected !== null && (
                <SmallChip label="Corrected AG (albumin)" value={`${fmt1(agResult.agCorrected)} mEq/L`}
                  color={agResult.agCorrected > 12 ? '#dc2626' : '#15803d'}
                  sub="AG + 2.5 × (4 − alb)" />
              )}
              {agResult.deltaDelta !== null && (
                <SmallChip label="Δ/Δ ratio" value={fmt2(agResult.deltaDelta)}
                  color={agResult.deltaDelta >= 1 && agResult.deltaDelta <= 2 ? '#15803d' : '#b45309'}
                  sub={agResult.deltaDeltaInterpretation} />
              )}
            </div>

            <div style={{ fontSize: 12, color: '#334155', marginBottom: 10 }}>
              <span style={{ fontWeight: 700 }}>Interpretation: </span>{agResult.agStatus}
            </div>

            {agResult.deltaDelta !== null && (
              <div style={{ fontSize: 12, color: '#475569', marginBottom: 10 }}>
                <span style={{ fontWeight: 600 }}>Δ/Δ: </span>{agResult.deltaDeltaInterpretation}
              </div>
            )}

            {agResult.ag > 12 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>HAGMA Differential (MUDPILES)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                  {agResult.hagmaDdx.map(d => <div key={d} style={{ fontSize: 11, color: '#7f1d1d' }}>• {d}</div>)}
                </div>
              </div>
            )}
            {agResult.ag <= 12 && (agResult.agCorrected === null || agResult.agCorrected <= 12) && (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', marginBottom: 6 }}>NAGMA Differential (USED CARP)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                  {agResult.nagmaDdx.map(d => <div key={d} style={{ fontSize: 11, color: '#1e3a8a' }}>• {d}</div>)}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Enter Na⁺, Cl⁻, and HCO₃⁻ to calculate.</div>
        )}
      </CollapsibleCard>

      {/* ── Electrolyte Correctors ───────────────────────────────────────── */}
      <CollapsibleCard title="Electrolyte Correctors & Osmolality">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Corrected calcium */}
          <div>
            <div style={sectionLabel}>Corrected Calcium (for hypoalbuminaemia)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <Field label="Measured Ca (mmol/L)">
                <input style={inp} type="number" step="0.01" min="0.5" max="5"
                  value={caMeasStr} onChange={e => setCaMeasStr(e.target.value)} placeholder="2.1–2.6" />
              </Field>
              <Field label="Albumin (g/L)">
                <input style={inp} type="number" step="1" min="5" max="60"
                  value={caAlbStr} onChange={e => setCaAlbStr(e.target.value)} placeholder="35–50" />
              </Field>
            </div>
            {caCorrected !== null ? (
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontSize: 11, color: '#15803d', fontWeight: 700 }}>Corrected Ca = {fmt2(caCorrected)} mmol/L</div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                  Ca + 0.02 × (40 − albumin). Normal 2.1–2.6 mmol/L.
                  {caCorrected > 2.6 ? ' → Hypercalcaemia despite low albumin' : caCorrected < 2.1 ? ' → True hypocalcaemia' : ' → Within normal range'}
                </div>
              </div>
            ) : <div style={{ fontSize: 11, color: '#94a3b8' }}>Enter measured Ca and albumin.</div>}
          </div>

          {/* Corrected sodium */}
          <div>
            <div style={sectionLabel}>Corrected Sodium (for hyperglycaemia)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <Field label="Measured Na (mmol/L)">
                <input style={inp} type="number" min="100" max="180"
                  value={caNaCorrStr} onChange={e => setCaNaCorrStr(e.target.value)} placeholder="135–145" />
              </Field>
              <Field label="Glucose (mmol/L)">
                <input style={inp} type="number" step="0.1" min="1" max="100"
                  value={gluStr} onChange={e => setGluStr(e.target.value)} placeholder="3.5–5.5" />
              </Field>
            </div>
            {naCorrected !== null ? (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontSize: 11, color: '#1d4ed8', fontWeight: 700 }}>Corrected Na = {fmt2(naCorrected)} mmol/L</div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                  Na + 0.3 × (glucose − 5.5). Applies when glucose &gt; 5.5 mmol/L.
                  {naCorrected > 145 ? ' → True hypernatraemia' : naCorrected < 135 ? ' → Dilutional hyponatraemia' : ' → Normonatraemia when corrected'}
                </div>
              </div>
            ) : <div style={{ fontSize: 11, color: '#94a3b8' }}>Enter Na and glucose.</div>}
          </div>
        </div>

        {/* Osmolality */}
        <div style={{ marginTop: 14 }}>
          <div style={sectionLabel}>Serum Osmolality & Osmol Gap</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginBottom: 8 }}>
            <Field label="Na⁺ (mmol/L)">
              <input style={inp} type="number" min="100" max="180"
                value={naStr || caNaCorrStr} readOnly={!!naStr}
                onChange={e => { if (!naStr) setCaNaCorrStr(e.target.value); }} placeholder="use AG Na above" />
            </Field>
            <Field label="Glucose (mmol/L)">
              <input style={inp} type="number" step="0.1" min="1" max="100"
                value={gluStr} onChange={e => setGluStr(e.target.value)} placeholder="3.5–5.5" />
            </Field>
            <Field label="Urea (mmol/L)">
              <input style={inp} type="number" step="0.1" min="1" max="60"
                value={ureaStr} onChange={e => setUreaStr(e.target.value)} placeholder="2.5–7.5" />
            </Field>
            <Field label="Measured Osm (optional)">
              <input style={inp} type="number" min="200" max="500"
                value={measOsmStr} onChange={e => setMeasOsmStr(e.target.value)} placeholder="280–300" />
            </Field>
          </div>
          {osmCalc !== null ? (
            <div style={{ display: 'grid', gridTemplateColumns: osmCalc.osmGap !== null ? '1fr 1fr' : '1fr', gap: 8 }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>Calculated Osmolality</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{fmtInt(osmCalc.calc)} mOsm/kg</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>2×Na + glucose + urea. Normal 280–300 mOsm/kg</div>
              </div>
              {osmCalc.osmGap !== null && (
                <div style={{
                  background: osmCalc.osmGap > 10 ? '#fef2f2' : '#f0fdf4',
                  border: `1px solid ${osmCalc.osmGap > 10 ? '#fca5a5' : '#86efac'}`,
                  borderRadius: 8, padding: '8px 12px',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: osmCalc.osmGap > 10 ? '#dc2626' : '#15803d' }}>Osmol Gap</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: osmCalc.osmGap > 10 ? '#dc2626' : '#15803d' }}>
                    {fmt1(osmCalc.osmGap)} mOsm/kg
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>
                    {osmCalc.osmGap > 10
                      ? '⚠ Elevated (>10) — consider toxic alcohols (methanol, ethylene glycol), mannitol, severe uraemia'
                      : 'Normal (< 10)'}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Enter Na, glucose, and urea to calculate osmolality.</div>
          )}
        </div>
      </CollapsibleCard>

      {/* ── Quick Reference ──────────────────────────────────────────────── */}
      <CollapsibleCard title="Compensation Formulas (Quick Reference)">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
          {COMPENSATION_REFS.map(r => (
            <div key={r.disorder} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>{r.disorder}</div>
              {r.formulas.map(f => (
                <div key={f} style={{ fontSize: 11, color: '#334155', marginBottom: 2 }}>• {f}</div>
              ))}
            </div>
          ))}
        </div>
      </CollapsibleCard>

    </div>
  );
}

// ─── Quick reference data ─────────────────────────────────────────────────────

const COMPENSATION_REFS = [
  {
    disorder: 'Metabolic Acidosis',
    formulas: [
      'Winters: expected PaCO₂ = 1.5 × HCO₃⁻ + 8 ± 2',
      'Min PaCO₂ ≈ HCO₃⁻ (rule of thumb)',
    ],
  },
  {
    disorder: 'Metabolic Alkalosis',
    formulas: [
      'Expected PaCO₂ = 40 + 0.7 × ΔHCO₃⁻ ± 5',
      'Max PaCO₂ compensation ≈ 55–60 mmHg',
    ],
  },
  {
    disorder: 'Respiratory Acidosis (acute)',
    formulas: [
      'Expected ΔHCO₃⁻ = 0.1 × ΔPaCO₂',
      'pH drops ~0.08 per 10 mmHg rise in PaCO₂',
    ],
  },
  {
    disorder: 'Respiratory Acidosis (chronic)',
    formulas: [
      'Expected ΔHCO₃⁻ = 0.35 × ΔPaCO₂',
      'pH drops ~0.03 per 10 mmHg rise in PaCO₂',
    ],
  },
  {
    disorder: 'Respiratory Alkalosis (acute)',
    formulas: [
      'Expected ΔHCO₃⁻ = 0.2 × ΔPaCO₂ (−ve)',
      'pH rises ~0.08 per 10 mmHg fall in PaCO₂',
    ],
  },
  {
    disorder: 'Respiratory Alkalosis (chronic)',
    formulas: [
      'Expected ΔHCO₃⁻ = 0.5 × ΔPaCO₂ (−ve)',
      'pH rises ~0.03 per 10 mmHg fall in PaCO₂',
    ],
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      {children}
    </label>
  );
}

function SmallChip({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={{ background: '#f8fafc', border: `1px solid ${color}30`, borderRadius: 8, padding: '8px 12px' }}>
      <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2, lineHeight: 1.3 }}>{sub}</div>}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1',
  fontSize: 13, color: '#0f172a', background: '#fff', width: '100%', boxSizing: 'border-box',
};
const sectionLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#475569',
  textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8,
};
