import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import SmartTextarea from '@/components/SmartTextarea';

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

      {/* Sign off */}
      {!signed ? (
        <button type="button" onClick={() => setSigned(true)} disabled={!procedure || !capacity}
          style={{ padding: '12px', borderRadius: 8, border: 'none', background: procedure && capacity ? '#15803d' : '#d1d5db', color: '#fff', fontWeight: 700, fontSize: 14, cursor: procedure && capacity ? 'pointer' : 'default', width: '100%' }}>
          Confirm consent documented
        </button>
      ) : (
        <div style={{ padding: '14px 16px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#15803d', marginBottom: 4 }}>✓ Consent documented — {consentDate}</div>
          <div style={{ fontSize: 13, color: '#166534' }}>
            <b>Procedure:</b> {procedure}<br />
            <b>Anaesthesia:</b> {anaesthesia}<br />
            {[...generalRisks, ...specificRisks].length > 0 && <><b>Risks discussed:</b> {[...generalRisks, ...specificRisks].join(', ')}<br /></>}
            {alternatives && <><b>Alternatives:</b> {alternatives}<br /></>}
            {interpreterUsed && <b>Interpreter used</b>}
          </div>
          <button type="button" onClick={() => setSigned(false)} style={{ marginTop: 8, fontSize: 11, color: '#15803d', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Edit</button>
        </div>
      )}
    </div>
  );
}
