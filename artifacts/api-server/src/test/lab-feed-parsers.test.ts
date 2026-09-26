/**
 * Lab feed parsers (HL7 v2 ORU^R01, FHIR R4) and normalisation to the catalogue with the
 * practice reference ranges: repeats, comments, unit conversion, unknown analytes, LOINC / label
 * disagreement, critical flags, malformed messages.
 */
import { describe, expect, it } from 'vitest';
import { hl7Ack, parseHl7 } from '../lib/lab-feed/hl7.js';
import { parseFhir } from '../lib/lab-feed/fhir.js';
import { analyteFromLabel, buildResultRow, normaliseObservation, resolveAnalyte } from '../lib/lab-feed/normalise.js';
import { parseFeedBody, reportRef } from '../lib/lab-feed/processor.js';
import { FeedParseError, hl7DateTime, type FeedObservation } from '../lib/lab-feed/types.js';
import { DEFAULT_REFERENCE_RANGES, type ReferenceRange } from '@workspace/triage-engine/reference-ranges';
import {
  HL7_ADT, HL7_CORRECTED, HL7_FBC_UE, HL7_NO_CONTROL_ID, HL7_NO_MRN, HL7_OBX_BEFORE_OBR, fhirBundle,
} from './fixtures/lab-feed-samples.js';

const FEMALE_1970 = { sex: 'female', dateOfBirth: '1970-05-20' };

function obs(partial: Partial<FeedObservation>): FeedObservation {
  return {
    loinc: null, localCode: null, label: 'Sodium', valueType: 'NM', valueText: '140', unit: 'mmol/L',
    referenceRange: '', abnormalFlags: [], status: 'F', comments: [], observedAt: null, specimen: null, ...partial,
  };
}

describe('HL7 v2 ORU^R01 parser', () => {
  const msg = parseHl7(HL7_FBC_UE);

  it('reads the header, the patient and every OBR as a report', () => {
    expect(msg).toMatchObject({ format: 'hl7v2', messageId: 'MSG20260926-0001', sendingFacility: 'Laboratory Services Ltd' });
    expect(msg.sentAt).toBe('2026-09-26T12:30:00.000Z');
    expect(msg.reports).toHaveLength(2);
    const [fbc, ue] = msg.reports;
    expect(fbc.patient).toEqual({ mrn: 'AM-000123', familyName: 'Joseph', givenName: 'Marie A', dob: '1970-05-20', sex: 'female' });
    expect(fbc).toMatchObject({ reportId: 'LAB-26-0456', testName: 'CBC panel - Blood by Automated count', status: 'final', statusCode: 'F' });
    expect(fbc.collectedAt).toBe('2026-09-26T11:15:00.000Z');
    expect(ue.reportId).toBe('LAB-26-0457');
  });

  it('keeps NTE comments on their OBX, drops a deleted OBX, joins OBX-5 repeats and reads SN', () => {
    const [fbc, ue] = msg.reports;
    expect(fbc.observations.find(o => o.loinc === '777-3')?.comments).toEqual(['Platelet clumps not seen.', 'Confirmed on film.']);
    expect(ue.observations.filter(o => o.loinc === '2951-2')).toHaveLength(1); // OBX-11 D dropped
    expect(ue.observations.find(o => o.localCode === 'SPCMT')?.valueText).toBe('Received 07:30\nTransported on ice');
    expect(ue.observations.find(o => o.loinc === '1988-5')).toMatchObject({ valueType: 'SN', valueText: '<5', unit: 'mg/L' });
    expect(ue.observations.find(o => o.loinc === '2823-3')).toMatchObject({ abnormalFlags: ['HH'], comments: ['Sample not haemolysed. Phoned to the ward 08:20.'] });
  });

  it('reads \\r\\n separators, an untyped PID-3 absent, and escape sequences', () => {
    const noMrn = parseHl7(HL7_NO_MRN);
    expect(noMrn.reports[0].patient.mrn).toBeNull();
    expect(noMrn.reports[0].patient.sex).toBe('male');
    const corrected = parseHl7(HL7_CORRECTED);
    expect(corrected.reports[0]).toMatchObject({ status: 'corrected', statusCode: 'C' });
    expect(corrected.reports[0].observations[0].comments[0]).toContain('sample & has been withdrawn');
  });

  it('never guesses an MRN when several identifiers are untyped', () => {
    const two = HL7_FBC_UE.replace('AM-000123^^^AMISE^MR~88812345^^^NHIS^PI', 'AM-000123~88812345');
    expect(parseHl7(two).reports[0].patient.mrn).toBeNull();
  });

  it('refuses malformed and unsupported messages with a PHI-free code', () => {
    const codeOf = (body: string) => { try { parseHl7(body); return 'ok'; } catch (e) { return (e as FeedParseError).code; } };
    expect(codeOf('')).toBe('empty');
    expect(codeOf('PID|1||AM-000123')).toBe('hl7_no_msh');
    expect(codeOf(HL7_ADT)).toBe('unsupported_message_type');
    expect(codeOf(HL7_OBX_BEFORE_OBR)).toBe('obx_without_obr');
    expect(codeOf(HL7_NO_CONTROL_ID)).toBe('missing_control_id');
    expect(codeOf('MSH|^~\\&|LIS\rPID|1\r'.replace('ORU', ''))).toBe('unsupported_message_type');
  });

  it('builds an ACK that echoes the control id and nothing else', () => {
    const ack = hl7Ack({ code: 'AA', controlId: 'MSG20260926-0001', text: 'processed|1 filed', now: new Date('2026-09-26T12:30:00Z'), ackId: 'ACK1' });
    expect(ack).toBe('MSH|^~\\&|AMISE-MEDFLOW|AMISE|||20260926083000-0400||ACK^R01^ACK|ACK1|P|2.5.1\rMSA|AA|MSG20260926-0001|processed 1 filed\r');
  });

  it('reads HL7 dates as Eastern Caribbean Time when no zone is sent', () => {
    expect(hl7DateTime('202609260830')).toBe('2026-09-26T12:30:00.000Z');
    expect(hl7DateTime('20260926083000+0000')).toBe('2026-09-26T08:30:00.000Z');
    expect(hl7DateTime('20261326')).toBeNull();
  });
});

describe('FHIR R4 parser', () => {
  const msg = parseFhir(fhirBundle());

  it('reads the Bundle id, the report, the Patient MRN (type MR) and every Observation', () => {
    expect(msg).toMatchObject({ format: 'fhir-r4', messageId: 'BND-2026-0001' });
    const r = msg.reports[0];
    expect(r).toMatchObject({ reportId: 'LAB-26-0789', testName: 'Chemistry panel', status: 'final', performingLab: 'Laboratory Services Ltd' });
    expect(r.patient).toEqual({ mrn: 'AM-000123', familyName: 'Joseph', givenName: 'Marie', dob: '1970-05-20', sex: 'female' });
    expect(r.comments).toEqual(['Raised lipase.']);
    // o5 is entered-in-error; the panel is flattened to its two members.
    expect(r.observations.map(o => o.label)).toEqual([
      'Glucose', 'Lipase', 'Troponin T.cardiac [Mass/volume] in Serum or Plasma by High sensitivity method',
      'Sample appearance', 'Sodium', 'Amylase',
    ]);
    expect(r.observations[0]).toMatchObject({ loinc: '2345-7', valueText: '212', unit: 'mg/dL', referenceRange: '70-140', abnormalFlags: ['H'] });
    expect(r.observations[2]).toMatchObject({ abnormalFlags: ['HH'], comments: ['Discussed with Dr on call.'] });
  });

  it('accepts a single DiagnosticReport with contained resources', () => {
    const dr = {
      resourceType: 'DiagnosticReport', id: 'x9', status: 'final', code: { text: 'Potassium' },
      contained: [
        { resourceType: 'Patient', id: 'pt', identifier: [{ value: 'AM-000555' }], birthDate: '1980-01-02' },
        { resourceType: 'Observation', id: 'k', status: 'final', code: { coding: [{ system: 'http://loinc.org', code: '2823-3' }] }, valueQuantity: { value: 4.1, unit: 'mmol/L' } },
      ],
      subject: { reference: '#pt' }, result: [{ reference: '#k' }],
    };
    const m = parseFhir(dr);
    expect(m.messageId).toBe('x9');
    expect(m.reports[0].patient).toMatchObject({ mrn: 'AM-000555', dob: '1980-01-02' });
    expect(m.reports[0].observations[0]).toMatchObject({ loinc: '2823-3', valueText: '4.1', label: '2823-3' });
  });

  it('refuses what is not a Bundle / DiagnosticReport, or has no report', () => {
    expect(() => parseFhir({ resourceType: 'Patient' })).toThrow(FeedParseError);
    expect(() => parseFhir([])).toThrow(/not a FHIR resource/);
    expect(() => parseFhir({ resourceType: 'Bundle', id: 'b', entry: [] })).toThrow(/no DiagnosticReport/);
    expect(() => parseFeedBody('{"resourceType":', 'application/fhir+json')).toThrow(/not valid JSON/);
    expect(() => parseFeedBody('hello', 'text/plain')).toThrow(/Send HL7 v2/);
  });
});

describe('normalisation to the catalogue', () => {
  it('maps by LOINC, else by the catalogue names; refuses a LOINC / label disagreement', () => {
    expect(resolveAnalyte({ loinc: '2823-3', label: 'Potassium' }, 'blood').key).toBe('potassium');
    expect(resolveAnalyte({ loinc: null, label: 'Serum Potassium' }, 'blood').key).toBe('potassium');
    expect(resolveAnalyte({ loinc: null, label: 'Bilirubin, direct' }, 'blood').key).toBe('bilirubinDirect');
    expect(resolveAnalyte({ loinc: '67151-1', label: 'hs Troponin' }, 'blood').key).toBe('troponinT');
    const clash = resolveAnalyte({ loinc: '2823-3', label: 'Sodium' }, 'blood');
    expect(clash.key).toBeNull();
    expect(clash.note).toMatch(/name different tests/);
    // A label with words the catalogue does not know is never guessed.
    expect(analyteFromLabel('Glucose tolerance 2 hour', 'blood')).toBeNull();
    expect(resolveAnalyte({ loinc: '2951-2', label: 'Sodium' }, 'urine').key).toBeNull();
  });

  it('converts units with the catalogue factors and flags from the practice ranges', () => {
    const [fbc, ue] = parseHl7(HL7_FBC_UE).reports;
    const hb = normaliseObservation(fbc.observations[1], fbc.specimen, fbc.collectedAt, [], FEMALE_1970);
    expect(hb).toMatchObject({ key: 'haemoglobin', name: 'Haemoglobin', value: '13.5', unit: 'g/dL', abnormal: false, critical: false });
    expect(hb.note).toBe('converted from 135 g/L');
    const wbc = normaliseObservation(fbc.observations[0], fbc.specimen, fbc.collectedAt, [], FEMALE_1970);
    expect(wbc).toMatchObject({ key: 'wbc', value: '12.4', abnormal: true, critical: false, flag: 'H' });
    const cr = normaliseObservation(ue.observations[2], ue.specimen, ue.collectedAt, [], FEMALE_1970);
    expect(cr).toMatchObject({ key: 'creatinine', value: '106', unit: 'µmol/L', abnormal: true, practice_range: '45–84 µmol/L · default' });
    const k = normaliseObservation(ue.observations[1], ue.specimen, ue.collectedAt, [], FEMALE_1970);
    expect(k).toMatchObject({ key: 'potassium', critical: true, abnormal: true, flag: 'HH', lab_flag: 'HH' });
    const crp = normaliseObservation(ue.observations[3], ue.specimen, ue.collectedAt, [], FEMALE_1970);
    expect(crp).toMatchObject({ key: 'crp', value: '<5', abnormal: false });
  });

  it('never downgrades the laboratory, and a practice critical limit raises critical on its own', () => {
    // Lab says normal (N) but the practice critical limit for platelets is < 50.
    const plt = normaliseObservation(obs({ loinc: '777-3', label: 'Platelets', valueText: '40', unit: '10*3/uL', abnormalFlags: ['N'] }), 'blood', null, [], FEMALE_1970);
    expect(plt).toMatchObject({ critical: true, abnormal: true, flag: 'Critical' });
    // Practice range wider than the lab's: the lab's H still counts.
    const practice: ReferenceRange[] = [{ ...DEFAULT_REFERENCE_RANGES.find(r => r.analyte === 'Lipase')!, upper: 300, isDefault: false, labSource: 'SLU Lab 2026', effectiveFrom: '2026-01-01' }];
    const lip = normaliseObservation(obs({ loinc: '3040-3', label: 'Lipase', valueText: '200', unit: 'U/L', abnormalFlags: ['H'] }), 'blood', null, practice, FEMALE_1970);
    expect(lip).toMatchObject({ abnormal: true, critical: false, practice_range: '≤ 300 U/L · SLU Lab 2026' });
  });

  it('keeps an unknown analyte under its printed label; never converts an ambiguous unit', () => {
    const [, ue] = parseHl7(HL7_FBC_UE).reports;
    const vq = normaliseObservation(ue.observations[4], ue.specimen, ue.collectedAt, [], FEMALE_1970);
    expect(vq).toMatchObject({ key: null, name: 'Vitamin Q', value: '42', unit: 'U/L', abnormal: false });
    const urea = normaliseObservation(obs({ label: 'Urea', valueText: '42', unit: 'mg/dL' }), 'blood', null, [], FEMALE_1970);
    expect(urea).toMatchObject({ key: 'urea', value: '42', unit: 'mg/dL', abnormal: false });
    expect(urea.issues).toContain('unitAmbiguous');
    expect(urea.practice_range).toBeUndefined();
  });

  it('files urine separately from the blood analyte', () => {
    const u = normaliseObservation(obs({ label: 'Sodium', specimen: 'urine', valueText: '40' }), 'urine', null, [], FEMALE_1970);
    expect(u).toMatchObject({ key: null, name: 'Urine Sodium', specimen: 'urine', critical: false });
  });

  it('builds the investigation_results row the report import writes, status "resulted" (awaiting review)', () => {
    const fhir = parseFhir(fhirBundle());
    const row = buildResultRow({
      report: fhir.reports[0], patientId: 'p-1', patient: FEMALE_1970, practice: [], labId: 'slulab',
      messageRowId: 'm-1', reportRef: reportRef('slulab', 'BND-2026-0001', fhir.reports[0], 0), receivedAt: '2026-09-26T12:31:00.000Z',
    });
    expect(row).toMatchObject({
      patient_id: 'p-1', encounter_id: null, test_name: 'Chemistry panel', status: 'resulted', source: 'lab-feed',
      lab_report_ref: 'slulab:LAB-26-0789:final:2026-09-26T12:25:00.000Z', is_critical: true, is_abnormal: true,
      performing_lab: 'Laboratory Services Ltd',
    });
    expect(row.notes).toContain('Received — awaiting clinician review');
    const byName = Object.fromEntries(row.analytes.map(a => [a.name, a]));
    expect(byName.Glucose).toMatchObject({ value: '11.8', unit: 'mmol/L', abnormal: true, note: 'converted from 212 mg/dL' });
    expect(byName.Lipase).toMatchObject({ value: '450', abnormal: true, critical: false });
    expect(byName['Troponin T']).toMatchObject({ value: '60', critical: true });
    expect(byName.Amylase).toMatchObject({ value: '88', unit: 'IU/L', abnormal: false, practice_range: '≤ 100 U/L · default' });
    expect(byName['Sample appearance']).toMatchObject({ key: null, value: 'Slightly haemolysed' });
  });
});
