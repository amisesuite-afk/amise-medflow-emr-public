import { useState, useRef, useCallback, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import SmartTextarea from '@/components/SmartTextarea';

/* ── Canvas signature pad ───────────────────────────────────────────────── */
interface SigPadProps {
  label: string;
  value: string;         // data URL or ''
  onChange: (v: string) => void;
}

function SignaturePad({ label, value, onChange }: SigPadProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  // Tracks whether the upcoming `value` change originated from the user
  // drawing (canvas already correct) vs. an external update (needs repaint).
  const ownChange = useRef(false);

  // Sync canvas whenever `value` changes externally (e.g. CollapsibleCard
  // collapse → remount, or parent resets the signature).
  useEffect(() => {
    if (ownChange.current) { ownChange.current = false; return; }
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (value) {
      const img = new Image();
      img.onload = () => { if (ref.current) ctx.drawImage(img, 0, 0); };
      img.src = value;
    }
  }, [value]);

  function getPos(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } {
    const rect = ref.current!.getBoundingClientRect();
    if ('touches' in e) {
      const t = e.touches[0];
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    drawing.current = true;
    lastPos.current = getPos(e);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    if (!drawing.current || !lastPos.current) return;
    const ctx = ref.current!.getContext('2d')!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
  }

  const endDraw = useCallback(() => {
    if (!drawing.current) return;       // ignore mouseleave/touchend without pen-down
    drawing.current = false;
    lastPos.current = null;
    if (!ref.current) return;
    ownChange.current = true;
    onChange(ref.current.toDataURL());
  }, [onChange]);

  function clear() {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onChange('');
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
        {value && (
          <button type="button" onClick={clear} style={{ fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            Clear
          </button>
        )}
      </div>
      <canvas
        ref={ref}
        width={480}
        height={100}
        style={{
          width: '100%',
          height: 100,
          border: `1px solid ${value ? '#86efac' : '#d1d5db'}`,
          borderRadius: 6,
          cursor: 'crosshair',
          touchAction: 'none',
          background: '#fff',
          display: 'block',
        }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      {!value && (
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, fontStyle: 'italic' }}>
          Sign above using mouse or finger
        </div>
      )}
    </div>
  );
}

const COMMON_RISKS = [
  'Bleeding requiring transfusion',
  'Infection / wound infection',
  'Deep vein thrombosis (DVT)',
  'Pulmonary embolism (PE)',
  'Anaesthetic complications',
  'Damage to surrounding structures',
  'Conversion to open surgery',
  'Hernia at port / incision site',
  'Recurrence of condition',
  'Chronic pain at incision site',
  'Death (rare)',
];

const PROCEDURE_RISKS: Record<string, string[]> = {
  'laparoscopic cholecystectomy': ['Bile duct injury', 'Bile leak', 'Retained stone in CBD', 'Port site hernia', 'Bowel injury'],
  'appendicectomy': ['Intra-abdominal collection', 'Stump leak', 'Bowel obstruction'],
  'hernia repair': ['Mesh infection', 'Chronic groin pain', 'Testicular atrophy (inguinal)', 'Recurrence'],
  'colonoscopy': ['Perforation', 'Bleeding post-polypectomy', 'Incomplete examination'],
  'ercp': ['Pancreatitis', 'Cholangitis', 'Perforation', 'Bleeding', 'Incomplete duct clearance'],
  'anterior resection': ['Anastomotic leak', 'Temporary stoma', 'Bladder / sexual dysfunction', 'Ileus'],
  'thyroidectomy': ['Recurrent laryngeal nerve injury', 'Hypocalcaemia', 'Hypothyroidism'],
  'mastectomy': ['Lymphoedema', 'Seroma', 'Shoulder stiffness', 'Altered body image'],
};

interface ProcedureTemplate {
  procedure: string;
  anaesthesia: string;
  alternatives: string;
  generalRisks: string[];
  specificRisks: string[];
}

const PROCEDURE_TEMPLATES: ProcedureTemplate[] = [
  {
    procedure: 'Laparoscopic cholecystectomy',
    anaesthesia: 'General anaesthesia',
    alternatives: 'Open cholecystectomy; conservative management with dietary modification',
    generalRisks: ['Bleeding requiring transfusion', 'Infection / wound infection', 'Deep vein thrombosis (DVT)', 'Pulmonary embolism (PE)', 'Anaesthetic complications', 'Conversion to open surgery'],
    specificRisks: ['Bile duct injury', 'Bile leak', 'Retained stone in CBD', 'Port site hernia', 'Bowel injury'],
  },
  {
    procedure: 'Appendicectomy (laparoscopic)',
    anaesthesia: 'General anaesthesia',
    alternatives: 'Open appendicectomy; non-operative antibiotic management (selected cases)',
    generalRisks: ['Bleeding requiring transfusion', 'Infection / wound infection', 'Deep vein thrombosis (DVT)', 'Anaesthetic complications', 'Conversion to open surgery'],
    specificRisks: ['Intra-abdominal collection', 'Stump leak', 'Bowel obstruction'],
  },
  {
    procedure: 'Inguinal hernia repair (laparoscopic, mesh)',
    anaesthesia: 'General anaesthesia',
    alternatives: 'Open tension-free mesh repair; watchful waiting for asymptomatic hernias',
    generalRisks: ['Bleeding requiring transfusion', 'Infection / wound infection', 'Deep vein thrombosis (DVT)', 'Anaesthetic complications', 'Hernia at port / incision site'],
    specificRisks: ['Mesh infection', 'Chronic groin pain', 'Testicular atrophy (inguinal)', 'Recurrence'],
  },
  {
    procedure: 'Colonoscopy ± polypectomy',
    anaesthesia: 'Sedation',
    alternatives: 'CT colonography; flexible sigmoidoscopy (limited); watchful waiting',
    generalRisks: ['Anaesthetic complications'],
    specificRisks: ['Perforation', 'Bleeding post-polypectomy', 'Incomplete examination'],
  },
  {
    procedure: 'ERCP ± sphincterotomy / stone extraction',
    anaesthesia: 'Sedation',
    alternatives: 'Laparoscopic bile duct exploration; percutaneous transhepatic cholangiography (PTC)',
    generalRisks: ['Anaesthetic complications', 'Bleeding requiring transfusion'],
    specificRisks: ['Pancreatitis', 'Cholangitis', 'Perforation', 'Bleeding', 'Incomplete duct clearance'],
  },
  {
    procedure: 'OGD (upper GI endoscopy)',
    anaesthesia: 'Sedation',
    alternatives: 'Barium swallow (limited diagnostic value); capsule endoscopy',
    generalRisks: ['Anaesthetic complications'],
    specificRisks: ['Perforation', 'Bleeding post-polypectomy', 'Incomplete examination'],
  },
  {
    procedure: 'Thyroidectomy (total / hemithyroidectomy)',
    anaesthesia: 'General anaesthesia',
    alternatives: 'Radioactive iodine therapy; anti-thyroid medication; surveillance',
    generalRisks: ['Bleeding requiring transfusion', 'Infection / wound infection', 'Anaesthetic complications'],
    specificRisks: ['Recurrent laryngeal nerve injury', 'Hypocalcaemia', 'Hypothyroidism'],
  },
  {
    procedure: 'Mastectomy ± sentinel lymph node biopsy',
    anaesthesia: 'General anaesthesia',
    alternatives: 'Wide local excision (breast conservation); neoadjuvant chemotherapy then reassess',
    generalRisks: ['Bleeding requiring transfusion', 'Infection / wound infection', 'Deep vein thrombosis (DVT)', 'Anaesthetic complications'],
    specificRisks: ['Lymphoedema', 'Seroma', 'Shoulder stiffness', 'Altered body image'],
  },
  {
    procedure: 'Wide local excision (skin lesion / melanoma)',
    anaesthesia: 'Local anaesthesia',
    alternatives: 'Surveillance with repeat biopsy (benign lesions only)',
    generalRisks: ['Bleeding requiring transfusion', 'Infection / wound infection'],
    specificRisks: ['Hernia at port / incision site', 'Recurrence of condition'],
  },
  {
    procedure: 'Anterior resection (laparoscopic)',
    anaesthesia: 'General anaesthesia',
    alternatives: 'Hartmann\'s procedure; palliative stoma alone; neoadjuvant radiotherapy',
    generalRisks: ['Bleeding requiring transfusion', 'Infection / wound infection', 'Deep vein thrombosis (DVT)', 'Pulmonary embolism (PE)', 'Anaesthetic complications', 'Conversion to open surgery'],
    specificRisks: ['Anastomotic leak', 'Temporary stoma', 'Bladder / sexual dysfunction', 'Ileus'],
  },
];

function procedureRisks(procedure: string): string[] {
  const p = procedure.toLowerCase();
  for (const [key, risks] of Object.entries(PROCEDURE_RISKS)) {
    if (p.includes(key)) return risks;
  }
  return [];
}

function printConsentPdf(opts: {
  patientName: string; age: string; sex: string;
  procedure: string; anaesthesia: string; alternatives: string;
  generalRisks: string[]; specificRisks: string[];
  capacity: boolean; interpreterUsed: boolean;
  patientQuestions: string; notes: string;
  clinicianName: string; consentDate: string;
  patientSig: string; clinicianSig: string;
}) {
  const allRisks = [...opts.generalRisks, ...opts.specificRisks];
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Surgical Consent — ${opts.patientName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; padding: 28px; }
  h1 { font-size: 18px; font-weight: bold; margin-bottom: 4px; }
  .subtitle { font-size: 12px; color: #555; margin-bottom: 18px; }
  .section { margin-bottom: 16px; }
  .section-title { font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.06em; color: #1e3a5f; border-bottom: 1px solid #c7d2fe; padding-bottom: 3px; margin-bottom: 8px; }
  .field { margin-bottom: 6px; }
  .field label { font-weight: bold; }
  .risks { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 4px; }
  .risk-chip { background: #eff6ff; border: 1px solid #93c5fd; border-radius: 12px; padding: 2px 9px; font-size: 11px; }
  .sig-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 16px; }
  .sig-box { border-top: 1px solid #aaa; padding-top: 6px; }
  .sig-box label { font-size: 10px; text-transform: uppercase; color: #666; }
  img.sig { width: 100%; height: 70px; object-fit: contain; border: 1px solid #e2e8f0; background: #fff; margin: 4px 0; }
  .footer { margin-top: 24px; font-size: 10px; color: #888; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  .badge { display: inline-block; background: #f0fdf4; border: 1px solid #86efac; border-radius: 4px; padding: 2px 8px; font-size: 11px; color: #166534; font-weight: bold; }
  @media print { body { padding: 16px; } }
</style></head><body>
<h1>Surgical Consent Form</h1>
<div class="subtitle">Amise Medical Services · ${opts.consentDate}</div>

<div class="section">
  <div class="section-title">Patient details</div>
  <div class="field"><label>Name:</label> ${opts.patientName || '—'}</div>
  <div class="field"><label>Age / Sex:</label> ${[opts.age && `${opts.age}y`, opts.sex].filter(Boolean).join(' · ') || '—'}</div>
</div>

<div class="section">
  <div class="section-title">Procedure</div>
  <div class="field"><label>Operation:</label> ${opts.procedure}</div>
  <div class="field"><label>Anaesthesia:</label> ${opts.anaesthesia}</div>
  ${opts.alternatives ? `<div class="field"><label>Alternatives discussed:</label> ${opts.alternatives}</div>` : ''}
</div>

${allRisks.length > 0 ? `<div class="section">
  <div class="section-title">Risks discussed</div>
  <div class="risks">${allRisks.map(r => `<span class="risk-chip">${r}</span>`).join('')}</div>
</div>` : ''}

<div class="section">
  <div class="section-title">Capacity and consent</div>
  <div class="field">${opts.capacity ? '✓ Patient has capacity to consent' : '⚠ Capacity assessment required'}</div>
  ${opts.interpreterUsed ? '<div class="field">✓ Interpreter used</div>' : ''}
  ${opts.patientQuestions ? `<div class="field"><label>Patient questions / notes:</label> ${opts.patientQuestions}</div>` : ''}
  ${opts.notes ? `<div class="field"><label>Additional notes:</label> ${opts.notes}</div>` : ''}
</div>

<div class="sig-row">
  <div class="sig-box">
    <label>Patient signature</label>
    ${opts.patientSig ? `<img class="sig" src="${opts.patientSig}" alt="patient signature" />` : '<div style="height:70px;border:1px dashed #aaa;margin:4px 0;"></div>'}
    <div style="font-size:11px;color:#555;margin-top:2px;">${opts.patientName || ''} — ${opts.consentDate}</div>
  </div>
  <div class="sig-box">
    <label>Clinician signature</label>
    ${opts.clinicianSig ? `<img class="sig" src="${opts.clinicianSig}" alt="clinician signature" />` : '<div style="height:70px;border:1px dashed #aaa;margin:4px 0;"></div>'}
    <div style="font-size:11px;color:#555;margin-top:2px;">${opts.clinicianName || 'Clinician'} — ${opts.consentDate}</div>
  </div>
</div>

<div class="footer">
  This consent form was completed on ${opts.consentDate} at Amise Medical Services, Saint Lucia.
  The patient confirms they have been given the opportunity to ask questions and that they understand the procedure, anaesthesia, risks, and alternatives described above.
</div>
<script>window.onload = () => { window.print(); }</script>
</body></html>`;

  const w = window.open('', '_blank', 'width=800,height=900');
  if (w) { w.document.write(html); w.document.close(); }
}

export default function SurgicalConsentTab() {
  const { patientName, age, sex } = useAppContext();
  const [procedure, setProcedure] = useState('');
  const [anaesthesia, setAnaesthesia] = useState('General anaesthesia');
  const [alternatives, setAlternatives] = useState('');
  const [specificRisks, setSpecificRisks] = useState<string[]>([]);
  const [generalRisks, setGeneralRisks] = useState<string[]>([]);
  const [capacity, setCapacity] = useState(true);
  const [patientQuestions, setPatientQuestions] = useState('');
  const [interpreterUsed, setInterpreterUsed] = useState(false);
  const [consentDate, setConsentDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [patientSig, setPatientSig] = useState('');
  const [clinicianSig, setClinicianSig] = useState('');
  const [clinicianName, setClinicianName] = useState('');
  const [signed, setSigned] = useState(false);

  const procedureSpecific = procedureRisks(procedure);
  const toggleRisk = (arr: string[], setArr: (v: string[]) => void, v: string) =>
    arr.includes(v) ? setArr(arr.filter(r => r !== v)) : setArr([...arr, v]);

  const inp: React.CSSProperties = { fontSize: 13, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', width: '100%' };

  return (
    <div className="gap-y">
      {/* Header */}
      <div style={{ background: '#1e3a5f', color: '#fff', borderRadius: 10, padding: '14px 18px' }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>Surgical Consent Documentation</div>
        <div style={{ fontSize: 12, color: '#93c5fd', marginTop: 2 }}>
          {patientName || 'Patient'}{age ? `, ${age}y` : ''}{sex && sex !== 'unknown' ? ` · ${sex}` : ''}
        </div>
      </div>

      {/* Quick-fill templates */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
          Quick-fill templates
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {PROCEDURE_TEMPLATES.map(t => (
            <button
              key={t.procedure}
              type="button"
              onClick={() => {
                setProcedure(t.procedure);
                setAnaesthesia(t.anaesthesia);
                setAlternatives(t.alternatives);
                setGeneralRisks(t.generalRisks);
                setSpecificRisks(t.specificRisks);
              }}
              style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
                border: `1px solid ${procedure === t.procedure ? '#1e3a5f' : '#d1d5db'}`,
                background: procedure === t.procedure ? '#1e3a5f' : '#f8fafc',
                color: procedure === t.procedure ? '#fff' : '#374151',
                fontWeight: procedure === t.procedure ? 700 : 400,
              }}
            >
              {t.procedure.split('(')[0].trim()}
            </button>
          ))}
        </div>
      </div>

      <CollapsibleCard title="Procedure details">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>PROCEDURE / OPERATION</label>
            <input value={procedure} onChange={e => setProcedure(e.target.value)} style={inp} placeholder="e.g. Laparoscopic cholecystectomy" />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>ANAESTHESIA</label>
            <select value={anaesthesia} onChange={e => setAnaesthesia(e.target.value)} style={inp}>
              <option>General anaesthesia</option>
              <option>Spinal anaesthesia</option>
              <option>Regional / epidural</option>
              <option>Local anaesthesia</option>
              <option>Sedation</option>
              <option>Local + sedation</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>CONSENT DATE</label>
            <input type="date" value={consentDate} onChange={e => setConsentDate(e.target.value)} style={inp} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>ALTERNATIVES DISCUSSED</label>
            <input value={alternatives} onChange={e => setAlternatives(e.target.value)} style={inp} placeholder="e.g. Conservative management, endoscopic approach, watchful waiting" />
          </div>
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="General risks discussed">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {COMMON_RISKS.map(r => (
            <button key={r} type="button" onClick={() => toggleRisk(generalRisks, setGeneralRisks, r)}
              style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, border: `1px solid ${generalRisks.includes(r) ? '#3b82f6' : '#d1d5db'}`, background: generalRisks.includes(r) ? '#eff6ff' : '#fff', color: generalRisks.includes(r) ? '#1d4ed8' : '#475569', cursor: 'pointer', fontWeight: generalRisks.includes(r) ? 600 : 400 }}>
              {r}
            </button>
          ))}
        </div>
      </CollapsibleCard>

      {procedureSpecific.length > 0 && (
        <CollapsibleCard title={`Procedure-specific risks — ${procedure}`}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {procedureSpecific.map(r => (
              <button key={r} type="button" onClick={() => toggleRisk(specificRisks, setSpecificRisks, r)}
                style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, border: `1px solid ${specificRisks.includes(r) ? '#7c3aed' : '#d1d5db'}`, background: specificRisks.includes(r) ? '#f5f3ff' : '#fff', color: specificRisks.includes(r) ? '#5b21b6' : '#475569', cursor: 'pointer', fontWeight: specificRisks.includes(r) ? 600 : 400 }}>
                {r}
              </button>
            ))}
          </div>
        </CollapsibleCard>
      )}

      <CollapsibleCard title="Capacity and questions">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={capacity} onChange={e => setCapacity(e.target.checked)} />
            Patient has capacity to consent (understands, retains, weighs, communicates)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={interpreterUsed} onChange={e => setInterpreterUsed(e.target.checked)} />
            Interpreter used
          </label>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>PATIENT QUESTIONS / ADDITIONAL NOTES</label>
            <SmartTextarea value={patientQuestions} onChange={setPatientQuestions}
              placeholder="Document any specific questions asked and answers given…"
              style={{ minHeight: 80, width: '100%' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>NOTES</label>
            <SmartTextarea value={notes} onChange={setNotes}
              placeholder="Any additional consent documentation…"
              style={{ minHeight: 60, width: '100%' }} />
          </div>
        </div>
      </CollapsibleCard>

      {/* Signatures */}
      <CollapsibleCard title="Signatures">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SignaturePad label="Patient signature" value={patientSig} onChange={setPatientSig} />
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 3 }}>Clinician name</label>
            <input
              value={clinicianName}
              onChange={e => setClinicianName(e.target.value)}
              placeholder="Dr …"
              style={inp}
            />
          </div>
          <SignaturePad label="Clinician signature" value={clinicianSig} onChange={setClinicianSig} />
        </div>
      </CollapsibleCard>

      {/* Sign off */}
      {!signed ? (
        <button
          type="button"
          onClick={() => setSigned(true)}
          disabled={!procedure || !capacity || !patientSig || !clinicianSig}
          style={{
            padding: '12px',
            borderRadius: 8,
            border: 'none',
            background: (procedure && capacity && patientSig && clinicianSig) ? '#15803d' : '#d1d5db',
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            cursor: (procedure && capacity && patientSig && clinicianSig) ? 'pointer' : 'default',
            width: '100%',
          }}
        >
          {!patientSig || !clinicianSig ? 'Both signatures required to finalise' : 'Finalise consent'}
        </button>
      ) : (
        <div style={{ padding: '14px 16px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#15803d', marginBottom: 6 }}>✓ Consent finalised — {consentDate}</div>
          <div style={{ fontSize: 13, color: '#166534', marginBottom: 10 }}>
            <b>Procedure:</b> {procedure}<br />
            <b>Anaesthesia:</b> {anaesthesia}<br />
            {[...generalRisks, ...specificRisks].length > 0 && <><b>Risks discussed:</b> {[...generalRisks, ...specificRisks].join(', ')}<br /></>}
            {alternatives && <><b>Alternatives:</b> {alternatives}<br /></>}
            {interpreterUsed && <><b>Interpreter used</b><br /></>}
            {clinicianName && <><b>Clinician:</b> {clinicianName}</>}
          </div>
          {/* Signature thumbnails */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#166534', marginBottom: 2 }}>PATIENT</div>
              <img src={patientSig} alt="patient signature" style={{ width: '100%', height: 60, objectFit: 'contain', border: '1px solid #86efac', borderRadius: 4, background: '#fff' }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#166534', marginBottom: 2 }}>CLINICIAN</div>
              <img src={clinicianSig} alt="clinician signature" style={{ width: '100%', height: 60, objectFit: 'contain', border: '1px solid #86efac', borderRadius: 4, background: '#fff' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={() => printConsentPdf({
                patientName, age, sex,
                procedure, anaesthesia, alternatives,
                generalRisks, specificRisks,
                capacity, interpreterUsed,
                patientQuestions, notes,
                clinicianName, consentDate,
                patientSig, clinicianSig,
              })}
              style={{ flex: 1, padding: '8px', borderRadius: 7, border: '1.5px solid #1e3a5f', background: '#fff', color: '#1e3a5f', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
            >
              🖨 Print / Save PDF
            </button>
            <button type="button" onClick={() => setSigned(false)}
              style={{ padding: '8px 14px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
              Edit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
