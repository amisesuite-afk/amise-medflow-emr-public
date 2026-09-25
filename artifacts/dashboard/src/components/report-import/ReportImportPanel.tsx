/**
 * "Import lab or imaging report": a Laboratory Services Ltd result or a Tapion Hospital imaging
 * report (OKEU / St Jude's selectable), from a PDF or from pasted text, filed to the chart that is
 * open. Everything is read in the browser (pdf.js text layer) and parsed deterministically
 * (@workspace/triage-engine/report-import, the port of the iOS parsers). No AI, no OCR service:
 * the AI document scan is neither used nor needed.
 *
 * Steps: read text → (no text layer: paste, or attach and enter by hand) → report type → review
 * (identity check with explicit confirmation on any mismatch; every field editable) → Save.
 * Nothing is written before Save. Only nurse / doctor / admin save results; front desk may attach
 * the PDF only.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ECT_OFFSET_MINUTES, calendarDayFromISODate, checkReportIdentity, documentFileName,
  emptyLabImportDraft, guessReportKind, identityRequiresConfirmation, imagingSource,
  imagingSourceLabel, imagingSourceName, labSource, makeImagingImportDraft, makeLabImportDraft,
  modalityShortLabel, parseImagingReport, parseLabReport, parseReportHeader, pdfRejectionMessage,
  sanitisedDisplayName, splitReportLines, validateReportPdf, IMAGING_SOURCE_CHOICES,
  type ChartSex, type ExistingResult, type ImagingImportDraft, type ImagingSourceChoice,
  type LabImportDraft, type ReportHeader, type ReportKind, type ReportTextOrigin,
} from '@workspace/triage-engine/report-import';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ToastProvider';
import {
  insertImportedImagingReport, insertImportedLabResult, loadPatientLabResults, logReportImport,
  uploadReportPdf,
} from '@/lib/db';
import { extractPdfText } from '@/lib/pdf-text';
import { webNameReaders } from '@/lib/lab-reader-keywords';
import {
  buildImagingImportSave, buildLabImportSave, canSaveReportResults, existingFromInvestigationRows,
} from '@/lib/report-import-save';
import IdentityCard from './IdentityCard';
import LabReview from './LabReview';
import ImagingReview from './ImagingReview';

type Stage = 'idle' | 'reading' | 'noText' | 'paste' | 'setup' | 'review' | 'done';

const readers = webNameReaders;

function chartSexOf(sex: string): ChartSex {
  return sex === 'male' ? 'male' : sex === 'female' ? 'female' : 'unspecified';
}

export default function ReportImportPanel({ onSaved }: { onSaved?: () => void }) {
  const {
    patientId, encounterId, patientName, dob, sex,
    investigationResults, setInvestigationResults, extractedLabs, setExtractedLabs,
  } = useAppContext();
  const { profile, session } = useAuth();
  const { showToast } = useToast();
  const canSaveResults = canSaveReportResults(profile?.role);

  const [stage, setStage] = useState<Stage>('idle');
  const [pdf, setPdf] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [origin, setOrigin] = useState<ReportTextOrigin>('none');
  const [message, setMessage] = useState<string | null>(null);
  const [kind, setKind] = useState<ReportKind>('lab');
  const [suggestedKind, setSuggestedKind] = useState<ReportKind | null>(null);
  const [imagingChoice, setImagingChoice] = useState<ImagingSourceChoice>('tapion');
  const [customSource, setCustomSource] = useState('');
  const [header, setHeader] = useState<ReportHeader | null>(null);
  const [labDraft, setLabDraft] = useState<LabImportDraft | null>(null);
  const [imagingDraft, setImagingDraft] = useState<ImagingImportDraft | null>(null);
  const [existing, setExisting] = useState<ExistingResult[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachedDocId, setAttachedDocId] = useState<string | null>(null);
  const [summary, setSummary] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfUrlRef = useRef<string | null>(null);

  function reset() {
    setStage('idle'); setPdf(null); setText(''); setOrigin('none'); setMessage(null);
    setKind('lab'); setSuggestedKind(null); setImagingChoice('tapion'); setCustomSource('');
    setHeader(null); setLabDraft(null); setImagingDraft(null); setExisting([]);
    setSaving(false); setError(null); setAttachedDocId(null); setSummary([]);
    if (pdfUrlRef.current) { URL.revokeObjectURL(pdfUrlRef.current); pdfUrlRef.current = null; }
  }

  // A different chart: never carry a half-reviewed report across patients.
  useEffect(() => { reset(); }, [patientId]);           // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current); }, []);

  const chartDOB = calendarDayFromISODate(dob);
  const chartSex = chartSexOf(sex);

  function identityFor(h: ReportHeader) {
    return checkReportIdentity({
      header: h, chartName: patientName, chartDOB: chartDOB ? [chartDOB] : null, chartSex, nowMs: Date.now(),
    });
  }

  function viewPdf() {
    if (!pdf) return;
    if (!pdfUrlRef.current) pdfUrlRef.current = URL.createObjectURL(pdf);
    window.open(pdfUrlRef.current, '_blank', 'noopener,noreferrer');
  }

  // ── Read ────────────────────────────────────────────────────────────────────

  async function handleFile(file: File) {
    setError(null);
    const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
    const rejection = validateReportPdf(file.name, file.size, head);
    if (rejection) { setError(pdfRejectionMessage(rejection)); return; }
    setPdf(file);
    setStage('reading');
    const result = await extractPdfText(await file.arrayBuffer());
    switch (result.kind) {
      case 'text':
        setText(result.text); setOrigin('pdfText'); prepareSetup(result.text); break;
      case 'noTextLayer':
        setMessage('This PDF has no text layer — it is a scanned image.'); setStage('noText'); break;
      case 'locked':
        setMessage('This PDF is password-protected, so its text cannot be read.'); setStage('noText'); break;
      case 'unreadable':
        setMessage('This file could not be opened as a PDF.'); setStage('noText'); break;
    }
  }

  function prepareSetup(t: string) {
    if (t.trim() !== '') {
      const guess = guessReportKind(t);
      setSuggestedKind(guess);
      setKind(guess);
      setHeader(parseReportHeader(splitReportLines(t).map(l => l.text)));
    } else {
      setSuggestedKind(null);
      setHeader(null);
    }
    setStage('setup');
  }

  async function buildDrafts() {
    if (!patientId) return;
    const now = Date.now();
    if (kind === 'lab') {
      const rows = await loadPatientLabResults(patientId);
      const ex = existingFromInvestigationRows(rows);
      setExisting(ex);
      setLabDraft(text.trim() === ''
        ? emptyLabImportDraft(now, origin)
        : makeLabImportDraft({ report: parseLabReport(text, now), origin, existing: ex, nowMs: now, offsetMinutes: ECT_OFFSET_MINUTES, readers }));
    } else {
      setImagingDraft(makeImagingImportDraft({
        report: parseImagingReport(text, now), origin, sourceChoice: imagingChoice, customSource,
        nowMs: now, offsetMinutes: ECT_OFFSET_MINUTES,
      }));
    }
    setStage('review');
  }

  // ── Save (the only place that writes) ───────────────────────────────────────

  async function attachPdfOnce(documentType: 'lab_report' | 'imaging_report', fileName: string, title: string, notes: string): Promise<string | null | 'failed'> {
    if (!pdf || !patientId) return null;
    if (attachedDocId) return attachedDocId;
    const { id, error: err } = await uploadReportPdf({
      patientId, encounterId, file: pdf, fileName, documentType, title, notes,
      userId: session?.user?.id ?? profile?.id ?? null,
    });
    if (err || !id) {
      setError(`The PDF could not be attached (${err ?? 'unknown error'}). Nothing was saved.`);
      return 'failed';
    }
    setAttachedDocId(id);
    logReportImport({ resourceType: 'document', resourceId: id, patientId, details: { category: documentType, source: 'pdf_import' } });
    return id;
  }

  async function saveLab() {
    if (!patientId || !labDraft) return;
    const identity = identityFor(labDraft.header);
    const manual = identityRequiresConfirmation(identity);
    if (manual && !labDraft.identityConfirmed) return;
    setSaving(true); setError(null);
    try {
      const sourceTag = pdf ? 'pdf_import' : 'pasted_text';
      const fileName = documentFileName('LabResults', labDraft.collectedAt, labDraft.accession, ECT_OFFSET_MINUTES);
      const docId = await attachPdfOnce('lab_report', fileName, `Lab report${labDraft.accession.trim() ? ` ${labDraft.accession.trim()}` : ''}`, labSource(origin, true));
      if (docId === 'failed') return;
      const lines: string[] = [];
      if (docId) lines.push('PDF attached to the record (Documents).');
      if (canSaveResults) {
        const save = buildLabImportSave({
          draft: labDraft, readers, patientId, encounterId,
          source: labSource(labDraft.origin, pdf !== null), documentId: docId,
        });
        if (save.count > 0) {
          const { id, error: err } = await insertImportedLabResult({ ...save.row });
          if (err || !id) {
            setError(docId
              ? `The PDF was attached, but the results were not saved (${err ?? 'unknown error'}). Press Save again to retry — the PDF will not be attached twice.`
              : `The results were not saved (${err ?? 'unknown error'}). Press Save again to retry.`);
            return;
          }
          logReportImport({
            resourceType: 'lab_result', resourceId: id, patientId,
            details: { source: sourceTag, rows: save.count, identity: manual ? 'confirmed_by_clinician' : 'matched' },
          });
          if (Object.keys(save.sessionResults).length > 0) setInvestigationResults({ ...investigationResults, ...save.sessionResults });
          if (Object.keys(save.scoreInputs).length > 0) setExtractedLabs({ ...extractedLabs, ...save.scoreInputs });
          lines.push(`${save.count} result${save.count === 1 ? '' : 's'} saved to the record (Results inbox).`);
          if (Object.keys(save.scoreInputs).length > 0) lines.push(`Score inputs updated for this encounter: ${Object.keys(save.scoreInputs).join(', ')}.`);
          for (const k of save.keptOutOfSession) {
            lines.push(`“${k.name}” is in the saved report but not in this consultation's results list (decision support would read it as ${k.readers.join(', ')}).`);
          }
        }
      }
      setSummary(lines);
      setStage('done');
      showToast(lines[0] ?? 'Saved', 'success');
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  async function saveImaging() {
    if (!patientId || !imagingDraft) return;
    const identity = identityFor(imagingDraft.header);
    const manual = identityRequiresConfirmation(identity);
    if (manual && !imagingDraft.identityConfirmed) return;
    setSaving(true); setError(null);
    try {
      const sourceTag = pdf ? 'pdf_import' : 'pasted_text';
      const prefix = 'Imaging_' + sanitisedDisplayName(modalityShortLabel(imagingDraft.modality));
      const fileName = documentFileName(prefix, imagingDraft.examDate, imagingDraft.accession, ECT_OFFSET_MINUTES);
      const docId = await attachPdfOnce('imaging_report', fileName, `Imaging report${imagingDraft.accession.trim() ? ` ${imagingDraft.accession.trim()}` : ''}`, imagingSource(imagingDraft, true));
      if (docId === 'failed') return;
      const lines: string[] = [];
      if (docId) lines.push('PDF attached to the record (Documents).');
      if (canSaveResults) {
        const row = buildImagingImportSave({
          draft: imagingDraft, patientId, encounterId, source: imagingSource(imagingDraft, pdf !== null),
          sourceName: imagingSourceName(imagingDraft), documentId: docId, nowMs: Date.now(),
        });
        const { id, error: err } = await insertImportedImagingReport({ ...row });
        if (err || !id) {
          setError(docId
            ? `The PDF was attached, but the report was not saved (${err ?? 'unknown error'}). Press Save again to retry — the PDF will not be attached twice.`
            : `The report was not saved (${err ?? 'unknown error'}). Press Save again to retry.`);
          return;
        }
        logReportImport({
          resourceType: 'imaging_report', resourceId: id, patientId,
          details: { source: sourceTag, modality: imagingDraft.modality, identity: manual ? 'confirmed_by_clinician' : 'matched' },
        });
        lines.push('Imaging report saved to the record (Results inbox).');
      }
      setSummary(lines);
      setStage('done');
      showToast(lines[0] ?? 'Saved', 'success');
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const labIdentity = useMemo(() => (labDraft ? identityFor(labDraft.header) : null),
    [labDraft, patientName, dob, sex]);                 // eslint-disable-line react-hooks/exhaustive-deps
  const imagingIdentity = useMemo(() => (imagingDraft ? identityFor(imagingDraft.header) : null),
    [imagingDraft, patientName, dob, sex]);             // eslint-disable-line react-hooks/exhaustive-deps

  if (!patientId) {
    return <div style={{ fontSize: 13, color: '#64748b' }}>Open a patient's record to import a report for them.</div>;
  }

  const btn: React.CSSProperties = {
    padding: '7px 14px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff',
    color: '#1e293b', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  };
  const primary: React.CSSProperties = { ...btn, background: '#0d9488', color: '#fff', border: 'none' };

  return (
    <div>
      {error && (
        <div role="alert" style={{ padding: '8px 12px', borderRadius: 6, background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>
          {error}
        </div>
      )}

      {stage === 'idle' && (
        <div>
          <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 10px', lineHeight: 1.6 }}>
            Laboratory Services Ltd results or a hospital imaging report, for <b>{patientName || 'this patient'}</b>.
            The PDF is read in this browser — no AI and no upload until you save — and every value is shown for review first.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" style={primary} onClick={() => fileRef.current?.click()}>📄 Choose PDF</button>
            <button type="button" style={btn} onClick={() => { setOrigin('pasted'); setStage('paste'); }}>📋 Paste report text</button>
          </div>
          <input
            ref={fileRef} type="file" accept="application/pdf,.pdf" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void handleFile(f); }}
          />
        </div>
      )}

      {stage === 'reading' && <div style={{ fontSize: 13, color: '#64748b', fontStyle: 'italic' }}>Reading the report in this browser…</div>}

      {stage === 'noText' && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{message}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
            Scanned reports are not read automatically here (no OCR service is used). Choose how to continue.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" style={btn} onClick={() => { setOrigin('pasted'); setStage('paste'); }}>📋 Paste the report text</button>
            {pdf && (
              <button type="button" style={btn} onClick={() => { setText(''); setOrigin('none'); prepareSetup(''); }}>
                📎 Attach the PDF and enter results by hand
              </button>
            )}
            {pdf && <button type="button" style={btn} onClick={viewPdf}>View PDF</button>}
            <button type="button" style={btn} onClick={reset}>Cancel</button>
          </div>
        </div>
      )}

      {stage === 'paste' && (
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }} htmlFor="report-import-text">Report text</label>
          <textarea
            id="report-import-text" value={text} onChange={e => setText(e.target.value)} rows={12} spellCheck={false}
            placeholder="Copy the text from the lab or imaging portal and paste it here."
            style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, padding: 8 }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" style={text.trim() ? primary : { ...btn, opacity: 0.5, cursor: 'default' }} disabled={!text.trim()}
              onClick={() => { setOrigin('pasted'); prepareSetup(text); }}>Continue</button>
            <button type="button" style={btn} onClick={reset}>Cancel</button>
          </div>
        </div>
      )}

      {stage === 'setup' && (
        <div>
          {pdf && <div style={{ fontSize: 12, color: '#475569', marginBottom: 8 }}>File: {pdf.name} <button type="button" style={{ ...btn, padding: '2px 8px', fontSize: 11, marginLeft: 6 }} onClick={viewPdf}>View PDF</button></div>}
          <fieldset style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
            <legend style={{ fontSize: 12, fontWeight: 700 }}>Report type</legend>
            <label style={{ display: 'block', fontSize: 13, cursor: 'pointer' }}>
              <input type="radio" name="report-kind" checked={kind === 'lab'} onChange={() => setKind('lab')} /> Lab result (Laboratory Services Ltd)
            </label>
            <label style={{ display: 'block', fontSize: 13, cursor: 'pointer' }}>
              <input type="radio" name="report-kind" checked={kind === 'imaging'} onChange={() => setKind('imaging')} /> Imaging report
            </label>
            {kind === 'imaging' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                <select aria-label="Imaging source" value={imagingChoice} onChange={e => setImagingChoice(e.target.value as ImagingSourceChoice)} style={{ fontSize: 13 }}>
                  {IMAGING_SOURCE_CHOICES.map(s => <option key={s} value={s}>{imagingSourceLabel(s)}</option>)}
                </select>
                {imagingChoice === 'other' && <input aria-label="Imaging provider" placeholder="Imaging provider" value={customSource} onChange={e => setCustomSource(e.target.value)} style={{ fontSize: 13 }} />}
              </div>
            )}
            {suggestedKind && (
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                Suggested from the text: {suggestedKind === 'lab' ? 'lab result' : 'imaging report'}. Change it if it is wrong.
              </div>
            )}
          </fieldset>
          <div style={{ fontSize: 12, color: '#475569', marginBottom: 10 }}>
            Patient: <b>{patientName || 'this patient'}</b>
            {header?.patientName && <> · on the report: {header.patientName}</>}
            <div style={{ fontSize: 11, color: '#64748b' }}>The name and date of birth are checked against this chart before anything is saved.</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={primary} onClick={() => void buildDrafts()}>Continue to review</button>
            <button type="button" style={btn} onClick={reset}>Cancel</button>
          </div>
        </div>
      )}

      {stage === 'review' && kind === 'lab' && labDraft && labIdentity && (
        <>
          <LabReview
            draft={labDraft}
            onChange={setLabDraft}
            readers={readers}
            existing={existing}
            canSaveResults={canSaveResults}
            hasPdf={pdf !== null}
            identityNeedsConfirmation={identityRequiresConfirmation(labIdentity)}
            identityCard={(
              <IdentityCard check={labIdentity} header={labDraft.header} chartName={patientName} chartDOB={chartDOB}
                chartSex={chartSex} confirmed={labDraft.identityConfirmed}
                onConfirmedChange={v => setLabDraft({ ...labDraft, identityConfirmed: v })} />
            )}
            onViewPdf={pdf ? viewPdf : null}
            onSave={() => void saveLab()}
            saving={saving}
          />
          <button type="button" style={{ ...btn, marginTop: 10 }} onClick={reset} disabled={saving}>Cancel</button>
        </>
      )}

      {stage === 'review' && kind === 'imaging' && imagingDraft && imagingIdentity && (
        <>
          <ImagingReview
            draft={imagingDraft}
            onChange={setImagingDraft}
            canSaveReport={canSaveResults}
            hasPdf={pdf !== null}
            identityNeedsConfirmation={identityRequiresConfirmation(imagingIdentity)}
            identityCard={(
              <IdentityCard check={imagingIdentity} header={imagingDraft.header} chartName={patientName} chartDOB={chartDOB}
                chartSex={chartSex} confirmed={imagingDraft.identityConfirmed}
                onConfirmedChange={v => setImagingDraft({ ...imagingDraft, identityConfirmed: v })} />
            )}
            onViewPdf={pdf ? viewPdf : null}
            onSave={() => void saveImaging()}
            saving={saving}
          />
          <button type="button" style={{ ...btn, marginTop: 10 }} onClick={reset} disabled={saving}>Cancel</button>
        </>
      )}

      {stage === 'done' && (
        <div>
          <ul style={{ margin: '0 0 10px 18px', padding: 0 }}>
            {summary.map(s => <li key={s} style={{ fontSize: 13 }}>{s}</li>)}
          </ul>
          <button type="button" style={btn} onClick={reset}>Import another report</button>
        </div>
      )}
    </div>
  );
}
