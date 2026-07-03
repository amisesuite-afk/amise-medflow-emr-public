import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import { getApiOrigin } from '@/lib/api-origin';

function apiUrl(path: string) {
  const o = getApiOrigin();
  return o ? `${o}${path}` : path;
}

type AnaesthesiaType = 'GA' | 'Spinal' | 'Epidural' | 'Regional block' | 'Local + sedation' | 'Local only';

const COMMON_PROCEDURES = [
  'Laparoscopic cholecystectomy',
  'Open cholecystectomy (conversion)',
  'Laparoscopic appendicectomy',
  'Open appendicectomy',
  'Inguinal hernia repair — open (Lichtenstein)',
  'Inguinal hernia repair — laparoscopic (TEP)',
  'Inguinal hernia repair — laparoscopic (TAPP)',
  'Umbilical hernia repair (open, suture)',
  'Umbilical hernia repair (open, mesh)',
  'Incisional hernia repair (open, mesh)',
  'Diagnostic laparoscopy',
  'Diagnostic laparoscopy + biopsy',
  'Hartmann\'s procedure',
  'Right hemicolectomy (open)',
  'Right hemicolectomy (laparoscopic)',
  'Anterior resection (laparoscopic)',
  'Sigmoid colectomy',
  'Exploratory laparotomy',
  'Small bowel resection + anastomosis',
  'Splenectomy (laparoscopic)',
  'Liver resection — right hepatectomy',
  'Liver resection — left lateral sectionectomy',
  'Distal pancreatectomy',
  'Whipple procedure (pancreaticoduodenectomy)',
  'Total thyroidectomy',
  'Hemithyroidectomy',
  'Parathyroidectomy',
  'Wide local excision',
  'Wide local excision + sentinel lymph node biopsy',
  'Simple mastectomy',
  'Modified radical mastectomy',
  'Axillary node clearance (level II)',
  'Haemorrhoidectomy (Milligan-Morgan)',
  'Haemorrhoidectomy (Ferguson)',
  'Lateral internal sphincterotomy',
  'Fistula-in-ano — lay-open',
  'Fistula-in-ano — seton placement',
  'Pilonidal sinus excision',
  'Excision biopsy',
  'Incision and drainage (abscess)',
  'Colonoscopy',
  'Colonoscopy + polypectomy',
  'OGD / gastroscopy',
  'ERCP + sphincterotomy',
  'ERCP + stone extraction',
  'ERCP + stent insertion',
  'Percutaneous cholecystostomy',
  'Other (see notes)',
];

const COMPLICATIONS_PRESETS = [
  'None',
  'Minimal bleeding — controlled with diathermy',
  'Bleeding from cystic artery — controlled with clips',
  'Dense adhesions — dissection prolonged',
  'Iatrogenic enterotomy — repaired primarily',
  'Conversion to open due to technical difficulty',
  'Conversion to open due to bleeding',
  'Inadvertent visceral injury — repaired',
  'Difficult anatomy — modified technique required',
];

interface OpForm {
  procedure: string;
  assistant: string;
  anaesthesia: AnaesthesiaType;
  anaesthetist: string;
  position: string;
  incision: string;
  duration: string;
  findings: string;
  complications: string;
  specimensSent: string;
  closure: string;
  postOpInstructions: string;
  bloodLoss: string;
  drains: string;
}

const DEFAULT: OpForm = {
  procedure: '',
  assistant: '',
  anaesthesia: 'GA',
  anaesthetist: '',
  position: 'Supine',
  incision: '',
  duration: '',
  findings: '',
  complications: 'None',
  specimensSent: '',
  closure: 'Standard layered closure',
  postOpInstructions: '',
  bloodLoss: '<50 mL',
  drains: 'None',
};

export default function OperativeNoteGenerator() {
  const { patientName, age, sex, dob } = useAppContext();
  const [form, setForm] = useState<OpForm>(DEFAULT);
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function set<K extends keyof OpForm>(key: K, val: OpForm[K]) {
    setForm(prev => ({ ...prev, [key]: val }));
    setOutput('');
  }

  async function generate() {
    if (!form.procedure.trim()) { setError('Procedure name is required.'); return; }
    setLoading(true); setError(null); setOutput('');

    try {
      const res = await fetch(apiUrl('/api/generate-operative-note'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient: { name: patientName, age, sex, dob },
          ...form,
          date: new Date().toLocaleDateString('en-LC', { timeZone: 'America/St_Lucia', dateStyle: 'long' }),
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText);
        throw new Error(txt || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No response body');
      let draft = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        draft += decoder.decode(value, { stream: true });
        setOutput(draft);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <CollapsibleCard title="Operative note generator" defaultOpen={false}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Procedure */}
        <div className="fld">
          <label>Procedure</label>
          <select value={form.procedure} onChange={e => set('procedure', e.target.value)}
            style={{ fontSize: 13, padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6 }}>
            <option value="">— Select procedure —</option>
            {COMMON_PROCEDURES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* Row: surgeon / assistant */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="fld">
            <label>Surgeon</label>
            <input value="Dr Dawit Daniel Kabiye" readOnly
              style={{ fontSize: 12, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, background: '#f8fafc', color: '#6b7280' }} />
          </div>
          <div className="fld">
            <label>Assistant / scrub (optional)</label>
            <input value={form.assistant} onChange={e => set('assistant', e.target.value)}
              placeholder="Name and grade"
              style={{ fontSize: 12, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6 }} />
          </div>
        </div>

        {/* Row: anaesthesia / anaesthetist */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="fld">
            <label>Anaesthesia</label>
            <select value={form.anaesthesia} onChange={e => set('anaesthesia', e.target.value as AnaesthesiaType)}
              style={{ fontSize: 13, padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6 }}>
              {(['GA', 'Spinal', 'Epidural', 'Regional block', 'Local + sedation', 'Local only'] as AnaesthesiaType[]).map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label>Anaesthetist (optional)</label>
            <input value={form.anaesthetist} onChange={e => set('anaesthetist', e.target.value)}
              placeholder="Name"
              style={{ fontSize: 12, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6 }} />
          </div>
        </div>

        {/* Row: position / duration */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div className="fld">
            <label>Position</label>
            <select value={form.position} onChange={e => set('position', e.target.value)}
              style={{ fontSize: 13, padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6 }}>
              {['Supine', 'Supine — arms out', 'Lithotomy', 'Lloyd-Davies', 'Left lateral', 'Right lateral', 'Prone', 'Trendelenburg', 'Reverse Trendelenburg'].map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label>Duration (min)</label>
            <input type="number" min={5} step={5} value={form.duration} onChange={e => set('duration', e.target.value)}
              placeholder="e.g. 75"
              style={{ fontSize: 12, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6 }} />
          </div>
          <div className="fld">
            <label>Blood loss</label>
            <select value={form.bloodLoss} onChange={e => set('bloodLoss', e.target.value)}
              style={{ fontSize: 13, padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6 }}>
              {['<50 mL', '50–100 mL', '100–250 mL', '250–500 mL', '500–1000 mL', '>1000 mL'].map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Incision */}
        <div className="fld">
          <label>Incision / access</label>
          <input value={form.incision} onChange={e => set('incision', e.target.value)}
            placeholder="e.g. Infraumbilical port + two 5mm RUQ ports (laparoscopic) / Right grid-iron incision (open)"
            style={{ fontSize: 12, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6 }} />
        </div>

        {/* Findings */}
        <div className="fld">
          <label>Intraoperative findings</label>
          <textarea value={form.findings} onChange={e => set('findings', e.target.value)}
            placeholder="e.g. Mildly inflamed gallbladder with a single large stone in the neck. Cystic artery and duct clearly identified after critical view of safety achieved. No bile duct dilatation. Liver normal in appearance."
            style={{ minHeight: 80, fontSize: 12 }} />
        </div>

        {/* Complications */}
        <div className="fld">
          <label>Intraoperative complications</label>
          <select style={{ fontSize: 12, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, marginBottom: 6 }}
            value=""
            onChange={e => { if (e.target.value) set('complications', e.target.value); }}>
            <option value="">Quick fill…</option>
            {COMPLICATIONS_PRESETS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <textarea value={form.complications} onChange={e => set('complications', e.target.value)}
            style={{ minHeight: 50, fontSize: 12 }} />
        </div>

        {/* Specimens + drains */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="fld">
            <label>Specimens sent</label>
            <input value={form.specimensSent} onChange={e => set('specimensSent', e.target.value)}
              placeholder="e.g. Gallbladder for histology"
              style={{ fontSize: 12, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6 }} />
          </div>
          <div className="fld">
            <label>Drains</label>
            <input value={form.drains} onChange={e => set('drains', e.target.value)}
              placeholder="e.g. 19Fr Blake in Morrison's pouch"
              style={{ fontSize: 12, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6 }} />
          </div>
        </div>

        {/* Closure */}
        <div className="fld">
          <label>Closure</label>
          <input value={form.closure} onChange={e => set('closure', e.target.value)}
            placeholder="e.g. 10mm port closed with Vicryl J-needle. Skin closed with subcuticular Monocryl."
            style={{ fontSize: 12, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6 }} />
        </div>

        {/* Post-op instructions */}
        <div className="fld">
          <label>Immediate post-op instructions (optional)</label>
          <textarea value={form.postOpInstructions} onChange={e => set('postOpInstructions', e.target.value)}
            placeholder="e.g. Regular diet when tolerating fluids. Analgesia PRN. Review in 2 weeks."
            style={{ minHeight: 60, fontSize: 12 }} />
        </div>

        {/* Generate */}
        {error && <div style={{ fontSize: 12, color: '#dc2626', padding: '6px 10px', background: '#fef2f2', borderRadius: 6 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => void generate()} disabled={loading}
            style={{
              padding: '8px 18px', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
              background: loading ? '#94a3b8' : '#0f172a', color: '#fff', border: 'none',
            }}>
            {loading ? 'Generating…' : 'Generate operative note'}
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
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, fontFamily: 'inherit', lineHeight: 1.7, color: '#1e293b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px', margin: 0 }}>
            {output}
          </pre>
        )}
      </div>
    </CollapsibleCard>
  );
}
