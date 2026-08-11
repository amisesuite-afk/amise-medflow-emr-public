/**
 * Sub-diagnosis variant engine.
 *
 * For each base surgical/endoscopic diagnosis, defines the clinical sub-types
 * (variants) along with:
 *  - keyword-based auto-detection from the assessment text
 *  - which protocol management phases are appropriate (phase filter)
 *  - examination / imaging queries needed to differentiate when unclear
 *  - a plan prefix that appears before the protocol steps
 *  - a clinical urgency note for the clinician
 *
 * Used by PlanTab to generate a diagnosis-specific plan rather than showing
 * all management options generically.
 */

export interface DxVariant {
  id: string;
  label: string;
  description: string;
  /** Keywords in the assessment text that auto-select this variant. */
  detectKeywords: string[];
  /** Protocol management phases to include (all others are suppressed). */
  allowedPhases: string[];
  /** Chip-style questions shown to the clinician when auto-detection is ambiguous. */
  examQueries?: string[];
  /** Short urgency note shown in the plan header card. */
  urgencyNote?: string;
  /** Paragraph prepended before protocol steps in the generated plan. */
  planPrefix?: string;
}

export interface DxVariantGroup {
  baseDiagnosis: string;
  /** ICD-10 code prefixes that match this group. */
  icdPrefixes: string[];
  /** pane-engine disease IDs that match this group. */
  diseaseIds: string[];
  /** The key clinical question that differentiates the variants. */
  differentiatorQuery: string;
  variants: DxVariant[];
}

export const DX_VARIANT_GROUPS: DxVariantGroup[] = [

  // ── Acute Appendicitis ─────────────────────────────────────────────────────
  {
    baseDiagnosis: 'Acute Appendicitis',
    icdPrefixes: ['K35'],
    diseaseIds: ['appendicitis', 'appendicitis_acute', 'appendicitis_perforated'],
    differentiatorQuery: 'Is there an appendix mass / phlegmon, or signs of perforation / peritonitis?',
    variants: [
      {
        id: 'appendicitis_uncomplicated',
        label: 'Uncomplicated acute appendicitis',
        description: '<72 h, no mass, no peritonism beyond localised RIF guarding, Alvarado ≥7',
        detectKeywords: ['uncomplicated', 'simple appendicitis', 'without perforation', 'without abscess', 'without peritonitis', 'appendicitis', 'mcburney point', 'rebound tenderness', 'rif pain', 'right iliac fossa pain', 'alvarado score', 'guarding rif'],
        allowedPhases: ['immediate', 'surgical', 'followup'],
        examQueries: ['RIF guarding only (not generalised)?', 'Symptom onset <72 h?', 'No mass palpable?'],
        urgencyNote: 'Early laparoscopic appendicectomy — ideally within 12 h of diagnosis.',
      },
      {
        id: 'appendicitis_phlegmon',
        label: 'Appendicular phlegmon / mass',
        description: '>72 h symptoms with palpable mass or USS/CT phlegmon — non-operative management first',
        detectKeywords: ['phlegmon', 'appendix mass', 'appendicular mass', 'appendix phlegmon', 'appendiceal mass', 'inflammatory mass', 'appendiceal phlegmon'],
        allowedPhases: ['immediate', 'conservative'],
        examQueries: ['Mass palpable in RIF?', 'USS/CT confirms phlegmon?', 'Symptoms >72 h?', 'No free perforation on CT?'],
        urgencyNote: 'Non-operative management — IV antibiotics + close observation. Avoid early surgery through inflamed mass. Interval appendicectomy 6–8 weeks after resolution.',
        planPrefix:
          '## Appendicular Phlegmon — Non-Operative Management\n\n' +
          'Indication: phlegmon / inflammatory mass (>72 h), no free perforation or generalised peritonitis.\n' +
          'IV antibiotics + close serial clinical review. Interval appendicectomy planned at 6–8 weeks.\n' +
          'If deterioration / abscess develops: CT-guided drainage or operative intervention.\n\n',
      },
      {
        id: 'appendicitis_abscess',
        label: 'Appendicular abscess',
        description: 'CT-confirmed pericaecal / pelvic abscess — drainage first',
        detectKeywords: ['appendicular abscess', 'appendix abscess', 'appendiceal abscess', 'pericaecal abscess', 'pericecal abscess'],
        allowedPhases: ['immediate', 'conservative'],
        examQueries: ['Abscess confirmed on CT?', 'Abscess >4 cm?', 'Interventional radiology available?'],
        urgencyNote: 'CT-guided percutaneous drainage (IR referral) for accessible abscess ≥4 cm. IV antibiotics. Interval appendicectomy 6–8 weeks. Colonoscopy if age >40.',
        planPrefix:
          '## Appendicular Abscess — Source Control + Interval Surgery\n\n' +
          'CT-guided percutaneous drainage (if abscess ≥4 cm and accessible). IV antibiotics 7–10 days.\n' +
          'Plan interval laparoscopic appendicectomy at 6–8 weeks after resolution.\n' +
          'If drainage not possible or patient deteriorates: operative drainage + appendicectomy.\n\n',
      },
      {
        id: 'appendicitis_localised_peritonitis',
        label: 'Perforated appendicitis — localised peritonitis',
        description: 'Perforation with localised peritonism (RIF), K35.30 — surgical management',
        detectKeywords: ['localised peritonitis', 'localized peritonitis', 'with localised peritonitis', 'with localized peritonitis', 'k35.3', 'localised perforation'],
        allowedPhases: ['immediate', 'surgical', 'followup'],
        examQueries: ['Peritonism localised to RIF only?', 'No generalised guarding?'],
        urgencyNote: 'Perforated appendicitis with localised peritonitis — laparoscopic appendicectomy ± peritoneal washout. Drain only if localised collection.',
        planPrefix:
          '## Perforated Appendicitis — Localised Peritonitis (K35.30)\n\n' +
          'Laparoscopic appendicectomy + peritoneal washout. Drain only if localised pus collection.\n' +
          'IV antibiotics post-op 3–5 days, then oral to complete 7 days.\n\n',
      },
      {
        id: 'appendicitis_generalised_peritonitis',
        label: 'Perforated appendicitis — generalised peritonitis',
        description: 'Free perforation with generalised peritonitis, K35.20 — EMERGENCY',
        detectKeywords: ['generalised peritonitis', 'generalized peritonitis', 'free perforation', 'faecal peritonitis', 'fecal peritonitis', 'k35.2', 'diffuse peritonitis'],
        allowedPhases: ['immediate', 'surgical'],
        examQueries: ['Peritonism generalised (not just RIF)?', 'Free gas on CT/X-ray?', 'Haemodynamic instability?'],
        urgencyNote: '⚠ EMERGENCY — generalised peritonitis. Mark emergency list immediately. Aggressive resuscitation. ICU/HDU post-op.',
        planPrefix:
          '## EMERGENCY — Perforated Appendicitis with Generalised Peritonitis (K35.20)\n\n' +
          'Emergency laparoscopic appendicectomy + peritoneal washout.\n' +
          'Convert to open midline laparotomy if haemodynamically unstable or dense adhesions.\n' +
          'Post-op IV antibiotics × 5–7 days. ICU/HDU level care.\n\n',
      },
    ],
  },

  // ── Acute Cholecystitis ────────────────────────────────────────────────────
  {
    baseDiagnosis: 'Acute Cholecystitis',
    icdPrefixes: ['K81'],
    diseaseIds: ['cholecystitis', 'cholecystitis_acute'],
    differentiatorQuery: 'Tokyo Guidelines severity grade — I (mild), II (moderate), or III (severe with organ dysfunction)?',
    variants: [
      {
        id: 'cholecystitis_grade1',
        label: 'Mild — Tokyo Grade I',
        description: 'Mild inflammation, no organ dysfunction, CRP <50',
        detectKeywords: ['mild cholecystitis', 'grade i', 'grade 1', 'uncomplicated cholecystitis', 'tokyo grade i', 'tokyo grade 1', 'cholecystitis', 'murphy sign positive', "murphy's sign positive", 'murphy positive', 'ruq pain', 'right upper quadrant pain', 'biliary colic'],
        allowedPhases: ['immediate', 'surgical', 'followup'],
        examQueries: ['Systemically well?', 'CRP <50?', 'No organ dysfunction?'],
        urgencyNote: 'Tokyo Grade I — early laparoscopic cholecystectomy within 72 h recommended (reduces complications vs interval surgery).',
      },
      {
        id: 'cholecystitis_grade2',
        label: 'Moderate — Tokyo Grade II',
        description: 'Marked local inflammation; WBC >18, fever >38°C, >72 h, difficult GB on imaging',
        detectKeywords: ['moderate cholecystitis', 'grade ii', 'grade 2', 'tokyo grade ii', 'tokyo grade 2', 'marked inflammation'],
        allowedPhases: ['immediate', 'surgical', 'followup'],
        examQueries: ['WBC >18?', 'Symptom duration >72 h?', 'Thick-walled GB on USS?'],
        urgencyNote: 'Tokyo Grade II — early surgery if fit; cholecystostomy if surgical risk too high. Experienced laparoscopic surgeon preferred.',
      },
      {
        id: 'cholecystitis_grade3',
        label: 'Severe — Tokyo Grade III (organ dysfunction)',
        description: 'Cardiovascular / neurological / respiratory / renal / hepatic / haematological dysfunction',
        detectKeywords: ['severe cholecystitis', 'grade iii', 'grade 3', 'tokyo grade iii', 'tokyo grade 3', 'organ dysfunction', 'empyema', 'gangrenous cholecystitis', 'emphysematous cholecystitis'],
        allowedPhases: ['immediate', 'conservative', 'followup'],
        examQueries: ['Septic shock?', 'Renal impairment?', 'Altered consciousness?', 'Respiratory failure?'],
        urgencyNote: 'Tokyo Grade III — ICU resuscitation first. Percutaneous cholecystostomy for source control. Delayed laparoscopic cholecystectomy when systemically stable.',
        planPrefix:
          '## Severe Cholecystitis — Tokyo Grade III — Source Control First\n\n' +
          'ICU-level resuscitation (sepsis-6 protocol). Percutaneous cholecystostomy (IR referral) for biliary decompression.\n' +
          'Delayed laparoscopic cholecystectomy when organ dysfunction resolved and patient fit.\n\n',
      },
    ],
  },

  // ── Cholangitis ────────────────────────────────────────────────────────────
  {
    baseDiagnosis: 'Cholangitis',
    icdPrefixes: ['K83.0', 'K83'],
    diseaseIds: ['cholangitis'],
    differentiatorQuery: 'Tokyo Guidelines severity — Grade I (mild), II (moderate), or III (severe with organ dysfunction)?',
    variants: [
      {
        id: 'cholangitis_grade1',
        label: 'Mild — Tokyo Grade I',
        description: 'Responds to initial medical therapy; no organ dysfunction',
        detectKeywords: ['mild cholangitis', 'grade i cholangitis', 'grade 1 cholangitis', 'ascending cholangitis grade i', 'ascending cholangitis', 'charcot triad', "charcot's triad"],
        allowedPhases: ['immediate', 'conservative', 'followup'],
        examQueries: ['Charcots triad (fever/jaundice/pain)?', 'Responding to antibiotics?', 'No organ dysfunction?'],
        urgencyNote: 'Tokyo Grade I — IV antibiotics. ERCP within 24–48 h for biliary decompression (elective timing acceptable if responding).',
      },
      {
        id: 'cholangitis_grade2',
        label: 'Moderate — Tokyo Grade II',
        description: 'Not responding to initial therapy within 24 h — ERCP within 24 h',
        detectKeywords: ['moderate cholangitis', 'grade ii cholangitis', 'grade 2 cholangitis', 'tokyo grade ii cholangitis'],
        allowedPhases: ['immediate', 'surgical', 'followup'],
        examQueries: ['Not improving on antibiotics?', 'WBC >12 or <4?', 'Bilirubin >85 μmol/L?'],
        urgencyNote: 'Tokyo Grade II — ERCP within 24 h (endoscopic biliary drainage). IV pip-tazo. Biliary stent or stone extraction.',
      },
      {
        id: 'cholangitis_grade3',
        label: 'Severe — Tokyo Grade III — EMERGENCY',
        description: 'Organ dysfunction — cardiovascular / neurological / respiratory / renal / hepatic / haematological',
        detectKeywords: ['severe cholangitis', 'grade iii cholangitis', 'grade 3 cholangitis', 'reynolds pentad', 'septic shock cholangitis'],
        allowedPhases: ['immediate', 'surgical'],
        examQueries: ['Hypotension / shock?', 'Altered consciousness?', 'Renal failure?'],
        urgencyNote: '⚠ EMERGENCY — Tokyo Grade III. Immediate ICU resuscitation. Urgent ERCP (within hours) for biliary decompression. Anaesthetic review.',
        planPrefix:
          '## EMERGENCY — Severe Cholangitis (Tokyo Grade III)\n\n' +
          'Immediate ICU transfer. Sepsis-6 protocol. Urgent ERCP for biliary drainage (within hours, not days).\n' +
          'Endoscopic sphincterotomy ± stone extraction ± biliary stent.\n' +
          'Anaesthetic and GI/endoscopy teams alerted immediately.\n\n',
      },
    ],
  },

  // ── Hernia ─────────────────────────────────────────────────────────────────
  {
    baseDiagnosis: 'Hernia',
    icdPrefixes: ['K40', 'K41', 'K42', 'K43', 'K44', 'K45', 'K46'],
    diseaseIds: ['hernia_inguinal', 'hernia_ventral', 'hernia_umbilical', 'hernia'],
    differentiatorQuery: 'Is the hernia reducible, irreducible (incarcerated), or strangulated?',
    variants: [
      {
        id: 'hernia_reducible',
        label: 'Reducible — elective repair',
        description: 'Easily reducible, no acute symptoms, elective surgical candidate',
        detectKeywords: ['reducible hernia', 'elective repair', 'routine hernia', 'uncomplicated hernia', 'reducible inguinal', 'reducible umbilical'],
        allowedPhases: ['surgical', 'followup'],
        examQueries: ['Hernia reduces fully?', 'No signs of obstruction?', 'Systemically well?'],
        urgencyNote: 'Elective laparoscopic (TEP/TAPP) or open (Lichtenstein) repair. Pre-operative assessment and consent.',
        planPrefix:
          '## Elective Hernia Repair\n\n' +
          'Pre-operative assessment and consent. Day-case laparoscopic repair preferred. Antibiotic prophylaxis at induction (cefazolin 1–2 g IV).\n\n',
      },
      {
        id: 'hernia_incarcerated',
        label: 'Irreducible / incarcerated hernia',
        description: 'Not reducible but no signs of strangulation — attempt gentle reduction',
        detectKeywords: ['irreducible', 'incarcerated', 'cannot reduce', 'non-reducible', 'obstructed hernia'],
        allowedPhases: ['immediate', 'conservative', 'surgical', 'followup'],
        examQueries: ['Tender but no peritonism?', 'Bowel sounds present?', 'Reducing with sedation / Trendelenburg?'],
        urgencyNote: 'Attempt gentle manual reduction (adequate analgesia ± sedation, Trendelenburg position). If successful: semi-elective repair within 24–48 h. If fails: emergency surgery.',
      },
      {
        id: 'hernia_strangulated',
        label: 'Strangulated hernia — EMERGENCY',
        description: 'Ischaemic content — tense, tender, non-reducible ± peritonism, fever, high WBC',
        detectKeywords: ['strangulated', 'strangulation', 'ischaemic hernia', 'ischemic hernia', 'gangrenous hernia', 'strangulated inguinal', 'strangulated umbilical'],
        allowedPhases: ['immediate', 'surgical'],
        examQueries: ['Tense, non-reducible, tender hernia?', 'Peritonism?', 'Pyrexia / high WBC?'],
        urgencyNote: '⚠ EMERGENCY — strangulated hernia. Emergency surgical repair. Bowel resection if necrosis confirmed intraoperatively.',
        planPrefix:
          '## EMERGENCY — Strangulated Hernia\n\n' +
          'Emergency laparoscopic/open hernia repair. Assess bowel viability — resect if necrotic (primary anastomosis vs stoma based on contamination).\n' +
          'Do NOT delay for imaging if clinical peritonism is present.\n\n',
      },
    ],
  },

  // ── Bowel Obstruction ──────────────────────────────────────────────────────
  {
    baseDiagnosis: 'Bowel Obstruction',
    icdPrefixes: ['K56'],
    diseaseIds: ['bowel_obstruction', 'sbo', 'lbo', 'adhesional_obstruction'],
    differentiatorQuery: 'Small vs large bowel? Any strangulation / ischaemia on CT?',
    variants: [
      {
        id: 'sbo_adhesional',
        label: 'SBO — adhesional, no strangulation (drip and suck)',
        description: 'Small bowel obstruction, prior surgery, no peritonism, no closed-loop on CT',
        detectKeywords: ['small bowel obstruction', 'sbo', 'adhesional obstruction', 'adhesion', 'drip and suck'],
        allowedPhases: ['immediate', 'conservative', 'followup'],
        examQueries: ['Prior abdominal surgery?', 'No peritonism?', 'No closed-loop on CT?', 'Proximal obstruction?'],
        urgencyNote: '72-hour trial of non-operative management (NGT + IV fluids + NBM). Re-assess at 24-48 h: failure to improve = operate.',
        planPrefix:
          '## Small Bowel Obstruction — Non-Operative Trial (Drip and Suck)\n\n' +
          'NGT on free drainage. IV fluid resuscitation. NBM. Serial clinical assessment every 4–6 h.\n' +
          'CT abdomen/pelvis to exclude closed-loop, ischaemia, or hernia.\n' +
          'Failure criteria at 48–72 h: no resolution, worsening pain, peritonism, fever, rising lactate → operate.\n\n',
      },
      {
        id: 'sbo_strangulation',
        label: 'SBO with strangulation / ischaemia — EMERGENCY',
        description: 'Closed-loop, fever, peritonism, rising lactate, WBC >20 — emergency surgery',
        detectKeywords: ['strangulated bowel', 'ischaemic bowel', 'ischemic bowel', 'closed loop', 'closed-loop', 'strangulation', 'bowel ischaemia'],
        allowedPhases: ['immediate', 'surgical'],
        examQueries: ['Peritonism?', 'Fever + high WBC?', 'Closed-loop on CT?', 'Rising lactate?'],
        urgencyNote: '⚠ EMERGENCY — strangulated SBO. Emergency laparotomy/laparoscopy. Bowel resection if ischaemia confirmed.',
        planPrefix:
          '## EMERGENCY — Strangulated Small Bowel Obstruction\n\n' +
          'Do NOT delay for further imaging if peritonism is present.\n' +
          'Emergency exploratory laparotomy/laparoscopy. Assess bowel viability — resect non-viable segment.\n' +
          'Primary anastomosis if healthy bowel ends and no contamination. ICU/HDU post-op.\n\n',
      },
      {
        id: 'lbo_volvulus',
        label: 'Volvulus (Sigmoid / Caecal)',
        description: 'Colonic volvulus — sigmoid (endoscopic decompression) or caecal (urgent surgery); AXR coffee-bean sign, CT confirmation',
        detectKeywords: [
          'sigmoid volvulus', 'caecal volvulus', 'cecal volvulus',
          'volvulus of sigmoid', 'volvulus of caecum', 'coffee bean sign',
          'volvulus lbo', 'colonic volvulus',
        ],
        allowedPhases: ['immediate', 'conservative', 'surgical'],
        examQueries: ['Abdominal distension', 'Tympanic percussion', 'Absent bowel sounds'],
        urgencyNote: 'Sigmoid/caecal volvulus — endoscopic decompression (sigmoid) or urgent surgery (caecal); confirm with AXR/CT',
        planPrefix: 'Sigmoid/Caecal Volvulus — Management:\n',
      },
      {
        id: 'lbo_malignant',
        label: 'Large bowel obstruction — malignant',
        description: 'CT-confirmed LBO from colonic tumour, no free perforation',
        detectKeywords: ['large bowel obstruction', 'lbo', 'colonic obstruction', 'sigmoid obstruction', 'colonic cancer obstruction'],
        allowedPhases: ['immediate', 'surgical', 'followup'],
        examQueries: ['CT confirms colonic malignancy?', 'Caecal distension ≥12 cm?', 'Free perforation?'],
        urgencyNote: 'SEMS (stent) as bridge to elective surgery if available. If unavailable or perforated: emergency Hartmann\'s procedure. Oncology/surgical MDT.',
        planPrefix:
          '## Large Bowel Obstruction — Malignant\n\n' +
          'CT staging. Colorectal/Oncology MDT referral.\n' +
          'Options: (1) SEMS bridge to elective resection, (2) Emergency Hartmann\'s, (3) Defunctioning colostomy.\n' +
          'Decision based on: perforation risk, patient fitness, tumour stage, institutional expertise.\n\n',
      },
    ],
  },

  // ── Diverticulitis ─────────────────────────────────────────────────────────
  {
    baseDiagnosis: 'Diverticulitis',
    icdPrefixes: ['K57'],
    diseaseIds: ['diverticulitis'],
    differentiatorQuery: 'Hinchey classification — uncomplicated, abscess (I/II), or peritonitis (III/IV)?',
    variants: [
      {
        id: 'diverticulitis_uncomplicated',
        label: 'Uncomplicated diverticulitis',
        description: 'No abscess, no perforation, mild systemic response — oral antibiotics, outpatient possible',
        detectKeywords: ['uncomplicated diverticulitis', 'mild diverticulitis', 'diverticulitis without abscess', 'hinchey ia', 'hinchey ib', 'lif pain', 'left iliac fossa pain', 'left lower quadrant pain', 'llq pain'],
        allowedPhases: ['conservative', 'followup'],
        examQueries: ['No peritonism?', 'Tolerating oral fluids?', 'CT confirms no abscess / perforation?'],
        urgencyNote: 'Oral antibiotics × 7 days. Low-residue diet. Colonoscopy 6–8 weeks post-resolution to exclude malignancy.',
        planPrefix:
          '## Uncomplicated Acute Diverticulitis\n\n' +
          'Oral antibiotics: co-amoxiclav 625 mg TDS × 7 days (or ciprofloxacin 500 mg BD + metronidazole 400 mg TDS if penicillin allergy).\n' +
          'Low-residue diet. Adequate analgesia (avoid NSAIDs).\n' +
          'Colonoscopy 6–8 weeks after resolution to exclude underlying colonic neoplasia.\n\n',
      },
      {
        id: 'diverticulitis_abscess',
        label: 'Complicated — Hinchey I/II (pericolic / pelvic abscess)',
        description: 'Pericolic (I) or distant (II) abscess confirmed on CT',
        detectKeywords: ['hinchey i', 'hinchey ii', 'hinchey 1', 'hinchey 2', 'pericolic abscess', 'pelvic abscess', 'diverticular abscess', 'complicated diverticulitis'],
        allowedPhases: ['immediate', 'conservative', 'followup'],
        examQueries: ['CT confirms abscess?', 'Abscess ≥4 cm (consider drainage)?', 'Not responding to antibiotics?'],
        urgencyNote: 'IV antibiotics + CT-guided drainage if abscess ≥4 cm. Interval sigmoid colectomy 6–8 weeks after resolution.',
        planPrefix:
          '## Complicated Diverticulitis — Abscess (Hinchey I/II)\n\n' +
          'IV antibiotics: piperacillin-tazobactam 4.5 g TDS. CT-guided percutaneous drainage if abscess ≥4 cm (IR referral).\n' +
          'Interval laparoscopic sigmoid colectomy 6–8 weeks after resolution.\n' +
          'Colonoscopy 6–8 weeks post-resolution to exclude underlying malignancy.\n\n',
      },
      {
        id: 'diverticulitis_peritonitis',
        label: 'Perforated — Hinchey III/IV (peritonitis) — EMERGENCY',
        description: 'Purulent (III) or faecal (IV) peritonitis — emergency surgery',
        detectKeywords: ['hinchey iii', 'hinchey iv', 'hinchey 3', 'hinchey 4', 'purulent peritonitis', 'faecal peritonitis', 'fecal peritonitis', 'perforated diverticulitis', 'faecal contamination'],
        allowedPhases: ['immediate', 'surgical'],
        examQueries: ['Generalised peritonism?', 'Free gas on CT?', 'Haemodynamic instability?'],
        urgencyNote: '⚠ EMERGENCY — perforated diverticulitis. Emergency Hartmann\'s procedure (sigmoid colectomy + end colostomy). Peritoneal washout. ICU post-op.',
        planPrefix:
          '## EMERGENCY — Perforated Diverticulitis (Hinchey III/IV)\n\n' +
          'Emergency laparoscopic or open Hartmann\'s procedure: sigmoid resection + end colostomy.\n' +
          'Copious peritoneal washout with warm saline. Post-op IV antibiotics × 5–7 days.\n' +
          'ICU/HDU post-op care. Reversal of Hartmann\'s (if appropriate) at 12 months.\n\n',
      },
    ],
  },

  // ── Pancreatitis ────────────────────────────────────────────────────────────
  {
    baseDiagnosis: 'Pancreatitis',
    icdPrefixes: ['K85'],
    diseaseIds: ['pancreatitis', 'acute_pancreatitis'],
    differentiatorQuery: 'Atlanta severity — mild, moderately severe, or severe?',
    variants: [
      {
        id: 'pancreatitis_mild',
        label: 'Mild acute pancreatitis (Atlanta 2012)',
        description: 'No organ failure, no local complications, BISAP ≤1, CRP <150',
        detectKeywords: ['mild pancreatitis', 'mild acute pancreatitis', 'uncomplicated pancreatitis'],
        allowedPhases: ['immediate', 'conservative', 'followup'],
        examQueries: ['No organ dysfunction?', 'Tolerating oral fluids within 24 h?', 'BISAP score ≤1?'],
        urgencyNote: 'Supportive management. Oral diet as tolerated. Identify and address aetiology (gallstones → cholecystectomy same admission if mild).',
        planPrefix:
          '## Mild Acute Pancreatitis — Supportive Management\n\n' +
          'IV fluid resuscitation (Hartmann\'s). Pain control. Oral diet when clinically tolerated (early oral feeding improves outcomes).\n' +
          'Address aetiology: USS (gallstones → laparoscopic cholecystectomy same admission if mild pancreatitis).\n\n',
      },
      {
        id: 'pancreatitis_moderate',
        label: 'Moderately severe acute pancreatitis',
        description: 'Transient organ failure (<48 h) or local complications (peripancreatic fluid, necrosis) without persistent failure',
        detectKeywords: ['moderately severe pancreatitis', 'moderate pancreatitis', 'pancreatic necrosis', 'peripancreatic', 'necrotic pancreatitis', 'walled-off necrosis'],
        allowedPhases: ['immediate', 'conservative', 'followup'],
        examQueries: ['Transient organ failure?', 'Peripancreatic fluid on CT?', 'CRP >150?', 'CT severity index?'],
        urgencyNote: 'HDU admission. Aggressive IV fluid resuscitation. CT at 72–96 h if not improving. Avoid antibiotics unless infected necrosis suspected.',
      },
      {
        id: 'pancreatitis_severe',
        label: 'Severe acute pancreatitis — CRITICAL',
        description: 'Persistent organ failure >48 h, pancreatic necrosis ≥30% on CT',
        detectKeywords: ['severe pancreatitis', 'severe acute pancreatitis', 'infected necrosis', 'necrotising pancreatitis', 'pancreatic sepsis'],
        allowedPhases: ['immediate', 'surgical', 'followup'],
        examQueries: ['Persistent organ failure >48 h?', 'Necrosis ≥30% on CT?', 'Infected necrosis (gas on CT / clinical sepsis)?'],
        urgencyNote: '⚠ CRITICAL — severe pancreatitis. ICU admission. HDU monitoring. Antibiotics ONLY if infected necrosis confirmed. Endoscopic/surgical necrosectomy if infected.',
        planPrefix:
          '## Severe Acute Pancreatitis — ICU Level Care\n\n' +
          'ICU admission. Aggressive resuscitation. Enteral feeding via NGT/NJT within 24–48 h (superior to TPN).\n' +
          'Carbapenem antibiotics (meropenem) ONLY if infected necrosis suspected (fever + gas in necrotic area on CT).\n' +
          'Necrosectomy: step-up approach (endoscopic > percutaneous > surgical) — delayed ≥4 weeks until walled-off.\n\n',
      },
    ],
  },

  // ── Upper GI Bleed ──────────────────────────────────────────────────────────
  {
    baseDiagnosis: 'Upper GI Bleed',
    icdPrefixes: ['K25', 'K26', 'K27', 'K28', 'I85', 'K92'],
    diseaseIds: ['ugib', 'upper_gi_bleed', 'peptic_ulcer'],
    differentiatorQuery: 'Variceal vs non-variceal? Haemodynamically stable?',
    variants: [
      {
        id: 'ugib_nonvariceal_stable',
        label: 'Non-variceal UGIB — haemodynamically stable',
        description: 'Peptic ulcer / Mallory-Weiss / erosions — stable, Blatchford ≥1',
        detectKeywords: ['peptic ulcer bleed', 'upper gi bleed', 'haematemesis', 'melena', 'melaena', 'non-variceal', 'nonvariceal', 'mallory-weiss', 'ulcer bleed', 'coffee ground vomiting', 'coffee-ground vomitus'],
        allowedPhases: ['immediate', 'surgical', 'followup'],
        examQueries: ['Haemodynamically stable?', 'Cirrhosis / portal hypertension?', 'Blatchford score ≥6?'],
        urgencyNote: 'PPI IV infusion. OGD within 24 h (same admission). Endoscopic haemostasis if active bleeding / high-risk stigmata.',
        planPrefix:
          '## Non-Variceal Upper GI Bleed\n\n' +
          'PPI: esomeprazole 80 mg IV bolus then 8 mg/h infusion × 72 h (post-endoscopy high-risk lesion).\n' +
          'OGD within 24 h — endoscopic haemostasis (adrenaline injection + clip/bipolar coagulation) for active bleed or visible vessel.\n' +
          'H. pylori testing at endoscopy — eradication therapy if positive.\n\n',
      },
      {
        id: 'ugib_variceal',
        label: 'Variceal UGIB — EMERGENCY',
        description: 'Known or suspected oesophageal / gastric varices — portal hypertension / cirrhosis',
        detectKeywords: ['variceal bleed', 'oesophageal varices', 'esophageal varices', 'gastric varices', 'variceal haemorrhage', 'variceal bleeding', 'portal hypertension bleed'],
        allowedPhases: ['immediate', 'surgical', 'followup'],
        examQueries: ['Known cirrhosis / portal hypertension?', 'Splenomegaly?', 'Haemodynamically unstable?'],
        urgencyNote: '⚠ EMERGENCY — variceal haemorrhage. Terlipressin immediately. Urgent OGD (within 12 h) + endoscopic variceal ligation. Antibiotic prophylaxis (ceftriaxone).',
        planPrefix:
          '## EMERGENCY — Variceal Upper GI Bleed\n\n' +
          'Terlipressin 2 mg IV QDS (or octreotide). Ceftriaxone 1 g IV OD prophylaxis × 7 days.\n' +
          'Urgent OGD within 12 h: endoscopic variceal ligation (EVL) or glue injection (gastric varices).\n' +
          'If uncontrolled: Sengstaken-Blakemore tube as bridge, then TIPS (transjugular intrahepatic portosystemic shunt).\n\n',
      },
    ],
  },

  // ── Breast ──────────────────────────────────────────────────────────────────
  {
    baseDiagnosis: 'Breast',
    icdPrefixes: ['C50', 'D05', 'N60', 'N61', 'N62', 'N63'],
    diseaseIds: ['breast_cancer', 'breast_lump', 'breast'],
    differentiatorQuery: 'Benign vs malignant? Biopsy result? Planned procedure?',
    variants: [
      {
        id: 'breast_triple_assessment',
        label: 'Breast lump — triple assessment pending',
        description: 'New breast lump — clinical + imaging + biopsy assessment needed',
        detectKeywords: ['breast lump', 'breast mass', 'breast lesion', 'triple assessment', 'suspicious breast'],
        allowedPhases: ['immediate', 'followup'],
        urgencyNote: 'Triple assessment: clinical exam + mammogram/USS + core biopsy. MDT discussion before any definitive treatment.',
      },
      {
        id: 'breast_wle',
        label: 'Breast conservation — wide local excision + sentinel node',
        description: 'Early breast cancer suitable for breast-conserving surgery',
        detectKeywords: ['wide local excision', 'wle', 'breast conservation', 'lumpectomy', 'breast-conserving', 'breast conserving surgery'],
        allowedPhases: ['immediate', 'surgical', 'followup'],
        urgencyNote: 'WLE + sentinel lymph node biopsy. Post-op adjuvant radiotherapy (mandatory after BCS). Oncology MDT plan.',
        planPrefix:
          '## Breast Conservation — Wide Local Excision + SLNB\n\n' +
          'WLE with oncoplastic reconstruction if needed. Sentinel lymph node biopsy (blue dye ± radioisotope).\n' +
          'Post-op adjuvant radiotherapy mandatory. Oncology MDT for systemic therapy plan.\n\n',
      },
      {
        id: 'breast_mastectomy',
        label: 'Mastectomy (simple or modified radical)',
        description: 'Mastectomy for multifocal cancer, DCIS, or patient preference',
        detectKeywords: ['mastectomy', 'modified radical mastectomy', 'simple mastectomy', 'total mastectomy', 'bilateral mastectomy', 'prophylactic mastectomy', 'dcis'],
        allowedPhases: ['immediate', 'surgical', 'followup'],
        urgencyNote: 'Mastectomy ± immediate reconstruction. Sentinel/axillary node staging. Oncology MDT referral.',
        planPrefix:
          '## Mastectomy\n\n' +
          'Mastectomy (simple / modified radical) ± immediate reconstruction (implant / pedicled flap / free flap).\n' +
          'Sentinel lymph node biopsy (or ALND if nodes positive).\n' +
          'Oncology MDT for systemic therapy, radiotherapy, and hormonal therapy planning.\n\n',
      },
    ],
  },

  // ── Thyroid ─────────────────────────────────────────────────────────────────
  {
    baseDiagnosis: 'Thyroid',
    icdPrefixes: ['C73', 'D34', 'D44', 'E04', 'E05'],
    diseaseIds: ['thyroid_cancer', 'thyroid_nodule', 'thyroid'],
    differentiatorQuery: 'Malignant vs benign? Bethesda category? Planned extent of resection?',
    variants: [
      {
        id: 'thyroid_hemithyroidectomy',
        label: 'Hemithyroidectomy (diagnostic / solitary nodule)',
        description: 'Bethesda III–V, solitary nodule, low risk — diagnostic hemithyroidectomy',
        detectKeywords: ['hemithyroidectomy', 'hemi-thyroidectomy', 'lobectomy thyroid', 'thyroid lobectomy', 'solitary nodule', 'bethesda iii', 'bethesda iv', 'bethesda v', 'bethesda 5'],
        allowedPhases: ['immediate', 'surgical', 'followup'],
        urgencyNote: 'Hemithyroidectomy (lobectomy ± isthmus). Intraoperative RLN monitoring. Completion thyroidectomy if malignancy confirmed on histology.',
        planPrefix:
          '## Hemithyroidectomy\n\n' +
          'Hemithyroidectomy (ipsilateral lobe + isthmus). Intraoperative recurrent laryngeal nerve neuromonitoring.\n' +
          'Pre-op laryngoscopy if hoarse. Post-op: monitor for haematoma (early complication), hypocalcaemia, RLN injury.\n\n',
      },
      {
        id: 'thyroid_total',
        label: 'Total thyroidectomy (malignancy / bilateral disease)',
        description: 'Papillary / follicular / medullary cancer, bilateral MNG, Graves',
        detectKeywords: ['total thyroidectomy', 'thyroidectomy', 'papillary thyroid cancer', 'follicular thyroid cancer', 'medullary thyroid', 'bilateral goitre', 'graves disease thyroid'],
        allowedPhases: ['immediate', 'surgical', 'followup'],
        urgencyNote: 'Total thyroidectomy ± central compartment node dissection. Lifelong levothyroxine post-op. Monitor calcium closely (parathyroid at risk).',
        planPrefix:
          '## Total Thyroidectomy\n\n' +
          'Total thyroidectomy ± central compartment neck dissection (level VI) for confirmed malignancy.\n' +
          'Intraoperative RLN monitoring. Post-op: levothyroxine replacement (lifelong). Monitor calcium × 24 h — oral calcium if symptomatic hypocalcaemia.\n\n',
      },
    ],
  },
];

/** Detect the matching DxVariantGroup and the best variant from the assessment text. */
export function detectDxVariants(
  assessment: string,
  icdCode?: string | null,
  diseaseId?: string | null,
): { group: DxVariantGroup; detectedVariant: DxVariant | null } | null {
  if (!assessment && !icdCode && !diseaseId) return null;
  const lower = assessment.toLowerCase();

  const group = DX_VARIANT_GROUPS.find(g => {
    if (diseaseId && g.diseaseIds.some(id => diseaseId.startsWith(id))) return true;
    if (icdCode) {
      const code = icdCode.split(' ')[0];
      if (g.icdPrefixes.some(pfx => code.startsWith(pfx))) return true;
    }
    return lower.includes(g.baseDiagnosis.toLowerCase());
  });

  if (!group) return null;

  // Find the best variant — earlier entries in the array take precedence,
  // so order from most-specific to least-specific within each group.
  const detectedVariant = group.variants.find(v =>
    v.detectKeywords.some(kw => lower.includes(kw.toLowerCase()))
  ) ?? null;

  return { group, detectedVariant };
}
