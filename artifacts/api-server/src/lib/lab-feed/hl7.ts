/**
 * Minimal HL7 v2 ORU^R01 parser (v2.3–2.5.1): MSH, PID, OBR, OBX, NTE. ORC, PV1, SPM and any
 * other segment are skipped. Deterministic, no network; refuses anything it cannot read safely
 * (FeedParseError with a PHI-free code).
 *
 * Read:
 *   MSH-2 encoding characters, MSH-3/4 sending application / facility, MSH-7 date, MSH-9 type
 *   (must be ORU^R01), MSH-10 control id.
 *   PID-3 identifiers (MRN = the repetition with identifier type MR, else the only repetition),
 *   PID-5 name, PID-7 date of birth, PID-8 sex.
 *   OBR-2 placer / OBR-3 filler order number (report id), OBR-4 test, OBR-7 collected,
 *   OBR-15 specimen source (v2.3), OBR-22 reported, OBR-25 status.
 *   OBX-2 value type (NM, SN, ST, CE, CWE, TX, FT), OBX-3 identifier (LN = LOINC, also the
 *   alternate identifier components 4–6), OBX-5 value (repeats joined), OBX-6 units, OBX-7
 *   reference range, OBX-8 abnormal flags (repeats), OBX-11 status, OBX-14 date.
 *   NTE after an OBX → that result's comment; NTE after an OBR → the report's comment.
 * OBX with status D (deleted) or W (wrong, replaced) is dropped; X (cannot be obtained) is kept
 * as a text result.
 */
import {
  FeedParseError, MAX_OBSERVATIONS_PER_REPORT, MAX_REPORTS_PER_MESSAGE, feedSex, hl7DateTime, isoDateOnly,
  specimenFromText,
  type FeedMessage, type FeedObservation, type FeedPatientIdentity, type FeedReport, type FeedReportStatus,
} from './types.js';

interface Encoding {
  field: string;
  component: string;
  repetition: string;
  escape: string;
  subcomponent: string;
}

function unescape(s: string, enc: Encoding): string {
  if (!s.includes(enc.escape)) return s;
  const e = enc.escape.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${e}([^${e}]*)${e}`, 'g');
  return s.replace(re, (_all, seq: string) => {
    switch (seq) {
      case 'F': return enc.field;
      case 'S': return enc.component;
      case 'T': return enc.subcomponent;
      case 'R': return enc.repetition;
      case 'E': return enc.escape;
      case '.br': return '\n';
      default:
        if (/^X[0-9A-Fa-f]{2,}$/.test(seq)) {
          const bytes = seq.slice(1).match(/.{2}/g) ?? [];
          return bytes.map(b => String.fromCharCode(parseInt(b, 16))).join('');
        }
        return ''; // formatting sequences (\H\, \N\, \.sp\ …) carry no data
    }
  });
}

class Segment {
  constructor(readonly name: string, private readonly fields: string[], private readonly enc: Encoding) {}

  /** Raw field n (1-based, HL7 numbering; MSH-1 is the field separator itself). */
  raw(n: number): string {
    if (this.name === 'MSH') {
      if (n === 1) return this.enc.field;
      return this.fields[n - 1] ?? '';
    }
    return this.fields[n] ?? '';
  }

  repetitions(n: number): string[] {
    const r = this.raw(n);
    return r === '' ? [] : r.split(this.enc.repetition);
  }

  /** Component c (1-based) of field n's first repetition, unescaped and trimmed. */
  comp(n: number, c = 1, rep?: string): string {
    const f = rep ?? this.repetitions(n)[0] ?? '';
    const part = (f.split(this.enc.component)[c - 1] ?? '').split(this.enc.subcomponent)[0];
    return unescape(part, this.enc).trim();
  }

  /** One repetition as text: components unescaped and joined by a space. */
  repText(rep: string): string {
    return rep.split(this.enc.component).map(c => unescape(c.split(this.enc.subcomponent)[0], this.enc).trim()).filter(Boolean).join(' ');
  }

  /** Whole field n (every repetition), unescaped, components joined by a space. */
  text(n: number): string {
    return this.repetitions(n)
      .map(rep => this.repText(rep))
      .filter(Boolean)
      .join('; ');
  }
}

function splitSegments(body: string): string[] {
  return body.replace(/^﻿/, '').replace(/^\x0b/, '').replace(/\x1c\r?$/, '')
    .split(/\r\n|\r|\n/).map(s => s.trim()).filter(s => s.length > 0);
}

function parseEncoding(msh: string): Encoding {
  if (!msh.startsWith('MSH') || msh.length < 8) throw new FeedParseError('hl7_no_msh', 'The message does not start with an MSH segment');
  const field = msh[3];
  const chars = msh.slice(4, 8);
  if (/[A-Za-z0-9\s]/.test(field) || chars.length < 4 || new Set([field, ...chars.slice(0, 4)]).size !== 5) {
    throw new FeedParseError('hl7_bad_encoding', 'MSH-1 / MSH-2 encoding characters are not valid');
  }
  return { field, component: chars[0], repetition: chars[1], escape: chars[2], subcomponent: chars[3] };
}

function reportStatus(code: string): FeedReportStatus {
  switch (code.toUpperCase()) {
    case 'F': return 'final';
    case 'C': case 'M': return 'corrected';
    case 'P': case 'I': case 'S': case 'O': case 'R': return 'preliminary';
    case 'A': return 'partial';
    case 'X': case 'D': return 'cancelled';
    default: return code === '' ? 'final' : 'unknown';
  }
}

function patientFrom(pid: Segment): FeedPatientIdentity {
  const reps = pid.repetitions(3);
  let mrn: string | null = null;
  const typed = reps.filter(r => pid.comp(3, 5, r).toUpperCase() === 'MR');
  if (typed.length === 1) mrn = pid.comp(3, 1, typed[0]) || null;
  else if (typed.length === 0 && reps.length === 1) mrn = pid.comp(3, 1, reps[0]) || null;
  // Several MR identifiers, or several untyped identifiers: no MRN (never guess which one).
  const nameRep = pid.repetitions(5)[0];
  return {
    mrn,
    familyName: nameRep ? pid.comp(5, 1, nameRep) || null : null,
    givenName: nameRep ? [pid.comp(5, 2, nameRep), pid.comp(5, 3, nameRep)].filter(Boolean).join(' ') || null : null,
    dob: isoDateOnly(pid.comp(7, 1)),
    sex: feedSex(pid.comp(8, 1)),
  };
}

function observationFrom(obx: Segment, reportSpecimen: FeedReport['specimen']): FeedObservation | null {
  const status = obx.comp(11, 1).toUpperCase() || null;
  if (status === 'D' || status === 'W') return null;
  const valueType = obx.comp(2, 1).toUpperCase();
  // Identifier: LOINC in the primary or the alternate triplet.
  const code = obx.comp(3, 1), text = obx.comp(3, 2), system = obx.comp(3, 3).toUpperCase();
  const altCode = obx.comp(3, 4), altText = obx.comp(3, 5), altSystem = obx.comp(3, 6).toUpperCase();
  const loinc = system === 'LN' ? code : altSystem === 'LN' ? altCode : null;
  const localCode = system !== 'LN' && code ? code : null;
  const label = text || altText || code || altCode;
  if (!label) return null;

  const reps = obx.repetitions(5);
  let valueText: string;
  if (status === 'X') {
    valueText = 'Result cannot be obtained';
  } else if (valueType === 'SN') {
    // comparator ^ num1 ^ separator ^ num2
    const rep = reps[0] ?? '';
    const cmp = obx.comp(5, 1, rep), n1 = obx.comp(5, 2, rep), sep = obx.comp(5, 3, rep), n2 = obx.comp(5, 4, rep);
    valueText = sep ? `${cmp}${n1}${sep}${n2}` : `${cmp}${n1}`;
  } else if (valueType === 'CE' || valueType === 'CWE' || valueType === 'CNE') {
    valueText = reps.map(r => obx.comp(5, 2, r) || obx.comp(5, 1, r)).filter(Boolean).join('; ');
  } else if (valueType === 'NM') {
    valueText = reps.length > 1 ? reps.map(r => obx.comp(5, 1, r)).join('; ') : obx.comp(5, 1);
  } else {
    valueText = reps.map(r => obx.repText(r)).filter(Boolean).join('\n');
  }
  const unit = obx.comp(6, 1) || obx.comp(6, 2);
  return {
    loinc: loinc || null,
    localCode,
    label,
    valueType: valueType || 'ST',
    valueText: valueText.trim(),
    unit,
    referenceRange: obx.text(7),
    abnormalFlags: obx.repetitions(8).map(r => obx.comp(8, 1, r).toUpperCase()).filter(Boolean),
    status,
    comments: [],
    observedAt: hl7DateTime(obx.comp(14, 1)),
    specimen: specimenFromText(label) ?? reportSpecimen,
  };
}

export function parseHl7(body: string): FeedMessage {
  const lines = splitSegments(body);
  if (lines.length === 0) throw new FeedParseError('empty', 'The message is empty');
  if (lines.length > 5000) throw new FeedParseError('too_many_segments', 'The message has too many segments');
  const enc = parseEncoding(lines[0]);
  const segments = lines.map(l => {
    const fields = l.split(enc.field);
    return new Segment(fields[0], fields, enc);
  });
  const msh = segments[0];
  const type = msh.comp(9, 1).toUpperCase();
  const trigger = msh.comp(9, 2).toUpperCase();
  if (type !== 'ORU' || trigger !== 'R01') {
    throw new FeedParseError('unsupported_message_type', `Only ORU^R01 is accepted (got ${(type || '?').slice(0, 3)}^${(trigger || '?').slice(0, 3)})`);
  }
  const messageId = msh.comp(10, 1) || null;
  if (!messageId) throw new FeedParseError('missing_control_id', 'MSH-10 (message control id) is empty');

  const reports: FeedReport[] = [];
  let patient: FeedPatientIdentity | null = null;
  let report: FeedReport | null = null;
  let lastObs: FeedObservation | null = null;
  const sendingFacility = msh.comp(4, 2) || msh.comp(4, 1) || null;

  for (const seg of segments.slice(1)) {
    switch (seg.name) {
      case 'PID':
        patient = patientFrom(seg);
        report = null;
        lastObs = null;
        break;
      case 'OBR': {
        if (!patient) throw new FeedParseError('obr_without_pid', 'An OBR segment comes before any PID segment');
        const testName = seg.comp(4, 2) || seg.comp(4, 1) || seg.comp(4, 5) || 'Laboratory report';
        const statusCode = seg.comp(25, 1).toUpperCase();
        const specimen = specimenFromText(seg.comp(15, 1) + ' ' + seg.comp(15, 2)) ?? specimenFromText(testName);
        report = {
          reportId: seg.comp(3, 1) || seg.comp(2, 1) || null,
          testName,
          status: reportStatus(statusCode),
          statusCode: statusCode || 'F',
          collectedAt: hl7DateTime(seg.comp(7, 1)),
          reportedAt: hl7DateTime(seg.comp(22, 1)) ?? hl7DateTime(msh.comp(7, 1)),
          performingLab: sendingFacility,
          patient,
          observations: [],
          comments: [],
          specimen,
        };
        reports.push(report);
        if (reports.length > MAX_REPORTS_PER_MESSAGE) throw new FeedParseError('too_many_reports', 'The message has too many reports');
        lastObs = null;
        break;
      }
      case 'OBX': {
        if (!report) throw new FeedParseError('obx_without_obr', 'An OBX segment comes before any OBR segment');
        const obs = observationFrom(seg, report.specimen);
        lastObs = obs;
        if (obs) {
          report.observations.push(obs);
          if (report.observations.length > MAX_OBSERVATIONS_PER_REPORT) {
            throw new FeedParseError('too_many_observations', 'A report has too many results');
          }
        }
        break;
      }
      case 'NTE': {
        const text = seg.text(3);
        if (!text) break;
        if (lastObs) lastObs.comments.push(text);
        else if (report) report.comments.push(text);
        break;
      }
      default:
        break; // ORC, PV1, SPM, … are not needed
    }
  }
  if (reports.length === 0) throw new FeedParseError('no_reports', 'The message has no OBR segment');
  return {
    format: 'hl7v2',
    messageId,
    sentAt: hl7DateTime(msh.comp(7, 1)),
    sendingApplication: msh.comp(3, 1) || null,
    sendingFacility,
    reports,
  };
}

// ── ACK ──────────────────────────────────────────────────────────────────────────────────────

/** Characters that would break an ACK segment are removed from echoed text. */
function ackSafe(s: string): string {
  return s.replace(/[|^~\\&\r\n]/g, ' ').slice(0, 80).trim();
}

/**
 * HL7 ACK for an ORU^R01. AA accepted (also for a duplicate), AE application error (resend
 * later), AR rejected (do not resend unchanged). The text never carries patient data.
 */
export function hl7Ack(args: {
  code: 'AA' | 'AE' | 'AR';
  controlId: string | null;
  text: string;
  receivingApp?: string | null;
  receivingFacility?: string | null;
  now?: Date;
  ackId?: string;
}): string {
  const now = args.now ?? new Date();
  // Eastern Caribbean Time (UTC-4, no DST).
  const local = new Date(now.getTime() - 4 * 3600_000).toISOString();
  const ts = `${local.slice(0, 4)}${local.slice(5, 7)}${local.slice(8, 10)}${local.slice(11, 13)}${local.slice(14, 16)}${local.slice(17, 19)}-0400`;
  const msh = ['MSH', '^~\\&', 'AMISE-MEDFLOW', 'AMISE', ackSafe(args.receivingApp ?? ''), ackSafe(args.receivingFacility ?? ''),
    ts, '', 'ACK^R01^ACK', ackSafe(args.ackId ?? `ACK${now.getTime()}`), 'P', '2.5.1'].join('|');
  const msa = ['MSA', args.code, ackSafe(args.controlId ?? ''), ackSafe(args.text)].join('|');
  return `${msh}\r${msa}\r`;
}
