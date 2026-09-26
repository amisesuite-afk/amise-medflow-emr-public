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

import { containsAffirmed, findAllAffirmed } from '@workspace/triage-engine';

/**
 * Content version of the variant table (clinical-content/registry.json → "dx-variants").
 * Bump it with a changelog entry whenever keywords, phases, prefixes or notes change.
 */
export const DX_VARIANTS_VERSION = '1.0.0';

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
  /**
   * pane-engine disease IDs that match this group — checked via
   * `diseaseId.startsWith(id)` in detectDxVariants(), before the icdPrefixes
   * fallback. Must be verified against the real ids in
   * lib/pane-engine/src/vademecum/specialties/*.ts, not guessed — an entry
   * that doesn't match any real diseaseId silently falls through to the ICD
   * check instead of erroring, so a wrong value here is easy to miss.
   */
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
    diseaseIds: ['appendicitis', 'appendix_mass'],
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
          'Appendicular Phlegmon — Non-Operative Management\n\n' +
          'Indication: phlegmon / inflammatory mass (>72 h), no free perforation or generalised peritonitis.\n' +
          'IV antibiotics + close serial clinical review. Interval appendicectomy planned at 6–8 weeks.\n' +
          'If deterioration / abscess develops: CT-guided drainage or operative intervention.\n\n',
      },
      {
        id: 'appendicitis_abscess',
        label: 'Appendicular abscess',
        description: 'CT-confirmed pericaecal / pelvic abscess — drainage first',
        detectKeywords: ['appendicular abscess', 'appendix abscess', 'appendiceal abscess', 'pericaecal abscess', 'pericecal abscess', 'periappendiceal abscess', 'periappendicular abscess', 'abscess'],
        allowedPhases: ['immediate', 'conservative'],
        examQueries: ['Abscess confirmed on CT?', 'Abscess >4 cm?', 'Interventional radiology available?'],
        urgencyNote: 'CT-guided percutaneous drainage (IR referral) for accessible abscess ≥4 cm. IV antibiotics. Interval appendicectomy 6–8 weeks. Colonoscopy if age >40.',
        planPrefix:
          'Appendicular Abscess — Source Control + Interval Surgery\n\n' +
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
          'Perforated Appendicitis — Localised Peritonitis (K35.30)\n\n' +
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
          'EMERGENCY — Perforated Appendicitis with Generalised Peritonitis (K35.20)\n\n' +
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
    diseaseIds: ['cholecystitis'],
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
        allowedPhases: ['immediate', 'conservative', 'surgical', 'followup'],
        examQueries: ['Septic shock?', 'Renal impairment?', 'Altered consciousness?', 'Respiratory failure?'],
        urgencyNote: 'Tokyo Grade III — ICU resuscitation first. Percutaneous cholecystostomy for source control. Delayed laparoscopic cholecystectomy when systemically stable.',
        planPrefix:
          'Severe Cholecystitis — Tokyo Grade III — Source Control First\n\n' +
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
        detectKeywords: ['mild cholangitis', 'mild acute cholangitis', 'grade i cholangitis', 'grade 1 cholangitis', 'ascending cholangitis grade i', 'ascending cholangitis', 'charcot triad', "charcot's triad", 'grade i', 'grade 1', 'tg18 grade i', 'tokyo grade i', 'tokyo grade 1'],
        allowedPhases: ['immediate', 'conservative', 'followup'],
        examQueries: ['Charcots triad (fever/jaundice/pain)?', 'Responding to antibiotics?', 'No organ dysfunction?'],
        urgencyNote: 'Tokyo Grade I — IV antibiotics; biliary drainage (ERCP) if there is no response within 24 h, and treatment of the cause (e.g. CBD stone) (TG18).',
      },
      {
        id: 'cholangitis_grade2',
        label: 'Moderate — Tokyo Grade II',
        description: 'Not responding to initial therapy within 24 h — ERCP within 24 h',
        detectKeywords: ['moderate cholangitis', 'moderate acute cholangitis', 'grade ii cholangitis', 'grade 2 cholangitis', 'tokyo grade ii cholangitis', 'grade ii', 'grade 2', 'tg18 grade ii', 'tokyo grade ii', 'tokyo grade 2'],
        allowedPhases: ['immediate', 'surgical', 'followup'],
        examQueries: ['Not improving on antibiotics?', 'WBC >12 or <4?', 'Bilirubin >85 μmol/L?'],
        urgencyNote: 'Tokyo Grade II — ERCP within 24 h (endoscopic biliary drainage). IV pip-tazo. Biliary stent or stone extraction.',
      },
      {
        id: 'cholangitis_grade3',
        label: 'Severe — Tokyo Grade III — EMERGENCY',
        description: 'Organ dysfunction — cardiovascular / neurological / respiratory / renal / hepatic / haematological',
        detectKeywords: ['severe cholangitis', 'severe acute cholangitis', 'grade iii cholangitis', 'grade 3 cholangitis', 'reynolds pentad', "reynolds' pentad", 'septic shock cholangitis', 'grade iii', 'grade 3', 'tg18 grade iii', 'tokyo grade iii', 'tokyo grade 3'],
        allowedPhases: ['immediate', 'surgical'],
        examQueries: ['Hypotension / shock?', 'Altered consciousness?', 'Renal failure?'],
        urgencyNote: '⚠ EMERGENCY — Tokyo Grade III. Immediate ICU resuscitation. Urgent ERCP (within hours) for biliary decompression. Anaesthetic review.',
        planPrefix:
          'EMERGENCY — Severe Cholangitis (Tokyo Grade III)\n\n' +
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
    diseaseIds: [
      'inguinal_hernia', 'femoral_hernia', 'umbilical_hernia', 'incisional_hernia',
      'incisional_hernia_early', 'epigastric_hernia', 'spigelian_hernia',
      'parastomal_hernia', 'sportsmans_hernia', 'obturator_hernia',
    ],
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
          'Elective Hernia Repair\n\n' +
          'Pre-operative assessment and consent. Day-case laparoscopic repair preferred. Antibiotic prophylaxis at induction (cefazolin 1–2 g IV).\n\n',
      },
      {
        id: 'hernia_incarcerated',
        label: 'Irreducible / incarcerated hernia',
        description: 'Not reducible but no signs of strangulation — attempt gentle reduction',
        detectKeywords: ['irreducible', 'incarcerated', 'cannot reduce', 'non-reducible', 'obstructed hernia', 'obstructed', 'obstruction'],
        allowedPhases: ['immediate', 'conservative', 'surgical', 'followup'],
        examQueries: ['Tender but no peritonism?', 'Bowel sounds present?', 'Reducing with sedation / Trendelenburg?'],
        urgencyNote: 'Do not attempt reduction if strangulation is suspected (skin change, peritonism, fever, raised lactate or WCC, bowel obstruction) — emergency repair (WSES 2017). Only when strangulation is not suspected: gentle manual reduction with analgesia may be tried; if it succeeds, observe and repair semi-electively within 24–48 h; if it fails, emergency surgery.',
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
          'EMERGENCY — Strangulated Hernia\n\n' +
          'Emergency laparoscopic/open hernia repair. Assess bowel viability — resect if necrotic (primary anastomosis vs stoma based on contamination).\n' +
          'Do NOT delay for imaging if clinical peritonism is present.\n\n',
      },
    ],
  },

  // ── Bowel Obstruction ──────────────────────────────────────────────────────
  {
    baseDiagnosis: 'Bowel Obstruction',
    icdPrefixes: ['K56'],
    diseaseIds: ['bowel_obstruction', 'adhesion_obstruction', 'internal_hernia'],
    differentiatorQuery: 'Small vs large bowel? Any strangulation / ischaemia on CT?',
    variants: [
      {
        id: 'sbo_adhesional',
        label: 'SBO — adhesional, no strangulation (non-operative trial)',
        description: 'Small bowel obstruction, prior surgery, no peritonism, no closed-loop on CT',
        detectKeywords: ['small bowel obstruction', 'sbo', 'adhesional obstruction', 'adhesion', 'drip and suck'],
        allowedPhases: ['immediate', 'conservative', 'followup'],
        examQueries: ['Prior abdominal surgery?', 'No peritonism?', 'No closed-loop on CT?', 'Proximal obstruction?'],
        urgencyNote: '72-hour trial of non-operative management (NGT + IV fluids + NBM). Re-assess at 24-48 h: failure to improve = operate.',
        planPrefix:
          'Small Bowel Obstruction — Non-Operative Trial\n\n' +
          'NGT on free drainage. IV fluid resuscitation. NBM. Serial clinical assessment every 4–6 h.\n' +
          'CT abdomen/pelvis to exclude closed-loop, ischaemia, or hernia.\n' +
          'Water-soluble contrast (Gastrografin) challenge: diagnostic and may be therapeutic; contrast not reaching the colon by 24 h predicts failure of non-operative management (WSES/Bologna 2017).\n' +
          'Failure criteria at 48–72 h: no resolution, worsening pain, peritonism, fever, rising lactate → operate.\n\n',
      },
      {
        id: 'sbo_failed_nonoperative',
        label: 'SBO — failed non-operative trial (surgery)',
        description: 'No contrast in the colon by 24 h, or no improvement by 48–72 h of non-operative management',
        detectKeywords: ['non-operative management has failed', 'failed non-operative management', 'failed non-operative', 'failed conservative management', 'failed conservative', 'contrast has not reached the colon', 'not reached the colon', 'no contrast in the colon'],
        allowedPhases: ['immediate', 'surgical', 'followup'],
        examQueries: ['Contrast in the colon by 24 h?', 'NG output still high at 48–72 h?', 'Signs of strangulation?'],
        urgencyNote: 'Failed non-operative management of adhesive SBO (no contrast in the colon by 24 h, or no resolution by 48–72 h) — surgery: laparoscopic or open adhesiolysis (WSES/Bologna 2017).',
        planPrefix:
          'Adhesive SBO — Failed Non-Operative Management\n\n' +
          'Surgery: laparoscopic (selected patients) or open adhesiolysis; assess bowel viability and resect non-viable bowel (WSES/Bologna 2017).\n' +
          'Do not repeat the contrast challenge.\n\n',
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
          'EMERGENCY — Strangulated Small Bowel Obstruction\n\n' +
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
        urgencyNote: 'Sigmoid volvulus — only if no ischaemia or perforation: endoscopic detorsion and decompression, then sigmoid colectomy in the same admission if fit. Caecal volvulus — surgical resection (right hemicolectomy); endoscopic detorsion is not recommended (avoid). Peritonitis, gangrene or perforation — emergency resection (ASCRS 2021).',
        planPrefix:
          'Colonic Volvulus (ASCRS 2021)\n\n' +
          'CT to confirm the site and look for ischaemia or perforation.\n' +
          'Sigmoid volvulus — only if no ischaemia, gangrene, perforation or peritonitis: endoscopic (flexible sigmoidoscopy) detorsion and decompression with a decompression tube; then sigmoid colectomy during the same admission if fit — recurrence is common.\n' +
          'Caecal volvulus: surgical resection — right hemicolectomy (primary anastomosis or ileostomy according to physiology); endoscopic detorsion is not recommended for caecal volvulus (avoid).\n' +
          'Peritonitis, gangrenous or perforated colon, or failed detorsion: emergency resection (sigmoid colectomy / Hartmann\'s procedure, or right hemicolectomy).\n\n',
      },
      {
        id: 'lbo_malignant',
        label: 'Large bowel obstruction — malignant',
        description: 'CT-confirmed LBO from colonic tumour, no free perforation',
        detectKeywords: ['large bowel obstruction', 'lbo', 'colonic obstruction', 'sigmoid obstruction', 'colonic cancer obstruction'],
        allowedPhases: ['immediate', 'surgical', 'followup'],
        examQueries: ['CT confirms colonic malignancy?', 'Caecal distension ≥12 cm?', 'Free perforation?'],
        urgencyNote: 'Malignant LBO — no stent with perforation, peritonitis or impending caecal perforation (caecal tenderness / ischaemia): emergency resection. Left-sided obstruction without these: SEMS as a bridge to surgery is an option where expertise exists — not if perforation or ischaemia (WSES 2018; ESGE 2020). Colorectal / oncology MDT.',
        planPrefix:
          'Large Bowel Obstruction — Malignant\n\n' +
          'CT staging. Colorectal/Oncology MDT referral.\n' +
          'Stent (SEMS) contraindicated with perforation, peritonitis or impending caecal perforation (tender, dilated caecum — ischaemia): emergency resection instead (WSES 2018; ESGE 2020).\n' +
          'Right-sided / transverse obstruction: right (or extended right) hemicolectomy with primary anastomosis when physiology allows.\n' +
          'Left-sided obstruction: resection (Hartmann\'s procedure, or primary anastomosis ± defunctioning stoma), SEMS as a bridge to elective resection where expertise exists (not if perforation, ischaemia or peritonitis), or a defunctioning colostomy; palliative SEMS for incurable disease.\n' +
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
        detectKeywords: ['uncomplicated diverticulitis', 'uncomplicated acute diverticulitis', 'uncomplicated sigmoid diverticulitis', 'uncomplicated acute sigmoid diverticulitis', 'uncomplicated', 'mild diverticulitis', 'diverticulitis without abscess', 'hinchey 0', 'hinchey ia', 'lif pain', 'left iliac fossa pain', 'left lower quadrant pain', 'llq pain'],
        allowedPhases: ['conservative', 'followup'],
        examQueries: ['No peritonism?', 'Tolerating oral fluids?', 'CT confirms no abscess / perforation?'],
        urgencyNote: 'Systemically well and immunocompetent: antibiotics not routinely needed — analgesia, oral fluids, safety-net and review (NICE NG147 2019). Antibiotics only if systemically unwell, immunosuppressed or with significant comorbidity.',
        planPrefix:
          'Uncomplicated Acute Diverticulitis (NICE NG147 2019)\n\n' +
          'Systemically well, immunocompetent: antibiotics not routinely needed — paracetamol (avoid NSAIDs and, where possible, opioids), clear fluids then diet as tolerated, safety-net advice, review within 48 h or sooner if worse.\n' +
          'Antibiotics only if systemically unwell, immunosuppressed or with significant comorbidity: co-amoxiclav 500/125 mg TDS for 5 days (penicillin allergy: cefalexin + metronidazole, trimethoprim + metronidazole, or ciprofloxacin + metronidazole — NICE NG147).\n' +
          'Colonic evaluation (colonoscopy or CT colonography) after resolution if not recently done, to exclude colorectal cancer.\n\n',
      },
      {
        id: 'diverticulitis_abscess',
        label: 'Complicated — Hinchey I/II (pericolic / pelvic abscess)',
        description: 'Pericolic (I) or distant (II) abscess confirmed on CT',
        detectKeywords: ['hinchey i', 'hinchey ib', 'hinchey ii', 'hinchey 1', 'hinchey 1b', 'hinchey 2', 'pericolic abscess', 'pelvic abscess', 'diverticular abscess', 'complicated diverticulitis'],
        allowedPhases: ['immediate', 'conservative', 'followup'],
        examQueries: ['CT confirms abscess?', 'Abscess ≥4 cm (consider drainage)?', 'Not responding to antibiotics?'],
        urgencyNote: 'IV antibiotics + CT-guided drainage if abscess ≥4 cm. Interval sigmoid colectomy 6–8 weeks after resolution.',
        planPrefix:
          'Complicated Diverticulitis — Abscess (Hinchey I/II)\n\n' +
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
          'EMERGENCY — Perforated Diverticulitis (Hinchey III/IV)\n\n' +
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
    diseaseIds: ['pancreatitis'],
    differentiatorQuery: 'Atlanta severity — mild, moderately severe, or severe?',
    variants: [
      {
        id: 'pancreatitis_mild',
        label: 'Mild acute pancreatitis (Atlanta 2012)',
        description: 'No organ failure, no local complications, BISAP ≤1, CRP <150',
        detectKeywords: ['mild pancreatitis', 'mild acute pancreatitis', 'mild acute biliary pancreatitis', 'mild biliary pancreatitis', 'mild gallstone pancreatitis', 'uncomplicated pancreatitis'],
        allowedPhases: ['immediate', 'conservative', 'followup'],
        examQueries: ['No organ dysfunction?', 'Tolerating oral fluids within 24 h?', 'BISAP score ≤1?'],
        urgencyNote: 'Supportive management. Oral diet as tolerated. Identify and address aetiology (gallstones → cholecystectomy same admission if mild).',
        planPrefix:
          'Mild Acute Pancreatitis — Supportive Management\n\n' +
          'Moderate, goal-directed IV fluids (lactated Ringer\'s / Hartmann\'s) — avoid aggressive fluids (WATERFALL 2022; ACG 2024). Pain control. Early oral feeding as tolerated. No prophylactic antibiotics.\n' +
          'Address aetiology: USS (gallstones → laparoscopic cholecystectomy same admission if mild pancreatitis).\n\n',
      },
      {
        id: 'pancreatitis_moderate',
        label: 'Moderately severe acute pancreatitis',
        description: 'Transient organ failure (<48 h) or local complications (peripancreatic fluid, necrosis) without persistent failure',
        detectKeywords: ['moderately severe pancreatitis', 'moderately severe acute pancreatitis', 'moderately severe', 'moderate pancreatitis', 'pancreatic necrosis', 'peripancreatic', 'necrotic pancreatitis', 'walled-off necrosis', 'acute necrotic collection', 'necrotic collection'],
        allowedPhases: ['immediate', 'conservative', 'followup'],
        examQueries: ['Transient organ failure?', 'Peripancreatic fluid on CT?', 'CRP >150?', 'CT severity index?'],
        urgencyNote: 'HDU if organ failure. Moderate, goal-directed IV fluids — avoid aggressive fluids (WATERFALL 2022; ACG 2024). CT at 72–96 h if not improving. No prophylactic antibiotics — only for suspected infected necrosis. Defer cholecystectomy until collections resolve or beyond 6 weeks (IAP/APA; ACG 2024).',
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
          'Severe Acute Pancreatitis — ICU Level Care\n\n' +
          'ICU admission. Goal-directed resuscitation with moderate fluids — avoid aggressive fluids (WATERFALL 2022; ACG 2024). Enteral feeding via NGT/NJT within 24–48 h (superior to TPN).\n' +
          'Carbapenem antibiotics (meropenem) ONLY if infected necrosis suspected (fever + gas in necrotic area on CT).\n' +
          'Necrosectomy: step-up approach (endoscopic > percutaneous > surgical) — delayed ≥4 weeks until walled-off.\n\n',
      },
    ],
  },

  // ── Upper GI Bleed ──────────────────────────────────────────────────────────
  {
    baseDiagnosis: 'Upper GI Bleed',
    icdPrefixes: ['K25', 'K26', 'K27', 'K28', 'I85', 'K92'],
    diseaseIds: ['upper_gi_bleed', 'peptic_ulcer'],
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
          'Non-Variceal Upper GI Bleed\n\n' +
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
        urgencyNote: '⚠ EMERGENCY — variceal haemorrhage. Vasoactive drug (terlipressin) as soon as suspected, antibiotic prophylaxis (ceftriaxone), restrictive transfusion (Hb threshold 70 g/L, target 70–80 g/L), OGD within 12 h + band ligation (Baveno VII).',
        planPrefix:
          'EMERGENCY — Variceal Upper GI Bleed (Baveno VII 2022)\n\n' +
          'Terlipressin 2 mg IV 4-hourly (or octreotide) as soon as variceal bleeding is suspected, for 2–5 days. Ceftriaxone 1 g IV daily prophylaxis for up to 7 days.\n' +
          'Restrictive red-cell transfusion: threshold Hb 70 g/L, target 70–80 g/L — avoid over-transfusion.\n' +
          'OGD within 12 h of presentation: endoscopic variceal ligation (EVL), or cyanoacrylate glue for gastric varices.\n' +
          'High risk of failure (Child-Pugh C 10–13, or B > 7 with active bleeding at endoscopy): pre-emptive TIPS within 72 h. Refractory bleeding: balloon tamponade or oesophageal stent as a bridge to rescue TIPS.\n\n',
      },
    ],
  },

  // ── Breast ──────────────────────────────────────────────────────────────────
  {
    baseDiagnosis: 'Breast',
    icdPrefixes: ['C50', 'D05', 'N60', 'N61', 'N62', 'N63'],
    diseaseIds: ['invasive_ductal_carcinoma', 'dcis'],
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
        id: 'breast_inflammatory',
        label: 'Inflammatory breast cancer (T4d) — neoadjuvant first',
        description: 'Erythema and oedema / peau d\'orange over ≥ 1/3 of the breast — systemic therapy before any surgery',
        detectKeywords: ['inflammatory breast cancer', 'inflammatory breast carcinoma', 'inflammatory carcinoma', "peau d'orange", 'peau d orange', 't4d'],
        allowedPhases: ['immediate', 'conservative', 'followup'],
        urgencyNote: 'Inflammatory breast cancer — urgent core and skin punch biopsy, staging, breast MDT for neoadjuvant systemic therapy. Breast-conserving surgery and sentinel node biopsy are not recommended (NCCN 2024).',
        planPrefix:
          'Inflammatory Breast Cancer (T4d) — Neoadjuvant Therapy First (NCCN 2024)\n\n' +
          'Urgent core biopsy + skin punch biopsy; staging (CT chest/abdomen/pelvis ± bone scan / PET-CT). Breast MDT.\n' +
          'Neoadjuvant systemic therapy, then modified radical mastectomy with axillary node dissection and post-mastectomy radiotherapy.\n' +
          'Wide local excision and sentinel node biopsy are not recommended in inflammatory breast cancer.\n\n',
      },
      {
        id: 'breast_wle',
        label: 'Breast conservation — wide local excision + sentinel node',
        description: 'Early breast cancer suitable for breast-conserving surgery',
        detectKeywords: ['wide local excision', 'wle', 'breast conservation', 'lumpectomy', 'breast-conserving', 'breast conserving surgery'],
        allowedPhases: ['immediate', 'surgical', 'followup'],
        urgencyNote: 'WLE + sentinel lymph node biopsy. Post-op adjuvant radiotherapy (mandatory after BCS). Oncology MDT plan.',
        planPrefix:
          'Breast Conservation — Wide Local Excision + SLNB\n\n' +
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
          'Mastectomy\n\n' +
          'Mastectomy (simple / modified radical) ± immediate reconstruction (implant / pedicled flap / free flap).\n' +
          'Sentinel lymph node biopsy (or ALND if nodes positive).\n' +
          'Oncology MDT for systemic therapy, radiotherapy, and hormonal therapy planning.\n\n',
      },
    ],
  },

  // ── Thyroid ─────────────────────────────────────────────────────────────────
  {
    baseDiagnosis: 'Thyroid',
    icdPrefixes: ['C73', 'D34', 'D44.0', 'E04', 'E05'],
    diseaseIds: ['thyroid_carcinoma', 'thyroid_nodule_benign', 'hyperthyroidism'],
    differentiatorQuery: 'Malignant vs benign? Bethesda category? Planned extent of resection?',
    variants: [
      {
        id: 'thyroid_bethesda_nondiagnostic',
        label: 'Bethesda I — non-diagnostic FNA',
        description: 'Non-diagnostic cytology — repeat FNA; no operative plan on this result',
        detectKeywords: ['bethesda i', 'bethesda 1', 'non-diagnostic fna', 'nondiagnostic fna', 'non-diagnostic cytology', 'thy1'],
        allowedPhases: ['immediate', 'conservative', 'followup'],
        urgencyNote: 'Bethesda I — repeat ultrasound-guided FNA; if repeatedly non-diagnostic, ultrasound surveillance or diagnostic hemithyroidectomy by ultrasound risk (ATA 2015; BTA 2014). No thyroidectomy plan on a non-diagnostic result.',
        planPrefix:
          'Thyroid Nodule — Bethesda I (non-diagnostic)\n\n' +
          'Repeat ultrasound-guided FNA (on-site adequacy assessment if available).\n' +
          'If repeatedly non-diagnostic: ultrasound surveillance or diagnostic hemithyroidectomy according to the ultrasound pattern (ATA 2015; BTA 2014).\n\n',
      },
      {
        id: 'thyroid_bethesda_benign',
        label: 'Bethesda II — benign FNA (surveillance)',
        description: 'Benign cytology — no surgery for the nodule; ultrasound follow-up',
        detectKeywords: ['bethesda ii', 'bethesda 2', 'benign follicular nodule', 'benign fna', 'benign cytology', 'thy2'],
        allowedPhases: ['conservative', 'followup'],
        urgencyNote: 'Bethesda II — no surgery for the nodule; clinical and ultrasound follow-up by ultrasound pattern (ATA 2015). Surgery only for compressive symptoms, significant growth or patient preference.',
        planPrefix:
          'Thyroid Nodule — Bethesda II (benign)\n\n' +
          'Surveillance: clinical review and repeat ultrasound (interval by ultrasound pattern, typically 12–24 months — ATA 2015); repeat FNA only for significant growth or new suspicious features.\n\n',
      },
      {
        id: 'thyroid_hemithyroidectomy',
        label: 'Hemithyroidectomy (diagnostic / solitary nodule)',
        description: 'Bethesda III–V, solitary nodule, low risk — diagnostic hemithyroidectomy',
        detectKeywords: ['hemithyroidectomy', 'hemi-thyroidectomy', 'lobectomy thyroid', 'thyroid lobectomy', 'solitary nodule', 'bethesda iii', 'bethesda iv', 'bethesda v', 'bethesda 5'],
        allowedPhases: ['immediate', 'surgical', 'followup'],
        urgencyNote: 'Hemithyroidectomy (lobectomy ± isthmus). Intraoperative RLN monitoring. Completion thyroidectomy if malignancy confirmed on histology.',
        planPrefix:
          'Hemithyroidectomy\n\n' +
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
          'Total Thyroidectomy\n\n' +
          'Total thyroidectomy ± central compartment neck dissection (level VI) for confirmed malignancy.\n' +
          'Intraoperative RLN monitoring. Post-op: levothyroxine replacement (lifelong). Monitor calcium × 24 h — oral calcium if symptomatic hypocalcaemia.\n\n',
      },
    ],
  },
];

// ── Keyword matching ──────────────────────────────────────────────────────────
//
// Keywords are matched as whole words/phrases and negation-aware (lib/triage-engine/src/
// negation.ts). Plain substring matching read "irreducible inguinal hernia" as the keyword
// "reducible inguinal", "Hinchey III" as "hinchey i", "Bethesda VI" as "bethesda v",
// "parathyroidectomy" as "thyroidectomy", and "No cholangitis" as cholangitis.

/** A severity keyword qualified by a degree word is a different category: "moderately severe". */
const DEGREE_MODIFIER_BEFORE = /\b(?:moderately|mildly)[\s-]+$/;
/** "strangulation risk", "risk of strangulation": the finding is not present, only a risk. */
const RISK_BEFORE = /\b(?:risk|risks)\s+of\s+(?:\w+\s+)?$/;
const RISK_AFTER = /^\s+risk\b/;
/** "one Grade II criterion": a criterion of a grade is not the grade itself. */
const CRITERION_AFTER = /^\s*\(?\s*criteri\w*/;

/** Words of the group's base diagnosis, which say nothing about the variant. */
function baseWords(group: DxVariantGroup): Set<string> {
  return new Set(group.baseDiagnosis.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
}

/**
 * How specific a keyword is for choosing a variant: its length in words, not counting the words
 * of the group's base diagnosis ("tokyo grade iii" → 3 is more specific than "cholecystitis" → 0;
 * "small bowel obstruction" → 1 says little more than "bowel obstruction").
 */
function keywordSpecificity(kw: string, base: Set<string>): number {
  return kw.toLowerCase().split(/\s+/).filter(w => w && !base.has(w)).length;
}

/** True when `kw` appears in `text` as an affirmed whole-word mention of a present finding. */
function keywordPresent(text: string, kw: string): boolean {
  const lower = text.toLowerCase();
  return findAllAffirmed(text, kw, { wholeWord: true }).some(m => {
    const before = lower.slice(Math.max(0, m.index - 40), m.index);
    const after = lower.slice(m.index + m.text.length, m.index + m.text.length + 12);
    if (/^severe\b/.test(m.text) && DEGREE_MODIFIER_BEFORE.test(before)) return false;
    if (RISK_BEFORE.test(before) || RISK_AFTER.test(after)) return false;
    if (CRITERION_AFTER.test(after)) return false;
    return true;
  });
}

/**
 * Detect the matching DxVariantGroup and the best variant from the assessment text.
 *
 * Group: the working diagnosis's disease id, then its ICD-10 code, are checked across ALL groups
 * before the text fallback — a text mention in an earlier group ("…No cholangitis…") must not beat
 * the coded diagnosis (K85 pancreatitis).
 *
 * Variant: among the variants whose keywords are present, the one with the most specific
 * (longest, in words) keyword wins — see keywordSpecificity — not simply the first listed. On a
 * tie the later-listed variant wins: variants are listed from least to most severe, so a tie errs
 * towards the more severe plan ("strangulated … irreducible" → strangulated; "severe acute
 * pancreatitis … pancreatic necrosis" → severe).
 */
export function detectDxVariants(
  assessment: string,
  icdCode?: string | null,
  diseaseId?: string | null,
): { group: DxVariantGroup; detectedVariant: DxVariant | null } | null {
  if (!assessment && !icdCode && !diseaseId) return null;
  const text = assessment ?? '';
  const code = icdCode ? icdCode.split(' ')[0] : '';

  const group =
    (diseaseId ? DX_VARIANT_GROUPS.find(g => g.diseaseIds.some(id => diseaseId.startsWith(id))) : undefined)
    ?? (code ? DX_VARIANT_GROUPS.find(g => g.icdPrefixes.some(pfx => code.startsWith(pfx))) : undefined)
    // Text fallback: the base diagnosis as a whole word — "thyroidectomy" in "haematoma after total
    // thyroidectomy" must not turn a post-operative haematoma into the Thyroid group.
    ?? DX_VARIANT_GROUPS.find(g => containsAffirmed(text, g.baseDiagnosis, { wholeWord: true }));

  if (!group) return null;

  const base = baseWords(group);
  let detectedVariant: DxVariant | null = null;
  let bestScore = -1;
  for (const v of group.variants) {
    for (const kw of v.detectKeywords) {
      const score = keywordSpecificity(kw, base);
      if (score >= bestScore && keywordPresent(text, kw)) {
        detectedVariant = v;
        bestScore = score;
      }
    }
  }

  return { group, detectedVariant };
}
