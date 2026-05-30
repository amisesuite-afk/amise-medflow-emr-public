import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, ReferenceLine,
  ResponsiveContainer, Tooltip, CartesianGrid,
} from 'recharts';
import { useAppContext, type VitalRecord, type LabRecord } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import WheelPicker from '@/components/WheelPicker';
import CollapsibleCard from '@/components/CollapsibleCard';

// ── Colours ───────────────────────────────────────────────────────────────────
const C = {
  navy: '#0B2545', teal: '#1F7A8C', gold: '#C8A24B',
  muted: '#6B7280', ink: '#1A1A1A',
  green: '#16a34a', amber: '#d97706', red: '#dc2626',
};

// ── Ward level / monitoring protocol ─────────────────────────────────────────
type WardLevel = 'icu' | 'hdu' | 'high_care' | 'general' | 'outpatient';

interface MonitoringProtocol {
  label: string;
  color: string;
  vitalsFreq: string;
  nurseRatio: string;
  nurseRatioNum: string;
  parameters: string[];
  escalation: string[];
  interventions: string[];
}

const PROTOCOLS: Record<WardLevel, MonitoringProtocol> = {
  icu: {
    label: 'ICU / Critical Care',
    color: '#dc2626',
    vitalsFreq: 'Continuous + documented q15–30 min',
    nurseRatio: '1 nurse : 1–2 patients',
    nurseRatioNum: '1:1–2',
    parameters: ['Continuous cardiac monitoring', 'Continuous SpO₂', 'Invasive arterial BP', 'CVP if applicable', 'Hourly urine via IDC', 'Temperature q4h', 'GCS / neuro obs q1h', 'Ventilator parameters if intubated', 'Fluid balance strict q1h'],
    escalation: ['SBP < 90 or > 180 mmHg', 'HR < 40 or > 150 bpm', 'SpO₂ < 90% on O₂', 'RR < 8 or > 30/min', 'Temp > 39.5°C or < 35°C', 'GCS drop ≥ 2 points', 'Urine < 0.5 mL/kg/h × 2 h', 'New arrhythmia'],
    interventions: ['ICU consultant review immediately', 'Rapid response team activation', 'Intensivist on call 24h', 'Anaesthetics airway support PRN'],
  },
  hdu: {
    label: 'HDU / High Dependency',
    color: '#ea580c',
    vitalsFreq: 'q1h (continuous cardiac if indicated)',
    nurseRatio: '1 nurse : 2–3 patients',
    nurseRatioNum: '1:2–3',
    parameters: ['Cardiac monitoring (telemetry)', 'SpO₂ continuous', 'NIBP q1h', 'Temperature q4h', 'Urine output q1–2h via IDC', 'GCS q2h if neuro concern', 'Pain score q2h', 'Fluid balance q4h'],
    escalation: ['SBP < 95 or > 170 mmHg', 'HR < 50 or > 130 bpm', 'SpO₂ < 92% on O₂', 'RR > 25/min', 'Temp > 38.5°C with rigors', 'Urine < 30 mL/h × 2 h', 'Confusion / agitation new onset'],
    interventions: ['Surgical registrar review within 30 min', 'Consider ICU step-up', 'Senior nurse to bedside immediately'],
  },
  high_care: {
    label: 'High Care Ward',
    color: '#d97706',
    vitalsFreq: 'q2–4h',
    nurseRatio: '1 nurse : 4–5 patients',
    nurseRatioNum: '1:4–5',
    parameters: ['NIBP q2–4h', 'SpO₂ intermittent q4h', 'Temperature BD', 'Urine output q4h (IDC or voided)', 'Pain score q4h', 'Wound inspection BD', 'Fluid balance q8h'],
    escalation: ['SBP < 100 or > 160 mmHg', 'HR < 55 or > 120 bpm', 'SpO₂ < 94%', 'Temp > 38.0°C', 'Urine < 200 mL per 4 h shift', 'New pain score ≥ 7'],
    interventions: ['Surgical resident on-call review', 'Consider HDU step-up', 'Notify charge nurse and registrar'],
  },
  general: {
    label: 'General Ward',
    color: '#16a34a',
    vitalsFreq: 'q4–8h (or per NEWS2 score)',
    nurseRatio: '1 nurse : 6–8 patients',
    nurseRatioNum: '1:6–8',
    parameters: ['NIBP q4–8h', 'SpO₂ spot-check q8h', 'Temperature BD', 'Pain score q8h or PRN', 'Urine output q8h (voided)', 'Wound inspection daily'],
    escalation: ['SBP < 100 or > 160 mmHg', 'HR < 60 or > 110 bpm', 'SpO₂ < 95%', 'Temp > 38.0°C', 'Uncontrolled pain ≥ 7'],
    interventions: ['Surgical on-call review within 1 h', 'Consider step-up if NEWS2 ≥ 5'],
  },
  outpatient: {
    label: 'Outpatient / Day Surgery',
    color: '#1F7A8C',
    vitalsFreq: 'On arrival + q30–60 min until discharge criteria met',
    nurseRatio: '1 nurse : 4–6 patients',
    nurseRatioNum: '1:4–6',
    parameters: ['NIBP and HR on arrival', 'SpO₂ on arrival', 'Pain score q30 min post-procedure', 'Temperature if febrile concern', 'Aldrete / modified discharge score q30 min'],
    escalation: ['Unable to meet discharge criteria in 4 h', 'SpO₂ < 95%', 'Pain uncontrolled', 'Nausea / vomiting × 3'],
    interventions: ['Surgeon review before discharge', 'Consider inpatient admission if criteria not met'],
  },
};

// ── Vital parameters for wheel entry ─────────────────────────────────────────
interface VField {
  key: keyof Omit<VitalRecord, 'id' | 'timestamp' | 'recordedBy' | 'ward' | 'notes'>;
  label: string;
  unit: string;
  placeholder: string;
  min: number; max: number; step: number; decimals: number;
  defaultVal: number;
  normalRange: [number, number];
  critLow?: number;
  critHigh?: number;
}

const VFIELDS: VField[] = [
  { key: 'sbp',    label: 'SBP',    unit: 'mmHg',   placeholder: '120', min: 50,  max: 260, step: 1,   decimals: 0, defaultVal: 120, normalRange: [90, 140],  critLow: 80,  critHigh: 180 },
  { key: 'dbp',    label: 'DBP',    unit: 'mmHg',   placeholder: '80',  min: 30,  max: 160, step: 1,   decimals: 0, defaultVal: 80,  normalRange: [60, 90] },
  { key: 'hr',     label: 'HR',     unit: 'bpm',    placeholder: '80',  min: 20,  max: 250, step: 1,   decimals: 0, defaultVal: 80,  normalRange: [60, 100],  critLow: 40,  critHigh: 150 },
  { key: 'temp',   label: 'Temp',   unit: '°C',     placeholder: '37.0',min: 34,  max: 43,  step: 0.1, decimals: 1, defaultVal: 37,  normalRange: [36.1,37.5],critHigh: 39.5 },
  { key: 'spo2',   label: 'SpO₂',   unit: '%',      placeholder: '98',  min: 60,  max: 100, step: 1,   decimals: 0, defaultVal: 98,  normalRange: [95, 100],  critLow: 90 },
  { key: 'rr',     label: 'RR',     unit: '/min',   placeholder: '16',  min: 4,   max: 60,  step: 1,   decimals: 0, defaultVal: 16,  normalRange: [12, 20],   critHigh: 30 },
  { key: 'weight', label: 'Weight', unit: 'kg',     placeholder: '70',  min: 2,   max: 250, step: 0.5, decimals: 1, defaultVal: 70,  normalRange: [40, 130] },
  { key: 'gcs',    label: 'GCS',    unit: '/15',    placeholder: '15',  min: 3,   max: 15,  step: 1,   decimals: 0, defaultVal: 15,  normalRange: [14, 15],   critLow: 9 },
  { key: 'pain',   label: 'Pain',   unit: 'NRS/10', placeholder: '0',   min: 0,   max: 10,  step: 1,   decimals: 0, defaultVal: 0,   normalRange: [0, 3],     critHigh: 7 },
  { key: 'urine',  label: 'Urine',  unit: 'mL/h',   placeholder: '60',  min: 0,   max: 500, step: 5,   decimals: 0, defaultVal: 50,  normalRange: [30, 200] },
];

// ── Lab panels ────────────────────────────────────────────────────────────────
interface LabTest { name: string; unit: string; refRange: string }
const LAB_PANELS: Record<string, LabTest[]> = {
  'FBC': [
    { name: 'Haemoglobin', unit: 'g/dL', refRange: 'M 13.5–17.5 / F 12–16' },
    { name: 'WBC', unit: '×10⁹/L', refRange: '4.0–11.0' },
    { name: 'Neutrophils', unit: '×10⁹/L', refRange: '1.8–7.5' },
    { name: 'Lymphocytes', unit: '×10⁹/L', refRange: '1.0–4.0' },
    { name: 'Platelets', unit: '×10⁹/L', refRange: '150–400' },
    { name: 'Haematocrit', unit: '%', refRange: 'M 40–52 / F 36–48' },
  ],
  'Metabolic / UEC': [
    { name: 'Sodium', unit: 'mmol/L', refRange: '136–145' },
    { name: 'Potassium', unit: 'mmol/L', refRange: '3.5–5.0' },
    { name: 'Chloride', unit: 'mmol/L', refRange: '98–106' },
    { name: 'Bicarbonate', unit: 'mmol/L', refRange: '22–29' },
    { name: 'Creatinine', unit: 'µmol/L', refRange: 'M 62–115 / F 53–97' },
    { name: 'Urea', unit: 'mmol/L', refRange: '2.5–7.8' },
    { name: 'eGFR', unit: 'mL/min/1.73m²', refRange: '>60' },
    { name: 'Glucose', unit: 'mmol/L', refRange: '3.9–6.1 (fasting)' },
  ],
  'LFT / Hepatic': [
    { name: 'ALT', unit: 'U/L', refRange: 'M <45 / F <35' },
    { name: 'AST', unit: 'U/L', refRange: '<40' },
    { name: 'ALP', unit: 'U/L', refRange: '30–130' },
    { name: 'GGT', unit: 'U/L', refRange: 'M <70 / F <45' },
    { name: 'Total Bilirubin', unit: 'µmol/L', refRange: '<21' },
    { name: 'Direct Bilirubin', unit: 'µmol/L', refRange: '<7' },
    { name: 'Albumin', unit: 'g/L', refRange: '35–50' },
    { name: 'Total Protein', unit: 'g/L', refRange: '64–82' },
  ],
  'Coagulation': [
    { name: 'PT', unit: 'seconds', refRange: '11–14' },
    { name: 'INR', unit: '', refRange: '0.8–1.2' },
    { name: 'APTT', unit: 'seconds', refRange: '25–35' },
    { name: 'Fibrinogen', unit: 'g/L', refRange: '2.0–4.0' },
    { name: 'D-Dimer', unit: 'mg/L FEU', refRange: '<0.5' },
  ],
  'Inflammatory / Sepsis': [
    { name: 'CRP', unit: 'mg/L', refRange: '<10' },
    { name: 'ESR', unit: 'mm/hr', refRange: 'M <15 / F <20' },
    { name: 'Procalcitonin', unit: 'µg/L', refRange: '<0.1' },
    { name: 'Lactate', unit: 'mmol/L', refRange: '<2.0' },
  ],
  'Cardiac': [
    { name: 'Troponin I', unit: 'ng/L', refRange: '<26 (hs-TnI)' },
    { name: 'Troponin T', unit: 'ng/L', refRange: '<14 (hs-TnT)' },
    { name: 'BNP', unit: 'pg/mL', refRange: '<100' },
    { name: 'NT-proBNP', unit: 'pg/mL', refRange: '<125 (<75 yr)' },
    { name: 'CK', unit: 'U/L', refRange: 'M 55–170 / F 30–135' },
  ],
  'Pancreatic / GI': [
    { name: 'Amylase', unit: 'U/L', refRange: '28–100' },
    { name: 'Lipase', unit: 'U/L', refRange: '7–60' },
    { name: 'CA 19-9', unit: 'U/mL', refRange: '<37' },
    { name: 'CEA', unit: 'µg/L', refRange: '<5.0' },
    { name: 'AFP', unit: 'µg/L', refRange: '<10' },
  ],
};

// ── SVG sparkline ─────────────────────────────────────────────────────────────
function vitalFlag(field: VField, value: string): 'normal' | 'warn' | 'critical' {
  const v = parseFloat(value);
  if (!Number.isFinite(v) || !value) return 'normal';
  if ((field.critLow != null && v < field.critLow) || (field.critHigh != null && v > field.critHigh)) return 'critical';
  if (v < field.normalRange[0] || v > field.normalRange[1]) return 'warn';
  return 'normal';
}

const STATUS_COLOR: Record<string, string> = { normal: C.green, warn: C.amber, critical: C.red };

// ── Tiny trend chart ──────────────────────────────────────────────────────────
function VitalChart({ records, field }: { records: VitalRecord[]; field: VField }) {
  const data = records
    .slice(-48)
    .filter(r => r[field.key] && Number.isFinite(parseFloat(r[field.key] ?? '')))
    .map(r => ({
      t: r.timestamp.slice(11, 16),
      v: parseFloat(r[field.key] ?? '0'),
    }));

  if (data.length < 2) {
    return (
      <div style={{ height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 11 }}>
        ≥ 2 readings needed
      </div>
    );
  }

  const vals = data.map(d => d.v);
  const mn = Math.min(...vals, field.normalRange[0]) - 2;
  const mx = Math.max(...vals, field.normalRange[1]) + 2;

  return (
    <ResponsiveContainer width="100%" height={70}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="t" tick={{ fontSize: 9, fill: C.muted }} interval="preserveStartEnd" />
        <YAxis domain={[mn, mx]} tick={{ fontSize: 9, fill: C.muted }} width={30} />
        <Tooltip contentStyle={{ fontSize: 11, padding: '4px 8px' }} labelStyle={{ fontSize: 10 }} />
        <ReferenceLine y={field.normalRange[0]} stroke={C.amber} strokeDasharray="3 2" strokeWidth={1} />
        <ReferenceLine y={field.normalRange[1]} stroke={C.amber} strokeDasharray="3 2" strokeWidth={1} />
        {field.critLow != null && <ReferenceLine y={field.critLow} stroke={C.red} strokeDasharray="4 2" strokeWidth={1.5} />}
        {field.critHigh != null && <ReferenceLine y={field.critHigh} stroke={C.red} strokeDasharray="4 2" strokeWidth={1.5} />}
        <Line type="monotone" dataKey="v" stroke={C.teal} strokeWidth={2} dot={{ r: 2, fill: C.teal }} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Latest vital display card ─────────────────────────────────────────────────
function LatestCard({ field, records }: { field: VField; records: VitalRecord[] }) {
  const latest = records.filter(r => r[field.key]).at(-1);
  const val = latest?.[field.key] ?? '';
  const flag = vitalFlag(field, val);
  const color = STATUS_COLOR[flag];
  const prev = records.filter(r => r[field.key]).at(-2)?.[field.key] ?? '';
  const trend = val && prev ? (parseFloat(val) > parseFloat(prev) ? '↑' : parseFloat(val) < parseFloat(prev) ? '↓' : '→') : '';

  return (
    <div style={{
      border: `2px solid ${flag === 'normal' ? '#e5e7eb' : color}`,
      borderRadius: 10, padding: '8px 12px', textAlign: 'center',
      background: flag === 'critical' ? '#fef2f2' : flag === 'warn' ? '#fffbeb' : '#f8fafc',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
        {field.label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 900, color: val ? color : '#d1d5db', lineHeight: 1 }}>
        {val || '—'} {trend && <span style={{ fontSize: 14 }}>{trend}</span>}
      </div>
      <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{field.unit}</div>
      <div style={{ fontSize: 9, color: C.muted, marginTop: 1 }}>
        {field.normalRange[0]}–{field.normalRange[1]}
      </div>
      {latest && <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>{latest.timestamp.slice(11, 16)}</div>}
    </div>
  );
}

// ── Clinical gap analysis ─────────────────────────────────────────────────────
function useGapAnalysis(records: VitalRecord[], wardLevel: WardLevel) {
  return useMemo(() => {
    const gaps: string[] = [];
    const freqH = wardLevel === 'icu' ? 0.5 : wardLevel === 'hdu' ? 1 : wardLevel === 'high_care' ? 4 : 8;
    const cutoff = Date.now() - freqH * 60 * 60 * 1000;
    const recent = records.filter(r => new Date(r.timestamp).getTime() > cutoff);

    const requiredVitals: Array<keyof VitalRecord> =
      wardLevel === 'icu'  ? ['sbp', 'hr', 'spo2', 'rr', 'temp', 'gcs', 'urine'] :
      wardLevel === 'hdu'  ? ['sbp', 'hr', 'spo2', 'rr', 'temp'] :
      ['sbp', 'hr', 'spo2', 'temp'];

    for (const v of requiredVitals) {
      if (!recent.some(r => r[v])) {
        const labels: Record<string, string> = { sbp: 'SBP', dbp: 'DBP', hr: 'Heart rate', spo2: 'SpO₂', rr: 'Resp rate', temp: 'Temperature', gcs: 'GCS', urine: 'Urine output' };
        gaps.push(`${labels[v] ?? v} not recorded in past ${freqH < 1 ? `${freqH * 60} min` : freqH === 1 ? '1 h' : `${freqH} h`}`);
      }
    }

    const latestCritical = records
      .slice(-10)
      .flatMap(r => {
        const flags: string[] = [];
        const fields: VField[] = VFIELDS;
        for (const f of fields) {
          const v = r[f.key] ?? '';
          if (vitalFlag(f, v) === 'critical') flags.push(`${f.label} ${v} ${f.unit}`);
        }
        return flags;
      });
    if (latestCritical.length) {
      gaps.unshift(...latestCritical.slice(0, 3).map(t => `⚠ Critical value: ${t}`));
    }

    return gaps;
  }, [records, wardLevel]);
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function VitalsMonitoringTab() {
  const ctx = useAppContext();
  const { profile } = useAuth();

  // ── Ward level (local — operational, not patient demographic) ────────────
  const defaultWard = useMemo<WardLevel>(() => {
    const a = ctx.triageResult.acuity;
    if (a === 'urgent') return ctx.encounterMode === 'inpatient' ? 'icu' : 'hdu';
    if (a === 'priority') return 'hdu';
    if (a === 'review') return ctx.encounterMode === 'inpatient' ? 'high_care' : 'general';
    return ctx.encounterMode === 'inpatient' ? 'general' : 'outpatient';
  }, [ctx.triageResult.acuity, ctx.encounterMode]);

  const [wardLevel, setWardLevel] = useState<WardLevel>(defaultWard);
  const proto = PROTOCOLS[wardLevel];

  // ── Vitals entry form ────────────────────────────────────────────────────
  const [formVals, setFormVals] = useState<Record<string, string>>({});
  const [recorder, setRecorder] = useState(profile?.full_name ?? '');
  const [recWard, setRecWard] = useState(ctx.ward ?? '');
  const [recNotes, setRecNotes] = useState('');
  const [recTime, setRecTime] = useState(() => new Date().toISOString().slice(0, 16));

  function handleRecord() {
    const hasAny = VFIELDS.some(f => formVals[f.key]?.trim());
    if (!hasAny) return;
    const rec: VitalRecord = {
      id: crypto.randomUUID(),
      timestamp: recTime || new Date().toISOString().slice(0, 16),
      recordedBy: recorder || 'Nurse',
      ward: recWard || ctx.ward || undefined,
      notes: recNotes || undefined,
    };
    for (const f of VFIELDS) {
      const v = formVals[f.key];
      if (v?.trim()) (rec as unknown as Record<string, string>)[f.key] = v;
    }
    ctx.setVitalRecords([...ctx.vitalRecords, rec]);
    setFormVals({});
    setRecNotes('');
    setRecTime(new Date().toISOString().slice(0, 16));
  }

  // ── Lab entry state ──────────────────────────────────────────────────────
  const [labPanel, setLabPanel] = useState<string>('FBC');
  const [labVals, setLabVals] = useState<Record<string, string>>({});
  const [labFlags, setLabFlags] = useState<Record<string, '' | 'H' | 'L' | 'C'>>({});
  const [labRecorder, setLabRecorder] = useState(profile?.full_name ?? 'Lab');
  const [labTime, setLabTime] = useState(() => new Date().toISOString().slice(0, 16));

  function handleLabSave() {
    const tests = (LAB_PANELS[labPanel] ?? [])
      .filter(t => labVals[t.name]?.trim())
      .map(t => ({
        name: t.name,
        value: labVals[t.name] ?? '',
        unit: t.unit,
        refRange: t.refRange,
        flag: labFlags[t.name] ?? '' as '' | 'H' | 'L' | 'C',
      }));
    if (!tests.length) return;
    const rec: LabRecord = {
      id: crypto.randomUUID(),
      timestamp: labTime || new Date().toISOString().slice(0, 16),
      recordedBy: labRecorder || 'Lab',
      panel: labPanel,
      tests,
    };
    ctx.setLabRecords([...ctx.labRecords, rec]);
    setLabVals({});
    setLabFlags({});
    setLabTime(new Date().toISOString().slice(0, 16));
  }

  const gaps = useGapAnalysis(ctx.vitalRecords, wardLevel);

  // ── Styles ────────────────────────────────────────────────────────────────
  const INP: React.CSSProperties = { width: '100%', padding: '6px 9px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' };
  const BTN: React.CSSProperties = { padding: '7px 16px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 };
  const CHIP: React.CSSProperties = { padding: '3px 10px', borderRadius: 14, fontSize: 11, cursor: 'pointer', fontWeight: 700, border: '1.5px solid', display: 'inline-block' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', borderBottom: `2px solid ${C.teal}`, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 800, fontSize: 14, color: C.navy, flex: 1 }}>
          Vital Signs Monitoring {ctx.encounterMode === 'inpatient' ? '· Inpatient' : '· Outpatient'}
        </span>
        <span style={{ fontSize: 12, color: C.muted }}>{ctx.vitalRecords.length} readings · {ctx.labRecords.length} lab panels</span>
      </div>

      {/* ── Ward level selector ── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, minWidth: 70 }}>Ward level:</span>
        {(Object.keys(PROTOCOLS) as WardLevel[]).map(w => {
          const p = PROTOCOLS[w];
          const on = wardLevel === w;
          return (
            <button key={w} type="button" onClick={() => setWardLevel(w)}
              style={{ ...CHIP, borderColor: on ? p.color : '#d1d5db', background: on ? p.color : '#f9fafb', color: on ? '#fff' : C.muted }}>
              {p.label}
            </button>
          );
        })}
      </div>

      {/* ── Clinical gap alerts ── */}
      {gaps.length > 0 && (
        <div style={{ background: '#fff7ed', border: `1px solid #fed7aa`, borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#c2410c', marginBottom: 6 }}>Documentation gaps / alerts</div>
          {gaps.map((g, i) => (
            <div key={i} style={{ fontSize: 12, color: g.startsWith('⚠') ? C.red : '#92400e', marginBottom: 2 }}>
              {g.startsWith('⚠') ? g : `• ${g}`}
            </div>
          ))}
        </div>
      )}

      {/* ── Monitoring protocol card ── */}
      <CollapsibleCard title={`Protocol: ${proto.label} · Nurse ratio ${proto.nurseRatioNum}`} defaultOpen>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px 20px' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: proto.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Monitoring frequency
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{proto.vitalsFreq}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>Nurse:Patient Ratio</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: proto.color }}>{proto.nurseRatio}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: proto.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Parameters to monitor
            </div>
            {proto.parameters.map(p => <div key={p} style={{ fontSize: 11, color: C.ink, marginBottom: 2 }}>• {p}</div>)}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.red, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Escalation thresholds
            </div>
            {proto.escalation.map(e => <div key={e} style={{ fontSize: 11, color: '#991b1b', marginBottom: 2 }}>⚑ {e}</div>)}
            <div style={{ fontSize: 11, fontWeight: 700, color: C.navy, marginTop: 8, marginBottom: 4 }}>Interventions</div>
            {proto.interventions.map(i => <div key={i} style={{ fontSize: 11, color: C.ink, marginBottom: 2 }}>→ {i}</div>)}
          </div>
        </div>
      </CollapsibleCard>

      {/* ── Latest vitals dashboard ── */}
      {ctx.vitalRecords.length > 0 && (
        <CollapsibleCard title="Current Status — Latest Values" defaultOpen>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 10 }}>
            {VFIELDS.filter(f => f.key !== 'dbp').map(f => (
              <LatestCard key={f.key} field={f} records={ctx.vitalRecords} />
            ))}
          </div>
          {ctx.vitalRecords.length > 0 && (
            <div style={{ fontSize: 11, color: C.muted, textAlign: 'right' }}>
              Last recorded: {ctx.vitalRecords.at(-1)?.timestamp.replace('T', ' ').slice(0, 16)} by {ctx.vitalRecords.at(-1)?.recordedBy}
            </div>
          )}
        </CollapsibleCard>
      )}

      {/* ── Vitals entry — wheel format ── */}
      <CollapsibleCard title="Record Vitals — Wheel Entry" defaultOpen>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Scroll wheel to set value · or type directly below each wheel</div>

        {/* Meta row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto 1fr', gap: '6px 12px', marginBottom: 12, alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 3 }}>Time / Date</label>
            <input type="datetime-local" value={recTime} onChange={e => setRecTime(e.target.value)} style={INP} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 3 }}>Recorded by</label>
            <input value={recorder} onChange={e => setRecorder(e.target.value)} placeholder="Nurse name / badge" style={INP} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 3 }}>Ward / Unit</label>
            <input value={recWard} onChange={e => setRecWard(e.target.value)} placeholder="ICU / HDU / Ward 3" style={INP} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 3 }}>Notes (optional)</label>
            <input value={recNotes} onChange={e => setRecNotes(e.target.value)} placeholder="Post-op, on O₂ 2L…" style={INP} />
          </div>
        </div>

        {/* Wheel row */}
        <div style={{ overflowX: 'auto', paddingBottom: 10 }}>
          <div style={{ display: 'flex', gap: 12, minWidth: 'max-content' }}>
            {VFIELDS.map(f => {
              const val = formVals[f.key] ?? '';
              const flag = vitalFlag(f, val);
              const col = STATUS_COLOR[flag];
              return (
                <div key={f.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 88 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: flag === 'normal' ? C.muted : col }}>
                    {f.label}
                  </span>
                  <WheelPicker
                    value={val}
                    onChange={v => setFormVals(p => ({ ...p, [f.key]: v }))}
                    min={f.min} max={f.max} step={f.step}
                    decimals={f.decimals} defaultVal={f.defaultVal}
                    normalRange={f.normalRange}
                  />
                  <input
                    inputMode="decimal" value={val}
                    onChange={e => setFormVals(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={{
                      width: 80, fontSize: 13, padding: '5px 6px', textAlign: 'center',
                      borderRadius: 6, border: `1.5px solid ${flag !== 'normal' ? col : '#d1d5db'}`,
                      background: flag === 'critical' ? '#fef2f2' : flag === 'warn' ? '#fffbeb' : '#fff',
                      color: flag !== 'normal' ? col : C.ink, boxSizing: 'border-box',
                    }}
                  />
                  <span style={{ fontSize: 9, color: flag !== 'normal' ? col : C.muted, fontWeight: flag !== 'normal' ? 700 : 400 }}>
                    {flag === 'critical' ? '🔴 ' : flag === 'warn' ? '⚠ ' : ''}{f.unit}
                  </span>
                  <span style={{ fontSize: 9, color: '#9ca3af' }}>
                    {f.normalRange[0]}–{f.normalRange[1]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" onClick={handleRecord} style={{ ...BTN, background: C.teal, color: '#fff', fontSize: 13, padding: '9px 20px' }}>
            + Record Vitals
          </button>
        </div>
      </CollapsibleCard>

      {/* ── Trend charts ── */}
      {ctx.vitalRecords.length >= 2 && (
        <CollapsibleCard title={`Trend Charts (${ctx.vitalRecords.length} readings)`} defaultOpen>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
            {VFIELDS.filter(f => f.key !== 'dbp').map(f => {
              const hasData = ctx.vitalRecords.some(r => r[f.key]);
              if (!hasData) return null;
              return (
                <div key={f.key}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
                    {f.label} ({f.unit})
                    <span style={{ fontWeight: 400, marginLeft: 6 }}>Normal {f.normalRange[0]}–{f.normalRange[1]}{f.critLow != null || f.critHigh != null ? ` · Critical ${f.critLow ?? ''}${f.critLow != null && f.critHigh != null ? '/' : ''}${f.critHigh ?? ''}` : ''}</span>
                  </div>
                  <VitalChart records={ctx.vitalRecords} field={f} />
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: C.muted }}>
            — Amber dashed: normal range  · — Red dashed: critical threshold
          </div>
        </CollapsibleCard>
      )}

      {/* ── Vitals history table ── */}
      {ctx.vitalRecords.length > 0 && (
        <CollapsibleCard title={`Vitals History (${ctx.vitalRecords.length})`} defaultOpen={false}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  {['Time', 'By', 'Ward', 'SBP/DBP', 'HR', 'Temp', 'SpO₂', 'RR', 'GCS', 'Pain', 'Urine', 'Notes', ''].map(h => (
                    <th key={h} style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 700, color: C.muted, borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...ctx.vitalRecords].reverse().map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '4px 8px', whiteSpace: 'nowrap', color: C.muted }}>{r.timestamp.replace('T', ' ').slice(0, 16)}</td>
                    <td style={{ padding: '4px 8px', whiteSpace: 'nowrap' }}>{r.recordedBy}</td>
                    <td style={{ padding: '4px 8px', color: C.muted }}>{r.ward ?? '—'}</td>
                    {[
                      r.sbp ? `${r.sbp}${r.dbp ? '/' + r.dbp : ''}` : '—',
                      r.hr ?? '—', r.temp ?? '—', r.spo2 ?? '—',
                      r.rr ?? '—', r.gcs ?? '—', r.pain ?? '—', r.urine ?? '—',
                      r.notes ?? '—',
                    ].map((v, i) => (
                      <td key={i} style={{ padding: '4px 8px', fontWeight: v !== '—' ? 600 : 400, color: v !== '—' ? C.ink : '#d1d5db' }}>{v}</td>
                    ))}
                    <td style={{ padding: '4px 8px' }}>
                      <button type="button" onClick={() => ctx.setVitalRecords(ctx.vitalRecords.filter(x => x.id !== r.id))}
                        style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 14 }}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleCard>
      )}

      {/* ── Lab results entry ── */}
      <CollapsibleCard title="Blood Results Entry" defaultOpen={false}>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>For lab staff to enter blood results directly. Flag: H = High · L = Low · C = Critical.</div>

        {/* Panel selector */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {Object.keys(LAB_PANELS).map(p => (
            <button key={p} type="button" onClick={() => { setLabPanel(p); setLabVals({}); setLabFlags({}); }}
              style={{ ...CHIP, borderColor: labPanel === p ? C.navy : '#d1d5db', background: labPanel === p ? C.navy : '#f9fafb', color: labPanel === p ? '#fff' : C.muted }}>
              {p}
            </button>
          ))}
        </div>

        {/* Recorder meta */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 3 }}>Sample time</label>
            <input type="datetime-local" value={labTime} onChange={e => setLabTime(e.target.value)} style={INP} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 3 }}>Recorded by</label>
            <input value={labRecorder} onChange={e => setLabRecorder(e.target.value)} placeholder="Lab technician name" style={INP} />
          </div>
        </div>

        {/* Lab test entry grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px', gap: '4px 8px', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase' }}>Test (ref range)</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase' }}>Result</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase' }}>Flag</div>
          {(LAB_PANELS[labPanel] ?? []).map(t => {
            const val = labVals[t.name] ?? '';
            const flag = labFlags[t.name] ?? '';
            return (
              <>
                <div key={t.name + 'l'} style={{ fontSize: 12 }}>
                  <span style={{ fontWeight: 600 }}>{t.name}</span>
                  <span style={{ color: C.muted, marginLeft: 6, fontSize: 10 }}>{t.refRange} {t.unit}</span>
                </div>
                <input key={t.name + 'v'} inputMode="decimal" value={val}
                  onChange={e => setLabVals(p => ({ ...p, [t.name]: e.target.value }))}
                  placeholder="—"
                  style={{ ...INP, padding: '4px 7px', fontSize: 12, borderColor: flag === 'C' ? C.red : flag === 'H' || flag === 'L' ? C.amber : '#d1d5db' }}
                />
                <select key={t.name + 'f'} value={flag}
                  onChange={e => setLabFlags(p => ({ ...p, [t.name]: e.target.value as '' | 'H' | 'L' | 'C' }))}
                  style={{ ...INP, padding: '4px 6px', fontSize: 12, background: flag === 'C' ? '#fef2f2' : flag === 'H' ? '#fff7ed' : flag === 'L' ? '#eff6ff' : '#fff' }}>
                  <option value="">—</option>
                  <option value="H">H ↑</option>
                  <option value="L">L ↓</option>
                  <option value="C">C !</option>
                </select>
              </>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={handleLabSave} style={{ ...BTN, background: C.navy, color: '#fff' }}>
            + Save Lab Results
          </button>
        </div>
      </CollapsibleCard>

      {/* ── Lab results history ── */}
      {ctx.labRecords.length > 0 && (
        <CollapsibleCard title={`Lab History (${ctx.labRecords.length} panels)`} defaultOpen={false}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...ctx.labRecords].reverse().map(rec => (
              <div key={rec.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ background: C.navy + '10', padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 12, color: C.navy }}>{rec.panel} · {rec.timestamp.replace('T', ' ').slice(0, 16)} · {rec.recordedBy}</span>
                  <button type="button" onClick={() => ctx.setLabRecords(ctx.labRecords.filter(r => r.id !== rec.id))}
                    style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 14 }}>×</button>
                </div>
                <div style={{ padding: '6px 12px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px 12px' }}>
                  {rec.tests.map(t => {
                    const col = t.flag === 'C' ? C.red : t.flag === 'H' || t.flag === 'L' ? C.amber : C.ink;
                    return (
                      <div key={t.name} style={{ fontSize: 11 }}>
                        <span style={{ color: C.muted }}>{t.name}: </span>
                        <span style={{ fontWeight: 700, color: col }}>{t.value} {t.unit}</span>
                        {t.flag && <span style={{ color: col, marginLeft: 3 }}>{t.flag}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleCard>
      )}

    </div>
  );
}
