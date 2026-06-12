import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { sb, getSupabaseAdmin, audit, requireStaffAuth } from '../lib/supabase.js';
import { sendSms } from '../lib/sms.js';

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function getPatientId(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const jwt = authHeader.slice(7);
  const { data } = await sb().auth.getUser(jwt);
  if (!data?.user) return null;
  const { data: patient } = await sb()
    .from('patients')
    .select('id')
    .eq('auth_user_id', data.user.id)
    .single();
  return patient?.id ?? null;
}

// Like getPatientId, but also returns the Supabase auth user id — needed to
// verify a storage path belongs to the calling patient (paths are
// `${authUserId}/...`) before we register it as a clinical document.
async function getPatientAuth(authHeader: string | undefined): Promise<{ authUserId: string; patientId: string } | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const jwt = authHeader.slice(7);
  const { data } = await sb().auth.getUser(jwt);
  if (!data?.user) return null;
  const { data: patient } = await sb()
    .from('patients')
    .select('id')
    .eq('auth_user_id', data.user.id)
    .single();
  if (!patient?.id) return null;
  return { authUserId: data.user.id, patientId: patient.id };
}

// ── Portal invite helper ──────────────────────────────────────────────────────
// Creates (or reuses) the Supabase Auth user for an email, sends the magic-link
// invite, and marks the patient record as portal-enabled. Shared by the manual
// staff invite endpoint and the auto-invite-on-registration flow below.
async function sendPortalInvite(patientId: string, normalEmail: string): Promise<string | null> {
  const portalUrl = process.env.PORTAL_URL ?? 'https://front-desk-amisesuite-afks-projects.vercel.app/patient';
  // Route through the auth callback (which knows how to parse the implicit-flow
  // token hash) rather than dumping the link straight on /patient — landing
  // there directly skips session detection and bounces the patient back to login.
  const redirectTo = `${new URL(portalUrl).origin}/patient/auth/callback?next=${encodeURIComponent('/patient')}`;

  const { data: invite, error: inviteErr } = await sb().auth.admin.inviteUserByEmail(normalEmail, { redirectTo });

  let authUserId: string | null = null;
  if (inviteErr) {
    // User may already exist — page through listUsers() to find them (it
    // does not support filtering by email, and the match could be on any page).
    if (inviteErr.message?.toLowerCase().includes('already been registered')) {
      for (let page = 1; page <= 20 && !authUserId; page++) {
        const usersResp = await sb().auth.admin.listUsers({ page, perPage: 200 });
        const users = usersResp.data?.users ?? [];
        authUserId = users.find((u: { email?: string; id: string }) => u.email === normalEmail)?.id ?? null;
        if (users.length < 200) break;
      }
    } else {
      throw inviteErr;
    }
  } else {
    authUserId = invite.user?.id ?? null;
  }

  const updates: Record<string, unknown> = {
    email: normalEmail,
    portal_enabled: true,
    portal_registered_at: new Date().toISOString(),
  };
  if (authUserId) updates.auth_user_id = authUserId;

  await sb().from('patients').update(updates).eq('id', patientId);

  await audit({
    action: 'portal_invite_sent',
    entityType: 'patient',
    entityId: patientId,
    payload: { email: normalEmail, auth_user_id: authUserId },
  });

  return authUserId;
}

// ── POST /api/patient/invite ──────────────────────────────────────────────────
// Staff invites a patient to the portal by email.
router.post('/api/patient/invite', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const { patient_id, email } = (req.body ?? {}) as { patient_id?: string; email?: string };

  if (!patient_id || !email?.trim()) {
    res.status(400).json({ error: 'patient_id and email are required' });
    return;
  }

  const normalEmail = email.trim().toLowerCase();

  try {
    const authUserId = await sendPortalInvite(patient_id, normalEmail);
    res.json({ success: true, auth_user_id: authUserId });
  } catch (err) {
    req.log.error({ err }, '[portal/invite] error');
    res.status(500).json({ error: String(err) });
  }
});

// ── POST /api/patient/portal/register-by-phone ───────────────────────────────
// Staff enables portal access for a patient using just name + phone — no
// password, PIN, or email required from the patient. Sign-in afterwards goes
// through the existing passwordless SMS-code flow (sms-code/request|verify):
// the patient only ever enters their phone number and a one-time code that
// expires in an hour. Nothing is created that could be guessed, written down,
// or shared — that's the whole point of preferring this over a password.
//
// Supabase's OTP machinery needs *an* email to key on internally; patients who
// give only a phone number get an internal placeholder address they never see
// or use (mirrors the synthetic-email pattern already used for WhatsApp intake).
router.post('/api/patient/portal/register-by-phone', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const { patientName, patientPhone } = (req.body ?? {}) as {
    patientName?: string;
    patientPhone?: string;
  };

  if (!patientName?.trim() || !patientPhone?.trim()) {
    res.status(400).json({ error: 'patientName and patientPhone are required' });
    return;
  }

  const phone = patientPhone.trim();
  const placeholderEmail = `phone.${phone.replace(/\D/g, '')}@noreply.amise.internal`;

  try {
    const { data: existing, error: lookupErr } = await sb()
      .from('patients')
      .select('id, email')
      .eq('phone', phone)
      .maybeSingle();
    if (lookupErr) throw lookupErr;

    let patientId: string;
    let finalEmail: string;

    if (existing) {
      patientId = existing.id;
      finalEmail = existing.email?.trim().toLowerCase() || placeholderEmail;
    } else {
      const { data: created, error: createErr } = await sb()
        .from('patients')
        .insert({ full_name: patientName.trim(), phone, email: placeholderEmail })
        .select('id')
        .single();
      if (createErr || !created) throw createErr ?? new Error('Failed to create patient record');
      patientId = created.id;
      finalEmail = placeholderEmail;
    }

    await sb()
      .from('patients')
      .update({
        email: finalEmail,
        portal_enabled: true,
        portal_registered_at: new Date().toISOString(),
      })
      .eq('id', patientId);

    await audit({
      action: 'portal_invite_sent',
      entityType: 'patient',
      entityId: patientId,
      payload: { method: 'sms_code', phone, placeholder_email: finalEmail === placeholderEmail },
    });

    res.json({ success: true, patient_id: patientId });
  } catch (err) {
    req.log.error({ err }, '[portal/register-by-phone] error');
    res.status(500).json({ error: String(err) });
  }
});

// ── SMS sign-in (alternative to email magic-link) ────────────────────────────
// Email magic-links are fragile in in-app browsers and useless for patients
// who don't check email regularly. This reuses Supabase's own OTP machinery —
// generateLink() returns a 6-digit `email_otp` alongside the email link — so
// no separate code-storage table is needed; we just deliver that code over SMS
// instead of email and verify it the normal way.

const smsCodeCooldown = new Map<string, number>();
const SMS_CODE_COOLDOWN_MS = 60_000;

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

async function findPortalPatientByPhone(normalPhone: string): Promise<{ id: string; email: string; phone: string } | null> {
  const { data: candidates } = await sb()
    .from('patients')
    .select('id, email, phone')
    .eq('portal_enabled', true)
    .not('email', 'is', null)
    .not('phone', 'is', null);

  const match = candidates?.find(p => p.phone && normalizePhone(p.phone) === normalPhone);
  return match?.email ? { id: match.id, email: match.email, phone: match.phone! } : null;
}

// ── POST /api/patient/sms-code/request ────────────────────────────────────────
// Public — sends a one-time sign-in code by SMS. Always responds the same way
// regardless of whether the number matches a patient, so the endpoint can't be
// used to enumerate registered phone numbers.
router.post('/api/patient/sms-code/request', async (req, res) => {
  const { phone } = (req.body ?? {}) as { phone?: string };
  if (!phone?.trim()) {
    res.status(400).json({ error: 'phone is required' });
    return;
  }

  const normalPhone = normalizePhone(phone);
  if (normalPhone.length < 7) {
    res.status(400).json({ error: 'Please enter a valid phone number' });
    return;
  }

  const lastSent = smsCodeCooldown.get(normalPhone);
  if (lastSent && Date.now() - lastSent < SMS_CODE_COOLDOWN_MS) {
    res.status(429).json({ error: 'Please wait a minute before requesting another code' });
    return;
  }

  try {
    const patient = await findPortalPatientByPhone(normalPhone);

    if (patient) {
      const { data: link, error: linkErr } = await sb().auth.admin.generateLink({
        type: 'magiclink',
        email: patient.email,
      });
      const code = link?.properties?.email_otp;

      if (!linkErr && code) {
        await sendSms({
          to: patient.phone,
          body: `Your Amise Medical Services sign-in code is ${code}. It expires in 1 hour — don't share it with anyone.`,
        });
        smsCodeCooldown.set(normalPhone, Date.now());
      } else {
        req.log.warn({ err: linkErr }, '[portal/sms-code/request] generateLink failed');
      }
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, '[portal/sms-code/request] error');
    res.status(500).json({ error: 'Could not send a code. Please try again.' });
  }
});

// ── POST /api/patient/sms-code/verify ─────────────────────────────────────────
// Verifies the code against Supabase Auth server-side — using a throwaway
// client so the patient's session never touches the shared admin client — and
// hands back session tokens for the browser to install via setSession().
// The patient's email is never sent to the browser.
router.post('/api/patient/sms-code/verify', async (req, res) => {
  const { phone, code } = (req.body ?? {}) as { phone?: string; code?: string };
  if (!phone?.trim() || !code?.trim()) {
    res.status(400).json({ error: 'phone and code are required' });
    return;
  }

  const normalPhone = normalizePhone(phone);
  const genericError = 'Incorrect or expired code. Please check and try again, or request a new one.';

  try {
    const patient = await findPortalPatientByPhone(normalPhone);
    if (!patient) {
      res.status(400).json({ error: genericError });
      return;
    }

    const { data, error } = await getSupabaseAdmin().auth.verifyOtp({
      email: patient.email,
      token: code.trim(),
      type: 'email',
    });

    if (error || !data.session) {
      res.status(400).json({ error: genericError });
      return;
    }

    // generateLink()/verifyOtp() create the auth user on first sign-in — link
    // it back onto the patient record so RLS (auth_user_id = auth.uid()) can
    // ever match. Without this the patient is permanently locked out of their
    // own row ("Unable to load your profile") despite a valid session.
    const authUserId = data.session.user.id;
    await sb().from('patients').update({ auth_user_id: authUserId }).eq('id', patient.id);

    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  } catch (err) {
    req.log.error({ err }, '[portal/sms-code/verify] error');
    res.status(500).json({ error: 'Could not verify your code. Please try again.' });
  }
});

// ── POST /api/patient/intake-summary ─────────────────────────────────────────
// Generate AI pre-consult summary for a patient_intake row.
// Called by the patient portal after intake submission (fire-and-forget).
router.post('/api/patient/intake-summary', async (req, res) => {
  const { intake_id } = (req.body ?? {}) as { intake_id?: string };

  if (!intake_id) {
    res.status(400).json({ error: 'intake_id is required' });
    return;
  }

  // Respond immediately — generation runs async
  res.json({ status: 'generating' });

  void generateSummary(intake_id);
});

async function generateSummary(intakeId: string): Promise<void> {
  try {
    const { data: intake, error } = await sb()
      .from('patient_intake')
      .select('*')
      .eq('id', intakeId)
      .single();

    if (error || !intake) {
      console.error('[portal/intake-summary] intake not found', intakeId);
      return;
    }

    // Skip if already generated
    if (intake.ai_summary) return;

    const { data: patient } = await sb()
      .from('patients')
      .select('full_name, date_of_birth, sex, blood_group')
      .eq('id', intake.patient_id)
      .single();

    const age = patient?.date_of_birth
      ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000))
      : null;

    const complexityLabel =
      intake.complexity_score >= 7 ? 'HIGH (urgent/unclear)' :
      intake.complexity_score >= 4 ? 'MODERATE (complex)' : 'LOW (routine)';

    const prompt = `Analyse the following pre-visit intake form for a surgical/endoscopy practice in Saint Lucia and produce a structured pre-consultation briefing for the physician.

PATIENT: ${patient?.full_name ?? 'Unknown'}${age ? `, ${age}yo` : ''}${patient?.sex ? `, ${patient.sex}` : ''}
BLOOD GROUP: ${patient?.blood_group ?? 'Unknown'}
VISIT TYPE: ${intake.visit_type ?? 'not specified'}
COMPLAINT TRACK: ${intake.complaint_track ?? 'not specified'}
COMPLEXITY SCORE: ${intake.complexity_score ?? 0}/15 — ${complexityLabel}

CHIEF COMPLAINT: ${intake.chief_complaint ?? 'not provided'}
SYMPTOMS: ${Array.isArray(intake.symptoms) ? intake.symptoms.join(', ') : 'none listed'}
DURATION: ${intake.duration_days ? `${intake.duration_days} days` : 'not stated'}
SEVERITY: ${intake.severity != null ? `${intake.severity}/10` : 'not rated'}
PRIOR TREATMENT: ${intake.prior_treatment ?? 'none'}
CURRENT MEDICATIONS: ${intake.current_meds ?? 'none listed'}
ALLERGIES: ${intake.allergies_note ?? 'none known'}
REFERRAL: ${intake.referral_reason ?? 'self-referred'}
ADDITIONAL NOTES: ${intake.additional_notes ?? 'none'}

Return a JSON object with this exact schema (no markdown fences):
{
  "chiefComplaint": "brief one-line chief complaint",
  "keyPositives": ["string", ...],
  "redFlags": [{"symptom": "string", "severity": "routine|priority|urgent|emergency", "action": "string"}],
  "differentials": ["ranked differential 1", "ranked differential 2", ...],
  "suggestedWorkup": ["investigation or action"],
  "estimatedUrgency": "routine|priority|urgent|emergency",
  "summary": "narrative pre-visit briefing under 250 words — British-Caribbean professional medical language"
}

RULES: summarise and organise only. Do NOT diagnose, prescribe, or speculate beyond the data. Flag red flags explicitly.`;

    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = msg.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/, '');

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { summary: raw, estimatedUrgency: 'routine' };
    }

    await sb()
      .from('patient_intake')
      .update({
        ai_summary: JSON.stringify(parsed),
        ai_summary_at: new Date().toISOString(),
      })
      .eq('id', intakeId);

  } catch (err) {
    console.error('[portal/intake-summary] generation error', err);
  }
}

// ── POST /api/patient/documents/register ─────────────────────────────────────
// Called by the patient portal right after a file lands in Supabase Storage
// (the upload itself is client→storage; this just registers the metadata row
// and kicks off triage-only AI extraction). Mirrors the intake-summary
// fire-and-forget pattern above.
const DOCUMENT_TYPES = [
  'lab_report', 'imaging_report', 'referral_letter', 'consent_form',
  'surgical_report', 'discharge_summary', 'prescription', 'insurance_form',
  'clinical_photo', 'other',
];

router.post('/api/patient/documents/register', async (req, res) => {
  const auth = await getPatientAuth(req.headers.authorization);
  if (!auth) {
    res.status(401).json({ error: 'Sign in required' });
    return;
  }

  const { storage_path, file_name, mime_type, file_size_bytes, document_type } = (req.body ?? {}) as {
    storage_path?: string;
    file_name?: string;
    mime_type?: string;
    file_size_bytes?: number;
    document_type?: string;
  };

  if (!storage_path?.trim()) {
    res.status(400).json({ error: 'storage_path is required' });
    return;
  }

  // Storage paths are written as `${authUserId}/...` by the upload page —
  // refuse to register anything outside the caller's own folder.
  if (!storage_path.startsWith(`${auth.authUserId}/`)) {
    res.status(403).json({ error: 'storage_path does not belong to this account' });
    return;
  }

  const docType = document_type && DOCUMENT_TYPES.includes(document_type) ? document_type : 'other';

  try {
    const { data, error } = await sb()
      .from('documents')
      .insert({
        patient_id:          auth.patientId,
        document_type:       docType,
        title:               file_name?.trim() || 'Uploaded document',
        file_name:           file_name ?? null,
        storage_path,
        mime_type:           mime_type ?? null,
        file_size_bytes:     file_size_bytes ?? null,
        source:              'uploaded',
        created_by:          auth.authUserId,
        ai_extraction_status: 'pending',
      })
      .select('id')
      .single();

    if (error) throw error;

    res.json({ status: 'registered', document_id: data.id });

    void extractDocumentInsights(data.id);
  } catch (err) {
    req.log.error({ err }, '[portal/documents/register] error');
    res.status(500).json({ error: 'Could not register the document. Please try again.' });
  }
});

// ── POST /api/patient/documents/:id/extract ──────────────────────────────────
// Internal/staff trigger — (re)runs the triage-only extraction pass for a
// document. Used by the staff "attach historic record" flow (on-demand
// migration of a patient's old paper/PDF records when they're pending or
// coming in for an encounter) and to retry a failed pass. Fire-and-forget,
// guarded against double-processing inside extractDocumentInsights itself.
router.post('/api/patient/documents/:id/extract', async (req, res) => {
  const { id } = req.params;
  res.json({ status: 'queued' });
  void extractDocumentInsights(id);
});

const EXTRACTABLE_MIME = new Set([
  'application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
]);

// Pulls structured facts + flags out of an uploaded clinical document with
// Claude vision. Strictly "triage territory": it transcribes what the
// document itself states (values, units, stated reference ranges, dates) and
// notes anything the document marks as out-of-range/urgent — it never
// diagnoses, interprets, or speculates. Output is queued for staff review,
// never written into the clinical record automatically.
export async function extractDocumentInsights(documentId: string): Promise<void> {
  try {
    const { data: doc, error } = await sb()
      .from('documents')
      .select('id, patient_id, document_type, title, storage_path, mime_type, ai_extraction_status')
      .eq('id', documentId)
      .single();

    if (error || !doc) {
      console.error('[portal/documents] document not found', documentId);
      return;
    }

    // Avoid double-processing — relevant when /extract is used to (re)trigger
    // a document that's mid-flight or already done.
    if (doc.ai_extraction_status === 'processing' || doc.ai_extraction_status === 'done') return;

    if (!doc.storage_path || !doc.mime_type || !EXTRACTABLE_MIME.has(doc.mime_type)) {
      await sb().from('documents').update({
        ai_extraction_status: 'skipped',
        ai_extraction_at: new Date().toISOString(),
      }).eq('id', documentId);
      return;
    }

    await sb().from('documents').update({ ai_extraction_status: 'processing' }).eq('id', documentId);

    const { data: file, error: dlErr } = await sb().storage.from('patient-documents').download(doc.storage_path);
    if (dlErr || !file) throw dlErr ?? new Error('download returned no file');

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > 20 * 1024 * 1024) {
      await sb().from('documents').update({
        ai_extraction_status: 'skipped',
        ai_extraction_at: new Date().toISOString(),
      }).eq('id', documentId);
      return;
    }
    const base64 = buf.toString('base64');

    const { data: patient } = await sb()
      .from('patients')
      .select('full_name, date_of_birth, sex')
      .eq('id', doc.patient_id)
      .single();

    const contentBlock = doc.mime_type === 'application/pdf'
      ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
      : { type: 'image' as const, source: { type: 'base64' as const, media_type: doc.mime_type as 'image/jpeg' | 'image/png' | 'image/webp', data: base64 } };

    const instructions = `This is a clinical document ("${doc.title}", type: ${doc.document_type}) uploaded by a patient of a surgical/endoscopy practice in Saint Lucia${patient?.full_name ? ` (patient: ${patient.full_name})` : ''}.

Read the document and TRANSCRIBE — do not interpret or diagnose — what it states. Extract:
- Each named test/measurement/finding with its stated value, unit, and any reference range PRINTED ON THE DOCUMENT ITSELF.
- Whether the document itself marks/flags that item as out-of-range, abnormal, critical, or urgent (only report what the document marks — never decide this yourself).
- Key dates (collection/report/procedure date).

Return a JSON object with this exact schema (no markdown fences, no commentary):
{
  "documentSummary": "one factual sentence describing what this document is (e.g. 'Full blood count report dated 12 March 2026')",
  "reportDate": "date string as printed, or null",
  "extractedFacts": [{"label": "string", "value": "string", "unit": "string|null", "referenceRange": "string|null", "markedAbnormal": true|false}],
  "flags": [{"type": "out_of_range|urgent_marking|incomplete|illegible|other", "label": "short label", "severity": "info|attention|urgent", "detail": "one factual sentence quoting/describing what the document shows — no interpretation"}]
}

RULES: Transcribe only what is printed on the document. Do NOT diagnose, interpret results, suggest treatment, or speculate about clinical significance beyond what the document itself states. If the document is illegible or not a clinical report, say so via a "flags" entry of type "illegible" or "other" and keep "extractedFacts" empty.`;

    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [contentBlock, { type: 'text', text: instructions }],
      }],
    });

    const rawText = msg.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim();

    const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const raw = (fenceMatch ? fenceMatch[1] : rawText).trim();

    let parsed: { documentSummary?: string; reportDate?: string | null; extractedFacts?: unknown[]; flags?: unknown[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { documentSummary: raw.slice(0, 300), extractedFacts: [], flags: [{ type: 'illegible', label: 'Could not parse document', severity: 'attention', detail: 'AI extraction did not return structured data — please review manually.' }] };
    }

    const flags = Array.isArray(parsed.flags) ? parsed.flags : [];

    await sb()
      .from('documents')
      .update({
        ai_extracted_data:    JSON.stringify({ documentSummary: parsed.documentSummary ?? null, reportDate: parsed.reportDate ?? null, extractedFacts: parsed.extractedFacts ?? [] }),
        ai_flags:             flags.length ? JSON.stringify(flags) : null,
        ai_extraction_status: 'done',
        ai_extraction_at:     new Date().toISOString(),
      })
      .eq('id', documentId);

    await audit({
      action:     'triage',
      entityType: 'document',
      entityId:   documentId,
      payload:    { document_type: doc.document_type, flag_count: flags.length },
    });
  } catch (err) {
    console.error('[portal/documents] extraction error', err);
    await sb().from('documents').update({
      ai_extraction_status: 'failed',
      ai_extraction_at: new Date().toISOString(),
    }).eq('id', documentId).then(() => {}, () => {});
  }
}

// ── GET /api/patient/documents-review ─────────────────────────────────────────
// Staff — list uploaded documents alongside their AI extraction/flags, newest
// first. Optional ?needs_review=true narrows to flagged-and-unacknowledged
// documents — the set the dashboard alert badge counts.
router.get('/api/patient/documents-review', async (req, res) => {
  const needsReview = req.query.needs_review === 'true';
  const status      = req.query.status as string | undefined;
  const limit       = Math.min(parseInt((req.query.limit as string) ?? '100'), 200);

  try {
    let query = sb()
      .from('documents')
      .select('id, patient_id, document_type, title, file_name, mime_type, source, created_at, ai_extraction_status, ai_extracted_data, ai_flags, ai_extraction_at, staff_reviewed_by, staff_reviewed_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) query = query.eq('ai_extraction_status', status);
    if (needsReview) query = query.not('ai_flags', 'is', null).is('staff_reviewed_at', null);

    const { data: docs, error } = await query;
    if (error) throw error;

    const patientIds = [...new Set((docs ?? []).map(d => d.patient_id).filter(Boolean))];
    let patientsById: Record<string, { full_name: string }> = {};
    if (patientIds.length) {
      const { data: patients } = await sb().from('patients').select('id, full_name').in('id', patientIds);
      patientsById = Object.fromEntries((patients ?? []).map(p => [p.id, { full_name: p.full_name }]));
    }

    const requests = (docs ?? []).map(d => ({
      ...d,
      patient_name: patientsById[d.patient_id]?.full_name ?? null,
    }));

    res.json({ documents: requests });
  } catch (err) {
    req.log.error({ err }, '[portal/documents-review] list error');
    res.status(500).json({ error: String(err) });
  }
});

// ── PATCH /api/patient/documents-review/:id ───────────────────────────────────
// Staff — acknowledge (mark reviewed) a document's AI extraction/flags. This
// is the human-in-the-loop gate: nothing from ai_extracted_data/ai_flags is
// ever folded into the clinical record automatically.
router.patch('/api/patient/documents-review/:id', async (req, res) => {
  const { id } = req.params;
  const { staff_user_id } = (req.body ?? {}) as { staff_user_id?: string };

  try {
    const { error } = await sb()
      .from('documents')
      .update({
        staff_reviewed_at: new Date().toISOString(),
        staff_reviewed_by: staff_user_id ?? null,
      })
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, '[portal/documents-review/:id] error');
    res.status(500).json({ error: String(err) });
  }
});

// ── GET /api/patient/consultation-requests ────────────────────────────────────
// Staff — list all consultation requests (from the public "request a consult" form).
router.get('/api/patient/consultation-requests', async (req, res) => {
  const status  = req.query.status as string | undefined;
  const limit   = Math.min(parseInt((req.query.limit as string) ?? '100'), 200);

  try {
    let query = sb()
      .from('consultation_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ requests: data ?? [] });
  } catch (err) {
    req.log.error({ err }, '[portal/consultation-requests] list error');
    res.status(500).json({ error: String(err) });
  }
});

// ── PATCH /api/patient/consultation-requests/:id ──────────────────────────────
// Staff — update status and/or staff_notes on a consultation request.
router.patch('/api/patient/consultation-requests/:id', async (req, res) => {
  const { id } = req.params;
  const { status, staff_notes } = (req.body ?? {}) as { status?: string; staff_notes?: string };

  const VALID_STATUSES = ['new', 'contacted', 'registered'];
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (status !== undefined) updates.status = status;
  if (staff_notes !== undefined) updates.staff_notes = staff_notes;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: 'Nothing to update' });
    return;
  }

  try {
    const { data: request, error: fetchErr } = await sb()
      .from('consultation_requests')
      .select('full_name, phone, email, status')
      .eq('id', id)
      .single();
    if (fetchErr) throw fetchErr;

    const { error } = await sb().from('consultation_requests').update(updates).eq('id', id);
    if (error) throw error;

    let patientId: string | null = null;
    let invited = false;

    // Marking a request "registered" is the staff signal that this person is
    // now a real patient — fold the patient-record creation and portal invite
    // into that single click instead of two further manual steps. Phone-only
    // requests fall through untouched: the portal can only invite by email.
    if (status === 'registered' && request?.status !== 'registered' && request?.email) {
      const normalEmail = request.email.trim().toLowerCase();

      const { data: existing } = await sb()
        .from('patients')
        .select('id, portal_enabled')
        .eq('email', normalEmail)
        .maybeSingle();

      if (existing) {
        patientId = existing.id;
      } else {
        const { data: created, error: createErr } = await sb()
          .from('patients')
          .insert({ full_name: request.full_name, phone: request.phone, email: normalEmail })
          .select('id')
          .single();
        if (createErr) throw createErr;
        patientId = created?.id ?? null;
      }

      if (patientId && !existing?.portal_enabled) {
        await sendPortalInvite(patientId, normalEmail);
        invited = true;
      }
    }

    res.json({ success: true, patient_id: patientId, invited });
  } catch (err) {
    req.log.error({ err }, '[portal/consultation-requests/:id] error');
    res.status(500).json({ error: String(err) });
  }
});

// ── POST /api/patient/request-consult ────────────────────────────────────────
// Public endpoint — no auth required. Saves a consultation request from a
// new patient who does not yet have a portal account.
router.post('/api/patient/request-consult', async (req, res) => {
  const { full_name, phone, email, visit_type, description } = (req.body ?? {}) as {
    full_name?: string;
    phone?: string;
    email?: string;
    visit_type?: string;
    description?: string;
  };

  if (!full_name?.trim()) {
    res.status(400).json({ error: 'full_name is required' });
    return;
  }

  if (!phone?.trim() && !email?.trim()) {
    res.status(400).json({ error: 'At least one of phone or email is required' });
    return;
  }

  try {
    const { error } = await sb()
      .from('consultation_requests')
      .insert({
        full_name: full_name.trim(),
        phone: phone?.trim() || null,
        email: email?.trim().toLowerCase() || null,
        visit_type: visit_type || null,
        description: description?.trim() || null,
      });

    if (error) throw error;

    res.status(201).json({ success: true });
  } catch (err) {
    req.log.error({ err }, '[portal/request-consult] error');
    res.status(500).json({ error: 'Could not save your request. Please try again.' });
  }
});

export default router;
