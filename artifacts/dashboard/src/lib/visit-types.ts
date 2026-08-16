import type { EncounterType } from '@/context/AppContext';

export const VISIT_TYPES = [
  { id: 'new_consult',      label: 'First Consult',      icon: '🩺', color: '#0d9488', desc: 'New patient or new problem — full history' },
  { id: 'follow_up',        label: 'Follow-up',          icon: '🔄', color: '#2563eb', desc: 'Interval review — SOAP: Subjective → Objective → Assessment → Plan' },
  { id: 'pre_op',           label: 'Pre-op Assessment',  icon: '📋', color: '#7c3aed', desc: 'Pre-operative fitness assessment — indication, background, systems, risk, consent' },
  { id: 'post_op',          label: 'Post-op Review',     icon: '🩹', color: '#7c3aed', desc: 'Wound / recovery review after surgery' },
  { id: 'day_of_surgery',   label: 'Day of Surgery',     icon: '🏥', color: '#0f172a', desc: 'Operative day — WHO checklist, anaesthetic, op note, specimen' },
  { id: 'ercp',             label: 'ERCP',               icon: '🔭', color: '#0891b2', desc: 'Endoscopic retrograde cholangiopancreatography' },
  { id: 'endoscopy_ogd',    label: 'OGD',                icon: '🔭', color: '#0891b2', desc: 'Upper GI endoscopy' },
  { id: 'endoscopy_col',    label: 'Colonoscopy',        icon: '🔭', color: '#0891b2', desc: 'Lower GI endoscopy' },
  { id: 'breast',           label: 'Breast Clinic',      icon: '🩺', color: '#db2777', desc: 'Focused breast assessment — initial or follow-up' },
  { id: 'telephone',        label: 'Telephone',          icon: '📞', color: '#d97706', desc: 'Remote / telephone consultation' },
  { id: 'diabetic_foot',    label: 'Diabetic Foot',      icon: '🦶', color: '#dc2626', desc: 'Foot wound / vascular assessment' },
  { id: 'urgent',           label: 'Urgent Referral',    icon: '🚨', color: '#dc2626', desc: 'Urgent / emergency triage required' },
  { id: 'trauma',           label: 'Trauma',             icon: '⚡', color: '#b91c1c', desc: 'Major trauma — ATLS primary and secondary survey (ABCDE)' },
  { id: 'burns',            label: 'Burns',              icon: '🔥', color: '#ea580c', desc: 'Burns assessment — Lund-Browder TBSA, Parkland formula, Baux score' },
] as const;

export type VisitTypeId = typeof VISIT_TYPES[number]['id'];

/**
 * Single source of truth for what picking a visit type implies — encounter
 * complexity tier (drives NavSidebar phase visibility) and which top-level
 * page it opens. Previously duplicated verbatim in two places in Home.tsx
 * (ambient and non-ambient header), which let them silently drift.
 *
 * `day_of_surgery` maps to 'office_procedure', not 'surgical_consult' —
 * its own description ("WHO checklist, anaesthetic, op note, specimen")
 * needs the 'operative' nav phase, which surgical_consult's phase set
 * doesn't include.
 */
export function resolveEncounterContext(
  visitTypeId: string
): { encounterType: EncounterType | null; topSection: 'trauma' | 'consultation' } {
  if (visitTypeId === 'trauma' || visitTypeId === 'burns') {
    return { encounterType: null, topSection: 'trauma' };
  }
  if (visitTypeId === 'ercp' || visitTypeId === 'endoscopy_ogd' || visitTypeId === 'endoscopy_col') {
    return { encounterType: 'endoscopy', topSection: 'consultation' };
  }
  if (visitTypeId === 'urgent') {
    return { encounterType: 'major_emergency', topSection: 'consultation' };
  }
  if (visitTypeId === 'post_op' || visitTypeId === 'follow_up') {
    return { encounterType: 'quick_consult', topSection: 'consultation' };
  }
  if (visitTypeId === 'day_of_surgery') {
    return { encounterType: 'office_procedure', topSection: 'consultation' };
  }
  return { encounterType: 'surgical_consult', topSection: 'consultation' };
}
