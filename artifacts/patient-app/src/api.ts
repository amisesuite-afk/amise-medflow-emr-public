const API = '/api';

const SESSION_KEY = 'amise_patient_session';

export interface PatientSession {
  sessionToken: string;
  email: string;
  patientName: string | null;
  patientId: string | null;
  isReturnPatient: boolean;
  mustChangePassword: boolean;
}

export function getStoredSession(): PatientSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as PatientSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(s: PatientSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function requestAccess(email: string): Promise<void> {
  const r = await fetch(`${API}/patient/auth/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const d = await r.json() as { error?: string };
  if (!r.ok) throw new Error(d.error ?? 'Failed to send access email');
}

export async function login(email: string, password: string): Promise<PatientSession> {
  const r = await fetch(`${API}/patient/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const d = await r.json() as PatientSession & { error?: string };
  if (!r.ok) throw new Error(d.error ?? 'Login failed');
  return d;
}

export async function changePassword(sessionToken: string, newPassword: string): Promise<void> {
  const r = await fetch(`${API}/patient/auth/change-password`, {
    method: 'POST',
    headers: authHeaders(sessionToken),
    body: JSON.stringify({ newPassword }),
  });
  const d = await r.json() as { error?: string };
  if (!r.ok) throw new Error(d.error ?? 'Password change failed');
}

// ── Profile ───────────────────────────────────────────────────────────────────

export interface PatientProfile {
  patientName: string | null;
  appointmentDate?: string | null;
  isReturnPatient?: boolean;
  hasPendingPrevisit?: boolean;
  passport?: Record<string, unknown> | null;
  monitoringCount?: number;
}

export async function getPatientProfile(sessionToken: string): Promise<PatientProfile> {
  const r = await fetch(`${API}/patient/profile`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (!r.ok) throw new Error('Session expired');
  return r.json() as Promise<PatientProfile>;
}

// ── Previsit ──────────────────────────────────────────────────────────────────

export async function submitPrevisit(
  sessionToken: string,
  data: Record<string, unknown>,
): Promise<unknown> {
  const r = await fetch(`${API}/previsit/submit`, {
    method: 'POST',
    headers: authHeaders(sessionToken),
    body: JSON.stringify(data),
  });
  return r.json();
}

// ── Passport ──────────────────────────────────────────────────────────────────

export async function savePassport(
  sessionToken: string,
  passport: Record<string, unknown>,
): Promise<unknown> {
  const r = await fetch(`${API}/patient/passport`, {
    method: 'POST',
    headers: authHeaders(sessionToken),
    body: JSON.stringify({ passport }),
  });
  return r.json();
}

// ── Patient messages ──────────────────────────────────────────────────────────

export interface PatientMessage {
  id: string;
  created_at: string;
  transcript: string | null;
  staff_notes: string | null;
  status: string;
}

export async function sendMessage(
  sessionToken: string,
  text: string,
): Promise<{ call_log_id: string }> {
  const r = await fetch(`${API}/patient/message`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const d = await r.json() as { call_log_id?: string; error?: string };
  if (!r.ok) throw new Error(d.error ?? 'Failed to send message');
  return d as { call_log_id: string };
}

export async function getMessages(sessionToken: string): Promise<PatientMessage[]> {
  const r = await fetch(`${API}/patient/messages`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (!r.ok) return [];
  const d = await r.json() as PatientMessage[];
  return Array.isArray(d) ? d : [];
}

// ── Monitoring ────────────────────────────────────────────────────────────────

export async function addMonitoringPhoto(
  sessionToken: string,
  photo: { dataUrl: string; context: string; painScore?: number; note?: string },
): Promise<unknown> {
  const r = await fetch(`${API}/patient/monitoring`, {
    method: 'POST',
    headers: authHeaders(sessionToken),
    body: JSON.stringify({ photo }),
  });
  return r.json();
}

// ── Magic link ────────────────────────────────────────────────────────────────

export async function exchangeMagicLink(token: string): Promise<PatientSession> {
  const r = await fetch(`${API}/patient/auth/exchange-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  const d = await r.json() as PatientSession & { error?: string };
  if (!r.ok) throw new Error(d.error ?? 'Link exchange failed');
  return d;
}

// ── Pre-visit prefill ─────────────────────────────────────────────────────────

export interface PrevisitPrefill {
  chiefComplaint: string;
  appointmentType: string;
  allergies: string;
  medications: Array<{ name: string; dose: string; frequency: string }>;
  pmh: string[];
  lastVitals: {
    bp_systolic?: number | null;
    bp_diastolic?: number | null;
    heart_rate?: number | null;
    temperature_c?: number | null;
    oxygen_saturation?: number | null;
    weight_kg?: number | null;
    glucose_mmol?: number | null;
    recorded_at?: string | null;
  } | null;
}

export async function getPrevisitData(sessionToken: string): Promise<PrevisitPrefill> {
  const r = await fetch(`${API}/patient/previsit-data`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (!r.ok) {
    const d = await r.json() as { error?: string };
    throw new Error(d.error ?? 'Failed to fetch pre-fill data');
  }
  return r.json() as Promise<PrevisitPrefill>;
}

// ── Document upload ───────────────────────────────────────────────────────────

export async function uploadFile(
  sessionToken: string,
  dataUrl: string,
  fileName: string,
  label: string,
): Promise<{ publicUrl: string; path: string; fileType: string }> {
  const r = await fetch(`${API}/patient/upload`, {
    method: 'POST',
    headers: authHeaders(sessionToken),
    body: JSON.stringify({ dataUrl, fileName, label }),
  });
  const d = await r.json() as { publicUrl?: string; path?: string; fileType?: string; error?: string };
  if (!r.ok) throw new Error(d.error ?? 'Upload failed');
  return d as { publicUrl: string; path: string; fileType: string };
}
