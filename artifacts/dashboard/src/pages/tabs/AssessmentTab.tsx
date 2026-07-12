import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import PaneDifferential from '@/components/PaneDifferential';
import { ManagementPanel } from '@/components/ManagementPanel';
import SmartTextarea from '@/components/SmartTextarea';
import { ICD_CODES, type IcdCode } from '@/data/icd-db';
import { getCdsSuggestions } from '@/lib/clinical-cds';
import { useSpeechInput } from '@/hooks/useSpeechInput';
import ClinicalAlgorithmPanel from '@/components/ClinicalAlgorithmPanel';
import NarrativeInput from '@/components/NarrativeInput';

// ── Differential prompts with common signs ────────────────────────────────────

type DiffOption = { name: string; signs: string[] };

const DIFFERENTIAL_PROMPTS: Record<string, DiffOption[]> = {
  // ── Cardiac ───────────────────────────────────────────────────────────────
  ercp_workup: [
    { name: 'Choledocholithiasis',            signs: ['RUQ pain', 'jaundice', 'fever', "Murphy's sign"] },
    { name: 'Cholangiocarcinoma',             signs: ['jaundice', 'weight loss', 'pruritis', 'dark urine'] },
    { name: 'Pancreatic head carcinoma',      signs: ['painless jaundice', 'weight loss', "Courvoisier's sign"] },
    { name: 'Primary sclerosing cholangitis', signs: ['jaundice', 'pruritis', 'fatigue', 'IBD'] },
    { name: 'Acute cholangitis',              signs: ["Charcot's triad", 'fever', 'RUQ pain', 'jaundice'] },
    { name: 'Acute hepatitis',                signs: ['jaundice', 'RUQ pain', 'nausea', 'fatigue'] },
    { name: 'Mirizzi syndrome',               signs: ['jaundice', 'RUQ pain', 'large gallstone', 'extrinsic CBD compression'] },
    { name: 'Biliary stricture (benign)',      signs: ['post-op', 'jaundice', 'cholangitis', 'no mass'] },
  ],
  breast: [
    { name: 'Fibroadenoma',                  signs: ['smooth', 'mobile', 'rubbery', 'young female'] },
    { name: 'Fibrocystic change',            signs: ['cyclical pain', 'bilateral', 'nodularity', 'premenstrual'] },
    { name: 'Breast carcinoma',              signs: ['hard', 'irregular', 'fixed', 'skin change', 'lymph nodes'] },
    { name: 'Phyllodes tumour',              signs: ['large', 'rapid growth', 'smooth', 'older female'] },
    { name: 'Mastitis / abscess',            signs: ['erythema', 'hot', 'tender', 'fever', 'lactating'] },
    { name: 'Fat necrosis',                  signs: ['post-trauma', 'firm', 'skin dimpling', 'irregular'] },
    { name: 'Ductal carcinoma in situ',      signs: ['nipple discharge', 'microcalcification', 'mammographic'] },
    { name: 'Duct ectasia',                  signs: ['green/brown nipple discharge', 'periareolar', 'older female'] },
    { name: 'Gynaecomastia',                 signs: ['male', 'subareolar', 'bilateral', 'drug history'] },
  ],
  post_op: [
    { name: 'Surgical site infection',       signs: ['erythema', 'warmth', 'discharge', 'fever', 'pain'] },
    { name: 'Wound dehiscence',              signs: ['wound opening', 'serosanguinous', 'post-exertion'] },
    { name: 'Intra-abdominal collection',    signs: ['fever', 'ileus', 'abdominal pain', 'leucocytosis'] },
    { name: 'Anastomotic leak',              signs: ['fever', 'peritonitis', 'tachycardia', 'feculent drain'] },
    { name: 'Pulmonary embolism',            signs: ['dyspnoea', 'tachycardia', 'pleuritic pain', 'leg swelling'] },
    { name: 'Deep vein thrombosis',          signs: ['leg swelling', 'calf tenderness', 'warmth', 'erythema'] },
    { name: 'Ileus / obstruction',           signs: ['distension', 'no flatus', 'vomiting', 'absent bowel sounds'] },
    { name: 'Urinary tract infection',       signs: ['dysuria', 'frequency', 'fever', 'post-catheter'] },
    { name: 'Haematoma',                     signs: ['expanding swelling', 'bruising', 'post-op', 'tense'] },
    { name: 'Retained foreign body',         signs: ['persistent pain', 'fever', 'wound sinus', 'imaging'] },
  ],
  diabetic_foot: [
    { name: 'Diabetic foot ulcer (neuropathic)', signs: ['neuropathy', 'pressure area', 'painless', 'callous'] },
    { name: 'Necrotising fasciitis',         signs: ['crepitus', 'rapid spread', 'systemic sepsis', 'disproportionate pain'] },
    { name: 'Osteomyelitis',                 signs: ['bone exposure', 'probes to bone', 'chronic', 'non-healing'] },
    { name: 'Peripheral arterial disease',   signs: ['absent pulses', 'claudication', 'rest pain', 'ABPI <0.9'] },
    { name: 'Cellulitis',                    signs: ['erythema', 'warmth', 'spreading border', 'no fluctuance'] },
    { name: 'Abscess',                       signs: ['fluctuance', 'localised', 'pus', 'tender'] },
    { name: 'Charcot neuroarthropathy',      signs: ['hot swollen foot', 'neuropathy', 'no infection markers', 'X-ray changes'] },
    { name: 'Acute limb ischaemia',          signs: ['6 Ps', 'sudden onset', 'pulselessness', 'pallor', 'paralysis'] },
  ],

  // ── General new consultation — all specialties ─────────────────────────────
  new_consult: [
    // Cardiovascular
    { name: 'Acute coronary syndrome (STEMI/NSTEMI)', signs: ['chest pain', 'radiation to arm/jaw', 'diaphoresis', 'ECG changes', 'troponin rise'] },
    { name: 'Aortic dissection',             signs: ['tearing back pain', 'BP differential', 'pulse deficit', 'wide mediastinum'] },
    { name: 'Pericarditis',                  signs: ['pleuritic chest pain', 'positional relief leaning forward', 'friction rub', 'saddle ST elevation'] },
    { name: 'Heart failure / pulmonary oedema', signs: ['dyspnoea', 'orthopnoea', 'oedema', 'elevated JVP', 'crepitations'] },
    { name: 'Arrhythmia (AF / SVT / VT)',    signs: ['palpitations', 'irregular pulse', 'syncope', 'ECG abnormality'] },
    { name: 'Infective endocarditis',        signs: ['fever', 'new murmur', 'emboli', 'Osler nodes', 'Janeway lesions', 'positive cultures'] },
    // Respiratory
    { name: 'Pulmonary embolism',            signs: ['sudden dyspnoea', 'pleuritic pain', 'tachycardia', 'hypoxia', 'risk factors'] },
    { name: 'Pneumothorax',                  signs: ['sudden pleuritic pain', 'reduced air entry', 'hyper-resonance', 'tracheal deviation'] },
    { name: 'Community-acquired pneumonia',  signs: ['productive cough', 'fever', 'dyspnoea', 'dullness', 'consolidation'] },
    { name: 'COPD exacerbation',             signs: ['known COPD', 'increased dyspnoea', 'purulent sputum', 'air trapping'] },
    { name: 'Acute asthma',                  signs: ['wheeze', 'dyspnoea', 'history of asthma', 'reduced PEFR', 'accessory muscles'] },
    { name: 'Pleural effusion',              signs: ['dullness to percussion', 'reduced breath sounds', 'stony dull', 'mediastinal shift'] },
    { name: 'Pulmonary TB',                  signs: ['chronic cough', 'haemoptysis', 'weight loss', 'night sweats', 'upper lobe changes'] },
    { name: 'Lung carcinoma',                signs: ['chronic cough', 'haemoptysis', 'weight loss', 'clubbing', 'hilar mass'] },
    // GI / Surgical
    { name: 'Acute appendicitis',            signs: ['RIF pain', "Rovsing's sign", 'rebound tenderness', 'fever', 'pain migration from umbilicus'] },
    { name: 'Acute cholecystitis',           signs: ["Murphy's sign", 'RUQ pain', 'fever', 'post-fatty meal', 'raised WBC'] },
    { name: 'Choledocholithiasis / cholangitis', signs: ["Charcot's triad", 'fever', 'RUQ pain', 'jaundice', 'dark urine'] },
    { name: 'Acute pancreatitis',            signs: ['epigastric pain radiating to back', 'vomiting', 'elevated amylase/lipase', 'alcohol or gallstones'] },
    { name: 'Bowel obstruction',             signs: ['colicky pain', 'distension', 'vomiting', 'no flatus', 'tinkling bowel sounds'] },
    { name: 'Hollow viscus perforation',     signs: ['sudden severe abdominal pain', 'peritonism', 'free air on X-ray', 'shocked'] },
    { name: 'GI haemorrhage (upper)',        signs: ['haematemesis', 'melaena', 'postural hypotension', 'coffee ground vomiting'] },
    { name: 'GI haemorrhage (lower)',        signs: ['fresh rectal bleeding', 'altered bowel habit', 'anaemia', 'weight loss'] },
    { name: 'Acute diverticulitis',          signs: ['LIF pain', 'fever', 'altered bowel habit', 'elderly', 'localised tenderness'] },
    { name: 'Peptic ulcer disease',          signs: ['epigastric pain', 'antacid relief', 'H. pylori history', 'NSAID use'] },
    { name: 'GORD / oesophagitis',           signs: ['heartburn', 'regurgitation', 'waterbrash', 'worse lying flat'] },
    { name: 'IBD (Crohn\'s / UC)',           signs: ['diarrhoea', 'blood PR', 'cramping', 'weight loss', 'extra-intestinal manifestations'] },
    { name: 'Colorectal carcinoma',          signs: ['change in bowel habit', 'rectal bleeding', 'weight loss', 'anaemia', 'mass PR'] },
    { name: 'Ischaemic colitis',             signs: ['post-prandial pain', 'bloody diarrhoea', 'atherosclerosis', 'elderly'] },
    { name: 'Mesenteric ischaemia',          signs: ['severe abdominal pain out of proportion', 'AF', 'raised lactate', 'peritonism late'] },
    { name: 'Hernias (complicated)',         signs: ['groin / umbilical lump', 'irreducible', 'tender', 'vomiting', 'obstruction'] },
    // Hepatobiliary
    { name: 'Hepatitis (viral / toxic)',     signs: ['jaundice', 'RUQ pain', 'fatigue', 'nausea', 'raised transaminases'] },
    { name: 'Liver cirrhosis / decompensation', signs: ['ascites', 'jaundice', 'encephalopathy', 'spider naevi', 'alcohol history'] },
    { name: 'Hepatocellular carcinoma',      signs: ['weight loss', 'RUQ mass', 'cirrhosis background', 'elevated AFP'] },
    // Genitourinary
    { name: 'Renal colic (ureterolithiasis)', signs: ['loin-to-groin pain', 'haematuria', 'restlessness', 'nausea', 'colicky'] },
    { name: 'UTI / cystitis',               signs: ['dysuria', 'frequency', 'urgency', 'suprapubic pain', 'cloudy urine'] },
    { name: 'Pyelonephritis',               signs: ['loin pain', 'fever', 'dysuria', 'CVA tenderness', 'positive MSU'] },
    { name: 'Acute kidney injury',          signs: ['oliguria', 'uraemia', 'fluid overload', 'electrolyte disturbance', 'raised creatinine'] },
    { name: 'Ectopic pregnancy',            signs: ['lower abdominal pain', 'amenorrhoea', 'PV bleeding', 'shoulder tip pain', '+ve βhCG'] },
    { name: 'Ovarian torsion',              signs: ['sudden severe pelvic pain', 'nausea', 'vomiting', 'adnexal mass', 'absent Doppler flow'] },
    { name: 'PID',                          signs: ['lower abdominal pain', 'vaginal discharge', 'cervical excitation', 'fever', 'young female'] },
    { name: 'Urinary retention',            signs: ['inability to void', 'suprapubic distension', 'enlarged prostate', 'pain'] },
    { name: 'Testicular torsion',           signs: ['sudden scrotal pain', 'high-riding testis', 'absent cremasteric reflex', 'nausea'] },
    { name: 'Epididymo-orchitis',           signs: ['scrotal pain', 'gradual onset', 'swelling', 'cremasteric reflex intact', 'STI risk'] },
    // Neurological
    { name: 'Stroke / TIA',                 signs: ['sudden focal neuro deficit', 'face / arm / leg weakness', 'speech disturbance', 'visual loss'] },
    { name: 'Subarachnoid haemorrhage',     signs: ['thunderclap headache', 'worst ever headache', 'meningism', 'loss of consciousness'] },
    { name: 'Bacterial meningitis',         signs: ['headache', 'fever', 'neck stiffness', 'photophobia', 'non-blanching rash'] },
    { name: 'Encephalitis',                 signs: ['confusion', 'fever', 'focal deficit', 'seizure', 'CSF pleocytosis'] },
    { name: 'Raised intracranial pressure', signs: ['headache', 'vomiting', 'papilloedema', "Cushing's triad", 'declining GCS'] },
    { name: 'Seizure / epilepsy',           signs: ['loss of consciousness', 'tonic-clonic activity', 'post-ictal', 'incontinence'] },
    { name: 'Syncope',                      signs: ['transient LOC', 'prodrome', 'postural trigger', 'rapid recovery', 'normal ECG'] },
    { name: 'Vertigo (BPPV / Ménière\'s)', signs: ['episodic dizziness', 'positional', 'nystagmus', 'tinnitus', 'hearing loss'] },
    { name: 'Guillain-Barré syndrome',      signs: ['ascending weakness', 'areflexia', 'post-infection', 'autonomic instability'] },
    // Endocrine / Metabolic
    { name: 'Diabetic ketoacidosis (DKA)',  signs: ['polyuria', 'polydipsia', 'vomiting', 'Kussmaul breathing', 'glucose >11', 'ketones'] },
    { name: 'Hyperosmolar hyperglycaemic state', signs: ['severe hyperglycaemia', 'dehydration', 'altered GCS', 'no significant ketones'] },
    { name: 'Hypoglycaemia',                signs: ['diaphoresis', 'tremor', 'confusion', 'glucose <4 mmol/L', 'rapid recovery with glucose'] },
    { name: 'Thyroid storm',                signs: ['hyperthyroidism history', 'fever', 'tachycardia', 'AF', 'precipitant event'] },
    { name: 'Adrenal crisis (Addisonian)',  signs: ['hypotension', 'hyponatraemia', 'hyperkalaemia', 'steroid withdrawal', 'hyperpigmentation'] },
    { name: 'Hypercalcaemia',               signs: ['bones stones groans moans', 'malignancy', 'hyperparathyroidism', 'polyuria', 'confusion'] },
    { name: 'Hypothyroidism (myxoedema)',   signs: ['bradycardia', 'cold intolerance', 'weight gain', 'constipation', 'dry skin', 'goitre'] },
    // Haematological / Oncological
    { name: 'Sepsis / septic shock',        signs: ['fever or hypothermia', 'tachycardia', 'tachypnoea', 'altered GCS', 'source of infection'] },
    { name: 'Anaemia (various causes)',     signs: ['fatigue', 'pallor', 'dyspnoea on exertion', 'tachycardia', 'low Hb'] },
    { name: 'Sickle cell crisis',           signs: ['known SCD', 'bone pain crisis', 'fever', 'precipitant', 'acute chest syndrome'] },
    { name: 'Leukaemia / lymphoma',         signs: ['weight loss', 'night sweats', 'lymphadenopathy', 'splenomegaly', 'fatigue'] },
    // Infectious / Tropical
    { name: 'Malaria',                      signs: ['fever with rigors', 'tropical travel', 'splenomegaly', 'anaemia', 'thrombocytopenia'] },
    { name: 'Dengue fever',                 signs: ['high fever', 'rash', 'arthralgia', 'retro-orbital pain', 'thrombocytopenia', 'Caribbean'] },
    { name: 'Leptospirosis',                signs: ['fever', 'myalgia', 'conjunctival suffusion', 'jaundice', 'AKI', 'animal exposure'] },
    { name: 'COVID-19 / viral pneumonitis', signs: ['dyspnoea', 'fever', 'cough', 'hypoxia', 'bilateral infiltrates'] },
    // Musculoskeletal / Vascular
    { name: 'Deep vein thrombosis',         signs: ['leg swelling', 'calf tenderness', 'warmth', 'erythema', 'risk factors'] },
    { name: 'Cellulitis',                   signs: ['erythema', 'warmth', 'spreading border', 'fever', 'lymphangitis'] },
    { name: 'Necrotising fasciitis',        signs: ['severe pain', 'crepitus', 'rapid progression', 'systemic sepsis', 'skin necrosis'] },
    { name: 'Septic arthritis',             signs: ['hot swollen joint', 'fever', 'restricted ROM', 'elevated CRP/WBC'] },
    { name: 'Gout',                         signs: ['acute monoarthritis', 'podagra', 'tophi', 'hyperuricaemia', 'alcohol history'] },
    { name: 'Acute limb ischaemia',         signs: ['sudden pain', 'pallor', 'pulselessness', 'paraesthesia', 'paralysis', 'polar cold'] },
    { name: 'Compartment syndrome',         signs: ['pain on passive stretch', 'tense compartment', 'paraesthesia', 'trauma history'] },
    // Psychiatric / Functional
    { name: 'Panic attack',                 signs: ['chest tightness', 'dyspnoea', 'palpitations', 'fear of dying', 'normal investigations'] },
    { name: 'Anxiety / somatic disorder',   signs: ['multiple symptoms', 'normal exams', 'high health anxiety', 'life stressor'] },
    { name: 'Depression / psychosomatic',   signs: ['low mood', 'fatigue', 'medically unexplained pain', 'sleep disturbance'] },
    { name: 'Drug / alcohol intoxication',  signs: ['altered GCS', 'odour', 'miosis/mydriasis', 'tachycardia', 'history'] },
  ],
  follow_up: [
    { name: 'Disease progression / relapse',     signs: ['return of prior symptoms', 'worsening baseline', 'new findings'] },
    { name: 'Treatment side-effect',             signs: ['new symptoms post-therapy', 'medication history', 'temporal relationship'] },
    { name: 'Post-operative complication',       signs: ['fever', 'wound change', 'function decline', 'new pain'] },
    { name: 'Recurrent malignancy',              signs: ['weight loss', 'pain at prior site', 'new lymphadenopathy', 'rising tumour markers'] },
    { name: 'Inadequate treatment response',     signs: ['persistent symptoms', 'unchanged imaging', 'compliance issues'] },
    { name: 'New comorbidity',                   signs: ['new organ system involvement', 'unrelated presenting complaint'] },
    { name: 'Surveillance finding — benign',     signs: ['stable lesion', 'no change on imaging', 'asymptomatic'] },
  ],
};

// ── CDS urgency styles ────────────────────────────────────────────────────────

const URGENCY_STYLE: Record<string, { bg: string; border: string; color: string; dot: string }> = {
  urgent:   { bg: '#fff1f2', border: '#fca5a5', color: '#991b1b', dot: '#ef4444' },
  relevant: { bg: '#fffbeb', border: '#fcd34d', color: '#78350f', dot: '#f59e0b' },
  consider: { bg: '#f0fdf4', border: '#86efac', color: '#14532d', dot: '#22c55e' },
};

// ── ICD auto-suggest from assessment text ─────────────────────────────────────

function IcdAutoSuggest() {
  const { assessment, differentials, icdCodes, setIcdCodes } = useAppContext();
  const [suggestions, setSuggestions] = useState<typeof ICD_CODES>([]);
  const [shown, setShown] = useState(false);

  function suggest() {
    const text = [assessment, differentials].join(' ').toLowerCase();
    if (!text.trim()) return;
    const hits = ICD_CODES.filter(c => {
      const desc = c.description.toLowerCase();
      const words = desc.split(/\s+/).filter(w => w.length > 4);
      return words.some(w => text.includes(w));
    }).slice(0, 12);
    setSuggestions(hits);
    setShown(true);
  }

  function add(c: (typeof ICD_CODES)[0]) {
    const label = `${c.code} — ${c.description}`;
    if (!icdCodes.includes(label)) setIcdCodes([...icdCodes, label]);
  }

  return (
    <div style={{ position: 'relative' }}>
      <button type="button" onClick={() => { suggest(); }}
        title="Auto-suggest ICD codes from assessment text"
        style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 5, border: '1px solid #3b82f6', background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer' }}>
        AI code suggest
      </button>
      {shown && suggestions.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 80, marginTop: 4, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 300, maxHeight: 280, overflowY: 'auto' }}>
          <div style={{ padding: '6px 10px 4px', fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Suggested ICD codes
            <button type="button" onClick={() => setShown(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 14 }}>×</button>
          </div>
          {suggestions.map(c => {
            const label = `${c.code} — ${c.description}`;
            const added = icdCodes.includes(label);
            return (
              <button key={c.code} type="button" onClick={() => add(c)} disabled={added}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '7px 10px', border: 'none', background: added ? '#f0fdf4' : 'transparent', cursor: added ? 'default' : 'pointer', borderBottom: '1px solid #f8fafc' }}>
                <code style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', flexShrink: 0 }}>{c.code}</code>
                <span style={{ fontSize: 12, color: '#334155', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.description}</span>
                {added && <span style={{ fontSize: 10, color: '#15803d', flexShrink: 0 }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Diagnosis search + ICD picker ────────────────────────────────────────────

function splitLabel(label: string): { code: string; desc: string } {
  const idx = label.indexOf(' — ');
  return idx === -1 ? { code: label, desc: '' } : { code: label.slice(0, idx), desc: label.slice(idx + 3) };
}

function DiagnosisPicker() {
  const { icdCodes, setIcdCodes, assessment, setAssessment } = useAppContext();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered: IcdCode[] = query.trim().length < 2 ? [] :
    ICD_CODES.filter(c =>
      c.code.toLowerCase().includes(query.toLowerCase()) ||
      c.description.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 20);

  // Group filtered by category
  const grouped: Record<string, IcdCode[]> = {};
  for (const c of filtered) {
    if (!grouped[c.category]) grouped[c.category] = [];
    grouped[c.category].push(c);
  }

  function select(code: IcdCode) {
    const label = `${code.code} — ${code.description}`;
    if (!icdCodes.includes(label)) {
      setIcdCodes([...icdCodes, label]);
      if (!assessment.trim()) setAssessment(code.description);
    }
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  }

  function remove(label: string) {
    setIcdCodes(icdCodes.filter(c => c !== label));
  }

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>

      {/* ── Selected diagnoses ── */}
      {icdCodes.length > 0 && (
        <div style={{
          border: '1.5px solid #bfdbfe',
          borderRadius: 10,
          overflow: 'hidden',
          marginBottom: 12,
          boxShadow: '0 1px 4px rgba(3,105,161,.07)',
        }}>
          {icdCodes.map((label, i) => {
            const { code, desc } = splitLabel(label);
            const isPrimary = i === 0;
            return (
              <div
                key={label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  background: isPrimary ? '#eff6ff' : '#fafafa',
                  borderBottom: i < icdCodes.length - 1 ? '1px solid #e5e7eb' : 'none',
                }}
              >
                {/* Primary / Secondary badge */}
                <span style={{
                  flexShrink: 0,
                  fontSize: 9,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  padding: '3px 7px',
                  borderRadius: 4,
                  background: isPrimary ? '#1e40af' : '#e5e7eb',
                  color: isPrimary ? '#fff' : '#6b7280',
                  minWidth: 70,
                  textAlign: 'center',
                }}>
                  {isPrimary ? 'Primary Dx' : `2° Dx`}
                </span>

                {/* ICD code badge */}
                <span style={{
                  flexShrink: 0,
                  fontFamily: 'monospace',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#fff',
                  background: isPrimary ? '#0369a1' : '#4b5563',
                  padding: '3px 9px',
                  borderRadius: 5,
                  letterSpacing: '0.04em',
                }}>
                  {code}
                </span>

                {/* Description */}
                <span style={{
                  flex: 1,
                  fontSize: 14,
                  fontWeight: isPrimary ? 700 : 400,
                  color: isPrimary ? '#1e3a5f' : '#374151',
                }}>
                  {desc}
                </span>

                <button
                  type="button"
                  onClick={() => remove(label)}
                  title="Remove"
                  style={{
                    flexShrink: 0,
                    padding: '2px 8px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#9ca3af',
                    fontSize: 18,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Search input ── */}
      <div style={{ position: 'relative' }}>
        <span style={{
          position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
          fontSize: 16, color: '#9ca3af', pointerEvents: 'none',
        }}>🔍</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={e => { setOpen(true); (e.target as HTMLInputElement).style.borderColor = '#0369a1'; }}
          onBlur={e => { (e.target as HTMLInputElement).style.borderColor = '#d1d5db'; }}
          placeholder={icdCodes.length > 0
            ? 'Add another diagnosis…'
            : 'Search diagnosis by name or ICD-10 code  (e.g. "cholangitis", "C18", "appendicitis")'}
          style={{
            width: '100%',
            fontSize: 13,
            padding: '11px 14px 11px 38px',
            border: '1.5px solid #d1d5db',
            borderRadius: 8,
            background: '#fff',
            outline: 'none',
          }}
        />
      </div>

      {/* ── Dropdown ── */}
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 70,
          background: '#fff',
          border: '1px solid #e0e7ff',
          borderRadius: 10,
          boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
          maxHeight: 360,
          overflowY: 'auto',
        }}>
          {Object.entries(grouped).map(([category, codes]) => (
            <div key={category}>
              <div style={{
                padding: '5px 14px 4px',
                fontSize: 9.5,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.09em',
                color: '#0369a1',
                background: '#f0f9ff',
                borderBottom: '1px solid #e0f2fe',
              }}>
                {category}
              </div>
              {codes.map(c => {
                const label = `${c.code} — ${c.description}`;
                const added = icdCodes.includes(label);
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => select(c)}
                    disabled={added}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      width: '100%',
                      padding: '10px 14px',
                      background: added ? '#f0fdf4' : 'transparent',
                      border: 'none',
                      borderBottom: '1px solid #f3f4f6',
                      cursor: added ? 'default' : 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={e => { if (!added) (e.currentTarget as HTMLButtonElement).style.background = '#f0f9ff'; }}
                    onMouseLeave={e => { if (!added) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                  >
                    {/* Code badge */}
                    <span style={{
                      fontFamily: 'monospace',
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: '#0369a1',
                      background: '#dbeafe',
                      padding: '3px 8px',
                      borderRadius: 4,
                      minWidth: 62,
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}>
                      {c.code}
                    </span>
                    <span style={{ flex: 1, fontSize: 13.5, color: '#111827', fontWeight: 500 }}>
                      {c.description}
                    </span>
                    {added && (
                      <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700, flexShrink: 0 }}>
                        ✓ Added
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {open && query.trim().length >= 2 && filtered.length === 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 70,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
          padding: '14px 16px', fontSize: 13, color: '#6b7280', marginTop: 0,
        }}>
          No results for <strong>"{query}"</strong> — try a broader term or different spelling
        </div>
      )}
    </div>
  );
}

// ── Mic button ────────────────────────────────────────────────────────────────

function MicButton({ listening, supported, onToggle }: { listening: boolean; supported: boolean; onToggle: () => void }) {
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      title={listening ? 'Stop dictation' : 'Dictate'}
      style={{
        background: listening ? '#ef4444' : '#f9fafb',
        border: `1px solid ${listening ? '#ef4444' : '#d1d5db'}`,
        borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
        color: listening ? '#fff' : '#6b7280', fontSize: 13, lineHeight: 1,
        display: 'inline-flex', alignItems: 'center', gap: 4,
      }}
    >
      {listening ? '⏹ Stop' : '🎙 Dictate'}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AssessmentTab() {
  const {
    assessment, setAssessment,
    differentials, setDifferentials,
    triageResult,
    symptoms, examFindings, vitals, investigationResults,
    comorbidities, age, sex, isPostOp, procedureData, rosFindings,
    paneTop, paneConverged, icdCodes,
  } = useAppContext();

  const activeDiseaseId = (paneConverged && paneTop[0]?.probability >= 0.85)
    ? paneTop[0].disease.id
    : null;
  const activeIcdCode = icdCodes[0]?.split(' — ')[0]?.trim() ?? null;

  const apptType = triageResult.appointmentType;
  const ddxOptions: DiffOption[] = DIFFERENTIAL_PROMPTS[apptType] ?? DIFFERENTIAL_PROMPTS['new_consult'];

  const [requestedTool, setRequestedTool] = useState<string | null>(null);

  const requestTool = useCallback((scaleKey: string) => {
    setRequestedTool(null);
    requestAnimationFrame(() => setRequestedTool(scaleKey));
  }, []);

  const assessmentMic = useSpeechInput();
  const differentialsMic = useSpeechInput();

  const cdsSuggestions = getCdsSuggestions({
    symptoms, examFindings, vitals, investigationResults,
    comorbidities, assessment, rosFindings, age, sex, isPostOp, procedureData,
  });

  function addDiff(name: string) {
    const line = differentials.trim() ? `${differentials.trim()}\n${name}` : name;
    setDifferentials(line);
  }

  return (
    <div className="gap-y">

      {/* CDS suggestions */}
      {cdsSuggestions.length > 0 && (
        <CollapsibleCard
          title={`Clinical Decision Support — ${cdsSuggestions.length} active suggestion${cdsSuggestions.length > 1 ? 's' : ''}`}
        >
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>
            Click a row to open the scoring tool inline below.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {cdsSuggestions.map(s => {
              const style = URGENCY_STYLE[s.urgency];
              return (
                <button
                  key={s.scaleKey}
                  type="button"
                  onClick={() => requestTool(s.scaleKey)}
                  style={{
                    background: style.bg, border: `1px solid ${style.border}`,
                    borderRadius: 8, padding: '8px 12px',
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    width: '100%', textAlign: 'left', cursor: 'pointer',
                    transition: 'filter 0.1s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(0.95)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.filter = ''; }}
                >
                  <span style={{ color: style.dot, fontSize: 10, marginTop: 3, flexShrink: 0 }}>●</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: style.color }}>{s.title}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{s.triggerReason}</div>
                    {s.needsLabs && !s.labsPresent && (
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, fontStyle: 'italic' }}>
                        Add lab results in Investigations to complete this score
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                      color: style.color, background: style.border, borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap',
                    }}>
                      {s.categoryTag}
                    </span>
                    <span style={{ fontSize: 10, color: style.color, opacity: 0.7 }}>Open score ↓</span>
                  </div>
                </button>
              );
            })}
          </div>
        </CollapsibleCard>
      )}

      {/* ── PANE probabilistic differential ── */}
      <PaneDifferential
        onAddDifferential={name => {
          const line = differentials.trim() ? `${differentials.trim()}\n${name}` : name;
          setDifferentials(line);
        }}
        onExportDifferential={text => {
          const line = differentials.trim() ? `${differentials.trim()}\n\n${text}` : text;
          setDifferentials(line);
        }}
      />

      {/* ── Management Panel (auto-populated on convergence or ICD selection) ── */}
      <ManagementPanel diseaseId={activeDiseaseId} icdCode={activeIcdCode} />

      {/* ── Working Diagnosis ── */}
      <CollapsibleCard title="Working diagnosis">

        {/* Diagnosis search with ICD-10 */}
        <div style={{ marginBottom: 14 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 8,
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b7280' }}>
                Diagnosis + ICD-10 code
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                Search by name or code — first selected = primary diagnosis
              </div>
            </div>
            <IcdAutoSuggest />
          </div>
          <DiagnosisPicker />
        </div>

        {/* Narrative dictation → assessment + differentials */}
        <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12, marginBottom: 4 }}>
          <NarrativeInput
            section="assessment"
            placeholder="Dictate or paste your clinical impression and differentials — AI will extract assessment, ranked differentials, and ICD hint…"
            label="Dictate clinical assessment"
            onParsed={data => {
              const a = data.assessment as string | undefined;
              const d = data.differentials as string | undefined;
              if (a?.trim()) setAssessment(a.trim());
              if (d?.trim()) setDifferentials(d.trim());
            }}
          />
        </div>

        {/* Clinical impression / reasoning */}
        <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <label style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.06em', color: '#6b7280', margin: 0,
            }}>
              Clinical impression / reasoning
            </label>
            <MicButton
              listening={assessmentMic.listening}
              supported={assessmentMic.supported}
              onToggle={() => {
                if (assessmentMic.listening) {
                  assessmentMic.stop();
                } else {
                  assessmentMic.start(text => setAssessment(assessment ? `${assessment} ${text}` : text));
                }
              }}
            />
          </div>
          <SmartTextarea
            value={assessment}
            onChange={setAssessment}
            placeholder="Clinical impression, supporting evidence, reasoning, degree of certainty… (type .asx or .acholecystitis to expand)"
            style={{ minHeight: 90, width: '100%' }}
          />
        </div>
      </CollapsibleCard>

      {/* ── Differential Diagnoses ── */}
      <CollapsibleCard title="Differential diagnoses">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <label style={{
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.06em', color: '#6b7280', margin: 0,
          }}>
            Differentials — free text or use prompts
          </label>
          <MicButton
            listening={differentialsMic.listening}
            supported={differentialsMic.supported}
            onToggle={() => {
              if (differentialsMic.listening) {
                differentialsMic.stop();
              } else {
                differentialsMic.start(text => setDifferentials(differentials ? `${differentials}\n${text}` : text));
              }
            }}
          />
        </div>
        <textarea
          value={differentials}
          onChange={e => setDifferentials(e.target.value)}
          placeholder="1. …\n2. …\n3. …"
          style={{ minHeight: 80, width: '100%', marginBottom: 12 }}
        />

        {/* Differential chips with common signs */}
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9ca3af', marginBottom: 7 }}>
          Suggested for {apptType.replace(/_/g, ' ')}
          <span style={{ marginLeft: 6, fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#bbb' }}>
            — brackets show shared features
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {ddxOptions.map(d => (
            <button
              key={d.name}
              type="button"
              onClick={() => addDiff(d.name)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '7px 12px',
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                background: '#f9fafb',
                cursor: 'pointer',
                textAlign: 'left',
                gap: 3,
                transition: 'background .12s, border-color .12s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = '#eff6ff';
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#bfdbfe';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = '#f9fafb';
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb';
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                + {d.name}
              </span>
              <span style={{ fontSize: 10.5, color: '#6b7280', fontStyle: 'italic' }}>
                [{d.signs.join(' · ')}]
              </span>
            </button>
          ))}
        </div>
      </CollapsibleCard>

      <ClinicalAlgorithmPanel requestedTool={requestedTool} />

    </div>
  );
}
