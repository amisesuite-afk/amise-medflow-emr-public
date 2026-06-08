import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { sb, audit, requireStaffAuth } from '../lib/supabase.js';
import {
  createSession,
  getNextQuestion,
  processAnswer,
  checkRedFlag,
  buildResponseSummary,
  QUESTION_BANK,
  SPECIALTY_QUEUES,
} from '@workspace/triage-engine/apcq.js';
import type {
  SessionState,
  Response as ApcqResponse,
  RedFlag,
  Question,
} from '@workspace/triage-engine/apcq.js';

const router = Router();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-5';

const CONSENT_TEXT_V1 =
  'Amise Medical Services collects the information provided in this questionnaire ' +
  'for the purpose of your pre-consultation assessment. Your responses are stored ' +
  'securely and will be reviewed by clinical staff in preparation for your appointment. ' +
  'By proceeding you consent to this collection and use of your health information. ' +
  'Version 1.0 — Amise Medical Services, Saint Lucia.';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Generate a 32-character hex session token. */
function generateSessionToken(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Reconstruct an in-memory SessionState by replaying all persisted responses
 * for a session against the APCQ engine.
 */
function reconstructState(
  sessionId: string,
  templateKey: string,
  mode: 'screening' | 'condition_specific',
  dbResponses: Array<{
    question_key: string;
    answer_value: string | null;
    sequence_number: number;
  }>,
): SessionState {
  // Sort by sequence so branching fires in the correct order
  const sorted = [...dbResponses].sort((a, b) => a.sequence_number - b.sequence_number);

  let state = createSession({ sessionId, templateKey, mode });

  for (const row of sorted) {
    if (!row.answer_value) continue;

    // answer_value may be a JSON-encoded array for multi_choice questions
    let value: string | string[];
    try {
      const parsed = JSON.parse(row.answer_value);
      value = Array.isArray(parsed) ? parsed : row.answer_value;
    } catch {
      value = row.answer_value;
    }

    state = processAnswer(state, { questionKey: row.question_key, value });
  }

  return state;
}

/**
 * Encode an answer value for storage: arrays → JSON string, scalars → plain string.
 */
function encodeAnswerValue(value: string | string[]): string {
  return Array.isArray(value) ? JSON.stringify(value) : value;
}

/**
 * Format a human-readable answer display from a question and value.
 */
function formatAnswerDisplay(question: Question, value: string | string[]): string {
  const values = Array.isArray(value) ? value : [value];
  if (!question.options) return values.join(', ');
  const labels = values.map(v => {
    const opt = question.options!.find(o => o.value === v);
    return opt ? opt.label : v;
  });
  return labels.join(', ');
}

// ─────────────────────────────────────────────────────────────────────────────
// BACKGROUND TASKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all responses for a session and reconstruct state for the AI prompt.
 * Insert the generated summary into intake_summaries.
 */
async function generateIntakeSummary(sessionId: string): Promise<void> {
  try {
    // Fetch session metadata
    const { data: session, error: sessErr } = await sb()
      .from('questionnaire_sessions')
      .select('id, patient_id, template_id, mode')
      .eq('id', sessionId)
      .single();

    if (sessErr || !session) {
      throw new Error(`Session ${sessionId} not found for summary generation`);
    }

    // Fetch template key
    const { data: template } = await sb()
      .from('questionnaire_templates')
      .select('name')
      .eq('id', session.template_id)
      .single();

    const templateKey: string = template?.name ?? 'general_screening';

    // Fetch all responses
    const { data: dbResponses, error: respErr } = await sb()
      .from('questionnaire_responses')
      .select('question_key, answer_value, answer_display, is_red_flag, sequence_number')
      .eq('session_id', sessionId)
      .order('sequence_number', { ascending: true });

    if (respErr) throw respErr;

    const responses = dbResponses ?? [];

    // Reconstruct state for buildResponseSummary
    const state = reconstructState(
      sessionId,
      templateKey,
      (session.mode as 'screening' | 'condition_specific') ?? 'screening',
      responses,
    );

    const responseSummaryText = buildResponseSummary(state);

    // Build raw_responses snapshot
    const rawResponses = responses.map(r => ({
      question_key: r.question_key,
      answer_value: r.answer_value,
      answer_display: r.answer_display,
      is_red_flag: r.is_red_flag,
    }));

    const systemPrompt = `You are a clinical documentation assistant for Amise Medical Services, a surgical and endoscopic practice in Saint Lucia led by Dr Dawit Daniel Kabiye MD DM.

Your task: analyse the patient's pre-consultation questionnaire responses and produce a structured pre-visit briefing for the physician.

CRITICAL RULES:
- You MAY: summarise, organise, highlight, flag concerns
- You MAY NOT: diagnose, suggest specific treatments, prescribe, or speculate beyond the data
- Flag red flags explicitly
- Use British-Caribbean professional medical language
- Keep the summary under 300 words
- Format as JSON only, no markdown fences`;

    const userPrompt = `Analyse the following pre-consultation questionnaire and return a JSON object with this exact schema:
{
  "chiefComplaint": "string — brief chief complaint extracted from responses",
  "keyPositives": ["string", "..."],
  "redFlags": [{"symptom": "string", "severity": "routine|priority|urgent|emergency", "action": "string"}],
  "recommendedFocusAreas": ["string", "..."],
  "estimatedUrgency": "routine|priority|urgent|emergency",
  "summary": "string — narrative pre-visit briefing under 300 words"
}

QUESTIONNAIRE RESPONSES:
${responseSummaryText}`;

    const msg = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = msg.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/, '');

    let parsed: {
      chiefComplaint?: string;
      keyPositives?: string[];
      redFlags?: Array<{ symptom: string; severity: string; action: string }>;
      recommendedFocusAreas?: string[];
      estimatedUrgency?: string;
      summary?: string;
    };

    try {
      parsed = JSON.parse(raw);
    } catch {
      // Fallback: store raw text as summary
      parsed = { summary: raw, estimatedUrgency: 'routine' };
    }

    const validUrgencies = ['routine', 'priority', 'urgent', 'emergency'] as const;
    const estimatedUrgency = validUrgencies.includes(
      parsed.estimatedUrgency as (typeof validUrgencies)[number],
    )
      ? (parsed.estimatedUrgency as (typeof validUrgencies)[number])
      : 'routine';

    await sb()
      .from('intake_summaries')
      .upsert(
        {
          session_id: sessionId,
          patient_id: session.patient_id ?? null,
          ai_summary: parsed.summary ?? null,
          chief_complaint: parsed.chiefComplaint ?? null,
          key_positives: parsed.keyPositives ?? [],
          red_flags: parsed.redFlags ?? [],
          recommended_focus_areas: parsed.recommendedFocusAreas ?? [],
          estimated_urgency: estimatedUrgency,
          raw_responses: rawResponses,
          generated_at: new Date().toISOString(),
          model_used: CLAUDE_MODEL,
          reviewed_by_doctor: false,
        },
        { onConflict: 'session_id' },
      );
  } catch (err) {
    // Non-fatal — log but do not crash the request
    console.error('[questionnaire] generateIntakeSummary error', err);
  }
}

/**
 * Create or update an encounter record from the intake summary and return the
 * encounter UUID.
 */
async function populateEMR(sessionId: string, existingEncounterId?: string): Promise<string> {
  const { data: summary, error: sumErr } = await sb()
    .from('intake_summaries')
    .select('*')
    .eq('session_id', sessionId)
    .single();

  if (sumErr || !summary) {
    throw new Error(`No intake summary found for session ${sessionId}`);
  }

  // Fetch patient_id from the session
  const { data: session } = await sb()
    .from('questionnaire_sessions')
    .select('patient_id')
    .eq('id', sessionId)
    .single();

  const patientId: string | null = session?.patient_id ?? null;

  let encounterId = existingEncounterId ?? null;

  if (!encounterId && patientId) {
    // Create a new encounter
    const { data: enc, error: encErr } = await sb()
      .from('encounters')
      .insert({
        patient_id: patientId,
        encounter_type: 'outpatient',
        chief_complaint: summary.chief_complaint ?? 'Pre-consultation intake',
        status: 'open',
      })
      .select('id')
      .single();

    if (encErr) throw encErr;
    encounterId = enc.id;

    // Link encounter back to session
    await sb()
      .from('questionnaire_sessions')
      .update({ encounter_id: encounterId })
      .eq('id', sessionId);
  } else if (encounterId) {
    // Update existing encounter's chief complaint if we have one
    if (summary.chief_complaint) {
      await sb()
        .from('encounters')
        .update({ chief_complaint: summary.chief_complaint })
        .eq('id', encounterId);
    }
  }

  if (!encounterId) {
    throw new Error('Cannot populate EMR: no patient_id and no existing encounter');
  }

  return encounterId;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/questionnaire/session/start
router.post('/api/questionnaire/session/start', async (req, res) => {
  const {
    templateKey,
    mode,
    patientId,
    encounterId,
    deliveryMethod,
  } = (req.body ?? {}) as {
    templateKey?: string;
    mode?: string;
    patientId?: string;
    encounterId?: string;
    deliveryMethod?: string;
  };

  if (!templateKey) {
    res.status(400).json({ error: 'templateKey is required' });
    return;
  }

  const sessionMode = (mode === 'condition_specific' ? 'condition_specific' : 'screening') as
    | 'screening'
    | 'condition_specific';

  const validDeliveryMethods = ['kiosk', 'whatsapp_link', 'qr_code', 'staff_assisted'] as const;
  const delivery = validDeliveryMethods.includes(
    (deliveryMethod ?? '') as (typeof validDeliveryMethods)[number],
  )
    ? (deliveryMethod as (typeof validDeliveryMethods)[number])
    : 'kiosk';

  try {
    // Resolve template_id from template name
    const { data: template, error: tmplErr } = await sb()
      .from('questionnaire_templates')
      .select('id, name')
      .eq('name', templateKey)
      .eq('is_active', true)
      .single();

    if (tmplErr || !template) {
      res.status(404).json({ error: `Template '${templateKey}' not found or inactive` });
      return;
    }

    const sessionToken = generateSessionToken();

    // Insert session
    const { data: sessionRow, error: sessErr } = await sb()
      .from('questionnaire_sessions')
      .insert({
        template_id: template.id,
        mode: sessionMode,
        status: 'in_progress',
        delivery_method: delivery,
        patient_id: patientId ?? null,
        encounter_id: encounterId ?? null,
        session_token: sessionToken,
        consent_given: false,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (sessErr || !sessionRow) {
      req.log.info({ err: sessErr }, '[questionnaire/start] insert session failed');
      res.status(502).json({ error: 'Failed to create session' });
      return;
    }

    const sessionId: string = sessionRow.id;

    // Insert consent record
    await sb().from('consent_records').insert({
      session_id: sessionId,
      consent_type: 'data_collection',
      consent_text: CONSENT_TEXT_V1,
      consent_version: '1.0',
      consented: true,
      ip_address: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? null,
      user_agent: req.headers['user-agent'] ?? null,
    });

    // Initialise engine state to get first question
    const state = createSession({ sessionId, templateKey, mode: sessionMode });
    const firstQuestion = getNextQuestion(state);
    const totalEstimated = state.queuedKeys.length;

    await audit({
      action: 'classify',
      entityType: 'questionnaire_session',
      entityId: sessionId,
      payload: { templateKey, mode: sessionMode, delivery },
    });

    req.log.info({ sessionId, templateKey }, '[questionnaire/start] session created');

    res.status(201).json({
      sessionId,
      sessionToken,
      firstQuestion,
      totalEstimated,
    });
  } catch (err) {
    req.log.info({ err }, '[questionnaire/start] error');
    res.status(502).json({ error: String(err) });
  }
});

// POST /api/questionnaire/provision-link — staff/internal only.
// Mints a pre-consult questionnaire session for a (possibly unregistered)
// patient and returns a shareable link, so a privileged caller (e.g. the
// front-desk booking flow) can bundle it into a confirmation message
// without ever touching session_token generation itself — api-server stays
// the sole owner of the questionnaire-session lifecycle.
router.post('/api/questionnaire/provision-link', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const { patientId, templateKey } = (req.body ?? {}) as {
    patientId?: string;
    templateKey?: string;
  };

  const key = templateKey || 'general_screening';

  try {
    const { data: template, error: tmplErr } = await sb()
      .from('questionnaire_templates')
      .select('id, name')
      .eq('name', key)
      .eq('is_active', true)
      .single();

    if (tmplErr || !template) {
      res.status(404).json({ error: `Template '${key}' not found or inactive` });
      return;
    }

    const sessionToken = generateSessionToken();

    const { data: sessionRow, error: sessErr } = await sb()
      .from('questionnaire_sessions')
      .insert({
        template_id: template.id,
        mode: 'screening',
        status: 'in_progress',
        delivery_method: 'whatsapp_link',
        patient_id: patientId ?? null,
        session_token: sessionToken,
        consent_given: false,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (sessErr || !sessionRow) {
      req.log.info({ err: sessErr }, '[questionnaire/provision-link] insert session failed');
      res.status(502).json({ error: 'Failed to create session' });
      return;
    }

    await audit({
      action: 'classify',
      entityType: 'questionnaire_session',
      entityId: sessionRow.id,
      payload: { templateKey: key, mode: 'screening', delivery: 'whatsapp_link', provisioned: true },
    });

    const baseUrl = process.env.FRONTEND_URL || 'https://front-desk-amisesuite-afks-projects.vercel.app';
    res.status(201).json({ url: `${baseUrl}/questionnaire/${sessionToken}` });
  } catch (err) {
    req.log.info({ err }, '[questionnaire/provision-link] error');
    res.status(502).json({ error: String(err) });
  }
});

// POST /api/questionnaire/session/:token/answer
router.post('/api/questionnaire/session/:token/answer', async (req, res) => {
  const { token } = req.params;
  const { questionKey, value } = (req.body ?? {}) as {
    questionKey?: string;
    value?: string | string[];
  };

  if (!questionKey || value === undefined || value === null) {
    res.status(400).json({ error: 'questionKey and value are required' });
    return;
  }

  try {
    // Validate session
    const { data: sessionRow, error: sessErr } = await sb()
      .from('questionnaire_sessions')
      .select('id, status, template_id, mode, patient_id, encounter_id, expires_at')
      .eq('session_token', token)
      .single();

    if (sessErr || !sessionRow) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    if (sessionRow.expires_at && new Date(sessionRow.expires_at).getTime() < Date.now()) {
      res.status(410).json({ error: 'This questionnaire link has expired' });
      return;
    }

    if (sessionRow.status !== 'in_progress') {
      res.status(409).json({ error: `Session is already '${sessionRow.status}'` });
      return;
    }

    // Fetch template key
    const { data: template } = await sb()
      .from('questionnaire_templates')
      .select('name')
      .eq('id', sessionRow.template_id)
      .single();

    const templateKey: string = template?.name ?? 'general_screening';
    const sessionId: string = sessionRow.id;

    // Load existing responses
    const { data: existingResponses, error: respErr } = await sb()
      .from('questionnaire_responses')
      .select('question_key, answer_value, sequence_number')
      .eq('session_id', sessionId)
      .order('sequence_number', { ascending: true });

    if (respErr) throw respErr;

    // Reconstruct state
    const state = reconstructState(
      sessionId,
      templateKey,
      (sessionRow.mode as 'screening' | 'condition_specific') ?? 'screening',
      existingResponses ?? [],
    );

    // Validate question exists in QUESTION_BANK
    const question = QUESTION_BANK[questionKey];
    if (!question) {
      res.status(400).json({ error: `Unknown question key: '${questionKey}'` });
      return;
    }

    // Check for red flags
    const redFlag = checkRedFlag(question, value);
    const isRedFlagAnswer = redFlag !== null;

    // Determine answer display
    const answerDisplay = formatAnswerDisplay(question, value);

    // Sequence number = current count + 1
    const sequenceNumber = (existingResponses?.length ?? 0) + 1;

    // Insert response
    const { error: insertErr } = await sb()
      .from('questionnaire_responses')
      .insert({
        session_id: sessionId,
        question_key: questionKey,
        question_text: question.text,
        answer_value: encodeAnswerValue(value),
        answer_display: answerDisplay,
        is_red_flag: isRedFlagAnswer,
        answered_at: new Date().toISOString(),
        sequence_number: sequenceNumber,
      });

    if (insertErr) throw insertErr;

    // Process answer to update state
    const newState = processAnswer(state, { questionKey, value });

    // If red flags detected, append to session.red_flags_detected
    if (isRedFlagAnswer && redFlag) {
      const { data: currentSession } = await sb()
        .from('questionnaire_sessions')
        .select('red_flags_detected')
        .eq('id', sessionId)
        .single();

      const existingFlags: Array<{ question_key: string; answer: string; severity: string }> =
        (currentSession?.red_flags_detected as Array<{ question_key: string; answer: string; severity: string }>) ?? [];

      const updatedFlags = [
        ...existingFlags,
        {
          question_key: redFlag.questionKey,
          answer: redFlag.answerValue,
          severity: redFlag.severity,
          message: redFlag.message,
        },
      ];

      await sb()
        .from('questionnaire_sessions')
        .update({ red_flags_detected: updatedFlags })
        .eq('id', sessionId);
    }

    // Check completion
    const nextQuestion = newState.isComplete ? null : getNextQuestion(newState);
    const isComplete = newState.isComplete || nextQuestion === null;

    if (isComplete) {
      await sb()
        .from('questionnaire_sessions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          total_questions_shown: sequenceNumber,
        })
        .eq('id', sessionId);

      // Trigger AI summary generation asynchronously — do not await
      generateIntakeSummary(sessionId).catch(err =>
        console.error('[questionnaire] async summary generation failed', err),
      );

      await audit({
        action: 'draft',
        entityType: 'questionnaire_session',
        entityId: sessionId,
        payload: { event: 'completed', totalQuestions: sequenceNumber },
      });
    }

    res.json({
      nextQuestion: isComplete ? null : nextQuestion,
      isComplete,
      redFlagsDetected: isRedFlagAnswer,
      estimatedRemaining: newState.estimatedRemaining,
    });
  } catch (err) {
    req.log.info({ err }, '[questionnaire/answer] error');
    res.status(502).json({ error: String(err) });
  }
});

// GET /api/questionnaire/session/:token
router.get('/api/questionnaire/session/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const { data: sessionRow, error: sessErr } = await sb()
      .from('questionnaire_sessions')
      .select('*')
      .eq('session_token', token)
      .single();

    if (sessErr || !sessionRow) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    if (sessionRow.expires_at && new Date(sessionRow.expires_at).getTime() < Date.now()) {
      res.status(410).json({ error: 'This questionnaire link has expired' });
      return;
    }

    const { data: responsesRaw, error: respErr } = await sb()
      .from('questionnaire_responses')
      .select('*')
      .eq('session_id', sessionRow.id)
      .order('sequence_number', { ascending: true });

    if (respErr) throw respErr;

    // Fetch template key for state reconstruction
    const { data: template } = await sb()
      .from('questionnaire_templates')
      .select('name')
      .eq('id', sessionRow.template_id)
      .single();

    const templateKey: string = template?.name ?? 'general_screening';

    const state = reconstructState(
      sessionRow.id,
      templateKey,
      (sessionRow.mode as 'screening' | 'condition_specific') ?? 'screening',
      responsesRaw ?? [],
    );

    const isComplete =
      sessionRow.status === 'completed' ||
      sessionRow.status === 'nurse_reviewed' ||
      sessionRow.status === 'doctor_approved' ||
      state.isComplete;

    const currentQuestion = isComplete ? null : getNextQuestion(state);

    res.json({
      session: sessionRow,
      responses: responsesRaw ?? [],
      currentQuestion,
      isComplete,
    });
  } catch (err) {
    req.log.info({ err }, '[questionnaire/get-session] error');
    res.status(502).json({ error: String(err) });
  }
});

// GET /api/questionnaire/nurse/queue
router.get('/api/questionnaire/nurse/queue', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  try {
    const { data, error } = await sb()
      .from('questionnaire_sessions')
      .select(
        'id, patient_id, status, red_flags_detected, started_at, completed_at, template_id, mode, delivery_method',
      )
      .in('status', ['completed', 'in_progress'])
      .order('completed_at', { ascending: false });

    if (error) throw error;

    const rows = data ?? [];

    // Sort: sessions with red flags first, then by completed_at desc
    const sorted = rows.sort((a, b) => {
      const aHasFlags =
        Array.isArray(a.red_flags_detected) && (a.red_flags_detected as unknown[]).length > 0;
      const bHasFlags =
        Array.isArray(b.red_flags_detected) && (b.red_flags_detected as unknown[]).length > 0;

      if (aHasFlags && !bHasFlags) return -1;
      if (!aHasFlags && bHasFlags) return 1;

      const aTime = a.completed_at ?? a.started_at ?? '';
      const bTime = b.completed_at ?? b.started_at ?? '';
      return bTime.localeCompare(aTime);
    });

    res.json({ queue: sorted, total: sorted.length });
  } catch (err) {
    req.log.info({ err }, '[questionnaire/nurse-queue] error');
    res.status(502).json({ error: String(err) });
  }
});

// GET /api/questionnaire/session/:token/summary
// Staff/clinician only — patients never get self-service access to their AI-
// generated clinical summary. The token that lets a patient submit answers
// must not also unlock the read-back of clinically-interpreted data; release
// to a patient on request goes through staff review (see nurse-review /
// doctor-approve below), not this endpoint.
router.get('/api/questionnaire/session/:token/summary', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const { token } = req.params;

  try {
    // Resolve session by token
    const { data: sessionRow, error: sessErr } = await sb()
      .from('questionnaire_sessions')
      .select('id, status')
      .eq('session_token', token)
      .single();

    if (sessErr || !sessionRow) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const { data: summary, error: sumErr } = await sb()
      .from('intake_summaries')
      .select('*')
      .eq('session_id', sessionRow.id)
      .single();

    if (sumErr || !summary) {
      // Not generated yet — trigger generation and return 202
      generateIntakeSummary(sessionRow.id).catch(err =>
        console.error('[questionnaire] async summary generation failed', err),
      );
      res.status(202).json({ generating: true });
      return;
    }

    res.json({ summary });
  } catch (err) {
    req.log.info({ err }, '[questionnaire/summary] error');
    res.status(502).json({ error: String(err) });
  }
});

// POST /api/questionnaire/session/:token/nurse-review
router.post('/api/questionnaire/session/:token/nurse-review', async (req, res) => {
  const { token } = req.params;
  const { nurseNotes, nurseUserId } = (req.body ?? {}) as {
    nurseNotes?: string;
    nurseUserId?: string;
  };

  if (!nurseUserId) {
    res.status(400).json({ error: 'nurseUserId is required' });
    return;
  }

  try {
    const { data: sessionRow, error: sessErr } = await sb()
      .from('questionnaire_sessions')
      .select('id, status')
      .eq('session_token', token)
      .single();

    if (sessErr || !sessionRow) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const { data: updated, error: updateErr } = await sb()
      .from('questionnaire_sessions')
      .update({
        status: 'nurse_reviewed',
        nurse_reviewed_by: nurseUserId,
        nurse_reviewed_at: new Date().toISOString(),
        nurse_notes: nurseNotes ?? null,
      })
      .eq('id', sessionRow.id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    await audit({
      action: 'classify',
      entityType: 'questionnaire_session',
      entityId: sessionRow.id,
      payload: { event: 'nurse_reviewed', nurseUserId },
    });

    res.json({ session: updated });
  } catch (err) {
    req.log.info({ err }, '[questionnaire/nurse-review] error');
    res.status(502).json({ error: String(err) });
  }
});

// POST /api/questionnaire/session/:token/doctor-approve
router.post('/api/questionnaire/session/:token/doctor-approve', async (req, res) => {
  const { token } = req.params;
  const { doctorUserId } = (req.body ?? {}) as { doctorUserId?: string };

  if (!doctorUserId) {
    res.status(400).json({ error: 'doctorUserId is required' });
    return;
  }

  try {
    const { data: sessionRow, error: sessErr } = await sb()
      .from('questionnaire_sessions')
      .select('id, status, encounter_id, patient_id')
      .eq('session_token', token)
      .single();

    if (sessErr || !sessionRow) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Populate EMR asynchronously — but we need the encounter ID synchronously
    let encounterId: string | null = null;
    try {
      encounterId = await populateEMR(
        sessionRow.id,
        sessionRow.encounter_id ?? undefined,
      );
    } catch (emrErr) {
      // EMR population failure is non-fatal for the approval itself
      req.log.info({ err: emrErr }, '[questionnaire/doctor-approve] EMR population failed');
    }

    const { data: updated, error: updateErr } = await sb()
      .from('questionnaire_sessions')
      .update({
        status: 'doctor_approved',
        doctor_approved_by: doctorUserId,
        doctor_approved_at: new Date().toISOString(),
        emr_populated: encounterId !== null,
        emr_populated_at: encounterId !== null ? new Date().toISOString() : null,
        encounter_id: encounterId ?? sessionRow.encounter_id ?? null,
      })
      .eq('id', sessionRow.id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // Mark intake summary as reviewed
    await sb()
      .from('intake_summaries')
      .update({ reviewed_by_doctor: true })
      .eq('session_id', sessionRow.id);

    await audit({
      action: 'classify',
      entityType: 'questionnaire_session',
      entityId: sessionRow.id,
      payload: { event: 'doctor_approved', doctorUserId, encounterId },
    });

    res.json({ approved: true, encounterId });
  } catch (err) {
    req.log.info({ err }, '[questionnaire/doctor-approve] error');
    res.status(502).json({ error: String(err) });
  }
});

// POST /api/questionnaire/send-sms
router.post('/api/questionnaire/send-sms', async (req, res) => {
  const { sessionToken, phone, patientName } = req.body ?? {};

  if (!sessionToken || !phone) {
    res.status(400).json({ error: 'sessionToken and phone are required' });
    return;
  }
  if (!/^\+?[1-9]\d{6,14}$/.test(phone)) {
    res.status(400).json({ error: 'Invalid phone number — use international format e.g. +18685551234' });
    return;
  }

  try {
    const { data: session, error } = await sb()
      .from('questionnaire_sessions')
      .select('id, status')
      .eq('session_token', sessionToken)
      .single();

    if (error || !session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const baseUrl = process.env.FRONTEND_URL || 'https://front-desk-amisesuite-afks-projects.vercel.app';
    const url = `${baseUrl}/questionnaire/${sessionToken}`;
    const greeting = patientName ? `Hello ${patientName.split(' ')[0]},` : 'Hello,';
    const body = `${greeting} Please complete your pre-visit questionnaire for Amise Medical Services: ${url}`;

    const provider = process.env.SMS_PROVIDER ?? 'dry_run';
    let messageSid: string | undefined;

    if (provider === 'twilio') {
      const sid  = process.env.TWILIO_ACCOUNT_SID!;
      const auth = process.env.TWILIO_AUTH_TOKEN!;
      const from = process.env.TWILIO_FROM_NUMBER!;
      const encoded = Buffer.from(`${sid}:${auth}`).toString('base64');
      const params = new URLSearchParams({ From: from, To: phone, Body: body });
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: `Basic ${encoded}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      if (!r.ok) {
        const txt = await r.text();
        throw new Error(`Twilio error ${r.status}: ${txt}`);
      }
      const json = await r.json() as { sid: string };
      messageSid = json.sid;
    } else {
      req.log.info({ phone, url, body }, '[questionnaire/send-sms] dry_run — would send SMS');
    }

    await audit({
      action: 'send',
      entityType: 'questionnaire_sms',
      entityId: sessionToken,
      payload: { phone, dryRun: provider !== 'twilio', messageSid, url },
    });

    res.json({ sent: provider === 'twilio', dryRun: provider !== 'twilio', messageSid, url });
  } catch (err) {
    req.log.info({ err }, '[questionnaire/send-sms] error');
    res.status(502).json({ error: String(err) });
  }
});

// GET /api/questionnaire/templates
router.get('/api/questionnaire/templates', async (req, res) => {
  try {
    const { data, error } = await sb()
      .from('questionnaire_templates')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;

    res.json({ templates: data ?? [] });
  } catch (err) {
    req.log.info({ err }, '[questionnaire/templates] error');
    res.status(502).json({ error: String(err) });
  }
});

export default router;
