import { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';

// ── Parsing helpers ────────────────────────────────────────────────────────────

function firstNum(s: string): number | null {
  const m = s.match(/(\d+\.?\d*)/);
  return m ? parseFloat(m[1]) : null;
}

function analyte(text: string, ...labels: string[]): number | null {
  for (const lbl of labels) {
    const rx = new RegExp(`${lbl}[^\\d]*(\\d+\\.?\\d*)`, 'i');
    const m  = text.match(rx);
    if (m) return parseFloat(m[1]);
  }
  return null;
}

function fromResults(results: Record<string, string>, ...keys: string[]): number | null {
  for (const key of keys) {
    for (const [k, v] of Object.entries(results)) {
      if (k.toLowerCase().includes(key.toLowerCase())) {
        const n = firstNum(v);
        if (n !== null) return n;
      }
    }
  }
  return null;
}

function fromResultsAnalyte(results: Record<string, string>, panelKey: string, ...analytes: string[]): number | null {
  for (const [k, v] of Object.entries(results)) {
    if (k.toLowerCase().includes(panelKey.toLowerCase())) {
      const n = analyte(v, ...analytes);
      if (n !== null) return n;
    }
  }
  return null;
}

// ── Clinical formulas ─────────────────────────────────────────────────────────

function egfr(creatUmol: number, ageYrs: number, sex: string): number {
  const scr    = creatUmol / 88.42;
  const female = sex === 'female';
  const kappa  = female ? 0.7 : 0.9;
  const alpha  = female ? -0.241 : -0.302;
  const sexFac = female ? 1.012 : 1.0;
  const x      = scr / kappa;
  return 142 * Math.pow(Math.min(x, 1), alpha) * Math.pow(Math.max(x, 1), -1.200)
       * Math.pow(0.9938, ageYrs) * sexFac;
}

function ckdStage(gfr: number): { label: string; color: string } {
  if (gfr >= 90) return { label: 'G1 — Normal / High', color: '#16a34a' };
  if (gfr >= 60) return { label: 'G2 — Mildly decreased', color: '#22c55e' };
  if (gfr >= 45) return { label: 'G3a — Mild-moderate CKD', color: '#f59e0b' };
  if (gfr >= 30) return { label: 'G3b — Moderate-severe CKD', color: '#f97316' };
  if (gfr >= 15) return { label: 'G4 — Severely decreased', color: '#ef4444' };
  return { label: 'G5 — Kidney failure', color: '#7f1d1d' };
}

function fib4(ageYrs: number, ast: number, alt: number, pltE9: number): number {
  return (ageYrs * ast) / (pltE9 * Math.sqrt(alt));
}

function fib4Grade(score: number): { label: string; color: string } {
  if (score < 1.30) return { label: 'Low fibrosis risk (<F2)', color: '#16a34a' };
  if (score <= 2.67) return { label: 'Indeterminate — consider ELF/FibroScan', color: '#d97706' };
  return { label: 'High fibrosis risk (F3–F4 probable)', color: '#dc2626' };
}

function corrCa(caMmol: number, albGL: number): number {
  return caMmol + 0.02 * (40 - albGL);
}

function caGrade(ca: number): { label: string; color: string } {
  if (ca < 2.10) return { label: 'Hypocalcaemia', color: '#2563eb' };
  if (ca <= 2.60) return { label: 'Normal range', color: '#16a34a' };
  if (ca <= 2.90) return { label: 'Borderline high', color: '#f59e0b' };
  if (ca <= 3.20) return { label: 'Mild hypercalcaemia', color: '#f97316' };
  return { label: 'Significant hypercalcaemia — urgent review', color: '#dc2626' };
}

function eag(hba1cPct: number): number {
  return 1.59 * hba1cPct - 2.59;
}

function hba1cGrade(pct: number): { label: string; color: string } {
  if (pct < 5.7) return { label: 'Normal', color: '#16a34a' };
  if (pct < 6.5) return { label: 'Pre-diabetes', color: '#f59e0b' };
  if (pct < 8.0) return { label: 'Diabetes — target not met', color: '#f97316' };
  return { label: 'Poorly controlled diabetes', color: '#dc2626' };
}

function ldlFriedewald(tcMmol: number, hdlMmol: number, tgMmol: number): number | null {
  if (tgMmol > 4.52) return null;
  return tcMmol - hdlMmol - tgMmol / 2.2;
}

function ldlGrade(ldl: number): { label: string; color: string } {
  if (ldl < 1.8)  return { label: 'Optimal (high-risk target)', color: '#16a34a' };
  if (ldl < 2.6)  return { label: 'Near optimal', color: '#22c55e' };
  if (ldl < 3.4)  return { label: 'Borderline high', color: '#f59e0b' };
  if (ldl < 4.1)  return { label: 'High', color: '#f97316' };
  return { label: 'Very high — treat', color: '#dc2626' };
}

function nlr(neut: number, lymph: number): number {
  return neut / lymph;
}

function nlrGrade(ratio: number): { label: string; color: string } {
  if (ratio < 2.0) return { label: 'Normal inflammatory state', color: '#16a34a' };
  if (ratio < 4.0) return { label: 'Mildly elevated', color: '#f59e0b' };
  if (ratio < 10)  return { label: 'Elevated — systemic inflammation / oncologic risk', color: '#f97316' };
  return { label: 'Severely elevated — sepsis / major trauma', color: '#dc2626' };
}

function meldNa(bilirubinUmol: number, inr: number, creatUmol: number, naMmol: number): number {
  const bili  = Math.max(bilirubinUmol / 17.1, 1.0); // mg/dL, floor 1
  const creat = Math.min(Math.max(creatUmol / 88.42, 1.0), 4.0); // mg/dL, 1-4
  const inrV  = Math.max(inr, 1.0);
  const meld  = 3.78 * Math.log(bili) + 11.2 * Math.log(inrV) + 9.57 * Math.log(creat) + 6.43;
  const na    = Math.min(Math.max(naMmol, 125), 137); // clamp
  return meld - na - 0.025 * meld * (140 - na) + 140;
}

function meldGrade(score: number): { label: string; color: string } {
  if (score < 10) return { label: '< 4% 90-day mortality', color: '#16a34a' };
  if (score < 20) return { label: '6–20% 90-day mortality', color: '#f59e0b' };
  if (score < 30) return { label: '~30–60% 90-day mortality', color: '#f97316' };
  return { label: '> 50–80% 90-day mortality — transplant evaluation', color: '#dc2626' };
}

// ── Tumour marker interpretation ───────────────────────────────────────────────

interface TmMarker { label: string; upper: number; unit: string; note: string }

const TM_DEFS: TmMarker[] = [
  { label: 'CEA',    upper: 5,   unit: 'ng/mL', note: 'Colorectal, gastric, lung, breast surveillance' },
  { label: 'CA19-9', upper: 37,  unit: 'U/mL',  note: 'Pancreatic/biliary; non-specific if <1000' },
  { label: 'AFP',    upper: 10,  unit: 'ng/mL',  note: 'HCC surveillance; germ cell tumour' },
  { label: 'CA-125', upper: 35,  unit: 'U/mL',  note: 'Ovarian surveillance (female only)' },
  { label: 'PSA',    upper: 4,   unit: 'ng/mL',  note: 'Prostate screening (male only)' },
];

// ── Input state ────────────────────────────────────────────────────────────────

interface Inputs {
  creat: string;  // µmol/L
  albumin: string; // g/L
  calcium: string; // mmol/L
  ast: string;
  alt: string;
  platelets: string;
  hba1c: string;
  tc: string;
  hdl: string;
  tg: string;
  neutrophils: string;
  lymphocytes: string;
  inr: string;
  bilirubin: string; // µmol/L
  sodium: string;
  cea: string;
  ca199: string;
  afp: string;
  ca125: string;
  psa: string;
}

const EMPTY: Inputs = {
  creat: '', albumin: '', calcium: '', ast: '', alt: '', platelets: '',
  hba1c: '', tc: '', hdl: '', tg: '', neutrophils: '', lymphocytes: '',
  inr: '', bilirubin: '', sodium: '',
  cea: '', ca199: '', afp: '', ca125: '', psa: '',
};

function autoPopulate(results: Record<string, string>, ageStr: string): Inputs {
  const r = { ...EMPTY };

  function trySet(field: keyof Inputs, ...keys: string[]) {
    const n = fromResults(results, ...keys);
    if (n !== null) r[field] = String(n);
  }

  trySet('creat', 'creatinine');
  trySet('albumin', 'albumin');
  trySet('calcium', 'calcium');
  trySet('hba1c', 'hba1c', 'haemoglobin a1c', 'glycated haemoglobin');
  trySet('inr', 'inr', 'prothrombin');
  trySet('cea', 'cea');
  trySet('afp', 'afp');
  trySet('psa', 'psa');

  // Try extracting analytes from LFT panel string
  const lftAst = fromResultsAnalyte(results, 'lft', 'AST') ?? fromResultsAnalyte(results, 'liver function', 'AST');
  const lftAlt = fromResultsAnalyte(results, 'lft', 'ALT') ?? fromResultsAnalyte(results, 'liver function', 'ALT');
  const lftBili = fromResultsAnalyte(results, 'lft', 'Bilirubin', 'Bili') ?? fromResultsAnalyte(results, 'liver function', 'Bilirubin', 'Bili');
  const lftAlb  = fromResultsAnalyte(results, 'lft', 'Albumin') ?? fromResultsAnalyte(results, 'liver function', 'Albumin');
  if (lftAst !== null) r.ast = String(lftAst);
  if (lftAlt !== null) r.alt = String(lftAlt);
  if (lftBili !== null && !r.bilirubin) r.bilirubin = String(lftBili);
  if (lftAlb  !== null && !r.albumin) r.albumin = String(lftAlb);

  // FBC — extract from panel string
  const fbcPlt  = fromResultsAnalyte(results, 'fbc', 'Platelet', 'PLT') ?? fromResultsAnalyte(results, 'full blood count', 'Platelet', 'PLT');
  const fbcNeut = fromResultsAnalyte(results, 'fbc', 'Neutro', 'Neut') ?? fromResultsAnalyte(results, 'full blood count', 'Neutro', 'Neut');
  const fbcLym  = fromResultsAnalyte(results, 'fbc', 'Lympho', 'Lymph') ?? fromResultsAnalyte(results, 'full blood count', 'Lympho', 'Lymph');
  if (fbcPlt  !== null) r.platelets    = String(fbcPlt);
  if (fbcNeut !== null) r.neutrophils  = String(fbcNeut);
  if (fbcLym  !== null) r.lymphocytes  = String(fbcLym);

  // Lipid profile
  const lipTc  = fromResultsAnalyte(results, 'lipid', 'Total Cholesterol', 'TC', 'Total') ?? fromResults(results, 'total cholesterol');
  const lipHdl = fromResultsAnalyte(results, 'lipid', 'HDL') ?? fromResults(results, 'hdl');
  const lipTg  = fromResultsAnalyte(results, 'lipid', 'Triglyceride', 'TG', 'Trig') ?? fromResults(results, 'triglyceride');
  if (lipTc  !== null) r.tc = String(lipTc);
  if (lipHdl !== null) r.hdl = String(lipHdl);
  if (lipTg  !== null) r.tg = String(lipTg);

  // U&E — sodium
  const ueSodium = fromResultsAnalyte(results, 'u&e', 'Na', 'Sodium') ?? fromResultsAnalyte(results, 'electrolyte', 'Na', 'Sodium');
  if (ueSodium !== null) r.sodium = String(ueSodium);

  // Tumour markers (individual test results)
  for (const [k, v] of Object.entries(results)) {
    const kl = k.toLowerCase().trim();
    if (kl === 'cea')             r.cea   = String(firstNum(v) ?? '');
    if (kl === 'ca 19-9' || kl === 'ca19-9') r.ca199 = String(firstNum(v) ?? '');
    if (kl === 'afp')             r.afp   = String(firstNum(v) ?? '');
    if (kl === 'ca-125' || kl === 'ca125')   r.ca125 = String(firstNum(v) ?? '');
    if (kl === 'psa')             r.psa   = String(firstNum(v) ?? '');
  }

  // Age could auto-seed for formulas but it comes from AppContext `age` string — handled in component
  void ageStr;

  return r;
}

// ── Small reusable pieces ─────────────────────────────────────────────────────

function NumInput({ label, value, unit, onChange }: {
  label: string; value: string; unit?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <label style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}{unit && <span style={{ fontWeight: 400, marginLeft: 3 }}>({unit})</span>}
      </label>
      <input
        type="number" value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: 80, padding: '5px 8px', borderRadius: 6, fontSize: 13,
          border: '1px solid #e2e8f0', background: '#fff', color: '#1e293b',
          fontVariantNumeric: 'tabular-nums',
        }}
      />
    </div>
  );
}

function ResultBadge({ value, grade, unit }: { value: string; grade: { label: string; color: string }; unit?: string }) {
  return (
    <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: `${grade.color}12`, border: `1px solid ${grade.color}44` }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: grade.color, fontVariantNumeric: 'tabular-nums' }}>
        {value}{unit && <span style={{ fontSize: 13, fontWeight: 500 }}> {unit}</span>}
      </div>
      <div style={{ fontSize: 11, color: grade.color, marginTop: 2, fontWeight: 600 }}>
        {grade.label}
      </div>
    </div>
  );
}

function FormulaCard({ title, source, children }: { title: string; source: string; children: React.ReactNode }) {
  return (
    <div style={{
      border: '1px solid #e2e8f0', borderRadius: 12, padding: 14,
      background: '#fff', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{title}</div>
        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{source}</div>
      </div>
      {children}
    </div>
  );
}

function Incomplete() {
  return (
    <div style={{ fontSize: 11, color: '#9ca3af', padding: '8px 12px', background: '#f8fafc', borderRadius: 6, marginTop: 4 }}>
      Fill in inputs to compute
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LabInterpretationPanel() {
  const { investigationResults, orderedInvestigations, age, sex } = useAppContext();
  const [inputs, setInputs] = useState<Inputs>(EMPTY);
  const [autoApplied, setAutoApplied] = useState(false);
  const hasResults = orderedInvestigations.some(k => investigationResults[k] !== undefined);

  function set(field: keyof Inputs, value: string) {
    setInputs(prev => ({ ...prev, [field]: value }));
  }

  function runAutoPop() {
    setInputs(autoPopulate(investigationResults, age));
    setAutoApplied(true);
    setTimeout(() => setAutoApplied(false), 2500);
  }

  // Auto-populate once when results first appear
  useEffect(() => {
    if (hasResults) setInputs(autoPopulate(investigationResults, age));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ageNum = parseInt(age, 10);

  const computed = useMemo(() => {
    const c = parseFloat(inputs.creat);
    const alb = parseFloat(inputs.albumin);
    const ca = parseFloat(inputs.calcium);
    const ast = parseFloat(inputs.ast);
    const alt = parseFloat(inputs.alt);
    const plt = parseFloat(inputs.platelets);
    const h1c = parseFloat(inputs.hba1c);
    const tc  = parseFloat(inputs.tc);
    const hdl = parseFloat(inputs.hdl);
    const tg  = parseFloat(inputs.tg);
    const neut = parseFloat(inputs.neutrophils);
    const lymp = parseFloat(inputs.lymphocytes);
    const inr  = parseFloat(inputs.inr);
    const bili = parseFloat(inputs.bilirubin);
    const na   = parseFloat(inputs.sodium);

    const ok = (v: number) => !isNaN(v) && v > 0;

    return {
      egfrVal:  ok(c) && ok(ageNum) ? egfr(c, ageNum, sex) : null,
      corrCaVal: ok(ca) && ok(alb)  ? corrCa(ca, alb) : null,
      fib4Val:  ok(ageNum) && ok(ast) && ok(alt) && ok(plt) ? fib4(ageNum, ast, alt, plt) : null,
      eagVal:   ok(h1c) ? eag(h1c) : null,
      ldlVal:   ok(tc) && ok(hdl) && ok(tg) ? ldlFriedewald(tc, hdl, tg) : null,
      nlrVal:   ok(neut) && ok(lymp) ? nlr(neut, lymp) : null,
      meldVal:  ok(bili) && ok(inr) && ok(c) && ok(na) ? meldNa(bili, inr, c, na) : null,
    };
  }, [inputs, ageNum, sex]);

  // Tumour markers
  const tmRows = TM_DEFS.map(def => {
    const fieldMap: Record<string, keyof Inputs> = {
      'CEA': 'cea', 'CA19-9': 'ca199', 'AFP': 'afp', 'CA-125': 'ca125', 'PSA': 'psa',
    };
    const field = fieldMap[def.label];
    const val   = field ? parseFloat(inputs[field]) : NaN;
    const elevated = !isNaN(val) && val > def.upper;
    return { ...def, val, elevated, field };
  }).filter(r => !isNaN(r.val) && r.val > 0);

  if (!hasResults && Object.values(inputs).every(v => v === '')) {
    return (
      <CollapsibleCard title="Lab Interpretation & Derived Scores" defaultOpen={false}>
        <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>
          Enter lab results above, then values will auto-populate here for clinical formula calculations.
        </p>
      </CollapsibleCard>
    );
  }

  return (
    <CollapsibleCard title="Lab Interpretation & Derived Scores" defaultOpen={hasResults}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
          Enter values manually or auto-populate from entered results. Formulas are for clinical guidance — verify against patient context.
        </p>
        <button type="button" onClick={runAutoPop}
          style={{
            padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: '1px solid #0d9488', background: autoApplied ? '#0d9488' : '#f0fdfa',
            color: autoApplied ? '#fff' : '#0d9488', whiteSpace: 'nowrap', marginLeft: 10, flexShrink: 0,
          }}>
          {autoApplied ? '✓ Applied' : '↑ Auto-fill from results'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>

        {/* eGFR */}
        <FormulaCard title="eGFR / CKD-EPI 2021" source="Inker et al, NEJM 2021 (race-free)">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <NumInput label="Creatinine" unit="µmol/L" value={inputs.creat} onChange={v => set('creat', v)} />
            <NumInput label="Age" unit="yr" value={age} onChange={() => {}} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sex</label>
              <div style={{ fontSize: 12, padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, color: '#374151', background: '#f8fafc' }}>
                {sex === 'unknown' ? '—' : sex}
              </div>
            </div>
          </div>
          {computed.egfrVal !== null
            ? <ResultBadge value={computed.egfrVal.toFixed(1)} unit="mL/min/1.73m²" grade={ckdStage(computed.egfrVal)} />
            : <Incomplete />}
        </FormulaCard>

        {/* Corrected Calcium */}
        <FormulaCard title="Corrected Calcium" source="CorrCa = Ca + 0.02 × (40 − Albumin)">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <NumInput label="Calcium" unit="mmol/L" value={inputs.calcium} onChange={v => set('calcium', v)} />
            <NumInput label="Albumin" unit="g/L"    value={inputs.albumin} onChange={v => set('albumin', v)} />
          </div>
          {computed.corrCaVal !== null
            ? <ResultBadge value={computed.corrCaVal.toFixed(2)} unit="mmol/L" grade={caGrade(computed.corrCaVal)} />
            : <Incomplete />}
        </FormulaCard>

        {/* FIB-4 */}
        <FormulaCard title="FIB-4 Fibrosis Score" source="Sterling et al — liver fibrosis staging">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <NumInput label="Age" unit="yr" value={age} onChange={() => {}} />
            <NumInput label="AST"       unit="U/L"   value={inputs.ast}      onChange={v => set('ast', v)} />
            <NumInput label="ALT"       unit="U/L"   value={inputs.alt}      onChange={v => set('alt', v)} />
            <NumInput label="Platelets" unit="×10⁹/L" value={inputs.platelets} onChange={v => set('platelets', v)} />
          </div>
          {computed.fib4Val !== null
            ? <ResultBadge value={computed.fib4Val.toFixed(2)} grade={fib4Grade(computed.fib4Val)} />
            : <Incomplete />}
        </FormulaCard>

        {/* HbA1c */}
        <FormulaCard title="HbA1c → Estimated Average Glucose" source="ADA 2023 (eAG = 1.59 × HbA1c% − 2.59)">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <NumInput label="HbA1c" unit="%" value={inputs.hba1c} onChange={v => set('hba1c', v)} />
          </div>
          {computed.eagVal !== null && !isNaN(parseFloat(inputs.hba1c)) ? (
            <ResultBadge
              value={`${computed.eagVal.toFixed(1)} mmol/L (${(computed.eagVal * 18.0).toFixed(0)} mg/dL)`}
              grade={hba1cGrade(parseFloat(inputs.hba1c))}
            />
          ) : <Incomplete />}
        </FormulaCard>

        {/* Friedewald LDL */}
        <FormulaCard title="LDL Cholesterol (Friedewald)" source="Valid when TG < 4.5 mmol/L">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <NumInput label="Total Chol" unit="mmol/L" value={inputs.tc}  onChange={v => set('tc', v)} />
            <NumInput label="HDL"        unit="mmol/L" value={inputs.hdl} onChange={v => set('hdl', v)} />
            <NumInput label="Triglyc."   unit="mmol/L" value={inputs.tg}  onChange={v => set('tg', v)} />
          </div>
          {computed.ldlVal !== null
            ? <ResultBadge value={computed.ldlVal.toFixed(2)} unit="mmol/L" grade={ldlGrade(computed.ldlVal)} />
            : inputs.tc && parseFloat(inputs.tg) > 4.52
              ? <div style={{ fontSize: 11, color: '#dc2626', marginTop: 6 }}>TG &gt; 4.5 mmol/L — Friedewald invalid. Use direct LDL.</div>
              : <Incomplete />}
        </FormulaCard>

        {/* NLR */}
        <FormulaCard title="Neutrophil:Lymphocyte Ratio" source="Systemic inflammation & oncological risk marker">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <NumInput label="Neutrophils" unit="×10⁹/L" value={inputs.neutrophils} onChange={v => set('neutrophils', v)} />
            <NumInput label="Lymphocytes" unit="×10⁹/L" value={inputs.lymphocytes} onChange={v => set('lymphocytes', v)} />
          </div>
          {computed.nlrVal !== null && computed.nlrVal > 0
            ? <ResultBadge value={computed.nlrVal.toFixed(1)} grade={nlrGrade(computed.nlrVal)} />
            : <Incomplete />}
        </FormulaCard>

        {/* MELD-Na */}
        <FormulaCard title="MELD-Na Score" source="UNOS 2016 — liver failure 90-day mortality">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <NumInput label="Bilirubin" unit="µmol/L" value={inputs.bilirubin} onChange={v => set('bilirubin', v)} />
            <NumInput label="INR"                      value={inputs.inr}       onChange={v => set('inr', v)} />
            <NumInput label="Creatinine" unit="µmol/L" value={inputs.creat}    onChange={v => set('creat', v)} />
            <NumInput label="Sodium"    unit="mmol/L"  value={inputs.sodium}   onChange={v => set('sodium', v)} />
          </div>
          {computed.meldVal !== null
            ? <ResultBadge value={Math.round(computed.meldVal).toString()} grade={meldGrade(computed.meldVal)} />
            : <Incomplete />}
        </FormulaCard>

      </div>

      {/* Tumour markers */}
      {(tmRows.length > 0 || true) && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#6b7280', marginBottom: 10 }}>
            Tumour Marker Inputs &amp; Flags
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <NumInput label="CEA"    unit="ng/mL" value={inputs.cea}   onChange={v => set('cea', v)} />
            <NumInput label="CA19-9" unit="U/mL"  value={inputs.ca199} onChange={v => set('ca199', v)} />
            <NumInput label="AFP"    unit="ng/mL" value={inputs.afp}   onChange={v => set('afp', v)} />
            {sex !== 'male'   && <NumInput label="CA-125" unit="U/mL"  value={inputs.ca125} onChange={v => set('ca125', v)} />}
            {sex !== 'female' && <NumInput label="PSA"    unit="ng/mL" value={inputs.psa}   onChange={v => set('psa', v)} />}
          </div>
          {tmRows.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tmRows.map(row => (
                <div key={row.label} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
                  borderRadius: 8, fontSize: 12,
                  background: row.elevated ? '#fef2f2' : '#f0fdf4',
                  border: `1px solid ${row.elevated ? '#fca5a5' : '#86efac'}`,
                }}>
                  <span style={{
                    minWidth: 62, fontWeight: 700,
                    color: row.elevated ? '#dc2626' : '#15803d',
                  }}>
                    {row.elevated ? '▲ ' : '✓ '}{row.label}
                  </span>
                  <span style={{ fontWeight: 600, color: row.elevated ? '#991b1b' : '#166534', fontVariantNumeric: 'tabular-nums' }}>
                    {row.val.toFixed(1)} {row.unit}
                  </span>
                  <span style={{ color: '#6b7280', fontSize: 11, flex: 1 }}>
                    {row.elevated
                      ? `Elevated (ULN ${row.upper} ${row.unit}) — ${row.note}`
                      : `Normal — ${row.note}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 10, color: '#9ca3af', fontStyle: 'italic' }}>
        Derived values are for clinical decision support only — verify against full clinical picture and laboratory reference ranges.
        Creatinine input assumed in µmol/L (Saint Lucia / SI units).
      </div>
    </CollapsibleCard>
  );
}
