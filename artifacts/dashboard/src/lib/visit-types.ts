export const VISIT_TYPES = [
  { id: 'new_consult',      label: 'First Consult',   icon: '🩺', color: '#0d9488', desc: 'New patient or new problem' },
  { id: 'follow_up',        label: 'Follow-up',       icon: '🔄', color: '#2563eb', desc: 'Interval review — SOAP format' },
  { id: 'post_op',          label: 'Post-op Review',  icon: '🩹', color: '#7c3aed', desc: 'Wound/recovery review after surgery' },
  { id: 'ercp',             label: 'ERCP',            icon: '🔭', color: '#0891b2', desc: 'Endoscopic retrograde cholangiopancreatography' },
  { id: 'endoscopy_ogd',    label: 'OGD',             icon: '🔭', color: '#0891b2', desc: 'Upper GI endoscopy' },
  { id: 'endoscopy_col',    label: 'Colonoscopy',     icon: '🔭', color: '#0891b2', desc: 'Lower GI endoscopy' },
  { id: 'breast',           label: 'Breast Clinic',   icon: '🩺', color: '#db2777', desc: 'Focused breast assessment' },
  { id: 'telephone',        label: 'Telephone',       icon: '📞', color: '#d97706', desc: 'Remote/telephone consultation' },
  { id: 'diabetic_foot',    label: 'Diabetic Foot',   icon: '🦶', color: '#dc2626', desc: 'Foot wound/vascular assessment' },
  { id: 'urgent',           label: 'Urgent Referral', icon: '🚨', color: '#dc2626', desc: 'Urgent/emergency triage required' },
] as const;

export type VisitTypeId = typeof VISIT_TYPES[number]['id'];
