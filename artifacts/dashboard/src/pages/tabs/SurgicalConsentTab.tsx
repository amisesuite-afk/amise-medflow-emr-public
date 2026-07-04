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

function procedureRisks(procedure: string): string[] {
  const p = procedure.toLowerCase();
  for (const [key, risks] of Object.entries(PROCEDURE_RISKS)) {
    if (p.includes(key)) return risks;
  }
  return [];
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
          <button type="button" onClick={() => setSigned(false)} style={{ fontSize: 11, color: '#15803d', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
