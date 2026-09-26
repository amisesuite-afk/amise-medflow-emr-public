/**
 * FHIR R4 laboratory results: a Bundle (message, transaction, batch, collection, searchset)
 * holding DiagnosticReport, Observation and Patient resources, or a single DiagnosticReport with
 * contained resources. Deterministic, no network (no reference is fetched: every referenced
 * Observation / Patient must be in the Bundle or contained).
 *
 * Read:
 *   Bundle.identifier.value, else MessageHeader.id, else Bundle.id → message id.
 *   DiagnosticReport: identifier[0].value (else id) → report id; status; code (text / display);
 *   effective[x] → collected; issued → reported; performer[].display → laboratory;
 *   subject → Patient; result[] → Observations (hasMember panels flattened one level);
 *   conclusion → report comment.
 *   Patient: identifier with type MR (v2-0203), else the only identifier → MRN; birthDate;
 *   gender; name[0] family / given.
 *   Observation: code.coding (http://loinc.org → LOINC), code.text; valueQuantity (value,
 *   comparator, unit/code), valueString, valueCodeableConcept, valueInteger, valueBoolean;
 *   interpretation codes (H, HH, L, LL, A, AA, N …); referenceRange (low/high/text); note;
 *   status (entered-in-error and cancelled are dropped); specimen display.
 */
import {
  FeedParseError, MAX_OBSERVATIONS_PER_REPORT, MAX_REPORTS_PER_MESSAGE, feedSex, isoDateOnly, specimenFromText,
  type FeedMessage, type FeedObservation, type FeedPatientIdentity, type FeedReport, type FeedReportStatus,
} from './types.js';

type Json = Record<string, unknown>;

const LOINC_SYSTEM = 'http://loinc.org';
const V2_0203 = 'http://terminology.hl7.org/CodeSystem/v2-0203';

function obj(v: unknown): Json | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null;
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : '';
}

function isoInstant(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  // A bare date is read as midnight Eastern Caribbean Time.
  const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00-04:00` : s);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

function codings(concept: unknown): Json[] {
  return arr(obj(concept)?.coding).map(obj).filter((c): c is Json => c !== null);
}

function conceptText(concept: unknown): string {
  const c = obj(concept);
  if (!c) return '';
  const text = str(c.text);
  if (text) return text;
  for (const cd of codings(c)) {
    const d = str(cd.display);
    if (d) return d;
  }
  return str(codings(c)[0]?.code);
}

function reportStatus(code: string): FeedReportStatus {
  switch (code) {
    case 'final': return 'final';
    case 'amended': case 'corrected': case 'appended': return 'corrected';
    case 'preliminary': case 'registered': return 'preliminary';
    case 'partial': return 'partial';
    case 'cancelled': case 'entered-in-error': return 'cancelled';
    default: return 'unknown';
  }
}

class Resolver {
  private readonly byRef = new Map<string, Json>();

  add(resource: Json, fullUrl: string | null): void {
    const type = str(resource.resourceType), id = str(resource.id);
    if (fullUrl) this.byRef.set(fullUrl, resource);
    if (type && id) this.byRef.set(`${type}/${id}`, resource);
  }

  addContained(owner: Json): void {
    for (const c of arr(owner.contained)) {
      const r = obj(c);
      if (r && str(r.id)) this.byRef.set(`#${str(r.id)}`, r);
    }
  }

  get(reference: unknown): Json | null {
    const ref = str(obj(reference)?.reference);
    if (!ref) return null;
    if (this.byRef.has(ref)) return this.byRef.get(ref)!;
    // Absolute URL whose tail is Type/id.
    const m = /([A-Za-z]+\/[A-Za-z0-9\-.]{1,64})(?:\/_history\/[^/]+)?$/.exec(ref);
    return m ? this.byRef.get(m[1]) ?? null : null;
  }
}

function patientFrom(p: Json | null): FeedPatientIdentity {
  if (!p) return { mrn: null, familyName: null, givenName: null, dob: null, sex: null };
  const ids = arr(p.identifier).map(obj).filter((i): i is Json => i !== null && str(i.value) !== '');
  const isMr = (i: Json) => codings(i.type).some(c => str(c.code).toUpperCase() === 'MR' && (!str(c.system) || str(c.system) === V2_0203));
  const typed = ids.filter(isMr);
  let mrn: string | null = null;
  if (typed.length === 1) mrn = str(typed[0].value);
  else if (typed.length === 0 && ids.length === 1) mrn = str(ids[0].value);
  const name = arr(p.name).map(obj).find(Boolean) ?? null;
  return {
    mrn: mrn || null,
    familyName: name ? str(name.family) || null : null,
    givenName: name ? arr(name.given).map(str).filter(Boolean).join(' ') || null : null,
    dob: isoDateOnly(str(p.birthDate)),
    sex: feedSex(str(p.gender)),
  };
}

function rangeText(rr: unknown): string {
  const parts: string[] = [];
  for (const r of arr(rr).map(obj)) {
    if (!r) continue;
    const text = str(r.text);
    const low = obj(r.low), high = obj(r.high);
    const lo = low ? str(low.value) : '', hi = high ? str(high.value) : '';
    if (lo && hi) parts.push(`${lo}-${hi}`);
    else if (hi) parts.push(`<${hi}`);
    else if (lo) parts.push(`>${lo}`);
    else if (text) parts.push(text);
    if (parts.length > 0) break; // the first (general) range
  }
  return parts[0] ?? '';
}

function observationFrom(o: Json, reportSpecimen: FeedReport['specimen']): FeedObservation | null {
  const status = str(o.status);
  if (status === 'entered-in-error' || status === 'cancelled') return null;
  const cds = codings(o.code);
  const loincCoding = cds.find(c => str(c.system) === LOINC_SYSTEM);
  const other = cds.find(c => str(c.system) !== LOINC_SYSTEM);
  const label = conceptText(o.code);
  if (!label) return null;

  let valueType = 'string';
  let valueText = '';
  let unit = '';
  const q = obj(o.valueQuantity);
  if (q) {
    valueType = 'quantity';
    valueText = `${str(q.comparator)}${str(q.value)}`;
    unit = str(q.unit) || str(q.code);
  } else if (typeof o.valueString === 'string') {
    valueText = str(o.valueString);
  } else if (obj(o.valueCodeableConcept)) {
    valueType = 'codeable';
    valueText = conceptText(o.valueCodeableConcept);
  } else if (typeof o.valueInteger === 'number') {
    valueType = 'integer';
    valueText = str(o.valueInteger);
  } else if (typeof o.valueBoolean === 'boolean') {
    valueType = 'boolean';
    valueText = o.valueBoolean ? 'Positive' : 'Negative';
  } else if (obj(o.dataAbsentReason)) {
    valueText = `No result: ${conceptText(o.dataAbsentReason) || 'not reported'}`;
  }
  const specimenDisplay = str(obj(o.specimen)?.display);
  return {
    loinc: loincCoding ? str(loincCoding.code) || null : null,
    localCode: other ? str(other.code) || null : null,
    label,
    valueType,
    valueText,
    unit,
    referenceRange: rangeText(o.referenceRange),
    abnormalFlags: arr(o.interpretation).flatMap(i => codings(i).map(c => str(c.code).toUpperCase())).filter(Boolean),
    status: status || null,
    comments: arr(o.note).map(n => str(obj(n)?.text)).filter(Boolean),
    observedAt: isoInstant(o.effectiveDateTime) ?? isoInstant(obj(o.effectivePeriod)?.start),
    specimen: specimenFromText(specimenDisplay) ?? specimenFromText(label) ?? reportSpecimen,
  };
}

export function parseFhir(input: unknown): FeedMessage {
  const root = obj(input);
  if (!root) throw new FeedParseError('fhir_not_object', 'The body is not a FHIR resource');
  const type = str(root.resourceType);
  const resolver = new Resolver();
  const reports: Json[] = [];
  let messageId: string | null = null;
  let sentAt: string | null = null;
  let sendingApplication: string | null = null;

  if (type === 'Bundle') {
    const entries = arr(root.entry).map(obj).filter((e): e is Json => e !== null);
    if (entries.length > 5000) throw new FeedParseError('too_many_entries', 'The Bundle has too many entries');
    for (const e of entries) {
      const r = obj(e.resource);
      if (!r) continue;
      resolver.add(r, str(e.fullUrl) || null);
      resolver.addContained(r);
      const rt = str(r.resourceType);
      if (rt === 'DiagnosticReport') reports.push(r);
      if (rt === 'MessageHeader') {
        messageId ??= str(r.id) || null;
        sendingApplication = str(obj(r.source)?.name) || str(obj(r.source)?.endpoint) || null;
      }
    }
    messageId = str(obj(root.identifier)?.value) || messageId || str(root.id) || null;
    sentAt = isoInstant(root.timestamp);
  } else if (type === 'DiagnosticReport') {
    resolver.add(root, null);
    resolver.addContained(root);
    reports.push(root);
    messageId = str(arr(root.identifier).map(obj)[0]?.value) || str(root.id) || null;
  } else {
    throw new FeedParseError('fhir_unsupported_resource', `Expected a Bundle or DiagnosticReport (got ${type.slice(0, 40) || 'none'})`);
  }
  if (!messageId) throw new FeedParseError('missing_message_id', 'The Bundle has no identifier or id');
  if (reports.length === 0) throw new FeedParseError('no_reports', 'The Bundle has no DiagnosticReport');
  if (reports.length > MAX_REPORTS_PER_MESSAGE) throw new FeedParseError('too_many_reports', 'The Bundle has too many reports');

  const out: FeedReport[] = [];
  for (const dr of reports) {
    resolver.addContained(dr);
    const statusCode = str(dr.status) || 'final';
    const testName = conceptText(dr.code) || 'Laboratory report';
    const specimen = specimenFromText(arr(dr.specimen).map(s => str(obj(s)?.display)).join(' ')) ?? specimenFromText(testName);
    const observations: FeedObservation[] = [];
    const seen = new Set<Json>();
    const visit = (ref: unknown, depth: number) => {
      const o = resolver.get(ref);
      if (!o || str(o.resourceType) !== 'Observation' || seen.has(o)) return;
      seen.add(o);
      const members = arr(o.hasMember);
      if (members.length > 0 && depth < 2) {
        for (const m of members) visit(m, depth + 1);
        // A panel Observation with its own value is also a result.
        if (!obj(o.valueQuantity) && typeof o.valueString !== 'string' && !obj(o.valueCodeableConcept)) return;
      }
      const obs = observationFrom(o, specimen);
      if (obs) observations.push(obs);
    };
    for (const ref of arr(dr.result)) visit(ref, 0);
    if (observations.length > MAX_OBSERVATIONS_PER_REPORT) throw new FeedParseError('too_many_observations', 'A report has too many results');
    const identifier = arr(dr.identifier).map(obj).find(i => i && str(i.value));
    const performer = arr(dr.performer).map(p => str(obj(p)?.display)).find(Boolean) ?? null;
    out.push({
      reportId: (identifier ? str(identifier.value) : '') || str(dr.id) || null,
      testName,
      status: reportStatus(statusCode),
      statusCode,
      collectedAt: isoInstant(dr.effectiveDateTime) ?? isoInstant(obj(dr.effectivePeriod)?.start),
      reportedAt: isoInstant(dr.issued),
      performingLab: performer,
      patient: patientFrom(resolver.get(dr.subject)),
      observations,
      comments: [str(dr.conclusion)].filter(Boolean),
      specimen,
    });
  }
  return { format: 'fhir-r4', messageId, sentAt, sendingApplication, sendingFacility: null, reports: out };
}
