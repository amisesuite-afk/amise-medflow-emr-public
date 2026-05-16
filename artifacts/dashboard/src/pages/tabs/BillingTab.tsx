import CollapsibleCard from '@/components/CollapsibleCard';

export default function BillingTab() {
  return (
    <div className="gap-y">
      <CollapsibleCard title="Billing summary">
        <div className="placeholder-tab">
          <span className="ph-icon">💰</span>
          <span className="ph-title">Billing module</span>
          <span className="ph-sub">Billing and invoicing features will be integrated in a future release. Fee information must not appear in automated patient communications.</span>
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Insurance / NHI details" defaultOpen={false}>
        <div className="form-grid cols-2">
          <div className="fld">
            <label>Insurance provider</label>
            <input placeholder="e.g. SAGICOR, CLICO, GHL…" />
          </div>
          <div className="fld">
            <label>Policy / member number</label>
            <input placeholder="e.g. SGC-1234567" />
          </div>
          <div className="fld">
            <label>NHI / NHIS number</label>
            <input placeholder="National Health Insurance number" />
          </div>
          <div className="fld">
            <label>Pre-authorisation required</label>
            <select>
              <option value="">—</option>
              <option>Yes</option>
              <option>No</option>
              <option>In progress</option>
            </select>
          </div>
        </div>
      </CollapsibleCard>
    </div>
  );
}
