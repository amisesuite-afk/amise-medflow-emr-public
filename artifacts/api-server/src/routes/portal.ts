import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { sb, getSupabaseAdmin, audit } from '../lib/supabase.js';
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
    // User may already exist — look them up
    if (inviteErr.message?.toLowerCase().includes('already been registered')) {
      const usersResp = await sb().auth.admin.listUsers();
      const existing = usersResp.data?.users?.find((u: { email?: string; id: string }) => u.email === normalEmail);
      authUserId = existing?.id ?? null;
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
