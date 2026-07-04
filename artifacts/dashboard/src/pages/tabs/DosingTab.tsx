import { useState, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseNum(s: string): number | null {
  const n = parseFloat(s);
  return isNaN(n) || n <= 0 ? null : n;
}

function round2(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

/** Cockcroft-Gault CrCl (mL/min) */
function calcCrCl(age: number, weightKg: number, creatUmol: number, sex: 'M' | 'F'): number {
  const creatMg = creatUmol / 88.42;
  const base = ((140 - age) * weightKg) / (72 * creatMg);
  return sex === 'F' ? base * 0.85 : base;
}

/** IBW — Devine formula (kg) */
function calcIBW(heightCm: number, sex: 'M' | 'F'): number {
  const inchesOver5ft = (heightCm / 2.54) - 60;
  const base = sex === 'M' ? 50 : 45.5;
  return base + 2.3 * inchesOver5ft;
}

/** Adjusted Body Weight (for obesity dosing) */
function calcABW(actualKg: number, ibwKg: number): number {
  return ibwKg + 0.4 * (actualKg - ibwKg);
}

/** BMI */
function calcBMI(weightKg: number, heightCm: number): number {
  const h = heightCm / 100;
  return weightKg / (h * h);
}

// ─── Opioid equianalgesic table ───────────────────────────────────────────────

interface Opioid {
  name: string;
  oralMg: number;       // oral mg equivalent to 10 mg oral morphine
  ivMg: number | null;  // IV mg equivalent; null = route not standard
  note?: string;
}

const OPIOIDS: Opioid[] = [
  { name: 'Morphine (oral)', oralMg: 10, ivMg: null },
  { name: 'Morphine (IV/SC)', oralMg: 30, ivMg: 10 },
  { name: 'Oxycodone (oral)', oralMg: 6.67, ivMg: null, note: '10 mg oral oxycodone ≈ 15 mg oral morphine' },
  { name: 'Codeine (oral)', oralMg: 100, ivMg: null, note: '~10% converted to morphine; weak' },
  { name: 'Tramadol (oral)', oralMg: 100, ivMg: null, note: 'Ceiling effect; weak opioid' },
  { name: 'Fentanyl (IV/SC mcg)', oralMg: null as unknown as number, ivMg: null, note: '100 mcg IV fentanyl ≈ 10 mg IV morphine' },
  { name: 'Hydromorphone (oral)', oralMg: 1.5, ivMg: null, note: '≈ 6.7:1 potency ratio to oral morphine' },
  { name: 'Hydromorphone (IV)', oralMg: null as unknown as number, ivMg: 1.5, note: '1.5 mg IV hydro ≈ 10 mg IV morphine' },
];

// Conversion to oral morphine equivalents per given dose
function toOME(opioidName: string, doseMg: number): number | null {
  if (opioidName === 'Morphine (oral)') return doseMg;
  if (opioidName === 'Morphine (IV/SC)') return doseMg * 3;
  if (opioidName === 'Oxycodone (oral)') return doseMg * 1.5;
  if (opioidName === 'Codeine (oral)') return doseMg * 0.1;
  if (opioidName === 'Tramadol (oral)') return doseMg * 0.1;
  if (opioidName === 'Hydromorphone (oral)') return doseMg * 6.67;
  if (opioidName === 'Hydromorphone (IV)') return doseMg * 20;
  return null;
}

// ─── Antimicrobial dosing logic ───────────────────────────────────────────────

interface AntimicrobialDose {
  drug: string;
  indication: string;
  dose: string;
  frequency: string;
  notes: string[];
  caution?: string;
}

function enoxaparinDoses(crcl: number, weightKg: number, indication: 'treatment' | 'prophylaxis'): AntimicrobialDose {
  if (indication === 'prophylaxis') {
    if (crcl < 30) {
      return {
        drug: 'Enoxaparin (prophylaxis)', indication: 'VTE Prophylaxis',
        dose: '20 mg SC once daily', frequency: 'OD',
        notes: ['Renal dose reduction: CrCl < 30 mL/min', 'Monitor anti-Xa if available', 'Continue until fully ambulant or per consultant direction'],
        caution: 'Renal impairment — reduced dose',
      };
    }
    return {
      drug: 'Enoxaparin (prophylaxis)', indication: 'VTE Prophylaxis',
      dose: '40 mg SC once daily', frequency: 'OD',
      notes: ['Start 12h pre-op or 6–12h post-op', 'Continue until fully ambulant', 'High-risk patients: consider extended 28-day course post-major surgery'],
    };
  }

  // Treatment
  const dosePerKg = crcl < 30 ? 1.0 : 1.0; // 1 mg/kg BD; renally adjust to 1 mg/kg OD if CrCl<30
  const singleDose = Math.round(weightKg * dosePerKg);
  if (crcl < 30) {
    return {
      drug: 'Enoxaparin (treatment)', indication: 'DVT/PE Treatment',
      dose: `${singleDose} mg SC once daily`, frequency: 'OD',
      notes: [`Weight-based: 1 mg/kg OD (weight: ${weightKg} kg)`, 'CrCl < 30 — once daily dosing', 'Monitor anti-Xa levels at 4h post-dose (target 0.5–1.0 IU/mL)'],
      caution: 'Renal impairment — once-daily dosing; monitor anti-Xa',
    };
  }
  return {
    drug: 'Enoxaparin (treatment)', indication: 'DVT/PE Treatment',
    dose: `${singleDose} mg SC twice daily`, frequency: 'BD',
    notes: [`Weight-based: 1 mg/kg BD (weight: ${weightKg} kg)`, 'Max single dose typically 100 mg (obese: use ABW if BMI > 40)'],
  };
}

function gentamicinDose(weightKg: number, ibw: number, crcl: number, age: number): AntimicrobialDose {
  const dosingWeight = weightKg > ibw * 1.2 ? ibw + 0.4 * (weightKg - ibw) : weightKg;
  const dose = Math.round(dosingWeight * 5); // 5 mg/kg extended-interval

  let interval = '24h';
  if (crcl < 20) interval = 'Seek pharmacy / ID advice — contraindicated / extreme caution';
  else if (crcl < 40) interval = '48h';
  else if (crcl < 60) interval = '36h';

  return {
    drug: 'Gentamicin (extended-interval)', indication: 'Gram-negative bacteraemia / serious infection',
    dose: `${dose} mg IV over 30 min`,
    frequency: `Every ${interval}`,
    notes: [
      `Dosing weight: ${round2(dosingWeight)} kg (${weightKg > ibw * 1.2 ? 'ABW used — obese' : 'actual weight'})`,
      'Hartford nomogram: draw level 6–14h post dose; plot on nomogram to confirm interval',
      'Target: Cmax/MIC ≥ 10 (Cmax ~20 mg/L), trough < 1 mg/L',
      age >= 65 ? '⚠ Elderly — heightened ototoxicity & nephrotoxicity risk; limit duration' : 'Monitor U&E, creatinine every 48–72h',
    ],
    caution: crcl < 40 ? 'Significant renal impairment — extended interval required; seek ID advice' : undefined,
  };
}

function vancomycinDose(weightKg: number, crcl: number): AntimicrobialDose {
  const loadDose = Math.min(Math.round(weightKg * 25), 3000);
  let maintDose: string;
  let maintFreq: string;

  if (crcl >= 70) { maintDose = `${Math.round(weightKg * 15)}–${Math.round(weightKg * 20)} mg`; maintFreq = 'Q12h'; }
  else if (crcl >= 50) { maintDose = `${Math.round(weightKg * 10)}–${Math.round(weightKg * 15)} mg`; maintFreq = 'Q24h'; }
  else if (crcl >= 30) { maintDose = `${Math.round(weightKg * 10)} mg`; maintFreq = 'Q24–36h'; }
  else { maintDose = 'Seek pharmacy input'; maintFreq = '— renal dose'; }

  return {
    drug: 'Vancomycin', indication: 'MRSA / gram-positive serious infection',
    dose: `Loading: ${loadDose} mg IV over 1–2h, then ${maintDose} maintenance`,
    frequency: `Loading then ${maintFreq}`,
    notes: [
      'AUC-guided dosing preferred (AUC/MIC target 400–600 mg·h/L)',
      'Trough monitoring acceptable: target 15–20 mg/L for serious infections',
      'Infuse at max 1 g/hr to avoid Red Man Syndrome (vancomycin flushing)',
      crcl < 50 ? '⚠ Renal impairment — increase monitoring frequency' : 'Monitor renal function every 48–72h',
    ],
    caution: crcl < 30 ? 'Severe renal impairment — pharmacy review essential before prescribing' : undefined,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

type AntimicrobialKey = 'enox_prophylaxis' | 'enox_treatment' | 'gentamicin' | 'vancomycin';

export default function DosingTab() {
  const ctx = useAppContext();

  // Patient parameter inputs — pre-populate from ctx
  const [weightStr, setWeightStr] = useState(ctx.weightKg || '');
  const [heightStr, setHeightStr] = useState(ctx.heightCm || '');
  const [ageStr, setAgeStr]       = useState(ctx.age || '');
  const [sexInput, setSexInput]   = useState<'M' | 'F'>(
    ctx.sex === 'male' ? 'M' : ctx.sex === 'female' ? 'F' : 'M'
  );
  const [creatStr, setCreatStr]   = useState(''); // µmol/L

  // Derived patient parameters
  const params = useMemo(() => {
    const wt   = parseNum(weightStr);
    const ht   = parseNum(heightStr);
    const ag   = parseNum(ageStr);
    const cr   = parseNum(creatStr);

    if (!wt || !ht || !ag) return null;

    const ibw  = calcIBW(ht, sexInput);
    const bmi  = calcBMI(wt, ht);
    const abw  = wt > ibw * 1.2 ? calcABW(wt, ibw) : null;
    const crcl = cr ? calcCrCl(ag, abw ?? wt, cr, sexInput) : null;

    return { wt, ht, ag, ibw, bmi, abw, crcl };
  }, [weightStr, heightStr, ageStr, sexInput, creatStr]);

  // Selected antimicrobial
  const [selectedDrug, setSelectedDrug] = useState<AntimicrobialKey>('enox_prophylaxis');

  const antimicrobialResult = useMemo((): AntimicrobialDose | null => {
    if (!params) return null;
    const wt = params.wt;
    const crcl = params.crcl ?? 80; // default if no creatinine entered

    if (selectedDrug === 'enox_prophylaxis') return enoxaparinDoses(crcl, wt, 'prophylaxis');
    if (selectedDrug === 'enox_treatment')  return enoxaparinDoses(crcl, wt, 'treatment');
    if (selectedDrug === 'gentamicin')      return gentamicinDose(wt, params.ibw, crcl, params.ag);
    if (selectedDrug === 'vancomycin')      return vancomycinDose(wt, crcl);
    return null;
  }, [params, selectedDrug]);

  // Opioid converter
  const [opioidFrom, setOpioidFrom] = useState(OPIOIDS[0].name);
  const [opioidDoseStr, setOpioidDoseStr] = useState('');
  const [opioidTo, setOpioidTo] = useState(OPIOIDS[0].name);

  const opioidResult = useMemo(() => {
    const dose = parseNum(opioidDoseStr);
    if (!dose) return null;
    const ome = toOME(opioidFrom, dose);
    if (ome === null) return null;

    // Convert OME to target opioid
    const reverseConvert = (targetName: string, ome: number) => {
      if (targetName === 'Morphine (oral)') return ome;
      if (targetName === 'Morphine (IV/SC)') return ome / 3;
      if (targetName === 'Oxycodone (oral)') return ome / 1.5;
      if (targetName === 'Codeine (oral)') return ome / 0.1;
      if (targetName === 'Tramadol (oral)') return ome / 0.1;
      if (targetName === 'Hydromorphone (oral)') return ome / 6.67;
      if (targetName === 'Hydromorphone (IV)') return ome / 20;
      return null;
    };

    const targetDose = reverseConvert(opioidTo, ome);
    const reducedDose = targetDose ? targetDose * 0.75 : null; // 25% reduction for rotation

    return { ome: Math.round(ome * 10) / 10, targetDose, reducedDose };
  }, [opioidFrom, opioidDoseStr, opioidTo]);

  const crclLabel = params?.crcl
    ? `${round2(params.crcl)} mL/min`
    : creatStr
    ? '—'
    : 'Enter creatinine';

  const ckdStage = (crcl: number | null): string => {
    if (!crcl) return '—';
    if (crcl >= 90) return 'G1 (≥90)';
    if (crcl >= 60) return 'G2 (60–89)';
    if (crcl >= 45) return 'G3a (45–59)';
    if (crcl >= 30) return 'G3b (30–44)';
    if (crcl >= 15) return 'G4 (15–29)';
    return 'G5 (<15)';
  };

  const crclColor = (crcl: number | null): string => {
    if (!crcl) return '#64748b';
    if (crcl >= 60) return '#15803d';
    if (crcl >= 30) return '#b45309';
    return '#dc2626';
  };

  return (
    <div className="gap-y">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ background: '#0f172a', borderRadius: 10, padding: '16px 20px', color: '#fff' }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>Drug Dose Calculator</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
          Weight- and renal-adjusted dosing reference — all calculations must be verified by a clinician
        </div>
      </div>

      {/* ── Patient Parameters ─────────────────────────────────────────── */}
      <CollapsibleCard title="Patient Parameters">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          {/* Weight */}
          <label style={labelStyle}>
            <span style={labelText}>Weight (kg)</span>
            <input style={inputStyle} type="number" min="1" max="300" value={weightStr}
              onChange={e => setWeightStr(e.target.value)} placeholder="e.g. 75" />
          </label>
          {/* Height */}
          <label style={labelStyle}>
            <span style={labelText}>Height (cm)</span>
            <input style={inputStyle} type="number" min="50" max="250" value={heightStr}
              onChange={e => setHeightStr(e.target.value)} placeholder="e.g. 170" />
          </label>
          {/* Age */}
          <label style={labelStyle}>
            <span style={labelText}>Age (years)</span>
            <input style={inputStyle} type="number" min="1" max="120" value={ageStr}
              onChange={e => setAgeStr(e.target.value)} placeholder="e.g. 45" />
          </label>
          {/* Sex */}
          <label style={labelStyle}>
            <span style={labelText}>Sex</span>
            <select style={inputStyle} value={sexInput} onChange={e => setSexInput(e.target.value as 'M' | 'F')}>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
          </label>
          {/* Creatinine */}
          <label style={labelStyle}>
            <span style={labelText}>Serum creatinine (µmol/L)</span>
            <input style={inputStyle} type="number" min="1" max="2000" value={creatStr}
              onChange={e => setCreatStr(e.target.value)} placeholder="e.g. 88" />
          </label>
        </div>

        {params ? (
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
            <StatChip label="BMI" value={round2(params.bmi)} unit="kg/m²"
              color={params.bmi >= 30 ? '#b45309' : '#15803d'} />
            <StatChip label="IBW (Devine)" value={round2(params.ibw)} unit="kg" color="#1d4ed8" />
            {params.abw && <StatChip label="Adj Body Wt" value={round2(params.abw)} unit="kg" color="#7c3aed"
              subtitle="IBW + 0.4×(actual−IBW)" />}
            <StatChip label="CrCl (CG)" value={crclLabel} unit="" color={crclColor(params.crcl)}
              subtitle={`CKD Stage ${ckdStage(params.crcl)}`} />
          </div>
        ) : (
          <div style={{ marginTop: 10, fontSize: 12, color: '#94a3b8' }}>
            Enter weight, height, and age to calculate derived parameters.
          </div>
        )}

        {!creatStr && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#b45309', background: '#fefce8', border: '1px solid #fde047', borderRadius: 6, padding: '6px 10px' }}>
            ⚠ Creatinine not entered — renal dosing adjustments cannot be calculated. Antimicrobial doses will default to CrCl ≥ 60.
          </div>
        )}
      </CollapsibleCard>

      {/* ── Antimicrobial / Anticoagulant Dosing ──────────────────────── */}
      <CollapsibleCard title="Antimicrobial & Anticoagulant Dosing">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {(
            [
              { key: 'enox_prophylaxis', label: 'Enoxaparin — Prophylaxis' },
              { key: 'enox_treatment',   label: 'Enoxaparin — Treatment' },
              { key: 'gentamicin',       label: 'Gentamicin (EI)' },
              { key: 'vancomycin',       label: 'Vancomycin' },
            ] as { key: AntimicrobialKey; label: string }[]
          ).map(opt => (
            <button key={opt.key} type="button"
              onClick={() => setSelectedDrug(opt.key)}
              style={{
                padding: '6px 12px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600,
                background: selectedDrug === opt.key ? '#1d4ed8' : '#f1f5f9',
                color: selectedDrug === opt.key ? '#fff' : '#334155',
                cursor: 'pointer',
              }}>
              {opt.label}
            </button>
          ))}
        </div>

        {!params ? (
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Enter patient parameters above to calculate doses.</div>
        ) : antimicrobialResult ? (
          <AntimicrobialCard result={antimicrobialResult} />
        ) : null}

        <div style={{ marginTop: 12, fontSize: 11, color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 12px' }}>
          <strong>Reference:</strong> BNF, Therapeutic Guidelines, ASHP. Always verify against current local antibiogram and pharmacy guidance. Doses shown are for adults with normal organ function unless otherwise stated.
        </div>
      </CollapsibleCard>

      {/* ── Opioid Equianalgesic Converter ─────────────────────────────── */}
      <CollapsibleCard title="Opioid Equianalgesic Converter">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 1fr', gap: 10, alignItems: 'end' }}>
          <div>
            <label style={labelText}>From</label>
            <select style={{ ...inputStyle, marginTop: 4 }} value={opioidFrom}
              onChange={e => setOpioidFrom(e.target.value)}>
              {OPIOIDS.map(o => (
                <option key={o.name} value={o.name} disabled={o.oralMg === null && o.ivMg === null}>
                  {o.name}
                </option>
              ))}
            </select>
            <label style={{ ...labelText, marginTop: 6 }}>Dose (mg)</label>
            <input style={{ ...inputStyle, marginTop: 4 }} type="number" min="0" step="0.5"
              value={opioidDoseStr} onChange={e => setOpioidDoseStr(e.target.value)} placeholder="e.g. 30" />
          </div>

          <div style={{ textAlign: 'center', fontSize: 22, color: '#94a3b8', paddingBottom: 8 }}>→</div>

          <div>
            <label style={labelText}>To</label>
            <select style={{ ...inputStyle, marginTop: 4 }} value={opioidTo}
              onChange={e => setOpioidTo(e.target.value)}>
              {OPIOIDS.filter(o => o.name !== 'Fentanyl (IV/SC mcg)').map(o => (
                <option key={o.name} value={o.name}>{o.name}</option>
              ))}
            </select>
          </div>
        </div>

        {opioidResult ? (
          <div style={{ marginTop: 14 }}>
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ fontSize: 12, color: '#15803d', fontWeight: 700 }}>Oral Morphine Equivalent (OME)</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#15803d' }}>{opioidResult.ome} mg</div>
            </div>
            {opioidResult.targetDose !== null && opioidTo !== opioidFrom && (
              <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: '#1d4ed8', fontWeight: 700 }}>Direct equivalent dose</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#1d4ed8' }}>
                    {round2(opioidResult.targetDose)} mg
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Equianalgesic (theoretical)</div>
                </div>
                {opioidResult.reducedDose !== null && (
                  <div style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, color: '#854d0e', fontWeight: 700 }}>Rotation dose (−25%)</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#854d0e' }}>
                      {round2(opioidResult.reducedDose)} mg
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Recommended when rotating</div>
                  </div>
                )}
              </div>
            )}
            <div style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>
              Fentanyl special cases: 100 mcg IV fentanyl ≈ 10 mg IV morphine ≈ 30 mg oral morphine.
            </div>
          </div>
        ) : opioidDoseStr ? (
          <div style={{ marginTop: 10, fontSize: 12, color: '#94a3b8' }}>Select a supported opioid to calculate.</div>
        ) : null}

        <div style={{ marginTop: 10, fontSize: 11, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px' }}>
          <strong>Caution:</strong> Equianalgesic conversions are approximate. Reduce by 25–50% when rotating due to incomplete cross-tolerance. Always titrate individually; ensure adequate naloxone access. Codeine is not recommended in post-tonsillectomy / paediatric patients.
        </div>
      </CollapsibleCard>

      {/* ── WHO Analgesic Ladder ────────────────────────────────────────── */}
      <CollapsibleCard title="WHO Analgesic Ladder (Reference)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {WHO_LADDER.map(step => (
            <div key={step.step} style={{
              border: `2px solid ${step.color}20`, borderLeft: `4px solid ${step.color}`,
              borderRadius: 8, padding: '10px 14px', background: `${step.color}08`,
            }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: step.color }}>
                Step {step.step} — {step.severity}
              </div>
              <div style={{ fontSize: 12, color: '#334155', marginTop: 4 }}>
                <strong>Agents:</strong> {step.agents}
              </div>
              {step.examples && (
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  <strong>Examples:</strong> {step.examples}
                </div>
              )}
              {step.note && (
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, fontStyle: 'italic' }}>
                  {step.note}
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: '#64748b' }}>
          Adjuvants (gabapentinoids, tricyclics, SNRIs, ketamine, alpha-2 agonists) may be added at any step. By-the-clock dosing preferred over PRN for persistent pain.
        </div>
      </CollapsibleCard>

    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatChip({ label, value, unit, color, subtitle }: {
  label: string; value: string; unit: string; color: string; subtitle?: string;
}) {
  return (
    <div style={{ background: '#f8fafc', border: `1px solid ${color}40`, borderRadius: 8, padding: '8px 12px' }}>
      <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color, marginTop: 2 }}>
        {value} <span style={{ fontSize: 11, fontWeight: 500 }}>{unit}</span>
      </div>
      {subtitle && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{subtitle}</div>}
    </div>
  );
}

function AntimicrobialCard({ result }: { result: AntimicrobialDose }) {
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px' }}>
      {result.caution && (
        <div style={{ marginBottom: 10, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '6px 12px', fontSize: 12, color: '#dc2626', fontWeight: 600 }}>
          ⚠ {result.caution}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Dose</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{result.dose}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Frequency</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1d4ed8', marginTop: 2 }}>{result.frequency}</div>
        </div>
      </div>
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {result.notes.map((n, i) => (
          <div key={i} style={{ fontSize: 12, color: n.startsWith('⚠') ? '#b45309' : '#475569', display: 'flex', gap: 6 }}>
            <span style={{ color: '#94a3b8', flexShrink: 0 }}>•</span>
            <span>{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── WHO Ladder data ──────────────────────────────────────────────────────────

const WHO_LADDER = [
  {
    step: 1, severity: 'Mild pain', color: '#15803d',
    agents: 'Non-opioid ± adjuvant',
    examples: 'Paracetamol 1 g QDS; Ibuprofen 400 mg TDS (with food); Naproxen 500 mg BD',
    note: 'Avoid NSAIDs post-op (anastomosis, renal impairment, peptic ulcer history, anticoagulation)',
  },
  {
    step: 2, severity: 'Mild–moderate pain', color: '#b45309',
    agents: 'Weak opioid ± non-opioid ± adjuvant',
    examples: 'Codeine 30–60 mg QDS; Tramadol 50–100 mg QDS (max 400 mg/day); Dihydrocodeine 30 mg QDS',
    note: 'Codeine requires CYP2D6 metabolism — high variability; avoid in breastfeeding, post-tonsillectomy',
  },
  {
    step: 3, severity: 'Moderate–severe pain', color: '#dc2626',
    agents: 'Strong opioid ± non-opioid ± adjuvant',
    examples: 'Morphine IR 5–10 mg Q4h; Oxycodone IR 5 mg Q4–6h; Fentanyl patch (stable, chronic only)',
    note: 'Always co-prescribe laxative; consider antiemetic for first 48–72h; naloxone available',
  },
];

// ─── Styles ───────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4,
};
const labelText: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em',
};
const inputStyle: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, color: '#0f172a',
  background: '#fff', width: '100%', boxSizing: 'border-box',
};
