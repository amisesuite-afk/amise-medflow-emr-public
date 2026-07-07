import { useState, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { VISIT_TYPES } from '@/pages/tabs/CheckInTab';

// ── Shared chip picker ─────────────────────────────────────────────────────────
function ChipRow({ items, selected, onToggle, label }: {
  items: string[]; selected: string[]; onToggle: (v: string) => void; label?: string;
}) {
  return (
    <div>
      {label && <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{label}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.map(item => {
          const on = selected.includes(item);
          return (
            <button key={item} type="button" onClick={() => onToggle(item)}
              style={{ padding: '5px 11px', borderRadius: 16, fontSize: 12, cursor: 'pointer',
                border: `1.5px solid ${on ? '#0d9488' : '#e2e8f0'}`,
                background: on ? '#0d9488' : '#fff', color: on ? '#fff' : '#374151',
                fontWeight: on ? 600 : 400, transition: 'all 0.13s' }}>
              {item}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

const TA_STYLE: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0',
  fontSize: 13, resize: 'vertical', minHeight: 72, outline: 'none', fontFamily: 'inherit', color: '#1e293b',
};

// ── Visit-type panels ──────────────────────────────────────────────────────────

function FollowUpPanel({ onComplete }: { onComplete: () => void }) {
  const ctx = useAppContext();
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [interval, setInterval] = useState('');
  const [examChips, setExamChips] = useState<string[]>([]);
  const [assessment, setAssessment] = useState('');
  const [plan, setPlan] = useState('');

  const SYMPTOMS = [
    'Well / No complaints', 'Improved since last visit', 'Wound pain', 'Wound discharge',
    'Fever', 'Nausea', 'Vomiting', 'Constipation', 'Diarrhoea', 'Bloating',
    'Poor appetite', 'Shortness of breath', 'Chest pain', 'Fatigue',
    'Lower limb swelling', 'Urinary symptoms', 'Reflux / heartburn',
  ];
  const EXAM = [
    'Alert & oriented ×3', 'Comfortable at rest', 'Afebrile', 'Well-hydrated',
    'Wound intact', 'Wound healing well', 'Wound erythema', 'Wound discharge',
    'Sutures / staples intact', 'Soft abdomen', 'Non-tender', 'No oedema',
    'Peripheral pulses intact', 'DVT excluded clinically',
  ];

  function apply() {
    const s = 'Follow-up visit';
    if (interval) ctx.setHpiNotes(interval);
    ctx.setExamGeneral(examChips.filter(c => ['Alert & oriented ×3','Comfortable at rest','Afebrile','Well-hydrated'].includes(c)).join('; '));
    ctx.setExamAbdomen(examChips.filter(c => ['Soft abdomen','Non-tender'].includes(c)).join('; '));
    ctx.setExamWound(examChips.filter(c => c.startsWith('Wound') || c.startsWith('Suture') || c.startsWith('Staples')).join('; '));
    ctx.setExamExtremities(examChips.filter(c => ['No oedema','Peripheral pulses intact','DVT excluded clinically'].includes(c)).join('; '));
    if (assessment) ctx.setAssessment(assessment);
    if (plan) ctx.setPlan(plan);
    if (symptoms.length) ctx.setFreeText(`Follow-up — ${symptoms.join(', ')}`);
    else ctx.setFreeText(s);
    onComplete();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        🔄 Follow-up SOAP Note
      </div>

      <ChipRow items={SYMPTOMS} selected={symptoms}
        onToggle={v => setSymptoms(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])}
        label="S — Subjective (symptoms since last visit)" />

      <Field label="Interval history (optional)">
        <textarea value={interval} onChange={e => setInterval(e.target.value)}
          placeholder="Patient reports… interval since last visit…"
          style={TA_STYLE} />
      </Field>

      <ChipRow items={EXAM} selected={examChips}
        onToggle={v => setExamChips(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])}
        label="O — Objective (examination findings)" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="A — Assessment">
          <textarea value={assessment} onChange={e => setAssessment(e.target.value)}
            placeholder="Clinical impression / diagnosis…"
            style={{ ...TA_STYLE, minHeight: 60 }} />
        </Field>
        <Field label="P — Plan">
          <textarea value={plan} onChange={e => setPlan(e.target.value)}
            placeholder="Continue / change medications, next review…"
            style={{ ...TA_STYLE, minHeight: 60 }} />
        </Field>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={apply}
          style={{ flex: 1, padding: '11px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          Apply & Open Consultation →
        </button>
        <button type="button" onClick={onComplete}
          style={{ padding: '11px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          Skip
        </button>
      </div>
    </div>
  );
}

function PostOpPanel({ onComplete }: { onComplete: () => void }) {
  const ctx = useAppContext();
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [woundChips, setWoundChips] = useState<string[]>([]);
  const [plan, setPlan] = useState('');

  const podDays = ctx.postOpDays ? parseInt(ctx.postOpDays) : null;
  const reviewLabel = ctx.postOpReviewNum === 1 ? '1st' : ctx.postOpReviewNum === 2 ? '2nd' : ctx.postOpReviewNum === 3 ? '3rd' : `${ctx.postOpReviewNum}th`;

  const SYMPTOMS = [
    'Well / No complaints', 'Wound pain', 'Wound discharge', 'Fever',
    'Nausea', 'Vomiting', 'Constipation', 'Diarrhoea', 'Bloating',
    'Poor appetite', 'Shortness of breath', 'Fatigue',
    'Lower limb swelling', 'Urinary symptoms', 'Shoulder tip pain',
    'PR bleeding', 'Drain concerns',
  ];
  const WOUND = [
    'Wound intact', 'Healing well', 'Clean and dry', 'Erythema', 'Warmth',
    'Serous discharge', 'Purulent discharge', 'Haematoma', 'Dehiscence (partial)',
    'Dehiscence (full)', 'Seroma', 'Sutures intact', 'Staples intact',
    'Clips removed', 'Stoma pink and viable', 'Drain in situ',
    'Drain removed', 'No DVT signs', 'Calf tenderness',
  ];

  function apply() {
    const hpi = `${reviewLabel} post-op review${podDays !== null ? ` — POD ${podDays}` : ''}. Symptoms: ${symptoms.length ? symptoms.join(', ') : 'None reported'}.`;
    ctx.setHpiNotes(hpi);
    ctx.setExamWound(woundChips.join('; '));
    ctx.setFreeText(hpi);
    if (plan) ctx.setPlan(plan);
    onComplete();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* POD banner */}
      <div style={{ background: '#f5f3ff', border: '1.5px solid #c4b5fd', borderRadius: 10, padding: '12px 16px' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#7c3aed' }}>
          🩹 {reviewLabel} Post-op Review
        </div>
        {podDays !== null && (
          <div style={{ fontSize: 14, color: '#6d28d9', marginTop: 3 }}>
            POD {podDays} — {podDays < 3 ? 'Early post-op' : podDays < 14 ? 'Intermediate recovery' : 'Late recovery'}
          </div>
        )}
        {!podDays && (
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Set operation date in check-in for POD calculation</div>
        )}
      </div>

      <ChipRow items={SYMPTOMS} selected={symptoms}
        onToggle={v => setSymptoms(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])}
        label="Symptoms since last review" />

      <ChipRow items={WOUND} selected={woundChips}
        onToggle={v => setWoundChips(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])}
        label="Wound / wound site findings" />

      <Field label="Management plan">
        <textarea value={plan} onChange={e => setPlan(e.target.value)}
          placeholder="Continue medications, wound care, next review, discharge plan…"
          style={TA_STYLE} />
      </Field>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={apply}
          style={{ flex: 1, padding: '11px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          Apply & Open Consultation →
        </button>
        <button type="button" onClick={onComplete}
          style={{ padding: '11px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          Skip
        </button>
      </div>
    </div>
  );
}

function EndoscopyPanel({ type, onComplete }: { type: 'ercp' | 'endoscopy_ogd' | 'endoscopy_col'; onComplete: () => void }) {
  const ctx = useAppContext();
  const [indication, setIndication] = useState<string[]>([]);
  const [prep, setPrep] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const labels: Record<string, string> = {
    ercp: 'ERCP',
    endoscopy_ogd: 'OGD (Upper GI Endoscopy)',
    endoscopy_col: 'Colonoscopy',
  };
  const colors: Record<string, string> = { ercp: '#0891b2', endoscopy_ogd: '#0891b2', endoscopy_col: '#0891b2' };

  const INDICATIONS: Record<string, string[]> = {
    ercp: [
      'CBD stones / choledocholithiasis', 'Biliary obstruction (malignant)', 'Biliary obstruction (benign)',
      'Cholangitis', 'Bile leak', 'Biliary stricture', 'Pancreatic duct pathology',
      'Sphincter of Oddi dysfunction', 'Post-cholecystectomy pain', 'Stent exchange / removal',
    ],
    endoscopy_ogd: [
      'Dyspepsia / epigastric pain', 'Dysphagia / odynophagia', 'GORD / reflux',
      'Upper GI bleeding', 'Anaemia (iron deficiency)', 'Suspected malignancy',
      'Barrett\'s oesophagus surveillance', 'H. pylori testing', 'Foreign body removal',
      'Haemostasis / polypectomy', 'Dilatation', 'PEG insertion',
    ],
    endoscopy_col: [
      'Colorectal cancer screening', 'Polyp surveillance', 'PR bleeding / rectal bleeding',
      'Change in bowel habit', 'Iron-deficiency anaemia', 'Suspected malignancy',
      'IBD assessment / biopsy', 'Incomplete colonoscopy follow-up',
      'Post-anterior resection surveillance', 'Therapeutic polypectomy',
    ],
  };

  const PREP_ITEMS: Record<string, string[]> = {
    ercp: ['NBM ≥ 6h', 'IV access established', 'Antibiotics given', 'Consent obtained', 'Coagulation checked', 'CBD imaging reviewed'],
    endoscopy_ogd: ['NBM ≥ 6h', 'IV access established', 'Consent obtained', 'Anticoagulation bridged', 'INR checked'],
    endoscopy_col: ['Bowel prep completed', 'NBM for sedation', 'IV access established', 'Consent obtained', 'Anticoagulation bridged'],
  };

  const color = colors[type];

  function apply() {
    const ind = indication.join(', ') || 'see notes';
    ctx.setFreeText(`${labels[type]} — Indication: ${ind}. ${notes}`);
    ctx.setHpiNotes(`Indication: ${ind}\n${notes}`);
    onComplete();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        🔭 {labels[type]} — Procedure Setup
      </div>

      <ChipRow items={INDICATIONS[type]} selected={indication}
        onToggle={v => setIndication(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])}
        label="Indication(s)" />

      <ChipRow items={PREP_ITEMS[type]} selected={prep}
        onToggle={v => setPrep(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])}
        label="Pre-procedure checklist" />

      <Field label="Additional notes">
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Previous reports, relevant history, specific technical requests…"
          style={TA_STYLE} />
      </Field>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={apply}
          style={{ flex: 1, padding: '11px', borderRadius: 8, border: 'none', background: color, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          Apply & Open Consultation →
        </button>
        <button type="button" onClick={onComplete}
          style={{ padding: '11px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          Skip
        </button>
      </div>
    </div>
  );
}

function BreastPanel({ onComplete }: { onComplete: () => void }) {
  const ctx = useAppContext();
  const [side, setSide] = useState<'left' | 'right' | 'bilateral'>('right');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [examChips, setExamChips] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const SYMPTOMS = [
    'Breast lump', 'Breast pain / mastalgia', 'Nipple discharge', 'Nipple inversion',
    'Skin change (peau d\'orange)', 'Skin dimpling', 'Erythema / redness', 'Axillary lump',
    'Previous breast surgery', 'Family history breast cancer', 'Screening / mammogram follow-up',
    'Post-biopsy review', 'Post-op review', 'Surveillance',
  ];
  const EXAM = [
    'Lump palpable', 'Well-circumscribed', 'Irregular border', 'Hard / firm', 'Soft / cystic',
    'Mobile', 'Fixed to skin', 'Fixed to chest wall', 'Tender', 'Non-tender',
    'Nipple discharge (serous)', 'Nipple discharge (bloody)', 'Nipple retraction',
    'Skin thickening', 'Axillary LN palpable', 'Axillary LN matted', 'No LN palpable',
    'Contralateral normal', 'No chest wall involvement',
  ];

  function apply() {
    const sideTxt = side === 'bilateral' ? 'Bilateral' : side === 'left' ? 'Left' : 'Right';
    ctx.setFreeText(`Breast Clinic — ${sideTxt}: ${symptoms.join(', ')}`);
    ctx.setExamBreast(`${sideTxt} breast: ${examChips.join('; ')}. ${notes}`);
    onComplete();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#db2777', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        🩺 Breast Clinic Assessment
      </div>

      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Side</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['right', 'left', 'bilateral'] as const).map(s => (
            <button key={s} type="button" onClick={() => setSide(s)}
              style={{ padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                border: `2px solid ${side === s ? '#db2777' : '#e2e8f0'}`,
                background: side === s ? '#db2777' : '#fff',
                color: side === s ? '#fff' : '#374151' }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <ChipRow items={SYMPTOMS} selected={symptoms}
        onToggle={v => setSymptoms(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])}
        label="Presenting complaint" />

      <ChipRow items={EXAM} selected={examChips}
        onToggle={v => setExamChips(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])}
        label="Clinical breast examination" />

      <Field label="Additional notes">
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Quadrant, clock position, size estimate, previous imaging, BI-RADS…"
          style={TA_STYLE} />
      </Field>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={apply}
          style={{ flex: 1, padding: '11px', borderRadius: 8, border: 'none', background: '#db2777', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          Apply & Open Consultation →
        </button>
        <button type="button" onClick={onComplete}
          style={{ padding: '11px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          Skip
        </button>
      </div>
    </div>
  );
}

function TelephonePanel({ onComplete }: { onComplete: () => void }) {
  const ctx = useAppContext();
  const [callTime] = useState(() => new Date().toLocaleTimeString('en-LC', { hour: '2-digit', minute: '2-digit' }));
  const [reason, setReason] = useState('');
  const [advice, setAdvice] = useState('');
  const [callerType, setCallerType] = useState<'patient' | 'relative' | 'gp' | 'nurse'>('patient');

  function apply() {
    const note = `TELEPHONE CONSULTATION — ${callTime}\nCaller: ${callerType}\nReason: ${reason}\nAdvice given: ${advice}`;
    ctx.setHpiNotes(note);
    ctx.setFreeText(`Telephone consult — ${reason}`);
    onComplete();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        📞 Telephone Consultation — {callTime}
      </div>

      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Caller</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['patient', 'relative', 'gp', 'nurse'] as const).map(c => (
            <button key={c} type="button" onClick={() => setCallerType(c)}
              style={{ padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 12,
                border: `2px solid ${callerType === c ? '#d97706' : '#e2e8f0'}`,
                background: callerType === c ? '#d97706' : '#fff',
                color: callerType === c ? '#fff' : '#374151' }}>
              {c === 'gp' ? 'GP / Referring Dr' : c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <Field label="Reason for call">
        <textarea value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Reason for call, symptoms reported, questions asked…"
          style={TA_STYLE} />
      </Field>

      <Field label="Advice / response given">
        <textarea value={advice} onChange={e => setAdvice(e.target.value)}
          placeholder="Advice given, medications adjusted, referral arranged, follow-up planned…"
          style={TA_STYLE} />
      </Field>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={apply}
          style={{ flex: 1, padding: '11px', borderRadius: 8, border: 'none', background: '#d97706', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          Document & Open Consultation →
        </button>
        <button type="button" onClick={onComplete}
          style={{ padding: '11px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          Skip
        </button>
      </div>
    </div>
  );
}

function DiabeticFootPanel({ onComplete }: { onComplete: () => void }) {
  const ctx = useAppContext();
  const [side, setSide] = useState<'right' | 'left' | 'bilateral'>('right');
  const [wagnerGrade, setWagnerGrade] = useState<number | null>(null);
  const [woundChips, setWoundChips] = useState<string[]>([]);
  const [vascularChips, setVascularChips] = useState<string[]>([]);
  const [neuroChips, setNeuroChips] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const WAGNER = [
    { grade: 0, label: 'Grade 0', desc: 'Intact skin — at-risk foot' },
    { grade: 1, label: 'Grade 1', desc: 'Superficial ulcer (no subcutaneous tissue)' },
    { grade: 2, label: 'Grade 2', desc: 'Deep ulcer (tendon, capsule, bone)' },
    { grade: 3, label: 'Grade 3', desc: 'Deep ulcer with abscess / osteomyelitis' },
    { grade: 4, label: 'Grade 4', desc: 'Partial foot gangrene' },
    { grade: 5, label: 'Grade 5', desc: 'Whole foot gangrene' },
  ];
  const WOUND = [
    'Wound clean', 'Slough present', 'Necrotic tissue', 'Purulent exudate',
    'Serous exudate', 'Undermining', 'Sinuses / tunnels', 'Malodorous',
    'Surrounding erythema', 'Cellulitis', 'Probe-to-bone positive',
    'Osteomyelitis suspected', 'Dressing in situ', 'VAC in situ',
  ];
  const VASCULAR = [
    'Pedal pulses present', 'Pedal pulses absent', 'Doppler signals present',
    'Doppler signals absent', 'ABI performed', 'Pallor on elevation',
    'Dependent rubor', 'Capillary refill < 2s', 'Capillary refill > 2s',
    'No critical ischaemia', 'Critical ischaemia likely',
  ];
  const NEURO = [
    'Protective sensation intact', 'Protective sensation lost', 'Vibration sense reduced',
    'Neuropathic pain', 'Callus formation', 'Charcot foot changes', 'Deformity',
    'Monofilament test normal', 'Monofilament test abnormal',
  ];

  function apply() {
    const sideTxt = side === 'bilateral' ? 'Bilateral' : `${side.charAt(0).toUpperCase() + side.slice(1)}`;
    const wg = wagnerGrade !== null ? `Wagner Grade ${wagnerGrade}` : '';
    ctx.setFreeText(`Diabetic Foot — ${sideTxt}${wg ? ` — ${wg}` : ''}`);
    ctx.setExamWound([sideTxt, wg, ...woundChips].filter(Boolean).join('; '));
    ctx.setExamExtremities([...vascularChips, ...neuroChips].join('; '));
    if (notes) ctx.setHpiNotes(notes);
    onComplete();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        🦶 Diabetic Foot Assessment
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Side</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['right', 'left', 'bilateral'] as const).map(s => (
              <button key={s} type="button" onClick={() => setSide(s)}
                style={{ padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 12,
                  border: `2px solid ${side === s ? '#dc2626' : '#e2e8f0'}`,
                  background: side === s ? '#dc2626' : '#fff',
                  color: side === s ? '#fff' : '#374151' }}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Wagner Wound Classification</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {WAGNER.map(w => (
            <button key={w.grade} type="button" onClick={() => setWagnerGrade(w.grade)}
              style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                border: `2px solid ${wagnerGrade === w.grade ? '#dc2626' : '#e2e8f0'}`,
                background: wagnerGrade === w.grade ? '#fef2f2' : '#fff' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: wagnerGrade === w.grade ? '#dc2626' : '#374151' }}>{w.label}</span>
              <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 8 }}>{w.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <ChipRow items={WOUND} selected={woundChips}
        onToggle={v => setWoundChips(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])}
        label="Wound characteristics" />

      <ChipRow items={VASCULAR} selected={vascularChips}
        onToggle={v => setVascularChips(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])}
        label="Vascular assessment" />

      <ChipRow items={NEURO} selected={neuroChips}
        onToggle={v => setNeuroChips(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])}
        label="Neurological assessment" />

      <Field label="Additional notes">
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Duration of ulcer, previous treatments, microbiology, vascular investigations…"
          style={TA_STYLE} />
      </Field>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={apply}
          style={{ flex: 1, padding: '11px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          Apply & Open Consultation →
        </button>
        <button type="button" onClick={onComplete}
          style={{ padding: '11px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          Skip
        </button>
      </div>
    </div>
  );
}

function UrgentReferralPanel({ onComplete, onGoToTriage }: { onComplete: () => void; onGoToTriage: () => void }) {
  const ctx = useAppContext();
  const [urgency, setUrgency] = useState<'emergency' | 'urgent' | 'soon' | null>(null);
  const [complaint, setComplaint] = useState('');
  const [referralChips, setReferralChips] = useState<string[]>([]);

  const REFERRAL_REASONS = [
    'Acute abdomen', 'Intestinal obstruction', 'Perforated viscus', 'GI bleeding (active)',
    'Obstructive jaundice', 'Acute cholecystitis', 'Acute appendicitis',
    'Incarcerated hernia', 'Major trauma', 'Rectal bleeding (acute)',
    'Post-op complication', 'Wound dehiscence', 'Anastomotic leak',
    'Abscess / sepsis', 'Breast emergency', 'Vascular emergency',
  ];

  const URGENCY_OPTS = [
    { id: 'emergency' as const, label: '🚨 Emergency', desc: 'Immediate (<1h) — ER/theatre now', color: '#dc2626', bg: '#fef2f2' },
    { id: 'urgent' as const, label: '⚡ Urgent', desc: 'Same day (<24h)', color: '#d97706', bg: '#fffbeb' },
    { id: 'soon' as const, label: '📅 Soon', desc: 'Within 2 weeks', color: '#2563eb', bg: '#eff6ff' },
  ];

  function apply() {
    const urgencyLabel = urgency === 'emergency' ? 'EMERGENCY' : urgency === 'urgent' ? 'URGENT' : 'SOON';
    const text = `URGENT REFERRAL [${urgencyLabel}] — ${complaint}. Presenting: ${referralChips.join(', ')}`;
    ctx.setFreeText(text);
    ctx.setHpiNotes(text);
    if (urgency === 'emergency') {
      onGoToTriage();
    } else {
      onComplete();
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        🚨 Urgent Referral — Triage
      </div>

      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Urgency level</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {URGENCY_OPTS.map(o => (
            <button key={o.id} type="button" onClick={() => setUrgency(o.id)}
              style={{ flex: '1 1 140px', padding: '10px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                border: `2px solid ${urgency === o.id ? o.color : '#e2e8f0'}`,
                background: urgency === o.id ? o.bg : '#fff' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: o.color }}>{o.label}</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{o.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <ChipRow items={REFERRAL_REASONS} selected={referralChips}
        onToggle={v => setReferralChips(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])}
        label="Presenting problem(s)" />

      <Field label="Reason for referral / additional notes">
        <textarea value={complaint} onChange={e => setComplaint(e.target.value)}
          placeholder="Brief clinical summary, vital signs concerns, investigations done…"
          style={TA_STYLE} />
      </Field>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={apply} disabled={!urgency}
          style={{ flex: 1, padding: '11px', borderRadius: 8, border: 'none',
            background: urgency ? (urgency === 'emergency' ? '#dc2626' : '#d97706') : '#d1d5db',
            color: '#fff', fontWeight: 700, fontSize: 13, cursor: urgency ? 'pointer' : 'not-allowed' }}>
          {urgency === 'emergency' ? '🚨 Go to Triage →' : 'Document & Open Consultation →'}
        </button>
        <button type="button" onClick={onComplete}
          style={{ padding: '11px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          Skip
        </button>
      </div>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

interface Props {
  onComplete: () => void;
  onGoToTriage?: () => void;
}

export default function VisitTypeOpeningPanel({ onComplete, onGoToTriage }: Props) {
  const ctx = useAppContext();
  const { visitType, patientName, age, sex, postOpReviewNum, postOpDays } = ctx;

  const vtMeta = useMemo(() => VISIT_TYPES.find(v => v.id === visitType), [visitType]);

  if (!visitType || visitType === 'new_consult') return null;

  const podDays = postOpDays ? parseInt(postOpDays) : null;
  const reviewLabel = postOpReviewNum === 1 ? '1st' : postOpReviewNum === 2 ? '2nd' : postOpReviewNum === 3 ? '3rd' : `${postOpReviewNum}th`;

  return (
    <div style={{
      background: '#fff', border: `1.5px solid ${vtMeta?.color ?? '#e2e8f0'}`,
      borderRadius: 12, padding: '16px 18px', marginBottom: 12,
      boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
    }}>
      {/* Visit type badge row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{
          fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
          padding: '3px 10px', borderRadius: 6,
          background: `${vtMeta?.color ?? '#0d9488'}18`,
          border: `1.5px solid ${vtMeta?.color ?? '#0d9488'}40`,
          color: vtMeta?.color ?? '#0d9488',
        }}>
          {vtMeta?.icon} {vtMeta?.label}
        </span>
        <span style={{ fontSize: 12, color: '#64748b' }}>
          {patientName}{age ? `, ${age}y` : ''}{sex && sex !== 'unknown' ? ` · ${sex}` : ''}
          {visitType === 'post_op' && podDays !== null ? ` · POD ${podDays} · ${reviewLabel} review` : ''}
        </span>
        <button type="button" onClick={onComplete}
          style={{ marginLeft: 'auto', fontSize: 11, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>
          ✕ skip
        </button>
      </div>

      {visitType === 'follow_up' && <FollowUpPanel onComplete={onComplete} />}
      {visitType === 'post_op' && <PostOpPanel onComplete={onComplete} />}
      {(visitType === 'ercp' || visitType === 'endoscopy_ogd' || visitType === 'endoscopy_col') && (
        <EndoscopyPanel type={visitType as 'ercp' | 'endoscopy_ogd' | 'endoscopy_col'} onComplete={onComplete} />
      )}
      {visitType === 'breast' && <BreastPanel onComplete={onComplete} />}
      {visitType === 'telephone' && <TelephonePanel onComplete={onComplete} />}
      {visitType === 'diabetic_foot' && <DiabeticFootPanel onComplete={onComplete} />}
      {visitType === 'urgent' && (
        <UrgentReferralPanel onComplete={onComplete} onGoToTriage={onGoToTriage ?? onComplete} />
      )}
    </div>
  );
}
