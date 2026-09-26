/**
 * Maps the consultation record → pane-engine feature IDs (pane model 1.0.1).
 *
 * Sources, all read through record-text-match.ts (whole-word regexes only): the shared
 * negation-aware matcher (lib/triage-engine negation.ts), plus negated lists ("never had pain,
 * jaundice or fever"), family history ("mother had …") and, for symptoms and signs, historical,
 * background-operation and lay-guess mentions ("hernia repair 6 weeks ago", "awaiting repair of
 * a femoral hernia", "Mother thought it was a hernia"). A "[^.]{0,N}" gap in a rule cannot cross
 * a negation cue ("DRE: no mass"):
 *  1. CC template hints — the complaint template implies a finding (e.g. "Dysphagia" → dysphagia).
 *  2. SOCRATES answers — key-specific rules (site, radiation, character, onset, timing, triggers,
 *     relief, severity) plus the general symptom vocabulary on every answer.
 *  3. Context (optional; PaneFeatureContext): SmartSymptomPicker chips and their branch options,
 *     vital signs (fever, hypothermia, tachycardia, bradycardia, hypotension, raised / severe BP,
 *     tachypnoea, hypoxia, glucose, AVPU — age-adjusted in children), comorbidities, medicines,
 *     surgical history, resulted investigations (numeric labs and report text), examination
 *     chips and clinician free text (referral / intake text, HPI, examination notes).
 *
 * Returns Record<featureId, boolean>. Findings are only ever recorded as PRESENT, with four
 * documented exceptions ("gates"), set to ABSENT only when a full record is supplied and gives no
 * sign of them: an injury mechanism (`trauma_mechanism`; every trauma diagnosis needs one), an
 * operation in the last 30 days (`recent_surgery`; every post-operative complication needs one),
 * an aortic graft (`aortic_graft`; aorto-enteric fistula) and a stoma (`stoma`; parastomal hernia).
 *
 * Before model 1.0.0 only the CC name and SOCRATES answers were read, bleeding / dysphagia /
 * vomiting / chest-pain / neurological / urinary / pregnancy findings had no rules, "Burning"
 * always meant heartburn, "after meals" meant a fatty-food trigger, "Neck" meant a neck lump and
 * "Groin" a groin swelling (clinval C6, upper-gi 10, colorectal 19, soft-tissue mapper notes).
 * Model 1.0.1 (precision pass, docs/clinical-validation/changes/diagnostic-reasoning.md) removed
 * false features the diagnostic-reasoning panel exposed: fever in a negated list, hernia features
 * from a repaired or planned hernia, "flame haemorrhages" as a burn, "pale stools" as pallor,
 * rheumatoid arthritis as joint pain, faecal urgency as urinary, "distended neck veins" as
 * abdominal distension and others (tests: __tests__/pane-mapper-false-positives.test.ts).
 */

import { joinClauses } from '@workspace/triage-engine';
import { CURRENT_FEATURES, findRecordMatches, negationFreeGaps, notCurrentAt, recordHas, sentenceOf } from './record-text-match';
import type { RecordedEvidence } from '@workspace/pane-engine';
import { EXAM_SIGNS_KEY, recordedEvidence, withExamEvidence } from './exam-evidence-features';

type FeatureMap = Record<string, boolean>;

/** Everything else the consultation knows, beyond the CC and its SOCRATES answers. */
export interface PaneFeatureContext {
  /** Age in years (fractions for infants); used for paediatric vital-sign thresholds. */
  age?: number | null;
  sex?: string;
  /** AppContext.pregnancyPossible (selects the pregnancy BP threshold). */
  pregnancyPossible?: boolean;
  symptoms?: string[];
  symptomDetails?: Record<string, string[]>;
  vitals?: Partial<Record<'systolicBp' | 'diastolicBp' | 'heartRate' | 'temperatureC' | 'respiratoryRate' | 'spo2' | 'glucoseMmol' | 'avpu', string | number | null>>;
  /** Symptom duration in days (AppContext.durationDays). */
  durationDays?: number | null;
  isPostOp?: boolean;
  postOpDays?: number | null;
  comorbidities?: string[];
  medications?: string[];
  surgicalHistory?: string[];
  /** Investigation name → result text (labs, imaging, ECG). */
  investigationResults?: Record<string, string>;
  /** Examination chips by section. */
  examFindings?: Record<string, string[]>;
  /** Clinician free text: intake / referral text, HPI narrative, examination notes. */
  narrative?: string[];
  /**
   * Exam-step sign chips and clinician-recorded decision rules (exam-evidence-features.ts,
   * evidence-exam 1.0.0), applied last: a chip supersedes its free-text twin.
   */
  evidence?: RecordedEvidence;
}

/**
 * A mapping rule. `requires`: context that must be affirmed in the same text or the CC / symptom
 * (e.g. breast context for "hard"). `near`: context that must be affirmed in the same sentence or
 * the CC / symptom (e.g. a urinary word for a bare "urgency"). Gaps written "[^.]{0,N}" cannot
 * cross a negation cue (negationFreeGaps: "DRE: no mass" is not a rectal mass).
 */
interface Rule { pattern: RegExp; features: string[]; requires?: RegExp; near?: RegExp }
const r = (pattern: RegExp, ...features: string[]): Rule => ({ pattern: negationFreeGaps(pattern), features });
const rq = (requires: RegExp, pattern: RegExp, ...features: string[]): Rule => ({ pattern: negationFreeGaps(pattern), features, requires });
const rn = (near: RegExp, pattern: RegExp, ...features: string[]): Rule => ({ pattern: negationFreeGaps(pattern), features, near });

// ── 1. CC template hints ────────────────────────────────────────────────────────
// Keyed by the template name (substring). Hints state only what the template itself asserts;
// systemic findings (fever, vomiting) come from the record.
const CC_HINTS: Rule[] = [
  r(/appendic/i, 'rlq_pain'),
  r(/cholecyst/i, 'ruq_pain'),
  r(/biliary colic/i, 'ruq_pain', 'episodic_pain'),
  r(/choledocho|cbd stone|obstructive jaundice|\bjaundice\b/i, 'jaundice'),
  r(/cholangitis/i, 'ruq_pain', 'jaundice'),
  r(/pancreatit/i, 'epigastric_pain'),
  r(/peptic ulcer|\bpud\b/i, 'epigastric_pain'),
  r(/\bgord\b|reflux|\bgerd\b|heartburn/i, 'heartburn'),
  r(/diverticul/i, 'lif_pain'),
  r(/bowel obstruct|intestinal obstruct/i, 'abdominal_distension', 'colicky_pain'),
  r(/colorectal (cancer|malignan)|colon cancer|rectal cancer/i, 'change_bowel_habit'),
  r(/change in bowel habit/i, 'change_bowel_habit'),
  r(/rectal bleed/i, 'pr_bleeding'),
  r(/acute abdominal pain|abdominal pain/i, 'abdominal_pain'),
  r(/abdominal mass/i, 'abdominal_mass'),
  r(/nausea|vomiting/i, 'nausea_vomiting'),
  r(/upper gi bleed|haematemesis|hematemesis/i, 'upper_gi_bleeding'),
  r(/dysphagia/i, 'dysphagia'),
  r(/weight loss/i, 'weight_loss'),
  r(/inguinal|groin hernia|femoral hernia|strangulated|irreducible hernia/i, 'groin_swelling'),
  r(/irreducible|strangulated/i, 'hernia_irreducible'),
  r(/umbilical/i, 'umbilical_swelling'),
  r(/incisional|ventral hernia/i, 'incisional_swelling', 'previous_surgery'),
  r(/haemorrhoid|hemorrhoid/i, 'pr_bleeding'),
  r(/anal fissure/i, 'anal_pain'),
  r(/perianal abscess/i, 'anal_pain', 'perianal_swelling'),
  r(/pilonidal/i, 'natal_cleft'),
  r(/breast lump/i, 'breast_lump'),
  r(/breast pain|mastalgia/i, 'breast_pain'),
  r(/nipple discharge/i, 'nipple_discharge'),
  r(/thyroid|goitre|goiter/i, 'neck_lump', 'thyroid_swelling'),
  r(/neck lump|neck mass|neck swelling/i, 'neck_lump'),
  r(/soft tissue (mass|lump)|lipoma/i, 'soft_tissue_lump'),
  r(/renal colic|ureteric colic|kidney stone/i, 'loin_pain', 'colicky_pain'),
  r(/testicular|scrotal/i, 'testicular_pain'),
  r(/\bdvt\b|deep vein thrombosis/i, 'leg_swelling'),
  r(/pulmonary embolism/i, 'dyspnoea'),
  r(/peripheral arterial|\bpad\b|claudication/i, 'claudication'),
  r(/varicose/i, 'varicosities'),
  r(/diabetic foot|infected foot/i, 'foot_problem', 'known_diabetes'),
  r(/post.?op|wound concern|surgical site/i, 'previous_surgery', 'recent_surgery'),
  r(/chest pain/i, 'chest_pain'),
  r(/breathless|shortness of breath|dyspno/i, 'dyspnoea'),
  r(/headache/i, 'headache'),
  r(/\bburns?\b|scald/i, 'burn_wound'),
];

// ── 2. General symptom / sign / history vocabulary ──────────────────────────────
// Applied to symptom chips, branch options, SOCRATES answers and free text.
const NEURO_CTX = /weak|numb|speech|slurr|dysarthr|vision|visual|deficit|droop|symptom|tingl/i;
const BREAST_CTX = /breast|nipple|areola|mastalg/i;
const GROIN_CTX = /groin|inguinal|femoral/i;
const WOUND_CTX = /\bwound\b|\bincision\b|post.?op|surgical site/i;
/** An adrenal mass named in the record or an imaging report. */
const ADRENAL_MASS = /\badrenal (mass|lesion|nodule|lump|tumou?r|incidentaloma|adenoma)\b/;
const URINARY_CTX = /\burin\w*|\bmicturi\w*|\bbladder\b|\bpee\w*|\bvoid\w*|\bdysuri\w*|\bnocturia\b|\bpassing water\b|\buti\b|\bcystitis\b|\bprostat\w*/;
const LEG_SYMPTOM_CTX = /\bpain\w*|\bache\w*|\bnumb\w*|\bweak\w*|\btingl\w*|\bsciatica\b|\bparaesthesi\w*|\bpins and needles\b|\bheav(y|iness)\b|\bcramp\w*/;

const TEXT_RULES: Rule[] = [
  // Abdominal pain and site
  r(/\babdominal (pain|cramps?|discomfort)|\bpain in (the|his|her) (abdomen|tummy|belly)|\b(tummy|belly|stomach) ?ache\b/, 'abdominal_pain'),
  r(/(\b(rlq|rif)\b|right (lower quadrant|iliac fossa))(?! (scar|incision|port|drain|stoma))/, 'rlq_pain'),
  r(/(\bruq\b|right upper quadrant|right hypochondri\w*\b)(?! (scar|incision|port|drain|stoma))/, 'ruq_pain'),
  r(/\bepigastri(c|um)\b/, 'epigastric_pain'),
  r(/(\b(llq|lif)\b|left (lower quadrant|iliac fossa))(?! (scar|incision|port|drain|stoma))/, 'lif_pain'),
  r(/(\bluq\b|left upper quadrant|left hypochondri\w*\b)(?! (scar|incision|port|drain|stoma))/, 'luq_pain'),
  r(/\bperi-?umbilical\b|\baround the (navel|umbilicus|belly button)|\bcentral abdominal pain/, 'periumbilical_pain'),
  r(/\b(diffuse|generali[sz]ed) (abdominal )?(pain|tenderness|peritonitis)|\bpain all over (the|his|her) (abdomen|tummy)/, 'diffuse_abdominal_pain'),
  r(/\bsuprapubic\b/, 'suprapubic_pain'),
  r(/\bpelvic pain\b|\bpain in the pelvis\b/, 'pelvic_pain'),
  r(/\b(loin|flank) (pain|tenderness)|\bpain in (the|his|her) (left |right )?(loin|flank)|\brenal colic\b/, 'loin_pain'),
  r(/\brenal.angle tender\w*|\bcostovertebral (angle )?tender\w*|\b(loin|flank|renal angle) tenderness/, 'renal_angle_tenderness'),
  r(/\bgroin pain\b|\bpain in the groin\b/, 'groin_pain'),
  r(/\bgroin (lump|swelling|mass|bulge)|\binguinal (lump|swelling|mass|bulge)|\blump in the groin|\bgroin swelling/, 'groin_swelling'),
  r(/\bshoulder.?tip\b|\bshoulder pain\b/, 'shoulder_tip_pain'),
  r(/\bradiat\w* (through )?(in)?to (the |his |her )?back\b|\bthrough to the back\b|\binterscapular\b/, 'radiation_to_back'),
  r(/\bradiat\w*[^.]{0,20}\b(groin|testicle|testis|labia)\b/, 'radiation_to_groin'),
  r(/\bmigrat\w* (to|into) the (right|rif|rlq)|\bmoved to the (right iliac|rif|right lower)/, 'pain_migration'),
  r(/\bworse (on|with) (movement|moving|coughing|walking)|\bpain (on|with) (movement|coughing)|\blying (very )?still\b/, 'pain_worse_movement'),
  r(/\bcolick\w*|\bcomes? and goes in waves|\bwave.like|\bcramp\w*/, 'colicky_pain'),
  r(/\bepisodic\b|\bintermittent\b|\bcomes and goes\b|\battacks of\b|\bepisodes of (pain|colic|crying|screaming)\b|\bpain[^.]{0,20}\bepisodes\b/, 'episodic_pain'),
  r(/\bpost.?prandial|\bafter (eating|meals|food|a meal)|\bfear of eating|\bpost-meal/, 'postprandial_pain'),
  r(/\bfatty\b|\bgreasy\b|\bfried\b/, 'fatty_food_trigger'),
  r(/\bnocturnal pain|\bwakes? (him|her|them)? ?(up )?(at night|from sleep)|\bnight pain\b|\bworse at night\b/, 'nocturnal_pain'),
  r(/\bsudden(ly)?\b|\babrupt(ly)?\b|\bout of the blue\b|\bwithin seconds\b|\bno warning\b/, 'sudden_onset'),
  r(/\bworst (ever|pain|headache)|\bworst.ever\b|\bexcruciating\b|\b(9|10) ?\/ ?10\b/, 'severe_pain'),
  r(/\bout of proportion\b|\bpain (disproportionate|severe) (to|despite)/, 'pain_out_of_proportion'),
  r(/\bleaning forward\b|\bsitting forward\b/, 'relief_sitting_forward'),
  r(/\bworse (when |on )?lying flat\b|\blying flat\b/, 'worse_lying_flat'),
  r(/\b(on|with) straining\b|\bstraining\b|\blifting\b|\bvalsalva\b/, 'worse_straining'),

  // Chest / cardiovascular
  r(/\bchest (pain|discomfort|ache)|\bpain in (the|his|her) chest|\bretrosternal\b|\bcentral chest\b/, 'chest_pain'),
  r(/\b(crushing|pressing|squeezing|heavy|heaviness|pressure)\b[^.]{0,25}\bchest\b|\bchest\b[^.]{0,25}\b(crushing|pressure|heaviness|squeezing)\b|\bcrushing \/ pressure\b/, 'chest_pain_pressure'),
  r(/\bchest tightness|\btight(ness)? (in|across) (the|his|her) chest|\bchest (feels |felt )?tight\b/, 'chest_tightness'),
  r(/\b(radiat|spread)\w*[^.]{0,25}\b(arms?|jaw)\b|\bjaw pain\b|\bleft arm\b|\bright arm\b/, 'radiation_arm_jaw'),
  r(/(?<!night |drenching )\bsweat(s|ing|y)?\b|\bdiaphore\w*|\bclammy\b/, 'diaphoresis'),
  r(/\bclammy\b|\bpale and sweaty\b|\bgrey and sweaty\b/, 'pale_clammy'),
  r(/\btearing\b|\bripping\b/, 'tearing_pain'),
  r(/\bon exertion\b|\bexertional\b|\bwith exercise\b|\bclimbing stairs\b|\bwalking uphill\b|\bwhile (running|exercising|playing sport)/, 'exertional_symptoms'),
  r(/\bpalpitation\w*|\bheart (racing|pounding|fluttering)|\bracing heart/, 'palpitations'),
  r(/\birregularly irregular|\birregular (pulse|rhythm|heart ?beat)|\bpulse (is |was )?irregular/, 'irregular_pulse'),
  r(/\bsyncop\w*|\bcollaps\w*|\bfainted\b|\bpassed out\b|\bblacked out\b|\bloss of consciousness\b|\blost consciousness\b/, 'syncope'),
  r(/\bloss of consciousness\b|\blost consciousness\b|\bknocked out\b/, 'loss_of_consciousness'),
  r(/\bdizz\w*|\blight-?headed\w*|\bpre-?syncop\w*|\bnear-?syncop\w*|\bvertigo\b|\bfeeling faint\b/, 'dizziness'),
  r(/\bmurmur\b|\bejection systolic\b/, 'heart_murmur'),
  r(/\b(raised|elevated) jvp\b|\bjvp (is )?(raised|elevated|\d+ ?cm)|\bdistended neck veins\b/, 'raised_jvp'),
  r(/\b(bp|blood pressure)[^.]{0,30}\bdifference between (the )?arms|\b(unequal|asymmetric\w*) (bp|blood pressure|radial pulses|arm pressures)|\bradial pulse deficit\b/, 'bp_arm_difference'),
  r(/\b(ankle|leg|pedal|peripheral) (o?edema|swelling)|\bswollen (ankles|legs?)\b|\bpitting o?edema\b|\bleg swelling\b/, 'leg_swelling'),
  r(/\bbilateral\b[^.]{0,20}\b(leg|ankle|pedal|lower limb)?\s*(o?edema|swelling)|\bboth (legs|ankles)\b[^.]{0,20}\b(swollen|swelling|o?edema)|\bswollen ankles\b|\bankle o?edema\b/, 'bilateral_leg_oedema'),
  r(/\b(left|right|one) (leg|calf)\b[^.]{0,25}\b(swollen|swelling)|\bunilateral\b[^.]{0,15}\b(leg|calf|swelling|o?edema)|\bswollen (left|right) (leg|calf)/, 'unilateral_leg_swelling', 'leg_swelling'),
  r(/\bcalf (tenderness|tender)|\bcalf (is |was )?tender\b|\btender calf\b/, 'calf_tenderness'),
  r(/\b(leg|arm|limb|calf|thigh|foot) pain\b|\bpain in (the|his|her) (left |right )?(leg|arm|calf|thigh|foot)\b|\blimb pain\b/, 'limb_pain'),
  r(/\bcold (leg|foot|feet|limb|arm|hand)\b|\b(leg|foot|limb) (is |was |felt )?cold\b|\bperishingly cold\b/, 'cold_limb'),
  r(/\b(white|pale|mottled) (leg|foot|limb)\b|\b(leg|foot|limb) (is |was )?(white|pale|mottled)\b/, 'pale_limb'),
  r(/\b(absent|no|impalpable|weak|reduced|diminished|poor) (\w+ )?(pulses?|pedal pulses|foot pulses)\b(?![-\s]?ox)|\bpulses? (are |were )?(absent|impalpable|not palpable|not felt)|\bpulseless\b/, 'absent_pulses'),
  r(/\bclaudicat\w*|\bcalf pain (on|when) walking/, 'claudication'),
  r(/\brest pain\b/, 'rest_pain'),
  r(/\bpulsatile\b|\bexpansile\b/, 'pulsatile_mass'),
  r(/\bvaricos\w*/, 'varicosities'),
  r(/\b(tender|palpable|hard|red)\b[^.]{0,12}\b(cord|superficial vein)\b(?! (towards|to|into) the (anal|anus|rectum|external opening))|\bcord.like\b/, 'tender_cord'),
  r(/\b(leg|venous|arterial|non.?healing) ulcer|\bulcer (on|of) the (leg|shin|ankle|gaiter)/, 'skin_ulceration'),
  r(/\bmottl\w*|\bashen\b|\bcold peripher\w*|\bcold extremit\w*|\b(crt|capillary refill( time)?)\s*(of\s*)?(>\s*)?[3-9]\s*(s|sec|seconds)\b/, 'mottled_skin'),
  r(/\bpale\b(?! (stools?|faeces|feces|motions|urine|coloured stools?))|\bpallor\b|\bpasty\b|\bwhite as a sheet\b/, 'pallor'),
  r(/\bpapill?o?edema\b|\bretinal ha?emorrhag\w*/, 'papilloedema'),

  // Respiratory
  r(/\bshort(ness)? of breath|\bbreathless\w*|\bdyspno\w*|\bdifficulty breathing\b|\bstruggling to breathe\b|\bout of breath\b/, 'dyspnoea'),
  r(/\bsudden(ly)?\b[^.]{0,20}\b(breathless|short of breath|shortness of breath|dyspno\w*)/, 'dyspnoea_pe'),
  r(/\borthopno\w*|\bparoxysmal nocturnal|\bpnd\b|\b(two|three|four|\d) pillows\b|\bnocturnal dyspno\w*/, 'orthopnoea'),
  r(/\bcough(ing|s)?\b/, 'cough'),
  r(/\bproductive cough|\bsputum\b|\bphlegm\b/, 'productive_cough'),
  r(/\b(green|yellow|purulent|rusty)\b[^.]{0,10}\b(sputum|phlegm)/, 'purulent_sputum'),
  r(/\bha?emoptysis\b|\bcoughing (up )?blood\b/, 'haemoptysis'),
  r(/\bwheez\w*/, 'wheeze'),
  r(/\bstridor\b/, 'stridor'),
  r(/\bpleuritic\b|\bworse (on|with) (deep )?(breath\w*|inspiration)|\bpain on (deep )?(breathing|inspiration)|\bdeep breathing\b/, 'pleuritic_chest_pain'),
  r(/\bcrackles\b|\bcrepitations\b|\bcreps\b|\brales\b/, 'crackles'),
  r(/\bbronchial breath\w*|\bdull (to percussion|percussion note)|\bstony dull/, 'bronchial_breathing'),
  r(/\b(reduced|decreased|absent|diminished) (air entry|breath sounds)|\bbreath sounds (are )?(reduced|decreased|diminished|absent)/, 'reduced_breath_sounds'),
  r(/\btrachea\w* (deviat\w*|shift\w*)|\bdeviated trachea/, 'tracheal_deviation'),
  r(/\bsilent chest\b/, 'silent_chest'),
  r(/\b(unable|cannot|can'?t) (to )?(complete|finish) (full )?sentences|\bspeaking in (single )?words\b/, 'speech_breathless'),

  // Neurological
  r(/\bheadaches?\b|\bcephalgia\b/, 'headache'),
  r(/\bthunderclap\b|\bworst headache\b|\bsudden (severe |onset )?headache|\bheadache[^.]{0,30}\b(sudden|instant\w*|within seconds)|\bfirst \/ worst ever\b/, 'thunderclap_headache'),
  r(/\bneck stiffness|\bstiff neck\b|\bmeningism\b|\bkernig\w*|\bbrudzinski\w*|\bnuchal rigidity/, 'neck_stiffness'),
  r(/\bphotophobi\w*/, 'photophobia'),
  r(/\bnon-?blanching\b|\bpetechi\w*|\bpurpur\w*/, 'non_blanching_rash'),
  r(/\bpalpable purpur\w*/, 'palpable_purpura'),
  r(/\brash\b/, 'rash'),
  r(/\b(weakness|weak) (of|in) (the |his |her )?(left |right )?(arm|leg|hand|limb|side)|\b(arm|leg|limb) weakness|\bhemipar\w*|\bhemipleg\w*|\barm drift\b|\bprogressive weakness\b|\bleg weakness\b/, 'limb_weakness', 'focal_weakness'),
  r(/\bfacial (droop|weakness|palsy)|\bface (droop\w*|weakness)|\bdroop\w* (of the )?(face|mouth)|\bmouth droop/, 'facial_weakness', 'focal_weakness'),
  r(/\bslurred speech|\bslurring\b|\bdysarthri\w*|\bdysphasi\w*|\baphasi\w*|\bword.finding|\bspeech (difficult\w*|disturbance|problem)|\bdifficulty (speaking|talking)/, 'speech_disturbance'),
  r(/\bvisual (loss|disturbance|aura)|\bblurred vision|\bblurring of vision|\bdouble vision|\bdiplopia|\bloss of vision|\bvision loss|\bamaurosis|\bflashing lights|\bscotoma/, 'visual_disturbance'),
  r(/\bataxi\w*|\bincoordination\b/, 'ataxia'),
  r(/\bunsteady\b|\bunsteadiness\b|\bdifficulty walking\b|\bunable to walk\b|\bgait\b/, 'gait_disturbance'),
  rq(NEURO_CTX, /\b(resolved|recovered|settled|went away|back to normal)\b|\btransient\b|\blasted (\d+|a few|about \w+) minutes\b/, 'symptoms_resolved'),
  r(/\bnumb\w*|\btingling\b|\bpins and needles\b|\bparaesthesi\w*|\bparesthesi\w*/, 'limb_numbness'),
  r(/\bseizur\w*|\bconvuls\w*|\btonic.?clonic\b|\bhad a fit\b|\bfitting\b/, 'seizure'),
  r(/\bbit(ten)? (his|her|the) tongue\b|\btongue bit\w*/, 'tongue_bite'),
  r(/\bconfus\w*|\bdisorient\w*|\bdelirium\b|\bdelirious\b|\baltered mental|\bnot (him|her)self\b|\bdrows\w*|\bagitat\w*/, 'confusion'),
  r(/\blethargi?c\b|\blethargy\b|\bfloppy\b|\bhard to (wake|rouse)\b|\bdifficult to rouse\b/, 'lethargy'),
  r(/\bgcs\s*(of\s*)?(1[0-4]|[3-9])\b|\bunconscious\b|\bresponds (only )?to (voice|pain)\b|\bunresponsive\b/, 'gcs_drop', 'confusion'),
  r(/\bback pain\b|\bpain in (the|his|her) (lower |upper |mid )?back\b|\blumbar pain\b|\bbackache\b|\bthoracic (spine |back )?pain\b|\bspinal pain\b|\blumbar \(lower back\)|\bthoracic \(upper back\)/, 'back_pain'),
  r(/\bsciatica\b|\bpain (radiating |shooting )?down (the |both |his |her )?(left |right )?legs?\b|\bradiat\w* (down|into) (the |both )?legs?\b|\bdown leg\b/, 'sciatica'),
  rn(LEG_SYMPTOM_CTX, /\bboth legs\b|\bbilateral (leg|legs|lower limbs?)\b|\bbilateral legs\b/, 'bilateral_leg_symptoms'),
  r(/\bbilateral sciatica\b/, 'bilateral_leg_symptoms'),
  r(/\bsaddle (an)?a?esthesia|\bsaddle numbness|\bnumb\w* (in|around) (the )?(saddle|perineum|buttocks|genitals|back passage)|\bperineal numbness|\bperianal numbness/, 'saddle_anaesthesia'),
  r(/\b(reduced|lax|poor|decreased) anal tone|\banal tone (is )?(reduced|lax|decreased)/, 'reduced_anal_tone'),
  r(/\bbladder \/ bowel dysfunction\b|\bsphincter (dysfunction|disturbance)/, 'urinary_retention_symptoms'),
  r(/(?<!(flatus|faecal|fecal|bowel|anal|double|stool) )\bincontinen\w*\b(?! (of|to) (flatus|faeces|feces|stool))|\bwet (himself|herself)\b/, 'urinary_incontinence'),

  // Systemic
  r(/\bfever\w*|\bfebrile\b|\bpyrexi\w*|\bhigh temperature\b|\bhot to touch\b/, 'fever'),
  r(/\brigou?rs?\b|\bshaking chills\b|\bchills\b|\bshivering\b/, 'rigors'),
  r(/\bnight sweats?\b|\bdrenching sweats?\b/, 'night_sweats'),
  r(/\bfatigue\b|\btired\w*\b|\blethargy\b|\bmalaise\b|\bgenerali[sz]ed weakness\b|\bgenerally unwell\b|\bexhaust\w*/, 'fatigue'),
  r(/\bmuscle (aches?|pain)\b|\bmyalgi\w*/, 'myalgia'),
  r(/\bjoint (pain|swelling|swollen)|\barthralgi\w*|(?<!(rheumatoid|psoriatic|reactive|enteropathic|juvenile|inflammatory) )\barthritis\b|\bswollen (knee|ankle|joint)s?\b/, 'joint_pain'),
  r(/\bbone pain\b|\bbony pain\b/, 'bone_pain'),
  r(/\bdehydrat\w*|\bdry mucous|\bdry mouth\b|\bsunken (eyes|fontanelle)|\breduced skin turgor/, 'dehydration'),
  r(/\bpolyuri\w*|\bpolydipsi\w*|\bexcessive thirst\b|\bvery thirsty\b|\bthirst\w*|\bpassing (a lot of|lots of|large volumes of) urine/, 'polyuria_polydipsia'),
  r(/\bkussmaul\b|\bdeep sighing breath\w*|\bketotic (breath|smell)|\bpear.?drops?\b/, 'kussmaul'),
  r(/\bhypoglyc\w* (episode|attack)s?\b|\bhypo (episode|attack)s?\b|\bhypos\b/, 'low_glucose'),
  r(/\btremor\w*\b|\bshaky\b|\bshakiness\b/, 'anxiety_tremor'),
  r(/\bheat intoleran\w*/, 'heat_intolerance'),
  r(/\bcold intoleran\w*/, 'cold_intolerance'),
  r(/\bweight gain\b|\bgaining weight\b/, 'weight_gain'),
  r(/\blow mood\b|\bdepress\w*/, 'low_mood'),
  r(/\b(episodes|spells|attacks) of[^.]{0,30}\b(headache|sweating|palpitations)|\bparoxysm\w*[^.]{0,30}\b(headache|sweat\w*|palpitat\w*)/, 'paroxysmal_episodes'),
  r(/\burticari\w*|\bhives\b|\bwheals?\b|\bangio-?o?edema\b|\b(lip|lips|tongue|face|facial|throat) (swelling|swollen)|\bswollen (lips|tongue|face)|\bswelling of the (lips|tongue|face)/, 'urticaria_angioedema'),
  r(/\b(peanuts?|tree nuts?|shellfish|sesame)\b|\b(bee|wasp|insect) sting\b|\bstung\b|\bfirst dose of\b|\brecent medication\b|\bafter (taking|starting) (amoxicillin|penicillin|co-amoxiclav|an antibiotic|the antibiotic|\w+cillin)/, 'allergen_exposure'),
  r(/\bsore throat\b|\bpharyngitis\b|\btonsillitis\b|\bupper respiratory (tract )?infection\b|\burti\b/, 'sore_throat'),

  // Upper GI
  r(/\bnause\w*|\bvomit\w*|\bemesis\b|\bretching\b|\bthrowing up\b|\bbeing sick\b/, 'nausea_vomiting'),
  r(/\bbilious\b|\bgreen vomit\w*|\bbile.stained\b|\bvomit\w*[^.]{0,15}\b(green|bile)\b|\bvomiting bile\b/, 'bilious_vomiting'),
  r(/\bprojectile\b/, 'projectile_vomiting'),
  r(/\beffortless vomit\w*/, 'vomiting_effortless'),
  r(/\bundigested food\b|\bfood eaten (the day|hours|days) (before|earlier)/, 'undigested_food_vomit'),
  r(/\bhungry (after|straight after|immediately after)\b|\bwants to feed (again )?after\b/, 'hungry_after_vomiting'),
  r(/\bha?ematemesis\b|\bvomit\w* (fresh )?blood\b|\bblood[^.]{0,10}\bvomit\w*|\bcoffee.?grounds?\b/, 'haematemesis'),
  r(/\bmela?ena\b|\bblack (tarry )?stools?\b|\btarry stools?\b|\bblack,? tarry\b|\btarry\b/, 'melaena'),
  r(/\b(after|following) (he |she |they |the patient )?(forceful(ly)? |repeated(ly)? |violent(ly)? |heavy |prolonged |a bout of |an episode of )?(vomit\w*|retch\w*)|\b(vomit\w*|retch\w*)[^.]{0,30}\b(then|followed by)\b[^.]{0,25}\b(pain|blood)/, 'severe_vomiting_before_pain'),
  r(/\bheartburn\b|\bacid reflux\b|\bindigestion\b|\bdyspepsi\w*|\bacid (brash|taste)\b|\breflux\b/, 'heartburn'),
  r(/\bregurgitat\w*/, 'regurgitation'),
  r(/\bdysphagi\w*|\bdifficulty swallowing\b|\btrouble swallowing\b|\bfood (sticks|sticking|gets stuck|stuck|stuck)\b|\bcan'?t swallow\b|\bunable to swallow\b/, 'dysphagia'),
  r(/\bprogressive (dysphagia|difficulty swallowing)|\b(dysphagia|swallowing)[^.]{0,30}\b(progressive|progressing|worsening|getting worse)|\bsolids (then|and now|progressing to) liquids/, 'dysphagia_progressive'),
  r(/\b(solids and liquids|both solids and liquids|liquids as well|liquids too)\b/, 'dysphagia_liquids'),
  r(/\bdysphagia (to|for) solids|\bsolids only\b|\bsolids? stick/, 'dysphagia_solids'),
  r(/\bunable to swallow (saliva|anything|his own saliva|her own saliva)|\bcan'?t swallow (saliva|anything)|\bcomplete dysphagia|\bspitting (out )?(saliva|secretions)/, 'complete_dysphagia'),
  r(/\bdrool\w*/, 'drooling'),
  r(/\b(previous|recurrent|prior) (episodes? of )?(food )?(bolus|impaction)|\bfood (has )?(stuck|got stuck) before\b/, 'recurrent_bolus'),
  r(/\bodynophagi\w*|\bpainful swallowing\b|\bpain on swallowing\b/, 'odynophagia'),
  r(/\baspirat\w*|\bnocturnal cough\b|\bchoking\b|\bcoughing on eating\b/, 'aspiration_symptoms'),
  r(/\bsurgical emphysema\b|\bsubcutaneous emphysema\b|\bcrepitus (in|over|above|at) the (neck|chest|chest wall|left clavicle|right clavicle|clavicle|supraclavicular fossa)|\bsupraclavicular crepitus\b|\bcrackling (in|of) the neck|\bpneumomediastinum\b/, 'subcutaneous_emphysema'),
  r(/\bearly satiety\b|\bfull (quickly|after (a )?(few|small|little))/, 'early_satiety'),
  r(/\bsuccussion splash\b/, 'succussion_splash'),

  // Lower GI
  r(/\b(pr|rectal) bleed\w*|\bbleeding (per rectum|pr)\b|\bblood (in|on) (the )?(stool|toilet paper|pan)|\bbright red blood\b|\bfresh (red )?blood\b|\bha?ematochezia\b|\bfresh red\b|\bdark red\b|\bmaroon stool/, 'pr_bleeding'),
  r(/\bbloody diarrho?ea|\bdiarrho?ea[^.]{0,20}\bblood|\bblood[^.]{0,15}\bdiarrho?ea/, 'bloody_diarrhoea'),
  r(/\bdiarrho?ea\b|\bloose stools?\b|\bwatery stools?\b/, 'diarrhoea'),
  r(/\bconstipat\w*/, 'constipation'),
  r(/\babsolute constipation\b|\bnot passed (flatus|wind|stool)\b|\bno flatus\b|\bobstipation\b|\b(unable to|can'?t) pass (wind|flatus|gas|stool)\b/, 'absolute_constipation'),
  r(/\bdistend\w*\b(?! (neck veins|jugular|veins?|bladder))|\bdistension\b|\bbloat\w*|\bswollen (abdomen|belly|tummy)\b/, 'abdominal_distension'),
  r(/\btympanitic\b|\btympanic\b|\bhugely distended\b|\bmassive(ly)? distend\w*|\bgrossly distended\b|\bcoffee.bean\b/, 'tympanic_abdomen'),
  r(/\banorexi\w*|\bloss of appetite\b|\bpoor appetite\b|\boff (his|her) food\b|\bnot eating\b/, 'anorexia'),
  r(/\bweight loss\b|\blost (\d+|a lot of|some) ?(kg|kilo\w*|pounds|lbs?|stones?)\b|\blosing weight\b|\blost weight\b/, 'weight_loss'),
  r(/\bchange (in|of) bowel habit|\baltered bowel habit|\bchange in (his|her) bowel/, 'change_bowel_habit'),
  r(/\btenesmus\b|\bincomplete evacuation\b|\bfa?ecal urgency\b/, 'tenesmus'),
  r(/\bmucus\b|\bslime\b/, 'mucus_pr'),
  r(/\b(anal|perianal|rectal) pain\b|\bpain (at|around|in) the (anus|bottom|back passage)\b|\bpainful (bottom|anus)\b|\bpain on (defa?ecation|opening (his|her|the) bowels)/, 'anal_pain'),
  r(/\bpain (on|during|with|after) (defa?ecation|opening (his|her|the) bowels|passing (a )?stools?)|\bpainful (defa?ecation|bowel motions)|\b(defa?ecation|opening (his|her|the) bowels) (is |was )?painful\b/, 'pain_on_defaecation'),
  r(/\bperianal (lump|swelling|mass)|\blump (at|near|around) the anus\b|\banal (lump|swelling)\b/, 'perianal_swelling'),
  r(/\banal (mass|ulcer|lesion|tumou?r|induration)|\bindurated\b[^.]{0,20}\b(anal|margin|lesion|ulcer)|\bnon-?healing (anal )?(ulcer|fissure)/, 'anal_mass_ulcer'),
  r(/\brectal mass\b|\bmass (on|at) (dre|pr|digital rectal)|\bdre\b[^.]{0,30}\bmass\b|\bmass\b[^.]{0,30}\b(on|at) (dre|pr)\b/, 'rectal_mass'),
  r(/\bprolaps\w*/, 'prolapse_pr'),
  r(/\b(perianal|anal) discharge\b|\bdischarg\w* (from|around) the anus\b/, 'discharge_perianal'),
  r(/\bpruritus ani\b|\b(anal|perianal|bottom) itch\w*/, 'pruritus_ani'),
  r(/\bnatal cleft\b|\bsacrococcygeal\b|\bpilonidal\b/, 'natal_cleft'),
  r(/\bposterior midline\b/, 'posterior_midline'),
  r(/\bfa?ecal incontinence\b|\bsoiling\b|\bbowel incontinence\b/, 'faecal_incontinence'),
  r(/\bred.?currant\b|\bjelly.like stool/, 'redcurrant_stool', 'pr_bleeding'),

  // Hepatobiliary
  r(/\bjaundic\w*|\bicter\w*|\byellow (eyes|skin|sclera\w*)\b|\bsclera\w* (are |were )?yellow/, 'jaundice'),
  r(/\bpainless jaundice\b/, 'painless_jaundice'),
  r(/\bdark urine\b|\b(tea|cola)[- ]colou?red urine\b|\bpale (stools?|faeces)\b|\bclay.colou?red\b/, 'dark_urine'),
  r(/\bpruritus(?! ani)\b|\bitch(ing|y)?\b/, 'pruritus'),
  r(/\bsteatorrho?ea\b|\bgreasy stools?\b/, 'steatorrhoea'),
  r(/\bascites\b|\bshifting dullness\b|\bfluid thrill\b/, 'ascites'),
  r(/\bspider na?evi\b|\bpalmar erythema\b|\bcaput medusae\b/, 'spider_naevi'),

  // Urinary / genital
  r(/\bdysuri\w*|\bburning (on|when|with) (passing urine|urinat\w*|micturition|peeing)|\bpain(ful)? (on|when) (passing urine|urinat\w*|micturition)|\bstinging (on|when) passing urine/, 'dysuria'),
  r(/\burinary (frequency|urgency)\b|\bpassing urine (more )?often\b|\burinary symptoms\b|\bwith urination\b|\bfrequency of micturition\b/, 'frequency_urgency'),
  rn(URINARY_CTX, /(?<!fa?ecal |bowel )\b(frequency|urgency)\b/, 'frequency_urgency'),
  r(/\bnocturia\b|\b(gets |getting )?up (\w+ times )?(at night )?to pass urine\b/, 'nocturia'),
  r(/\bhesitan\w*|\bpoor (urinary )?stream\b|\bweak stream\b|\bterminal dribbl\w*|\bpost.micturition dribbl\w*|\bluts\b/, 'prostate_symptoms'),
  r(/\b(unable|can'?t|cannot) (to )?(pass|pee|void|urinate)\b(?! (wind|flatus|gas|stool))|\burinary retention\b|\bretention of urine\b|\bincomplete (bladder )?emptying\b/, 'urinary_retention_symptoms'),
  r(/\b(palpable|distended|enlarged) bladder\b|\bbladder (is )?(palpable|distended)\b|\bresidual (volume )?(of )?\d{3,4}\b/, 'palpable_bladder'),
  r(/\boverflow\b|\bdribbling\b/, 'overflow_incontinence'),
  r(/\boliguri\w*|\banuri\w*|\breduced urine output\b|\bpassing (little|less) urine\b|\blow urine output\b|\bnot passed (any )?urine\b/, 'oliguria'),
  r(/\bha?ematuri\w*|\bblood (in|on) (the |his |her )?urine\b|\b(red|pink|blood.stained) urine\b/, 'haematuria'),
  r(/\bvisible ha?ematuria|\bfrank ha?ematuria|\bmacroscopic ha?ematuria|\bblood in (the |his |her )?urine\b|\b(red|pink) urine\b/, 'visible_haematuria'),
  r(/\bpainless (visible |frank )?ha?ematuria\b/, 'painless_haematuria'),
  r(/\bhydronephros\w*|\bhydroureter\w*|\bdilated (renal )?(pelvis|collecting system)|\bpelvicalyceal dilat\w*/, 'hydronephrosis'),
  r(/\b(ureteric|renal|kidney|vuj|pui|obstructing) (stone|calcul\w*)|\bnephrolithiasis\b|\burolithiasis\b/, 'known_stone'),
  r(/(?<!(confused|agitated|drowsy|disorientated|disoriented),? (and )?)\brestless\b(?!,? (and )?(disorientat\w*|disorient\w*|confus\w*|agitat\w*|drows\w*))|\bwrithing\b|\b(cannot|can'?t) (lie|keep) still\b|\bcan'?t get comfortable\b|\bpacing\b/, 'restless_writhing'),
  r(/\b(urethral|penile) discharge\b/, 'urethral_discharge'),
  r(/\btestic\w* pain\b|\bpain(ful)? (in )?(the |his )?(left |right )?(testis|testicle|scrotum)\b|\bscrotal pain\b/, 'testicular_pain'),
  r(/\bscrotal swelling\b|\bswollen (testicle|testis|scrotum|hemiscrotum)\b|\bswelling of the (testicle|testis|scrotum)\b/, 'scrotal_swelling'),
  r(/\b(absent|no|loss of) cremaster\w* reflex|\bcremaster\w* reflex (is |was )?(absent|not elicited|not present|negative)/, 'absent_cremasteric'),
  r(/\bhigh.?riding\b|\bhorizontal lie\b/, 'high_riding_testis'),
  r(/\b(hard|firm) (lump|mass) (in|of|within) the (testis|testicle)|\btesticular (lump|mass)\b/, 'testicular_mass'),

  // Gynaecology / obstetric
  r(/\bpregnan\w*|\b\d{1,2}\s?(\+\d)?\s?weeks'? (pregnant|gestation|pregnancy)\b|\bgestation(al)? (age )?(of )?\d+|\bprimigravida\b|\bmultigravida\b|\bprimip\b|\bg\d\s?p\d\b|\bantenatal\b|\b(first|second|third) trimester\b/, 'pregnant'),
  r(/\bpost.?partum\b|\bpuerper\w*|\b(\d+|two|three|four|five|six|seven|ten) (days|weeks) (after|since|following) (delivery|giving birth|birth|caesarean|c-section)\b|\bdelivered (\d+|two|three|four|five|six) (days|weeks) ago\b/, 'postpartum'),
  r(/\bmissed (a |her )?period\b|\bamenorrho?ea\b|\bperiod (is )?late\b|\blate period\b|\b(lmp|last (menstrual )?period)\b[^.]{0,25}\b([5-9]|1\d) weeks\b/, 'missed_period'),
  r(/\bvaginal (bleed\w*|spotting|blood)|\bpv (bleed\w*|blood)\b|\bspotting\b|\bbleeding (per vaginam|pv)\b|\bmenorrhagia\b|\bheavy periods\b|\bintermenstrual\b|\babnormal bleeding\b|\bpost.?coital bleed\w*|\bpost.?menopausal bleed\w*/, 'abnormal_uterine_bleeding'),
  r(/\bpost.?coital bleed\w*/, 'postcoital_bleeding'),
  r(/\bpost.?menopausal bleed\w*/, 'postmenopausal_bleeding'),
  r(/\bvaginal discharge\b|\bpv discharge\b/, 'vaginal_discharge'),
  r(/\bdyspareuni\w*|\bpain(ful)? (during|with|on|after) (sex|intercourse)\b|\bpost-coital\b/, 'dyspareunia'),
  r(/\bdysmenorrho?ea\b|\bpainful periods\b/, 'dysmenorrhoea'),
  r(/\badnexal tender\w*|\btender (left |right )?adnexa\b|\badnexal (and )?cervical/, 'adnexal_tenderness'),
  r(/\bcervical (excitation|motion) tenderness\b|\bcmt\b/, 'cervical_excitation', 'adnexal_tenderness'),
  r(/\badnexal mass\b|\bovarian (mass|cyst)\b|\bdermoid\b|\benlarged (left |right )?ovary\b/, 'adnexal_mass'),
  r(/\bfree fluid\b|\bha?emoperitoneum\b|\bfluid in (the )?(pouch of douglas|pelvis)\b/, 'pelvic_free_fluid'),
  r(/\b(tender|tense|woody|hard) uterus\b|\buterus (is |was )?(tender|tense|woody|hard)\b|\buterine tenderness\b/, 'uterine_tenderness'),
  r(/\breduced (fetal|foetal) movements\b|\b(fetal|foetal) movements (are )?(reduced|decreased)\b/, 'reduced_fetal_movements'),
  r(/\bproteinuri\w*|\bprotein(uria)?\s*(\+{1,4}|[1-4]\+)/, 'proteinuria'),
  r(/\bvulval (swelling|lump|abscess)|\blabial (swelling|lump)\b/, 'vulval_swelling'),

  // Breast
  r(/\bbreast (lump|mass|swelling)\b|\blump in (the|her|his) (left |right )?breast\b/, 'breast_lump'),
  r(/\bbreast (pain|tenderness)\b|\bmastalgi\w*/, 'breast_pain'),
  rq(BREAST_CTX, /\bcyclical\b/, 'cyclical_breast_pain'),
  r(/\b(red|inflamed|hot|erythematous) breast\b|\bbreast (redness|erythema|is red|is hot)\b/, 'breast_redness'),
  r(/\bnipple discharge\b|\bdischarge from the nipple\b/, 'nipple_discharge'),
  rq(BREAST_CTX, /\b(blood.stained|bloody|ha?emoserous|serosanguin\w*)\b|\bsingle.duct\b/, 'bloody_nipple_discharge', 'nipple_discharge'),
  r(/\bnipple (inversion|retraction)\b|\b(inverted|retracted) nipple\b/, 'nipple_inversion'),
  r(/\bdimpl\w*|\bpeau d'?orange\b|\bskin tethering\b|\btethered to (the )?skin\b|\bfixed to skin\b/, 'skin_dimpling'),
  rq(BREAST_CTX, /\b(hard|irregular|fixed|craggy)\b/, 'breast_lump_hard'),
  rq(BREAST_CTX, /\b(smooth|mobile|rubbery)\b/, 'breast_lump_mobile'),
  r(/\bbreast.?feeding\b|\blactat\w*/, 'post_lactation'),
  r(/\baxillary (lymph|node|nodes|lump|mass|swelling)\b|\blump in (the|her|his) (left |right )?axilla\b/, 'axillary_nodes'),
  r(/\bbilateral\b[^.]{0,20}\b(breast|gynae?comastia)\b|\bboth breasts\b/, 'bilateral_breast'),

  // Neck / endocrine
  r(/\bneck (lump|swelling|mass)\b|\blump in (the|his|her) neck\b|\bgoitre\b|\bgoiter\b|\bthyroid (swelling|nodule|lump|enlargement|mass)\b/, 'neck_lump'),
  r(/\bgoitre\b|\bgoiter\b|\bthyroid (swelling|nodule|lump|enlargement|mass)\b|\bmoves on swallowing\b/, 'thyroid_swelling'),
  r(/\brapid(ly)? (growing|enlarg\w*|increas\w* in size|growth)\b|\bgrown (quickly|rapidly)\b|\bdoubled in size\b/, 'rapid_growth'),
  r(/\bhoarse\w*|\bvoice change\b|\bchange in (his|her) voice\b|\bdysphonia\b/, 'hoarseness'),
  r(/\bcervical (lymph ?)?(nodes?|lymphadenopathy)\b|\blymph nodes? in the neck\b/, 'cervical_nodes'),
  r(/\banterior triangle\b/, 'anterior_triangle_lump'),
  r(/\bparotid\b|\bsubmandibular (gland|swelling)\b/, 'parotid_swelling'),
  r(/\bneck pain\b/, 'neck_pain'),
  r(ADRENAL_MASS, 'adrenal_mass'),

  // Groin / hernia
  r(/\bcough impulse\b|\bimpulse on cough(ing)?\b/, 'cough_impulse'),
  r(/\b(easily |manually )?reducib\w*|\breduces (on lying|spontaneously|when lying)\b|\bgoes (back|away) (when|on) lying\b|\bmanual reduction\b/, 'hernia_compressible'),
  rq(GROIN_CTX, /\b(easily |manually )?reducib\w*|\breduces (on lying|spontaneously|when lying)\b/, 'groin_lump_reducible'),
  r(/\birreducib\w*|\bnot reducible\b|\bcannot be reduced\b|\bincarcerat\w*|\bstrangulat\w*/, 'hernia_irreducible'),
  r(/\bhernia\b|\bbulge\b/, 'hernia_swelling'),
  r(/\b(dilated|distended) colon\b|\bcolon(ic)? (dilat\w*|diameter)\b[^.]{0,20}\b([6-9]|1\d) ?cm\b|\btransverse colon\b[^.]{0,20}\b([6-9]|1\d) ?cm\b|\bmegacolon\b/, 'dilated_colon'),
  r(/\bumbilical (swelling|lump|hernia|bulge|mass)\b|\bparaumbilical\b|\bswelling (at|near|around) the (umbilicus|navel|belly button)\b/, 'umbilical_swelling'),
  r(/\bincisional\b|\b(swelling|bulge|lump) (at|in|near|beside|along) (the |his |her |a )?(\w+ )?(scar|incision)\b|\bscar (swelling|bulge|hernia)\b/, 'incisional_swelling', 'previous_surgery'),
  r(/\bstoma\b|\bcolostomy\b|\bileostomy\b|\burostomy\b/, 'stoma', 'previous_surgery'),
  r(/\bparastomal\b|\b(bulge|swelling) (around|beside|near) (the )?stoma\b/, 'parastomal_bulge'),
  r(/\bhowship\b|\b(inner|medial) thigh pain\b|\bpain (down|along) the (inner|medial) (thigh|aspect of the thigh)\b/, 'howship_romberg', 'medial_thigh_pain'),
  r(/\bbelow (and lateral to )?(the )?(inguinal ligament|pubic tubercle)\b|\binferolateral to the pubic tubercle\b/, 'below_inguinal_ligament'),
  r(/\binguinal (lymph ?)?(nodes?|lymphadenopathy)\b|\b(multiple|firm|rubbery|matted) (nodes|lumps)\b[^.]{0,20}\bgroin\b|\bgroin\b[^.]{0,25}\b(nodes|lymphadenopathy)\b/, 'inguinal_nodes'),

  // Abdominal examination
  r(/\bguarding\b|\brigid\w*\b|\bboard.like\b/, 'guarding'),
  r(/\brebound( tenderness)?\b|\bpercussion tenderness\b|\bperitonism\b|\bperitonitic\b|\bperitonitis\b/, 'rebound_tenderness'),
  r(/\b(abdomen|abdominal)\b[^.]{0,30}\btender\w*|\btender(ness)? (in|over) the (rif|ruq|luq|lif|epigastri\w*|suprapubic|right|left|lower|upper|abdomen)\b|\b(rif|ruq|luq|lif|epigastric|suprapubic|periumbilical) tenderness\b/, 'abdominal_tenderness'),
  r(/\bmurphy'?s?\b/, 'murphy_sign'),
  r(/\b(abdominal|epigastric|rif|ruq|luq|lif|palpable|sausage.shaped|olive.shaped) (mass|lump)\b|\bmass (in|palpable in) the (abdomen|rif|ruq|luq|lif|epigastrium)\b|\blump in (the )?abdomen\b|\bolive\b|\bfullness in the (right|left) (upper|lower) quadrant\b|\bsausage\b/, 'abdominal_mass'),
  r(/\bvisible peristalsis\b/, 'visible_peristalsis'),
  r(/\btinkling\b|\bhigh.pitched bowel sounds\b/, 'tinkling_bowel_sounds'),
  r(/\babsent bowel sounds\b|\bbowel sounds (are )?(absent|not heard)\b|\bsilent abdomen\b/, 'absent_bowel_sounds'),

  // Skin / soft tissue
  r(/\bskin (lesion|lump|growth)\b|\bmole\b|\bpigmented (lesion|mole)\b/, 'skin_lesion'),
  r(/\bpigmented\b|\bmole\b/, 'pigmented_lesion'),
  r(/\b(changing|changed|growing|enlarging|itching|bleeding) (mole|lesion)\b|\bmole\b[^.]{0,30}\b(changed|chang\w*|grown|bleed\w*|itch\w*)\b|\babcde\b/, 'skin_lesion_change'),
  r(/\b(soft|subcutaneous|fatty|rubbery) (lump|swelling|mass)\b|\blump (on|under) the skin\b|\bsoft.tissue (lump|mass|swelling)\b/, 'soft_tissue_lump'),
  r(/\bdeep (to|within) (the )?(fascia|muscle)\b|\b([6-9]|1\d) ?cm\b[^.]{0,20}\b(lump|mass)\b/, 'deep_lump'),
  r(/\bpunctum\b/, 'punctum'),
  r(/\berythema\w*|\berythematous\b|\bcellulitis\b|\bredness\b|\binflamed\b|\bred,? (hot|warm|swollen)\b|\bhot,? red\b/, 'erythema_surrounding'),
  r(/\bspreading (redness|erythema|cellulitis|infection)\b|\b(redness|erythema|cellulitis)\b[^.]{0,20}\bspreading\b|\btracking (redness|up the)\b/, 'spreading_redness'),
  r(/\bfluctuan\w*|(?<!(drainage|drained|incision and drainage) of (an |a |the )?)\babscess\b|\bcollection of pus\b|\bpointing\b/, 'swelling_fluctuant_soft'),
  r(/\bpus\b|\bpurulent\b|\bdischarging (pus|sinus)\b|\boozing pus\b/, 'discharge_pus'),
  r(/\b(tender|painful) (lump|swelling|area|red)\b|\bexquisitely tender\b|\bvery painful\b/, 'localised_pain'),
  r(/\bcrepitus\b|\bcrepitant\b|\bgas in (the )?(soft tissue|tissues|tissue planes)\b|\bsoft.tissue gas\b|\bsubcutaneous gas\b/, 'crepitus_soft_tissue'),
  r(/\bnecros\w*|\bnecrotic\b|\bbullae\b|\bblack(ened)? skin\b|\bdusky\b|\bgangren\w*|\bskin (is )?(grey|gray|purple)\b/, 'skin_necrosis'),
  r(/\bfoot (ulcer|infection|wound|swelling)\b|\b(ulcer|wound) (on|of) the (foot|toe|heel|sole)\b|\btoe (ulcer|infection)\b|\bdiabetic foot\b|\bplantar ulcer\b|\btoe \/ digit\b|\bforefoot\b/, 'foot_problem'),
  r(/\bfoot ulcer\b|\b(ulcer|wound) (on|of) the (foot|toe|heel|sole)\b|\btoe ulcer\b|\bplantar ulcer\b/, 'foot_ulcer'),
  r(/\bprobe.to.bone\b|\bprobes to bone\b|\bbone (is )?(exposed|visible)\b|\bexposed bone\b|\bosteomyelitis\b/, 'probe_to_bone'),
  r(/\bneuropath\w*\b(?! pain)|\bloss of (protective )?sensation\b|\bmonofilament\b|\bnumb feet\b|\bnumbness (in|of)? ?(the |both )?feet\b/, 'peripheral_neuropathy'),
  r(/\b(hot|warm)\b[^.]{0,20}\bswollen\b[^.]{0,15}\bfoot\b|\bswollen\b[^.]{0,15}\b(hot|warm)\b[^.]{0,15}\bfoot\b|\bfoot\b[^.]{0,25}\b(hot|warm)\b[^.]{0,15}\bswollen\b|\b\d(\.\d)? ?°?c warmer\b/, 'warm_swollen_foot'),

  // Trauma / burns
  r(/\b(fell|had a fall|fall(en)? (from|off|down|onto)|tripped|rta|rtc|road traffic|car (crash|accident|collision)|motorcycle|motorbike|pedestrian|hit by|struck by|assault\w*|punched|kicked|stabbed|stab wound|gunshot|shot|knife|blunt trauma|crush(ed)?|pushed (over|by|down))\b|(?<!kidney |renal )\binjur(y|ies|ed)\b|\btrauma\b/, 'trauma_mechanism'),
  r(/\b(fell|had a fall|fall(en)? (from|off|down|onto)|tripped|rta|rtc|road traffic|car (crash|accident|collision)|motorcycle|motorbike|pedestrian|hit by|struck by|assault\w*|punched|kicked|blunt trauma|crush(ed)?|pushed (over|by|down))\b/, 'mechanism_blunt'),
  r(/\bstab(bed| wound)?\b|\bgunshot\b|\bknife\b|\bimpaled\b|\bpenetrating\b/, 'mechanism_penetrating'),
  r(/\bhead (injury|trauma)\b|\bhit (his|her) head\b|\bbanged (his|her) head\b|\bstruck (his|her) head\b/, 'head_injury'),
  r(/\beviscerat\w*|\bomentum protruding\b|\bbowel protruding\b/, 'evisceration'),
  r(/\bchest wall tender\w*|\btender (over the )?ribs?\b|\brib (tenderness|fracture)/, 'chest_wall_tenderness'),
  r(/\bparadoxical (movement|breathing|chest)\b|\bflail\b/, 'paradoxical_breathing'),
  r(/\bburns?\b(?! (on|when|with) (passing|micturition|urinat))|\bburnt\b|\bscald\w*|\bflame\b(?!(-| )(shaped|haemorrhag\w*|hemorrhag\w*))|\bfire\b|\bchemical (injury|splash)\b|\balkali\b/, 'burn_wound'),
  r(/\belectric\w* (injury|shock|burn)|\belectrocut\w*|\bhigh.voltage\b|\blightning\b/, 'electrical_injury'),
  r(/\b[2-9]\d\s?%\s?(tbsa|total body surface|body surface)|\btbsa\s*(of\s*)?[2-9]\d\s?%/, 'tbsa_significant'),
  r(/\binhalation (injury)?\b|\bsoot\w*\b|\bsinged\b|\benclosed space\b|\bsmoke inhal\w*/, 'inhalation_injury'),
  r(/\bsinged\b/, 'singed_eyebrows'),
  r(/\bblister\w*/, 'blistering'),

  // Post-operative
  r(/\b(post.?op\w*|postoperative)\b|\bday (\d+|one|two|three|four|five|six|seven) (after|post|following)\b|\b(\d+|two|three|four|five|six|seven|ten) days (after|since|post|following) (his |her |the |a |an )?(\w+ )?(surgery|operation|repair|resection|\w+ectomy|\w+otomy|\w+plasty)\b|\bpod ?\d+\b|\bafter (his|her) (recent )?(surgery|operation|\w+ectomy|\w+otomy)\b|\bfever after surgery\b|\bday [0-5]\+?[–-][0-9]\b/, 'recent_surgery', 'previous_surgery'),
  r(/\b(previous|prior|past)\b[^.]{0,20}\b(surgery|operation|laparotomy|appendic\w*|cholecystectomy|hysterectomy|caesarean|c-section|resection)\b|\b(appendicectomy|appendectomy|cholecystectomy|laparotomy|hysterectomy|caesarean section|c-section|hemicolectomy|colectomy|gastrectomy|anterior resection|hernia repair|whipple)\b/, 'previous_surgery'),
  r(/\banastomos\w*|\b(hemi)?colectomy\b|\banterior resection\b|\bhartmann\w*|\bileocolic\b|\bbowel resection\b|\bsmall bowel resection\b/, 'bowel_resection'),
  r(/\b(hemi|total )?thyroidectomy\b|\bparathyroidectomy\b|\bneck (surgery|dissection)\b/, 'neck_surgery'),
  r(/\bwound\b[^.]{0,30}\b(red|erythema\w*|inflamed|cellulitis|warm|hot|indurat\w*|redness)\b|\b(red|erythematous|inflamed|indurated) (wound|incision|scar|port.?site)\b|\bredness (around|at) the (wound|incision|scar|port)\b|\bwound redness\b/, 'wound_erythema'),
  r(/\bwound\b[^.]{0,30}\b(discharg\w*|oozing|leaking|pus|purulent)\b|\b(discharg\w*|pus|leak\w*) (from|at) the (wound|incision|port)\b|\bwound discharge\b/, 'wound_discharge'),
  r(/\bwound (pain|is painful|tender)\b|\bpain(ful)? (at|around) the (wound|incision)\b/, 'wound_pain'),
  r(/\b(swelling|swollen) (at|around|of|under) the (wound|incision|scar|operation site)\b|\bwound (swelling|swollen)\b|\bneck swelling\b[^.]{0,30}\b(after|post|following)\b/, 'wound_swelling'),
  r(/\bdehisc\w*|\bwound (has )?(opened|come apart|gaping|separat\w*)\b|\bburst abdomen\b/, 'wound_dehiscence_sign'),
  rq(WOUND_CTX, /\b(redness|erythema\w*|red|inflamed|warm|hot|indurat\w*)\b/, 'wound_erythema'),
  rq(WOUND_CTX, /\b(discharg\w*|pus|purulent|oozing|leaking)\b/, 'wound_discharge'),
  r(/\bseroma\b|\bfluctuant (swelling|collection) (at|near|under) the (wound|scar)\b/, 'wound_seroma'),
  r(/\bnot (passing|passed) (flatus|wind)\b|\bnot tolerating (diet|oral|fluids)\b|\bhigh (ng|nasogastric) (output|aspirates?)\b|\bileus\b/, 'ileus_signs'),
];

// ── 3. History (comorbidities, medicines, surgical history; also read in free text) ─────
const HISTORY_RULES: Rule[] = [
  r(/\bdiabet\w*|\bt[12]dm\b|\biddm\b|\bniddm\b|\bmetformin\b|\binsulin\b|\bgliclazide\b|\bglibenclamide\b|\bglimepiride\b|\bglipizide\b|\b\w+gliptin\b|\b\w+gliflozin\b|\bliraglutide\b|\bsemaglutide\b|\bdulaglutide\b|\bpioglitazone\b/, 'known_diabetes'),
  r(/\b\w+gliflozin\b|\bsglt-?2\b/, 'sglt2_inhibitor'),
  r(/\binsulin\b|\bgliclazide\b|\bglibenclamide\b|\bglimepiride\b|\bglipizide\b|\bsulfonylurea\b|\bsulphonylurea\b|\blantus\b|\bnovorapid\b|\bhumalog\b|\bmixtard\b|\blevemir\b|\btresiba\b/, 'insulin_or_sulfonylurea'),
  r(/\bhypertension\b|\bhtn\b|\bhigh blood pressure\b|\bhypertensive\b/, 'known_hypertension', 'vascular_risk'),
  r(/\bhyperlipid\w*|\bhypercholesterol\w*|\bhigh cholesterol\b|\bdyslipid\w*|\bstatin\b|\batorvastatin\b|\bsimvastatin\b|\brosuvastatin\b/, 'vascular_risk'),
  r(/\bsmok(er|es|ing)\b|\bpack.?years?\b|\bcigarettes?\b|\btobacco\b/, 'smoker', 'vascular_risk'),
  r(/\bischa?emic heart disease\b|\bihd\b|\bcoronary artery disease\b|\bprevious (mi|myocardial infarction|heart attack)\b|\bangina\b|\bheart failure\b|\bccf\b|\blvsd\b|\bhfref\b|\bhfpef\b|\bcardiomyopathy\b|\baortic stenosis\b|\bvalve (disease|replacement)\b|\bcabg\b|\bcoronary stents?\b|\bpci\b/, 'known_heart_disease', 'vascular_risk'),
  r(/\bperipheral (arterial|vascular) disease\b|\bprevious stroke\b|\bprevious tia\b/, 'vascular_risk'),
  r(/\batrial fibrillation\b|\bparoxysmal af\b|\bpermanent af\b|\bknown af\b|\bafib\b|^af$|\bhistory of af\b/, 'known_af'),
  r(/\basthma\w*/, 'known_asthma'),
  r(/\bcopd\b|\bchronic obstructive\b|\bemphysema\b(?! (in|of) the (neck|chest wall))|\bchronic bronchitis\b/, 'known_copd'),
  r(/\bckd\b|\bchronic kidney disease\b|\bchronic renal (failure|impairment|insufficiency)\b|\bdialysis\b|\bha?emodialysis\b|\besrf\b|\beskd\b/, 'known_ckd'),
  r(/\bcirrho\w*|\bchronic liver disease\b|\bportal hypertension\b|\bhepatitis [bc]\b|\balcoholic liver disease\b|\bliver disease\b|\bvarices\b/, 'known_liver_disease'),
  r(/\bepilep\w*/, 'known_epilepsy'),
  r(/\beczema\b|\bhay fever\b|\ballergic rhinitis\b|\batopic\b|\batopy\b/, 'atopy'),
  r(/\bulcerative colitis\b|\bcrohn'?s\b|\binflammatory bowel disease\b|\bibd\b/, 'ulcerative_colitis_history'),
  r(/\b(kidney|renal) stones?\b|\bnephrolithiasis\b|\burolithiasis\b/, 'renal_stones_history'),
  r(/\bimmunosuppress\w*|\bimmunocompromis\w*|\bhiv\b|\baids\b|\btransplant\w*|\bchemo\w*|\bmethotrexate\b|\bazathioprine\b|\btacrolimus\b|\bmycophenolate\b|\bciclosporin\b|\binfliximab\b|\badalimumab\b|\brituximab\b/, 'immunosuppression'),
  r(/\bneutropeni\w*|\bneutrophils?\s*(of\s*)?0\.\d\b|\b(\d+|seven|ten|five) days (after|post|since) (his |her )?(chemo\w*|cycle)/, 'neutropenia'),
  r(/\bsplenectomy\b|\basplen\w*|\bhyposplen\w*|\bno spleen\b/, 'asplenia'),
  r(/\b(known|metastatic|history of|treated for|previous|on treatment for|background of)\b[^.]{0,25}\b(cancer|carcinoma|malignan\w*|lymphoma|myeloma|leukaemia|leukemia|tumou?r)\b|\bmetastat\w*|\bmetastas[ie]s\b|\bbone mets\b|\bknown (malignancy|cancer)\b|\bon (chemo\w*|hormone therapy|tamoxifen|letrozole|anastrozole|bicalutamide|enzalutamide|goserelin)\b/, 'known_malignancy'),
  r(/\bwarfarin\b|\bapixaban\b|\brivaroxaban\b|\bedoxaban\b|\bdabigatran\b|\benoxaparin\b|\bdalteparin\b|\btinzaparin\b|\bheparin\b|\banticoagula\w*/, 'anticoagulant_use'),
  r(/\baspirin\b|\bclopidogrel\b|\bticagrelor\b|\bprasugrel\b|\bdipyridamole\b|\bantiplatelet\w*|\bdual antiplatelet\b/, 'antiplatelet_use'),
  r(/\bnsaids?\b|\bibuprofen\b|\bdiclofenac\b|\bnaproxen\b|\bmeloxicam\b|\bcelecoxib\b|\bindomethacin\b|\bketorolac\b|\betoricoxib\b/, 'nsaid_use'),
  r(/\bprednisolone\b|\bprednisone\b|\bdexamethasone\b|\bhydrocortisone\b|\bmethylprednisolone\b|\b(oral|long.term|high.dose) steroids?\b|\bon steroids\b/, 'steroid_use'),
  r(/\bomeprazole\b|\blansoprazole\b|\bpantoprazole\b|\besomeprazole\b|\brabeprazole\b|\bppi\b/, 'ppi_use'),
  r(/\bramipril\b|\blisinopril\b|\bperindopril\b|\benalapril\b|\bcaptopril\b|\bcandesartan\b|\blosartan\b|\bvalsartan\b|\birbesartan\b|\bolmesartan\b|\btelmisartan\b|\bace inhibitor\b|\bacei\b|\barb\b/, 'acei_arb_use'),
  r(/\bfurosemide\b|\bfrusemide\b|\bbumetanide\b|\bbendroflumethiazide\b|\bindapamide\b|\bhydrochlorothiazide\b|\bchlorthalidone\b|\bspironolactone\b|\beplerenone\b|\bdiuretic\w*/, 'diuretic_use'),
  r(/\bbendroflumethiazide\b|\bindapamide\b|\bhydrochlorothiazide\b|\bchlorthalidone\b|\bthiazide\w*|\bsertraline\b|\bcitalopram\b|\bescitalopram\b|\bfluoxetine\b|\bparoxetine\b|\bssri\b|\bcarbamazepine\b|\boxcarbazepine\b/, 'hyponatraemia_drug'),
  r(/\bmorphine\b|\boxycodone\b|\bcodeine\b|\btramadol\b|\bfentanyl\b|\bopioid\w*|\boxybutynin\b|\bamitriptyline\b|\btolterodine\b|\bsolifenacin\b|\bhyoscine\b|\bpca\b/, 'anticholinergic_or_opioid'),
  r(/\b(combined )?(oral contraceptive|contraceptive pill|ocp|cocp)\b|\bthe pill\b|\bhrt\b|\bhormone replacement\b|\boestrogen\b|\bestrogen\b|\bhrt \/ ocp\b/, 'oestrogen_use'),
  r(/\balcohol\w*|\bbinge\b|\b\d+ units\b|\bheavy drink\w*|\bdrinks (heavily|a lot)\b|\betoh\b/, 'alcohol_use'),
  r(/\binject\w* (drugs|heroin)\b|\bpwid\b|\bivdu\b|\bintravenous drug use\b|\biv drug use\b/, 'injecting_drug_use'),
  r(/\b(known|previous) (abdominal )?(aortic )?aneurysm\b|\baaa (surveillance|under surveillance)\b|\bknown aaa\b/, 'known_aaa'),
  r(/\b(aortic|aorto.?\w+) (graft|repair|stent)\b|\bevar\b|\b(aneurysm|aaa) repair\b|\btube graft\b|\bdacron\b|\bendovascular aneurysm/, 'aortic_graft'),
  r(/\b(femoral|groin) (puncture|access|line|catheter\w*)\b|\bangiogra\w*|\bangioplast\w*|\bcardiac cath\w*/, 'arterial_puncture'),
  r(/\blong.?haul\b|\blong (flight|journey|drive|car journey)\b|\bflew (back )?from\b|\bimmobil\w*|\bbed.?bound\b|\bbed rest\b|\bplaster cast\b|\brecent(ly)? (flight|travel|hospitali[sz]\w*)\b/, 'recent_immobility'),
  r(/\b(recent|recently|course of|completed|finished|taking|on|took|a week of|days of) (a course of )?(antibiotic\w*|amoxicillin|co-amoxiclav|clindamycin|ciprofloxacin|cefalexin|ceftriaxone|doxycycline|clarithromycin|\w+cillin|\w+floxacin|\w+mycin)\b/, 'recent_antibiotics'),
  // An antibiotic on the medication list (drug names only; the list holds current / recent medicines)
  r(/^(co-amoxiclav|amoxicillin|clindamycin|ciprofloxacin|levofloxacin|cefalexin|cefuroxime|ceftriaxone|doxycycline|clarithromycin|erythromycin|flucloxacillin|piperacillin\w*|meropenem|trimethoprim|nitrofurantoin|\w+cillin|\w+floxacin)\b/, 'recent_antibiotics'),
  r(/\b(recent(ly)?|was) (admitted|admission|hospitali[sz]\w*|discharged)\b|\bdischarged from hospital\b|\binpatient\b|\bnursing home\b|\bcare home\b/, 'recent_hospitalisation'),
  r(/\b(family|household|others|friends|colleagues|children) (also |were |are )?(unwell|ill|sick|with (the same|similar))\b|\bsick contacts\b|\bsame symptoms\b|\b(takeaway|street food|seafood|buffet|restaurant|picnic|barbecue|undercooked)\b/, 'sick_contacts'),
  r(/\bknown allerg\w*|\ballergic to\b|\banaphylaxis to\b/, 'known_allergy'),
  r(/\b(c\.? ?diff(icile)?|clostridi\w* difficile|cdi)\b[^.]{0,30}\b(positive|on the (unit|ward)|outbreak|toxin)\b|\bgdh positive\b|\btoxin positive\b/, 'cdiff_positive'),
  r(/\bgastric bypass\b|\broux.en.y\b|\bbariatric\b|\bsleeve gastrectomy\b/, 'bariatric_surgery'),
  r(/\bprevious (hernia )?repair\b|\brecurrent (inguinal |groin )?hernia\b|\bmesh repair\b/, 'previous_repair'),
];

// ── 4. SOCRATES key-specific rules (picker options and typed answers) ─────────────
const SITE_RULES: Rule[] = [
  r(/\b(diffuse|generali[sz]ed)\b(?! (neck|chest|breast|thyroid|goitre|goiter|rash|skin|body|limbs?|legs?|arms?|swelling|lymphadenopathy|itch\w*))|\ball over\b(?! (the |his |her )?(body|skin|place))/, 'diffuse_abdominal_pain'),
  r(/\bperiumbilical\b|\baround (the )?(navel|belly button)\b|\bcentral\b(?!\s*(\/|or|and)?\s*(areol\w*|nipple|breast|chest|neck))/, 'periumbilical_pain'),
  r(/\brlq\b|\bright (lower|iliac)\b|\bright iliac fossa\b/, 'rlq_pain'),
  r(/\bruq\b|\bright (upper|hypochondr)/, 'ruq_pain'),
  r(/\bepigastri\w*|\bupper (abdomen|belly)\b|\bstomach\b/, 'epigastric_pain'),
  r(/\bllq\b|\blif\b|\bleft (lower|iliac)\b/, 'lif_pain'),
  r(/\bluq\b|\bleft (upper|hypochondr)/, 'luq_pain'),
  r(/\bsuprapubic\b/, 'suprapubic_pain'),
  r(/\bpelvic\b|\bpelvis\b/, 'pelvic_pain'),
  r(/\bloin\b|\bflank\b|\brenal angle\b/, 'loin_pain'),
  r(/\bchest\b|\bretrosternal\b/, 'chest_pain'),
  r(/\b(anal canal|perianal|anus|rectum|rectal|bottom)\b/, 'anal_pain'),
  r(/\bperine\w*/, 'perineal_pain'),
  r(/\bposterior midline\b/, 'posterior_midline'),
  r(/\bnatal cleft\b|\bsacrococcygeal\b/, 'natal_cleft'),
  r(/\bfoot\b|\btoe\b|\bheel\b|\bsole\b/, 'foot_problem'),
  r(/\bthyroid\b/, 'thyroid_swelling', 'neck_lump'),
  r(/\banterior triangle\b/, 'anterior_triangle_lump', 'neck_lump'),
  r(/\bfemoral\b/, 'below_inguinal_ligament'),
  r(/\bincisional\b|\bscar\b/, 'incisional_swelling', 'previous_surgery'),
  r(/\b(calf|leg|thigh|shin)\b/, 'limb_pain'),
  r(/\bback\b|\blumbar\b|\bthoracic\b|\bspine\b/, 'back_pain'),
  r(/\bhead\b|\bfrontal\b|\boccipital\b|\btemporal\b|\bvertex\b/, 'headache'),
];
/** Site words that mean pain when the complaint is pain, a lump's location when it is a lump. */
const SITE_PAIN_OR_LUMP: { pattern: RegExp; pain: string[]; lump: string[] }[] = [
  { pattern: /\b(groin|inguinal)\b/, pain: ['groin_pain'], lump: ['groin_swelling'] },
  { pattern: /\b(scrotum|scrotal|testic\w*|testis)\b/, pain: ['testicular_pain'], lump: ['scrotal_swelling'] },
  { pattern: /\bumbilic\w*/, pain: ['periumbilical_pain'], lump: ['umbilical_swelling'] },
  { pattern: /\bneck\b/, pain: ['neck_pain'], lump: ['neck_lump'] },
  { pattern: /\bbreast\b|\bareola\b|\bupper outer\b|\blower outer\b|\bupper inner\b|\blower inner\b/, pain: ['breast_pain'], lump: ['breast_lump'] },
  { pattern: /\baxilla\w*/, pain: [], lump: ['axillary_nodes'] },
];
const LUMP_CHARACTER = /\b(lump|mass|swelling|firm|hard|soft|smooth|mobile|cystic|non-?tender|fixed|irregular|matted|rubbery|reducible)\b/;

const RADIATION_RULES: Rule[] = [
  r(/\bback\b|\bdorsal\b|\binterscapular\b/, 'radiation_to_back'),
  r(/\bgroin\b|\bgenitalia\b|\btestic\w*|\bscrotum\b|\blabia\b/, 'radiation_to_groin'),
  r(/\bshoulder\b/, 'shoulder_tip_pain'),
  r(/\bleft shoulder\b/, 'kehr_sign'),
  r(/\barms?\b|\bjaw\b|\bneck\b/, 'radiation_arm_jaw'),
  r(/\bchest\b/, 'chest_pain'),
  r(/\b(down|into) (the )?legs?\b|\bsciatica\b|\bbelow the knee\b/, 'sciatica'),
];

const CHARACTER_RULES: Rule[] = [
  r(/\bcolicky\b|\bcramp\w*|\bgriping\b|\bwave/, 'colicky_pain'),
  r(/\btearing\b|\bripping\b/, 'tearing_pain'),
  r(/\bpleuritic\b/, 'pleuritic_chest_pain'),
  r(/\bpulsatile\b|\bexpansile\b/, 'pulsatile_mass'),
  r(/\bbloating\b/, 'abdominal_distension'),
  r(/\bthunderclap\b/, 'thunderclap_headache'),
  r(/\btender\b/, 'localised_pain'),
];

const ONSET_ACUTE = /\b(today|yesterday|this morning|last night|overnight|tonight|hours?|hrs?|[1-7] days?|2–3 days|4–7 days|a few days|couple of days|days ago|< ?6 hours|6–24 hours|1–3 days|sudden)\b/;
const ONSET_CHRONIC = /\b(\d+\s*(–|-|to)\s*\d+\s*months?|\d+ months?|months|over a year|years?|> ?6 weeks|> 6 months|[4-9] weeks|1\d weeks)\b/;

const TIMING_RULES: Rule[] = [
  r(/\bintermittent\b|\bepisodic\b|\bcomes and goes\b|\bcolicky\b/, 'episodic_pain'),
  r(/\bpost.?prandial\b|\bafter (meals|eating|food)\b|\bpost-meal\b/, 'postprandial_pain'),
  r(/\bnocturnal\b|\bat night\b|\bwakes? (from|at) (sleep|night)\b/, 'nocturnal_pain'),
  r(/\bprogressive\b|\bworse over time\b|\bworsening\b|\bgetting worse\b/, 'progressive_course'),
];

const TRIGGERS_RULES: Rule[] = [
  r(/\bmovement\b|\bmoving\b|\bwalking\b|\bcough\w*|\bbumps\b/, 'pain_worse_movement'),
  r(/\beating\b|\bmeals?\b|\bfood\b/, 'postprandial_pain'),
  r(/\bfatty\b|\bgreasy\b|\bfried\b|\boily\b/, 'fatty_food_trigger'),
  r(/\bdeep breath\w*|\binspiration\b|\bbreathing in\b/, 'pleuritic_chest_pain'),
  r(/\blying flat\b|\blying down\b|\bbending\b/, 'worse_lying_flat'),
  r(/\bstrain\w*|\bvalsalva\b|\blifting\b/, 'worse_straining'),
  r(/\bdefa?ecation\b|\bopening (his|her|the)? ?bowels\b|\bpassing stool\b/, 'pain_on_defaecation'),
  r(/\bexertion\b|\bexercise\b|\bstairs\b/, 'exertional_symptoms'),
  r(/\bsolids\b(?! and liquids)/, 'dysphagia_solids'),
  r(/\bboth solids and liquids\b|\bliquids\b/, 'dysphagia_liquids'),
];

const RELIEF_RULES: Rule[] = [
  r(/\bsitting forward\b|\bleaning forward\b/, 'relief_sitting_forward'),
  r(/\bmanual reduction\b|\breduc\w*/, 'hernia_compressible'),
];
/** "Antacids", "Gaviscon helps" — but not "antacids did not help" / "no help" / "nothing helps". */
const ANTACID = /\b(antacids?|gaviscon|omeprazole|lansoprazole|ppi|ranitidine|rennie)\b/;
const NO_HELP = /\b(not|no|didn'?t|did not|doesn'?t|does not|nothing|without|never)\b[^.]{0,15}\b(help|helps|helped|relie\w*|benefit|effect|work\w*)\b|\bno (help|relief|benefit|effect)\b|\bunhelpful\b/;

/** Answer keys whose text describes what changes a symptom, not a symptom of its own. */
const TRIGGER_HEADS = new Set(['triggers', 'exacerbating', 'aggravating', 'relief', 'relieving']);

/**
 * History-frame answer keys (lib/triage-engine/src/history-frames: cough, breathlessness, lump,
 * bleeding … frames, and the region-specific pain sites). Each rule maps a chip to an existing pane
 * feature; a chip with no feature is record-only (history-frames/record-only.ts).
 * lint:history-frames checks both directions.
 *
 * Answers under these keys get these rules plus the general vocabulary (TEXT_RULES); for a
 * non-pain frame without the pain-only features (FRAME_PAIN_ONLY): "Nocturnal" cough is not
 * nocturnal pain, "Episodic" breathlessness is not episodic pain.
 */
export const FRAME_KEY_RULES: Record<string, Rule[]> = {
  // Pain — region sites that the generic SITE_RULES do not cover.
  neck_site: [r(/./, 'neck_pain'), r(/\bthroat\b/, 'sore_throat'), r(/\bthyroid\b/, 'thyroid_swelling')],
  back_site: [r(/./, 'back_pain')],
  limb_site: [r(/./, 'limb_pain'), r(/\bfoot\b/, 'foot_problem')],
  joint_site: [r(/./, 'joint_pain')],
  genital_site: [r(/\b(testis|scrotum|bilateral)\b/, 'testicular_pain'), r(/\bgroin\b/, 'groin_pain')],
  // Cough
  cough_character: [r(/\bproductive\b/, 'productive_cough')],
  sputum: [r(/./, 'productive_cough'), r(/\bpurulent\b|\bgreen\b|\byellow\b|\brusty\b|\bfoul\b/, 'purulent_sputum'),
    r(/\bpink frothy\b/, 'pulmonary_oedema_cxr')],
  haemoptysis: [],
  cough_timing: [r(/\bprogressive\b/, 'progressive_course')],
  cough_triggers: [r(/\bexercise\b/, 'exertional_symptoms'), r(/\blying flat\b/, 'worse_lying_flat')],
  cough_relief: [r(/\bppi\b|\bantacid/, 'antacid_relief'), r(/\bace inhibitor\b/, 'acei_arb_use')],
  cough_exposure: [r(/\bace inhibitor\b/, 'acei_arb_use'), r(/\bsmoker\b/, 'smoker')],
  cough_assoc: [r(/\breflux\b/, 'heartburn')],
  // Breathlessness
  dyspnoea_exertion: [r(/\bmrc [1-5]\b/, 'exertional_symptoms'), r(/\bat rest\b/, 'speech_breathless')],
  orthopnoea: [r(/./, 'orthopnoea')],
  dyspnoea_timing: [r(/\bprogressive\b/, 'progressive_course')],
  dyspnoea_assoc: [r(/\bcalf swelling\b/, 'unilateral_leg_swelling', 'leg_swelling')],
  dyspnoea_triggers: [],
  dyspnoea_relief: [],
  dyspnoea_risk: [r(/\bsmoker\b/, 'smoker'), r(/\bsurgery or immobility\b/, 'recent_immobility', 'recent_surgery'),
    r(/\blong-haul\b/, 'recent_immobility'), r(/\boestrogen\b/, 'oestrogen_use')],
  // Lump / swelling
  lump_site: [
    r(/\binguinal\b/, 'groin_swelling', 'hernia_swelling'), r(/\bfemoral\b/, 'groin_swelling', 'below_inguinal_ligament', 'hernia_swelling'),
    r(/\bumbilical\b|\bparaumbilical\b/, 'umbilical_swelling', 'hernia_swelling'),
    r(/\bepigastric \/ linea alba\b/, 'epigastric_swelling', 'hernia_swelling'),
    r(/\bincisional\b/, 'incisional_swelling', 'previous_surgery'), r(/\bparastomal\b/, 'parastomal_bulge', 'stoma'),
    r(/\bscrotum\b|\btestis\b|\bepididymis\b|\bcord\b|\bhemiscrotum\b/, 'scrotal_swelling'),
    r(/\bthyroid\b/, 'thyroid_swelling', 'neck_lump'), r(/\banterior triangle\b/, 'anterior_triangle_lump', 'neck_lump'),
    r(/\bposterior triangle\b|\bsupraclavicular\b|\bsubmandibular\b|\bsubmental\b|\boccipital\b|\bmidline\b|\bdiffuse neck\b|\bneck\b/, 'neck_lump'),
    r(/\bparotid\b/, 'parotid_swelling', 'neck_lump'),
    r(/\b(ruq|epigastric|luq|right flank|periumbilical|left flank|rlq|suprapubic|llq)\b/, 'abdominal_mass'),
    r(/\baxilla\b/, 'axillary_nodes'), r(/\bgroin\b/, 'groin_swelling'),
    r(/\b(scalp|face|shoulder|back|chest wall|abdominal wall|arm|forearm|hand|thigh|lower leg|foot)\b/, 'soft_tissue_lump'),
    r(/\bperianal\b/, 'perianal_swelling'),
  ],
  lump_size: [r(/\brapid growth\b/, 'rapid_growth'), r(/\bfluctuates\b/, 'hernia_compressible')],
  lump_character: [r(/\bhard\b|\birregular\b|\bfixed\b/, 'deep_lump'), r(/\bfluctuant\b/, 'swelling_fluctuant_soft'),
    r(/\bpulsatile\b/, 'pulsatile_mass'), r(/\bmatted\b/, 'cervical_nodes')],
  lump_tenderness: [r(/\btender\b|\bpainful\b/, 'localised_pain')],
  lump_skin: [r(/\bredness\b/, 'erythema_surrounding'), r(/\bpunctum\b/, 'punctum'), r(/\bulcerated\b/, 'skin_ulceration'),
    r(/\bdischarging\b/, 'discharge_pus')],
  lump_assoc: [r(/\bpain on straining\b/, 'worse_straining'), r(/\bchronic cough\b/, 'cough'),
    r(/\blower urinary tract symptoms\b/, 'prostate_symptoms'), r(/\bheavy lifting\b/, 'worse_straining'),
    r(/\babdominal pain\b/, 'abdominal_pain'), r(/\bear pain\b/, 'neck_pain'), r(/\brecent infection\b/, 'sore_throat')],
  lump_systemic: [],
  lump_movement: [r(/\bmoves on swallowing\b/, 'thyroid_swelling'), r(/\btongue protrusion\b/, 'neck_lump')],
  lump_nodes: [r(/\bmultiple nodes\b/, 'cervical_nodes'), r(/\baxillary\b/, 'axillary_nodes'), r(/\binguinal\b/, 'inguinal_nodes')],
  reducibility: [r(/\bcough impulse\b/, 'cough_impulse', 'hernia_swelling'), r(/^reducible$|\breduces on lying\b/, 'groin_lump_reducible', 'hernia_compressible'),
    r(/\birreducible\b/, 'hernia_irreducible')],
  transillumination: [r(/^transilluminates$/, 'swelling_fluctuant_soft'), r(/\bdoes not transilluminate\b|\bcannot get above\b/, 'testicular_mass'),
    r(/\bcan get above\b|\bseparate from the testis\b|\bbag of worms\b/, 'scrotal_swelling')],
  lump_depth: [r(/\bdeep to fascia\b|\bover 5 cm\b/, 'deep_lump'), r(/\bsubcutaneous\b/, 'soft_tissue_lump')],
  swelling_site: [r(/\b(right|left) leg\b/, 'unilateral_leg_swelling', 'leg_swelling'), r(/\bbilateral legs\b/, 'bilateral_leg_oedema', 'leg_swelling'),
    r(/\bankle only\b|\bto the knee\b|\bwhole leg\b/, 'leg_swelling')],
  swelling_character: [r(/\bpitting\b/, 'leg_swelling'), r(/^tender$/, 'calf_tenderness'), r(/\bwarm\b|\bred\b/, 'erythema_surrounding')],
  swelling_assoc: [r(/\bvisible varicosities\b/, 'varicosities'), r(/\bleg ulcer\b/, 'skin_ulceration')],
  swelling_risk: [r(/\bsurgery or immobility\b|\blong-haul\b/, 'recent_immobility'), r(/\bactive cancer\b/, 'known_malignancy'),
    r(/\boestrogen\b/, 'oestrogen_use')],
  // Breast
  breast_site: [r(/./, 'breast_lump'), r(/\baxilla\b/, 'axillary_nodes'), r(/^bilateral$/, 'bilateral_breast')],
  breast_character: [r(/\bhard\b|\birregular\b|\bfixed to\b/, 'breast_lump_hard'), r(/\bmobile\b|\bsmooth\b|\brubbery\b/, 'breast_lump_mobile'),
    r(/^tender$/, 'breast_pain'), r(/\bcystic\b|\bsoft\b|\bfirm\b|\bnon-tender\b/, 'breast_lump')],
  breast_size: [r(/\brapid growth\b/, 'rapid_growth'), r(/\bcyclical\b/, 'cyclical_breast_pain')],
  nipple_discharge: [r(/./, 'nipple_discharge'), r(/\bbloody\b|\bsingle duct\b/, 'bloody_nipple_discharge'), r(/\bmilky\b/, 'post_lactation'),
    r(/\bpurulent\b/, 'breast_redness')],
  breast_skin: [r(/\bdimpling\b|\btethering\b|\bpeau d'orange\b/, 'skin_dimpling'), r(/\bnipple inversion\b/, 'nipple_inversion'),
    r(/\bredness\b/, 'breast_redness'), r(/\bnipple eczema\b|\bulceration\b/, 'skin_ulceration')],
  breast_assoc: [r(/\baxillary lump\b/, 'axillary_nodes'), r(/\bbreast pain\b/, 'breast_pain'), r(/\bbreastfeeding\b/, 'post_lactation')],
  breast_risk: [r(/\bprevious breast cancer\b/, 'known_malignancy'), r(/\bhrt \/ ocp\b/, 'oestrogen_use')],
  // Bleeding
  bleeding_site: [r(/\brectal\b/, 'pr_bleeding'), r(/\bvomit\b/, 'haematemesis'), r(/\burine\b/, 'haematuria'),
    r(/\bheavy periods\b/, 'abnormal_uterine_bleeding'), r(/\bafter surgery\b/, 'recent_surgery')],
  bleeding_colour: [r(/\bbright red\b|\bdark red\b|\bmaroon\b/, 'pr_bleeding'), r(/\bmelaena\b/, 'melaena')],
  bleeding_relation: [r(/./, 'pr_bleeding'), r(/\bmixed with stool\b/, 'change_bowel_habit')],
  bleeding_volume: [r(/\blarge with clots\b|\bmassive\b/, 'visible_blood_pr_large'), r(/\bmassive\b/, 'haemodynamic_instability')],
  bleeding_assoc: [r(/\bmucus\b/, 'mucus_pr'), r(/\bpain on defaecation\b/, 'pain_on_defaecation'), r(/\banal pain\b/, 'anal_pain'),
    r(/\bprotrusion\b/, 'prolapse_pr'), r(/\bclots\b/, 'visible_haematuria'), r(/\bmissed period\b/, 'missed_period')],
  bleeding_drugs: [r(/\banticoagulant\b/, 'anticoagulant_use'), r(/\bantiplatelet\b/, 'antiplatelet_use'), r(/\bnsaids\b/, 'nsaid_use')],
  bleeding_risk: [r(/\binflammatory bowel\b/, 'ulcerative_colitis_history'), r(/\balcohol\b/, 'alcohol_use'),
    r(/\bliver disease\b/, 'known_liver_disease'), r(/\bsmoker\b/, 'smoker'), r(/\bcatheter\b/, 'recent_surgery')],
  ugib_presentation: [r(/./, 'upper_gi_bleeding'), r(/\bhaematemesis\b|\bcoffee-ground\b/, 'haematemesis'), r(/\bmelaena\b/, 'melaena')],
  haematuria_type: [r(/./, 'haematuria'), r(/\bvisible\b/, 'visible_haematuria')],
  haematuria_stream: [r(/./, 'haematuria')],
  haematuria_pain: [r(/\bpainless\b/, 'painless_haematuria'), r(/\bloin pain\b/, 'loin_pain'), r(/\bdysuria\b/, 'dysuria')],
  pv_pattern: [r(/\bpostmenopausal\b/, 'postmenopausal_bleeding'), r(/\bpostcoital\b/, 'postcoital_bleeding'),
    r(/\bintermenstrual\b|\bheavy menstrual\b/, 'abnormal_uterine_bleeding'), r(/\bin pregnancy\b/, 'pregnant')],
  // Bowel habit
  bowel_change: [r(/\blooser\b/, 'diarrhoea', 'change_bowel_habit'), r(/^constipation$/, 'constipation', 'change_bowel_habit'),
    r(/\balternating\b/, 'change_bowel_habit'), r(/\babsolute constipation\b/, 'absolute_constipation')],
  stool: [r(/\bwatery\b/, 'diarrhoea'), r(/\bblood mixed in\b/, 'pr_bleeding', 'bloody_diarrhoea'), r(/^mucus$/, 'mucus_pr'),
    r(/\bpale greasy\b/, 'steatorrhoea'), r(/\bblack stools\b/, 'melaena'), r(/\bnocturnal diarrhoea\b/, 'diarrhoea')],
  bowel_frequency: [r(/./, 'diarrhoea')],
  bowel_assoc: [r(/\burgency\b/, 'tenesmus')],
  bowel_context: [r(/\bsuspect food\b|\bsick contacts\b/, 'sick_contacts'), r(/\bhospital admission\b/, 'recent_hospitalisation'),
    r(/\brecent antibiotics\b/, 'recent_antibiotics')],
  // Dysphagia
  dysphagia_type: [r(/./, 'dysphagia'), r(/^solids only$/, 'dysphagia_solids'), r(/\bsolids then liquids\b/, 'dysphagia_progressive', 'dysphagia_solids'),
    r(/\bliquids more than solids\b|\bboth solids and liquids\b/, 'dysphagia_liquids')],
  dysphagia_course: [r(/^progressive$/, 'dysphagia_progressive'), r(/./, 'dysphagia')],
  dysphagia_level: [r(/./, 'dysphagia'), r(/\bchest\b/, 'chest_pain_oesophageal')],
  dysphagia_assoc: [r(/\bfood bolus\b/, 'recurrent_bolus'), r(/\bvoice change\b/, 'hoarseness')],
  dysphagia_relief: [r(/\bliquids only\b/, 'dysphagia_solids')],
  // Jaundice
  jaundice_pain: [r(/./, 'jaundice'), r(/^painless$/, 'painless_jaundice'), r(/\bruq\b/, 'ruq_pain'), r(/\bcolicky\b/, 'colicky_pain'),
    r(/\bepigastric pain to the back\b/, 'epigastric_pain', 'radiation_to_back')],
  jaundice_urine: [r(/\bpruritus\b/, 'pruritus'), r(/\bpale stools\b/, 'steatorrhoea')],
  jaundice_assoc: [r(/\bdistension\b/, 'ascites')],
  jaundice_history: [r(/\bknown gallstones\b/, 'us_gallstones'), r(/\bbiliary surgery or ercp\b/, 'previous_surgery'),
    r(/\balcohol excess\b/, 'alcohol_use'), r(/\binjecting drug use\b/, 'injecting_drug_use'), r(/\bknown liver disease\b/, 'known_liver_disease')],
  // Vomiting
  vomit_content: [r(/./, 'nausea_vomiting'), r(/\bundigested food\b/, 'undigested_food_vomit'), r(/^bilious$/, 'bilious_vomiting'),
    r(/\bfresh blood\b|\bcoffee-ground\b/, 'haematemesis', 'upper_gi_bleeding'), r(/\bfaeculent\b/, 'absolute_constipation')],
  vomit_pattern: [r(/./, 'nausea_vomiting'), r(/\bprojectile\b/, 'projectile_vomiting'), r(/\beffortless\b/, 'vomiting_effortless')],
  vomit_frequency: [r(/./, 'nausea_vomiting'), r(/\bmore than 5\b|\bunable to keep fluids\b/, 'dehydration')],
  vomit_assoc: [r(/\bvertigo\b/, 'dizziness')],
  vomit_context: [r(/\bpossible pregnancy\b/, 'missed_period'), r(/\bnew medication\b/, 'recent_antibiotics'), r(/\bdiabetes\b/, 'known_diabetes'),
    r(/\brecent surgery\b/, 'recent_surgery', 'previous_surgery'), r(/\bsick contacts\b|\bsuspect food\b/, 'sick_contacts')],
  // Fever
  fever_pattern: [r(/./, 'fever')],
  fever_temperature: [r(/\b(38|39)\b/, 'fever')],
  fever_source: [r(/\bcough\b/, 'cough', 'productive_cough'), r(/\bfrequency\b/, 'frequency_urgency'),
    r(/\bwound\b/, 'wound_erythema', 'wound_discharge')],
  fever_exposure: [r(/\bflood water\b|\brat\b/, 'sick_contacts'), r(/\brecent surgery\b/, 'recent_surgery', 'previous_surgery'),
    r(/\bline or catheter\b/, 'recent_hospitalisation'), r(/\bimmunosuppressed\b/, 'immunosuppression'), r(/\bsick contacts\b/, 'sick_contacts')],
  // Urinary
  luts_storage: [r(/\bfrequency\b|\burgency\b/, 'frequency_urgency'), r(/\bnocturia\b/, 'nocturia'), r(/\burge incontinence\b/, 'urinary_incontinence')],
  luts_voiding: [r(/./, 'prostate_symptoms'), r(/\bincomplete emptying\b/, 'urinary_retention_symptoms')],
  urinary_pain: [r(/\bsuprapubic\b/, 'suprapubic_pain')],
  retention: [r(/\bunable to pass urine\b/, 'urinary_retention_symptoms'), r(/\boverflow\b/, 'overflow_incontinence', 'urinary_retention_symptoms')],
  urinary_assoc: [r(/\bvisible haematuria\b/, 'visible_haematuria'), r(/\burethral discharge\b/, 'urethral_discharge')],
  // Neurological
  weakness_distribution: [r(/\bone side\b/, 'focal_weakness', 'limb_weakness', 'facial_weakness'), r(/\bone limb\b/, 'focal_weakness', 'limb_weakness'),
    r(/\bboth legs\b/, 'bilateral_leg_symptoms', 'limb_weakness'), r(/\bproximal\b/, 'limb_weakness'), r(/\bgeneralised\b/, 'fatigue')],
  weakness_course: [r(/\bresolved\b/, 'symptoms_resolved'), r(/\bprogressive\b/, 'progressive_course')],
  neuro_assoc: [r(/\bfacial droop\b/, 'facial_weakness', 'focal_weakness'), r(/\bnumbness\b/, 'limb_numbness'), r(/\bunsteadiness\b/, 'gait_disturbance'),
    r(/\burinary retention\b/, 'urinary_retention_symptoms'), r(/\bweakness\b/, 'limb_weakness'), r(/\bburning pain\b/, 'peripheral_neuropathy'),
    r(/\bworse at night\b/, 'peripheral_neuropathy')],
  numbness_distribution: [r(/./, 'limb_numbness'), r(/\bglove and stocking\b/, 'peripheral_neuropathy'), r(/\bsaddle\b/, 'saddle_anaesthesia'),
    r(/\bone side of the body\b/, 'focal_weakness')],
  numbness_risk: [r(/\bdiabetes\b/, 'known_diabetes'), r(/\balcohol\b/, 'alcohol_use'), r(/\bchemotherapy\b/, 'known_malignancy')],
  dizziness_type: [r(/./, 'dizziness'), r(/\bunsteady\b/, 'ataxia', 'gait_disturbance')],
  dizziness_duration: [r(/./, 'dizziness')],
  dizziness_triggers: [r(/./, 'dizziness')],
  dizziness_assoc: [r(/\bdiplopia\b/, 'visual_disturbance'), r(/\bdysarthria\b/, 'speech_disturbance'), r(/\blimb ataxia\b/, 'ataxia'),
    r(/\bhearing loss\b|\btinnitus\b|\baural fullness\b/, 'dizziness')],
  // Skin
  skin_site: [r(/./, 'skin_lesion'), r(/\bsurgical wound\b/, 'recent_surgery'), r(/\b(toe|heel|sole|foot)\b/, 'foot_problem')],
  lesion_change: [r(/./, 'skin_lesion_change')],
  lesion_character: [r(/^pigmented$/, 'pigmented_lesion'), r(/\bulcerated\b/, 'ulcerated_lesion'), r(/\bbleeding\b/, 'skin_lesion_bleed'),
    r(/\bitchy\b/, 'pruritus'), r(/./, 'skin_lesion')],
  lesion_risk: [r(/\bimmunosuppressed\b/, 'immunosuppression'), r(/\bprevious skin cancer\b/, 'known_malignancy')],
  lesion_assoc: [r(/\bregional lymphadenopathy\b/, 'lymph_node_skin_area')],
  wound_appearance: [r(/\bwound erythema\b/, 'wound_erythema'), r(/\bspreading redness\b/, 'spreading_redness'), r(/\bwound swelling\b/, 'wound_swelling'),
    r(/\bwarmth\b/, 'erythema_surrounding'), r(/\bserous discharge\b/, 'wound_discharge'), r(/\bpus discharge\b/, 'wound_discharge', 'discharge_pus'),
    r(/\boffensive smell\b/, 'wound_discharge'), r(/\bwound opening\b/, 'wound_dehiscence_sign'), r(/\bnecrotic\b/, 'skin_necrosis'),
    r(/\bexposed bone\b/, 'probe_to_bone')],
  wound_pain: [r(/\bpain at site\b/, 'wound_pain'), r(/\bout of proportion\b/, 'pain_out_of_proportion')],
  wound_assoc: [r(/\bfeeling unwell\b/, 'fatigue')],
  wound_risk: [r(/\bdiabetes\b/, 'known_diabetes'), r(/\bsmoker\b/, 'smoker'), r(/\bsteroids\b/, 'steroid_use'),
    r(/\bperipheral arterial disease\b/, 'absent_pulses', 'vascular_risk'), r(/\bvenous disease\b/, 'varicosities')],
  rash_site: [r(/./, 'rash')],
  rash_character: [r(/./, 'rash'), r(/\bnon-blanching purpura\b/, 'non_blanching_rash'), r(/\burticarial\b/, 'urticaria_angioedema'),
    r(/\bblistering\b/, 'blistering')],
  rash_assoc: [r(/^itch$/, 'pruritus'), r(/\bnew medication\b/, 'allergen_exposure'), r(/\brecent illness\b/, 'sick_contacts'),
    r(/\bcontact exposure\b/, 'allergen_exposure')],
  // Weight loss, fatigue
  weight_amount: [r(/./, 'weight_loss')],
  weight_intent: [r(/^unintentional$/, 'weight_loss')],
  weight_appetite: [r(/\breduced appetite\b/, 'anorexia')],
  weight_assoc: [r(/\bpolyuria\b/, 'polyuria_polydipsia')],
  fatigue_pattern: [r(/./, 'fatigue')],
  fatigue_assoc: [r(/\bpolyuria\b/, 'polyuria_polydipsia'), r(/\bwitnessed apnoea\b/, 'fatigue'), r(/\bheavy periods\b/, 'abnormal_uterine_bleeding')],
  // Palpitations, syncope
  palpitation_onset: [r(/./, 'palpitations')],
  palpitation_rhythm: [r(/./, 'palpitations'), r(/^irregular$/, 'irregular_pulse')],
  palpitation_duration: [r(/./, 'palpitations')],
  palpitation_triggers: [r(/\bexertion\b/, 'exertional_symptoms'), r(/\bcaffeine or alcohol\b/, 'alcohol_use'), r(/./, 'palpitations')],
  palpitation_relief: [r(/\bvagal\b/, 'paroxysmal_episodes'), r(/./, 'palpitations')],
  palpitation_assoc: [r(/\bsweating\b/, 'diaphoresis'), r(/\banxiety\b/, 'anxiety_tremor')],
  syncope_setting: [r(/./, 'syncope'), r(/\bon exertion\b/, 'exertional_symptoms'), r(/\bno trigger\b/, 'sudden_onset')],
  syncope_prodrome: [r(/./, 'syncope'), r(/^no warning$/, 'sudden_onset')],
  syncope_event: [r(/./, 'syncope'), r(/\bjerking\b/, 'seizure')],
  syncope_recovery: [r(/./, 'syncope'), r(/\bprolonged confusion\b/, 'confusion')],
  syncope_assoc: [r(/\bpalpitations\b/, 'palpitations')],
  syncope_risk: [r(/\bknown heart disease\b/, 'known_heart_disease'), r(/\bsudden death\b/, 'known_heart_disease'),
    r(/\bantihypertensives\b/, 'known_hypertension')],
  // General symptom
  course: [r(/\bprogressive\b/, 'progressive_course')],
  general_severity: [],
  general_triggers: [r(/\bexertion\b/, 'exertional_symptoms'), r(/\beating\b/, 'postprandial_pain'), r(/\bmovement\b/, 'pain_worse_movement')],
  general_relief: [],
  general_assoc: [r(/^pain$/, 'localised_pain')],
};

/** Pain-frame keys in FRAME_KEY_RULES (the full general vocabulary applies). */
export const FRAME_PAIN_KEYS = new Set(['neck_site', 'back_site', 'limb_site', 'joint_site', 'genital_site']);

/** Pain-specific features the general vocabulary must not give a non-pain history answer. */
const FRAME_PAIN_ONLY = new Set(['episodic_pain', 'nocturnal_pain', 'postprandial_pain', 'colicky_pain', 'pain_worse_movement',
  'severe_pain', 'localised_pain', 'pain_out_of_proportion']);
const NON_PAIN_TEXT_RULES: Rule[] = TEXT_RULES
  .map(rule => ({ ...rule, features: rule.features.filter(f => !FRAME_PAIN_ONLY.has(f)) }))
  .filter(rule => rule.features.length > 0);

const KEY_RULES: Record<string, Rule[]> = {
  site: SITE_RULES, location: SITE_RULES,
  radiation: RADIATION_RULES,
  character: CHARACTER_RULES, type: CHARACTER_RULES,
  timing: TIMING_RULES, pattern: TIMING_RULES,
  triggers: TRIGGERS_RULES, exacerbating: TRIGGERS_RULES, aggravating: TRIGGERS_RULES,
  relief: RELIEF_RULES, relieving: RELIEF_RULES,
};

// ── 5. SmartSymptomPicker branch options that need the symptom for context ──────────
const DETAIL_RULES: Record<string, Rule[]> = {
  'abdominal pain': [
    r(/^back$/, 'radiation_to_back'), r(/^groin$/, 'radiation_to_groin'), r(/^loin$/, 'loin_pain'),
    r(/^chest$/, 'chest_pain'), r(/^shoulder tip$/, 'shoulder_tip_pain'),
    r(/^(< 6 hours|6–24 hours|1–3 days)$/, 'acute_onset'),
    r(/^movement$|^coughing$/, 'pain_worse_movement'), r(/^deep breathing$/, 'pleuritic_chest_pain'),
    r(/^lying flat$/, 'worse_lying_flat'), r(/^fatty meal$/, 'fatty_food_trigger'),
    r(/^post-meal$|^eating \/ drinking$/, 'postprandial_pain'), r(/^leaning forward$/, 'relief_sitting_forward'),
    r(/^intermittent \/ colicky$/, 'colicky_pain', 'episodic_pain'), r(/^worst ever \(10\)$/, 'severe_pain'),
    r(/^antacids$/, 'antacid_relief'),
  ],
  'chest pain': [
    r(/^crushing \/ pressure$/, 'chest_pain_pressure'), r(/^(left arm|right arm|jaw)$/, 'radiation_arm_jaw'),
    r(/^back \/ interscapular$/, 'radiation_to_back', 'back_pain'), r(/^epigastric$/, 'epigastric_pain'),
    r(/^tearing \/ ripping$/, 'tearing_pain'), r(/^burning$/, 'heartburn'), r(/^pleuritic$/, 'pleuritic_chest_pain'),
  ],
  'shortness of breath': [
    r(/^sudden$/, 'dyspnoea_pe'), r(/^nocturnal$/, 'orthopnoea'), r(/^oedema$/, 'leg_swelling'),
    r(/^worsening on exertion$/, 'exertional_symptoms'), r(/^chest pain$/, 'chest_pain'),
  ],
  vomiting: [
    r(/^bile$/, 'bilious_vomiting'), r(/^(blood|coffee grounds)$/, 'haematemesis'), r(/^projectile$/, 'projectile_vomiting'),
    r(/^after meals$/, 'postprandial_pain'), r(/^faeculent$/, 'absolute_constipation'),
  ],
  'black stool': [
    r(/^tarry \/ melaena$|^sticky$/, 'melaena'), r(/^nsaids$/, 'nsaid_use'), r(/^aspirin$/, 'antiplatelet_use'),
    r(/^anticoagulant$/, 'anticoagulant_use'), r(/^alcohol$/, 'alcohol_use'),
  ],
  dysphagia: [
    r(/^solids only$/, 'dysphagia_solids'), r(/^liquids too$/, 'dysphagia_liquids'), r(/^progressive$/, 'dysphagia_progressive'),
    r(/^painful \(odynophagia\)$/, 'odynophagia'), r(/^coughing on eating$/, 'aspiration_symptoms'),
  ],
  'breast lump': [
    r(/^(hard|fixed)$/, 'breast_lump_hard'), r(/^mobile$/, 'breast_lump_mobile'), r(/^tender$/, 'breast_pain'),
    r(/^(skin change|skin tethering)$/, 'skin_dimpling'), r(/^axillary lump$/, 'axillary_nodes'),
    r(/^(months|years|> 6 weeks)$/, 'chronic_course'), r(/^hrt \/ ocp$/, 'oestrogen_use'),
    r(/^prior breast cancer$/, 'known_malignancy'),
  ],
  'breast pain': [r(/^cyclical$/, 'cyclical_breast_pain'), r(/^lump$/, 'breast_lump')],
  'nipple discharge': [r(/^(bloody|single duct)$/, 'bloody_nipple_discharge')],
  hernia: [
    r(/./, 'hernia_swelling'),
    r(/^(right groin|left groin)$/, 'groin_swelling'), r(/^femoral$/, 'groin_swelling', 'below_inguinal_ligament'),
    r(/^umbilical$/, 'umbilical_swelling'), r(/^incisional$/, 'incisional_swelling', 'previous_surgery'),
    r(/^epigastric$/, 'epigastric_swelling'), r(/^easily reducible$/, 'hernia_compressible'),
    r(/^reducible with effort$/, 'hernia_compressible'), r(/^can't pass (gas|stool)$/, 'absolute_constipation'),
    r(/^tenderness$/, 'localised_pain'), r(/^redness$/, 'erythema_surrounding'), r(/^pain$/, 'localised_pain'),
  ],
  'wound discharge': [
    r(/^(wound opened|dehiscence)$/, 'wound_dehiscence_sign'), r(/^(redness|induration)$/, 'wound_erythema'),
    r(/^swelling$/, 'wound_swelling'), r(/^purulent$/, 'wound_discharge'), r(/^tachycardia$/, 'tachycardia'),
    r(/./, 'wound_discharge', 'recent_surgery', 'previous_surgery'),
  ],
  'fever after surgery': [
    r(/./, 'fever', 'recent_surgery', 'previous_surgery'), r(/^wound$/, 'wound_erythema'),
    r(/^chest$/, 'cough'), r(/^uti$/, 'dysuria'),
  ],
  'diabetic foot infection': [
    r(/./, 'foot_problem', 'known_diabetes'), r(/^ulcer$/, 'foot_ulcer'), r(/^abscess$/, 'swelling_fluctuant_soft'),
    r(/^cellulitis$/, 'erythema_surrounding'), r(/^gangrene$/, 'skin_necrosis'),
    r(/^(osteomyelitis suspected|exposed bone \/ tendon)$/, 'probe_to_bone'), r(/^loss of sensation$/, 'peripheral_neuropathy'),
    r(/^poor peripheral pulses$/, 'absent_pulses'), r(/^purulent discharge$/, 'discharge_pus'),
  ],
  headache: [
    r(/^(first \/ worst ever|thunderclap \(sudden worst-ever\))$/, 'thunderclap_headache', 'sudden_onset'),
    r(/^worsened by movement$/, 'pain_worse_movement'),
  ],
  'back pain': [
    r(/^down leg \(sciatica\)$/, 'sciatica'), r(/^bilateral legs$/, 'bilateral_leg_symptoms', 'sciatica'),
    r(/^bladder \/ bowel dysfunction$/, 'urinary_retention_symptoms'), r(/^night pain$/, 'nocturnal_pain'),
    r(/^progressive weakness$/, 'limb_weakness'), r(/^known malignancy$/, 'known_malignancy'),
    r(/^iv drug use$/, 'injecting_drug_use'), r(/^to groin$/, 'radiation_to_groin'), r(/^colicky$/, 'colicky_pain'),
  ],
  'lower back pain': [
    r(/^down leg \(sciatica\)$/, 'sciatica'), r(/^bilateral$/, 'bilateral_leg_symptoms', 'sciatica'),
    r(/^bladder \/ bowel dysfunction$/, 'urinary_retention_symptoms'), r(/^known cancer$/, 'known_malignancy'),
    r(/^progressive weakness$/, 'limb_weakness'), r(/^to groin \/ testicle$/, 'radiation_to_groin'),
    r(/^colicky \(renal colic\?\)$/, 'colicky_pain', 'loin_pain'), r(/^worse at night$/, 'nocturnal_pain'),
  ],
  syncope: [
    r(/^on exertion$/, 'exertional_symptoms'), r(/^no warning$/, 'sudden_onset'), r(/^witnessed convulsions$/, 'seizure'),
    r(/^tongue bite$/, 'tongue_bite'), r(/^incontinence$/, 'urinary_incontinence'), r(/^prolonged confusion after$/, 'confusion'),
    r(/^chest pain$/, 'chest_pain'),
  ],
  dizziness: [r(/^(true vertigo|disequilibrium)/, 'ataxia')],
  rash: [r(/^purpuric \(non-blanching\)$/, 'non_blanching_rash'), r(/^urticarial \(wheals\)$/, 'urticaria_angioedema'), r(/^recent medication$/, 'allergen_exposure')],
  'joint pain': [r(/^trauma$/, 'trauma_mechanism')],
  'pelvic pain': [r(/^with urination$/, 'dysuria'), r(/^post-coital$/, 'dyspareunia'), r(/^cyclical/, 'dysmenorrhoea')],
  jaundice: [r(/^known gallstones$/, 'us_gallstones'), r(/^prior ercp$/, 'previous_surgery')],
  'weight loss': [r(/^(1–3 months|3–6 months|> 6 months)$/, 'chronic_course'), r(/^abdominal mass$/, 'abdominal_mass')],
  'rectal bleeding': [r(/^massive$/, 'haemodynamic_instability')],
};

// ── Helpers ──────────────────────────────────────────────────────────────────────

/**
 * Apply `rules` to `text` (record-text-match.ts: negation, negated lists and family history for
 * every feature; historical / background / guessed mentions also for current findings).
 */
function applyRules(text: string, rules: Rule[], out: FeatureMap, contextText = ''): void {
  if (!text.trim()) return;
  const lower = text.toLowerCase();
  for (const rule of rules) {
    if (!rule.features.length || !rule.features[0]) continue;
    // `requires` (e.g. breast context for "hard", "cyclical") may be met by the CC template.
    if (rule.requires && !recordHas(text, rule.requires) && !recordHas(contextText, rule.requires)) continue;
    let matches = findRecordMatches(text, rule.pattern);
    if (rule.near) {
      const near = rule.near;
      const inContext = recordHas(contextText, near);
      matches = matches.filter(m => inContext || recordHas(sentenceOf(lower, m.index, m.index + m.text.length), near));
    }
    if (!matches.length) continue;
    for (const f of rule.features) {
      if (CURRENT_FEATURES.has(f) && matches.every(m => notCurrentAt(lower, m.index, m.index + m.text.length))) continue;
      out[f] = true;
    }
  }
}

function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** First number in a result text ("412 ng/L", "K+ 6.9 mmol/L", "<5" → null). */
function firstNumber(text: string): number | null {
  if (/^\s*[<≤]/.test(text)) return null;
  const m = /-?\d+(?:\.\d+)?/.exec(text.replace(/,(\d{3})/g, '$1'));
  return m ? Number(m[0]) : null;
}

/**
 * Vital-sign features. Adult thresholds: NEWS2 (RCP 2017) / Sepsis-3 qSOFA (RR ≥ 22,
 * SBP ≤ 100 is qSOFA; hypotension here is SBP < 90, ATLS / NICE NG51 high risk), ESC/ESH
 * (≥ 140/90 raised; ≥ 180/120 severe), NICE NG133 (≥ 160/110 severe in pregnancy). Children
 * (< 12 y): upper limits of the APLS (6th ed., 2016) normal ranges; hypotension SBP < 70 + 2 ×
 * age (1–10 y).
 */
function vitalFeatures(ctx: PaneFeatureContext, out: FeatureMap, textPregnant: boolean): void {
  const v = ctx.vitals ?? {};
  const age = ctx.age ?? null;
  const temp = num(v.temperatureC);
  const hr = num(v.heartRate);
  const sbp = num(v.systolicBp);
  const dbp = num(v.diastolicBp);
  const rr = num(v.respiratoryRate);
  const spo2 = num(v.spo2);
  const glucose = num(v.glucoseMmol);
  const avpu = typeof v.avpu === 'string' ? v.avpu.trim().toUpperCase() : '';
  const child = age !== null && age < 12;

  if (temp !== null) {
    if (temp >= 38.0) out.fever = true;
    if (temp < 36.0) out.hypothermia = true;
  }
  if (hr !== null) {
    const tachy = !child ? 100 : age! < 1 ? 160 : age! < 2 ? 150 : age! < 5 ? 140 : 120;
    if (hr > tachy) out.tachycardia = true;
    if (!child && hr < 50) out.bradycardia = true;
    if (!child && hr > 120) out.haemodynamic_instability = true;
  }
  if (sbp !== null) {
    const hypo = !child ? 90 : age! < 1 ? 70 : 70 + 2 * Math.min(10, Math.floor(age!));
    if (sbp < hypo) { out.hypotension = true; out.haemodynamic_instability = true; }
  }
  if (sbp !== null || dbp !== null) {
    const s = sbp ?? 0;
    const d = dbp ?? 0;
    if (!child && (s >= 140 || d >= 90)) out.raised_bp = true;
    const pregnant = !!ctx.pregnancyPossible || textPregnant;
    if (!child && ((s >= 180 || d >= 120) || (pregnant && (s >= 160 || d >= 110)))) out.severe_hypertension = true;
  }
  if (rr !== null) {
    const tachyRr = !child ? 22 : age! < 1 ? 50 : age! < 5 ? 40 : 30;
    if (rr >= tachyRr) out.tachypnoea = true;
  }
  if (spo2 !== null && spo2 < 94) out.hypoxia = true;
  if (glucose !== null) glucoseFeatures(glucose, out);
  if (avpu === 'C') out.confusion = true;
  if (avpu === 'V' || avpu === 'P' || avpu === 'U') { out.gcs_drop = true; out.confusion = true; }
}

function glucoseFeatures(glucose: number, out: FeatureMap): void {
  // JBDS-IP: hyperglycaemia ≥ 11.1; HHS ≥ 30; hypoglycaemia < 4.0 mmol/L
  if (glucose >= 11.1) out.hyperglycaemia = true;
  if (glucose >= 30) out.very_high_glucose = true;
  if (glucose < 4.0) out.low_glucose = true;
}

/** Numeric laboratory thresholds, keyed by the investigation name. */
const LAB_RULES: { name: RegExp; apply: (value: number, out: FeatureMap) => void }[] = [
  // UK Kidney Association 2020: moderate hyperkalaemia K⁺ ≥ 6.0 mmol/L
  { name: /\bpotassium\b|^k\+?\b/, apply: (v, o) => { if (v >= 6.0 && v < 15) o.hyperkalaemia_lab = true; } },
  // Society for Endocrinology 2016: adjusted calcium > 2.6 mmol/L (mg/dL > 10.5)
  { name: /\bcalcium\b|^ca\b|\bca2\+/, apply: (v, o) => { if ((v > 2.6 && v < 5) || v > 10.5) o.hypercalcaemia_lab = true; } },
  // European hyponatraemia guideline 2014: moderate < 130 mmol/L
  { name: /\bsodium\b|^na\+?\b/, apply: (v, o) => { if (v < 130 && v > 90) o.hyponatraemia_lab = true; } },
  { name: /\bglucose\b|\bcbg\b|\bbm\b|\bblood sugar\b/, apply: (v, o) => glucoseFeatures(v, o) },
  // JBDS-IP DKA 2023: capillary / blood ketones ≥ 3.0 mmol/L
  { name: /\bketone|\bbeta.?hydroxybutyrate\b|\bbhb\b/, apply: (v, o) => { if (v >= 3.0) o.ketonaemia = true; } },
  { name: /\bbicarbonate\b|\bhco3\b|\bbicarb\b/, apply: (v, o) => { if (v < 15) o.metabolic_acidosis = true; } },
  { name: /\bpaco2\b|\bpco2\b/, apply: (v, o) => { if (v > 6.0 && v < 20) o.hypercapnia = true; } },
  // Sepsis-3 / NICE NG51: lactate ≥ 2 mmol/L
  { name: /\blactate\b/, apply: (v, o) => { if (v >= 2) o.raised_lactate = true; } },
  // hs-troponin above the 99th centile (≈ 14 ng/L hs-cTnT); conventional units < 1 ng/mL
  { name: /\btroponin\b|\btnt\b|\btni\b/, apply: (v, o) => { if (v > 14 || (v > 0.04 && v < 1)) o.raised_troponin = true; } },
  { name: /\bcreatinine\b/, apply: (v, o) => { if (v > 130 || (v > 1.5 && v < 20)) o.raised_creatinine = true; } },
  { name: /\burea\b|\bbun\b/, apply: (v, o) => { if (v > 8) o.raised_urea = true; } },
  { name: /\bwbc\b|\bwcc\b|white cell|\bleu[ck]ocytes?\b(?! esterase)/, apply: (v, o) => { if (v > 11 && v < 200) o.elevated_wbc = true; } },
  { name: /\bneutrophil/, apply: (v, o) => { if (v < 1.0) o.neutropenia = true; if (v > 7.5 && v < 200) o.elevated_wbc = true; } },
  // Anaemia: Hb < 110 g/L (values < 25 read as g/dL)
  { name: /\bha?emoglobin\b|^hb\b/, apply: (v, o) => { const gl = v < 25 ? v * 10 : v; if (gl < 110) o.anaemia = true; } },
  { name: /\bplatelet|\bplt\b/, apply: (v, o) => { if (v < 150) o.thrombocytopenia = true; } },
  // > 3 × upper limit of normal (amylase ≈ 100 U/L, lipase ≈ 60 U/L)
  { name: /\bamylase\b/, apply: (v, o) => { if (v > 300) o.elevated_amylase = true; } },
  { name: /\blipase\b/, apply: (v, o) => { if (v > 180) o.elevated_amylase = true; } },
  { name: /\bcrp\b|c-reactive/, apply: (v, o) => { if (v > 20) o.raised_crp = true; } },
  { name: /\balt\b|\bast\b|\btransaminase/, apply: (v, o) => { if (v > 100) o.raised_liver_enzymes = true; } },
  { name: /\bbilirubin\b/, apply: (v, o) => { if (v > 40) o.jaundice = true; } },
  // NICE DG56 / NG12: FIT ≥ 10 µg Hb/g
  { name: /\bfit\b|faecal immunochemical/, apply: (v, o) => { if (v >= 10) o.positive_fit = true; } },
  { name: /\bhcg\b/, apply: (v, o) => { if (v >= 25) o.positive_pregnancy_test = true; } },
  { name: /\bpeak (expiratory )?flow\b|\bpef\b/, apply: () => { /* needs % predicted — read from text */ } },
];

/** Findings stated in result text (imaging, ECG, urinalysis, point-of-care tests). */
const RESULT_TEXT_RULES: Rule[] = [
  r(/\bst.?(segment )?elevation\b|\bstemi\b|\bnew lbbb\b/, 'st_elevation'),
  r(/\batrial fibrillation\b|\batrial flutter\b|\bfast af\b|\baf with\b|\b(rapid|uncontrolled) af\b/, 'af_on_ecg', 'irregular_pulse'),
  r(/\b(complete|third.degree|2:1|second.degree|mobitz\w*) (heart |av )?block\b|\bchb\b|\bjunctional escape\b/, 'heart_block_ecg'),
  r(/\bpeaked t\b|\btented t\b|\bbroad qrs\b|\bsine wave\b/, 'hyperkalaemia_ecg'),
  r(/\bgallstones?\b|\bcholelithiasis\b|\bcalculi (in|within) the gallbladder\b|\bgallbladder wall thicken\w*|\bpericholecystic\b/, 'us_gallstones'),
  r(/\b(cbd|common bile duct)\b[^.]{0,20}\b(dilat\w*|1\d ?mm|[89] ?mm)\b|\bdilated (cbd|common bile duct|biliary tree|intrahepatic ducts)\b|\bbiliary dilat\w*/, 'dilated_cbd'),
  r(/\bfree (intraperitoneal )?(air|gas)\b|\bpneumoperitoneum\b|\bair under the diaphragm\b/, 'free_gas'),
  r(/\bconsolidation\b|\blobar (pneumonia|opacity|shadowing)\b|\bair bronchograms?\b/, 'consolidation'),
  r(/\bpulmonary o?edema\b|\bbat.?wing\b|\bkerley\b|\bupper lobe diversion\b|\bcardiomegaly\b/, 'pulmonary_oedema_cxr'),
  r(/\bhydronephros\w*|\bhydroureter\w*/, 'hydronephrosis'),
  r(/\b(ureteric|vuj|pui|renal|obstructing) (stone|calcul\w*)\b/, 'known_stone'),
  r(/\baneurysm\b|\baaa\b|\baortic diameter\b/, 'known_aaa'),
  r(/\btarget sign\b|\bdoughnut sign\b|\bpseudo.?kidney\b|\bintussuscept\w*/, 'target_sign'),
  r(/\bpyloric (muscle )?(thickness|thicken\w*|length|channel)\b|\bhypertrophied pylorus\b/, 'pyloric_thickening'),
  r(/\bwhirlpool\b|\bcorkscrew\b|\babnormal (sma|smv|sma\/smv) (relationship|orientation)\b|\bduodenojejunal flexure (is )?(low|abnormal|right)\b/, 'whirlpool_sign'),
  r(/\bfree fluid\b|\bha?emoperitoneum\b/, 'pelvic_free_fluid'),
  r(/\b(adnexal|ovarian) (mass|cyst)\b|\bdermoid\b|\benlarged (left |right )?ovary\b/, 'adnexal_mass'),
  r(ADRENAL_MASS, 'adrenal_mass'),
  r(/\bpneumatosis\b|\bportal venous gas\b|\bmesenteric (artery |vessel |vein )?(occlusion|thromb\w*|embol\w*)\b|\bsma (occlusion|thromb\w*|embol\w*)\b|\bnon.?enhancing (bowel|small bowel)\b/, 'mesenteric_ct_signs'),
  r(/\bgas in the soft tissues?\b|\bsoft.?tissue (gas|emphysema)\b|\bsubcutaneous gas\b/, 'crepitus_soft_tissue'),
  r(/\bosteomyelitis\b|\bcortical (erosion|destruction)\b|\bperiosteal reaction\b/, 'probe_to_bone'),
  r(/\bcord compression\b|\bepidural (mass|metastas\w*|disease)\b|\bvertebral (metastas\w*|collapse|body destruction)\b|\bspinal metastas\w*/, 'spinal_mets_imaging'),
  r(/\bcauda equina (compression|syndrome)\b|\bcompression of the cauda equina\b|\bmassive (central )?disc (prolapse|herniation|extrusion)\b/, 'cauda_compression_imaging'),
  r(/\bsubarachnoid (blood|ha?emorrhage)\b|\bxanthochromia\b/, 'sah_imaging'),
  r(/\bacute (infarct|ischa?emi\w*)\b|\bmca territory\b|\bintracerebral ha?emorrhage\b|\bhyperdense (mca|vessel)\b/, 'stroke_imaging'),
  r(/\bcsf\b[^.]{0,40}\b(neutrophil\w*|turbid|cloudy|pleocytosis)\b|\bgram.?(positive|negative) (diplococci|cocci|rods)\b/, 'csf_bacterial'),
  r(/\bketones?\s*(\+\+|3\+|4\+|\+\+\+|large)|\bketonuria\b/, 'ketonaemia'),
  r(/\bnitrites?\s*(\+|positive|pos\b)|\bleu[ck]ocytes?\s*(\+|[1-4]\+|positive|pos\b)|\bpyuria\b|\bleu[ck]ocyte esterase (\+|positive)/, 'positive_urinalysis'),
  r(/\bproteinuri\w*|\bprotein\s*(\+{1,4}|[1-4]\+)/, 'proteinuria'),
  r(/\b(pregnancy test|upt|urine hcg)\b[^.]{0,10}\b(positive|\+ve|pos)\b|\bpositive (pregnancy test|hcg|upt)\b/, 'positive_pregnancy_test'),
  r(/\bpeak flow\b[^.]{0,20}\b([1-6]\d|7[0-4]) ?%/, 'reduced_peak_flow'),
  r(/\bhypochlora?emic\b|\bmetabolic alkalosis\b/, 'metabolic_alkalosis'),
];

function resultFeatures(results: Record<string, string>, out: FeatureMap): void {
  for (const [name, value] of Object.entries(results)) {
    if (!value) continue;
    const n = name.toLowerCase().trim();
    const text = `${name}: ${value}`;
    const v = firstNumber(value);
    if (v !== null) for (const lab of LAB_RULES) if (lab.name.test(n)) lab.apply(v, out);
    if (/troponin/i.test(n) && recordHas(value, /\b(raised|elevated|positive|rising|high)\b/)) out.raised_troponin = true;
    applyRules(text, RESULT_TEXT_RULES, out);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────────

/**
 * Extract pane-engine feature IDs from a CC template name, its SOCRATES answers and (optionally)
 * the rest of the consultation record.
 *
 * @param cc        Chief complaint template label (e.g. "Acute abdominal pain")
 * @param answers   Record<socratesKey, answerText> from ChiefComplaintStrip
 * @param context   Symptom chips, vitals, history, results and free text (PaneFeatureContext)
 * @returns         Record<featureId, boolean>: true = present; false only for the four gates
 */
export function extractFeaturesFromSocrates(
  cc: string,
  answers: Record<string, string>,
  context?: PaneFeatureContext,
): FeatureMap {
  const out: FeatureMap = {};

  // Pass 1 — CC template hints
  for (const hint of CC_HINTS) {
    if (hint.pattern.test(cc)) for (const f of hint.features) out[f] = true;
  }

  // Pass 2 — SOCRATES answers: key-specific rules + the general vocabulary
  const characterText = Object.entries(answers)
    .filter(([k]) => /^(character|type)/i.test(k)).map(([, v]) => v).join(' ').toLowerCase();
  const siteText = Object.entries(answers)
    .filter(([k]) => /^(site|location)/i.test(k)).map(([, v]) => v).join(' ').toLowerCase();
  const isLump = LUMP_CHARACTER.test(characterText) || /\b(lump|swelling|mass|hernia|nodule)\b/i.test(cc);
  for (const [key, raw] of Object.entries(answers)) {
    const text = (raw ?? '').trim();
    if (!text) continue;
    const normKey = key.toLowerCase().replace(/[\s_-]+/g, '_').replace(/[^a-z_]/g, '');
    const head = normKey.split('_')[0];
    const frameRules = FRAME_KEY_RULES[normKey];
    if (frameRules) {
      // A history-frame answer (cough, lump, bleeding … or a region-specific pain site).
      applyRules(text, frameRules, out, cc);
      applyRules(text, FRAME_PAIN_KEYS.has(normKey) ? TEXT_RULES : NON_PAIN_TEXT_RULES, out, cc);
      continue;
    }
    const rules = KEY_RULES[normKey] ?? KEY_RULES[head] ?? [];
    applyRules(text, rules, out, cc);
    if (TRIGGER_HEADS.has(head)) {
      // "Worse on coughing" is a manoeuvre that aggravates the pain, not a cough (history-by-complaint
      // audit: the pain Aggravating chip "Coughing" used to add the cough feature).
      const general: FeatureMap = {};
      applyRules(text, TEXT_RULES, general, cc);
      delete general.cough;
      Object.assign(out, general);
    } else {
      applyRules(text, TEXT_RULES, out, cc);
    }
    if (head === 'site' || head === 'location') {
      for (const s of SITE_PAIN_OR_LUMP) {
        if (recordHas(text, s.pattern)) for (const f of (isLump ? s.lump : s.pain)) out[f] = true;
      }
    }
    if (head === 'onset' || head === 'duration') {
      if (recordHas(text, ONSET_ACUTE)) out.acute_onset = true;
      if (recordHas(text, ONSET_CHRONIC)) out.chronic_course = true;
    }
    if (head === 'severity' && recordHas(text, /\b(worst|10\s*\/\s*10|\(10\))/)) out.severe_pain = true;
    if (head === 'relief' || head === 'relieving' || head === 'triggers') {
      if (recordHas(text, ANTACID) && !NO_HELP.test(text.toLowerCase())) out.antacid_relief = true;
    }
    if (head === 'character' && recordHas(text, /\bburning\b/) && /\b(epigastri|retrosternal|chest|upper)/i.test(siteText)) {
      out.heartburn = true;
    }
    if (head === 'character' && recordHas(text, /\bpressure\b|\bcrushing\b|\bheavy\b/) && /\b(chest|retrosternal|central)\b/i.test(siteText)) {
      out.chest_pain_pressure = true;
    }
    if (head === 'lmp' && /\b([5-9]|1\d)\s*weeks\b/i.test(text)) out.missed_period = true;
  }

  if (context) extractFromContext(context, out, cc);

  // Progressive course only counts over weeks to months, not a worsening acute pain.
  if (out.progressive_course && !out.chronic_course) delete out.progressive_course;
  if (out.acute_onset && out.chronic_course) delete out.acute_onset;
  // "Chest" radiation of epigastric pain is not chest pain of cardiac or oesophageal origin
  // unless something else says so; keep it but it is weak (base rate 0.04).

  // Only present findings, plus the explicit gate negatives set in extractFromContext.
  const result = Object.fromEntries(Object.entries(out).filter(([, v]) => v === true || v === false));
  // Examination signs (present, or examined and absent) and recorded decision rules come last.
  return withExamEvidence(result, context?.evidence);
}

function extractFromContext(ctx: PaneFeatureContext, out: FeatureMap, cc: string): void {
  // Symptom chips and their branch options
  for (const s of ctx.symptoms ?? []) applyRules(s, [...TEXT_RULES, ...CHIP_RULES], out, cc);
  for (const [sym, options] of Object.entries(ctx.symptomDetails ?? {})) {
    const symKey = sym.toLowerCase().trim();
    const detailRules = DETAIL_RULES[symKey] ?? [];
    for (const opt of options) {
      const o = opt.toLowerCase().trim();
      for (const rule of detailRules) {
        if (rule.features[0] && rule.pattern.test(o)) for (const f of rule.features) out[f] = true;
      }
      applyRules(opt, TEXT_RULES, out, `${symKey} ${cc}`);
      if (symKey === 'abdominal pain') applyRules(opt, SITE_RULES, out);
    }
  }
  // Examination chips (section: [chip, ...])
  for (const [section, chips] of Object.entries(ctx.examFindings ?? {})) {
    // The sign chips are structured evidence (exam-evidence-features.ts), not free text.
    if (section === EXAM_SIGNS_KEY) continue;
    for (const chip of chips) applyRules(`${chip}`, TEXT_RULES, out, cc);
  }
  // History lists
  for (const item of [...(ctx.comorbidities ?? []), ...(ctx.medications ?? []), ...(ctx.surgicalHistory ?? [])]) {
    applyRules(item, HISTORY_RULES, out);
  }
  for (const c of ctx.comorbidities ?? []) {
    if (recordHas(c, /\b(cancer|carcinoma|malignan\w*|lymphoma|myeloma|leuka?emia|metasta\w*)\b/)) out.known_malignancy = true;
    if (/^\s*af\s*$/i.test(c)) out.known_af = true;
  }
  if ((ctx.surgicalHistory ?? []).some(s => s.trim())) {
    applyRules(joinClauses(ctx.surgicalHistory ?? []), [r(/\w/, 'previous_surgery')], out);
  }
  // Free text
  const narrative = joinClauses(ctx.narrative ?? []);
  applyRules(narrative, TEXT_RULES, out, cc);
  applyRules(narrative, HISTORY_RULES, out);
  // Results
  if (ctx.investigationResults) resultFeatures(ctx.investigationResults, out);
  // Duration
  const days = ctx.durationDays ?? null;
  if (days !== null && Number.isFinite(days)) {
    if (days <= 7) out.acute_onset = true;
    if (days >= 30) out.chronic_course = true;
  }
  // Post-operative state
  const postOpDays = ctx.postOpDays ?? null;
  if (ctx.isPostOp && (postOpDays === null || postOpDays <= 30)) { out.recent_surgery = true; out.previous_surgery = true; }
  if (out.recent_surgery && out.fever) out.postop_fever = true;
  // Vital signs
  vitalFeatures(ctx, out, !!out.pregnant);

  // ── Gates (documented absence) ──
  // With a full record (a narrative or chips were supplied) and no sign of an injury, the trauma
  // diagnoses are not offered; likewise the post-operative complications without an operation in
  // the last 30 days. An unticked box never counts as "absent" on its own.
  const recordGiven = narrative.length >= 40 || (ctx.symptoms ?? []).length > 0;
  if (recordGiven && !out.trauma_mechanism && !out.burn_wound && !out.electrical_injury && !/\btrauma|injur|burn|scald/i.test(cc)) {
    out.trauma_mechanism = false;
  }
  if (recordGiven && !out.recent_surgery && !ctx.isPostOp) out.recent_surgery = false;
  // Likewise an aortic graft (aorto-enteric fistula) and a stoma (parastomal hernia) are always
  // documented when present.
  if (recordGiven && !out.aortic_graft) out.aortic_graft = false;
  if (recordGiven && !out.stoma) out.stoma = false;
}

/**
 * The consultation fields PANE reads, as AppContext holds them (strings as entered). Passing the
 * whole AppContext value is fine: only these fields are read.
 */
export interface ConsultationSnapshot {
  age: string;
  sex: string;
  pregnancyPossible: boolean;
  symptoms: string[];
  symptomDetails: Record<string, string[]>;
  vitals: Partial<Record<string, string>>;
  durationDays: string;
  isPostOp: boolean;
  postOpDays: string;
  comorbidities: string[];
  medications: string[];
  medicationsText: string;
  surgicalHistory: string[];
  toxicHabits: string[];
  pmhNotes: string;
  investigationResults: Record<string, string>;
  examFindings: Record<string, string[]>;
  freeText: string;
  hpiNotes: string;
  examGeneral: string;
  examCardio: string;
  examResp: string;
  examAbdomen: string;
  examNeuro: string;
  examExtremities: string;
  examBreast: string;
  examWound: string;
  /** Other examination sections (AppContext.examNotes). */
  examNotes: Record<string, string>;
  /** encounters.clinical_scores: the decision rules recorded for decision support. */
  clinicalScores: Record<string, unknown> | null;
}

function optNum(v: string | undefined | null): number | null {
  if (v === undefined || v === null || !String(v).trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Build the PANE feature context from the consultation (ChiefComplaintStrip.seedPane,
 * HpiTab.reseedPane and the clinval web runner all call this, so they read the same fields).
 */
export function paneContextFromConsultation(s: Partial<ConsultationSnapshot>): PaneFeatureContext {
  const v = s.vitals ?? {};
  return {
    age: optNum(s.age ?? null),
    sex: s.sex,
    pregnancyPossible: !!s.pregnancyPossible,
    symptoms: s.symptoms ?? [],
    symptomDetails: s.symptomDetails ?? {},
    vitals: {
      systolicBp: v.systolicBp ?? null, diastolicBp: v.diastolicBp ?? null, heartRate: v.heartRate ?? null,
      temperatureC: v.temperatureC ?? null, respiratoryRate: v.respiratoryRate ?? null, spo2: v.spo2 ?? null,
      glucoseMmol: v.glucoseMmol ?? null, avpu: v.avpu ?? null,
    },
    durationDays: optNum(s.durationDays ?? null),
    isPostOp: !!s.isPostOp,
    postOpDays: optNum(s.postOpDays ?? null),
    comorbidities: s.comorbidities ?? [],
    medications: [...(s.medications ?? []), ...(s.medicationsText ? [s.medicationsText] : [])],
    surgicalHistory: s.surgicalHistory ?? [],
    investigationResults: s.investigationResults ?? {},
    examFindings: s.examFindings ?? {},
    evidence: recordedEvidence({ examFindings: s.examFindings, clinicalScores: s.clinicalScores, age: optNum(s.age ?? null) }),
    narrative: [
      s.freeText, s.hpiNotes, s.pmhNotes, ...(s.toxicHabits ?? []),
      s.examGeneral, s.examCardio, s.examResp, s.examAbdomen, s.examNeuro, s.examExtremities, s.examBreast, s.examWound,
      ...Object.values(s.examNotes ?? {}),
    ].filter((t): t is string => !!t && !!t.trim()),
  };
}

/** Chip-only vocabulary (SmartSymptomPicker labels that are not phrased as findings). */
const CHIP_RULES: Rule[] = [
  r(/^hernia$/, 'hernia_swelling'),
  r(/^abscess$/, 'swelling_fluctuant_soft', 'localised_pain'),
  r(/^biliary colic$/, 'ruq_pain', 'episodic_pain'),
  r(/^renal colic$/, 'loin_pain', 'colicky_pain'),
  r(/^diabetic foot infection$/, 'foot_problem', 'known_diabetes'),
  r(/^(post-op review|post-op nausea)$/, 'recent_surgery', 'previous_surgery'),
  r(/^(fever after surgery|post-op fever)$/, 'fever', 'recent_surgery', 'previous_surgery'),
  r(/^inconsolable crying$/, 'inconsolable_crying'),
  r(/^poor feeding$/, 'poor_feeding'),
  r(/^failure to thrive$/, 'failure_to_thrive'),
  r(/^(generalised weakness|malaise)$/, 'fatigue'),
  r(/^(cold foot)$/, 'cold_limb'),
  r(/^amenorrho?ea$/, 'missed_period'),
  r(/^black stool$/, 'melaena'),
  r(/^skin changes breast$/, 'skin_dimpling'),
  r(/^breast redness$/, 'breast_redness'),
  r(/^loss of consciousness$/, 'loss_of_consciousness', 'syncope'),
];
