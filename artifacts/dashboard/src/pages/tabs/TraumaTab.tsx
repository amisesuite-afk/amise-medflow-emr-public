import { useMemo } from 'react';
import { useAppContext, EMPTY_TRAUMA_DATA } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import { ManagementPanel } from '@/components/ManagementPanel';
import {
  ISS_REGIONS, AIS_LABELS,
  issScore, nissScore, interpretIss,
  BURN_REGIONS, BURN_DEGREE_LABELS,
  calcTbsa, parklandFormula, bauxScore, interpretBaux,
  type BurnDegree,
} from '@/lib/clinical-scales';

// ── Constants ───────────────────────────────────────────────────────────────

const MECHANISMS = ['Blunt', 'Penetrating', 'Burns', 'Blast', 'Fall', 'RTA'];
const PRE_HOSPITAL_OPTIONS = ['IV access', 'Fluid given', 'Splint / immobilisation', 'Tourniquet', 'Intubation', 'CPR', 'Haemostasis', 'O2 applied', 'Immobilisation board'];

const ADMISSION_VITALS_FIELDS: { key: string; label: string; unit: string; placeholder?: string; span?: boolean }[] = [
  { key: 'timeAdmission', label: 'Time of admission', unit: '', placeholder: '', span: true },
  { key: 'hr',      label: 'HR',       unit: '/min',  placeholder: '' },
  { key: 'sbp',     label: 'SBP',      unit: 'mmHg',  placeholder: '' },
  { key: 'dbp',     label: 'DBP',      unit: 'mmHg',  placeholder: '' },
  { key: 'rr',      label: 'RR',       unit: '/min',  placeholder: '12–20' },
  { key: 'spo2',    label: 'SpO2',     unit: '%',     placeholder: '≥94' },
  { key: 'temp',    label: 'Temp',     unit: '°C',    placeholder: '36–37.5' },
  { key: 'gcsTotal',label: 'GCS total',unit: '/15',   placeholder: '3–15' },
  { key: 'bm',      label: 'Blood glucose', unit: 'mmol/L', placeholder: '3.5–7.8' },
  { key: 'pupils',  label: 'Pupils',   unit: '',      placeholder: 'PERLA / abnormal', span: true },
  { key: 'painScore',label: 'Pain',    unit: '/10',   placeholder: '0–10' },
];

const ABCDE_CONFIG: {
  key: string; title: string; hint: string; color: string;
  dropdowns: { key: string; label: string; options: string[] }[];
  numerics: { key: string; label: string; unit: string; placeholder: string }[];
  gcs?: boolean;
}[] = [
  {
    key: 'A', title: 'Airway + C-spine', color: '#dc2626',
    hint: 'Patency, C-spine immobilisation, airway adjunct',
    dropdowns: [
      { key: 'airwayStatus', label: 'Airway status', options: ['Patent', 'Noisy / Partially obstructed', 'Obstructed', 'Secured — ETT', 'Secured — LMA', 'Surgical airway (cric)'] },
      { key: 'cSpine',       label: 'C-spine',       options: ['Hard collar applied', 'Cleared clinically (NEXUS / CCR)', 'Cleared radiologically', 'Not immobilised'] },
      { key: 'adjunct',      label: 'Airway adjunct', options: ['None', 'OPA', 'NPA', 'ETT (size noted)', 'LMA', 'Cricothyroidotomy'] },
    ],
    numerics: [],
  },
  {
    key: 'B', title: 'Breathing', color: '#f97316',
    hint: 'Chest movement, air entry, SpO2, RR, intervention',
    dropdowns: [
      { key: 'chestMovement', label: 'Chest movement', options: ['Symmetrical', 'Asymmetrical — left reduced', 'Asymmetrical — right reduced', 'Paradoxical'] },
      { key: 'airEntry',      label: 'Air entry',      options: ['Bilateral equal', 'Reduced — left', 'Reduced — right', 'Absent — left', 'Absent — right'] },
      { key: 'percussion',    label: 'Percussion',     options: ['Normal', 'Hyper-resonant (L)', 'Hyper-resonant (R)', 'Dull (L)', 'Dull (R)'] },
      { key: 'o2Delivery',    label: 'O2 delivery',    options: ['None', 'Nasal prongs', 'Face mask', 'NRB mask (15 L/min)', 'BVM ventilation', 'Mechanically ventilated'] },
      { key: 'intervention',  label: 'Intervention',   options: ['None', 'Needle decompression (L)', 'Needle decompression (R)', 'Chest drain (L)', 'Chest drain (R)'] },
    ],
    numerics: [
      { key: 'rr',     label: 'RR',          unit: '/min', placeholder: '12–20' },
      { key: 'spo2Air',label: 'SpO2 on air', unit: '%',    placeholder: '≥94' },
      { key: 'spo2O2', label: 'SpO2 on O2',  unit: '%',    placeholder: '' },
    ],
  },
  {
    key: 'C', title: 'Circulation', color: '#ef4444',
    hint: 'HR, BP, cap refill, haemorrhage, IV access, fluid resuscitation',
    dropdowns: [
      { key: 'capRefill',  label: 'Cap refill',      options: ['Normal (<2s)', 'Delayed (>2s)', 'Absent'] },
      { key: 'haemorrhage',label: 'Haemorrhage',     options: ['None obvious', 'External — controlled', 'External — uncontrolled', 'Internal — suspected', 'External + internal'] },
      { key: 'haemClass',  label: 'Haem class',      options: ['None', 'Class I (<15% / <750 mL)', 'Class II (15–30% / 750–1500 mL)', 'Class III (30–40% / 1500–2000 mL)', 'Class IV (>40% / >2000 mL)'] },
      { key: 'ivAccess',   label: 'IV access',       options: ['None', '1 × peripheral IV', '2 × peripheral IV', 'Intraosseous (IO)', 'Central venous access'] },
      { key: 'fluid',      label: 'Fluid given',     options: ['None', 'Crystalloid (LR / NS)', 'Blood products (PRBC)', 'Crystalloid + blood products', 'MTP activated (1:1:1)'] },
    ],
    numerics: [
      { key: 'hr',  label: 'HR',  unit: '/min', placeholder: '' },
      { key: 'sbp', label: 'SBP', unit: 'mmHg', placeholder: '' },
      { key: 'dbp', label: 'DBP', unit: 'mmHg', placeholder: '' },
    ],
  },
  {
    key: 'D', title: 'Disability', color: '#8b5cf6',
    hint: 'GCS (E/V/M), pupils, lateralising signs, blood glucose',
    dropdowns: [
      { key: 'pupils',      label: 'Pupils',           options: ['Equal and reactive (PERLA)', 'Unequal', 'Fixed and dilated — bilateral', 'Fixed and dilated — left', 'Fixed and dilated — right', 'Sluggish reaction'] },
      { key: 'lateralising',label: 'Lateralising signs', options: ['None', 'Right-sided deficit', 'Left-sided deficit', 'Bilateral'] },
    ],
    numerics: [
      { key: 'bm', label: 'Blood glucose', unit: 'mmol/L', placeholder: '3.5–7.8' },
    ],
    gcs: true,
  },
  {
    key: 'E', title: 'Exposure / Environment', color: '#0ea5e9',
    hint: 'Full exposure, temperature, log roll, additional injuries found',
    dropdowns: [
      { key: 'hypothermia',      label: 'Temperature status', options: ['None (>35°C)', 'Mild (32–35°C)', 'Moderate (28–32°C)', 'Severe (<28°C)'] },
      { key: 'logRoll',          label: 'Log roll',           options: ['Completed — no spinal tenderness', 'Completed — spinal tenderness noted', 'Not yet performed', 'Contraindicated'] },
      { key: 'additionalInjury', label: 'Additional injuries', options: ['None additional', 'Lacerations', 'Bruising / contusions', 'Deformity', 'Penetrating wounds', 'Multiple injuries noted'] },
    ],
    numerics: [
      { key: 'temp', label: 'Temperature', unit: '°C', placeholder: '36–37.5' },
    ],
  },
];

const GCS_E_OPTIONS = ['', '1 — None', '2 — To pain', '3 — To voice', '4 — Spontaneous'];
const GCS_V_OPTIONS = ['', '1 — None', '2 — Sounds', '3 — Words', '4 — Confused', '5 — Oriented'];
const GCS_M_OPTIONS = ['', '1 — None', '2 — Extension', '3 — Abnormal flex', '4 — Withdrawal', '5 — Localising', '6 — Obeys'];

const SECONDARY_REGIONS = [
  'Head / Scalp', 'Face', 'Eyes', 'ENT', 'Neck',
  'Chest', 'Abdomen', 'Pelvis', 'Genitourinary', 'Spine (axial)',
  'Left Upper Limb', 'Right Upper Limb', 'Left Lower Limb', 'Right Lower Limb',
  'Neurovascular Status',
];

const SECONDARY_FINDINGS = [
  'Normal', 'Tenderness', 'Laceration', 'Contusion', 'Haematoma',
  'Deformity', 'Swelling', 'Crepitus', 'Penetrating wound', 'Reduced movement', 'Neurovascular deficit',
];

// ── Print label helper ──────────────────────────────────────────────────────

function fmtAbcde(abcde: Record<string, Record<string, string>>, key: string): string {
  const d = abcde[key] ?? {};
  const parts: string[] = [];
  for (const v of Object.values(d)) {
    if (v && !['', '0'].includes(v)) parts.push(v);
  }
  return parts.join(' | ') || '—';
}

// ── Component ───────────────────────────────────────────────────────────────

export default function TraumaTab() {
  const {
    traumaData, setTraumaData,
    weightKg, age,
    patientName, sex,
  } = useAppContext();

  const td = traumaData;
  function update(partial: Partial<typeof traumaData>) {
    setTraumaData(prev => ({ ...prev, ...partial }));
  }
  function updateAbcde(letter: string, field: string, value: string) {
    const updated = { ...td.abcde, [letter]: { ...(td.abcde[letter] ?? {}), [field]: value } };
    update({ abcde: updated });
  }
  function getA(letter: string, field: string): string {
    return td.abcde[letter]?.[field] ?? '';
  }

  function toggleList(list: string[], val: string): string[] {
    return list.includes(val) ? list.filter(v => v !== val) : [...list, val];
  }

  // ISS / NISS
  const iss  = useMemo(() => issScore(td.ais),  [td.ais]);
  const niss = useMemo(() => nissScore(td.ais), [td.ais]);
  const issInterp  = interpretIss(iss);
  const nissInterp = interpretIss(niss);

  // GCS computed from D subfields
  const gcsE = parseInt(getA('D', 'gcsE') || '0') || 0;
  const gcsV = parseInt(getA('D', 'gcsV') || '0') || 0;
  const gcsM = parseInt(getA('D', 'gcsM') || '0') || 0;
  const gcsTotal = (gcsE && gcsV && gcsM) ? gcsE + gcsV + gcsM : null;

  // Burns
  const tbsa = useMemo(() => calcTbsa(td.burnRegions), [td.burnRegions]);
  const wt   = parseFloat(weightKg) || 70;
  const ageN = parseInt(age, 10) || 35;
  const parkland = useMemo(
    () => parklandFormula(wt, tbsa, td.burnTimeOfInjury),
    [wt, tbsa, td.burnTimeOfInjury],
  );
  const baux = useMemo(() => bauxScore(ageN, tbsa, td.burnInhalation), [ageN, tbsa, td.burnInhalation]);
  const bauxInterp = interpretBaux(baux);
  const hasBurns = td.mechanism.includes('Burns');

  // MTP trigger — read from structured C fields
  const cHr  = parseFloat(getA('C', 'hr'));
  const cSbp = parseFloat(getA('C', 'sbp'));
  const mtpTrigger = (Number.isFinite(cHr) && cHr > 120) && (Number.isFinite(cSbp) && cSbp < 90);

  // Protocol map
  const traumaDiseaseMap: Record<string, string> = {
    Blunt:       'blunt_abdominal_trauma',
    Penetrating: 'penetrating_abdominal_trauma',
    Burns:       tbsa >= 20 ? 'thermal_burn_major' : 'thermal_burn_minor',
    Blast:       'blunt_abdominal_trauma',
    Fall:        'traumatic_brain_injury',
    RTA:         'blunt_abdominal_trauma',
  };
  const primaryDiseaseId = td.mechanism.length > 0 ? (traumaDiseaseMap[td.mechanism[0]] ?? null) : null;

  // MIST auto-narration
  const mistNarration = [
    td.mechanism.length > 0 ? `Mechanism: ${td.mechanism.join(', ')}.` : null,
    td.timeOfInjury ? `Time of injury: ${new Date(td.timeOfInjury).toLocaleString('en-LC', { timeZone: 'America/St_Lucia', hour12: true })}.` : null,
    td.mistInjuries ? `Injuries suspected: ${td.mistInjuries}.` : null,
    (td.gcScene || td.mistSigns) ? `Signs at scene: ${[td.gcScene ? `GCS ${td.gcScene}` : null, td.mistSigns].filter(Boolean).join(', ')}.` : null,
    td.preHospital.length > 0 ? `Pre-hospital treatment: ${td.preHospital.join(', ')}.` : null,
  ].filter(Boolean).join(' ');

  const nowStr = new Date().toLocaleString('en-LC', { timeZone: 'America/St_Lucia', hour12: true, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  // ── Print summary (rendered always, visible only on print) ───────────────

  function pRow(label: string, value: React.ReactNode) {
    return (
      <tr key={label}>
        <th style={{ width: '30%' }}>{label}</th>
        <td>{value || '—'}</td>
      </tr>
    );
  }

  const PrintSummary = () => (
    <div className="trauma-print-summary">
      <h1>Trauma Assessment — ATLS 11th Edition</h1>
      <p className="tps-meta">
        Patient: <strong>{patientName || 'Unknown'}</strong> &nbsp;|&nbsp;
        Age: {age || '?'} &nbsp;|&nbsp; Sex: {sex} &nbsp;|&nbsp;
        Printed: {nowStr} &nbsp;|&nbsp; Facility: Amise Medical Services, Saint Lucia
      </p>

      <h2>MIST Handover</h2>
      <table className="tps-table">
        <tbody>
          {pRow('M — Mechanism', td.mechanism.join(', '))}
          {pRow('I — Injuries suspected', td.mistInjuries)}
          {pRow('S — Signs at scene', `GCS: ${td.gcScene || '?'} | ${td.mistSigns}`)}
          {pRow('T — Treatment given', td.preHospital.join(', '))}
        </tbody>
      </table>
      {mistNarration && <p style={{ fontSize: '10pt', fontStyle: 'italic', color: '#374151', border: '1px solid #d1d5db', padding: '6px 10px', borderRadius: 4 }}>{mistNarration}</p>}

      <h2>Vitals on Admission</h2>
      <div className="tps-grid">
        {ADMISSION_VITALS_FIELDS.filter(f => f.key !== 'timeAdmission').map(f => (
          <div className="tps-field" key={f.key}>
            <strong>{f.label} {f.unit && `(${f.unit})`}</strong>
            <span>{td.admissionVitals[f.key] || '—'}</span>
          </div>
        ))}
        {td.admissionVitals.timeAdmission && (
          <div className="tps-field" style={{ gridColumn: '1 / -1' }}>
            <strong>Time of admission</strong>
            <span>{td.admissionVitals.timeAdmission}</span>
          </div>
        )}
      </div>

      <h2>Primary Survey — ABCDE</h2>
      <table className="tps-table">
        <thead><tr><th style={{ width: '8%' }}>Letter</th><th>System</th><th>Findings / Actions</th></tr></thead>
        <tbody>
          {ABCDE_CONFIG.map(({ key, title }) => (
            <tr key={key}>
              <td><span className="tps-abcde-letter">{key}</span></td>
              <td><strong>{title}</strong></td>
              <td style={{ whiteSpace: 'pre-wrap' }}>
                {fmtAbcde(td.abcde, key)}
                {key === 'D' && gcsTotal !== null ? ` | GCS: E${gcsE}V${gcsV}M${gcsM} = ${gcsTotal}` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Injury Severity Score</h2>
      <div className="tps-grid">
        <div className="tps-field">
          <strong>ISS</strong>
          <span className="tps-score" style={{ color: issInterp.color }}>{iss}</span>
          <span>{issInterp.label}</span>
        </div>
        <div className="tps-field">
          <strong>NISS</strong>
          <span className="tps-score" style={{ color: nissInterp.color }}>{niss}</span>
          <span>{nissInterp.label}</span>
        </div>
      </div>
      {iss > 0 && (
        <table className="tps-table">
          <thead><tr><th>Region</th><th>AIS Score</th><th>Severity</th></tr></thead>
          <tbody>
            {ISS_REGIONS.filter(r => (td.ais[r.key] ?? 0) > 0).map(r => (
              <tr key={r.key}>
                <td>{r.label}</td>
                <td>{td.ais[r.key]}</td>
                <td>{AIS_LABELS[td.ais[r.key] as keyof typeof AIS_LABELS]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Secondary Survey</h2>
      <table className="tps-table">
        <thead><tr><th>Region</th><th>Findings</th><th>Notes</th></tr></thead>
        <tbody>
          {SECONDARY_REGIONS.map(r => {
            const chips = td.secondaryDropdowns[r] ?? [];
            const notes = td.secondary[r] ?? '';
            if (!chips.length && !notes) return null;
            return (
              <tr key={r}>
                <td><strong>{r}</strong></td>
                <td>{chips.join(', ') || '—'}</td>
                <td>{notes || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {hasBurns && tbsa > 0 && (
        <>
          <h2>Burns Assessment</h2>
          <div className="tps-grid">
            <div className="tps-field"><strong>TBSA</strong><span>{tbsa.toFixed(1)}%</span></div>
            <div className="tps-field"><strong>Weight</strong><span>{wt} kg</span></div>
            <div className="tps-field"><strong>Inhalation injury</strong><span>{td.burnInhalation ? 'Yes' : 'No'}</span></div>
            <div className="tps-field"><strong>Parkland total (24 h)</strong><span>{parkland.total.toFixed(0)} mL LR</span></div>
            <div className="tps-field"><strong>First 8 h</strong><span>{parkland.first8h.toFixed(0)} mL @ {parkland.rateNow.toFixed(0)} mL/hr</span></div>
            <div className="tps-field"><strong>Next 16 h</strong><span>{parkland.next16h.toFixed(0)} mL @ {parkland.rateNext16h.toFixed(0)} mL/hr</span></div>
            <div className="tps-field"><strong>Revised Baux score</strong><span style={{ color: bauxInterp.color }}>{baux} — {bauxInterp.label}</span></div>
          </div>
        </>
      )}

      <div className="tps-footer">
        Generated by Amise MedFlow EMR · Dr Dawit Daniel Kabiye, MD, DM — General / Endoscopic Surgery ·
        Amise Medical Services, Saint Lucia · {nowStr}
        <br /><strong>CONFIDENTIAL — For medical use only</strong>
      </div>
    </div>
  );

  // ── Inline helper ───────────────────────────────────────────────────────

  function admVital(key: string): string { return td.admissionVitals[key] ?? ''; }
  function setAdmVital(key: string, val: string) {
    update({ admissionVitals: { ...td.admissionVitals, [key]: val } });
  }

  return (
    <div style={{ padding: '16px 20px', maxWidth: 1000, margin: '0 auto' }} className="gap-y">

      {/* Print summary — only visible via @media print */}
      <PrintSummary />

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#f87171' }}>
          ⚡ Trauma Assessment — ATLS 11th Edition
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="chip"
            style={{ fontSize: 11, padding: '4px 12px', background: '#1e3a5f', borderColor: '#1e3a5f', color: '#7dd3fc' }}
            onClick={() => window.print()}
          >
            🖨 Print Summary
          </button>
          <button
            className="chip"
            style={{ fontSize: 11, padding: '4px 10px' }}
            onClick={() => setTraumaData(EMPTY_TRAUMA_DATA)}
          >
            Reset
          </button>
        </div>
      </div>

      {/* ── MIST Handover ─────────────────────────────────────────────────── */}
      <CollapsibleCard title="MIST Handover — Pre-hospital Triage">
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 12 }}>
          Structured handover from pre-hospital team: <b>M</b>echanism · <b>I</b>njuries · <b>S</b>igns · <b>T</b>reatment
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          {/* M */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 6 }}>
              M — Mechanism of Injury
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {MECHANISMS.map(m => (
                <button
                  key={m}
                  className={`chip${td.mechanism.includes(m) ? ' chip--active' : ''}`}
                  onClick={() => update({ mechanism: toggleList(td.mechanism, m) })}
                  style={td.mechanism.includes(m) ? { background: '#dc2626', borderColor: '#dc2626', color: '#fff' } : {}}
                >
                  {m}
                </button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div className="fld" style={{ marginBottom: 0 }}>
                <label>Time of injury</label>
                <input
                  type="datetime-local"
                  value={td.timeOfInjury}
                  onChange={e => update({ timeOfInjury: e.target.value })}
                />
              </div>
              <div className="fld" style={{ marginBottom: 0 }}>
                <label>GCS on scene</label>
                <input
                  type="number" min={3} max={15}
                  value={td.gcScene}
                  onChange={e => update({ gcScene: e.target.value })}
                  placeholder="3–15"
                />
              </div>
            </div>
          </div>

          {/* I + T */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="fld" style={{ marginBottom: 0 }}>
              <label>I — Injuries suspected / found</label>
              <textarea
                value={td.mistInjuries}
                onChange={e => update({ mistInjuries: e.target.value })}
                placeholder="e.g. Open femur fracture, suspected intra-abdominal haemorrhage, GCS 9…"
                style={{ minHeight: 60 }}
              />
            </div>
            <div className="fld" style={{ marginBottom: 0 }}>
              <label>S — Signs at scene (HR, BP, SpO2, GCS if different)</label>
              <input
                type="text"
                value={td.mistSigns}
                onChange={e => update({ mistSigns: e.target.value })}
                placeholder="e.g. HR 120, SBP 88, SpO2 92% on air, GCS 12"
              />
            </div>
          </div>
        </div>

        {/* T — Pre-hospital interventions */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 6 }}>
            T — Pre-hospital interventions
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PRE_HOSPITAL_OPTIONS.map(opt => (
              <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={td.preHospital.includes(opt)}
                  onChange={() => update({ preHospital: toggleList(td.preHospital, opt) })}
                />
                {opt}
              </label>
            ))}
          </div>
        </div>

        {/* MIST narration preview */}
        {mistNarration && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#0c2233', border: '1px solid #1e3a5f', borderRadius: 6, fontSize: 12, color: '#bfdbfe', fontStyle: 'italic' }}>
            <span style={{ fontWeight: 700, fontStyle: 'normal', color: '#7dd3fc', marginRight: 6 }}>MIST:</span>
            {mistNarration}
          </div>
        )}
      </CollapsibleCard>

      {/* ── Vitals on Admission ───────────────────────────────────────────── */}
      <CollapsibleCard title="Vitals on Admission">
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 12 }}>
          Record vital signs at time of hospital arrival (separate from MIST pre-hospital signs).
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {ADMISSION_VITALS_FIELDS.map(f => (
            <div
              key={f.key}
              className="fld"
              style={{ marginBottom: 0, gridColumn: f.span ? '1 / -1' : undefined }}
            >
              <label style={{ fontSize: 11 }}>
                {f.label}{f.unit ? ` (${f.unit})` : ''}
              </label>
              {f.key === 'timeAdmission'
                ? <input type="datetime-local" value={admVital(f.key)} onChange={e => setAdmVital(f.key, e.target.value)} />
                : f.key === 'pupils'
                  ? <input type="text" value={admVital(f.key)} onChange={e => setAdmVital(f.key, e.target.value)} placeholder={f.placeholder} />
                  : <input type="text" inputMode="numeric" value={admVital(f.key)} onChange={e => setAdmVital(f.key, e.target.value)} placeholder={f.placeholder} />
              }
            </div>
          ))}
        </div>

        {/* Traffic-light summary */}
        {(admVital('hr') || admVital('sbp') || admVital('spo2')) && (() => {
          const hr   = parseFloat(admVital('hr'));
          const sbp  = parseFloat(admVital('sbp'));
          const spo2 = parseFloat(admVital('spo2'));
          const alerts: { text: string; color: string }[] = [];
          if (Number.isFinite(hr)   && hr   > 120) alerts.push({ text: `Tachycardia HR ${hr}/min`, color: '#f87171' });
          if (Number.isFinite(hr)   && hr   < 50)  alerts.push({ text: `Bradycardia HR ${hr}/min`, color: '#f87171' });
          if (Number.isFinite(sbp)  && sbp  < 90)  alerts.push({ text: `Hypotension SBP ${sbp} mmHg`, color: '#ef4444' });
          if (Number.isFinite(spo2) && spo2 < 92)  alerts.push({ text: `Hypoxia SpO2 ${spo2}%`, color: '#f97316' });
          if (!alerts.length) return null;
          return (
            <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {alerts.map(a => (
                <span key={a.text} style={{
                  padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                  background: `${a.color}22`, border: `1px solid ${a.color}55`, color: a.color,
                }}>
                  ⚠ {a.text}
                </span>
              ))}
            </div>
          );
        })()}
      </CollapsibleCard>

      {/* ── Primary Survey ABCDE ─────────────────────────────────────────── */}
      <CollapsibleCard title="Primary Survey — ABCDE">
        <div style={{ display: 'grid', gap: 12 }}>
          {ABCDE_CONFIG.map(({ key, title, hint, color, dropdowns, numerics, gcs }) => (
            <div key={key} style={{ border: `1px solid ${color}44`, borderRadius: 8, padding: '12px 16px', background: `${color}08` }}>
              {/* Letter header */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'baseline' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 30, height: 30, borderRadius: '50%',
                  background: color, color: '#fff', fontWeight: 900, fontSize: 15,
                  flexShrink: 0,
                }}>{key}</span>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{title}</span>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>{hint}</div>
                </div>
              </div>

              {/* Numeric fields */}
              {numerics.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  {numerics.map(n => (
                    <div key={n.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <label style={{ fontSize: 11, color: '#9ca3af', minWidth: 60 }}>{n.label}</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={getA(key, n.key)}
                        onChange={e => updateAbcde(key, n.key, e.target.value)}
                        placeholder={n.placeholder}
                        style={{
                          width: 72, padding: '4px 6px', borderRadius: 5,
                          background: '#1e293b', border: '1px solid #374151',
                          color: '#e2e8f0', fontSize: 12, textAlign: 'center',
                        }}
                      />
                      <span style={{ fontSize: 10, color: '#6b7280' }}>{n.unit}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* GCS E/V/M selects */}
              {gcs && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
                  {[
                    { label: 'E', field: 'gcsE', opts: GCS_E_OPTIONS },
                    { label: 'V', field: 'gcsV', opts: GCS_V_OPTIONS },
                    { label: 'M', field: 'gcsM', opts: GCS_M_OPTIONS },
                  ].map(({ label, field, opts }) => (
                    <div key={field} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#a3e7df', minWidth: 12 }}>{label}</span>
                      <select
                        value={getA('D', field)}
                        onChange={e => updateAbcde('D', field, e.target.value)}
                        style={{ padding: '4px 6px', borderRadius: 5, background: '#1e293b', border: '1px solid #374151', color: '#e2e8f0', fontSize: 11, maxWidth: 160 }}
                      >
                        <option value="">—</option>
                        {opts.slice(1).map(o => <option key={o} value={o.split(' — ')[0]}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                  {gcsTotal !== null && (
                    <span style={{ fontWeight: 800, fontSize: 15, color: gcsTotal <= 8 ? '#f87171' : gcsTotal <= 12 ? '#fbbf24' : '#34d399' }}>
                      GCS = {gcsTotal}
                      {gcsTotal <= 8 && <span style={{ fontSize: 10, marginLeft: 6 }}>⚠ Intubate (≤8)</span>}
                    </span>
                  )}
                </div>
              )}

              {/* Dropdown fields */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                {dropdowns.map(dd => (
                  <div key={dd.key} className="fld" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: 11 }}>{dd.label}</label>
                    <select
                      value={getA(key, dd.key)}
                      onChange={e => updateAbcde(key, dd.key, e.target.value)}
                      style={{ padding: '5px 8px', borderRadius: 5, background: '#1e293b', border: '1px solid #374151', color: '#e2e8f0', fontSize: 12 }}
                    >
                      <option value="">—</option>
                      {dd.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}

                {/* Notes */}
                <div className="fld" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: 11 }}>Notes / free text</label>
                  <input
                    type="text"
                    value={getA(key, 'notes')}
                    onChange={e => updateAbcde(key, 'notes', e.target.value)}
                    placeholder="Additional clinical findings…"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* MTP / resuscitation alert */}
        {iss > 0 && (
          <div style={{ marginTop: 14, padding: '10px 14px', background: '#1e293b', borderRadius: 6, fontSize: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: '#fbbf24' }}>⚡ Resuscitation Targets</div>
            {td.mechanism.includes('Penetrating') && !td.mechanism.includes('Blunt')
              ? <div>Permissive hypotension (penetrating): target SBP <b>80–90 mmHg</b> until surgical haemostasis.</div>
              : <div>Normotensive resuscitation (blunt/TBI): target SBP <b>≥90 mmHg</b>.</div>
            }
            {mtpTrigger && (
              <div style={{ color: '#f87171', fontWeight: 700, marginTop: 4 }}>
                ⚠ MTP Trigger: HR {cHr}/min + SBP {cSbp} mmHg — activate Massive Transfusion Protocol (PRBC : FFP : Platelets = 1:1:1)
              </div>
            )}
          </div>
        )}
      </CollapsibleCard>

      {/* ── ISS Calculator ────────────────────────────────────────────────── */}
      <CollapsibleCard title={`ISS Calculator — Score: ${iss} (${issInterp.label})`}>
        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 12, lineHeight: 1.5 }}>
          Select AIS (Abbreviated Injury Scale) score for each body region. ISS = sum of squares of top-3
          DIFFERENT regions. Any AIS 6 → ISS 75 (unsurvivable). NISS uses top-3 regardless of region.
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          {ISS_REGIONS.map(({ key, label }) => {
            const val = td.ais[key] ?? 0;
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ minWidth: 210, fontSize: 12, color: '#e2e8f0' }}>{label}</span>
                <select
                  value={val}
                  onChange={e => update({ ais: { ...td.ais, [key]: parseInt(e.target.value) } })}
                  style={{
                    flex: 1, padding: '5px 8px', borderRadius: 5,
                    background: val >= 5 ? '#7f1d1d' : val >= 3 ? '#431407' : '#1e293b',
                    border: `1px solid ${val >= 5 ? '#dc2626' : val >= 3 ? '#ea580c' : '#374151'}`,
                    color: '#e2e8f0', fontSize: 12,
                  }}
                >
                  {[0, 1, 2, 3, 4, 5, 6].map(n => (
                    <option key={n} value={n}>{AIS_LABELS[n]}</option>
                  ))}
                </select>
                {val > 0 && (
                  <span style={{
                    fontSize: 10, padding: '1px 8px', borderRadius: 10,
                    background: val >= 5 ? '#7f1d1d' : val >= 3 ? '#431407' : '#164e63',
                    color: val >= 5 ? '#fca5a5' : val >= 3 ? '#fed7aa' : '#7dd3fc',
                    border: '1px solid transparent', minWidth: 80, textAlign: 'center',
                  }}>
                    AIS {val}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* ISS / NISS display */}
        <div style={{ display: 'flex', gap: 16, marginTop: 16, padding: '12px 16px', background: '#0f172a', borderRadius: 8 }}>
          <div>
            <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>ISS</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: issInterp.color }}>{iss}</div>
            <div style={{ fontSize: 12, color: issInterp.color }}>{issInterp.label}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>NISS</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: nissInterp.color }}>{niss}</div>
            <div style={{ fontSize: 12, color: nissInterp.color }}>{nissInterp.label}</div>
          </div>
          <div style={{ alignSelf: 'flex-end', fontSize: 11, color: '#6b7280', flex: 1 }}>
            ISS ≥16 = major trauma. ISS ≥25 = severe / activate trauma team.
            NISS may better reflect injury burden in same body region (polytrauma).
            {iss >= 16 && (
              <div style={{ color: '#fbbf24', fontWeight: 700, marginTop: 4 }}>
                ⚠ Major trauma — activate trauma team protocol
              </div>
            )}
          </div>
        </div>
      </CollapsibleCard>

      {/* ── Secondary Survey ─────────────────────────────────────────────── */}
      <CollapsibleCard title="Secondary Survey — Head to Toe" defaultOpen={false}>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 10 }}>
          Select findings for each region using the quick chips, then add free-text notes as needed.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {SECONDARY_REGIONS.map(region => {
            const selected = td.secondaryDropdowns[region] ?? [];
            return (
              <div key={region} style={{ padding: '8px 10px', border: '1px solid #1f2937', borderRadius: 6, background: selected.length > 0 ? '#0c1a2e' : 'transparent' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>{region}</div>
                {/* Finding chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                  {SECONDARY_FINDINGS.map(f => {
                    const active = selected.includes(f);
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => {
                          const next = active ? selected.filter(x => x !== f) : [...selected, f];
                          update({ secondaryDropdowns: { ...td.secondaryDropdowns, [region]: next } });
                        }}
                        style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 10, cursor: 'pointer',
                          background: active ? (f === 'Normal' ? '#14532d' : '#7f1d1d') : '#1e293b',
                          border: `1px solid ${active ? (f === 'Normal' ? '#16a34a' : '#dc2626') : '#374151'}`,
                          color: active ? (f === 'Normal' ? '#bbf7d0' : '#fca5a5') : '#9ca3af',
                        }}
                      >
                        {f}
                      </button>
                    );
                  })}
                </div>
                {/* Notes */}
                <input
                  type="text"
                  value={td.secondary[region] ?? ''}
                  onChange={e => update({ secondary: { ...td.secondary, [region]: e.target.value } })}
                  placeholder="Additional notes…"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '4px 8px', borderRadius: 4, fontSize: 11,
                    background: '#0f172a', border: '1px solid #1f2937', color: '#e2e8f0',
                  }}
                />
              </div>
            );
          })}
        </div>
      </CollapsibleCard>

      {/* ── Burns Assessment ─────────────────────────────────────────────── */}
      {hasBurns && (
        <CollapsibleCard title={`Burns Assessment — TBSA: ${tbsa.toFixed(1)}%`}>
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 12 }}>
            Rule of Nines (adult). Tick affected areas and select burn depth.
            <b style={{ color: '#fbbf24' }}> 1st-degree erythema is NOT counted in TBSA.</b>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div className="fld" style={{ marginBottom: 0 }}>
              <label>Time of Burn Injury</label>
              <input
                type="datetime-local"
                value={td.burnTimeOfInjury}
                onChange={e => update({ burnTimeOfInjury: e.target.value })}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={td.burnInhalation}
                onChange={e => update({ burnInhalation: e.target.checked })}
              />
              <span>
                <b style={{ color: '#f87171' }}>Inhalation injury suspected</b>
                <span style={{ color: '#6b7280', marginLeft: 4 }}>(singed nares, hoarse voice, sooty sputum, stridor)</span>
              </span>
            </label>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#111827', color: '#9ca3af', textTransform: 'uppercase', fontSize: 10 }}>
                <th style={{ padding: '6px 10px', textAlign: 'left' }}>Region</th>
                <th style={{ padding: '6px 10px', textAlign: 'center' }}>%</th>
                <th style={{ padding: '6px 10px', textAlign: 'center' }}>Affected</th>
                <th style={{ padding: '6px 10px', textAlign: 'left' }}>Depth</th>
              </tr>
            </thead>
            <tbody>
              {BURN_REGIONS.map((r, i) => {
                const entry = td.burnRegions[r.key] ?? { affected: false, degree: 'SPT' };
                return (
                  <tr key={r.key} style={{ background: i % 2 === 0 ? '#0f172a' : '#1e293b', borderBottom: '1px solid #1f2937' }}>
                    <td style={{ padding: '5px 10px', color: entry.affected ? '#e2e8f0' : '#6b7280' }}>{r.label}</td>
                    <td style={{ padding: '5px 10px', textAlign: 'center', color: '#94a3b8' }}>{r.percent}%</td>
                    <td style={{ padding: '5px 10px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={entry.affected}
                        onChange={e => update({
                          burnRegions: { ...td.burnRegions, [r.key]: { ...entry, affected: e.target.checked } },
                        })}
                      />
                    </td>
                    <td style={{ padding: '5px 10px' }}>
                      {entry.affected && (
                        <select
                          value={entry.degree}
                          onChange={e => update({
                            burnRegions: { ...td.burnRegions, [r.key]: { ...entry, degree: e.target.value } },
                          })}
                          style={{ fontSize: 11, padding: '3px 6px', borderRadius: 4, background: '#0f172a', border: '1px solid #374151', color: '#e2e8f0' }}
                        >
                          {(Object.keys(BURN_DEGREE_LABELS) as BurnDegree[]).map(k => (
                            <option key={k} value={k}>{BURN_DEGREE_LABELS[k]}</option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {tbsa > 0 && (
            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: '#0f172a', border: '1px solid #1e3a5f', borderRadius: 8, padding: '12px 16px' }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: '#7dd3fc', marginBottom: 8 }}>
                  💧 Parkland Formula (Lactated Ringer's)
                </div>
                {[
                  ['TBSA', `${tbsa.toFixed(1)}%`],
                  ['Weight', `${wt} kg`],
                  ['Total (24 h)', <b style={{ color: '#7dd3fc', fontSize: 14 }}>{parkland.total.toFixed(0)} mL</b>],
                  ['First 8 h (from burn)', `${parkland.first8h.toFixed(0)} mL @ ${parkland.rateNow.toFixed(0)} mL/hr`],
                  ['Next 16 h', `${parkland.next16h.toFixed(0)} mL @ ${parkland.rateNext16h.toFixed(0)} mL/hr`],
                ].map(([label, value]) => (
                  <div key={String(label)} style={{ display: 'flex', gap: 12, padding: '4px 0', borderBottom: '1px solid #1f2937' }}>
                    <span style={{ minWidth: 120, fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{label}</span>
                    <span style={{ flex: 1, fontSize: 12 }}>{value}</span>
                  </div>
                ))}
                {parkland.warning && (
                  <div style={{ marginTop: 8, fontSize: 11, color: '#fbbf24', background: '#431407', borderRadius: 4, padding: '6px 8px' }}>
                    ⚠ {parkland.warning}
                  </div>
                )}
                <div style={{ marginTop: 8, fontSize: 11, color: '#6b7280' }}>
                  Target UO: 0.5–1 mL/kg/hr adults ({(wt * 0.5).toFixed(0)}–{wt} mL/hr)
                </div>
              </div>

              <div style={{ background: '#0f172a', border: '1px solid #374151', borderRadius: 8, padding: '12px 16px' }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: '#fca5a5', marginBottom: 8 }}>🔥 Revised Baux Score</div>
                {[
                  ['Age', ageN.toString()],
                  ['TBSA', `${tbsa.toFixed(1)}%`],
                  ['Inhalation +17', td.burnInhalation ? '+17' : '0'],
                  ['Baux Score', <b style={{ color: bauxInterp.color, fontSize: 20 }}>{baux}</b>],
                  ['Prognosis', <b style={{ color: bauxInterp.color }}>{bauxInterp.label}</b>],
                ].map(([label, value]) => (
                  <div key={String(label)} style={{ display: 'flex', gap: 12, padding: '4px 0', borderBottom: '1px solid #1f2937' }}>
                    <span style={{ minWidth: 120, fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{label}</span>
                    <span style={{ flex: 1, fontSize: 12 }}>{value}</span>
                  </div>
                ))}
                {baux > 100 && (
                  <div style={{ marginTop: 8, fontSize: 11, color: '#fca5a5', background: '#7f1d1d22', borderRadius: 4, padding: '6px 8px' }}>
                    Revised Baux &gt;100 — consider palliative care discussion with patient and family.
                  </div>
                )}
              </div>
            </div>
          )}

          {tbsa > 0 && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: '#1e293b', borderRadius: 6, fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: '#fbbf24', marginBottom: 6 }}>Burn Nursing Orders</div>
              <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.9, color: '#d1d5db' }}>
                <li>IV access × 2 large-bore; avoid burn sites</li>
                {tbsa >= 20 && <li><b>Urinary catheter — strict hourly I&O</b></li>}
                <li>Target urine output: 0.5–1 mL/kg/hr adults ({(wt * 0.5).toFixed(0)}–{wt} mL/hr)</li>
                <li>Analgesia: IV morphine titrated; paracetamol ATC; anxiolysis as needed</li>
                <li>Cool running water 20 min if &lt;3 h post burn; then non-adherent dressings</li>
                <li>Tetanus prophylaxis; check immunisation status</li>
                {tbsa >= 20 && <li>Early enteral feeding via NGT within 6–8 h; refer dietitian</li>}
                {td.burnInhalation && <li><b style={{ color: '#f87171' }}>Inhalation injury — secure airway before oedema develops (early intubation)</b></li>}
                {(tbsa >= 20 || Object.values(td.burnRegions).some(r => r.affected && ['FT', '4th'].includes(r.degree))) && (
                  <li><b style={{ color: '#f87171' }}>Transfer criteria met — arrange specialist burns unit transfer</b></li>
                )}
              </ul>
            </div>
          )}
        </CollapsibleCard>
      )}

      {/* ── Trauma Management Protocol ───────────────────────────────────── */}
      {primaryDiseaseId && (
        <CollapsibleCard title="Trauma Management Protocol">
          <ManagementPanel diseaseId={primaryDiseaseId} icdCode={null} />
        </CollapsibleCard>
      )}
    </div>
  );
}
