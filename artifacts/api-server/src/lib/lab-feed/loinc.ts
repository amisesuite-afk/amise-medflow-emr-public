/**
 * LOINC → catalogue analyte key (lib/triage-engine/src/report-import/catalog.ts).
 *
 * Only blood / serum / plasma codes are listed: a urine or fluid code is never filed under the
 * blood analyte the scores read. When a code is not listed, the analyte is found from the
 * printed label with the catalogue's names and synonyms (normalise.ts). When the code and the
 * label point to different analytes, neither is trusted: the result is saved under its printed
 * label, unmapped, for the clinician (normalise.ts `resolveAnalyte`).
 *
 * The same table is printed in docs/LAB-FEED.md for the laboratory.
 * Registered as `lab-feed-loinc-map` in clinical-content/registry.json: bump this version with
 * any change to the table, together with the registry entry.
 */
export const LAB_FEED_LOINC_MAP_VERSION = '1.0.0';

export const LOINC_TO_ANALYTE: Readonly<Record<string, string>> = {
  // Full blood count
  '6690-2': 'wbc', '26464-8': 'wbc', '804-5': 'wbc',
  '718-7': 'haemoglobin', '20509-6': 'haemoglobin',
  '777-3': 'platelets', '26515-7': 'platelets',
  '4544-3': 'haematocrit', '20570-8': 'haematocrit',
  '789-8': 'rbc', '787-2': 'mcv', '785-6': 'mch', '786-4': 'mchc', '788-0': 'rdw',
  '751-8': 'neutrophils', '770-8': 'neutrophils',
  '731-0': 'lymphocytes', '736-9': 'lymphocytes',
  '742-7': 'monocytes', '5905-5': 'monocytes',
  '711-2': 'eosinophils', '713-8': 'eosinophils',
  '704-7': 'basophils', '706-2': 'basophils',
  '4537-7': 'esr', '30341-2': 'esr',
  // Coagulation
  '6301-6': 'inr', '34714-6': 'inr',
  '5902-2': 'pt', '3173-2': 'aptt', '14979-9': 'aptt', '3255-7': 'fibrinogen',
  '48065-7': 'dDimer',
  // Inflammation
  '1988-5': 'crp', '30522-7': 'crp', '33959-8': 'procalcitonin',
  // Renal and electrolytes
  '2951-2': 'sodium', '2947-0': 'sodium',
  '2823-3': 'potassium', '6298-4': 'potassium',
  '2075-0': 'chloride', '1963-8': 'bicarbonate', '2028-9': 'bicarbonate',
  '3094-0': 'bun', '6299-2': 'bun',
  '2160-0': 'creatinine', '14682-9': 'creatinine', '38483-4': 'creatinine',
  '33914-3': 'egfr', '48642-3': 'egfr', '48643-1': 'egfr', '62238-1': 'egfr', '98979-8': 'egfr',
  '17861-6': 'calcium', '2000-8': 'calcium', '1994-3': 'calciumIonised',
  '19123-9': 'magnesium',
  '2777-1': 'phosphate', '3084-1': 'uricAcid',
  // Glucose
  '2345-7': 'glucose', '14749-6': 'glucose', '2339-0': 'glucose', '1558-6': 'glucose', '15074-8': 'glucose',
  '4548-4': 'hba1c', '17856-6': 'hba1c', '59261-8': 'hba1c',
  // Liver
  '1975-2': 'bilirubin', '14631-6': 'bilirubin',
  '1968-7': 'bilirubinDirect', '14629-0': 'bilirubinDirect',
  '1971-1': 'bilirubinIndirect',
  '1742-6': 'alt', '1920-8': 'ast', '6768-6': 'alp', '2324-2': 'ggt',
  '1751-7': 'albumin', '2885-2': 'totalProtein', '10834-0': 'globulin',
  // Pancreas, LDH, lactate, CK, cardiac
  '1798-8': 'amylase', '3040-3': 'lipase',
  '2532-0': 'ldh', '14804-9': 'ldh',
  '2524-7': 'lactate', '32693-4': 'lactate', '2518-9': 'lactate',
  '2157-6': 'ck',
  '10839-9': 'troponinI', '42757-5': 'troponinI', '89579-7': 'troponinI',
  '6598-7': 'troponinT', '67151-1': 'troponinT',
  // Thyroid, haematinics
  '3016-3': 'tsh', '3024-7': 'ft4', '3051-0': 'ft3',
  '2276-4': 'ferritin', '2498-4': 'iron', '2500-7': 'tibc', '2132-9': 'b12', '2284-8': 'folate',
  // Tumour markers
  '2039-6': 'cea', '24108-3': 'ca199', '10334-1': 'ca125', '6875-9': 'ca153',
  '2857-1': 'psa', '10886-0': 'freePsa', '1834-1': 'afp',
  // Lipids
  '2093-3': 'cholesterol', '2085-9': 'hdl', '13457-7': 'ldl', '18262-6': 'ldl', '2571-8': 'triglycerides',
};

export function analyteKeyForLoinc(code: string | null | undefined): string | null {
  if (!code) return null;
  return LOINC_TO_ANALYTE[code.trim()] ?? null;
}
