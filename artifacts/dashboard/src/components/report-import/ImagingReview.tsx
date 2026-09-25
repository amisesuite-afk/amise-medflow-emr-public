import {
  IMAGING_MODALITIES, IMAGING_SOURCE_CHOICES, imagingInvestigationName, imagingSource,
  imagingSourceLabel, modalityDisplayName, portalLinkErrorMessage, validatedPortalLink,
  type ImagingImportDraft, type ImagingModality, type ImagingSourceChoice,
} from '@workspace/triage-engine/report-import';
import { fromEctInputValue, imagingReviewCanSave, imagingSaveTitle, toEctInputValue } from '@/lib/report-import-save';

const field: React.CSSProperties = { fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 };
const input: React.CSSProperties = { fontSize: 13, padding: '5px 8px' };

/**
 * Review of a parsed imaging report before saving: identity check with explicit confirmation,
 * editable modality, exam, date, accession, impression and findings, an optional portal link
 * (opened in a new tab only — never fetched, never stored with credentials). Images are not
 * imported: they stay in the hospital portal.
 */
export default function ImagingReview({
  draft, onChange, canSaveReport, hasPdf, identityCard, identityNeedsConfirmation, onViewPdf, onSave, saving,
}: {
  draft: ImagingImportDraft;
  onChange: (d: ImagingImportDraft) => void;
  canSaveReport: boolean;
  hasPdf: boolean;
  identityCard: React.ReactNode;
  identityNeedsConfirmation: boolean;
  onViewPdf: (() => void) | null;
  onSave: () => void;
  saving: boolean;
}) {
  const link = validatedPortalLink(draft);
  const linkError = link && !link.ok ? link.error : null;
  const hasContent = draft.impression.trim() !== '' || draft.findings.trim() !== '';
  const canSave = !saving && imagingReviewCanSave({
    identityNeedsConfirmation, identityConfirmed: draft.identityConfirmed, canSaveReport,
    portalLinkInvalid: linkError !== null, hasContent, hasPdf,
  });
  const title = imagingSaveTitle(canSaveReport);
  const set = (patch: Partial<ImagingImportDraft>) => onChange({ ...draft, ...patch });

  return (
    <div>
      {identityCard}
      {!canSaveReport && (
        <div style={{ padding: '8px 12px', borderRadius: 8, background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: 13, marginBottom: 10 }}>
          🔒 Only a nurse or doctor can save the report. You can attach the PDF to the record.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 10 }}>
        <label style={field}>
          Modality
          <select value={draft.modality} onChange={e => set({ modality: e.target.value as ImagingModality })} style={input}>
            {IMAGING_MODALITIES.map(m => <option key={m} value={m}>{modalityDisplayName(m)}</option>)}
          </select>
        </label>
        <label style={field}>
          Examination
          <input value={draft.examTitle} placeholder="e.g. Abdomen and pelvis" onChange={e => set({ examTitle: e.target.value })} style={input} />
        </label>
        <label style={field}>
          Exam date (ECT)
          <input type="datetime-local" value={toEctInputValue(draft.examDate)}
            onChange={e => { const v = fromEctInputValue(e.target.value); if (v !== null) set({ examDate: v }); }} style={input} />
        </label>
        <label style={field}>
          Accession / study number
          <input value={draft.accession} onChange={e => set({ accession: e.target.value })} style={input} />
        </label>
        <label style={field}>
          Source
          <select value={draft.sourceChoice} onChange={e => set({ sourceChoice: e.target.value as ImagingSourceChoice })} style={input}>
            {IMAGING_SOURCE_CHOICES.map(s => <option key={s} value={s}>{imagingSourceLabel(s)}</option>)}
          </select>
        </label>
        {draft.sourceChoice === 'other' && (
          <label style={field}>
            Imaging provider
            <input value={draft.customSource} onChange={e => set({ customSource: e.target.value })} style={input} />
          </label>
        )}
      </div>
      <div style={{ fontSize: 12, color: '#475569', marginBottom: 10 }}>
        Saved as <b>{imagingInvestigationName(draft.modality, draft.examTitle)}</b> · “{imagingSource(draft, hasPdf)}”
        {onViewPdf && <button type="button" onClick={onViewPdf} style={{ marginLeft: 10, fontSize: 12, padding: '3px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>View PDF</button>}
      </div>

      <label style={{ ...field, marginBottom: 4 }}>
        Portal link (optional)
        <input type="url" value={draft.portalLink} placeholder="https://…" onChange={e => set({ portalLink: e.target.value })} style={input} autoComplete="off" />
      </label>
      {linkError !== null && <div style={{ fontSize: 12, color: '#b45309', marginBottom: 6 }}>⚠ {portalLinkErrorMessage(linkError)}</div>}
      {link && link.ok && (
        <a href={link.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, display: 'inline-block', marginBottom: 6 }}>Open in portal ↗</a>
      )}
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>
        Images stay in the hospital portal; they are not imported. The link only opens a new tab — MedFlow never signs in to the portal or stores portal passwords.
      </div>

      <label style={{ ...field, marginBottom: 10 }}>
        Impression / conclusion
        <textarea value={draft.impression} onChange={e => set({ impression: e.target.value })} rows={4} style={{ ...input, fontFamily: 'inherit' }} />
      </label>
      <label style={{ ...field, marginBottom: 10 }}>
        Findings
        <textarea value={draft.findings} onChange={e => set({ findings: e.target.value })} rows={7} style={{ ...input, fontFamily: 'inherit' }} />
      </label>
      {draft.clinicalHistory !== '' && (
        <label style={{ ...field, marginBottom: 10 }}>
          Clinical history (from the report)
          <textarea value={draft.clinicalHistory} onChange={e => set({ clinicalHistory: e.target.value })} rows={2} style={{ ...input, fontFamily: 'inherit' }} />
        </label>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
        <button type="button" onClick={onSave} disabled={!canSave} style={{
          padding: '8px 18px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 700,
          background: canSave ? '#0d9488' : '#e2e8f0', color: canSave ? '#fff' : '#94a3b8', cursor: canSave ? 'pointer' : 'default',
        }}>
          {saving ? 'Saving…' : title}
        </button>
        <span style={{ fontSize: 11, color: '#64748b' }}>Nothing is saved until you press {title}.</span>
      </div>
    </div>
  );
}
