/**
 * The `documents` table's type vocabulary, and the one place the dashboard builds a row for it.
 *
 * The live table (supabase-clinical-records-migration.sql, then Migration 12
 * supabase-documents-clinical-photo-migration.sql) has:
 *   - `document_type text not null` with CHECK `documents_document_type_check` — snake_case values
 *     only (DOCUMENT_TYPE_VALUES below);
 *   - `title text not null` (no default);
 *   - `source text not null default 'uploaded'` with CHECK `documents_source_check`.
 * The Documents tab used to insert display labels ("Lab Report") and no title, so every upload
 * failed both constraints. `__tests__/document-types.test.ts` parses the CHECK lists and required
 * columns out of the migrations the runner applies, so a schema change breaks the test first.
 *
 * Pure module: no Supabase import, safe to unit-test.
 */

/** Values allowed by `documents_document_type_check` (Migration 12). */
export const DOCUMENT_TYPE_VALUES = [
  'lab_report', 'imaging_report', 'referral_letter', 'consent_form', 'surgical_report',
  'discharge_summary', 'prescription', 'insurance_form', 'clinical_photo', 'other',
] as const;
export type DocumentTypeValue = typeof DOCUMENT_TYPE_VALUES[number];

/** The `documents_source_check` values the dashboard writes (staff uploads only). */
export const DOCUMENT_SOURCE_VALUES = ['uploaded'] as const;
export type DocumentSourceValue = typeof DOCUMENT_SOURCE_VALUES[number];

/** How each stored value is shown (same wording as ReferringProvidersTab). */
export const DOCUMENT_TYPE_LABELS: Record<DocumentTypeValue, string> = {
  lab_report:        'Lab Report',
  imaging_report:    'Imaging Report',
  referral_letter:   'Referral Letter',
  consent_form:      'Consent Form',
  surgical_report:   'Surgical Report',
  discharge_summary: 'Discharge Summary',
  prescription:      'Prescription',
  insurance_form:    'Insurance Document',
  clinical_photo:    'Clinical Photo',
  other:             'Other',
};

/**
 * The Documents tab's upload choices and what each is stored as. Three have no exact match in the
 * CHECK list; their label is kept in the title instead (see documentTitle).
 */
export const UPLOAD_DOCUMENT_TYPES: ReadonlyArray<{ label: string; value: DocumentTypeValue }> = [
  { label: 'Referral Letter',    value: 'referral_letter' },
  { label: 'Operative Note',     value: 'surgical_report' },   // no exact value — title keeps "Operative Note"
  { label: 'Discharge Summary',  value: 'discharge_summary' },
  { label: 'Lab Report',         value: 'lab_report' },
  { label: 'Imaging Report',     value: 'imaging_report' },
  { label: 'Pathology Report',   value: 'lab_report' },        // no exact value — title keeps "Pathology Report"
  { label: 'Consent Form',       value: 'consent_form' },
  { label: 'Insurance Document', value: 'insurance_form' },
  { label: 'Clinic Letter',      value: 'other' },             // no exact value — title keeps "Clinic Letter"
  { label: 'Clinical Photo',     value: 'clinical_photo' },
  { label: 'Other',              value: 'other' },
];

const VALUE_SET: ReadonlySet<string> = new Set(DOCUMENT_TYPE_VALUES);

function isDocumentTypeValue(s: string): s is DocumentTypeValue {
  return VALUE_SET.has(s);
}

/** "Lab Report", "lab report", "lab-report", "LAB_REPORT" → "lab_report". */
function snake(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

const LABEL_TO_VALUE: ReadonlyMap<string, DocumentTypeValue> = new Map<string, DocumentTypeValue>([
  ...UPLOAD_DOCUMENT_TYPES.map(t => [snake(t.label), t.value] as [string, DocumentTypeValue]),
  ...DOCUMENT_TYPE_VALUES.map(v => [snake(DOCUMENT_TYPE_LABELS[v]), v] as [string, DocumentTypeValue]),
]);

/**
 * Maps a display label or a stored value to a value the CHECK accepts. Anything unknown is
 * 'other' — never passed through.
 */
export function documentTypeValue(labelOrValue: string | null | undefined): DocumentTypeValue {
  if (!labelOrValue) return 'other';
  const raw = labelOrValue.trim();
  if (isDocumentTypeValue(raw)) return raw;
  const key = snake(raw);
  if (isDocumentTypeValue(key)) return key;
  return LABEL_TO_VALUE.get(key) ?? 'other';
}

/**
 * The label shown for a stored `document_type`. Handles both forms: snake_case values, and a
 * display label stored by the old upload code in an environment without the CHECK (shown as it
 * was chosen, e.g. "Pathology Report"). An unrecognised snake_case value is title-cased.
 */
export function documentTypeLabel(stored: string | null | undefined): string {
  if (!stored || !stored.trim()) return DOCUMENT_TYPE_LABELS.other;
  const raw = stored.trim();
  if (isDocumentTypeValue(raw)) return DOCUMENT_TYPE_LABELS[raw];
  const legacy = UPLOAD_DOCUMENT_TYPES.find(t => snake(t.label) === snake(raw));
  if (legacy) return legacy.label;
  const key = snake(raw);
  if (isDocumentTypeValue(key)) return DOCUMENT_TYPE_LABELS[key];
  if (/^[a-z0-9_]+$/.test(raw)) {
    return raw.split('_').filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
  }
  return raw;
}

/** File name without its folder or extension ("Scan 12.pdf" → "Scan 12"). */
export function fileBaseName(fileName: string | null | undefined): string {
  if (!fileName) return '';
  const name = fileName.split(/[\\/]/).pop() ?? '';
  const noExt = name.replace(/\.[A-Za-z0-9]{1,5}$/, '');
  return noExt.trim();
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "25 Sep 2026", Eastern Caribbean Time. */
export function ectDateLabel(when: Date): string {
  // Numeric parts plus a fixed month list: ICU versions differ on "Sep" vs "Sept".
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/St_Lucia', day: '2-digit', month: 'numeric', year: 'numeric',
  }).formatToParts(when);
  const part = (t: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === t)?.value ?? '';
  const month = MONTHS[Number(part('month')) - 1] ?? part('month');
  return `${part('day')} ${month} ${part('year')}`;
}

const TITLE_MAX = 200;

/**
 * `documents.title` is NOT NULL. The file name without its extension; "<type> — <date>" when there
 * is no usable name. When the chosen label has no exact stored type (Pathology Report → lab_report),
 * the label leads the title so the distinction is not lost.
 */
export function documentTitle(input: { label?: string | null; fileName?: string | null; when: Date }): string {
  const value = documentTypeValue(input.label);
  const label = input.label?.trim() || DOCUMENT_TYPE_LABELS[value];
  const base = fileBaseName(input.fileName);
  let title: string;
  if (!base) title = `${label} — ${ectDateLabel(input.when)}`;
  else if (snake(label) !== snake(DOCUMENT_TYPE_LABELS[value]) && !snake(base).includes(snake(label))) {
    title = `${label} — ${base}`;
  } else title = base;
  return title.length > TITLE_MAX ? title.slice(0, TITLE_MAX - 1) + '…' : title;
}

/** Exactly the columns the dashboard writes to `documents`. */
export interface DocumentInsertRow {
  patient_id: string;
  encounter_id: string | null;
  document_type: DocumentTypeValue;
  title: string;
  file_name: string | null;
  storage_path: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  source: DocumentSourceValue;
  notes: string | null;
  created_by: string | null;
}

/** Builds a `documents` row that satisfies the table's NOT NULL columns and CHECKs. */
export function buildDocumentInsert(input: {
  patientId: string;
  encounterId?: string | null;
  /** A display label ("Lab Report") or a stored value ("lab_report"). */
  type: string;
  /** Overrides the derived title (e.g. "Lab report 26-44102" from the report import). */
  title?: string | null;
  fileName: string | null;
  storagePath: string;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  source?: DocumentSourceValue;
  notes?: string | null;
  userId?: string | null;
  when?: Date;
}): DocumentInsertRow {
  const when = input.when ?? new Date();
  const explicitTitle = input.title?.trim();
  return {
    patient_id:      input.patientId,
    encounter_id:    input.encounterId ?? null,
    document_type:   documentTypeValue(input.type),
    title:           explicitTitle
      ? explicitTitle.slice(0, TITLE_MAX)
      : documentTitle({ label: input.type, fileName: input.fileName, when }),
    file_name:       input.fileName || null,
    storage_path:    input.storagePath,
    mime_type:       input.mimeType || null,
    file_size_bytes: typeof input.fileSizeBytes === 'number' && Number.isFinite(input.fileSizeBytes) ? input.fileSizeBytes : null,
    source:          input.source ?? 'uploaded',
    notes:           input.notes?.trim() ? input.notes.trim() : null,
    created_by:      input.userId ?? null,
  };
}

/**
 * A plain-language reason for a failed `documents` write, with the database's own message kept
 * at the end for support.
 */
export function describeDocumentSaveError(err: { message?: string | null; code?: string | null } | string | null | undefined): string {
  const message = (typeof err === 'string' ? err : err?.message) ?? '';
  const code = typeof err === 'string' ? '' : (err?.code ?? '');
  let reason: string;
  if (code === '23514' || /check constraint/i.test(message)) {
    reason = 'the database did not accept this document type';
  } else if (code === '23502' || /not-null constraint|null value in column/i.test(message)) {
    reason = 'a required document field was missing';
  } else if (code === '42501' || /permission denied|row-level security/i.test(message)) {
    reason = 'your account is not allowed to save documents';
  } else if (code === 'PGRST204' || /could not find the .* column/i.test(message)) {
    reason = 'the database does not match this version of the app';
  } else if (/failed to fetch|network/i.test(message)) {
    reason = 'the server could not be reached';
  } else {
    reason = 'the database refused the record';
  }
  return message ? `Not saved — ${reason} (${message}).` : `Not saved — ${reason}.`;
}
