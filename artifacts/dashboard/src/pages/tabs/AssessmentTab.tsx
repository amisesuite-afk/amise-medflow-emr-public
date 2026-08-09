import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAppContext, type ActiveDiagnosis } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import PaneDifferential from '@/components/PaneDifferential';
import { ManagementPanel } from '@/components/ManagementPanel';
import SmartTextarea from '@/components/SmartTextarea';
import { ICD_CODES, type IcdCode } from '@/data/icd-db';
import { getCdsSuggestions } from '@/lib/clinical-cds';
import { useSpeechInput } from '@/hooks/useSpeechInput';
import ClinicalAlgorithmPanel from '@/components/ClinicalAlgorithmPanel';
import NarrativeInput from '@/components/NarrativeInput';
import { getMatrix } from '@/lib/cc-matrices';
import { computeRankedDifferentials } from '@/lib/symptom-inference';
import { getProtocol } from '@workspace/pane-engine';

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
    paneTop, paneConverged, icdCodes, activeCcKey,
    confirmedDiagnoses, setConfirmedDiagnoses,
    examAbdomen, examGeneral, examCardio, examResp, examExtremities, examWound,
    hpiNotes,
    orderedInvestigations, setOrderedInvestigations,
  } = useAppContext();

  const ccMatrix = activeCcKey ? getMatrix(activeCcKey) : null;
  const ccContext = ccMatrix ? {
    ccKey: ccMatrix.id,
    ccLabel: ccMatrix.name,
    icd10Hint: ccMatrix.icd10Hint,
    ddx: ccMatrix.ddx,
    pearl: ccMatrix.pearl,
  } : null;

  const activeDiseaseId = (paneConverged && paneTop[0]?.probability >= 0.85)
    ? paneTop[0].disease.id
    : null;
  const activeIcdCode = icdCodes[0]?.split(' — ')[0]?.trim() ?? null;

  // Auto-populate ordered investigations from all plausible differentials.
  // ≥0.85 converged: single locked protocol. ≥0.10: merge top-3 to narrow Dx.
  // When the same test appears in multiple protocols the highest urgency wins.
  const invRef = useRef(orderedInvestigations);
  useEffect(() => { invRef.current = orderedInvestigations; });

  useEffect(() => {
    // No probability floor — with 136 diseases the normalized priors can be <3%.
    // Always pull from whatever the top-3 differentials are.
    const relevant = paneTop.slice(0, 3);
    if (!relevant.length) return;
    const urgencyRank: Record<string, number> = { stat: 0, urgent: 1, routine: 2 };
    const byLabel = new Map<string, { label: string; urgency: 'stat' | 'urgent' | 'routine' }>();
    for (const { disease } of relevant) {
      const protocol = getProtocol(disease.id);
      if (!protocol?.investigations.length) continue;
      for (const inv of protocol.investigations) {
        const key = inv.label.toLowerCase().trim();
        const cur = byLabel.get(key);
        if (!cur || (urgencyRank[inv.urgency] ?? 2) < (urgencyRank[cur.urgency] ?? 2)) {
          byLabel.set(key, inv);
        }
      }
    }
    const sorted = [...byLabel.values()].sort(
      (a, b) => (urgencyRank[a.urgency] ?? 2) - (urgencyRank[b.urgency] ?? 2),
    );
    const current = invRef.current;
    const existing = new Set(current.map((s: string) => s.toLowerCase().trim()));
    const toAdd = sorted.map(inv => inv.label).filter(l => !existing.has(l.toLowerCase().trim()));
    if (toAdd.length) setOrderedInvestigations([...toAdd, ...current]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paneTop.map(r => `${r.disease.id}:${r.probability.toFixed(2)}`).join(',')]);

  const apptType = triageResult.appointmentType;
  const ddxOptions: DiffOption[] = DIFFERENTIAL_PROMPTS[apptType] ?? DIFFERENTIAL_PROMPTS['new_consult'];

  const [requestedTool, setRequestedTool] = useState<string | null>(null);
  const [showAllDdx, setShowAllDdx] = useState(false);

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

  // Combined clinical text used to check if a diagnosis still has supporting evidence
  const clinicalText = useMemo(() => [
    ...symptoms,
    examAbdomen, examGeneral, examCardio, examResp, examExtremities, examWound,
    hpiNotes, assessment,
    ...Object.values(examFindings).flat(),
  ].join(' ').toLowerCase(), [
    symptoms, examAbdomen, examGeneral, examCardio, examResp, examExtremities, examWound,
    hpiNotes, assessment, examFindings,
  ]);

  // Passive inference: rank diseases from current exam + symptoms (no Q&A required)
  const passiveRanked = useMemo(() => computeRankedDifferentials({
    symptoms,
    symptomDetails: {},
    examText: [examAbdomen, examGeneral, examCardio, examResp, examExtremities, examWound, hpiNotes].join(' '),
  }), [symptoms, examAbdomen, examGeneral, examCardio, examResp, examExtremities, examWound, hpiNotes]);

  // Build a name→rank map for sorting the differential card grid
  const passiveRankMap = useMemo(() => {
    const map = new Map<string, number>();
    passiveRanked.forEach((r, i) => map.set(r.name.toLowerCase(), i));
    return map;
  }, [passiveRanked]);

  // Top result and whether a pathognomonic sign is matched
  const topPassive = passiveRanked[0];
  const topConfidence = (symptoms.length > 0 || examAbdomen || examGeneral) ? (topPassive?.confidence ?? 0) : 0;
  const pathognomicAlert = passiveRanked.find(r => r.pathognomicMatchSign);

  // Focus mode drives progressive narrowing
  const focusMode: 'broad' | 'narrowing' | 'focused' =
    pathognomicAlert || topConfidence >= 65 ? 'focused' :
    topConfidence >= 35 ? 'narrowing' : 'broad';

  // Sort the differential card grid so highest-ranked diseases float to top
  const sortedDdxOptions = useMemo(() => [...ddxOptions].sort((a, b) => {
    const getRank = (name: string) => {
      const lower = name.toLowerCase();
      // Direct name match
      let rank = passiveRankMap.get(lower);
      if (rank !== undefined) return rank;
      // Fuzzy: find the ranked entry whose name overlaps most
      for (const [rname, ridx] of passiveRankMap) {
        if (rname.includes(lower) || lower.includes(rname.split(' ').slice(0, 2).join(' '))) return ridx;
      }
      return 999;
    };
    return getRank(a.name) - getRank(b.name);
  }), [ddxOptions, passiveRankMap]);

  function isDxSupported(dx: ActiveDiagnosis): boolean {
    return dx.signs.some(s => clinicalText.includes(s.toLowerCase()));
  }

  function matchedSigns(dx: ActiveDiagnosis): string[] {
    return dx.signs.filter(s => clinicalText.includes(s.toLowerCase()));
  }

  function confirmDiagnosis(d: DiffOption) {
    if (!confirmedDiagnoses.some(c => c.name === d.name)) {
      setConfirmedDiagnoses([...confirmedDiagnoses, {
        id: `${Date.now()}-${d.name}`,
        name: d.name,
        signs: d.signs,
      }]);
    }
    addDiff(d.name);
  }

  function removeDiagnosis(id: string) {
    setConfirmedDiagnoses(confirmedDiagnoses.filter(c => c.id !== id));
  }

  return (
    <div className="gap-y">

      {/* ── Active Diagnoses ─────────────────────────────────────────────────── */}
      {confirmedDiagnoses.length > 0 && (
        <div style={{
          borderRadius: 10, border: '1px solid rgba(99,102,241,0.25)',
          background: 'rgba(99,102,241,0.04)', padding: '10px 14px',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: '#818cf8', marginBottom: 8,
          }}>
            Active Diagnoses
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {confirmedDiagnoses.map(dx => {
              const supported = isDxSupported(dx);
              const hits = matchedSigns(dx);
              return (
                <div key={dx.id} style={{
                  borderRadius: 8,
                  border: `1px solid ${supported ? 'rgba(52,211,153,0.35)' : 'rgba(251,191,36,0.35)'}`,
                  background: supported ? 'rgba(52,211,153,0.05)' : 'rgba(251,191,36,0.05)',
                  padding: '8px 12px',
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                }}>
                  <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>
                    {supported ? '✓' : '⚠'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: supported ? 'var(--ink)' : '#d97706' }}>
                      {dx.name}
                    </div>
                    <div style={{ fontSize: 10, marginTop: 2, color: supported ? '#34d399' : '#f59e0b' }}>
                      {supported
                        ? `Supported · ${hits.join(' · ')}`
                        : 'Unsupported — findings that drove this diagnosis have been removed or not yet documented'}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 5 }}>
                      {dx.signs.map(sign => {
                        const active = clinicalText.includes(sign.toLowerCase());
                        return (
                          <span key={sign} style={{
                            fontSize: 10, padding: '2px 7px', borderRadius: 10,
                            background: active ? 'rgba(52,211,153,0.15)' : 'rgba(156,163,175,0.12)',
                            color: active ? '#34d399' : '#9ca3af',
                            border: `1px solid ${active ? 'rgba(52,211,153,0.3)' : 'rgba(156,163,175,0.25)'}`,
                            fontWeight: active ? 700 : 400,
                          }}>
                            {sign}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <button type="button"
                    onClick={() => removeDiagnosis(dx.id)}
                    title="Remove diagnosis"
                    style={{
                      border: 'none', background: 'none', cursor: 'pointer',
                      color: '#9ca3af', fontSize: 16, padding: '0 4px', flexShrink: 0,
                      lineHeight: 1,
                    }}>
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
            ccContext={ccContext}
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

        {/* Pathognomonic alert banner */}
        {pathognomicAlert && (
          <div style={{
            padding: '8px 12px', borderRadius: 8,
            background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.4)',
            marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 16 }}>🎯</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#34d399' }}>
                Pathognomonic sign detected
              </div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>
                <strong>{pathognomicAlert.pathognomicMatchSign}</strong> → {pathognomicAlert.name}
              </div>
            </div>
          </div>
        )}
        {focusMode !== 'broad' && !pathognomicAlert && topPassive && (
          <div style={{
            padding: '6px 12px', borderRadius: 8,
            background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)',
            marginBottom: 8, fontSize: 11, color: '#818cf8',
          }}>
            🔍 Narrowing — <strong>{topPassive.name}</strong> leading ({topConfidence}%)
            {focusMode === 'focused' && ' · Less likely diagnoses dimmed'}
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {(focusMode === 'focused' && !showAllDdx ? sortedDdxOptions.slice(0, 8) : sortedDdxOptions).map((d, sortIdx) => {
            const confirmed = confirmedDiagnoses.some(c => c.name === d.name);
            const dxRank = passiveRankMap.get(d.name.toLowerCase()) ??
              [...passiveRankMap.entries()].find(([k]) => k.includes(d.name.toLowerCase().split(' ').slice(0,2).join(' ')))?.[1];
            const dxConfidence = dxRank !== undefined ? (passiveRanked[dxRank]?.confidence ?? 0) : 0;
            const isLeading = focusMode !== 'broad' && sortIdx === 0 && dxConfidence > 0;
            const isPathognomonic = passiveRanked[dxRank ?? 999]?.pathognomicMatchSign != null;
            const isDimmed = focusMode === 'focused' && sortIdx > 2 && !confirmed;
            return (
              <button
                key={d.name}
                type="button"
                onClick={() => confirmDiagnosis(d)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  padding: '7px 12px',
                  borderRadius: 8,
                  border: isPathognomonic ? '1px solid rgba(52,211,153,0.6)' :
                          isLeading ? '1px solid rgba(99,102,241,0.5)' :
                          confirmed ? '1px solid rgba(52,211,153,0.4)' : '1px solid #e5e7eb',
                  background: isPathognomonic ? 'rgba(52,211,153,0.08)' :
                              isLeading ? 'rgba(99,102,241,0.06)' :
                              confirmed ? 'rgba(52,211,153,0.06)' : '#f9fafb',
                  opacity: isDimmed ? 0.45 : 1,
                  order: isDimmed ? 1 : 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                  gap: 3,
                  transition: 'background .12s, border-color .12s',
                }}
                onMouseEnter={e => {
                  if (!confirmed) {
                    (e.currentTarget as HTMLButtonElement).style.background = '#eff6ff';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#bfdbfe';
                  }
                }}
                onMouseLeave={e => {
                  if (!confirmed) {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      isPathognomonic ? 'rgba(52,211,153,0.08)' :
                      isLeading ? 'rgba(99,102,241,0.06)' : '#f9fafb';
                    (e.currentTarget as HTMLButtonElement).style.borderColor =
                      isPathognomonic ? 'rgba(52,211,153,0.6)' :
                      isLeading ? 'rgba(99,102,241,0.5)' : '#e5e7eb';
                  }
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: confirmed ? '#34d399' : '#111827' }}>
                  {confirmed ? '✓ ' : '+ '}{d.name}
                </span>
                <span style={{ fontSize: 10.5, color: '#6b7280', fontStyle: 'italic' }}>
                  [{d.signs.join(' · ')}]
                </span>
                {dxConfidence > 5 && (
                  <span style={{ fontSize: 9, color: isPathognomonic ? '#34d399' : '#9ca3af', marginTop: 2 }}>
                    {isPathognomonic ? `🎯 ${passiveRanked[dxRank!]?.pathognomicMatchSign}` : `${dxConfidence}% match`}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {focusMode === 'focused' && (
          <button type="button" onClick={() => setShowAllDdx(s => !s)}
            style={{ fontSize: 11, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4 }}>
            {showAllDdx ? '▲ Show less' : `▼ Show all ${sortedDdxOptions.length} differentials`}
          </button>
        )}
      </CollapsibleCard>

      <ClinicalAlgorithmPanel requestedTool={requestedTool} />

    </div>
  );
}
