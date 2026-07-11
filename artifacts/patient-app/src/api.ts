const API = '/api';

export interface PatientProfile {
  patientName: string;
  appointmentDate?: string;
  previsitId?: string;
}

export async function getPatientProfile(token: string): Promise<PatientProfile> {
  const r = await fetch(`${API}/patient/profile?token=${encodeURIComponent(token)}`);
  if (!r.ok) throw new Error('Invalid token');
  return r.json() as Promise<PatientProfile>;
}

export async function submitPrevisit(
  token: string,
  data: Record<string, unknown>,
): Promise<unknown> {
  const r = await fetch(`${API}/previsit/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient_token: token, ...data }),
  });
  return r.json();
}

export async function savePassport(
  token: string,
  passport: Record<string, unknown>,
): Promise<unknown> {
  const r = await fetch(`${API}/patient/passport`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient_token: token, passport }),
  });
  return r.json();
}

export async function addMonitoringPhoto(
  token: string,
  photo: { dataUrl: string; context: string },
): Promise<unknown> {
  const r = await fetch(`${API}/patient/monitoring`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient_token: token, photo }),
  });
  return r.json();
}
