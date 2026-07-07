import { useState, useMemo } from 'react';
import { ChevronRight, Search, X, Check, Stethoscope } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';

// ── Data ─────────────────────────────────────────────────────────────────────

const CC_CHIPS = [
  { id: 'abd_pain',      label: 'Abdominal pain'           },
  { id: 'hernia',        label: 'Groin / hernia lump'       },
  { id: 'breast',        label: 'Breast lump / change'      },
  { id: 'reflux',        label: 'Reflux / heartburn'        },
  { id: 'bowel',         label: 'Change in bowel habit'     },
  { id: 'rectal_bleed',  label: 'Rectal bleeding'           },
  { id: 'weight_loss',   label: 'Unintentional weight loss' },
  { id: 'jaundice',      label: 'Jaundice / yellow skin'    },
  { id: 'wound',         label: 'Wound / post-op review'    },
  { id: 'neck_lump',     label: 'Neck lump / thyroid'       },
  { id: 'dysphagia',     label: 'Difficulty swallowing'     },
  { id: 'bloating',      label: 'Bloating / distension'     },
  { id: 'skin',          label: 'Skin lesion / melanoma'    },
  { id: 'anal',          label: 'Anal pain / haemorrhoids'  },
  { id: 'nausea',        label: 'Nausea / vomiting'         },
  { id: 'followup',      label: 'Follow-up / review'        },
  { id: 'screening',     label: 'Screening / wellness'      },
  { id: 'ercp',          label: 'ERCP / biliary workup'     },
  { id: 'other',         label: 'Other — describe below'    },
];

const PMH_CONDITIONS = [
  'Hypertension', 'Type 2 diabetes', 'Type 1 diabetes',
  'Ischaemic heart disease', 'Atrial fibrillation', 'Heart failure',
  'Stroke / TIA', 'Chronic kidney disease', 'COPD', 'Asthma',
  'Hypothyroidism', 'Hyperthyroidism', 'Hyperlipidaemia',
  'GORD / peptic ulcer', 'IBD / Crohn\'s disease', 'Cirrhosis',
  'Obesity / metabolic syndrome', 'Obstructive sleep apnoea',
  'Depression / anxiety', 'Cancer (specify)', 'HIV / AIDS',
  'Sickle cell disease', 'Coagulopathy / on anticoagulation',
  'Peripheral vascular disease', 'Chronic pain syndrome',
];

const SURGERY_LIST = [
  'Appendicectomy', 'Cholecystectomy', 'Hernia repair (inguinal)',
  'Hernia repair (umbilical/incisional)', 'Bowel resection',
  'Anterior resection', 'Hartmann\'s procedure', 'Stoma formation',
  'Caesarean section', 'Hysterectomy', 'Myomectomy',
  'Thyroidectomy', 'Parathyroidectomy',
  'Mastectomy', 'Wide local excision / breast surgery',
  'Gastric bypass / sleeve gastrectomy', 'Nissen fundoplication',
  'Splenectomy', 'Liver resection', 'Whipple procedure',
  'ERCP / sphincterotomy', 'Laparoscopic adhesiolysis',
  'Joint replacement', 'Spinal surgery',
  'Cardiac surgery / CABG', 'Vascular surgery',
  'Other abdominal surgery',
];

const ALLERGENS = [
  'Penicillin', 'Amoxicillin / Ampicillin', 'Sulfonamides',
  'Cephalosporins', 'Metronidazole', 'Ciprofloxacin',
  'NSAIDs / Ibuprofen', 'Aspirin', 'Codeine', 'Morphine / Opioids',
  'Iodine / IV contrast', 'Latex', 'Chlorhexidine',
  'Plaster / adhesive', 'Suxamethonium',
];

// ── Sub-components ────────────────────────────────────────────────────────────

function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 24 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          width: i === current ? 24 : 8, height: 8,
          borderRadius: 4,
          background: i < current ? '#0d9488' : i === current ? '#0d9488' : '#e2e8f0',
          transition: 'all 0.25s',
        }} />
      ))}
    </div>
  );
}

function ChipGrid({
  items, selected, onToggle, searchable = false, label,
}: {
  items: string[]; selected: string[]; onToggle: (v: string) => void;
  searchable?: boolean; label?: string;
}) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const lq = q.toLowerCase();
    return items.filter(i => i.toLowerCase().includes(lq));
  }, [q, items]);

  return (
    <div>
      {label && <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>{label}</div>}
      {searchable && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 10px', marginBottom: 10 }}>
          <Search size={13} color="#94a3b8" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…"
            style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, flex: 1, color: '#334155' }} />
          {q && <button type="button" onClick={() => setQ('')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}><X size={13} color="#94a3b8" /></button>}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {filtered.map(item => {
          const on = selected.includes(item);
          return (
            <button key={item} type="button" onClick={() => onToggle(item)}
              style={{
                padding: '6px 12px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                border: `1.5px solid ${on ? '#0d9488' : '#e2e8f0'}`,
                background: on ? '#0d9488' : '#fff',
                color: on ? '#fff' : '#374151',
                fontWeight: on ? 600 : 400,
                display: 'flex', alignItems: 'center', gap: 5,
                transition: 'all 0.15s',
              }}>
              {on && <Check size={11} />}
              {item}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ fontSize: 12, color: '#94a3b8', padding: '4px 0' }}>No matches — type to add custom</div>
        )}
      </div>
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────

interface Props {
  onComplete: () => void;
  onSkip: () => void;
}

export default function EncounterStartWizard({ onComplete, onSkip }: Props) {
  const ctx = useAppContext();
  const STEPS = 4;
  const [step, setStep] = useState(0);

  // Step 0 — CC
  const [ccSelected, setCcSelected] = useState<string[]>([]);
  const [ccText, setCcText] = useState('');

  // Step 1 — PMH
  const [noPmh, setNoPmh] = useState<boolean | null>(null);
  const [pmhSelected, setPmhSelected] = useState<string[]>([]);
  const [pmhOther, setPmhOther] = useState('');

  // Step 2 — Surgery
  const [noSurgery, setNoSurgery] = useState<boolean | null>(null);
  const [surgSelected, setSurgSelected] = useState<string[]>([]);
  const [surgOther, setSurgOther] = useState('');

  // Step 3 — Allergies + Medications
  const [noAllergy, setNoAllergy] = useState<boolean | null>(null);
  const [allergySelected, setAllergySelected] = useState<string[]>([]);
  const [allergyOther, setAllergyOther] = useState('');
  const [noMeds, setNoMeds] = useState<boolean | null>(null);
  const [medsText, setMedsText] = useState('');

  function toggleCC(id: string) {
    setCcSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  }

  function apply() {
    // CC → HPI notes
    const ccLabels = ccSelected.map(id => CC_CHIPS.find(c => c.id === id)?.label ?? id);
    const ccLine = ccLabels.length > 0 ? ccLabels.join(', ') + (ccText.trim() ? ` — ${ccText.trim()}` : '') : ccText.trim();
    if (ccLine) ctx.setHpiNotes(ccLine);
    if (ccText.trim()) ctx.setFreeText(ccText.trim());

    // PMH → comorbidities
    if (noPmh === true) {
      ctx.setPmhNotes('No known past medical history (NKPMH)');
    } else if (noPmh === false) {
      const all = [...pmhSelected, ...(pmhOther.trim() ? pmhOther.split(',').map(s => s.trim()).filter(Boolean) : [])];
      ctx.setComorbidities(all);
    }

    // Surgery history
    if (noSurgery === true) {
      ctx.setSurgicalHistory(['No prior surgery']);
    } else if (noSurgery === false) {
      const all = [...surgSelected, ...(surgOther.trim() ? surgOther.split(',').map(s => s.trim()).filter(Boolean) : [])];
      ctx.setSurgicalHistory(all);
    }

    // Allergies
    if (noAllergy === false) {
      const all = [...allergySelected, ...(allergyOther.trim() ? [allergyOther.trim()] : [])];
      ctx.setAllergies(all.join(', '));
    } else if (noAllergy === true) {
      ctx.setAllergies('NKDA');
    }

    // Medications
    if (noMeds === false && medsText.trim()) {
      const meds = medsText.split('\n').map(s => s.trim()).filter(Boolean);
      ctx.setMedications(meds);
    } else if (noMeds === true) {
      ctx.setMedications(['None']);
    }

    onComplete();
  }

  const canAdvanceStep0 = ccSelected.length > 0 || ccText.trim().length > 2;
  const canAdvanceStep1 = noPmh !== null;
  const canAdvanceStep2 = noSurgery !== null;
  const canAdvanceStep3 = noAllergy !== null && noMeds !== null;

  const s: React.CSSProperties = {
    background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '28px 28px 24px',
    maxWidth: 620, margin: '0 auto',
  };

  const btnPrimary: React.CSSProperties = {
    padding: '11px 28px', borderRadius: 10, border: 'none',
    background: '#0d9488', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 8,
  };

  const btnSkip: React.CSSProperties = {
    padding: '10px 16px', borderRadius: 8, border: 'none',
    background: 'transparent', color: '#94a3b8', fontSize: 13, cursor: 'pointer',
  };

  function YNToggle({ value, onChange, yLabel = 'Yes', nLabel = 'No' }: {
    value: boolean | null; onChange: (v: boolean) => void; yLabel?: string; nLabel?: string;
  }) {
    return (
      <div style={{ display: 'flex', gap: 8 }}>
        {[{ val: true, lbl: yLabel }, { val: false, lbl: nLabel }].map(({ val, lbl }) => (
          <button key={String(val)} type="button" onClick={() => onChange(val)}
            style={{
              padding: '8px 22px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
              border: `2px solid ${value === val ? (val ? '#0d9488' : '#374151') : '#e2e8f0'}`,
              background: value === val ? (val ? '#0d9488' : '#1e293b') : '#fff',
              color: value === val ? '#fff' : '#374151',
              transition: 'all 0.15s',
            }}>
            {lbl}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 16px' }}>
      <div style={s}>
        <ProgressDots total={STEPS} current={step} />

        {/* ── Patient banner ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#f8fafc', borderRadius: 10, padding: '10px 14px', marginBottom: 24, border: '1px solid #e2e8f0' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Stethoscope size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{ctx.patientName || '—'}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              {[ctx.age ? `${ctx.age} yrs` : null, ctx.sex !== 'unknown' ? ctx.sex : null].filter(Boolean).join(' · ')}
              {ctx.mrNumber ? ` · ${ctx.mrNumber}` : ''}
            </div>
          </div>
          <button type="button" onClick={onSkip} style={{ ...btnSkip, marginLeft: 'auto' }}>Skip wizard</button>
        </div>

        {/* ── STEP 0: Chief Complaint ── */}
        {step === 0 && (
          <>
            <div style={{ fontSize: 19, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>What brings them in today?</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>Select all that apply — this pre-fills the HPI</div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {CC_CHIPS.map(c => {
                const on = ccSelected.includes(c.id);
                return (
                  <button key={c.id} type="button" onClick={() => toggleCC(c.id)}
                    style={{
                      padding: '7px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                      border: `1.5px solid ${on ? '#0d9488' : '#e2e8f0'}`,
                      background: on ? '#0d9488' : '#fff',
                      color: on ? '#fff' : '#374151',
                      fontWeight: on ? 700 : 400,
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                    {on && <Check size={11} />}{c.label}
                  </button>
                );
              })}
            </div>

            <textarea
              value={ccText}
              onChange={e => setCcText(e.target.value)}
              placeholder={"In the patient’s own words: “I have a lump in my groin that appeared 3 months ago…”"}
              rows={3}
              style={{ width: '100%', borderRadius: 8, border: '1px solid #e2e8f0', padding: '10px 12px', fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'inherit', color: '#374151' }}
            />
          </>
        )}

        {/* ── STEP 1: Medical History ── */}
        {step === 1 && (
          <>
            <div style={{ fontSize: 19, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Significant medical history?</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>Any known medical conditions?</div>

            <YNToggle value={noPmh} onChange={setNoPmh} yLabel="No known conditions" nLabel="Yes, has conditions" />

            {noPmh === false && (
              <div style={{ marginTop: 18 }}>
                <ChipGrid items={PMH_CONDITIONS} selected={pmhSelected}
                  onToggle={v => setPmhSelected(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])}
                  searchable label="Select all that apply" />
                <textarea value={pmhOther} onChange={e => setPmhOther(e.target.value)}
                  placeholder="Additional conditions (comma-separated)…"
                  rows={2}
                  style={{ marginTop: 12, width: '100%', borderRadius: 8, border: '1px solid #e2e8f0', padding: '8px 12px', fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit', color: '#374151' }} />
              </div>
            )}
          </>
        )}

        {/* ── STEP 2: Surgical History ── */}
        {step === 2 && (
          <>
            <div style={{ fontSize: 19, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Prior surgery?</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>Any previous operations or procedures?</div>

            <YNToggle value={noSurgery} onChange={setNoSurgery} yLabel="No prior surgery" nLabel="Yes, had surgery" />

            {noSurgery === false && (
              <div style={{ marginTop: 18 }}>
                <ChipGrid items={SURGERY_LIST} selected={surgSelected}
                  onToggle={v => setSurgSelected(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])}
                  searchable label="Select all that apply" />
                <textarea value={surgOther} onChange={e => setSurgOther(e.target.value)}
                  placeholder="Other procedures (comma-separated)…"
                  rows={2}
                  style={{ marginTop: 12, width: '100%', borderRadius: 8, border: '1px solid #e2e8f0', padding: '8px 12px', fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit', color: '#374151' }} />
              </div>
            )}
          </>
        )}

        {/* ── STEP 3: Allergies + Medications ── */}
        {step === 3 && (
          <>
            <div style={{ fontSize: 19, fontWeight: 700, color: '#0f172a', marginBottom: 18 }}>Allergies &amp; current medications</div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 10 }}>Drug allergies or adverse reactions?</div>
              <YNToggle value={noAllergy} onChange={setNoAllergy} yLabel="None — NKDA" nLabel="Yes, has allergies" />
              {noAllergy === false && (
                <div style={{ marginTop: 14 }}>
                  <ChipGrid items={ALLERGENS} selected={allergySelected}
                    onToggle={v => setAllergySelected(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])}
                    searchable />
                  <input value={allergyOther} onChange={e => setAllergyOther(e.target.value)}
                    placeholder="Other allergen / reaction details…"
                    style={{ marginTop: 10, width: '100%', borderRadius: 8, border: '1px solid #e2e8f0', padding: '8px 12px', fontSize: 13, outline: 'none', fontFamily: 'inherit', color: '#374151' }} />
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 10 }}>Current regular medications?</div>
              <YNToggle value={noMeds} onChange={setNoMeds} yLabel="None" nLabel="Yes, on medications" />
              {noMeds === false && (
                <textarea value={medsText} onChange={e => setMedsText(e.target.value)}
                  placeholder={'One medication per line:\nAmlodipine 5 mg OD\nMetformin 500 mg BD\nAtorvastatin 20 mg ON'}
                  rows={5}
                  style={{ marginTop: 14, width: '100%', borderRadius: 8, border: '1px solid #e2e8f0', padding: '10px 12px', fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'inherit', color: '#374151' }} />
              )}
            </div>
          </>
        )}

        {/* ── Navigation ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
          <button type="button" onClick={() => step > 0 ? setStep(s => s - 1) : onSkip()}
            style={{ padding: '10px 18px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            {step === 0 ? 'Skip' : '← Back'}
          </button>

          {step < STEPS - 1 ? (
            <button type="button" onClick={() => setStep(s => s + 1)}
              disabled={
                (step === 0 && !canAdvanceStep0) ||
                (step === 1 && !canAdvanceStep1) ||
                (step === 2 && !canAdvanceStep2)
              }
              style={{
                ...btnPrimary,
                opacity: (
                  (step === 0 && !canAdvanceStep0) ||
                  (step === 1 && !canAdvanceStep1) ||
                  (step === 2 && !canAdvanceStep2)
                ) ? 0.45 : 1,
              }}>
              Continue <ChevronRight size={16} />
            </button>
          ) : (
            <button type="button" onClick={apply} disabled={!canAdvanceStep3}
              style={{ ...btnPrimary, opacity: canAdvanceStep3 ? 1 : 0.45 }}>
              Begin Encounter <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
