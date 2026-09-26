/**
 * Tokyo Guidelines 2018 — auto-fill of the ClinicalScoresPanel calculators from the record.
 *
 * Before 2026-09-25 the panel started with every toggle off, so the auto-filled grade read
 * "Criteria not met for … diagnosis" even for a patient in septic shock with a dilated duct full of
 * stones: the diagnostic A/B/C criteria and the organ-dysfunction boxes were never read from the
 * record (clinical validation: cholangitis-tg18-grade3-reynolds and
 * cholecystitis-tg18-grade3-organ-dysfunction, both critical).
 *
 * Organ dysfunction mirrors iOS `PatientScoreAutoPopulator+TG18Organ.swift` (1f50221):
 *   cardiovascular  SBP < 90 mmHg, or a vasopressor / inotrope written in the notes
 *   neurological    ACVPU other than Alert
 *   renal           creatinine > 2.0 mg/dL (177 µmol/L), or oliguria / anuria written
 *   hepatic         PT-INR > 1.5
 *   haematological  platelets < 100 × 10⁹/L
 *   respiratory     never inferred (PaO₂/FiO₂ < 300 is not derivable from SpO₂)
 * (Kiriyama 2018 / Yokoe 2018, TG18 severity grading.)
 *
 * The diagnostic criteria (Kiriyama 2018; Yokoe 2018) are read from the examination, the history
 * and the received imaging reports, negation-aware (lib/triage-engine negation.ts). Everything is
 * a pre-filled toggle: the clinician can untick any of it. Deterministic; no AI.
 */

import { containsAnyAffirmed, joinClauses } from '@workspace/triage-engine';
import type { ExtractedLabs, TokyoCholangitisInputs, TokyoCholecystitisInputs } from './clinical-scores';

export type Tg18Organ = 'cardiovascular' | 'neurological' | 'respiratory' | 'renal' | 'hepatic' | 'haematological';

/** The parts of the record the auto-fill reads (AppContext fields, or a clinical-validation vignette). */
export interface Tg18Record {
  age: number | null;
  systolicBp: number | null;
  /** ACVPU: 'A' | 'C' | 'V' | 'P' | 'U'; empty or null when not recorded. */
  avpu: string | null;
  labs: ExtractedLabs;
  /** Examination text (general, abdomen, other). */
  examText: string;
  /** History / HPI text. */
  historyText: string;
  /** Assessment / working diagnosis text. */
  assessment: string;
  /** Received imaging reports (result text). */
  imagingReports: string[];
  /** Past surgical history (a cholecystectomy raises the CBD limit to 8 mm). */
  surgicalHistory?: string[];
}

/** TG18 organ dysfunction present in the record (iOS twin: tg18OrganDysfunction). */
export function tg18OrganDysfunction(r: Tg18Record): Tg18Organ[] {
  const out: Tg18Organ[] = [];
  const text = joinClauses([r.examText, r.historyText, r.assessment]);
  if ((r.systolicBp !== null && r.systolicBp < 90)
    || containsAnyAffirmed(text, ['noradrenaline', 'norepinephrine', 'vasopressor', 'inotrope', 'metaraminol', 'vasopressin'])) {
    out.push('cardiovascular');
  }
  const avpu = (r.avpu ?? '').trim().toUpperCase();
  if (avpu && avpu !== 'A') out.push('neurological');
  const cr = r.labs.creatinine;
  const crMgdl = cr === null || cr === undefined ? null : cr > 20 ? cr / 88.4 : cr;
  if ((crMgdl !== null && crMgdl > 2.0) || containsAnyAffirmed(text, ['oliguria', 'oliguric', 'anuria', 'anuric'])) {
    out.push('renal');
  }
  if (r.labs.inr !== null && r.labs.inr !== undefined && r.labs.inr > 1.5) out.push('hepatic');
  const plt = r.labs.platelets;
  if (plt !== null && plt !== undefined && (plt > 1000 ? plt / 1000 : plt) < 100) out.push('haematological');
  return out;
}

const CBD_MM = /\b(?:cbd|common bile duct|bile duct|common duct)\b[^.;\n]{0,25}?(\d{1,2}(?:\.\d)?)\s*mm\b/g;

/** Biliary dilatation on imaging: a measured CBD > 6 mm (> 8 mm after cholecystectomy) or written as dilated. */
function biliaryDilatation(reports: string[], postCholecystectomy: boolean): boolean {
  const limit = postCholecystectomy ? 8 : 6;
  let measured = false;
  let anyNumber = false;
  for (const rep of reports) {
    const t = rep.toLowerCase();
    CBD_MM.lastIndex = 0;
    for (let m = CBD_MM.exec(t); m; m = CBD_MM.exec(t)) {
      anyNumber = true;
      if (parseFloat(m[1]) > limit) measured = true;
    }
  }
  if (measured) return true;
  const words = reports.some(rep => containsAnyAffirmed(rep, [
    /\bdilated (cbd|common bile duct|bile ducts?|biliary tree|intrahepatic ducts?)\b/,
    /\b(cbd|common bile duct|bile ducts?|biliary tree)\b[^.;\n]{0,15}\bdilated\b/,
    /\b(biliary|bile duct|cbd|intrahepatic duct) dilatation\b/, /\bbile duct dilation\b/,
  ]));
  return words && !anyNumber;
}

/** A biliary cause on imaging: duct stone, stricture or stent. */
function biliaryCauseOnImaging(reports: string[]): boolean {
  return reports.some(rep => containsAnyAffirmed(rep, [
    /\bcholedocholithiasis\b/,
    /\b(cbd|common bile duct|bile duct|distal duct|common duct|duct)\b[^.;\n]{0,40}\b(stones?|calcul\w*|stricture|stent)\b/,
    /\b(stones?|calcul\w*)\b[^.;\n]{0,30}\b(cbd|common bile duct|bile duct|distal duct|common duct)\b/,
    /\b(biliary|bile duct|cbd) (stricture|stent)\b/,
  ]));
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

/** Duration of complaints > 72 h, from "4 days", "four days", "80 hours" in the history. */
export function durationOver72h(historyText: string): boolean {
  const t = historyText.toLowerCase();
  const re = /\b(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten)\s*(days?|hours?|hrs?|h|weeks?)\b/g;
  for (let m = re.exec(t); m; m = re.exec(t)) {
    const n = NUMBER_WORDS[m[1]] ?? parseInt(m[1], 10);
    const unit = m[2];
    const hours = unit.startsWith('d') ? n * 24 : unit.startsWith('w') ? n * 24 * 7 : n;
    if (hours > 72) return true;
  }
  return false;
}

/** Tokyo cholangitis inputs pre-filled from the record (Kiriyama 2018). */
export function tokyoCholangitisAutoFill(r: Tg18Record): Partial<TokyoCholangitisInputs> {
  const clinical = joinClauses([r.examText, r.historyText]);
  const postChole = (r.surgicalHistory ?? []).some(s => containsAnyAffirmed(s, ['cholecystectomy']));
  const organs = tg18OrganDysfunction(r);
  return {
    fever_or_chills: containsAnyAffirmed(clinical, ['rigors', 'chills', 'shaking', 'pyrexial', /\bfebrile\b/]),
    jaundice: containsAnyAffirmed(r.examText, ['jaundice', 'icteric', 'icterus']),
    biliary_dilatation: biliaryDilatation(r.imagingReports, postChole),
    biliary_cause_on_imaging: biliaryCauseOnImaging(r.imagingReports),
    age_over_75: r.age !== null && r.age >= 75,
    organ_dysfunction: organs,
  };
}

const GALLBLADDER = /\b(gall ?bladder|gb|cholecyst\w*|pericholecystic)\b/i;
/** Organs whose wall a report may call thickened; a sentence naming one is not about the gallbladder. */
const OTHER_WALLED = /\b(append\w*|caec\w*|cecum|colon\w*|sigmoid|rect\w*|ile\w*|jejun\w*|duoden\w*|stomach|gastric|antr\w*|oesophag\w*|esophag\w*|bowel|intestin\w*|small bowel|urinary bladder|bladder wall|uter\w*|endometri\w*|abscess|cyst\b|collection|aort\w*|cardiac|ventric\w*|bronch\w*|pleura\w*)\b/i;

/**
 * Sentences of an imaging report that describe the gallbladder: the sentence names it, or it
 * follows a gallbladder sentence and names no other walled organ ("Gallbladder contains stones.
 * Wall thickened to 6 mm."). Before 2026-09-26 a "wall thickening" anywhere in the report counted
 * as gallbladder wall thickening, so an inflamed appendix on MRI or a thick-walled liver abscess
 * auto-filled TG18 imaging (vademecum phase-1 shadow run).
 */
export function gallbladderSentences(report: string): string[] {
  const sentences = report.split(/(?<!\d)\.(?!\d)|[;\n]/).map(s => s.trim()).filter(Boolean);
  const out: string[] = [];
  let previousWasGallbladder = false;
  for (const s of sentences) {
    const namesGb = GALLBLADDER.test(s);
    const namesOther = OTHER_WALLED.test(s.replace(/\bgall ?bladder\b/gi, ''));
    if (namesGb || (previousWasGallbladder && !namesOther)) {
      out.push(s);
      previousWasGallbladder = true;
    } else {
      previousWasGallbladder = false;
    }
  }
  return out;
}

/** Tokyo cholecystitis inputs pre-filled from the record (Yokoe 2018). */
export function tokyoCholecystitisAutoFill(r: Tg18Record): Partial<TokyoCholecystitisInputs> {
  const exam = r.examText;
  const reports = r.imagingReports;
  // "Murphy's sign equivocal" is not a positive sign.
  const murphy = containsAnyAffirmed(exam, [/\bmurphy'?s?\b(?! sign (equivocal|indeterminate|doubtful))/])
    && !/\bmurphy'?s?( sign)? (equivocal|indeterminate|doubtful)\b/i.test(exam);
  const ruq = containsAnyAffirmed(joinClauses([exam, r.historyText]), [
    /\b(right upper quadrant|ruq|right hypochondri\w*)\b[^.;\n]{0,30}\b(tender\w*|pain|mass)\b/,
    /\b(tender\w*|pain|mass)\b[^.;\n]{0,30}\b(right upper quadrant|ruq|right hypochondri\w*)\b/,
  ]);
  const mass = containsAnyAffirmed(exam, [
    /\b(palpable|tender)\b[^.;\n]{0,20}\bmass\b[^.;\n]{0,40}\b(right upper quadrant|ruq|right hypochondri\w*|gallbladder)\b/,
    /\b(right upper quadrant|ruq)\b[^.;\n]{0,20}\bmass\b/,
  ]);
  const imaging = (terms: Array<string | RegExp>) => reports.some(rep => containsAnyAffirmed(rep, terms));
  // Wall findings count only in sentences about the gallbladder.
  const gbImaging = (terms: Array<string | RegExp>) =>
    reports.some(rep => gallbladderSentences(rep).some(s => containsAnyAffirmed(s, terms)));
  return {
    murphy_sign: murphy,
    ruq_pain_mass_tenderness: ruq,
    us_wall_thickening: gbImaging([/\bwall (thickened|thickening)\b/, /\bthick(ened)?[- ]walled\b/, /\bgallbladder wall\b[^.;\n]{0,20}\b(thick\w*|oedema\w*|edema\w*)\b/]),
    us_pericholecystic_fluid: imaging(['pericholecystic fluid', 'pericholecystic collection']),
    us_gb_enlargement: imaging([/\b(distended|enlarged|hydropic) gallbladder\b/, /\bgallbladder\b[^.;\n]{0,15}\b(distended|enlarged)\b/]),
    us_echo_slurry: imaging(['sludge', 'debris', 'echogenic slurry']),
    us_non_enhanced_area: gbImaging([/\bnon-?enhanc\w*\b[^.;\n]{0,30}\b(gallbladder )?wall\b/]),
    palpable_tender_mass: mass,
    duration_over_72h: durationOver72h(r.historyText),
    marked_local_inflammation: imaging(['gangren', 'emphysematous', 'intramural gas', 'pericholecystic abscess', 'hepatic abscess', 'gallbladder perforation', 'perforated gallbladder'])
      || containsAnyAffirmed(r.assessment, ['gangrenous cholecystitis', 'emphysematous cholecystitis', 'pericholecystic abscess', 'biliary peritonitis', 'perforated gallbladder']),
    organ_dysfunction: tg18OrganDysfunction(r),
  };
}
