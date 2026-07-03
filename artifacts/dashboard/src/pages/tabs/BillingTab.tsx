import CollapsibleCard from '@/components/CollapsibleCard';
import { useAppContext } from '@/context/AppContext';
import CodingAssistant from '@/components/CodingAssistant';

const APPT_LABELS: Record<string, string> = {
  new_consult:   'New Consultation',
  follow_up:     'Follow-up Consultation',
  post_op:       'Post-operative Review',
  ercp_workup:   'ERCP Work-up',
  ercp:          'ERCP Procedure',
  breast:        'Breast Clinic',
  telephone:     'Telephone Consultation',
  diabetic_foot: 'Diabetic Foot Clinic',
};

export default function BillingTab() {
  const ctx = useAppContext();

  const apptLabel = APPT_LABELS[ctx.triageResult.appointmentType] ?? ctx.triageResult.appointmentType;

  return (
    <div className="gap-y">
      <CollapsibleCard title="Encounter summary">
        <div className="form-grid cols-2">
          <div className="fld">
            <label>Patient</label>
            <input readOnly value={ctx.patientName || '—'} />
          </div>
          <div className="fld">
            <label>Appointment type</label>
            <input readOnly value={apptLabel} />
          </div>
          <div className="fld">
            <label>Site</label>
            <input readOnly value={ctx.currentSite.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} />
          </div>
          <div className="fld">
            <label>Acuity</label>
            <input readOnly value={ctx.triageResult.acuity.toUpperCase()} />
          </div>
        </div>
        <div className="fld" style={{ marginTop: 10 }}>
          <label>Billing notes</label>
          <textarea
            rows={3}
            placeholder="Internal billing notes (not visible to patient)…"
            value={ctx.billing}
            onChange={e => ctx.setBilling(e.target.value)}
          />
        </div>
        <p style={{ fontSize: 11, color: '#888', marginTop: 8 }}>
          Fee information must not appear in automated patient communications.
        </p>
      </CollapsibleCard>

      <CollapsibleCard title="Insurance / NHI details" defaultOpen>
        <div className="form-grid cols-2">
          <div className="fld">
            <label>Insurance provider</label>
            <input
              placeholder="e.g. SAGICOR, CLICO, GHL…"
              value={ctx.insuranceProvider}
              onChange={e => ctx.setInsuranceProvider(e.target.value)}
            />
          </div>
          <div className="fld">
            <label>Policy / member number</label>
            <input
              placeholder="e.g. SGC-1234567"
              value={ctx.policyNumber}
              onChange={e => ctx.setPolicyNumber(e.target.value)}
            />
          </div>
          <div className="fld">
            <label>NHI / NHIS number</label>
            <input
              placeholder="National Health Insurance number"
              value={ctx.nhiNumber}
              onChange={e => ctx.setNhiNumber(e.target.value)}
            />
          </div>
          <div className="fld">
            <label>Pre-authorisation status</label>
            <select
              value={ctx.preAuthStatus}
              onChange={e => ctx.setPreAuthStatus(e.target.value)}
            >
              <option value="">—</option>
              <option value="not_required">Not required</option>
              <option value="required_pending">Required — pending</option>
              <option value="approved">Approved</option>
              <option value="declined">Declined</option>
            </select>
          </div>
        </div>
      </CollapsibleCard>
      <CodingAssistant />
    </div>
  );
}
