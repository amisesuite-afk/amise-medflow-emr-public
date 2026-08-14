import { useState, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import PatientPrepCard from '@/components/PatientPrepCard';
import { ClassifiedMed, ACTION_META, ACTION_ORDER, MED_RULES, parseDrugs, classifyMed, hasPenAllergyFlag } from '@/lib/periop-meds';
import type { PeriOpAction } from '@/lib/periop-meds';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AbxFirstChoice { agent: string; dose: string; route: string; timing: string; }
interface AbxAllergyAlt { agent: string; dose: string; route: string; }
interface AbxRec {
  firstChoice: AbxFirstChoice;
  redosing?: string;
  duration: string;
  allergyAlt: AbxAllergyAlt;
  evidence: string;
  notes?: string;
}
interface ProcedureEntry { id: string; group: string; label: string; rec: AbxRec; }

// ── Antibiotic prophylaxis data ───────────────────────────────────────────────

const PROCEDURES: ProcedureEntry[] = [
  {
    id: 'ercp_therapeutic', group: 'Endoscopy', label: 'ERCP (therapeutic / biliary obstruction)',
    rec: {
      firstChoice: { agent: 'Ciprofloxacin 400 mg IV', dose: '400 mg single dose', route: 'IV over 60 min', timing: 'At induction or 30–60 min before procedure' },
      duration: 'Single dose; extend to 5-day oral course if biliary drainage is incomplete',
      allergyAlt: { agent: 'Gentamicin 5 mg/kg IBW IV', dose: '5 mg/kg ideal body weight', route: 'IV over 30 min' },
      evidence: 'BSG Antibiotic Prophylaxis in GI Endoscopy (2021); ASGE Guidelines 2015',
      notes: 'Indications: biliary obstruction, cholangitis, PSC, liver transplant, incomplete drainage anticipated. NOT required for diagnostic ERCP with patent bile ducts. If drainage unexpectedly incomplete intra-procedure, commence ciprofloxacin immediately. Check local ciprofloxacin resistance patterns.',
    },
  },
  {
    id: 'ercp_diagnostic', group: 'Endoscopy', label: 'ERCP (diagnostic, unobstructed ducts)',
    rec: {
      firstChoice: { agent: 'No routine prophylaxis', dose: '—', route: '—', timing: '—' },
      duration: 'Not indicated',
      allergyAlt: { agent: 'Not applicable', dose: '—', route: '—' },
      evidence: 'BSG Antibiotic Prophylaxis in GI Endoscopy (2021)',
      notes: 'Routine antibiotic prophylaxis is NOT recommended for diagnostic ERCP when complete biliary drainage is expected. If incomplete drainage occurs, commence ciprofloxacin 400 mg IV immediately and continue orally.',
    },
  },
  {
    id: 'ogd', group: 'Endoscopy', label: 'OGD (diagnostic or therapeutic)',
    rec: {
      firstChoice: { agent: 'No routine prophylaxis', dose: '—', route: '—', timing: '—' },
      duration: 'Not routinely indicated',
      allergyAlt: { agent: 'Not applicable', dose: '—', route: '—' },
      evidence: 'BSG 2021; ESGE 2021',
      notes: 'Exceptions: PEG/PEJ insertion — cefazolin 1 g IV or co-amoxiclav 1.2 g IV (30–60 min before). Band ligation for oesophageal varices in cirrhosis — ciprofloxacin 400 mg IV (reduces SBP risk). Prosthetic valve + previous endocarditis: consult cardiology.',
    },
  },
  {
    id: 'colonoscopy', group: 'Endoscopy', label: 'Colonoscopy (diagnostic / polypectomy)',
    rec: {
      firstChoice: { agent: 'No routine prophylaxis', dose: '—', route: '—', timing: '—' },
      duration: 'Not routinely indicated',
      allergyAlt: { agent: 'Not applicable', dose: '—', route: '—' },
      evidence: 'BSG 2021; ESGE 2021',
      notes: 'High-quality polypectomy requires no antibiotic cover in immunocompetent patients. Consider for severely immunocompromised patients or if high-risk valvular heart disease with previous endocarditis (consult cardiology).',
    },
  },
  {
    id: 'lap_chole', group: 'Hepatobiliary', label: 'Laparoscopic cholecystectomy',
    rec: {
      firstChoice: { agent: 'Cefazolin', dose: '≤80 kg: 1 g | >80 kg: 2 g', route: 'IV slow bolus over 3–5 min', timing: '30–60 min before skin incision' },
      redosing: 'Repeat 2 g if operation >4 h or blood loss >1.5 L',
      duration: 'Single dose',
      allergyAlt: { agent: 'Clindamycin 600 mg IV + Gentamicin 3 mg/kg IBW IV', dose: 'As stated', route: 'IV (clindamycin over 20 min)' },
      evidence: 'SIGN 104 (2014); ASHP Therapeutic Guidelines 2013; WHO SSI Prevention Guidelines 2016',
      notes: 'For acute cholecystitis converted to open: treat as therapeutic antibiotics (co-amoxiclav 1.2 g IV TDS or cefuroxime + metronidazole), not prophylaxis.',
    },
  },
  {
    id: 'open_chole', group: 'Hepatobiliary', label: 'Open cholecystectomy / bile duct exploration',
    rec: {
      firstChoice: { agent: 'Cefazolin + Metronidazole', dose: 'Cefazolin ≤80 kg 1 g / >80 kg 2 g; Metronidazole 500 mg', route: 'IV', timing: '30–60 min before incision' },
      redosing: 'Cefazolin: repeat at 4 h intervals; Metronidazole: not routinely redosed',
      duration: 'Single dose; extend to 24 h only if gross contamination found',
      allergyAlt: { agent: 'Clindamycin 600 mg IV + Gentamicin 5 mg/kg IBW IV', dose: 'As stated', route: 'IV' },
      evidence: 'SIGN 104; ASHP 2013',
    },
  },
  {
    id: 'splenectomy', group: 'Hepatobiliary', label: 'Splenectomy',
    rec: {
      firstChoice: { agent: 'Cefazolin', dose: '≤80 kg: 1 g | >80 kg: 2 g', route: 'IV', timing: '30–60 min before incision' },
      duration: 'Single dose perioperative; PLUS lifelong post-splenectomy prophylaxis',
      allergyAlt: { agent: 'Clindamycin 600 mg IV', dose: '600 mg', route: 'IV over 20 min' },
      evidence: 'SIGN 104; BCSH Haematology Guidelines 2011',
      notes: '⚠ CRITICAL — post-splenectomy: (1) Update vaccinations pre-op if possible: Pneumococcal (PCV13 + PPV23), MenACWY, Hib. If emergency: vaccinate ≥14 days post-op. (2) Lifelong prophylaxis: amoxicillin 250 mg OD or phenoxymethylpenicillin 250 mg BD. (3) Provide OPSI alert card and instruct patient on fever protocol (any fever = present to ED immediately).',
    },
  },
  {
    id: 'appendicectomy', group: 'Colorectal', label: 'Appendicectomy',
    rec: {
      firstChoice: { agent: 'Co-amoxiclav 1.2 g IV', dose: '1.2 g single dose', route: 'IV over 3–4 min', timing: '30–60 min before incision' },
      duration: 'Single dose (non-perforated). Perforated / gangrenous: therapeutic 5-day course',
      allergyAlt: { agent: 'Clindamycin 600 mg IV + Gentamicin 5 mg/kg IBW IV', dose: 'As stated', route: 'IV' },
      evidence: 'SIGN 104; Cochrane Review (2012); NHS England SSI Collaborative',
      notes: 'If perforation or gangrene found intra-operatively: convert immediately to therapeutic antibiotics. Culture peritoneal fluid. Do NOT limit to prophylaxis duration.',
    },
  },
  {
    id: 'colorectal_resection', group: 'Colorectal', label: 'Colorectal resection (elective or emergency)',
    rec: {
      firstChoice: { agent: 'Cefuroxime 1.5 g IV + Metronidazole 500 mg IV', dose: 'Cef 1.5 g; Metro 500 mg', route: 'IV', timing: '30–60 min before incision' },
      redosing: 'Cefuroxime: repeat at 3–4 h intervals for prolonged operations. Metronidazole: not routinely redosed.',
      duration: 'Single dose (max 24 h for contaminated field)',
      allergyAlt: { agent: 'Clindamycin 600 mg IV + Gentamicin 5 mg/kg IBW IV', dose: 'As stated', route: 'IV' },
      evidence: 'SIGN 104; NHS England SSI Collaborative 2020; WHO SSI Prevention Guidelines 2016',
      notes: 'ERAS: oral bowel preparation (polyethylene glycol) combined with oral antibiotics (neomycin + metronidazole) the evening before further reduces SSI — discuss with anaesthetic / ERAS team.',
    },
  },
  {
    id: 'stoma_reversal', group: 'Colorectal', label: 'Stoma reversal / Hartmann\'s reversal',
    rec: {
      firstChoice: { agent: 'Cefuroxime 1.5 g IV + Metronidazole 500 mg IV', dose: 'As stated', route: 'IV', timing: '30–60 min before incision' },
      duration: 'Single dose',
      allergyAlt: { agent: 'Clindamycin 600 mg IV + Gentamicin 5 mg/kg IBW IV', dose: 'As stated', route: 'IV' },
      evidence: 'SIGN 104',
    },
  },
  {
    id: 'hernia_inguinal', group: 'Hernia', label: 'Inguinal / femoral hernia repair (mesh)',
    rec: {
      firstChoice: { agent: 'Cefazolin', dose: '≤80 kg: 1 g | >80 kg: 2 g', route: 'IV', timing: '30–60 min before incision' },
      duration: 'Single dose',
      allergyAlt: { agent: 'Clindamycin 600 mg IV', dose: '600 mg', route: 'IV over 20 min' },
      evidence: 'Cochrane Review — antibiotics for prevention of mesh infection (2017); SIGN 104; EHS Guidelines 2018',
      notes: 'Strongly recommended for all synthetic mesh repairs (Lichtenstein, TEP, TAPP). For tissue repair without mesh: evidence supports no prophylaxis, though many centres administer for uniformity.',
    },
  },
  {
    id: 'hernia_ventral', group: 'Hernia', label: 'Ventral / incisional hernia repair',
    rec: {
      firstChoice: { agent: 'Cefazolin', dose: '≤80 kg: 1 g | >80 kg: 2 g', route: 'IV', timing: '30–60 min before incision' },
      redosing: 'Repeat at 4 h for prolonged cases',
      duration: 'Single dose',
      allergyAlt: { agent: 'Clindamycin 600 mg IV + Gentamicin 3 mg/kg IBW IV', dose: 'As stated', route: 'IV' },
      evidence: 'SIGN 104; ASHP 2013',
      notes: 'Contaminated or infected fields: Altemeier Class III/IV — treat as therapeutic antibiotics, not prophylaxis.',
    },
  },
  {
    id: 'upper_gi', group: 'Upper GI', label: 'Upper GI surgery (gastric / oesophageal / bariatric)',
    rec: {
      firstChoice: { agent: 'Cefazolin + Metronidazole', dose: 'Cefazolin ≤80 kg 1 g / >80 kg 2 g; Metronidazole 500 mg', route: 'IV', timing: '30–60 min before incision' },
      redosing: 'Cefazolin: repeat at 4 h intervals',
      duration: 'Single dose (max 24 h)',
      allergyAlt: { agent: 'Clindamycin 600 mg IV + Gentamicin 5 mg/kg IBW IV', dose: 'As stated', route: 'IV' },
      evidence: 'SIGN 104; ASHP 2013; IFSO Bariatric Guidelines',
    },
  },
  {
    id: 'breast', group: 'Breast', label: 'Breast surgery (lumpectomy / mastectomy / implant)',
    rec: {
      firstChoice: { agent: 'Cefazolin', dose: '≤80 kg: 1 g | >80 kg: 2 g', route: 'IV', timing: '30–60 min before incision' },
      duration: 'Single dose',
      allergyAlt: { agent: 'Clindamycin 600 mg IV', dose: '600 mg', route: 'IV over 20 min' },
      evidence: 'SIGN 104; American Society of Breast Surgeons 2017; ASHP 2013',
      notes: 'Strongly recommended for all implant / expander / oncoplastic reconstruction. Evidence for simple wide local excision varies by guideline — most centres administer for uniformity.',
    },
  },
  {
    id: 'thyroid', group: 'Endocrine', label: 'Thyroid / parathyroid surgery',
    rec: {
      firstChoice: { agent: 'Cefazolin', dose: '≤80 kg: 1 g | >80 kg: 2 g', route: 'IV', timing: '30–60 min before incision' },
      duration: 'Single dose',
      allergyAlt: { agent: 'Clindamycin 600 mg IV', dose: '600 mg', route: 'IV over 20 min' },
      evidence: 'ASHP 2013; Meta-analysis: Ramirez et al. — head/neck endocrine surgery',
      notes: 'Clean surgery: evidence for uncomplicated thyroidectomy is mixed. Local policy varies. Consider if re-operative neck surgery, concurrent tracheostomy, immunosuppression, or patient risk factors for SSI.',
    },
  },
  {
    id: 'laparotomy', group: 'General', label: 'Exploratory laparotomy',
    rec: {
      firstChoice: { agent: 'Cefazolin + Metronidazole', dose: 'Cefazolin ≤80 kg 1 g / >80 kg 2 g; Metronidazole 500 mg', route: 'IV', timing: '30–60 min before incision' },
      redosing: 'Cefazolin: repeat at 4 h intervals',
      duration: 'Single dose; extend to 24 h if contaminated; therapeutic course if infected (Altemeier Class III/IV)',
      allergyAlt: { agent: 'Clindamycin 600 mg IV + Gentamicin 5 mg/kg IBW IV', dose: 'As stated', route: 'IV' },
      evidence: 'SIGN 104; ASHP 2013; Altemeier wound classification guides duration',
      notes: 'Duration by Altemeier class: Clean-contaminated → single dose; Contaminated → 24 h; Dirty/infected → 5-day therapeutic course. Culture intraoperative specimens.',
    },
  },
];

// ── Medication classification rules — imported from @/lib/periop-meds ─────────

// ── Pre-op preparation checklist items ───────────────────────────────────────

const PREP_ITEMS: { id: string; text: string; critical?: boolean; group: string }[] = [
  { id: 'id_check',   group: 'Patient Verification', critical: true, text: 'Patient identity confirmed — name, DOB, hospital number, procedure' },
  { id: 'consent',    group: 'Patient Verification', critical: true, text: 'Written informed consent obtained and filed in notes' },
  { id: 'site_mark',  group: 'Patient Verification', text: 'Operative site marked by surgeon (if applicable)' },
  { id: 'allergy',    group: 'Patient Verification', critical: true, text: 'Allergy status documented and communicated to anaesthetic team and nursing staff' },
  { id: 'nbm_solids', group: 'Fasting',             critical: true, text: 'Nil by mouth — solid food for ≥6 h; patient understands (≥8 h if GLP-1 agonist or gastroparesis)' },
  { id: 'nbm_fluids', group: 'Fasting',             text: 'Nil by mouth — clear fluids for ≥2 h before anaesthesia (standard adult)' },
  { id: 'carb_load',  group: 'Fasting',             text: 'ERAS: pre-operative carbohydrate loading drink given 2–3 h before (if no diabetes or gastroparesis)' },
  { id: 'bowel_prep', group: 'Fasting',             text: 'Bowel preparation administered if required for colorectal procedure' },
  { id: 'fbc_coag',   group: 'Investigations',      critical: true, text: 'FBC and coagulation (INR / APTT) reviewed; no uncorrected coagulopathy' },
  { id: 'ue',         group: 'Investigations',      text: 'U&E, creatinine and eGFR reviewed; electrolytes within acceptable range' },
  { id: 'gxm',        group: 'Investigations',      text: 'Blood group and cross-match / group & save completed (if significant blood loss anticipated)' },
  { id: 'ecg',        group: 'Investigations',      text: 'ECG reviewed (age >50 or cardiac history)' },
  { id: 'imaging',    group: 'Investigations',      text: 'Pre-operative imaging available and reviewed by surgeon' },
  { id: 'cbg',        group: 'Investigations',      text: 'Capillary blood glucose checked and within range (if diabetic)' },
  { id: 'vte',        group: 'Risk & Prophylaxis',  critical: true, text: 'VTE risk assessed (Caprini score); thromboprophylaxis (pharmacological + mechanical) ordered as per risk' },
  { id: 'abx',        group: 'Risk & Prophylaxis',  critical: true, text: 'Antibiotic prophylaxis ordered — timing confirmed (30–60 min before skin incision)' },
  { id: 'ponv',       group: 'Risk & Prophylaxis',  text: 'PONV risk assessed (Apfel score); antiemetic prophylaxis plan in place (dexamethasone 8 mg ± ondansetron 4 mg)' },
  { id: 'warming',    group: 'Risk & Prophylaxis',  text: 'Normothermia protocol in place — forced-air warming blanket ordered; IV fluid warmer available' },
  { id: 'escort',     group: 'Patient Logistics',   text: 'Adult escort home arranged (day cases / same-day discharge)' },
  { id: 'postop_inst',group: 'Patient Logistics',   text: 'Post-operative care instructions given to patient and carer (verbal + written)' },
  { id: 'gp_letter',  group: 'Patient Logistics',   text: 'GP / referring provider notified of planned procedure' },
];

const PREP_GROUPS = [...new Set(PREP_ITEMS.map(i => i.group))];

// ── Component ─────────────────────────────────────────────────────────────────

export default function PerioperativeTab() {
  const ctx = useAppContext();

  // ── Section 1: Antibiotic prophylaxis — shared via context, auto-derived from
  // the working diagnosis first (reflects what's actually confirmed), then
  // visit type as a fallback for cases the diagnosis doesn't map cleanly to.
  const VISIT_TYPE_TO_PROC: Record<string, string> = {
    ercp:           'ercp_therapeutic',
    endoscopy_ogd:  'ogd',
    endoscopy_col:  'colonoscopy',
    day_of_surgery: '',
  };
  const DISEASE_ID_TO_PROC: Record<string, string> = {
    cholecystitis:   'lap_chole',
    appendicitis:    'appendicectomy',
    inguinal_hernia: 'hernia_inguinal',
  };

  const dxProcId = ctx.workingDiagnosis?.diseaseId ? DISEASE_ID_TO_PROC[ctx.workingDiagnosis.diseaseId] : undefined;
  const derivedProcId = dxProcId ?? (ctx.visitType ? (VISIT_TYPE_TO_PROC[ctx.visitType] ?? '') : '');
  const selectedProc = ctx.periopProcId || derivedProcId;
  const setSelectedProc = (id: string) => ctx.setPeriopProcId(id);
  const proc = PROCEDURES.find(p => p.id === selectedProc);
  const penAllergy = hasPenAllergyFlag(ctx.allergies);
  const noAbxProc = proc && proc.rec.firstChoice.agent.startsWith('No routine');
  const groups = [...new Set(PROCEDURES.map(p => p.group))];

  // ── Section 2: Medication management
  const allDrugs = useMemo(() => parseDrugs(ctx.medications, ctx.medicationsText), [ctx.medications, ctx.medicationsText]);
  const classified = useMemo<ClassifiedMed[]>(() => allDrugs.map(classifyMed), [allDrugs]);
  const byAction = useMemo<Partial<Record<PeriOpAction, ClassifiedMed[]>>>(() => {
    const map: Partial<Record<PeriOpAction, ClassifiedMed[]>> = {};
    for (const m of classified) {
      (map[m.action] ??= []).push(m);
    }
    return map;
  }, [classified]);

  // ── Section 3: Pre-op checklist
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setChecked(c => ({ ...c, [id]: !c[id] }));
  const totalItems = PREP_ITEMS.length;
  const doneItems = PREP_ITEMS.filter(i => checked[i.id]).length;
  const allDone = doneItems === totalItems;

  return (
    <div className="gap-y">

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #1e293b 100%)', borderRadius: 10, padding: '16px 20px', color: '#fff' }}>
        <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: '0.01em' }}>Perioperative Safety Panel</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
          Antibiotic prophylaxis · Medication management · Pre-operative preparation — evidence-based, allergy-aware
        </div>
      </div>

      {/* ─── Section 1: Antibiotic Prophylaxis ─────────────────────────────── */}
      <CollapsibleCard title="Surgical Antibiotic Prophylaxis" defaultOpen>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
            Select procedure type
          </label>
          <select
            value={selectedProc}
            onChange={e => setSelectedProc(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff', color: '#1e293b' }}
          >
            <option value="">— Select procedure —</option>
            {groups.map(g => (
              <optgroup key={g} label={g}>
                {PROCEDURES.filter(p => p.group === g).map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Allergy alert banner */}
        {penAllergy && (
          <div style={{ padding: '8px 12px', borderRadius: 7, background: '#fef2f2', border: '1px solid #fca5a5', marginBottom: 12, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>⚠</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, color: '#991b1b' }}>Penicillin / beta-lactam allergy documented</div>
              <div style={{ fontSize: 11, color: '#991b1b', marginTop: 2 }}>
                First-choice agents below may be contraindicated. Allergy alternative is highlighted.
              </div>
            </div>
          </div>
        )}

        {!proc && (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            Select a procedure to see the recommended antibiotic prophylaxis protocol.
          </div>
        )}

        {proc && noAbxProc && (
          <div style={{ padding: '14px 16px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #86efac' }}>
            <div style={{ fontWeight: 700, color: '#166534', fontSize: 13, marginBottom: 4 }}>No routine antibiotic prophylaxis required</div>
            <div style={{ fontSize: 12, color: '#166534' }}>{proc.label}</div>
            {proc.rec.notes && (
              <div style={{ marginTop: 8, padding: '8px 10px', background: '#dcfce7', borderRadius: 6, fontSize: 12, color: '#14532d' }}>
                <strong>Clinical note:</strong> {proc.rec.notes}
              </div>
            )}
            <div style={{ marginTop: 8, fontSize: 11, color: '#6b7280' }}>Evidence: {proc.rec.evidence}</div>
          </div>
        )}

        {proc && !noAbxProc && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* First choice */}
            <div style={{ padding: '14px 16px', borderRadius: 8, background: penAllergy ? '#f9fafb' : '#f0fdf4', border: `1px solid ${penAllergy ? '#d1d5db' : '#86efac'}`, opacity: penAllergy ? 0.75 : 1 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: penAllergy ? '#6b7280' : '#166534', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {penAllergy ? 'First Choice (⚠ check allergy)' : 'First Choice'}
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', marginBottom: 6 }}>{proc.rec.firstChoice.agent}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                {([
                  ['Dose', proc.rec.firstChoice.dose],
                  ['Route', proc.rec.firstChoice.route],
                  ['Timing', proc.rec.firstChoice.timing],
                  ...(proc.rec.redosing ? [['Redosing', proc.rec.redosing]] : []),
                  ['Duration', proc.rec.duration],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} style={{ fontSize: 12 }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>{k}: </span>
                    <span style={{ color: '#1e293b' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Allergy alternative — always shown, highlighted when allergy present */}
            <div style={{ padding: '14px 16px', borderRadius: 8, background: penAllergy ? '#fef2f2' : '#f8fafc', border: `2px solid ${penAllergy ? '#fca5a5' : '#e2e8f0'}` }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: penAllergy ? '#991b1b' : '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {penAllergy ? '✓ Use this: Allergy Alternative' : 'Allergy Alternative'}
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', marginBottom: 6 }}>{proc.rec.allergyAlt.agent}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                {[
                  ['Dose', proc.rec.allergyAlt.dose],
                  ['Route', proc.rec.allergyAlt.route],
                  ['Duration', proc.rec.duration],
                ].map(([k, v]) => (
                  <div key={k} style={{ fontSize: 12 }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>{k}: </span>
                    <span style={{ color: '#1e293b' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            {proc.rec.notes && (
              <div style={{ padding: '10px 12px', borderRadius: 7, background: '#fefce8', border: '1px solid #fde68a', fontSize: 12, color: '#78350f' }}>
                <strong>Clinical note:</strong> {proc.rec.notes}
              </div>
            )}

            {/* Evidence */}
            <div style={{ fontSize: 11, color: '#94a3b8', paddingLeft: 4 }}>
              Evidence: {proc.rec.evidence}
            </div>
          </div>
        )}
      </CollapsibleCard>

      {/* ─── Section 2: Medication Management ──────────────────────────────── */}
      <CollapsibleCard title={`Perioperative Medication Management${allDrugs.length > 0 ? ` — ${allDrugs.length} medication${allDrugs.length !== 1 ? 's' : ''}` : ''}`} defaultOpen>
        {allDrugs.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            No medications recorded. Add medications in the Medications tab to see perioperative guidance.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 11, color: '#94a3b8', paddingLeft: 2 }}>
              Auto-classified from patient medication list. Always verify with the prescribing physician and anaesthetist.
            </div>

            {ACTION_ORDER.map(action => {
              const meds = byAction[action];
              if (!meds || meds.length === 0) return null;
              const meta = ACTION_META[action];
              return (
                <div key={action} style={{ borderRadius: 8, border: `1px solid ${meta.border}`, overflow: 'hidden' }}>
                  <div style={{ padding: '8px 14px', background: meta.bg, borderBottom: `1px solid ${meta.border}` }}>
                    <span style={{ fontWeight: 700, fontSize: 12, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {meta.label}
                    </span>
                  </div>
                  {meds.map((m, idx) => (
                    <div key={idx} style={{ padding: '10px 14px', borderTop: idx > 0 ? `1px solid ${meta.border}` : undefined, background: meta.bg }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{m.raw}</div>
                      <div style={{ fontSize: 11, color: meta.color, fontStyle: 'italic', marginTop: 2 }}>{m.drugClass}</div>
                      <div style={{ fontSize: 12, color: '#374151', marginTop: 5, lineHeight: 1.55 }}>{m.instruction}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleCard>

      {/* ─── Patient Prep Instructions ─────────────────────────────────────── */}
      <PatientPrepCard />

      {/* ─── Section 3: Pre-operative Preparation ───────────────────────────── */}
      <CollapsibleCard title={`Pre-operative Preparation Checklist — ${doneItems}/${totalItems}`} defaultOpen={false}>
        {/* Progress bar */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
              {allDone ? '✓ All items complete' : `${totalItems - doneItems} item${totalItems - doneItems !== 1 ? 's' : ''} remaining`}
            </span>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{Math.round((doneItems / totalItems) * 100)}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: '#e2e8f0', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 3, background: allDone ? '#22c55e' : '#3b82f6', width: `${(doneItems / totalItems) * 100}%`, transition: 'width 200ms ease' }} />
          </div>
        </div>

        {PREP_GROUPS.map(group => {
          const items = PREP_ITEMS.filter(i => i.group === group);
          const groupDone = items.every(i => checked[i.id]);
          return (
            <div key={group} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: groupDone ? '#166534' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                {groupDone ? <span style={{ fontSize: 13 }}>✓</span> : null}
                {group}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {items.map(item => (
                  <label key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '7px 10px', borderRadius: 6, background: checked[item.id] ? '#f0fdf4' : item.critical ? '#fff' : '#fafafa', border: `1px solid ${checked[item.id] ? '#86efac' : item.critical ? '#fde68a' : '#f1f5f9'}` }}>
                    <input
                      type="checkbox"
                      checked={!!checked[item.id]}
                      onChange={() => toggle(item.id)}
                      style={{ marginTop: 1, flexShrink: 0, accentColor: '#16a34a' }}
                    />
                    <span style={{ fontSize: 12.5, color: checked[item.id] ? '#166534' : '#374151', fontWeight: item.critical ? 600 : 400, lineHeight: 1.45 }}>
                      {item.critical && !checked[item.id] && <span style={{ color: '#f59e0b', marginRight: 5 }}>★</span>}
                      {item.text}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}

        {allDone && (
          <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 7, background: '#f0fdf4', border: '1px solid #86efac', fontSize: 13, color: '#166534', fontWeight: 600 }}>
            ✓ Pre-operative preparation complete — patient is ready for the operating theatre.
          </div>
        )}
      </CollapsibleCard>

    </div>
  );
}
