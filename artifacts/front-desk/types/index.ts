export type TriageLevel = 'EMERGENT' | 'URGENT' | 'ROUTINE' | 'INFO';
export type Channel = 'whatsapp' | 'email' | 'sms';
export type ThreadStatus = 'active' | 'pending_approval' | 'resolved' | 'escalated';
export type SiteCode = 'rodney_bay' | 'tapion' | 'castries';

export interface PatientMessage {
  role: 'patient' | 'assistant';
  content: string;
  timestamp: string;
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
