/**
 * `documents` rows written by the dashboard (lib/document-types.ts) against the schema the
 * migration runner actually applies. The CHECK lists and required columns are parsed from the
 * `supabase*.sql` files in `.github/workflows/run-migrations.yml` order, so a schema change
 * breaks this test instead of every upload in production.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_SOURCE_VALUES, DOCUMENT_TYPE_LABELS, DOCUMENT_TYPE_VALUES, UPLOAD_DOCUMENT_TYPES,
  buildDocumentInsert, describeDocumentSaveError, documentTitle, documentTypeLabel,
  documentTypeValue, fileBaseName,
} from '../document-types';

const ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

// ─── Minimal parser for the `documents` table across the applied migrations ──────────────────

interface Column { notNull: boolean; hasDefault: boolean }
interface DocumentsSchema {
  createdIn: string[];
  columns: Map<string, Column>;
  typeCheck: string[] | null;
  sourceCheck: string[] | null;
}

function stripComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, '');
}

/** Splits on commas that are not inside parentheses or quotes. */
function splitTopLevel(body: string): string[] {
  const out: string[] = [];
  let depth = 0, quoted = false, cur = '';
  for (const ch of body) {
    if (ch === "'") quoted = !quoted;
    if (!quoted && ch === '(') depth++;
    if (!quoted && ch === ')') depth--;
    if (!quoted && depth === 0 && ch === ',') { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** The text inside the parentheses that open at `open`. */
function balanced(text: string, open: number): string {
  let depth = 0, quoted = false;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (ch === "'") quoted = !quoted;
    if (quoted) continue;
    if (ch === '(') depth++;
    if (ch === ')' && --depth === 0) return text.slice(open + 1, i);
  }
  throw new Error('unbalanced parentheses');
}

function inList(clause: string, column: string): string[] | null {
  const m = new RegExp(`check\\s*\\(\\s*${column}\\s+in\\s*\\(([^)]*)\\)`, 'i').exec(clause);
  return m ? [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]) : null;
}

function columnDef(rest: string): Column {
  return { notNull: /\bnot\s+null\b|\bprimary\s+key\b/i.test(rest), hasDefault: /\bdefault\b/i.test(rest) };
}

function appliedMigrationFiles(): string[] {
  const wf = read('.github/workflows/run-migrations.yml');
  return [...wf.matchAll(/jq -Rs \. < (\S+\.sql)/g)].map(m => m[1]);
}

function parseDocumentsSchema(files: string[]): DocumentsSchema {
  const schema: DocumentsSchema = { createdIn: [], columns: new Map(), typeCheck: null, sourceCheck: null };
  for (const file of files) {
    const sql = stripComments(read(file));

    for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?documents\s*\(/gi)) {
      schema.createdIn.push(file);
      if (schema.createdIn.length > 1) continue;   // IF NOT EXISTS: the first definition wins
      const body = balanced(sql, m.index! + m[0].length - 1);
      for (const item of splitTopLevel(body)) {
        const types = inList(item, 'document_type');
        const sources = inList(item, 'source');
        if (types) schema.typeCheck = types;
        if (sources) schema.sourceCheck = sources;
        if (/^(constraint|check|primary|unique|foreign)\b/i.test(item)) continue;
        const [name, ...rest] = item.split(/\s+/);
        schema.columns.set(name.toLowerCase(), columnDef(rest.join(' ')));
      }
    }

    for (const m of sql.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?documents\b([^;]*);/gi)) {
      for (const clause of splitTopLevel(m[1])) {
        let c: RegExpExecArray | null;
        if ((c = /^add\s+column\s+(?:if\s+not\s+exists\s+)?(\w+)([\s\S]*)$/i.exec(clause))) {
          if (!schema.columns.has(c[1].toLowerCase())) schema.columns.set(c[1].toLowerCase(), columnDef(c[2]));
        } else if ((c = /^drop\s+column\s+(?:if\s+exists\s+)?(\w+)/i.exec(clause))) {
          schema.columns.delete(c[1].toLowerCase());
        } else if ((c = /^alter\s+column\s+(\w+)\s+(drop|set)\s+(not\s+null|default)/i.exec(clause))) {
          const col = schema.columns.get(c[1].toLowerCase());
          if (col) {
            if (/not/i.test(c[3])) col.notNull = c[2].toLowerCase() === 'set';
            else col.hasDefault = c[2].toLowerCase() === 'set';
          }
        } else if (/^drop\s+constraint\s+(?:if\s+exists\s+)?documents_document_type_check\b/i.test(clause)) {
          schema.typeCheck = null;
        } else if (/^drop\s+constraint\s+(?:if\s+exists\s+)?documents_source_check\b/i.test(clause)) {
          schema.sourceCheck = null;
        } else if (/^add\s+constraint\s+documents_document_type_check\b/i.test(clause)) {
          schema.typeCheck = inList(clause, 'document_type');
        } else if (/^add\s+constraint\s+documents_source_check\b/i.test(clause)) {
          schema.sourceCheck = inList(clause, 'source');
        }
      }
    }
  }
  return schema;
}

const APPLIED = appliedMigrationFiles();
const SCHEMA = parseDocumentsSchema(APPLIED);
const REQUIRED = [...SCHEMA.columns].filter(([, c]) => c.notNull && !c.hasDefault).map(([n]) => n);

// ─── Schema facts (sanity checks on the parser itself) ───────────────────────────────────────

describe('documents schema as the migration runner applies it', () => {
  it('reads the runner order and finds exactly one CREATE TABLE documents', () => {
    expect(APPLIED.length).toBeGreaterThan(50);
    expect(APPLIED).not.toContain('supabase-all-migrations-consolidated.sql');
    expect(SCHEMA.createdIn).toEqual(['supabase-clinical-records-migration.sql']);
  });

  it('has a document_type CHECK, a source CHECK and a required title', () => {
    expect(SCHEMA.typeCheck).not.toBeNull();
    expect(SCHEMA.sourceCheck).not.toBeNull();
    expect(REQUIRED).toContain('title');
    // Migration 11 (email document intake) made patient_id nullable.
    expect(SCHEMA.columns.get('patient_id')?.notNull).toBe(false);
  });

  it('DOCUMENT_TYPE_VALUES is exactly the applied document_type CHECK list', () => {
    expect([...DOCUMENT_TYPE_VALUES].sort()).toEqual([...(SCHEMA.typeCheck ?? [])].sort());
    expect(SCHEMA.typeCheck).toContain('other');
  });

  it('every source the dashboard writes is in the applied source CHECK', () => {
    for (const s of DOCUMENT_SOURCE_VALUES) expect(SCHEMA.sourceCheck).toContain(s);
  });

  it('the api-server and front-desk type allow-lists stay inside the CHECK', () => {
    for (const file of [
      'artifacts/api-server/src/routes/portal.ts',
      'artifacts/api-server/src/routes/email-intake.ts',
      'artifacts/front-desk/app/api/documents/migrate/route.ts',
    ]) {
      const src = read(file);
      const lists = [...src.matchAll(/(?:DOCUMENT_TYPES|VALID_DOC_TYPES)\s*=\s*\[([^\]]*)\]/g)];
      expect(lists.length, file).toBeGreaterThan(0);
      for (const l of lists) {
        for (const [, v] of l[1].matchAll(/'([^']+)'/g)) expect(SCHEMA.typeCheck, `${file}: ${v}`).toContain(v);
      }
    }
  });
});

// ─── Insert payloads ─────────────────────────────────────────────────────────────────────────

const PATIENT = '00000000-0000-4000-8000-000000000001';
const WHEN = new Date('2026-09-26T02:00:00Z');   // 25 Sep 2026, 22:00 in Saint Lucia

function expectSatisfiesSchema(row: Record<string, unknown>) {
  for (const key of Object.keys(row)) expect([...SCHEMA.columns.keys()], `unknown column ${key}`).toContain(key);
  for (const col of REQUIRED) {
    expect(row[col], `required column ${col}`).toBeDefined();
    expect(row[col], `required column ${col}`).not.toBeNull();
    expect(String(row[col]).trim(), `required column ${col}`).not.toBe('');
  }
  expect(SCHEMA.typeCheck).toContain(row.document_type);
  expect(SCHEMA.sourceCheck).toContain(row.source);
}

describe('buildDocumentInsert', () => {
  it('builds a schema-valid row for every Documents tab upload choice', () => {
    for (const t of UPLOAD_DOCUMENT_TYPES) {
      const row = buildDocumentInsert({
        patientId: PATIENT, encounterId: null, type: t.label, fileName: 'Scan 12.pdf',
        storagePath: `${PATIENT}/1-Scan 12.pdf`, mimeType: 'application/pdf', fileSizeBytes: 1234,
        notes: '  ', userId: null, when: WHEN,
      });
      expectSatisfiesSchema({ ...row });
      expect(row.document_type).toBe(t.value);
      expect(row.notes).toBeNull();
    }
  });

  it('builds a schema-valid row with no file name, unknown type and a clinical attachment', () => {
    const noName = buildDocumentInsert({ patientId: PATIENT, type: 'Lab Report', fileName: '', storagePath: 'p', when: WHEN });
    expectSatisfiesSchema({ ...noName });
    expect(noName.title).toBe('Lab Report — 25 Sep 2026');
    expect(noName.file_name).toBeNull();

    const unknown = buildDocumentInsert({ patientId: PATIENT, type: 'Tax Return', fileName: 'x.pdf', storagePath: 'p', when: WHEN });
    expectSatisfiesSchema({ ...unknown });
    expect(unknown.document_type).toBe('other');

    const photo = buildDocumentInsert({ patientId: PATIENT, type: 'clinical_photo', fileName: 'IMG_0042.HEIC', storagePath: 'p', when: WHEN });
    expectSatisfiesSchema({ ...photo });
    expect(photo.document_type).toBe('clinical_photo');
    expect(photo.title).toBe('IMG_0042');
  });

  it('keeps an explicit title (report import) and still satisfies the schema', () => {
    const row = buildDocumentInsert({
      patientId: PATIENT, encounterId: '00000000-0000-4000-8000-000000000002', type: 'lab_report',
      title: 'Lab report 26-44102', fileName: 'cbc.pdf', storagePath: 'p', mimeType: 'application/pdf', when: WHEN,
    });
    expectSatisfiesSchema({ ...row });
    expect(row.title).toBe('Lab report 26-44102');
  });

  it('every dashboard insert into documents goes through buildDocumentInsert', () => {
    const srcDir = fileURLToPath(new URL('../../', import.meta.url));
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) { if (name !== '__tests__') walk(p); }
        else if (/\.(ts|tsx)$/.test(name)) files.push(p);
      }
    };
    walk(srcDir);
    let inserts = 0;
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/from\(\s*['"]documents['"]\s*\)\s*\.(insert|upsert)\(\s*([\w]+)/g)) {
        inserts++;
        expect(m[2], `${f}: documents.${m[1]} must pass buildDocumentInsert(...)`).toBe('buildDocumentInsert');
      }
    }
    expect(inserts).toBeGreaterThanOrEqual(2);
  });
});

// ─── Type mapping and display ────────────────────────────────────────────────────────────────

describe('documentTypeValue / documentTypeLabel', () => {
  it('maps display labels explicitly, in any case or spacing', () => {
    expect(documentTypeValue('Lab Report')).toBe('lab_report');
    expect(documentTypeValue('lab report')).toBe('lab_report');
    expect(documentTypeValue('Operative Note')).toBe('surgical_report');
    expect(documentTypeValue('Pathology Report')).toBe('lab_report');
    expect(documentTypeValue('Insurance Document')).toBe('insurance_form');
    expect(documentTypeValue('Clinic Letter')).toBe('other');
    expect(documentTypeValue('Surgical Report')).toBe('surgical_report');
  });

  it('passes stored values through and sends anything unknown to other', () => {
    for (const v of DOCUMENT_TYPE_VALUES) expect(documentTypeValue(v)).toBe(v);
    expect(documentTypeValue('histology_report')).toBe('other');
    expect(documentTypeValue('')).toBe('other');
    expect(documentTypeValue(null)).toBe('other');
  });

  it('shows stored values in display form', () => {
    expect(documentTypeLabel('lab_report')).toBe('Lab Report');
    expect(documentTypeLabel('insurance_form')).toBe('Insurance Document');
    expect(documentTypeLabel('clinical_photo')).toBe('Clinical Photo');
    for (const v of DOCUMENT_TYPE_VALUES) expect(documentTypeLabel(v)).toBe(DOCUMENT_TYPE_LABELS[v]);
  });

  it('shows rows stored in display form (older upload code) as they were chosen', () => {
    expect(documentTypeLabel('Lab Report')).toBe('Lab Report');
    expect(documentTypeLabel('Pathology Report')).toBe('Pathology Report');
    expect(documentTypeLabel('Operative Note')).toBe('Operative Note');
    expect(documentTypeLabel('LAB_REPORT')).toBe('Lab Report');
  });

  it('title-cases unknown snake_case values and never shows an empty type', () => {
    expect(documentTypeLabel('endoscopy_report')).toBe('Endoscopy Report');
    expect(documentTypeLabel('')).toBe('Other');
    expect(documentTypeLabel(null)).toBe('Other');
  });

  it('a label that has its own stored value round-trips', () => {
    for (const t of UPLOAD_DOCUMENT_TYPES) {
      if (DOCUMENT_TYPE_LABELS[t.value] === t.label) expect(documentTypeLabel(documentTypeValue(t.label))).toBe(t.label);
    }
  });
});

describe('documentTitle', () => {
  it('uses the file name without its extension', () => {
    expect(fileBaseName('Scan 12.pdf')).toBe('Scan 12');
    expect(fileBaseName('folder/report.final.PDF')).toBe('report.final');
    expect(documentTitle({ label: 'Lab Report', fileName: 'CBC 2026-09-20.pdf', when: WHEN })).toBe('CBC 2026-09-20');
  });

  it('falls back to "<type> — <date>" (Saint Lucia date) when there is no usable name', () => {
    expect(documentTitle({ label: 'Referral Letter', fileName: null, when: WHEN })).toBe('Referral Letter — 25 Sep 2026');
    expect(documentTitle({ label: 'Referral Letter', fileName: '.pdf', when: WHEN })).toBe('Referral Letter — 25 Sep 2026');
    expect(documentTitle({ label: null, fileName: '   ', when: WHEN })).toBe('Other — 25 Sep 2026');
  });

  it('keeps a label that has no exact stored type in the title', () => {
    expect(documentTitle({ label: 'Pathology Report', fileName: 'biopsy.pdf', when: WHEN })).toBe('Pathology Report — biopsy');
    expect(documentTitle({ label: 'Clinic Letter', fileName: 'letter.docx', when: WHEN })).toBe('Clinic Letter — letter');
    expect(documentTitle({ label: 'Pathology Report', fileName: 'pathology report 3.pdf', when: WHEN })).toBe('pathology report 3');
  });

  it('caps the length', () => {
    expect(documentTitle({ label: 'Other', fileName: `${'x'.repeat(400)}.pdf`, when: WHEN }).length).toBeLessThanOrEqual(200);
  });
});

describe('describeDocumentSaveError', () => {
  it('says why in plain words and keeps the database message', () => {
    const check = describeDocumentSaveError({ code: '23514', message: 'new row for relation "documents" violates check constraint "documents_document_type_check"' });
    expect(check).toMatch(/^Not saved — the database did not accept this document type/);
    expect(check).toContain('documents_document_type_check');
    expect(describeDocumentSaveError({ code: '23502', message: 'null value in column "title"' })).toMatch(/required document field/);
    expect(describeDocumentSaveError({ code: '42501', message: 'permission denied for table documents' })).toMatch(/not allowed/);
    expect(describeDocumentSaveError({ code: 'PGRST204', message: "Could not find the 'original_filename' column" })).toMatch(/does not match/);
    expect(describeDocumentSaveError(null)).toBe('Not saved — the database refused the record.');
  });
});
