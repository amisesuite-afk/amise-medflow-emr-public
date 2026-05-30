export type TriageLevel = 'EMERGENT' | 'URGENT' | 'ROUTINE' | 'INFO';
export type BookingTrack  = 'routine' | 'referral' | 'urgent';
export type BookingStatus = 'pending' | 'staff_confirmed' | 'patient_confirmed' | 'declined' | 'lapsed';
export type Channel = 'whatsapp' | 'email' | 'sms';
export type ThreadStatus = 'active' | 'pending_approval' | 'resolved' | 'escalated';
export type SiteCode = 'rodney_bay' | 'tapion' | 'castries';

export interface TriageSnapshot {
  acuity: string;
  score: number;
  reasons: string[];
  recommendedAction: string;
  appointmentType: string;
  frontDeskScript: string;
  questionsToAsk: string[];
}

export interface AppointmentSlot {
  start: string;       // ISO string
  end: string;         // ISO string
  location: string;
  appointmentType: string;
  display: string;     // Human-readable label
}

export interface PatientMessage {
  role: 'patient' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  meta?:
    | { type: 'triage_result';      payload: TriageSnapshot }
    | { type: 'appointment_slots';  payload: AppointmentSlot[] };
}

export interface ConversationThread {
  id: string;
  channel: Channel;
  patient_identifier: string;
  patient_name: string | null;
  patient_dob: string | null;
  chief_complaint: string | null;
  triage_level: TriageLevel;
  status: ThreadStatus;
  messages: PatientMessage[];
  draft_reply: string | null;
  intake_complete: boolean;
  created_at: string;
  updated_at: string;
  site: SiteCode;
}
