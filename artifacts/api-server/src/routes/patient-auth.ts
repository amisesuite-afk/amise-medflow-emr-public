/**
 * Patient authentication routes.
 *
 * POST /api/patient/auth/request   — issue a temp password and email it
 * POST /api/patient/auth/login     — email + password → JWT session token
 * POST /api/patient/auth/change-password — replace password, clears temp
 * POST /api/patient/auth/logout    — client-side only; endpoint exists for
 *                                   future token blacklisting
 *
 * The JWT is returned as { sessionToken } and must be sent by the patient
 * app as Authorization: Bearer <token> on all subsequent patient API calls.
 */
import { Router } from 'express';
import { sb } from '../lib/supabase.js';
import { logger as log } from '../lib/logger.js';
import {
  generateTempPassword,
  hashPassword,
  verifyPassword,
  signPatientJwt,
  verifyPatientJwt,
} from '../lib/patient-auth.js';
import { sendOrDraft } from '../lib/gmail.js';

const router = Router();

const PATIENT_APP_URL = process.env.PATIENT_APP_URL ?? process.env.PORTAL_URL ?? 'https://patient.amise.lc';
const TEMP_PW_TTL_HOURS = 72;

// ── Helper: look up or create a patient_account row ──────────────────────────

async function upsertAccount(email: string, patientId?: string) {
  const { data: existing } = await sb()
    .from('patient_accounts')
    .select('id, patient_id')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (existing) return existing as { id: string; patient_id: string | null };

  const { data: created, error } = await sb()
    .from('patient_accounts')
    .insert({ email: email.toLowerCase(), patient_id: patientId ?? null })
    .select('id, patient_id')
    .single();

  if (error || !created) throw new Error(error?.message ?? 'Failed to create patient account');
  return created as { id: string; patient_id: string | null };
}

// ── POST /api/patient/auth/request ───────────────────────────────────────────

router.post('/api/patient/auth/request', async (req, res) => {
  const { email, patientId } = req.body as { email?: string; patientId?: string };

  if (!email?.trim()) {
    res.status(400).json({ error: 'email is required' });
    return;
  }

  const normalEmail = email.trim().toLowerCase();

  try {
    const account = await upsertAccount(normalEmail, patientId);

    const tempPw = generateTempPassword();
    const tempHash = await hashPassword(tempPw);
    const expiresAt = new Date(Date.now() + TEMP_PW_TTL_HOURS * 3600 * 1000).toISOString();

    await sb()
      .from('patient_accounts')
      .update({
        temp_password_hash: tempHash,
        temp_password_expires_at: expiresAt,
        ...(patientId && !account.patient_id ? { patient_id: patientId } : {}),
      })
      .eq('id', account.id);

    // Build a one-click login link containing the temp password pre-filled
    const loginLink = `${PATIENT_APP_URL}/login?email=${encodeURIComponent(normalEmail)}&pw=${encodeURIComponent(tempPw)}`;

    const emailBody = `Hello,

Your access to the AMISE Patient App has been set up.

Your temporary password is:

    ${tempPw}

You can log in directly using this link (valid for ${TEMP_PW_TTL_HOURS} hours):
${loginLink}

Or open the app and enter:
  Email:    ${normalEmail}
  Password: ${tempPw}

You will be prompted to set your own password after your first login.

If you did not request this access, please contact the clinic directly.

Amise Medical Services
+1 (758) 284-0557`;

    try {
      await sendOrDraft(
        {
          to: normalEmail,
          subject: 'AMISE Patient App — Your Access Details',
          body: emailBody,
        },
        'auto',
      );
    } catch (emailErr) {
      log.warn({ err: emailErr }, 'patient auth email failed (non-fatal)');
    }

    log.info({ accountId: account.id, email: normalEmail }, 'patient temp password issued');
    res.json({ success: true, sent: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to issue access';
    log.error({ err }, 'patient auth request error');
    res.status(500).json({ error: message });
  }
});

// ── POST /api/patient/auth/login ─────────────────────────────────────────────

router.post('/api/patient/auth/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email?.trim() || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  const normalEmail = email.trim().toLowerCase();

  try {
    const { data: account } = await sb()
      .from('patient_accounts')
      .select('id, patient_id, password_hash, temp_password_hash, temp_password_expires_at')
      .eq('email', normalEmail)
      .maybeSingle();

    if (!account) {
      // Constant-time-ish response to avoid email enumeration
      await new Promise(r => setTimeout(r, 200 + Math.random() * 200));
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Check permanent password first, then temp
    let authenticated = false;
    let usingTempPassword = false;

    if (account.password_hash) {
      authenticated = await verifyPassword(password, account.password_hash as string);
    }

    if (!authenticated && account.temp_password_hash) {
      const notExpired =
        account.temp_password_expires_at &&
        new Date(account.temp_password_expires_at as string) > new Date();
      if (notExpired) {
        authenticated = await verifyPassword(password, account.temp_password_hash as string);
        if (authenticated) usingTempPassword = true;
      }
    }

    if (!authenticated) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Fetch patient details for the JWT
    let patientName: string | null = null;
    let hasPassport = false;
    const patientId = account.patient_id as string | null;

    if (patientId) {
      const { data: patient } = await sb()
        .from('patients')
        .select('full_name')
        .eq('id', patientId)
        .maybeSingle();
      if (patient) patientName = patient.full_name as string;

      // Check if passport already exists (return patient detection)
      const { data: pv } = await sb()
        .from('previsit_submissions')
        .select('id, passport')
        .eq('patient_id', patientId)
        .not('passport', 'is', null)
        .limit(1)
        .maybeSingle();
      hasPassport = !!pv?.passport;
    }

    // Update last_login_at
    await sb()
      .from('patient_accounts')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', account.id as string);

    const sessionToken = signPatientJwt({
      sub: account.id as string,
      patientId: patientId ?? '',
      email: normalEmail,
    });

    log.info({ accountId: account.id, usingTempPassword }, 'patient login success');
    res.json({
      success: true,
      sessionToken,
      email: normalEmail,
      patientName,
      patientId,
      isReturnPatient: hasPassport,
      mustChangePassword: usingTempPassword,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed';
    log.error({ err }, 'patient login error');
    res.status(500).json({ error: message });
  }
});

// ── POST /api/patient/auth/change-password ───────────────────────────────────

router.post('/api/patient/auth/change-password', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) { res.status(401).json({ error: 'Missing session token' }); return; }

  const payload = verifyPatientJwt(token);
  if (!payload) { res.status(401).json({ error: 'Invalid or expired session' }); return; }

  const { newPassword } = req.body as { newPassword?: string };
  if (!newPassword || newPassword.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }

  try {
    const hash = await hashPassword(newPassword);
    await sb()
      .from('patient_accounts')
      .update({
        password_hash: hash,
        temp_password_hash: null,
        temp_password_expires_at: null,
      })
      .eq('id', payload.sub);

    log.info({ accountId: payload.sub }, 'patient password changed');
    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Password change failed';
    log.error({ err }, 'patient change-password error');
    res.status(500).json({ error: message });
  }
});

// ── POST /api/patient/auth/logout ────────────────────────────────────────────

router.post('/api/patient/auth/logout', (_req, res) => {
  // JWTs are stateless — the client deletes the token locally.
  // This endpoint exists for forward-compatibility (token blacklist, audit log).
  res.json({ success: true });
});

// ── Middleware export: requirePatientAuth ─────────────────────────────────────

import type { Request, Response, NextFunction } from 'express';

export interface PatientAuthRequest extends Request {
  patientAuth?: {
    accountId: string;
    patientId: string;
    email: string;
  };
}

export async function requirePatientAuth(
  req: PatientAuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Accept Bearer token (new auth) OR legacy patient_token query/body param
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (bearerToken) {
    const payload = verifyPatientJwt(bearerToken);
    if (!payload) {
      res.status(401).json({ error: 'Invalid or expired session — please log in again' });
      return;
    }
    req.patientAuth = {
      accountId: payload.sub,
      patientId: payload.patientId,
      email: payload.email,
    };
    next();
    return;
  }

  // Legacy: fall back to patient_token (URL param or body) for backward compat
  const legacyToken = (req.query.token as string | undefined) ?? (req.body as Record<string, unknown>)?.patient_token as string | undefined;
  if (legacyToken) {
    const { data } = await sb()
      .from('previsit_submissions')
      .select('id, patient_id')
      .eq('patient_token', legacyToken)
      .maybeSingle();
    if (!data) {
      res.status(401).json({ error: 'Invalid patient token' });
      return;
    }
    req.patientAuth = {
      accountId: '',
      patientId: data.patient_id as string,
      email: '',
    };
    next();
    return;
  }

  res.status(401).json({ error: 'Authentication required' });
}

export default router;
