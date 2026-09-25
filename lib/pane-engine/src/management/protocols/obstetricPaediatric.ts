import type { ManagementProtocol } from '../types.js';
import { OBSTETRIC_REDIRECT, PAEDIATRIC_REDIRECT } from './shared.js';

/**
 * Obstetric and paediatric emergencies and safeguarding (clinical validation 2026-09, SURGEON-DECISIONS
 * B10, B11, G2.11, G3; owner decisions 2026-09-25: pregnancy — recognition, pregnancy-safe first
 * actions and obstetric handover; under-16s — no adult doses, infants recognised and redirected).
 * Paediatric content gives no paediatric doses: every dose is weight-based per BNFc / APLS.
 */
export const obstetricPaediatricProtocols: ManagementProtocol[] = [
  // ── Pre-eclampsia / eclampsia / HELLP ─────────────────────────────────────────────────
  {
    diseaseId: 'pre_eclampsia',
    icd10Prefixes: ['O11', 'O13', 'O14', 'O15', 'O16'],
    label: 'Hypertension in Pregnancy — Pre-eclampsia / HELLP / Eclampsia',
    kind: 'emergency',
    pregnancySpecific: true,
    guidelines: ['NICE NG133 (2019, updated 2023) hypertension in pregnancy'],
    keyPoints: [
      'Severe hypertension is ≥ 160/110 mmHg; with headache, visual disturbance, epigastric/RUQ pain, vomiting, clonus, low platelets or rising ALT/creatinine it is severe pre-eclampsia (NICE NG133).',
      'Epigastric or right upper quadrant pain after 20 weeks (or up to 6 weeks postpartum) is pre-eclampsia/HELLP until proven otherwise — not biliary colic.',
      'Magnesium sulfate for eclampsia and for severe pre-eclampsia (Collaborative Eclampsia Trial regimen, NICE NG133).',
    ],
    redFlags: [
      'Blood pressure ≥ 160/110 mmHg in pregnancy or postpartum — severe hypertension; emergency.',
      'Seizure in pregnancy or postpartum — eclampsia; magnesium sulfate.',
      'HELLP: haemolysis, raised liver enzymes, low platelets — obstetric emergency.',
    ],
    investigations: [
      { label: 'BP every 15 min until < 160/110; urine protein:creatinine ratio (proteinuria)', urgency: 'stat', tier: 1, category: 'bedside' },
      { label: 'FBC (platelets), LFTs (ALT), U&E / creatinine, LDH, coagulation', urgency: 'stat', tier: 1, category: 'bloods' },
      { label: 'Fetal assessment: CTG and ultrasound (growth, liquor, Doppler) by the obstetric team', urgency: 'stat', tier: 2, category: 'other', onlyIf: 'pregnant' },
    ],
    management: [
      { phase: 'immediate', step: OBSTETRIC_REDIRECT },
      { phase: 'immediate', step: 'Treat severe hypertension: labetalol (oral or IV) first line; nifedipine or IV hydralazine as alternatives — target BP ≤ 135/85 mmHg (NICE NG133).' },
      { phase: 'immediate', step: 'Eclampsia or severe pre-eclampsia: magnesium sulfate 4 g IV over 5–15 minutes, then 1 g/h for 24 h; further 2–4 g over 5–15 minutes for a recurrent seizure (Collaborative Eclampsia Trial regimen, NICE NG133). Monitor reflexes, respiratory rate and urine output.' },
      { phase: 'immediate', step: 'Eclamptic seizure: airway, left lateral position, oxygen; magnesium sulfate (not diazepam) first line.' },
      { phase: 'conservative', step: 'Severe pre-eclampsia: limit maintenance fluids to 80 mL/h unless there are ongoing losses (NICE NG133).' },
      { phase: 'surgical', step: 'Timing and mode of delivery by the obstetric team once the mother is stabilised (delivery is the definitive treatment).' },
      { phase: 'followup', step: 'Postpartum: continue antihypertensive treatment — choice with the obstetric team, compatible with breastfeeding (NICE NG133); pre-eclampsia can present up to 6 weeks after birth.' },
    ],
    medications: [
      { drugName: 'Labetalol', dose: 'Per NICE NG133 / local obstetric protocol', frequency: 'Oral or IV, titrated to BP', route: 'PO / IV', indication: 'Severe hypertension in pregnancy — first line', phase: 'immediate' },
      { drugName: 'Magnesium sulfate', dose: '4 g IV over 5–15 min, then 1 g/h for 24 h', frequency: 'Loading + infusion', route: 'IV (intravenous)', indication: 'Eclampsia / severe pre-eclampsia (Collaborative Eclampsia Trial regimen, NICE NG133)', phase: 'immediate' },
    ],
    referral: 'Obstetric emergency: 911 / hospital obstetric unit (maternity assessment).',
  },

  // ── Hyperemesis gravidarum ───────────────────────────────────────────────────────────
  {
    diseaseId: 'hyperemesis_gravidarum',
    icd10Prefixes: ['O21'],
    label: 'Hyperemesis Gravidarum',
    kind: 'medical',
    pregnancySpecific: true,
    guidelines: ['RCOG Green-top Guideline 69 (2016) nausea and vomiting of pregnancy and hyperemesis gravidarum'],
    keyPoints: [
      'Confirm a viable intrauterine pregnancy on ultrasound and exclude multiple or molar pregnancy.',
      'Thiamine for every woman admitted with prolonged vomiting (Wernicke encephalopathy).',
      'IV 0.9% sodium chloride with potassium chloride; avoid dextrose-only fluids before thiamine.',
    ],
    redFlags: [
      'Ketonuria with weight loss > 5%, electrolyte imbalance, unable to keep fluids down — admission.',
      'Confusion, ataxia, eye signs — Wernicke encephalopathy.',
    ],
    investigations: [
      { label: 'Urinalysis (ketones), U&E, FBC, glucose, LFTs, TFTs', urgency: 'urgent', tier: 1, category: 'bloods' },
      { label: 'Early pregnancy ultrasound scan — viability, intrauterine, multiple or molar pregnancy', urgency: 'urgent', tier: 2, category: 'imaging-uss' },
      { label: 'PUQE score (severity)', urgency: 'urgent', tier: 1, category: 'bedside' },
    ],
    management: [
      { phase: 'immediate', step: 'IV 0.9% sodium chloride with potassium chloride in each bag, guided by daily U&E (RCOG GTG 69).' },
      { phase: 'immediate', step: 'Thiamine supplementation (oral, or IV Pabrinex if unable to take oral) for all women admitted with prolonged vomiting (RCOG GTG 69).' },
      { phase: 'immediate', step: 'Antiemetics — first line: cyclizine, prochlorperazine, promethazine or chlorpromazine; second line: metoclopramide or ondansetron (RCOG GTG 69).' },
      { phase: 'conservative', step: 'Thromboprophylaxis with LMWH for women admitted with hyperemesis unless contraindicated (RCOG GTG 69).' },
      { phase: 'followup', step: 'Early pregnancy / obstetric team follow-up; no ionising imaging is needed.' },
    ],
    referral: 'Early pregnancy / obstetric team.',
  },

  // ── Trauma in pregnancy / placental abruption ───────────────────────────────────────
  {
    diseaseId: 'trauma_in_pregnancy',
    icd10Prefixes: ['O9A.2'],
    label: 'Trauma in Pregnancy / Placental Abruption',
    kind: 'emergency',
    pregnancySpecific: true,
    guidelines: ['ATLS 10th edition (2018) trauma in pregnancy', 'RCOG Green-top Guideline 56 (2019) maternal collapse', 'BSH 2014 anti-D immunoglobulin', 'NICE PH50 (2014) domestic violence and abuse'],
    keyPoints: [
      'From 20 weeks, manual left uterine displacement or left lateral tilt relieves aortocaval compression; maternal shock may be masked.',
      'Placental abruption may be concealed: abdominal pain, uterine tenderness or hypertonus, fetal distress — with or without vaginal bleeding.',
      'Domestic abuse often starts or escalates in pregnancy — ask directly and privately.',
    ],
    redFlags: [
      'Uterine tenderness, vaginal bleeding, contractions, fetal bradycardia — abruption; emergency.',
      'Maternal tachycardia or hypotension — haemorrhage until proven otherwise.',
      'Inconsistent history of a fall — consider intimate-partner violence; safeguarding.',
    ],
    investigations: [
      { label: 'Continuous CTG / fetal heart monitoring (from about 20–24 weeks) for at least 4 h after trauma — obstetric team', urgency: 'stat', tier: 1, category: 'bedside' },
      { label: 'Kleihauer test (feto-maternal haemorrhage) and blood group / antibody screen', urgency: 'urgent', tier: 1, category: 'bloods' },
      { label: 'FBC, coagulation with fibrinogen, crossmatch', urgency: 'stat', tier: 1, category: 'bloods' },
      { label: 'FAST / obstetric ultrasound; CT when indicated for maternal injury (do not withhold needed imaging)', urgency: 'urgent', tier: 2, category: 'imaging-uss' },
    ],
    management: [
      { phase: 'immediate', step: OBSTETRIC_REDIRECT },
      { phase: 'immediate', step: 'ATLS primary survey; from 20 weeks manual left uterine displacement or 15–30° left lateral tilt (wedge under the spinal board); two large-bore cannulae; oxygen.' },
      { phase: 'immediate', step: 'Obstetric team involvement immediately; continuous fetal monitoring (CTG) from viability.' },
      { phase: 'immediate', step: 'RhD-negative: anti-D immunoglobulin within 72 h, dose guided by the Kleihauer test (BSH 2014).' },
      { phase: 'surgical', step: 'Abruption with fetal compromise or maternal instability: emergency delivery per obstetric team; massive haemorrhage protocol.' },
      { phase: 'followup', step: 'Domestic abuse: ask directly in private; safety plan; refer to domestic abuse / safeguarding services with consent (NICE PH50) — the practice to supply local contacts.' },
    ],
    referral: 'Obstetric emergency (hospital obstetric unit) + trauma team.',
  },

  // ── Intussusception ─────────────────────────────────────────────────────────────────
  {
    diseaseId: 'intussusception',
    icd10Prefixes: ['K56.1'],
    label: 'Intussusception (child; adult branch)',
    kind: 'emergency',
    paediatricDosing: true,
    guidelines: ['APLS 6th edition (2016) — resuscitation; reduction technique per local paediatric radiology/surgery (guideline to be confirmed by the surgeon)'],
    keyPoints: [
      'Typically 3 months–3 years: episodic inconsolable crying with drawing up of the legs and pallor, vomiting; redcurrant-jelly stool is a late sign; lethargy may be the only sign.',
      'Ultrasound (target sign) is the first-line test.',
      'Image-guided enema reduction (air/pneumatic or hydrostatic) with a paediatric surgeon available; surgery if reduction fails or there is peritonitis or perforation.',
    ],
    redFlags: [
      'Shock, peritonitis, perforation — resuscitate; emergency surgery.',
      'Bilious vomiting — also consider malrotation with volvulus.',
    ],
    investigations: [
      { label: 'Ultrasound abdomen (target / pseudokidney sign)', urgency: 'stat', tier: 2, category: 'imaging-uss' },
      { label: 'Blood gas, U&E, FBC, group and save', urgency: 'urgent', tier: 1, category: 'bloods' },
    ],
    management: [
      { phase: 'immediate', step: PAEDIATRIC_REDIRECT, onlyIf: 'under-16' },
      { phase: 'immediate', step: 'IV access; fluid resuscitation with weight-based (mL/kg) crystalloid boluses per APLS, reassessing after each; nil by mouth; NG tube if vomiting.', onlyIf: 'under-16' },
      { phase: 'surgical', step: 'Adult intussusception: usually has a pathological lead point (often a neoplasm) — CT to define it; surgical resection rather than enema reduction; general surgery review (adult small-bowel obstruction principles).', onlyIf: 'adult' },
      { phase: 'surgical', step: 'Paediatric surgery review before reduction; image-guided enema reduction (pneumatic/air or hydrostatic) if there is no peritonitis, perforation or uncorrected shock.', onlyIf: 'under-16' },
      { phase: 'surgical', step: 'Operative reduction / resection if enema reduction fails or there is peritonitis or perforation.' },
      { phase: 'followup', step: 'Observe after reduction for recurrence; safety-net advice.' },
    ],
    referral: 'Emergency paediatric surgery.',
  },

  // ── Infantile hypertrophic pyloric stenosis ──────────────────────────────────────────
  {
    diseaseId: 'pyloric_stenosis',
    icd10Prefixes: ['Q40.0'],
    label: 'Infantile Hypertrophic Pyloric Stenosis',
    kind: 'emergency',
    paediatricDosing: true,
    guidelines: ['APLS 6th edition (2016)', 'Paediatric surgical practice (BAPS)'],
    keyPoints: [
      'Projectile non-bilious vomiting at 2–8 weeks, hungry after vomiting; palpable olive.',
      'Hypochloraemic hypokalaemic metabolic alkalosis — correct fluid and electrolytes BEFORE pyloromyotomy.',
      'Pyloromyotomy is never an emergency operation; resuscitation is.',
    ],
    redFlags: [
      'Dehydration, lethargy, severe alkalosis — resuscitate and correct first.',
    ],
    investigations: [
      { label: 'Ultrasound of the pylorus (muscle thickness and channel length)', urgency: 'urgent', tier: 2, category: 'imaging-uss' },
      { label: 'Capillary/venous blood gas, U&E with chloride and bicarbonate, glucose', urgency: 'stat', tier: 1, category: 'bloods' },
    ],
    management: [
      { phase: 'immediate', step: PAEDIATRIC_REDIRECT },
      { phase: 'immediate', step: 'Nil by mouth; NG tube; IV maintenance and replacement fluids with potassium, weight-based per the paediatric team — correct the alkalosis and electrolytes (chloride, bicarbonate, potassium) before surgery.' },
      { phase: 'surgical', step: 'Ramstedt pyloromyotomy (open or laparoscopic) by a paediatric surgeon once biochemistry is corrected.' },
    ],
    referral: 'Paediatric surgery.',
  },

  // ── Malrotation with midgut volvulus ─────────────────────────────────────────────────
  {
    diseaseId: 'malrotation_volvulus',
    icd10Prefixes: ['Q43.3'],
    label: 'Malrotation with Midgut Volvulus (bilious vomiting in an infant)',
    kind: 'emergency',
    paediatricDosing: true,
    guidelines: ['APLS 6th edition (2016)', 'Paediatric surgical practice (BAPS)'],
    keyPoints: [
      'Bilious (green) vomiting in a neonate or infant is malrotation with volvulus until proven otherwise — a surgical emergency (ischaemic midgut within hours).',
      'Upper GI contrast study is the diagnostic test in a stable child; do not delay surgery for imaging if peritonitis or shock.',
    ],
    redFlags: [
      'Bilious vomiting, abdominal distension, blood per rectum, shock — emergency laparotomy.',
    ],
    investigations: [
      { label: 'Urgent upper GI contrast study (duodenojejunal flexure position)', urgency: 'stat', tier: 2, category: 'imaging-xr' },
      { label: 'Blood gas with lactate, U&E, FBC, glucose, group and save', urgency: 'stat', tier: 1, category: 'bloods' },
    ],
    management: [
      { phase: 'immediate', step: PAEDIATRIC_REDIRECT },
      { phase: 'immediate', step: 'Immediate paediatric surgery referral; nil by mouth; NG tube on free drainage; IV access and weight-based fluid resuscitation per APLS.' },
      { phase: 'surgical', step: 'Emergency laparotomy (Ladd procedure; detorsion; resection of non-viable bowel) by the paediatric surgeon.' },
    ],
    referral: 'Emergency paediatric surgery.',
  },

  // ── Child safeguarding ──────────────────────────────────────────────────────────────
  {
    diseaseId: 'child_safeguarding',
    icd10Prefixes: ['T74.1', 'T74.4', 'T76.1', 'T74.9', 'T76.9', 'Y07'],
    label: 'Suspected Non-accidental Injury (child safeguarding)',
    kind: 'emergency',
    paediatricDosing: true,
    guidelines: ['NICE CG89 (2009, updated 2017) child maltreatment: when to suspect', 'RCR/RCPCH 2017 imaging in suspected physical abuse'],
    keyPoints: [
      'Bruising in a non-mobile infant, patterned injuries, and immersion scalds (glove/stocking distribution, buttocks/perineum, clear tide-lines) suggest maltreatment.',
      'An explanation that is absent, inconsistent or incompatible with the child\'s development is a warning sign.',
      'The child\'s safety comes first: do not send home until a safe plan is agreed with child protection services.',
    ],
    redFlags: [
      'Suspected non-accidental injury — safeguarding / child protection referral the same day.',
      'Burns to feet, buttocks or perineum in a young child — special areas and a recognised abuse pattern.',
    ],
    investigations: [
      { label: 'Skeletal survey (children under 2 years) — RCR/RCPCH 2017', urgency: 'urgent', tier: 2, category: 'imaging-xr' },
      { label: 'CT head (infants under 1 year, or any child with neurological signs) — RCR/RCPCH 2017', urgency: 'urgent', tier: 3, category: 'imaging-ct' },
      { label: 'FBC and clotting screen (exclude a bleeding disorder); bone profile', urgency: 'urgent', tier: 1, category: 'bloods' },
    ],
    management: [
      { phase: 'immediate', step: 'Treat injuries first (burns: paediatric burns service; abdominal injury: e.g. duodenal haematoma — non-operative management with NG decompression and parenteral nutrition by paediatric surgery).' },
      { phase: 'immediate', step: 'Safeguarding: follow the local child protection procedure — same-day referral to the child protection / children\'s social care authority and the paediatric team; the practice must record its local child protection contacts.' },
      { phase: 'immediate', step: `If the child is injured or unwell: ${PAEDIATRIC_REDIRECT}` },
      { phase: 'followup', step: 'Document verbatim history, body map and photographs; inform the senior clinician; do not confront the carer.' },
    ],
    referral: 'Child protection / children\'s social care + paediatrics (same day).',
  },
  // ── Placental abruption (RCOG GTG 63) ──────────────────────────────────────────────────
  {
    diseaseId: 'placental_abruption',
    icd10Prefixes: ['O45'],
    label: 'Placental Abruption (antepartum haemorrhage)',
    kind: 'emergency',
    pregnancySpecific: true,
    guidelines: ['RCOG Green-top Guideline 63 (2011) antepartum haemorrhage', 'BSH 2014 anti-D immunoglobulin for prevention of haemolytic disease of the fetus and newborn'],
    keyPoints: [
      'Painful vaginal bleeding with a tender, tense uterus in the second half of pregnancy; bleeding can be concealed — maternal shock may exceed the visible loss (RCOG GTG 63).',
      'Ultrasound does not exclude abruption.',
      'Risk factors: hypertension / pre-eclampsia, abdominal trauma, cocaine, smoking, previous abruption.',
    ],
    redFlags: [
      'Maternal shock, or bleeding out of proportion — major obstetric haemorrhage.',
      'Coagulopathy (DIC) — check fibrinogen.',
      'Reduced fetal movements or abnormal fetal heart — obstetric emergency.',
    ],
    investigations: [
      { label: 'FBC, coagulation screen with fibrinogen, group and crossmatch, U&E, LFTs', urgency: 'stat', tier: 1, category: 'bloods' },
      { label: 'Kleihauer test (RhD-negative women)', urgency: 'urgent', tier: 1, category: 'bloods' },
    ],
    management: [
      { phase: 'immediate', step: OBSTETRIC_REDIRECT },
      { phase: 'immediate', step: 'While waiting: left lateral position (from 20 weeks), oxygen, two large-bore cannulae, bloods and crossmatch; fetal assessment by the obstetric team (RCOG GTG 63).' },
      { phase: 'conservative', step: 'RhD-negative: anti-D immunoglobulin with a Kleihauer-guided dose, via the obstetric team (BSH 2014).' },
    ],
    referral: 'Obstetric team — emergency transfer to a hospital with an obstetric unit.',
  },
  // Febrile infant and HSP are recognised by triage (another area); they get no ICD mapping here
  // because R50.9 / D69.0 also cover adults.
];
