/**
 * What the dashboard's own lab readers would read a result name as.
 *
 * The decision-support readers of `investigationResults` (clinical-inference.ts `numLab()`,
 * LabInterpretationPanel's `autoPopulate()`, CriticalResultAlert) find a lab by a SUBSTRING of
 * the lowercased result name and take the first number of its value. A name that contains
 * another analyte's keyword is therefore read as that analyte ("Direct bili (conjugated)"
 * contains "bili"; "Prothrombin time" contains "prothrombin", read as INR).
 *
 * The report importer uses this table to keep such names out of the consultation's results
 * (they are still saved in the report itself), and to warn about unmapped names. The keyword
 * lists are copied from those callers; `lab-reader-keywords.test.ts` fails when a caller's list
 * is not covered here, so update both together.
 */
import { analyteForKey } from '@workspace/triage-engine/report-import';

export interface WebLabReader {
  /** Reader id (catalogue key of the analyte it is meant for, where there is one). */
  id: string;
  /** Human label shown in warnings. */
  label: string;
  /** Substrings of the lowercased result name that make the reader take it. */
  keywords: string[];
  /** Catalogue analytes this reader is meant to read (reading these is not a misread). */
  analyteKeys: string[];
}

export const WEB_LAB_READERS: WebLabReader[] = [
  // clinical-inference.ts numLab(...) and CriticalResultAlert ("haemoglobin")
  { id: 'haemoglobin', label: 'Haemoglobin', keywords: ['haemoglobin', 'hgb', 'hb'], analyteKeys: ['haemoglobin'] },
  { id: 'wbc', label: 'WBC', keywords: ['white blood', 'wbc', 'wcc', 'leucocyte'], analyteKeys: ['wbc'] },
  // numLab('amylase', 'lipase') reads either enzyme for the pancreatitis prompts, by design.
  { id: 'amylase', label: 'Amylase / lipase', keywords: ['amylase', 'lipase'], analyteKeys: ['amylase', 'lipase'] },
  { id: 'inr', label: 'INR', keywords: ['inr', 'pt/inr', 'prothrombin'], analyteKeys: ['inr'] },
  { id: 'afp', label: 'AFP', keywords: ['afp', 'alpha-fetoprotein', 'alpha fetoprotein'], analyteKeys: ['afp'] },
  { id: 'psa', label: 'PSA', keywords: ['psa', 'prostate specific'], analyteKeys: ['psa'] },
  { id: 'ca199', label: 'CA 19-9', keywords: ['ca 19-9', 'ca19-9', 'ca19', 'ca-19'], analyteKeys: ['ca199'] },
  { id: 'cea', label: 'CEA', keywords: ['cea', 'carcinoembryonic'], analyteKeys: ['cea'] },
  { id: 'creatinine', label: 'Creatinine', keywords: ['creatinine'], analyteKeys: ['creatinine'] },
  { id: 'bilirubin', label: 'Bilirubin', keywords: ['bilirubin', 'bili'], analyteKeys: ['bilirubin'] },
  { id: 'glucose', label: 'Glucose', keywords: ['glucose', 'blood sugar', 'bm'], analyteKeys: ['glucose'] },
  { id: 'sodium', label: 'Sodium', keywords: ['sodium', 'na+', 'na '], analyteKeys: ['sodium'] },
  { id: 'potassium', label: 'Potassium', keywords: ['potassium', 'k+', ' k '], analyteKeys: ['potassium'] },
  { id: 'albumin', label: 'Albumin', keywords: ['albumin'], analyteKeys: ['albumin'] },
  {
    id: 'hba1c', label: 'HbA1c',
    keywords: ['hba1c', 'glycated', 'glycohaemoglobin', 'haemoglobin a1c', 'glycated haemoglobin'],
    analyteKeys: ['hba1c'],
  },
  // LabInterpretationPanel autoPopulate() only
  { id: 'calcium', label: 'Calcium', keywords: ['calcium'], analyteKeys: ['calcium'] },
  { id: 'cholesterol', label: 'Total cholesterol', keywords: ['total cholesterol'], analyteKeys: ['cholesterol'] },
  { id: 'hdl', label: 'HDL cholesterol', keywords: ['hdl'], analyteKeys: ['hdl'] },
  { id: 'triglycerides', label: 'Triglycerides', keywords: ['triglyceride'], analyteKeys: ['triglycerides'] },
  // @workspace/triage-engine readCancerScreenLabs() (NG12 IDA / FIT rules, read by adaptiveTriage
  // and the preventive-screening prompts). It matches whole words, so these substring keywords
  // over-report rather than miss a collision.
  { id: 'ferritin', label: 'Ferritin', keywords: ['ferritin'], analyteKeys: ['ferritin'] },
  { id: 'mcv', label: 'MCV', keywords: ['mcv', 'mean cell volume', 'mean corpuscular volume'], analyteKeys: ['mcv'] },
  { id: 'fit', label: 'FIT (faecal immunochemical test)', keywords: ['fit', 'faecal immunochemical', 'fecal immunochemical'], analyteKeys: [] },
];

function readersMatching(name: string): WebLabReader[] {
  const lower = name.toLowerCase();
  return WEB_LAB_READERS.filter(r => r.keywords.some(k => lower.includes(k)));
}

/** Labels of every dashboard reader that would read `name` as a number (for unmapped rows). */
export function webNameReaders(name: string): string[] {
  return readersMatching(name).map(r => r.label);
}

/**
 * Readers that would read a catalogue analyte saved as `name` as a DIFFERENT analyte; empty when
 * the name is read only as itself (or not at all).
 */
export function webMisreaders(analyteKey: string | null, name: string): string[] {
  if (analyteKey === null || analyteForKey(analyteKey) === null) return webNameReaders(name);
  return readersMatching(name).filter(r => !r.analyteKeys.includes(analyteKey)).map(r => r.label);
}
