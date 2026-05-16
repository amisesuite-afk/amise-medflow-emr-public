import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';

export default function DocumentsTab() {
  const { documents, setDocuments } = useAppContext();

  return (
    <div className="gap-y">
      <CollapsibleCard title="Documents and correspondence">
        <div className="placeholder-tab">
          <span className="ph-icon">📁</span>
          <span className="ph-title">Documents</span>
          <span className="ph-sub">File upload and document management will be available in a future release.</span>
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Clinical letter / discharge summary" defaultOpen={false}>
        <div className="fld">
          <label>Draft letter or discharge summary</label>
          <textarea
            value={documents}
            onChange={e => setDocuments(e.target.value)}
            placeholder="Dear Dr,&#10;&#10;Thank you for referring this patient…"
            style={{ minHeight: 200 }}
          />
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Linked imaging / results" defaultOpen={false}>
        <div className="placeholder-tab">
          <span className="ph-icon">🔬</span>
          <span className="ph-title">Results linking</span>
          <span className="ph-sub">Link to external PACS / RIS / LIS in a future integration phase.</span>
        </div>
      </CollapsibleCard>
    </div>
  );
}
