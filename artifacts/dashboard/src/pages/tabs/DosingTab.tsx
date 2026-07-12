import { useState, useMemo, useCallback } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseNum(s: string): number | null {
  const n = parseFloat(s);
  return isNaN(n) || n <= 0 ? null : n;
}
function round1(n: number): string { return (Math.round(n * 10) / 10).toFixed(1); }
function round0(n: number): number { return Math.round(n); }

function calcCrCl(age: number, weightKg: number, creatUmol: number, sex: 'M' | 'F'): number {
  const creatMg = creatUmol / 88.42;
  const base = ((140 - age) * weightKg) / (72 * creatMg);
  return sex === 'F' ? base * 0.85 : base;
}
function calcIBW(heightCm: number, sex: 'M' | 'F'): number {
  const inchesOver5ft = (heightCm / 2.54) - 60;
  return (sex === 'M' ? 50 : 45.5) + 2.3 * inchesOver5ft;
}
function calcBMI(weightKg: number, heightCm: number): number {
  const h = heightCm / 100; return weightKg / (h * h);
}

// ─── Pain order data ──────────────────────────────────────────────────────────

interface MedOption {
  id: string;
  drug: string;
  dose: string;
  route: string;
  frequency: string;
  warn?: string;
  note?: string;
}

const STEP1: MedOption[] = [
  { id: 'paracetamol', drug: 'Paracetamol',   dose: '1 g',        route: 'PO',    frequency: 'QDS',             note: 'Max 4 g/day. Safe post-op.' },
  { id: 'ibuprofen',   drug: 'Ibuprofen',      dose: '400 mg',     route: 'PO',    frequency: 'TDS (with food)', warn: 'Avoid: post-op anastomosis, CKD, peptic ulcer, anticoagulation' },
  { id: 'naproxen',    drug: 'Naproxen',       dose: '500 mg',     route: 'PO',    frequency: 'BD (with food)',  warn: 'Avoid: CKD, CVD, GI history' },
  { id: 'ketorolac',   drug: 'Ketorolac',      dose: '15–30 mg',   route: 'IV/IM', frequency: 'Q6h (max 5 days)', warn: 'Short-term only; avoid CKD/GI risk' },
];

const STEP2: MedOption[] = [
  { id: 'codeine',     drug: 'Codeine',         dose: '30–60 mg',   route: 'PO',    frequency: 'QDS PRN',         warn: 'CYP2D6 variable; avoid post-tonsillectomy / breastfeeding' },
  { id: 'tramadol',    drug: 'Tramadol',        dose: '50–100 mg',  route: 'PO',    frequency: 'QDS PRN',         warn: 'Max 400 mg/day. Lowers seizure threshold. Avoid MAOIs.' },
  { id: 'dhc',         drug: 'Dihydrocodeine',  dose: '30 mg',      route: 'PO',    frequency: 'QDS PRN',         note: 'Max 120 mg/day' },
];

const STEP3: MedOption[] = [
  { id: 'morphine_po', drug: 'Morphine IR',     dose: '5–10 mg',    route: 'PO',    frequency: 'Q4h PRN',         note: 'Start low, titrate. Co-prescribe laxative.' },
  { id: 'morphine_sc', drug: 'Morphine SC',     dose: '2.5–5 mg',   route: 'SC',    frequency: 'Q4h PRN',         note: 'Monitor RR / sedation score.' },
  { id: 'morphine_iv', drug: 'Morphine IV',     dose: '1–2.5 mg',   route: 'IV',    frequency: 'Q4h PRN (slow)',  warn: 'Titrate in 1–2 mg increments. Monitor RR.' },
  { id: 'oxycodone',   drug: 'Oxycodone IR',    dose: '5 mg',       route: 'PO',    frequency: 'Q4–6h PRN',       note: 'Step up from morphine oral if tolerated.' },
];

const ADJUVANTS: MedOption[] = [
  { id: 'ondansetron', drug: 'Ondansetron',     dose: '4 mg',       route: 'IV / PO', frequency: 'TDS PRN',       note: 'Antiemetic — first 48–72 h with opioids.' },
  { id: 'metoclopramide', drug: 'Metoclopramide', dose: '10 mg',    route: 'IV / PO', frequency: 'TDS PRN',       note: 'Avoid if bowel obstruction suspected.' },
  { id: 'lactulose',   drug: 'Lactulose',        dose: '15 mL',     route: 'PO',    frequency: 'BD',              note: 'Mandatory laxative with any opioid.' },
  { id: 'naloxone',    drug: 'Naloxone (rescue)', dose: '400 mcg', route: 'IV/IM', frequency: 'PRN — repeat Q2–3 min, max 10 mg', warn: 'Must be available whenever opioids prescribed.' },
  { id: 'gabapentin',  drug: 'Gabapentin',       dose: '100–300 mg', route: 'PO',  frequency: 'TDS',             note: 'Neuropathic adjuvant. Titrate slowly. Renal dose if CKD.' },
];

// ─── Antimicrobial / anticoagulant orders ─────────────────────────────────────

interface AntibioticOrder {
  id: string;
  drug: string;
  getDose: (wt: number, crcl: number, ibw: number, age: number) => { dose: string; frequency: string; note: string; caution?: string };
}

const ANTIBIOTIC_ORDERS: AntibioticOrder[] = [
  {
    id: 'enox_px',
    drug: 'Enoxaparin — VTE Prophylaxis',
    getDose: (_wt, crcl) => crcl < 30
      ? { dose: '20 mg SC', frequency: 'OD', note: 'Reduced dose: CrCl < 30. Monitor anti-Xa.', caution: 'Renal impairment' }
      : { dose: '40 mg SC', frequency: 'OD', note: 'Start 12 h pre-op or 6–12 h post-op. Continue until ambulant.' },
  },
  {
    id: 'enox_tx',
    drug: 'Enoxaparin — DVT/PE Treatment',
    getDose: (wt, crcl) => {
      const dose = round0(wt * 1);
      return crcl < 30
        ? { dose: `${dose} mg SC`, frequency: 'OD (renal adj.)', note: `1 mg/kg OD. CrCl < 30. Monitor anti-Xa (target 0.5–1.0 IU/mL).`, caution: 'Renal impairment — once daily' }
        : { dose: `${dose} mg SC`, frequency: 'BD', note: `1 mg/kg BD. Wt: ${wt} kg. Max single dose ~100 mg.` };
    },
  },
  {
    id: 'gent',
    drug: 'Gentamicin — Extended Interval',
    getDose: (wt, crcl, ibw, age) => {
      const dw = wt > ibw * 1.2 ? ibw + 0.4 * (wt - ibw) : wt;
      const dose = round0(dw * 5);
      const interval = crcl < 20 ? 'SEEK PHARMACY — contraindicated'
        : crcl < 40 ? 'Q48h'
        : crcl < 60 ? 'Q36h'
        : 'Q24h';
      return {
        dose: `${dose} mg IV over 30 min`,
        frequency: interval,
        note: `Dosing wt: ${round1(dw)} kg. Level 6–14 h post-dose (Hartford nomogram). Trough < 1 mg/L.${age >= 65 ? ' Elderly — limit duration.' : ''}`,
        caution: crcl < 40 ? 'Significant renal impairment — seek ID/pharmacy' : undefined,
      };
    },
  },
  {
    id: 'vanc',
    drug: 'Vancomycin — MRSA / Gram+',
    getDose: (wt, crcl) => {
      const load = Math.min(round0(wt * 25), 3000);
      const maint = crcl >= 70 ? `${round0(wt * 15)}–${round0(wt * 20)} mg Q12h`
        : crcl >= 50 ? `${round0(wt * 10)}–${round0(wt * 15)} mg Q24h`
        : crcl >= 30 ? `${round0(wt * 10)} mg Q24–36h`
        : 'PHARMACY REVIEW REQUIRED';
      return {
        dose: `Loading: ${load} mg IV over 1–2 h, then ${maint}`,
        frequency: 'As above',
        note: 'AUC/MIC target 400–600 mg·h/L. Max infusion 1 g/h (Red Man). Monitor renal function Q48h.',
        caution: crcl < 30 ? 'Severe renal impairment — pharmacy review before prescribing' : undefined,
      };
    },
  },
];

// ─── Opioid conversion ────────────────────────────────────────────────────────

interface OpioidDef { name: string; toOme: number | null; fromOme: number | null }
const OPIOIDS: OpioidDef[] = [
  { name: 'Morphine IR (oral)',   toOme: 1,     fromOme: 1    },
  { name: 'Morphine (IV/SC)',     toOme: 3,     fromOme: 1/3  },
  { name: 'Oxycodone (oral)',     toOme: 1.5,   fromOme: 1/1.5 },
  { name: 'Codeine (oral)',       toOme: 0.1,   fromOme: 1/0.1 },
  { name: 'Tramadol (oral)',      toOme: 0.1,   fromOme: 1/0.1 },
  { name: 'Hydromorphone (oral)', toOme: 6.67,  fromOme: 1/6.67 },
  { name: 'Hydromorphone (IV)',   toOme: 20,    fromOme: 1/20 },
];

// ─── Shared toggle row ────────────────────────────────────────────────────────

function MedRow({
  opt, checked, onToggle, stepColor,
}: {
  opt: MedOption; checked: boolean; onToggle: () => void; stepColor: string;
}) {
  return (
    <label
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px',
        borderRadius: 7,
        background: checked ? `${stepColor}12` : 'transparent',
        border: `1px solid ${checked ? stepColor : '#e2e8f0'}`,
        cursor: 'pointer', transition: 'all 0.12s',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        style={{ marginTop: 3, width: 16, height: 16, cursor: 'pointer', accentColor: stepColor, flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{opt.drug}</span>
          <span style={{ fontSize: 13, color: stepColor, fontWeight: 600 }}>{opt.dose}</span>
          <span style={{ fontSize: 12, color: '#64748b' }}>{opt.route} · {opt.frequency}</span>
        </div>
        {opt.warn && (
          <div style={{ fontSize: 11, color: '#b45309', marginTop: 2 }}>⚠ {opt.warn}</div>
        )}
        {opt.note && (
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{opt.note}</div>
        )}
      </div>
    </label>
  );
}

function formatOrder(opt: MedOption): string {
  return `${opt.drug} ${opt.dose} ${opt.route} ${opt.frequency}`;
}

// ─── Main component ───────────────────────────────────────────────────────────

type PainStep = 'step1' | 'step2' | 'step3' | 'uncertain';

export default function DosingTab() {
  const ctx = useAppContext();
  const { plan, setPlan } = ctx;

  // Patient params
  const [weightStr, setWeightStr] = useState(ctx.weightKg || '');
  const [heightStr, setHeightStr] = useState(ctx.heightCm || '');
  const [ageStr, setAgeStr]       = useState(ctx.age || '');
  const [sexInput, setSexInput]   = useState<'M' | 'F'>(ctx.sex === 'female' ? 'F' : 'M');
  const [creatStr, setCreatStr]   = useState('');

  const params = useMemo(() => {
    const wt = parseNum(weightStr), ht = parseNum(heightStr), ag = parseNum(ageStr), cr = parseNum(creatStr);
    if (!wt || !ht || !ag) return null;
    const ibw  = calcIBW(ht, sexInput);
    const bmi  = calcBMI(wt, ht);
    const abw  = wt > ibw * 1.2 ? ibw + 0.4 * (wt - ibw) : null;
    const crcl = cr ? calcCrCl(ag, abw ?? wt, cr, sexInput) : null;
    return { wt, ht, ag, ibw, bmi, abw, crcl };
  }, [weightStr, heightStr, ageStr, sexInput, creatStr]);

  // Pain order builder
  const [painStep, setPainStep] = useState<PainStep>('uncertain');
  const [checkedMeds, setCheckedMeds] = useState<Set<string>>(new Set());

  const visibleSteps = useMemo(() => {
    if (painStep === 'step1') return ['step1'];
    if (painStep === 'step2') return ['step1', 'step2'];
    if (painStep === 'step3') return ['step1', 'step3'];
    return ['step1', 'step2', 'step3']; // uncertain → all visible
  }, [painStep]);

  function toggleMed(id: string) {
    setCheckedMeds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const allMedOptions = [...STEP1, ...STEP2, ...STEP3, ...ADJUVANTS];
  const selectedMeds = allMedOptions.filter(m => checkedMeds.has(m.id));

  // Antibiotic orders
  const [checkedAbx, setCheckedAbx] = useState<Set<string>>(new Set());
  function toggleAbx(id: string) {
    setCheckedAbx(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  const selectedAbxOrders = useMemo(() => {
    if (!params) return [];
    const crcl = params.crcl ?? 80;
    return ANTIBIOTIC_ORDERS.filter(o => checkedAbx.has(o.id)).map(o => {
      const r = o.getDose(params.wt, crcl, params.ibw, params.ag);
      return { ...o, result: r };
    });
  }, [checkedAbx, params]);

  // Opioid rotation
  const [rotFrom, setRotFrom]   = useState(OPIOIDS[0].name);
  const [rotDose, setRotDose]   = useState('');
  const [rotTo, setRotTo]       = useState(OPIOIDS[1].name);

  const rotResult = useMemo(() => {
    const d = parseNum(rotDose);
    const fromOp = OPIOIDS.find(o => o.name === rotFrom);
    const toOp   = OPIOIDS.find(o => o.name === rotTo);
    if (!d || !fromOp?.toOme || !toOp?.fromOme) return null;
    const ome       = d * fromOp.toOme;
    const equiv     = ome * toOp.fromOme;
    const rotation  = equiv * 0.75;
    return { ome: round1(ome), equiv: round1(equiv), rotation: round1(rotation) };
  }, [rotFrom, rotDose, rotTo]);

  // Build order text for "Add to Plan"
  const buildOrderText = useCallback(() => {
    const lines: string[] = [];
    if (selectedMeds.length > 0) {
      lines.push('PAIN MANAGEMENT:');
      selectedMeds.forEach(m => lines.push(`  ${formatOrder(m)}`));
    }
    if (selectedAbxOrders.length > 0) {
      lines.push('');
      lines.push('ANTIMICROBIAL / ANTICOAGULANT:');
      selectedAbxOrders.forEach(o => lines.push(`  ${o.drug}: ${o.result.dose} ${o.result.frequency}`));
    }
    return lines.join('\n').trim();
  }, [selectedMeds, selectedAbxOrders]);

  function addToPlan() {
    const text = buildOrderText();
    if (!text) return;
    const sep = plan && !plan.endsWith('\n') ? '\n\n' : '';
    setPlan(plan + sep + text);
  }

  const hasSelections = selectedMeds.length > 0 || selectedAbxOrders.length > 0;

  const STEP_COLORS: Record<string, string> = { step1: '#15803d', step2: '#b45309', step3: '#dc2626', adjuvant: '#7c3aed' };
  const STEP_META: Record<PainStep, { label: string; hint: string; color: string }> = {
    step1:    { label: 'Mild',          hint: 'Non-opioid analgesia',                color: '#15803d' },
    step2:    { label: 'Mild–Moderate', hint: 'Weak opioid added',                   color: '#b45309' },
    step3:    { label: 'Moderate–Severe',hint: 'Strong opioid',                      color: '#dc2626' },
    uncertain:{ label: 'Uncertain',     hint: 'Show all — select what applies',      color: '#475569' },
  };

  return (
    <div className="gap-y">

      {/* ── Patient Parameters ─────────────────────────────────────────────── */}
      <CollapsibleCard title="Patient Parameters" defaultOpen={!params}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
          {([
            { label: 'Weight (kg)',   val: weightStr, set: setWeightStr, ph: '75' },
            { label: 'Height (cm)',   val: heightStr, set: setHeightStr, ph: '170' },
            { label: 'Age (years)',   val: ageStr,    set: setAgeStr,    ph: '45' },
            { label: 'Creatinine (µmol/L)', val: creatStr, set: setCreatStr, ph: '88 (optional)' },
          ] as const).map(f => (
            <label key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{f.label}</span>
              <input type="number" value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }} />
            </label>
          ))}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sex</span>
            <select value={sexInput} onChange={e => setSexInput(e.target.value as 'M' | 'F')}
              style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
          </label>
        </div>
        {params && (
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              { label: 'BMI', val: round1(params.bmi), unit: 'kg/m²', color: params.bmi >= 30 ? '#b45309' : '#15803d' },
              { label: 'IBW', val: round1(params.ibw), unit: 'kg',    color: '#1d4ed8' },
              params.abw ? { label: 'ABW', val: round1(params.abw), unit: 'kg', color: '#7c3aed' } : null,
              params.crcl ? { label: 'CrCl', val: round1(params.crcl), unit: 'mL/min', color: params.crcl >= 60 ? '#15803d' : params.crcl >= 30 ? '#b45309' : '#dc2626' } : null,
            ].filter(Boolean).map(c => c && (
              <div key={c.label} style={{ background: '#f8fafc', border: `1px solid ${c.color}30`, borderRadius: 7, padding: '6px 12px' }}>
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>{c.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: c.color }}>{c.val} <span style={{ fontSize: 10, fontWeight: 400 }}>{c.unit}</span></div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleCard>

      {/* ── Pain Management Order Builder ──────────────────────────────────── */}
      <CollapsibleCard title="Pain Management Orders">

        {/* Step selector */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Pain level
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(Object.entries(STEP_META) as [PainStep, typeof STEP_META[PainStep]][]).map(([key, meta]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPainStep(key)}
                style={{
                  padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
                  background: painStep === key ? meta.color : '#f1f5f9',
                  color: painStep === key ? '#fff' : '#475569',
                  transition: 'all 0.12s',
                }}
              >
                {meta.label}
                {painStep === key && <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 5, opacity: 0.85 }}>— {meta.hint}</span>}
              </button>
            ))}
          </div>
          {painStep === 'uncertain' && (
            <div style={{ marginTop: 6, fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>
              All options shown — check what applies. Both selections will appear in the order output.
            </div>
          )}
        </div>

        {/* Step 1 */}
        {visibleSteps.includes('step1') && (
          <StepBlock
            label="Step 1 — Non-opioid" color={STEP_COLORS.step1}
            options={STEP1} checked={checkedMeds} onToggle={toggleMed}
          />
        )}

        {/* Step 2 */}
        {visibleSteps.includes('step2') && (
          <StepBlock
            label="Step 2 — Weak opioid (add to Step 1)" color={STEP_COLORS.step2}
            options={STEP2} checked={checkedMeds} onToggle={toggleMed}
          />
        )}

        {/* Step 3 */}
        {visibleSteps.includes('step3') && (
          <StepBlock
            label="Step 3 — Strong opioid" color={STEP_COLORS.step3}
            options={STEP3} checked={checkedMeds} onToggle={toggleMed}
          />
        )}

        {/* Adjuvants */}
        <StepBlock
          label="Adjuvants / supportive" color={STEP_COLORS.adjuvant}
          options={ADJUVANTS} checked={checkedMeds} onToggle={toggleMed}
        />

      </CollapsibleCard>

      {/* ── Anticoagulant / Antimicrobial Orders ──────────────────────────── */}
      <CollapsibleCard title="Anticoagulant & Antimicrobial Orders">
        {!params && (
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>
            Enter patient parameters above for weight- and renal-adjusted doses.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ANTIBIOTIC_ORDERS.map(o => {
            const isChecked = checkedAbx.has(o.id);
            const result = params
              ? o.getDose(params.wt, params.crcl ?? 80, params.ibw, params.ag)
              : null;
            return (
              <label
                key={o.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                  borderRadius: 7, cursor: 'pointer', transition: 'all 0.12s',
                  background: isChecked ? '#eff6ff' : '#f8fafc',
                  border: `1px solid ${isChecked ? '#3b82f6' : '#e2e8f0'}`,
                }}
              >
                <input type="checkbox" checked={isChecked} onChange={() => toggleAbx(o.id)}
                  style={{ marginTop: 3, width: 16, height: 16, cursor: 'pointer', accentColor: '#1d4ed8', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{o.drug}</div>
                  {result ? (
                    <>
                      {result.caution && (
                        <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>⚠ {result.caution}</div>
                      )}
                      <div style={{ fontSize: 13, color: '#1d4ed8', fontWeight: 600, marginTop: 3 }}>
                        {result.dose} · {result.frequency}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{result.note}</div>
                    </>
                  ) : (
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                      Enter patient parameters to see calculated dose
                    </div>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </CollapsibleCard>

      {/* ── Opioid Rotation ────────────────────────────────────────────────── */}
      <CollapsibleCard title="Opioid Rotation Calculator" defaultOpen={false}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 1fr', gap: 8, alignItems: 'end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={smallLabel}>Current opioid</label>
            <select value={rotFrom} onChange={e => setRotFrom(e.target.value)} style={selectStyle}>
              {OPIOIDS.map(o => <option key={o.name} value={o.name}>{o.name}</option>)}
            </select>
            <label style={smallLabel}>Current dose (mg)</label>
            <input type="number" value={rotDose} onChange={e => setRotDose(e.target.value)}
              placeholder="e.g. 30" style={inputStyle} />
          </div>
          <div style={{ textAlign: 'center', fontSize: 20, color: '#94a3b8', paddingBottom: 6 }}>→</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={smallLabel}>New opioid</label>
            <select value={rotTo} onChange={e => setRotTo(e.target.value)} style={selectStyle}>
              {OPIOIDS.filter(o => o.name !== rotFrom).map(o => <option key={o.name} value={o.name}>{o.name}</option>)}
            </select>
          </div>
        </div>
        {rotResult && (
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase' }}>Equianalgesic dose</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#1d4ed8' }}>{rotResult.equiv} mg</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>OME: {rotResult.ome} mg oral morphine</div>
            </div>
            <div style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#854d0e', textTransform: 'uppercase' }}>Rotation dose (−25%)</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#854d0e' }}>{rotResult.rotation} mg</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Recommended — incomplete cross-tolerance</div>
            </div>
          </div>
        )}
        {rotResult && (
          <button
            type="button"
            onClick={() => {
              const fromOp = OPIOIDS.find(o => o.name === rotFrom);
              const toOp   = OPIOIDS.find(o => o.name === rotTo);
              if (!fromOp || !toOp || !rotResult) return;
              const line = `Opioid rotation: ${rotFrom} ${rotDose} mg → ${rotTo} ${rotResult.rotation} mg (−25% rotation dose; equianalgesic ${rotResult.equiv} mg)`;
              const sep = plan && !plan.endsWith('\n') ? '\n' : '';
              setPlan(plan + sep + line);
            }}
            style={{ marginTop: 10, padding: '6px 16px', borderRadius: 6, border: 'none', background: '#1d4ed8', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            Add rotation to Plan
          </button>
        )}
        <div style={{ marginTop: 8, fontSize: 11, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '7px 10px' }}>
          ⚠ Conversions are approximate. Reduce 25–50% when rotating (incomplete cross-tolerance). Titrate individually. Ensure naloxone is available.
        </div>
      </CollapsibleCard>

      {/* ── Selected Orders + Add to Plan ─────────────────────────────────── */}
      <div style={{
        position: 'sticky', bottom: 0, background: '#fff', borderTop: '1px solid #e2e8f0',
        padding: '12px 0 4px', zIndex: 10,
      }}>
        {hasSelections ? (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Selected orders ({selectedMeds.length + selectedAbxOrders.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10, maxHeight: 120, overflowY: 'auto' }}>
              {selectedMeds.map(m => (
                <div key={m.id} style={{ fontSize: 12, color: '#0f172a', display: 'flex', gap: 6, alignItems: 'baseline' }}>
                  <span style={{ color: '#15803d', flexShrink: 0 }}>✓</span>
                  <span><strong>{m.drug}</strong> {m.dose} {m.route} {m.frequency}</span>
                </div>
              ))}
              {selectedAbxOrders.map(o => (
                <div key={o.id} style={{ fontSize: 12, color: '#0f172a', display: 'flex', gap: 6, alignItems: 'baseline' }}>
                  <span style={{ color: '#1d4ed8', flexShrink: 0 }}>✓</span>
                  <span><strong>{o.drug}</strong>: {o.result.dose} · {o.result.frequency}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={addToPlan}
                style={{ padding: '8px 20px', borderRadius: 7, border: 'none', background: '#0d9488', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', flex: 1 }}
              >
                Add to Plan →
              </button>
              <button
                type="button"
                onClick={() => { setCheckedMeds(new Set()); setCheckedAbx(new Set()); }}
                style={{ padding: '8px 14px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: 12, cursor: 'pointer' }}
              >
                Clear all
              </button>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
            Tick medications above — selected orders appear here and can be added to the Plan.
          </div>
        )}
      </div>

    </div>
  );
}

// ─── Step block sub-component ─────────────────────────────────────────────────

function StepBlock({
  label, color, options, checked, onToggle,
}: {
  label: string; color: string;
  options: MedOption[]; checked: Set<string>; onToggle: (id: string) => void;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {options.map(opt => (
          <MedRow key={opt.id} opt={opt} checked={checked.has(opt.id)} onToggle={() => onToggle(opt.id)} stepColor={color} />
        ))}
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const smallLabel: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em',
};
const inputStyle: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, color: '#0f172a', width: '100%',
};
const selectStyle: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, color: '#0f172a', width: '100%',
};
