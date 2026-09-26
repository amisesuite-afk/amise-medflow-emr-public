import { useEffect, useState } from 'react';
import {
  loadPatientImagingReports, loadPatientLabResults, reportPdfLink,
  type ImportedImagingRow, type ImportedLabResultRow,
} from '@/lib/db';
import { formatEct } from '@/lib/report-import-save';
import { isLabFeedRow } from '@/lib/lab-feed-session';

/**
 * Lab and imaging reports on file for the open patient (investigation_results rows with
 * analytes, imaging_orders with a report), newest first — so an imported report is visible on
 * the Investigations tab as well as in the Results inbox. Read-only.
 */
export default function ImportedReportsList({ patientId, refreshKey, onUseInConsultation }: {
  patientId: string | null;
  refreshKey: number;
  /** Lab-feed rows: copy the values into this consultation (explicit clinician tap only). */
  onUseInConsultation?: (row: ImportedLabResultRow) => void;
}) {
  const [labs, setLabs] = useState<ImportedLabResultRow[]>([]);
  const [imaging, setImaging] = useState<ImportedImagingRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!patientId) { setLabs([]); setImaging([]); return; }
    setLoading(true);
    void Promise.all([loadPatientLabResults(patientId), loadPatientImagingReports(patientId)]).then(([l, i]) => {
      if (cancelled) return;
      setLabs(l); setImaging(i); setLoading(false);
    });
    return () => { cancelled = true; };
  }, [patientId, refreshKey]);

  async function openPdf(documentId: string) {
    const url = await reportPdfLink(documentId);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  if (!patientId) return null;
  if (loading && labs.length === 0 && imaging.length === 0) return <div style={{ fontSize: 12, color: '#64748b' }}>Loading…</div>;
  if (labs.length === 0 && imaging.length === 0) return <div style={{ fontSize: 12, color: '#64748b' }}>No lab or imaging reports on file yet.</div>;

  const when = (iso: string | null, fallback: string) => formatEct(Date.parse(iso ?? fallback));
  const linkBtn: React.CSSProperties = { fontSize: 11, padding: '1px 8px', borderRadius: 5, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', marginLeft: 8 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {labs.map(r => (
        <div key={r.id} style={{ border: `1px solid ${r.is_critical ? '#fca5a5' : '#e2e8f0'}`, borderRadius: 8, padding: '8px 10px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
            {r.test_name} · {when(r.collected_at, r.created_at)}
            {r.is_critical && <span style={{ color: '#b91c1c', marginLeft: 6 }}>⚠ critical</span>}
            {r.linked_document_id && <button type="button" style={linkBtn} onClick={() => void openPdf(r.linked_document_id!)}>PDF</button>}
            {onUseInConsultation && isLabFeedRow(r) && (
              <button type="button" style={linkBtn} onClick={() => onUseInConsultation(r)} title="Copy these values into this consultation's results and score inputs">
                Use in this consultation
              </button>
            )}
          </div>
          {r.notes && <div style={{ fontSize: 11, color: '#64748b' }}>{r.notes}</div>}
          {isLabFeedRow(r) && (
            <div style={{ fontSize: 11, color: r.status === 'resulted' ? '#b45309' : '#15803d' }}>
              {r.status === 'resulted' ? 'Lab feed · received — awaiting clinician review (Results Inbox)' : 'Lab feed · reviewed'}
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {(r.analytes ?? []).map((a, i) => {
              const critical = a.critical === true, abnormal = a.abnormal === true;
              return (
                <span key={i} style={{
                  fontSize: 11, padding: '2px 7px', borderRadius: 4, fontFamily: 'monospace',
                  background: critical ? '#fee2e2' : abnormal ? '#fef3c7' : '#f8fafc',
                  color: critical ? '#b91c1c' : abnormal ? '#92400e' : '#475569',
                  border: `1px solid ${critical ? '#fca5a5' : abnormal ? '#fcd34d' : '#e2e8f0'}`,
                }}>
                  {String(a.name ?? '')}: <b>{String(a.value ?? '')}</b>{a.unit ? ` ${String(a.unit)}` : ''}{a.flag ? ` ${String(a.flag)}` : ''}
                </span>
              );
            })}
          </div>
        </div>
      ))}
      {imaging.map(r => (
        <div key={r.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
            {r.body_area ?? r.order_type} · {when(r.performed_at, r.created_at)}
            {r.linked_document_id && <button type="button" style={linkBtn} onClick={() => void openPdf(r.linked_document_id!)}>PDF</button>}
          </div>
          {r.notes && <div style={{ fontSize: 11, color: '#64748b' }}>{r.notes}</div>}
          {r.report_text && <div style={{ fontSize: 12, whiteSpace: 'pre-wrap', marginTop: 4, color: '#334155' }}>{r.report_text}</div>}
        </div>
      ))}
    </div>
  );
}
