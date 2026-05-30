export type BookingTrack = 'routine' | 'referral' | 'urgent';

export interface TrackConfig {
  lookaheadDays: number;
  maxSlots: number;
  autoConfirm: boolean;
  staffReviewHours: number;
  label: string;
  acuity: string;
}

export const TRACK_CONFIG: Record<BookingTrack, TrackConfig> = {
  routine: {
    lookaheadDays:   21,
    maxSlots:        3,
    autoConfirm:     true,
    staffReviewHours: 0,
    label:           'Routine appointment',
    acuity:          'routine',
  },
  referral: {
    lookaheadDays:   7,
    maxSlots:        5,
    autoConfirm:     false,
    staffReviewHours: 24,
    label:           'GP / specialist referral',
    acuity:          'priority',
  },
  urgent: {
    lookaheadDays:   2,
    maxSlots:        1,
    autoConfirm:     false,
    staffReviewHours: 2,
    label:           'Urgent — staff priority scheduling',
    acuity:          'urgent',
  },
};

export const APPOINTMENT_TYPES: Record<string, { label: string; location: string }> = {
  new_consult:   { label: 'New consultation with Dr Kabiye',    location: 'rodney_bay' },
  follow_up:     { label: 'Follow-up appointment',              location: 'castries'   },
  post_op:       { label: 'Post-operative review',              location: 'castries'   },
  ercp_workup:   { label: 'ERCP / biliary investigation',       location: 'rodney_bay' },
  breast:        { label: 'Breast clinic',                      location: 'rodney_bay' },
  diabetic_foot: { label: 'Diabetic foot clinic',               location: 'rodney_bay' },
  telephone:     { label: 'Telephone review',                   location: 'remote'     },
};

export function encodeReason(
  track: BookingTrack,
  reason: string,
  referralDoctor?: string,
  referralPractice?: string,
): string {
  if (track === 'referral' && referralDoctor) {
    const practice = referralPractice ? ` / ${referralPractice}` : '';
    return `[REFERRAL: ${referralDoctor}${practice}] ${reason}`.trim();
  }
  if (track === 'urgent') return `[URGENT] ${reason}`.trim();
  return `[ROUTINE] ${reason}`.trim();
}

export function decodeTrack(reason: string | null): BookingTrack {
  if (!reason) return 'routine';
  if (reason.startsWith('[REFERRAL')) return 'referral';
  if (reason.startsWith('[URGENT]'))  return 'urgent';
  return 'routine';
}

export const BOOKING_DISCLAIMER = `This booking form arranges an administrative appointment only. It does not constitute medical advice, clinical triage, or a diagnosis of any kind. Appointment availability is subject to confirmation. If you believe you are experiencing a medical emergency — including chest pain, difficulty breathing, stroke symptoms, severe bleeding, or loss of consciousness — please call 911 or go immediately to the nearest emergency department. Do not use this form in an emergency.`;
