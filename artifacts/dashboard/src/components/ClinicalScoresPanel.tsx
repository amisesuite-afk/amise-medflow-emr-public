/**
 * ClinicalScoresPanel — auto-computing prognostic scores.
 *
 * Renders only the scores relevant to the current encounter context:
 * - Tokyo cholangitis / cholecystitis → when activeCcKey / diagnosis suggests biliary
 * - Ranson's + BISAP → pancreatitis context
 * - ERCP PEP risk → ERCP encounter
 * - NEWS2 → always shown in emergency context
 *
 * Inputs auto-derive from vitals + extractedLabs. Manual overrides for boolean
 * clinical findings (Murphy's sign, imaging flags, organ dysfunction) are inline.
 */
import React, { useState, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import {
  scoreTokyoCholangitis, scoreTokyoCholecystitis,
  scoreRanson, scoreBisap, scorePepRisk, scoreNews2,
  type TokyoCholangitisInputs, type TokyoCholecystitisInputs,
  type RansonAdmissionInputs, type Ranson48hInputs,
  type BisapInputs, type ErpRiskInputs,
  type ExtractedLabs, type ScoringVitals,
} from '@/lib/clinical-scores';

// ── Colour tokens ─────────────────────────────────────────────────────────────
const BADGE: Record<'green' | 'amber' | 'red', React.CSSProperties> = {
  green: { background: '#dcfce7', color: '#166534', border: '1px solid #86efac' },
  amber: { background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047' },
  red:   { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' },
};

const PANEL: React.CSSProperties = {
  background: 'var(--card-bg, #1e2535)',
  border: '1px solid var(--border, #2d3748)',
  borderRadius: 10,
  padding: '12px 14px',
  marginBottom: 10,
};

const LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.08em', color: 'var(--text-muted, #94a3b8)',
  marginBottom: 4,
};

const ROW: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap',
};

const CHIP: React.CSSProperties = {
  fontSize: 11, padding: '3px 8px', borderRadius: 5, border: 'none',
  cursor: 'pointer', fontWeight: 600,
};

const TOGGLE = (on: boolean): React.CSSProperties => on
  ? { ...CHIP, background: '#0d9488', color: '#fff' }
  : { ...CHIP, background: 'var(--btn-bg, #2d3748)', color: 'var(--text, #e2e8f0)' };

function grade(label: string, colour: 'green' | 'amber' | 'red', sub?: string) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ ...BADGE[colour], borderRadius: 6, padding: '2px 10px', fontWeight: 800, fontSize: 13 }}>
        {label}
      </span>
      {sub && <span style={{ fontSize: 12, color: 'var(--text, #e2e8f0)' }}>{sub}</span>}
    </div>
  );
}

function CriteriaList({ items, colour }: { items: string[]; colour: 'green' | 'amber' | 'red' }) {
  if (!items.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
      {items.map(c => (
        <span key={c} style={{ ...BADGE[colour], fontSize: 10, padding: '1px 6px', borderRadius: 4 }}>{c}</span>
      ))}
    </div>
  );
}

function MissingBadge({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div style={{ marginTop: 6, fontSize: 10, color: '#94a3b8' }}>
      Missing: {items.join(', ')}
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange(v: boolean): void }) {
  return (
    <button type="button" style={TOGGLE(value)} onClick={() => onChange(!value)}>
      {value ? '✓ ' : ''}{label}
    </button>
  );
}

// ── Context detection — which scores to show ──────────────────────────────────
function useRelevantScores() {
  const { activeCcKey, encounterType, extractedLabs, symptoms, hpiNotes, assessment, differentials } = useAppContext();
  const allText = [activeCcKey ?? '', hpiNotes, assessment, differentials, symptoms.join(' ')].join(' ').toLowerCase();

  const isBiliary = /cholangi|cholecyst|bile|biliary|jaundice|ercp|cbd|gallbladder|gallstone/.test(allText)
    || activeCcKey === 'ercp' || activeCcKey === 'jaundice';
  const isPancreatitis = /pancreat/.test(allText) || (extractedLabs.amylase && extractedLabs.amylase > 300) || false;
  const isErcp = encounterType === 'endoscopy' || activeCcKey === 'ercp'
    || /ercp|endoscop/.test((encounterType ?? '') + allText);
  const isEmergency = encounterType === 'major_emergency';

  return { isBiliary, isPancreatitis, isErcp, isEmergency };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOKYO CHOLANGITIS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function TokyoCholangitisCard() {
  const { extractedLabs, vitals } = useAppContext();
  const [inputs, setInputs] = useState<Partial<TokyoCholangitisInputs>>({
    biliary_dilatation: false, biliary_cause_on_imaging: false,
    organ_dysfunction: [],
  });

  const set = (k: keyof TokyoCholangitisInputs, v: unknown) =>
    setInputs(c => ({ ...c, [k]: v }));

  const labs = extractedLabs as ExtractedLabs;
  const sv: ScoringVitals = {
    temperatureC:    vitals.temperatureC   ? +vitals.temperatureC   : undefined,
    heartRate:       vitals.heartRate      ? +vitals.heartRate      : undefined,
    respiratoryRate: vitals.respiratoryRate? +vitals.respiratoryRate: undefined,
    systolicBp:      vitals.systolicBp     ? +vitals.systolicBp     : undefined,
    spo2:            vitals.spo2           ? +vitals.spo2           : undefined,
  };

  const result = useMemo(() => scoreTokyoCholangitis(inputs, labs, sv), [inputs, labs, sv]);

  const orgOptions = ['cardiovascular', 'neurological', 'respiratory', 'renal', 'hepatic', 'haematological'] as const;
  const toggleOrgan = (o: string) => {
    const cur = inputs.organ_dysfunction ?? [];
    set('organ_dysfunction', cur.includes(o as never) ? cur.filter(x => x !== o) : [...cur, o]);
  };

  return (
    <div style={PANEL}>
      <div style={LABEL}>Tokyo TG18 — Acute Cholangitis</div>
      {grade(`Grade ${result.grade}`, result.colour, result.label)}

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>Imaging / clinical findings</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          <Toggle label="Biliary dilatation" value={!!inputs.biliary_dilatation} onChange={v => set('biliary_dilatation', v)} />
          <Toggle label="Stone / stricture / stent on imaging" value={!!inputs.biliary_cause_on_imaging} onChange={v => set('biliary_cause_on_imaging', v)} />
          <Toggle label="Jaundice (clinical)" value={!!inputs.jaundice} onChange={v => set('jaundice', v)} />
          <Toggle label="Fever / rigors" value={!!inputs.fever_or_chills} onChange={v => set('fever_or_chills', v)} />
          <Toggle label="High fever ≥39 °C" value={!!inputs.high_fever} onChange={v => set('high_fever', v)} />
          <Toggle label="Age ≥75" value={!!inputs.age_over_75} onChange={v => set('age_over_75', v)} />
          <Toggle label="Bilirubin ≥85 µmol/L" value={!!inputs.bilirubin_high} onChange={v => set('bilirubin_high', v)} />
        </div>
      </div>

      <div>
        <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>Organ dysfunction (any → Grade III)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {orgOptions.map(o => (
            <Toggle key={o} label={o.charAt(0).toUpperCase() + o.slice(1)}
              value={(inputs.organ_dysfunction ?? []).includes(o)}
              onChange={() => toggleOrgan(o)} />
          ))}
        </div>
      </div>

      <CriteriaList items={result.criteria_met} colour={result.colour} />
      <MissingBadge items={result.missing_inputs} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOKYO CHOLECYSTITIS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function TokyoCholecystitisCard() {
  const { extractedLabs, vitals } = useAppContext();
  const [inputs, setInputs] = useState<Partial<TokyoCholecystitisInputs>>({
    murphy_sign: false, ruq_pain_mass_tenderness: false, organ_dysfunction: [],
  });

  const set = (k: keyof TokyoCholecystitisInputs, v: unknown) =>
    setInputs(c => ({ ...c, [k]: v }));

  const labs = extractedLabs as ExtractedLabs;
  const sv: ScoringVitals = {
    temperatureC: vitals.temperatureC ? +vitals.temperatureC : undefined,
  };
  const result = useMemo(() => scoreTokyoCholecystitis(inputs, labs, sv), [inputs, labs, sv]);

  const orgOptions = ['cardiovascular', 'neurological', 'respiratory', 'renal', 'hepatic', 'haematological'] as const;

  return (
    <div style={PANEL}>
      <div style={LABEL}>Tokyo TG18 — Acute Cholecystitis</div>
      {grade(`Grade ${result.grade}`, result.colour, result.label)}

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>Local signs (A criteria)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          <Toggle label="Murphy's sign" value={!!inputs.murphy_sign} onChange={v => set('murphy_sign', v)} />
          <Toggle label="RUQ pain / mass / tenderness" value={!!inputs.ruq_pain_mass_tenderness} onChange={v => set('ruq_pain_mass_tenderness', v)} />
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>Imaging (C criteria)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          <Toggle label="Wall thickening >4 mm" value={!!inputs.us_wall_thickening} onChange={v => set('us_wall_thickening', v)} />
          <Toggle label="Pericholecystic fluid" value={!!inputs.us_pericholecystic_fluid} onChange={v => set('us_pericholecystic_fluid', v)} />
          <Toggle label="GB enlargement" value={!!inputs.us_gb_enlargement} onChange={v => set('us_gb_enlargement', v)} />
          <Toggle label="Echo-slurry" value={!!inputs.us_echo_slurry} onChange={v => set('us_echo_slurry', v)} />
          <Toggle label="Non-enhanced area (CT)" value={!!inputs.us_non_enhanced_area} onChange={v => set('us_non_enhanced_area', v)} />
        </div>
      </div>

      <div>
        <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>Organ dysfunction (→ Grade III)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {orgOptions.map(o => (
            <Toggle key={o} label={o.charAt(0).toUpperCase() + o.slice(1)}
              value={(inputs.organ_dysfunction ?? []).includes(o)}
              onChange={() => {
                const cur = inputs.organ_dysfunction ?? [];
                set('organ_dysfunction', cur.includes(o as never) ? cur.filter(x => x !== o) : [...cur, o]);
              }} />
          ))}
        </div>
      </div>

      <CriteriaList items={result.criteria_met} colour={result.colour} />
      <MissingBadge items={result.missing_inputs} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RANSON'S CRITERIA PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function RansonCard() {
  const { extractedLabs, age } = useAppContext();
  const [aetiology, setAetiology] = useState<'gallstone' | 'alcohol'>('gallstone');
  const [show48h, setShow48h] = useState(false);
  const [h48, setH48] = useState<Partial<Ranson48hInputs>>({});

  const admInputs: Partial<RansonAdmissionInputs> = {
    aetiology, age: age ? +age : null,
  };
  const labs = extractedLabs as ExtractedLabs;
  const result = useMemo(
    () => scoreRanson(admInputs, show48h ? h48 : null, labs),
    [aetiology, age, extractedLabs, show48h, h48],
  );

  return (
    <div style={PANEL}>
      <div style={LABEL}>Ranson's Criteria — Acute Pancreatitis</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <button type="button" style={TOGGLE(aetiology === 'gallstone')} onClick={() => setAetiology('gallstone')}>Gallstone</button>
        <button type="button" style={TOGGLE(aetiology === 'alcohol')} onClick={() => setAetiology('alcohol')}>Alcohol</button>
      </div>

      {grade(
        `Score ${result.admission_score}${result.total_score !== null ? `→${result.total_score}` : ''}`,
        result.colour,
        `${result.severity} — predicted mortality ${result.predicted_mortality}`,
      )}

      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
        Admission score uses: age, WBC, glucose, LDH, AST (from vitals + extracted labs).
      </div>
      <CriteriaList items={result.admission_criteria} colour={result.colour} />

      <button type="button"
        style={{ ...CHIP, background: 'none', border: '1px solid #4a5568', color: '#94a3b8', marginTop: 8 }}
        onClick={() => setShow48h(!show48h)}>
        {show48h ? '▲ Hide' : '▼ Add'} 48-hour criteria
      </button>

      {show48h && (
        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {([
            ['urea_rise_mmol', 'BUN rise (mmol/L)'],
            ['pao2_mmhg',       'PaO₂ (mmHg)'],
            ['base_deficit',    'Base deficit (mEq/L)'],
            ['sequestration_litres', 'Fluid sequestration (L)'],
            ['hct_fall_fraction', 'Hct fall (fraction, e.g. 0.10)'],
            ['calcium_mmol',    'Calcium (mmol/L)'],
          ] as [keyof Ranson48hInputs, string][]).map(([k, label]) => (
            <div key={k}>
              <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>{label}</div>
              <input
                type="number" step="0.1"
                style={{ width: '100%', background: '#2d3748', border: '1px solid #4a5568', borderRadius: 5, padding: '4px 8px', color: '#e2e8f0', fontSize: 12 }}
                value={(h48[k] as number | undefined) ?? ''}
                onChange={e => setH48(c => ({ ...c, [k]: e.target.value === '' ? undefined : +e.target.value }))}
              />
            </div>
          ))}
        </div>
      )}

      <MissingBadge items={result.missing_inputs} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BISAP PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function BisapCard() {
  const { extractedLabs, vitals, age } = useAppContext();
  const [inputs, setInputs] = useState<Partial<BisapInputs>>({ pleural_effusion: false });

  const labs = extractedLabs as ExtractedLabs;
  const sv: ScoringVitals = {
    temperatureC:    vitals.temperatureC    ? +vitals.temperatureC    : undefined,
    heartRate:       vitals.heartRate       ? +vitals.heartRate       : undefined,
    respiratoryRate: vitals.respiratoryRate ? +vitals.respiratoryRate : undefined,
  };
  const result = useMemo(() => scoreBisap(
    { ...inputs, age: age ? +age : null },
    labs, sv,
  ), [inputs, age, extractedLabs, vitals]);

  return (
    <div style={PANEL}>
      <div style={LABEL}>BISAP Score — Acute Pancreatitis</div>
      {grade(
        `${result.score}/5`,
        result.colour,
        `Predicted mortality ${result.mortality_risk}`,
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 4 }}>
        <Toggle label="GCS <15" value={inputs.gcs === 14} onChange={v => setInputs(c => ({ ...c, gcs: v ? 14 : 15 }))} />
        <Toggle label="Pleural effusion" value={!!inputs.pleural_effusion} onChange={v => setInputs(c => ({ ...c, pleural_effusion: v }))} />
      </div>
      <CriteriaList items={result.items} colour={result.colour} />
      <MissingBadge items={result.missing_inputs} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERCP PEP RISK PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function PepRiskCard() {
  const { extractedLabs, sex } = useAppContext();
  const [inputs, setInputs] = useState<Partial<ErpRiskInputs>>({
    female: sex === 'female',
  });
  const set = (k: keyof ErpRiskInputs, v: boolean) => setInputs(c => ({ ...c, [k]: v }));

  const labs = extractedLabs as ExtractedLabs;
  const result = useMemo(() => scorePepRisk(inputs, labs), [inputs, labs]);

  const colMap = { low: 'green', moderate: 'amber', high: 'red', very_high: 'red' } as const;

  return (
    <div style={PANEL}>
      <div style={LABEL}>ERCP — Post-ERCP Pancreatitis (PEP) Risk</div>
      {grade(
        result.risk_level.replace('_', ' ').toUpperCase(),
        colMap[result.risk_level],
      )}
      <div style={{ fontSize: 11, color: 'var(--text, #e2e8f0)', marginBottom: 8, lineHeight: 1.5 }}>
        {result.prophylaxis_recommendation}
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>Patient risk factors</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          <Toggle label="Female" value={!!inputs.female} onChange={v => set('female', v)} />
          <Toggle label="Age <50" value={!!inputs.age_under_50} onChange={v => set('age_under_50', v)} />
          <Toggle label="Suspected SOD" value={!!inputs.suspected_sod} onChange={v => set('suspected_sod', v)} />
          <Toggle label="Prior PEP" value={!!inputs.prior_pep} onChange={v => set('prior_pep', v)} />
          <Toggle label="Recurrent pancreatitis" value={!!inputs.recurrent_pancreatitis} onChange={v => set('recurrent_pancreatitis', v)} />
          <Toggle label="Normal bilirubin" value={!!inputs.normal_bilirubin} onChange={v => set('normal_bilirubin', v)} />
          <Toggle label="Non-dilated duct" value={!!inputs.non_dilated_duct} onChange={v => set('non_dilated_duct', v)} />
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>Procedure factors</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          <Toggle label="Difficult cannulation" value={!!inputs.difficult_cannulation} onChange={v => set('difficult_cannulation', v)} />
          <Toggle label="Precut sphincterotomy" value={!!inputs.precut_sphincterotomy} onChange={v => set('precut_sphincterotomy', v)} />
          <Toggle label="Balloon dilation (intact sphincter)" value={!!inputs.balloon_dilation_intact_sphincter} onChange={v => set('balloon_dilation_intact_sphincter', v)} />
          <Toggle label="Pancreatic sphincterotomy" value={!!inputs.pancreatic_sphincterotomy} onChange={v => set('pancreatic_sphincterotomy', v)} />
          <Toggle label="Contrast into PD" value={!!inputs.contrast_into_pancreatic_duct} onChange={v => set('contrast_into_pancreatic_duct', v)} />
          <Toggle label="Trainee operator" value={!!inputs.trainee_operator} onChange={v => set('trainee_operator', v)} />
        </div>
      </div>

      <div>
        <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>Prophylaxis given</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          <Toggle label="Rectal indomethacin" value={!!inputs.rectal_indomethacin_given} onChange={v => set('rectal_indomethacin_given', v)} />
          <Toggle label="Pancreatic stent placed" value={!!inputs.pancreatic_stent_placed} onChange={v => set('pancreatic_stent_placed', v)} />
        </div>
      </div>

      {result.risk_factors.length > 0 && (
        <CriteriaList items={result.risk_factors} colour={colMap[result.risk_level]} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEWS2 PANEL (emergency)
// ═══════════════════════════════════════════════════════════════════════════════
function News2Card() {
  const { vitals } = useAppContext();
  const sv: ScoringVitals = {
    temperatureC:    vitals.temperatureC    ? +vitals.temperatureC    : undefined,
    heartRate:       vitals.heartRate       ? +vitals.heartRate       : undefined,
    respiratoryRate: vitals.respiratoryRate ? +vitals.respiratoryRate : undefined,
    systolicBp:      vitals.systolicBp      ? +vitals.systolicBp      : undefined,
    spo2:            vitals.spo2            ? +vitals.spo2            : undefined,
  };
  const result = useMemo(() => scoreNews2(sv), [vitals]);

  return (
    <div style={PANEL}>
      <div style={LABEL}>NEWS2 — National Early Warning Score</div>
      {grade(
        `${result.score}`,
        result.colour,
        `${result.clinical_risk.replace('_', '-').toUpperCase()} risk — ${result.response}`,
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
        {Object.entries(result.breakdown).map(([k, v]) => (
          <span key={k} style={{
            ...BADGE[v === 0 ? 'green' : v === 1 ? 'amber' : 'red'],
            fontSize: 10, padding: '1px 7px', borderRadius: 4,
          }}>
            {k}: {v}
          </span>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXTRACTED LABS DISPLAY
// ═══════════════════════════════════════════════════════════════════════════════
const LAB_DISPLAY: { key: string; label: string; unit: string; danger?: (v: number) => boolean }[] = [
  { key: 'wbc',             label: 'WBC',        unit: '×10⁹/L', danger: v => v > 12 || v < 4 },
  { key: 'haemoglobin',     label: 'Hb',         unit: 'g/L',    danger: v => v < 115 },
  { key: 'platelets',       label: 'Plt',        unit: '×10⁹/L', danger: v => v < 100 },
  { key: 'inr',             label: 'INR',        unit: '',       danger: v => v > 1.5 },
  { key: 'crp',             label: 'CRP',        unit: 'mg/L',   danger: v => v > 10 },
  { key: 'bilirubin_total', label: 'Bili',       unit: 'µmol/L', danger: v => v > 20 },
  { key: 'alp',             label: 'ALP',        unit: 'IU/L',   danger: v => v > 130 },
  { key: 'ggt',             label: 'GGT',        unit: 'IU/L',   danger: v => v > 65 },
  { key: 'ast',             label: 'AST',        unit: 'IU/L',   danger: v => v > 40 },
  { key: 'alt',             label: 'ALT',        unit: 'IU/L',   danger: v => v > 40 },
  { key: 'albumin',         label: 'Alb',        unit: 'g/L',    danger: v => v < 35 },
  { key: 'urea',            label: 'Urea',       unit: 'mmol/L', danger: v => v > 7.5 },
  { key: 'creatinine',      label: 'Cr',         unit: 'µmol/L', danger: v => v > 110 },
  { key: 'egfr',            label: 'eGFR',       unit: '',       danger: v => v < 60 },
  { key: 'glucose',         label: 'Gluc',       unit: 'mmol/L', danger: v => v > 11 || v < 3.5 },
  { key: 'amylase',         label: 'Amylase',    unit: 'IU/L',   danger: v => v > 100 },
  { key: 'lipase',          label: 'Lipase',     unit: 'IU/L',   danger: v => v > 60 },
  { key: 'ldh',             label: 'LDH',        unit: 'IU/L',   danger: v => v > 250 },
  { key: 'calcium',         label: 'Ca²⁺',       unit: 'mmol/L', danger: v => v < 2.1 || v > 2.6 },
];

function ExtractedLabsRow() {
  const { extractedLabs, setExtractedLabs } = useAppContext();
  const [editing, setEditing] = useState(false);

  const present = LAB_DISPLAY.filter(d => extractedLabs[d.key] !== undefined && extractedLabs[d.key] !== null);
  if (!present.length && !editing) return null;

  return (
    <div style={{ ...PANEL, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={LABEL}>Referral / In-house Labs</span>
        <button type="button"
          style={{ ...CHIP, background: 'none', border: '1px solid #4a5568', color: '#94a3b8', fontSize: 10 }}
          onClick={() => setEditing(!editing)}>
          {editing ? 'Done' : '✎ Edit'}
        </button>
      </div>
      {!editing ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {present.map(d => {
            const v = extractedLabs[d.key] as number;
            const isDanger = d.danger?.(v) ?? false;
            return (
              <span key={d.key} style={{
                ...BADGE[isDanger ? 'red' : 'green'],
                fontSize: 11, padding: '2px 8px', borderRadius: 5, fontWeight: 600,
              }}>
                {d.label} {v}{d.unit ? ` ${d.unit}` : ''}
              </span>
            );
          })}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {LAB_DISPLAY.map(d => (
            <div key={d.key}>
              <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 1 }}>{d.label}{d.unit ? ` (${d.unit})` : ''}</div>
              <input
                type="number" step="0.1"
                style={{ width: '100%', background: '#2d3748', border: '1px solid #4a5568', borderRadius: 5, padding: '3px 6px', color: '#e2e8f0', fontSize: 12 }}
                value={(extractedLabs[d.key] as number | null | undefined) ?? ''}
                onChange={e => setExtractedLabs({ ...extractedLabs, [d.key]: e.target.value === '' ? null : +e.target.value })}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export default function ClinicalScoresPanel() {
  const { isBiliary, isPancreatitis, isErcp, isEmergency } = useRelevantScores();
  const [open, setOpen] = useState(true);

  const hasAny = isBiliary || isPancreatitis || isErcp || isEmergency;
  if (!hasAny) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <button type="button"
        style={{
          display: 'flex', alignItems: 'center', gap: 6, background: 'none',
          border: 'none', cursor: 'pointer', padding: '6px 0', marginBottom: 8,
          color: 'var(--text, #e2e8f0)', fontSize: 13, fontWeight: 700,
        }}
        onClick={() => setOpen(!open)}>
        <span style={{ fontSize: 11 }}>{open ? '▼' : '▶'}</span>
        Clinical Scores
      </button>

      {open && (
        <>
          <ExtractedLabsRow />
          {isEmergency && <News2Card />}
          {isBiliary && <TokyoCholangitisCard />}
          {isBiliary && <TokyoCholecystitisCard />}
          {isPancreatitis && <RansonCard />}
          {isPancreatitis && <BisapCard />}
          {isErcp && <PepRiskCard />}
        </>
      )}
    </div>
  );
}
