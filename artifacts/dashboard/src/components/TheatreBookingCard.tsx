import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';

type Urgency = 'elective' | 'semi_urgent' | 'urgent_24h' | 'emergency';
type Anaesthesia = 'ga' | 'spinal' | 'epidural' | 'regional' | 'local_sedation' | 'local_only';
type Theatre = 'tapion' | 'rodney_bay_hospital' | 'tapion_ercp' | 'day_surgery';

const PROCEDURE_PRESETS = [
  'Laparoscopic cholecystectomy',
  'Open cholecystectomy',
  'Appendicectomy (laparoscopic)',
  'Appendicectomy (open)',
  'Inguinal hernia repair (open)',
  'Inguinal hernia repair (laparoscopic — TEP/TAPP)',
  'Umbilical / paraumbilical hernia repair',
  'Incisional hernia repair',
  'Diagnostic laparoscopy',
  'Hartmann\'s procedure',
  'Anterior resection',
  'Right hemicolectomy',
  'Sigmoid colectomy',
  'Exploratory laparotomy',
  'Small bowel resection',
  'Liver resection (minor)',
  'Splenectomy',
  'Whipple procedure (pancreaticoduodenectomy)',
  'Thyroidectomy (total)',
  'Thyroidectomy (hemithyroidectomy)',
  'Wide local excision + SLNB',
  'Mastectomy (simple / modified radical)',
  'Haemorrhoidectomy',
  'Fistula-in-ano repair',
  'Pilonidal sinus excision',
  'Colonoscopy',
  'Gastroscopy (OGD)',
  'ERCP',
  'Other (specify below)',
];

const EQUIPMENT_OPTIONS = [
  'Laparoscopic stack (30°)',
  'Laparoscopic stack (0°)',
  'Ligasure / advanced energy device',
  'Harmonic scalpel',
  'Stapler (endo-GIA)',
  'Circular stapler (EEA)',
  'Intraoperative cholangiogram (IOC) equipment',
  'Fluoroscopy / C-arm',
  'Endoscopy tower (gastroscopy)',
  'Endoscopy tower (colonoscopy)',
  'ERCP — duodenoscope + fluoroscopy',
  'Cell saver',
  'Argon plasma coagulation (APC)',
  'Intraoperative ultrasound',
  'Nerve monitoring (NIM)',
  'Vessel loops / slings',
  'Mesh (type: specify in notes)',
  'Drain (Jackson-Pratt / Blake / Robinson)',
  'ICU/HDU bed post-op',
];

const URGENCY_OPTIONS: Array<{ value: Urgency; label: string; color: string; hint: string }> = [
  { value: 'elective',      label: 'Elective',           color: '#10b981', hint: 'Booked to a convenient date — days to weeks' },
  { value: 'semi_urgent',   label: 'Semi-urgent',        color: '#f59e0b', hint: 'Within 2 weeks, condition not immediately life-threatening' },
  { value: 'urgent_24h',    label: 'Urgent (< 24h)',     color: '#ef4444', hint: 'Urgent, next available slot today or tomorrow' },
  { value: 'emergency',     label: 'Emergency',          color: '#7f1d1d', hint: 'Life / limb / organ threatening — immediate theatre' },
];

const ANAESTHESIA_LABELS: Record<Anaesthesia, string> = {
  ga:             'General anaesthesia (GA)',
  spinal:         'Spinal / subarachnoid block',
  epidural:       'Epidural',
  regional:       'Regional block (specify in notes)',
  local_sedation: 'Local + IV sedation',
  local_only:     'Local anaesthetic only',
};

const THEATRE_LABELS: Record<Theatre, string> = {
  tapion:             'Tapion Hospital — main theatre',
  rodney_bay_hospital:'Rodney Bay Medical Centre — theatre',
  tapion_ercp:        'Tapion Hospital — ERCP / endoscopy suite',
  day_surgery:        'Day surgery unit',
};

interface BookingForm {
  procedure: string;
  customProcedure: string;
  urgency: Urgency;
  estimatedMinutes: string;
  anaesthesia: Anaesthesia;
  theatre: Theatre;
  position: string;
  equipment: string[];
  anaesthetist: string;
  assistantNeeded: boolean;
  bloodGroup: string;
  crossmatch: string;
  antibioticProphylaxis: string;
  dvtProphylaxis: string;
  specialNotes: string;
}

const DEFAULT_FORM: BookingForm = {
  procedure: '',
  customProcedure: '',
  urgency: 'elective',
  estimatedMinutes: '60',
  anaesthesia: 'ga',
  theatre: 'tapion',
  position: 'Supine',
  equipment: [],
  anaesthetist: '',
  assistantNeeded: false,
  bloodGroup: '',
  crossmatch: '',
  antibioticProphylaxis: 'Cefazolin 2g IV at induction',
  dvtProphylaxis: 'LMWH + TED stockings',
  specialNotes: '',
};

export default function TheatreBookingCard() {
  const { patientName, dob } = useAppContext();
  const [form, setForm] = useState<BookingForm>(DEFAULT_FORM);
  const [generated, setGenerated] = useState('');
  const [copied, setCopied] = useState(false);

  function set<K extends keyof BookingForm>(key: K, val: BookingForm[K]) {
    setForm(prev => ({ ...prev, [key]: val }));
    setGenerated('');
  }

  function toggleEquip(item: string) {
    set('equipment', form.equipment.includes(item)
      ? form.equipment.filter(e => e !== item)
      : [...form.equipment, item]);
  }

  const urgency = URGENCY_OPTIONS.find(u => u.value === form.urgency)!;
  const procedureName = form.procedure === 'Other (specify below)' ? form.customProcedure : form.procedure;

  function generate() {
    if (!procedureName.trim()) { alert('Please select or enter a procedure.'); return; }
    const lines: string[] = [
      'THEATRE BOOKING REQUEST',
      `Date of request: ${new Date().toLocaleDateString('en-GB', { timeZone: 'America/St_Lucia', day: '2-digit', month: 'long', year: 'numeric' })}`,
      `Surgeon: Dr Dawit Daniel Kabiye`,
      '',
      'PATIENT',
      `  Name: ${patientName || '[Patient name]'}`,
      `  DOB: ${dob || '[DOB]'}`,
      '',
      'PROCEDURE',
      `  Procedure: ${procedureName}`,
      `  Urgency: ${urgency.label} — ${urgency.hint}`,
      `  Estimated time: ${form.estimatedMinutes} minutes (plus setup)`,
      `  Theatre: ${THEATRE_LABELS[form.theatre]}`,
      `  Patient position: ${form.position}`,
      '',
      'ANAESTHESIA',
      `  Type: ${ANAESTHESIA_LABELS[form.anaesthesia]}`,
      form.anaesthetist ? `  Preferred anaesthetist: ${form.anaesthetist}` : '',
      '',
      'PERIOPERATIVE REQUIREMENTS',
      `  Antibiotic prophylaxis: ${form.antibioticProphylaxis}`,
      `  DVT prophylaxis: ${form.dvtProphylaxis}`,
      form.bloodGroup ? `  Blood group: ${form.bloodGroup}` : '',
      form.crossmatch ? `  Cross-match / blood products: ${form.crossmatch}` : '',
      `  Surgical assistant: ${form.assistantNeeded ? 'Required' : 'Not required'}`,
      '',
      form.equipment.length > 0 ? 'SPECIAL EQUIPMENT' : '',
      ...form.equipment.map(e => `  • ${e}`),
      '',
      form.specialNotes ? 'NOTES' : '',
      form.specialNotes ? `  ${form.specialNotes}` : '',
    ];
    setGenerated(lines.filter(l => l !== undefined).join('\n').replace(/\n{3,}/g, '\n\n').trim());
  }

  async function copy() {
    if (!generated) return;
    await navigator.clipboard.writeText(generated);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <CollapsibleCard title="Theatre booking request" defaultOpen={false}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Procedure */}
        <div className="fld">
          <label>Procedure</label>
          <select value={form.procedure} onChange={e => set('procedure', e.target.value)}
            style={{ fontSize: 13, padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6 }}>
            <option value="">— Select procedure —</option>
            {PROCEDURE_PRESETS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {form.procedure === 'Other (specify below)' && (
            <input
              value={form.customProcedure}
              onChange={e => set('customProcedure', e.target.value)}
              placeholder="Specify procedure…"
              style={{ marginTop: 6, fontSize: 13, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6 }}
            />
          )}
        </div>

        {/* Urgency */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Urgency</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {URGENCY_OPTIONS.map(u => (
              <button
                key={u.value} type="button"
                onClick={() => set('urgency', u.value)}
                title={u.hint}
                style={{
                  padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: `2px solid ${form.urgency === u.value ? u.color : '#e2e8f0'}`,
                  background: form.urgency === u.value ? u.color : '#fff',
                  color: form.urgency === u.value ? '#fff' : '#374151',
                }}
              >
                {u.label}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 11, color: '#6b7280', margin: '4px 0 0' }}>{urgency.hint}</p>
        </div>

        {/* Row: estimated time + theatre */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="fld">
            <label>Estimated time (min)</label>
            <input
              type="number" min={15} max={600} step={15}
              value={form.estimatedMinutes}
              onChange={e => set('estimatedMinutes', e.target.value)}
              style={{ fontSize: 13, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6 }}
            />
          </div>
          <div className="fld">
            <label>Theatre / location</label>
            <select value={form.theatre} onChange={e => set('theatre', e.target.value as Theatre)}
              style={{ fontSize: 13, padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6 }}>
              {(Object.entries(THEATRE_LABELS) as [Theatre, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row: anaesthesia + position */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="fld">
            <label>Anaesthesia</label>
            <select value={form.anaesthesia} onChange={e => set('anaesthesia', e.target.value as Anaesthesia)}
              style={{ fontSize: 13, padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6 }}>
              {(Object.entries(ANAESTHESIA_LABELS) as [Anaesthesia, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label>Patient position</label>
            <select value={form.position} onChange={e => set('position', e.target.value)}
              style={{ fontSize: 13, padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6 }}>
              {['Supine', 'Supine — arms out', 'Lithotomy', 'Lloyd-Davies', 'Left lateral', 'Right lateral', 'Prone', 'Semi-recumbent', 'Trendelenburg', 'Reverse Trendelenburg'].map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Perioperative meds */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="fld">
            <label>Antibiotic prophylaxis</label>
            <input value={form.antibioticProphylaxis} onChange={e => set('antibioticProphylaxis', e.target.value)}
              style={{ fontSize: 12, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6 }} />
          </div>
          <div className="fld">
            <label>DVT prophylaxis</label>
            <input value={form.dvtProphylaxis} onChange={e => set('dvtProphylaxis', e.target.value)}
              style={{ fontSize: 12, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6 }} />
          </div>
        </div>

        {/* Blood / cross-match */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="fld">
            <label>Blood group</label>
            <input value={form.bloodGroup} onChange={e => set('bloodGroup', e.target.value)}
              placeholder="e.g. O+"
              style={{ fontSize: 12, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6 }} />
          </div>
          <div className="fld">
            <label>Cross-match / blood products</label>
            <input value={form.crossmatch} onChange={e => set('crossmatch', e.target.value)}
              placeholder="e.g. G&S only / 2 units PRBCs"
              style={{ fontSize: 12, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6 }} />
          </div>
        </div>

        {/* Anaesthetist + assistant */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end' }}>
          <div className="fld">
            <label>Preferred anaesthetist (optional)</label>
            <input value={form.anaesthetist} onChange={e => set('anaesthetist', e.target.value)}
              placeholder="Name or 'any'"
              style={{ fontSize: 12, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6 }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#374151', paddingBottom: 2 }}>
            <input type="checkbox" checked={form.assistantNeeded} onChange={e => set('assistantNeeded', e.target.checked)} />
            Assistant needed
          </label>
        </div>

        {/* Special equipment */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
            Special equipment ({form.equipment.length} selected)
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {EQUIPMENT_OPTIONS.map(eq => {
              const sel = form.equipment.includes(eq);
              return (
                <button key={eq} type="button" onClick={() => toggleEquip(eq)}
                  style={{
                    padding: '3px 9px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
                    border: `1px solid ${sel ? '#3b82f6' : '#d1d5db'}`,
                    background: sel ? '#eff6ff' : '#fff',
                    color: sel ? '#1d4ed8' : '#374151',
                    fontWeight: sel ? 600 : 400,
                  }}>
                  {eq}
                </button>
              );
            })}
          </div>
        </div>

        {/* Special notes */}
        <div className="fld">
          <label>Additional notes for theatre coordinator / anaesthetist</label>
          <textarea
            value={form.specialNotes}
            onChange={e => set('specialNotes', e.target.value)}
            placeholder="e.g. Patient on warfarin — bridge arranged. Likely to require post-op HDU. Known difficult airway (previous intubation note attached)."
            style={{ minHeight: 70, fontSize: 12 }}
          />
        </div>

        {/* Generate */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button" onClick={generate}
            style={{
              padding: '8px 18px', borderRadius: 7, fontSize: 13, fontWeight: 700,
              background: '#0f172a', color: '#fff', border: 'none', cursor: 'pointer',
            }}
          >
            Generate booking request
          </button>
          {generated && (
            <button type="button" onClick={() => void copy()}
              style={{ padding: '8px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: '#fff', border: '1px solid #d1d5db', cursor: 'pointer' }}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          )}
          {generated && (
            <button type="button" onClick={() => window.print()}
              style={{ padding: '8px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: '#fff', border: '1px solid #d1d5db', cursor: 'pointer' }}>
              Print
            </button>
          )}
        </div>

        {generated && (
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, fontFamily: 'inherit', lineHeight: 1.7, color: '#1e293b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px', margin: 0 }}>
            {generated}
          </pre>
        )}
      </div>
    </CollapsibleCard>
  );
}
