import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { sb, requireStaffAuth } from '../lib/supabase.js';
import { logger as log } from '../lib/logger.js';

const router = Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

const PREVISIT_SYSTEM_PROMPT = `You are formatting a patient's pre-visit questionnaire for Dr Dawit Daniel Kabiye (specialist general and endoscopic surgeon, Saint Lucia). Transform raw patient-submitted answers into structured clinical documentation. Use British medical English. Be concise and professional.

Return ONLY a JSON object (no markdown fences) with these exact fields:
{
  "cc": "Chief complaint as a brief clinical statement",
  "hpi": "A paragraph of history of presenting illness in clinical style, covering onset, duration, character, severity, location, radiation, associated symptoms, alleviating and aggravating factors",
  "pmh": ["formatted past medical history item"],
  "medications": ["Drug name dose frequency (indication if given)"],
  "surgical_history": ["Procedure — approximate date/year if given"],
  "allergies": "Allergy summary or 'NKDA'",
  "ros_positive": ["System: finding"],
  "ros_negative": ["System: specifically denied"],
  "red_flags": ["Concerning symptom requiring prompt attention"],
  "suggestions": ["Clinical consideration for the surgeon"],
  "urgency": "routine | soon | urgent | emergency"
}`;

router.get('/api/previsit/:patientId', async (req, res) => {
  const ok = await requireStaffAuth(req, res);
  if (!ok) return;

  const { patientId } = req.params;
  if (!patientId) {
    res.status(400).json({ error: 'patientId is required' });
    return;
  }

  try {
    const { data, error } = await sb()
      .from('previsit_submissions')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      log.error({ err: error }, 'previsit fetch error');
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ submission: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch pre-visit submission';
    log.error({ err }, 'previsit fetch error');
    res.status(500).json({ error: message });
  }
});

// POST /api/previsit/create — staff creates a pre-visit submission row and returns the patient token.
// Optionally sends an SMS to the patient with the link to the patient app.
router.post('/api/previsit/create', async (req, res) => {
  const ok = await requireStaffAuth(req, res);
  if (!ok) return;

  const { patientId, appointmentId, sendSms, patientPhone } = req.body as {
    patientId: string;
    appointmentId?: string;
    sendSms?: boolean;
    patientPhone?: string;
  };

  if (!patientId) {
    res.status(400).json({ error: 'patientId is required' });
    return;
  }

  try {
    // Check for existing active submission
    const { data: existing } = await sb()
      .from('previsit_submissions')
      .select('id, patient_token, status')
      .eq('patient_id', patientId)
      .in('status', ['pending', 'submitted'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let token: string;
    let submissionId: string;

    if (existing) {
      token = existing.patient_token as string;
      submissionId = existing.id as string;
    } else {
      const { data: created, error: createErr } = await sb()
        .from('previsit_submissions')
        .insert({
          patient_id: patientId,
          ...(appointmentId ? { appointment_id: appointmentId } : {}),
          status: 'pending',
        })
        .select('id, patient_token')
        .single();

      if (createErr || !created) {
        log.error({ err: createErr }, 'previsit create error');
        res.status(500).json({ error: createErr?.message ?? 'Failed to create submission' });
        return;
      }
      token = created.patient_token as string;
      submissionId = created.id as string;
    }

    const portalUrl = process.env.PORTAL_URL ?? 'https://front-desk-amisesuite-afks-projects.vercel.app';
    const link = `${portalUrl}/previsit/${token}`;

    // Send SMS if requested
    let smsSent = false;
    if (sendSms && patientPhone && process.env.SMS_PROVIDER === 'twilio') {
      try {
        const twilio = await import('twilio').then(m => m.default);
        const tw = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
        await tw.messages.create({
          from: process.env.TWILIO_FROM_NUMBER!,
          to: patientPhone,
          body: `AMISE Medical Services: Please complete your pre-visit questionnaire before your appointment. Your secure link: ${link}`,
        });
        smsSent = true;
      } catch (smsErr) {
        log.warn({ err: smsErr }, 'previsit SMS send failed (non-fatal)');
      }
    }

    log.info({ submissionId, smsSent }, 'previsit submission created');
    res.json({ success: true, token, link, submissionId, smsSent });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create pre-visit';
    log.error({ err }, 'previsit create error');
    res.status(500).json({ error: message });
  }
});

// GET /api/previsit/prefill/:token — public, token-authenticated (no staff/patient
// login). Lets the pre-visit form pre-populate known allergies/medications/PMH so
// the patient reviews and updates rather than starting from a blank form.
router.get('/api/previsit/prefill/:token', async (req, res) => {
  const { token } = req.params;
  if (!token) {
    res.status(400).json({ error: 'token is required' });
    return;
  }

  try {
    const { data: submission, error: findErr } = await sb()
      .from('previsit_submissions')
      .select('patient_id')
      .eq('patient_token', token)
      .maybeSingle();

    if (findErr) {
      log.error({ err: findErr }, 'previsit prefill token lookup error');
      res.status(500).json({ error: findErr.message });
      return;
    }

    if (!submission) {
      res.status(404).json({ error: 'Invalid or expired link' });
      return;
    }

    const patientId = submission.patient_id as string | null;
    if (!patientId) {
      res.json({ allergies: '', medications: [], pmh: [] });
      return;
    }

    const [pmhRes, allergyRes, medRes] = await Promise.all([
      sb().from('pmh_items').select('condition').eq('patient_id', patientId).eq('status', 'active'),
      sb().from('allergies').select('allergen, reaction, severity').eq('patient_id', patientId).eq('status', 'active'),
      sb().from('medications').select('drug_name, dose, frequency').eq('patient_id', patientId).eq('status', 'active'),
    ]);

    const allergyLines = (allergyRes.data ?? []).map((a: Record<string, unknown>) => {
      const parts = [a.allergen as string];
      if (a.reaction) parts.push(`— ${a.reaction as string}`);
      if (a.severity) parts.push(`(${a.severity as string})`);
      return parts.join(' ');
    }).join('\n');

    res.json({
      allergies: allergyLines,
      medications: (medRes.data ?? []).map((m: Record<string, unknown>) => ({
        name: (m.drug_name as string) ?? '',
        dose: (m.dose as string) ?? '',
        frequency: (m.frequency as string) ?? '',
      })),
      pmh: (pmhRes.data ?? []).map((p: Record<string, unknown>) => p.condition as string),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch pre-fill data';
    log.error({ err }, 'previsit prefill error');
    res.status(500).json({ error: message });
  }
});

router.post('/api/previsit/submit', async (req, res) => {
  const {
    patient_token,
    cc,
    hpi_raw,
    pmh,
    medications,
    surgical_history,
    allergies,
    ros,
    photos,
  } = req.body as {
    patient_token: string;
    cc?: string;
    hpi_raw?: Record<string, unknown>;
    pmh?: string[];
    medications?: Array<{ name: string; dose?: string; frequency?: string; indication?: string }>;
    surgical_history?: string[];
    allergies?: string;
    ros?: Record<string, string>;
    photos?: Array<{ url: string; context: string; uploaded_at: string }>;
  };

  if (!patient_token) {
    res.status(400).json({ error: 'patient_token is required' });
    return;
  }

  try {
    const { data: existing, error: findErr } = await sb()
      .from('previsit_submissions')
      .select('id')
      .eq('patient_token', patient_token)
      .maybeSingle();

    if (findErr) {
      log.error({ err: findErr }, 'previsit token lookup error');
      res.status(500).json({ error: findErr.message });
      return;
    }

    if (!existing) {
      res.status(404).json({ error: 'Invalid or expired patient token' });
      return;
    }

    const updates: Record<string, unknown> = {
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      cc_complete: Boolean(cc?.trim()),
      hpi_complete: Boolean(hpi_raw && Object.keys(hpi_raw).length > 0),
      pmh_complete: Boolean(pmh && pmh.length > 0),
      meds_complete: Boolean(medications && medications.length > 0),
      surgical_complete: Boolean(surgical_history && surgical_history.length > 0),
      allergies_complete: Boolean(allergies?.trim()),
      ros_complete: Boolean(ros && Object.keys(ros).length > 0),
      photos_complete: Boolean(photos && photos.length > 0),
    };

    if (cc !== undefined) updates.cc = cc;
    if (hpi_raw !== undefined) updates.hpi_raw = hpi_raw;
    if (pmh !== undefined) updates.pmh = pmh;
    if (medications !== undefined) updates.medications = medications;
    if (surgical_history !== undefined) updates.surgical_history = surgical_history;
    if (allergies !== undefined) updates.allergies = allergies;
    if (ros !== undefined) updates.ros = ros;
    if (photos !== undefined) updates.photos = photos;

    const { error: updateErr } = await sb()
      .from('previsit_submissions')
      .update(updates)
      .eq('id', existing.id);

    if (updateErr) {
      log.error({ err: updateErr }, 'previsit submit update error');
      res.status(500).json({ error: updateErr.message });
      return;
    }

    log.info({ submissionId: existing.id }, 'previsit submission received');
    res.json({ success: true, submissionId: existing.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to submit pre-visit form';
    log.error({ err }, 'previsit submit error');
    res.status(500).json({ error: message });
  }
});

router.post('/api/previsit/ai-format', async (req, res) => {
  const ok = await requireStaffAuth(req, res);
  if (!ok) return;

  const { patientId, submissionId } = req.body as { patientId: string; submissionId?: string };

  if (!patientId) {
    res.status(400).json({ error: 'patientId is required' });
    return;
  }

  try {
    let query = sb()
      .from('previsit_submissions')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (submissionId) {
      query = sb()
        .from('previsit_submissions')
        .select('*')
        .eq('id', submissionId)
        .limit(1);
    }

    const { data, error: fetchErr } = await query.maybeSingle();

    if (fetchErr) {
      log.error({ err: fetchErr }, 'previsit ai-format fetch error');
      res.status(500).json({ error: fetchErr.message });
      return;
    }

    if (!data) {
      res.status(404).json({ error: 'No pre-visit submission found' });
      return;
    }

    const parts: string[] = [];

    if (data.cc) parts.push(`CHIEF COMPLAINT: ${data.cc}`);

    if (data.hpi_raw && typeof data.hpi_raw === 'object') {
      const h = data.hpi_raw as Record<string, unknown>;
      const hpiLines: string[] = [];
      if (h.onset) hpiLines.push(`Onset: ${h.onset}`);
      if (h.duration) hpiLines.push(`Duration: ${h.duration}`);
      if (h.severity_0_10 !== undefined) hpiLines.push(`Severity: ${h.severity_0_10}/10`);
      if (h.character) hpiLines.push(`Character: ${h.character}`);
      if (h.location) hpiLines.push(`Location: ${h.location}`);
      if (h.radiation) hpiLines.push(`Radiation: ${h.radiation}`);
      if (Array.isArray(h.associated_symptoms) && h.associated_symptoms.length > 0) {
        hpiLines.push(`Associated symptoms: ${(h.associated_symptoms as string[]).join(', ')}`);
      }
      if (h.alleviating) hpiLines.push(`Alleviating factors: ${h.alleviating}`);
      if (h.aggravating) hpiLines.push(`Aggravating factors: ${h.aggravating}`);
      if (hpiLines.length > 0) parts.push(`HPI DETAILS:\n${hpiLines.join('\n')}`);
    }

    if (Array.isArray(data.pmh) && data.pmh.length > 0) {
      parts.push(`PAST MEDICAL HISTORY:\n${(data.pmh as string[]).map(x => `- ${x}`).join('\n')}`);
    }

    if (Array.isArray(data.medications) && data.medications.length > 0) {
      const medLines = (data.medications as Array<Record<string, string>>)
        .map(m => `- ${m.name || ''} ${m.dose || ''} ${m.frequency || ''}${m.indication ? ` (for ${m.indication})` : ''}`.trim())
        .join('\n');
      parts.push(`CURRENT MEDICATIONS:\n${medLines}`);
    }

    if (Array.isArray(data.surgical_history) && data.surgical_history.length > 0) {
      parts.push(`SURGICAL HISTORY:\n${(data.surgical_history as string[]).map(x => `- ${x}`).join('\n')}`);
    }

    if (data.allergies) parts.push(`ALLERGIES: ${data.allergies}`);

    if (data.ros && typeof data.ros === 'object') {
      const ros = data.ros as Record<string, string>;
      const positive = Object.entries(ros)
        .filter(([, v]) => v === 'positive')
        .map(([k]) => k);
      const negative = Object.entries(ros)
        .filter(([, v]) => v === 'negative')
        .map(([k]) => k);
      if (positive.length > 0) parts.push(`ROS POSITIVE: ${positive.join(', ')}`);
      if (negative.length > 0) parts.push(`ROS NEGATIVE: ${negative.join(', ')}`);
    }

    const userPrompt = `Please format the following patient-submitted pre-visit questionnaire data into structured clinical documentation:\n\n${parts.join('\n\n')}\n\nReturn ONLY the JSON object as specified.`;

    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: PREVISIT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = resp.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '');

    let aiFormatted: Record<string, unknown>;
    try {
      aiFormatted = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      log.warn({ raw: raw.slice(0, 200) }, 'previsit AI response was not valid JSON');
      res.status(502).json({ error: 'AI returned non-JSON response — please retry' });
      return;
    }

    const { error: saveErr } = await sb()
      .from('previsit_submissions')
      .update({
        ai_formatted: aiFormatted,
        ai_processed_at: new Date().toISOString(),
        status: 'ai_processed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.id);

    if (saveErr) {
      log.warn({ err: saveErr }, 'previsit ai-format save error (non-fatal)');
    }

    log.info({ submissionId: data.id }, 'previsit AI formatting complete');
    res.json({ success: true, formatted: aiFormatted, submissionId: data.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI formatting failed';
    log.error({ err }, 'previsit ai-format error');
    res.status(500).json({ error: message });
  }
});

export default router;
