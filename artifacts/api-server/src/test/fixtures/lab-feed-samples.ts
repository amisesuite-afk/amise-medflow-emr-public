/**
 * Realistic laboratory messages for the lab-feed tests (and the examples in docs/LAB-FEED.md).
 * Fictitious patients; MRNs in the practice's AM-###### format.
 */

const CR = '\r';

/** FBC + renal profile for one patient: conversions, a critical potassium, comments, a repeat,
 *  an SN "<5", an unknown analyte and a deleted OBX. */
export const HL7_FBC_UE = [
  'MSH|^~\\&|LIS|SLULAB^Laboratory Services Ltd|AMISE-MEDFLOW|AMISE|20260926083000-0400||ORU^R01^ORU_R01|MSG20260926-0001|P|2.5.1',
  'PID|1||AM-000123^^^AMISE^MR~88812345^^^NHIS^PI||Joseph^Marie^A||19700520|F',
  'PV1|1|O',
  'ORC|RE|ORD-1|LAB-26-0456',
  'OBR|1|ORD-1|LAB-26-0456|58410-2^CBC panel - Blood by Automated count^LN|||20260926071500-0400|||||||||||||||20260926082500-0400|||F',
  'OBX|1|NM|6690-2^Leukocytes [#/volume] in Blood by Automated count^LN||12.4|10*3/uL|4.0-11.0|H|||F|||20260926071500-0400',
  'OBX|2|NM|718-7^Hemoglobin [Mass/volume] in Blood^LN||135|g/L|120-155|N|||F',
  'OBX|3|NM|777-3^Platelets [#/volume] in Blood by Automated count^LN||45|10*3/uL|150-400|LL|||F',
  'NTE|1||Platelet clumps not seen.',
  'NTE|2||Confirmed on film.',
  'OBR|2|ORD-1|LAB-26-0457|24362-6^Renal function panel - Serum or Plasma^LN|||20260926071500-0400|||||||||||||||20260926082500-0400|||F',
  'OBX|1|NM|2951-2^Sodium [Moles/volume] in Serum or Plasma^LN||138|mmol/L|135-145|N|||F',
  'OBX|2|NM|2823-3^Potassium [Moles/volume] in Serum or Plasma^LN||6.8|mmol/L|3.5-5.3|HH|||F',
  'NTE|1||Sample not haemolysed. Phoned to the ward 08:20.',
  'OBX|3|NM|2160-0^Creatinine [Mass/volume] in Serum or Plasma^LN||1.2|mg/dL|0.6-1.1|H|||F',
  'OBX|4|SN|1988-5^C reactive protein [Mass/volume] in Serum or Plasma^LN||<^5|mg/L|<5|N|||F',
  'OBX|5|NM|99ZZ-1^Vitamin Q^L||42|U/L|10-50|N|||F',
  'OBX|6|NM|2951-2^Sodium [Moles/volume] in Serum or Plasma^LN||199|mmol/L|135-145|H|||D',
  'OBX|7|ST|SPCMT^Specimen comment^L||Received 07:30~Transported on ice||||||F',
].join(CR) + CR;

/** Same MRN, wrong date of birth → reconciliation queue. */
export const HL7_DOB_MISMATCH = HL7_FBC_UE
  .replace('MSG20260926-0001', 'MSG20260926-0002')
  .replace('19700520', '19710520')
  .replace(/LAB-26-045/g, 'LAB-26-055');

/** No PID-3 identifier → queue ("no MRN"). */
export const HL7_NO_MRN = [
  'MSH|^~\\&|LIS|SLULAB|AMISE|AMISE|20260926090000||ORU^R01|MSG20260926-0003|P|2.3',
  'PID|1||||Smith^John||19650101|M',
  'OBR|1||LAB-26-0600|GLU^Glucose random^L|||202609260845|||||||||||||||202609260855|||F',
  'OBX|1|NM|GLU^Glucose^L||2.4|mmol/L|3.9-7.8|L|||F',
].join('\r\n');

/** Custom escape sequences and a corrected report. */
export const HL7_CORRECTED = [
  'MSH|^~\\&|LIS|SLULAB|AMISE|AMISE|20260926100000||ORU^R01|MSG20260926-0004|P|2.5.1',
  'PID|1||AM-000123^^^AMISE^MR||Joseph^Marie||19700520|F',
  'OBR|1||LAB-26-0457|24362-6^Renal function panel^LN|||20260926071500|||||||||||||||20260926095500|||C',
  'OBX|1|NM|2823-3^Potassium^LN||5.1|mmol/L|3.5-5.3|N|||C',
  'NTE|1||Corrected: earlier result was from a haemolysed sample \\T\\ has been withdrawn.',
].join(CR);

export const HL7_ADT = 'MSH|^~\\&|PAS|HOSP|AMISE|AMISE|20260926||ADT^A01|X1|P|2.5.1\rPID|1||AM-000123^^^AMISE^MR\r';
export const HL7_OBX_BEFORE_OBR = 'MSH|^~\\&|LIS|SLULAB|AMISE|AMISE|20260926||ORU^R01|X2|P|2.5.1\rPID|1||AM-000123^^^AMISE^MR||A^B||19700520|F\rOBX|1|NM|2951-2^Sodium^LN||140|mmol/L\r';
export const HL7_NO_CONTROL_ID = 'MSH|^~\\&|LIS|SLULAB|AMISE|AMISE|20260926||ORU^R01||P|2.5.1\rPID|1||AM-000123^^^AMISE^MR\rOBR|1||R1|X^Y\rOBX|1|NM|2951-2^Sodium^LN||140|mmol/L\r';

/** FHIR R4 Bundle: a chemistry DiagnosticReport with a glucose in mg/dL (converted), a raised
 *  lipase, a critical hs-troponin T (interpretation HH), a text result, an entered-in-error
 *  observation (dropped) and a panel with hasMember. */
export function fhirBundle(overrides: { bundleId?: string; mrn?: string | null; birthDate?: string; reportId?: string } = {}): Record<string, unknown> {
  const mrn = overrides.mrn === undefined ? 'AM-000123' : overrides.mrn;
  const patient: Record<string, unknown> = {
    resourceType: 'Patient', id: 'p1',
    identifier: mrn === null ? [] : [
      { type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'MR' }] }, system: 'urn:amise:mrn', value: mrn },
      { type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'NI' }] }, value: '88812345' },
    ],
    name: [{ family: 'Joseph', given: ['Marie'] }],
    gender: 'female',
    birthDate: overrides.birthDate ?? '1970-05-20',
  };
  const q = (id: string, loinc: string, text: string, value: number, unit: string, extra: Record<string, unknown> = {}) => ({
    fullUrl: `urn:uuid:${id}`,
    resource: {
      resourceType: 'Observation', id, status: 'final',
      code: { coding: [{ system: 'http://loinc.org', code: loinc, display: text }], text },
      subject: { reference: 'Patient/p1' },
      effectiveDateTime: '2026-09-26T07:15:00-04:00',
      valueQuantity: { value, unit },
      ...extra,
    },
  });
  return {
    resourceType: 'Bundle', id: 'b-1', type: 'collection',
    identifier: { system: 'urn:slulab:bundle', value: overrides.bundleId ?? 'BND-2026-0001' },
    timestamp: '2026-09-26T08:30:00-04:00',
    entry: [
      { fullUrl: 'urn:uuid:p1', resource: patient },
      {
        fullUrl: 'urn:uuid:dr1',
        resource: {
          resourceType: 'DiagnosticReport', id: 'dr1', status: 'final',
          identifier: [{ system: 'urn:slulab:accession', value: overrides.reportId ?? 'LAB-26-0789' }],
          code: { coding: [{ system: 'http://loinc.org', code: '24323-8' }], text: 'Chemistry panel' },
          subject: { reference: 'urn:uuid:p1' },
          effectiveDateTime: '2026-09-26T07:15:00-04:00',
          issued: '2026-09-26T08:25:00-04:00',
          performer: [{ display: 'Laboratory Services Ltd' }],
          result: [
            { reference: 'urn:uuid:o1' }, { reference: 'urn:uuid:o2' }, { reference: 'urn:uuid:o3' },
            { reference: 'urn:uuid:o4' }, { reference: 'urn:uuid:o5' }, { reference: 'urn:uuid:panel' },
          ],
          conclusion: 'Raised lipase.',
        },
      },
      q('o1', '2345-7', 'Glucose', 212, 'mg/dL', { interpretation: [{ coding: [{ code: 'H' }] }], referenceRange: [{ low: { value: 70 }, high: { value: 140 } }] }),
      q('o2', '3040-3', 'Lipase', 450, 'U/L', { interpretation: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'H' }] }] }),
      q('o3', '67151-1', 'Troponin T.cardiac [Mass/volume] in Serum or Plasma by High sensitivity method', 60, 'ng/L', {
        interpretation: [{ coding: [{ code: 'HH' }] }], note: [{ text: 'Discussed with Dr on call.' }],
      }),
      {
        fullUrl: 'urn:uuid:o4',
        resource: { resourceType: 'Observation', id: 'o4', status: 'final', code: { text: 'Sample appearance' }, valueString: 'Slightly haemolysed' },
      },
      q('o5', '1742-6', 'ALT', 9999, 'U/L', { status: 'entered-in-error' }),
      {
        fullUrl: 'urn:uuid:panel',
        resource: {
          resourceType: 'Observation', id: 'panel', status: 'final', code: { text: 'Electrolytes' },
          hasMember: [{ reference: 'urn:uuid:m1' }, { reference: 'urn:uuid:m2' }],
        },
      },
      q('m1', '2951-2', 'Sodium', 134, 'mmol/L'),
      q('m2', '1798-8', 'Amylase', 88, 'IU/L'),
    ],
  };
}
