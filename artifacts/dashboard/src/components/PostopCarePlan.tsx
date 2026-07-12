import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderItem {
  label: string;
  value: string;
  editable: boolean;
}

interface OrderSection {
  title: string;
  icon: string;
  items: OrderItem[];
}

// ─── Presets ─────────────────────────────────────────────────────────────────

const ANALGESIA_PRESETS = [
  'Paracetamol 1g QDS PO/IV',
  'Ibuprofen 400mg TDS PO (with food)',
  'Diclofenac 75mg BD PO/PR',
  'Morphine 5mg SC/IV PRN q4h (mild-to-moderate pain)',
  'Morphine 10mg SC PRN q4h (moderate-to-severe pain)',
  'Tramadol 50–100mg QDS PO PRN',
  'PCA morphine (as per anaesthetic orders)',
  'Epidural infusion (as per anaesthetic orders)',
  'Oxycodone 5mg PO q4–6h PRN',
  'Gabapentin 300mg TDS PO',
  'Ketamine infusion (per protocol)',
];

const ANTIEMETIC_PRESETS = [
  'Ondansetron 4mg IV/PO TDS PRN',
  'Metoclopramide 10mg TDS PO/IV PRN',
  'Cyclizine 50mg TDS IV/PO PRN',
  'Dexamethasone 4mg IV (already given intraoperatively)',
  'Prochlorperazine 12.5mg IM PRN',
];

const VTE_PRESETS = [
  'Enoxaparin (Clexane) 40mg SC nocte — commence 6h post-op',
  'Enoxaparin 60mg SC nocte (BMI >35 or weight >100kg)',
  'Enoxaparin 20mg SC nocte (eGFR 15–30)',
  'Dalteparin 5000 units SC nocte',
  'TED stockings both legs',
  'Intermittent pneumatic compression (IPC) — both legs until ambulant',
  'Warfarin — dose per INR target (bridge from LMWH)',
  'Fondaparinux 2.5mg SC once daily',
];

const DIET_PRESETS = [
  'Nil by mouth until tolerated',
  'Free fluids only today',
  'Soft diet — avoid raw fruits and vegetables',
  'Light diet — introduce solids gradually',
  'Normal diet as tolerated',
  'Free fluids + ensure nutritional supplements BD',
  'NG/NJ feed (per dietitian)',
  'TPN (per ICU/dietitian orders)',
  'Low-fat diet (post-cholecystectomy — transient)',
  'Diabetic diet + carbohydrate consistent',
];

const FLUID_PRESETS = [
  'Hartmann\'s solution 1L over 6h ×2, then reassess',
  '0.9% NaCl 1L over 8h with 20mmol KCl',
  '5% dextrose 1L over 8h',
  'Oral fluids if tolerating — discontinue IV when adequate',
  'IV fluids until tolerating 1L oral/day — titrate',
  'Restricted 1L/24h (heart failure / renal impairment)',
  'Replace drain losses mL-for-mL with Hartmann\'s',
];

const MONITORING_PRESETS = [
  'Hourly observations ×4h, then 4-hourly if stable',
  'Obs q4h: BP, HR, RR, SpO2, temp, urine output',
  'Continuous SpO2 monitoring (supplemental O2 to maintain >95%)',
  'Blood glucose monitoring QDS (diabetic)',
  'Urine output: hourly via IDC — alert if <0.5 mL/kg/h',
  'ECG monitoring (cardiac risk)',
  'CVP monitoring (major surgery)',
  'Wound observation: check for bleeding 1h and 4h post-op',
  'Drain output: check and document q4h',
  'Pain score with each set of observations',
  'NEWS / EWS score at each observation set',
];

const DRAIN_PRESETS = [
  'Remove if output <30 mL/24h AND no concern (typically day 1–2)',
  'Remove if output <50 mL/24h AND amylase < 3× upper limit (post-pancreatectomy)',
  'Leave until first clinic review — do not remove on ward',
  'Keep on free drainage — do not clamp',
  'Biliary drain: flush with 5mL 0.9% NaCl BD',
  'Nasogastric tube: free drainage and aspirate q4h',
  'Remove NG when passing flatus',
  'Remove IDC at 24h post-op',
];

const ANTIBIOTIC_PRESETS = [
  'No post-op antibiotics indicated',
  'Co-amoxiclav 625mg TDS PO ×5 days',
  'Metronidazole 400mg TDS PO ×5 days + Co-amoxiclav 625mg TDS ×5 days',
  'Cefazolin 1g IV q8h ×24h then switch to oral',
  'Pip-Tazo 4.5g IV TDS (contaminated / peritonitis)',
  'Meropenem 1g IV TDS (severe infection / resistant organism)',
  'Ciprofloxacin 500mg BD PO ×7 days',
  'Flucloxacillin 500mg QDS PO ×7 days (wound infection)',
  'Metronidazole 400mg TDS PO ×7 days (anaerobic cover)',
  'Continue peri-op antibiotics for 24h only (clean surgery)',
];

const WOUND_PRESETS = [
  'Non-adherent dressing — leave intact 48h',
  'Change dressing at 48h — check wound',
  'Waterproof dressing — patient may shower at 48h',
  'VAC / NPWT dressing — per wound care nurse',
  'Skin staples — remove day 10–14 at GP',
  'Dissolvable sutures — no removal required',
  'Drain site: dry dressing — change daily',
  'Stoma: check viability at 4h, 24h — stoma nurse to review',
];

const ACTIVITY_PRESETS = [
  'Bed rest for 2h post-op then sit up if stable',
  'Sit out of bed at 4h post-op if tolerated',
  'Mobilise with physiotherapy on day 1',
  'Light mobilisation — no heavy lifting ×4 weeks',
  'Non-weight-bearing on operated limb',
  'Elevate leg ×45° at rest',
  'Physiotherapy: deep breathing exercises and leg exercises hourly while in bed',
  'Incentive spirometry q1h while awake',
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function PostopCarePlan() {
  const { patientName, dob, assessment } = useAppContext();

  const [ward, setWard] = useState('');
  const [consultant, setConsultant] = useState('Dr Dawit Daniel Kabiye');
  const [procedure, setProcedure] = useState('');
  const [dateOfOp, setDateOfOp] = useState('');
  const [levelOfCare, setLevelOfCare] = useState('Ward');
  const [notes, setNotes] = useState('');
  const [copied, setCopied] = useState(false);

  // Per-section multi-selects
  const [analgesia, setAnalgesia] = useState<string[]>(['Paracetamol 1g QDS PO/IV', 'Ibuprofen 400mg TDS PO (with food)']);
  const [antiemetics, setAntiemetics] = useState<string[]>(['Ondansetron 4mg IV/PO TDS PRN']);
  const [vte, setVte] = useState<string[]>(['Enoxaparin (Clexane) 40mg SC nocte — commence 6h post-op', 'TED stockings both legs', 'Intermittent pneumatic compression (IPC) — both legs until ambulant']);
  const [diet, setDiet] = useState<string[]>(['Free fluids only today']);
  const [fluids, setFluids] = useState<string[]>(["Hartmann's solution 1L over 6h ×2, then reassess"]);
  const [monitoring, setMonitoring] = useState<string[]>(['Hourly observations ×4h, then 4-hourly if stable', 'Wound observation: check for bleeding 1h and 4h post-op', 'Pain score with each set of observations']);
  const [drains, setDrains] = useState<string[]>([]);
  const [antibiotics, setAntibiotics] = useState<string[]>(['No post-op antibiotics indicated']);
  const [wound, setWound] = useState<string[]>(['Non-adherent dressing — leave intact 48h', 'Waterproof dressing — patient may shower at 48h']);
  const [activity, setActivity] = useState<string[]>(['Sit out of bed at 4h post-op if tolerated', 'Mobilise with physiotherapy on day 1']);

  function toggle(arr: string[], val: string, setArr: (v: string[]) => void) {
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  }

  function ChipPicker({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {options.map(o => {
          const sel = value.includes(o);
          return (
            <label key={o} style={{
              display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer', fontSize: 12,
              padding: '5px 8px', borderRadius: 5,
              background: sel ? '#f0fdf4' : '#f8fafc',
              border: `1px solid ${sel ? '#86efac' : '#e2e8f0'}`,
            }}>
              <input type="checkbox" checked={sel} onChange={() => toggle(value, o, onChange)} style={{ marginTop: 2 }} />
              <span style={{ color: sel ? '#15803d' : '#374151' }}>{o}</span>
            </label>
          );
        })}
      </div>
    );
  }

  function generate() {
    const today = new Date().toLocaleDateString('en-LC', { timeZone: 'America/St_Lucia', dateStyle: 'long' });
    const lines: string[] = [
      'POST-OPERATIVE CARE PLAN',
      'Amise Medical Services — General & Endoscopic Surgery',
      'Dr Dawit Daniel Kabiye, MD, DM',
      '─'.repeat(55),
      '',
      `Date:          ${today}`,
      `Date of Op:    ${dateOfOp || today}`,
      `Patient:       ${patientName || '[Name]'}   DOB: ${dob || '[DOB]'}`,
      `Procedure:     ${procedure || assessment?.split('\n')[0]?.slice(0, 60) || '[Procedure]'}`,
      `Consultant:    ${consultant}`,
      `Ward / Unit:   ${ward || '[ward]'}`,
      `Level of care: ${levelOfCare}`,
      '',
    ];

    function addSection(title: string, items: string[]) {
      if (!items.length) return;
      lines.push(`${title.toUpperCase()}`);
      items.forEach(i => lines.push(`  • ${i}`));
      lines.push('');
    }

    addSection('Analgesia', analgesia);
    addSection('Antiemetics', antiemetics);
    addSection('VTE prophylaxis', vte);
    addSection('Diet', diet);
    addSection('IV fluids', fluids);
    addSection('Monitoring', monitoring);
    addSection('Drains', drains);
    addSection('Antibiotics', antibiotics);
    addSection('Wound care', wound);
    addSection('Activity / physiotherapy', activity);

    if (notes.trim()) {
      lines.push('ADDITIONAL INSTRUCTIONS');
      lines.push(notes);
      lines.push('');
    }

    lines.push('─'.repeat(55));
    lines.push(`Signed: ${consultant}`);
    lines.push(`Date:   ${today}`);

    return lines.join('\n');
  }

  const [output, setOutput] = useState('');

  function handleGenerate() {
    setOutput(generate());
  }

  async function copy() {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const SECTIONS = [
    { label: 'Analgesia',            options: ANALGESIA_PRESETS,   value: analgesia,   setVal: setAnalgesia },
    { label: 'Antiemetics',          options: ANTIEMETIC_PRESETS,  value: antiemetics, setVal: setAntiemetics },
    { label: 'VTE prophylaxis',      options: VTE_PRESETS,          value: vte,         setVal: setVte },
    { label: 'Diet',                 options: DIET_PRESETS,         value: diet,        setVal: setDiet },
    { label: 'IV fluids',            options: FLUID_PRESETS,        value: fluids,      setVal: setFluids },
    { label: 'Monitoring',           options: MONITORING_PRESETS,   value: monitoring,  setVal: setMonitoring },
    { label: 'Drain management',     options: DRAIN_PRESETS,        value: drains,      setVal: setDrains },
    { label: 'Antibiotics',          options: ANTIBIOTIC_PRESETS,   value: antibiotics, setVal: setAntibiotics },
    { label: 'Wound care',           options: WOUND_PRESETS,        value: wound,       setVal: setWound },
    { label: 'Activity / physio',    options: ACTIVITY_PRESETS,     value: activity,    setVal: setActivity },
  ];

  return (
    <CollapsibleCard title="Post-operative care plan" defaultOpen={false}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Header fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div className="fld">
            <label>Procedure</label>
            <input value={procedure} onChange={e => setProcedure(e.target.value)}
              placeholder={assessment?.split('\n')[0]?.slice(0, 40) || 'e.g. Laparoscopic cholecystectomy'}
              style={{ fontSize: 12, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6 }} />
          </div>
          <div className="fld">
            <label>Date of operation</label>
            <input type="date" value={dateOfOp} onChange={e => setDateOfOp(e.target.value)}
              style={{ fontSize: 12, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6 }} />
          </div>
          <div className="fld">
            <label>Level of care</label>
            <select value={levelOfCare} onChange={e => setLevelOfCare(e.target.value)}
              style={{ fontSize: 13, padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6 }}>
              {['Ward', 'Step-down / HDU', 'ICU', 'Day surgery — discharge same day', 'Day surgery — overnight'].map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="fld">
            <label>Ward / unit</label>
            <input value={ward} onChange={e => setWard(e.target.value)}
              placeholder="e.g. Surgical Ward 2B"
              style={{ fontSize: 12, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6 }} />
          </div>
          <div className="fld">
            <label>Consultant</label>
            <input value={consultant} onChange={e => setConsultant(e.target.value)}
              style={{ fontSize: 12, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6 }} />
          </div>
        </div>

        {/* Order sections */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {SECTIONS.map(s => (
            <details key={s.label}>
              <summary style={{
                cursor: 'pointer', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                color: s.value.length > 0 ? '#0f172a' : '#64748b',
                padding: '6px 10px', background: s.value.length > 0 ? '#f0fdf4' : '#f8fafc',
                borderRadius: 6, border: `1px solid ${s.value.length > 0 ? '#86efac' : '#e2e8f0'}`,
                listStyle: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span>{s.label}</span>
                <span style={{ fontSize: 10, background: '#e2e8f0', borderRadius: 10, padding: '1px 6px', color: '#374151' }}>
                  {s.value.length} selected
                </span>
              </summary>
              <div style={{ paddingTop: 8 }}>
                <ChipPicker options={s.options} value={s.value} onChange={s.setVal} />
              </div>
            </details>
          ))}
        </div>

        {/* Free-text notes */}
        <div className="fld">
          <label>Additional instructions / nursing alerts</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Patient on warfarin — do not restart until haematologist review. Stoma nurse to review at 24h. If drain output >200mL/shift contact surgical registrar."
            style={{ minHeight: 70, fontSize: 12 }} />
        </div>

        {/* Generate */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={handleGenerate}
            style={{ padding: '8px 18px', borderRadius: 7, fontSize: 13, fontWeight: 700, background: '#0f172a', color: '#fff', border: 'none', cursor: 'pointer' }}>
            Generate care plan
          </button>
          {output && (
            <>
              <button type="button" onClick={() => void copy()}
                style={{ padding: '8px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: '#fff', border: '1px solid #d1d5db', cursor: 'pointer' }}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
              <button type="button" onClick={() => window.print()}
                style={{ padding: '8px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: '#fff', border: '1px solid #d1d5db', cursor: 'pointer' }}>
                Print
              </button>
            </>
          )}
        </div>

        {output && (
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11.5, fontFamily: 'monospace', lineHeight: 1.7, color: '#1e293b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px', margin: 0 }}>
            {output}
          </pre>
        )}
      </div>
    </CollapsibleCard>
  );
}
