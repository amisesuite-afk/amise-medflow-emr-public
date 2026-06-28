import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { sb, audit, requireStaffAuth } from '../lib/supabase.js';
import { logger, errStr } from '../lib/logger.js';
import {
  createSession,
  getNextQuestion,
  processAnswer,
  checkRedFlag,
  buildResponseSummary,
  detectSpecialty,
  QUESTION_BANK,
  SPECIALTY_QUEUES,
} from '@workspace/triage-engine/apcq.js';
import { checkForbiddenContent, FORBIDDEN_PATTERNS } from '@workspace/triage-engine';
import type {
  SessionState,
  Response as ApcqResponse,
  ApcqRedFlag,
  Question,
  Specialty,
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

// Specialty-specific guidance for the HPI narrative — tailors which history
// elements the AI should prioritise for the practice's two main referral
// streams (general surgery vs endoscopy/GI), plus the smaller breast and
// post-op queues.
const SPECIALTY_HPI_GUIDANCE: Record<Specialty, string> = {
  general_surgery:
    'This is a general surgical presentation (e.g. abdominal pain, hernia, lump). ' +
    'The HPI should cover: site, onset, character, severity, radiation, and progression of the ' +
    'presenting complaint; aggravating/relieving factors; associated GI or urinary symptoms; ' +
    'relevant prior abdominal surgery; and any factors relevant to operative planning ' +
    '(anticoagulants, anaesthetic history) surfaced by the questionnaire.',
  endoscopy:
    'This is an endoscopy/GI presentation (e.g. reflux, dysphagia, change in bowel habit, rectal bleeding). ' +
    'The HPI should cover: nature, duration and progression of the GI symptom(s); alarm/red-flag features ' +
    '(unintentional weight loss, PR bleeding, dysphagia, anaemia symptoms); bowel habit and diet; ' +
    'any previous endoscopic procedures or findings mentioned; and anticoagulant/antiplatelet use ' +
    'relevant to procedure planning and bowel preparation.',
  breast_surgery:
    'This is a breast surgical presentation (e.g. lump, pain, nipple discharge or skin change). ' +
    'The HPI should cover: site, size, duration and any change in the lump or symptom; associated ' +
    'skin, nipple or axillary changes; relevant family history of breast disease if mentioned; ' +
    'and any prior breast surgery or imaging.',
  post_op:
    'This is a post-operative review. The HPI should cover: the original procedure and approximate date ' +
    'if known, current symptoms (pain, wound concerns, fever), recovery progress, and any concerns ' +
    'raised by the patient since surgery.',
  general_medical:
    'This is a general screening or undifferentiated presentation. The HPI should cover the presenting ' +
    'complaint(s) with onset, duration, character and progression, and any relevant background ' +
    'surfaced by the questionnaire.',
};

// ─────────────────────────────────────────────────────────────────────────────
// VITALS PHOTO CAPTURE
// ─────────────────────────────────────────────────────────────────────────────

const SUPPORTED_VITALS_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
]);

const ExtractedVitalsSchema = z.object({
  systolicBp: z.number().nullable().optional(),
  diastolicBp: z.number().nullable().optional(),
  heartRate: z.number().nullable().optional(),
  temperatureC: z.number().nullable().optional(),
  spo2: z.number().nullable().optional(),
  respiratoryRate: z.number().nullable().optional(),
  weightKg: z.number().nullable().optional(),
  heightCm: z.number().nullable().optional(),
  glucoseMmol: z.number().nullable().optional(),
  deviceType: z.string().nullable().optional(),
  rawText: z.string().nullable().optional(),
  confidence: z.enum(['high', 'medium', 'low']).optional().default('medium'),
});

const VITALS_EXTRACT_PROMPT = `This image is a photo of a home medical device display — a blood pressure ` +
  `monitor, digital weighing scale, thermometer, pulse oximeter, or glucometer. Read off the numeric ` +
  `value(s) shown on the screen exactly as displayed. Do not interpret, diagnose, or comment on the ` +
  `readings — only transcribe what is visible.

Respond with ONLY a JSON object, no markdown fences, matching this schema:
{
  "systolicBp": number | null,
  "diastolicBp": number | null,
  "heartRate": number | null,
  "temperatureC": number | null,
  "spo2": number | null,
  "respiratoryRate": number | null,
  "weightKg": number | null,
  "heightCm": number | null,
  "glucoseMmol": number | null,
  "deviceType": string | null,
  "rawText": string | null,
  "confidence": "high" | "medium" | "low"
}

Only fill in fields that are actually shown on the device's display — leave everything else null. ` +
  `"deviceType" should briefly describe the device (e.g. "blood pressure monitor", "digital scale", ` +
  `"thermometer"). "rawText" should be a short transcription of the digits/units visible on the screen. ` +
  `Convert temperature to Celsius and weight to kilograms if the device shows Fahrenheit or pounds. ` +
  `"confidence" reflects how clearly the display could be read.`;

// Maps the camelCase fields produced by ExtractedVitalsSchema onto the
// snake_case columns of the vitals table.
const VITALS_FIELD_MAP: Record<string, string> = {
  systolicBp: 'bp_systolic',
  diastolicBp: 'bp_diastolic',
  heartRate: 'heart_rate',
  temperatureC: 'temperature_c',
  spo2: 'oxygen_saturation',
  respiratoryRate: 'respiratory_rate',
  weightKg: 'weight_kg',
  heightCm: 'height_cm',
  glucoseMmol: 'glucose_mmol',
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Generate a 32-character hex session token. */
function generateSessionToken(): string {
  return randomBytes(16).toString('hex');
}

/** Session tokens expire after 72 hours from creation. */
const SESSION_TOKEN_TTL_MS = 72 * 60 * 60 * 1000;

/** Check if a session token has exceeded the 72-hour TTL based on created_at. */
function isSessionTokenExpired(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false; // If no timestamp, allow (backwards compat)
  const created = new Date(createdAt).getTime();
  return Date.now() - created > SESSION_TOKEN_TTL_MS;
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

    // Tailor the HPI guidance to whichever of the practice's two main
    // tracks (general surgery vs endoscopy/GI) — or breast/post-op —
    // this questionnaire falls under.
    const chiefComplaintResponse = state.responses.find(r => r.questionKey === 'chief_complaint');
    const chiefComplaintValues = chiefComplaintResponse
      ? (Array.isArray(chiefComplaintResponse.answerValue) ? chiefComplaintResponse.answerValue : [chiefComplaintResponse.answerValue])
      : [];
    const specialty = detectSpecialty(chiefComplaintValues);

    const systemPrompt = `You are a clinical documentation assistant for Amise Medical Services, a general and endoscopic surgery practice in Saint Lucia led by Dr Dawit Daniel Kabiye MD DM.

Your task: analyse the patient's pre-consultation questionnaire responses and produce a structured pre-visit briefing for the physician, including a History of Presenting Illness (HPI) narrative the physician can use as a starting point for the first-visit clinical note.

${SPECIALTY_HPI_GUIDANCE[specialty]}

CRITICAL RULES:
- You MAY: summarise, organise, highlight, flag concerns
- You MAY NOT: diagnose, suggest specific treatments, prescribe, or speculate beyond the data
- Flag red flags explicitly
- Use British-Caribbean professional medical language
- Write the HPI as flowing third-person prose (no bullet points), under 300 words
- Format as JSON only, no markdown fences`;

    const userPrompt = `Analyse the following pre-consultation questionnaire and return a JSON object with this exact schema:
{
  "chiefComplaint": "string — brief chief complaint extracted from responses",
  "keyPositives": ["string", "..."],
  "redFlags": [{"symptom": "string", "severity": "routine|priority|urgent|emergency", "action": "string"}],
  "recommendedFocusAreas": ["string", "..."],
  "estimatedUrgency": "routine|priority|urgent|emergency",
  "summary": "string — a History of Presenting Illness (HPI) narrative under 300 words, written in flowing third-person prose ready to be copied into the patient's first-visit clinical note. Cover onset, duration, character, severity, site/radiation and progression of the presenting complaint, associated symptoms and pertinent negatives, and any relevant background (medications, allergies, prior surgery/endoscopy) surfaced by the questionnaire. No bullet points."
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
      parsed = { summary: raw, estimatedUrgency: 'routine' };
    }

    // Scan AI output for forbidden content (diagnoses, fees, drug doses)
    if (parsed.summary && !checkForbiddenContent(parsed.summary).safe) {
      parsed.summary = parsed.summary
        .split('\n')
        .map((line: string) =>
          FORBIDDEN_PATTERNS.some(p => p.test(line))
            ? '[REDACTED — clinical review required]'
            : line,
        )
        .join('\n');
      logger.warn({ sessionId }, '[questionnaire] AI summary contained forbidden content — redacted');
    }

    const validUrgencies = ['routine', 'priority', 'urgent', 'emergency'] as const;
    const urgencyRank: Record<string, number> = { routine: 0, priority: 1, urgent: 2, emergency: 3 };
    const aiUrgency = validUrgencies.includes(
      parsed.estimatedUrgency as (typeof validUrgencies)[number],
    )
      ? (parsed.estimatedUrgency as (typeof validUrgencies)[number])
      : 'routine';

    // Fetch questionnaire-detected red flag severity — never let AI downgrade it
    const { data: sessionFlags } = await sb()
      .from('questionnaire_sessions')
      .select('red_flags_detected')
      .eq('id', sessionId)
      .single();

    let questionnaireUrgency: (typeof validUrgencies)[number] = 'routine';
    if (sessionFlags?.red_flags_detected && Array.isArray(sessionFlags.red_flags_detected)) {
      for (const rf of sessionFlags.red_flags_detected) {
        const sev = (rf as { severity?: string }).severity ?? 'routine';
        if ((urgencyRank[sev] ?? 0) > (urgencyRank[questionnaireUrgency] ?? 0)) {
          questionnaireUrgency = sev as (typeof validUrgencies)[number];
        }
      }
    }

    // Final urgency = max(questionnaire-detected, AI-estimated)
    const estimatedUrgency = (urgencyRank[questionnaireUrgency] ?? 0) >= (urgencyRank[aiUrgency] ?? 0)
      ? questionnaireUrgency
      : aiUrgency;

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
    logger.error({ err }, '[questionnaire] generateIntakeSummary error');
  }
}

/**
 * Pre-consultation intake questions that capture history/background rather
 * than an active symptom — these feed the encounter chief complaint or are
 * better suited to other tables (medications, allergies) than `symptoms`,
 * so they're excluded from the auto-drafted symptom list.
 */
const NON_SYMPTOM_QUESTION_KEYS = new Set([
  'chief_complaint', 'current_medications', 'allergies', 'smoking_status',
  'alcohol_use', 'family_history_cancer', 'family_history_breast',
  'prior_surgery', 'colonoscopy_history', 'mammogram_history',
  'surgery_date', 'surgery_type', 'screening_reason',
]);

/** Answers that indicate "no finding" — not worth drafting a symptom row for. */
const NEGATIVE_ANSWER_VALUES = new Set(['no', 'none', 'never', 'n/a', '']);

const URGENCY_TO_ACUITY: Record<string, 'routine' | 'review' | 'priority' | 'urgent'> = {
  routine: 'routine',
  priority: 'priority',
  urgent: 'urgent',
  emergency: 'urgent', // assessments.acuity has no 'emergency' tier — cap at 'urgent'
};

/**
 * Draft `symptoms`, `assessments` and `plans` rows from a completed intake —
 * AI/questionnaire-derived, clearly marked as such, and always subject to
 * physician review/edit before clinical use. Skipped if this session has
 * already populated the EMR once (re-approval must not duplicate rows).
 */
async function draftClinicalRecordsFromIntake(
  sessionId: string,
  encounterId: string,
  patientId: string,
  summary: {
    chief_complaint: string | null;
    ai_summary: string | null;
    key_positives: unknown;
    recommended_focus_areas: unknown;
    estimated_urgency: string;
  },
): Promise<void> {
  const { data: responses, error: respErr } = await sb()
    .from('questionnaire_responses')
    .select('question_key, question_text, answer_value, answer_display, is_red_flag')
    .eq('session_id', sessionId)
    .order('sequence_number', { ascending: true });

  if (respErr) throw respErr;

  const symptomRows = (responses ?? [])
    .filter((r) => {
      if (NON_SYMPTOM_QUESTION_KEYS.has(r.question_key)) return false;
      const v = (r.answer_value ?? '').trim().toLowerCase();
      return v.length > 0 && !NEGATIVE_ANSWER_VALUES.has(v);
    })
    .map((r) => ({
      encounter_id: encounterId,
      patient_id: patientId,
      symptom: r.question_text || r.question_key,
      severity: r.is_red_flag ? ('severe' as const) : null,
      details: {
        source: 'questionnaire_intake',
        session_id: sessionId,
        question_key: r.question_key,
        answer_value: r.answer_value,
        answer_display: r.answer_display,
      },
      notes: 'Auto-drafted from pre-visit questionnaire — confirm with patient at consultation.',
    }));

  if (symptomRows.length) {
    const { error: symErr } = await sb().from('symptoms').insert(symptomRows);
    if (symErr) throw symErr;
  }

  const keyPositives = Array.isArray(summary.key_positives)
    ? (summary.key_positives as unknown[]).filter((p): p is string => typeof p === 'string')
    : [];
  const focusAreas = Array.isArray(summary.recommended_focus_areas)
    ? (summary.recommended_focus_areas as unknown[]).filter((p): p is string => typeof p === 'string')
    : [];

  const { error: assessErr } = await sb().from('assessments').insert({
    encounter_id: encounterId,
    patient_id: patientId,
    diagnosis: summary.chief_complaint ?? null,
    differentials: keyPositives.length ? keyPositives.join('; ') : null,
    acuity: URGENCY_TO_ACUITY[summary.estimated_urgency] ?? 'routine',
    notes: [
      'DRAFT — generated from AI pre-visit intake summary. Physician must review, correct and confirm before use.',
      summary.ai_summary ? `\nHistory of Presenting Illness (from pre-visit questionnaire):\n${summary.ai_summary}` : null,
    ].filter(Boolean).join('\n'),
  });
  if (assessErr) throw assessErr;

  const { error: planErr } = await sb().from('plans').insert({
    encounter_id: encounterId,
    patient_id: patientId,
    plan_type: 'management',
    description: focusAreas.length
      ? `DRAFT — areas flagged by intake AI for the physician to probe at consultation: ${focusAreas.join('; ')}`
      : 'DRAFT — pending physician assessment at consultation.',
  });
  if (planErr) throw planErr;
}

/**
 * Create or update an encounter record from the intake summary, draft the
 * supporting clinical records (symptoms/assessment/plan) on first approval,
 * and return the encounter UUID.
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

  // Fetch patient_id + emr_populated flag from the session
  const { data: session } = await sb()
    .from('questionnaire_sessions')
    .select('patient_id, emr_populated, extracted_vitals, extracted_vitals_status')
    .eq('id', sessionId)
    .single();

  const patientId: string | null = session?.patient_id ?? null;
  const alreadyPopulated = session?.emr_populated === true;

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

  if (!alreadyPopulated && patientId) {
    await draftClinicalRecordsFromIntake(sessionId, encounterId, patientId, summary);
  }

  // Nurse-confirmed vitals from a device-photo capture get written to the
  // vitals table here, once an encounter exists to attach them to. The
  // status flips to 'written' so re-running populateEMR (e.g. on a second
  // doctor-approve call) doesn't insert a duplicate row.
  if (session?.extracted_vitals_status === 'confirmed' && session.extracted_vitals && patientId) {
    const extracted = session.extracted_vitals as Record<string, unknown>;
    const vitalsRow: Record<string, unknown> = {
      encounter_id: encounterId,
      patient_id: patientId,
    };
    for (const [src, dest] of Object.entries(VITALS_FIELD_MAP)) {
      const val = extracted[src];
      if (typeof val === 'number') vitalsRow[dest] = val;
    }

    if (Object.keys(vitalsRow).length > 2) {
      const { error: vitalsErr } = await sb().from('vitals').insert(vitalsRow);
      if (vitalsErr) throw vitalsErr;

      await sb()
        .from('questionnaire_sessions')
        .update({ extracted_vitals_status: 'written' })
        .eq('id', sessionId);
    }
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

    // Consent record is created when the patient explicitly accepts
    // via POST /api/questionnaire/session/:token/consent (see below).
    // Session starts with consent_given=false.

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
      consentRequired: true,
      consentText: CONSENT_TEXT_V1,
      consentVersion: '1.0',
      firstQuestion,
      totalEstimated,
    });
  } catch (err) {
    req.log.info({ err }, '[questionnaire/start] error');
    res.status(502).json({ error: errStr(err) });
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
    res.status(502).json({ error: errStr(err) });
  }
});

// POST /api/questionnaire/session/:token/consent — patient must accept before answering
router.post('/api/questionnaire/session/:token/consent', async (req, res) => {
  const { token } = req.params;
  const { patientNameEntered, consentGiven } = (req.body ?? {}) as {
    patientNameEntered?: string;
    consentGiven?: boolean;
  };

  if (consentGiven !== true) {
    res.status(400).json({ error: 'Consent must be explicitly accepted (consentGiven: true)' });
    return;
  }

  try {
    const { data: sessionRow, error: sessErr } = await sb()
      .from('questionnaire_sessions')
      .select('id, status, consent_given, expires_at, created_at')
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

    if (isSessionTokenExpired(sessionRow.created_at)) {
      res.status(410).json({ error: 'This questionnaire link has expired (72-hour TTL exceeded)' });
      return;
    }

    if (sessionRow.consent_given) {
      res.json({ sessionId: sessionRow.id, consentAlreadyGiven: true });
      return;
    }

    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? null;
    const userAgent = req.headers['user-agent'] ?? null;

    await sb().from('consent_records').insert({
      session_id: sessionRow.id,
      consent_type: 'data_collection',
      consent_text: CONSENT_TEXT_V1,
      consent_version: '1.0',
      consented: true,
      patient_name_entered: patientNameEntered ?? null,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    await sb()
      .from('questionnaire_sessions')
      .update({
        consent_given: true,
        consent_timestamp: new Date().toISOString(),
        consent_ip: ipAddress,
      })
      .eq('id', sessionRow.id);

    await audit({
      action: 'classify',
      entityType: 'questionnaire_session',
      entityId: sessionRow.id,
      payload: { action: 'consent_given', version: '1.0' },
    });

    req.log.info({ sessionId: sessionRow.id }, '[questionnaire/consent] patient consented');
    res.json({ sessionId: sessionRow.id, consentRecorded: true });
  } catch (err) {
    req.log.info({ err }, '[questionnaire/consent] error');
    res.status(502).json({ error: errStr(err) });
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
      .select('id, status, template_id, mode, patient_id, encounter_id, expires_at, created_at')
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

    if (isSessionTokenExpired(sessionRow.created_at)) {
      res.status(410).json({ error: 'This questionnaire link has expired (72-hour TTL exceeded)' });
      return;
    }

    if (sessionRow.status !== 'in_progress') {
      res.status(409).json({ error: `Session is already '${sessionRow.status}'` });
      return;
    }

    // Consent gate: patient must accept data collection consent before answers are recorded
    const { data: consentCheck } = await sb()
      .from('questionnaire_sessions')
      .select('consent_given')
      .eq('id', sessionRow.id)
      .single();

    if (!consentCheck?.consent_given) {
      res.status(403).json({
        error: 'Consent required before answering questions. Call POST /api/questionnaire/session/:token/consent first.',
        consentRequired: true,
        consentText: CONSENT_TEXT_V1,
      });
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
        logger.error({ err }, '[questionnaire] async summary generation failed'),
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
    res.status(502).json({ error: errStr(err) });
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

    if (isSessionTokenExpired(sessionRow.created_at as string | null)) {
      res.status(410).json({ error: 'This questionnaire link has expired (72-hour TTL exceeded)' });
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
    res.status(502).json({ error: errStr(err) });
  }
});

// POST /api/questionnaire/session/:token/vitals-photo
// Patient (own device) or kiosk uploads a photo of a BP monitor, scale,
// thermometer, pulse oximeter, or glucometer display. Claude Vision reads
// off the values for nurse review — nothing is written to the clinical
// record at this stage.
router.post('/api/questionnaire/session/:token/vitals-photo', async (req, res) => {
  const { token } = req.params;
  const { dataBase64, mimeType } = (req.body ?? {}) as {
    dataBase64?: string; mimeType?: string;
  };

  if (!dataBase64 || !mimeType) {
    res.status(400).json({ error: 'dataBase64 and mimeType are required' });
    return;
  }
  if (!SUPPORTED_VITALS_MIME_TYPES.has(mimeType)) {
    res.status(400).json({ error: `Unsupported image type: ${mimeType}` });
    return;
  }

  try {
    const { data: sessionRow, error: sessErr } = await sb()
      .from('questionnaire_sessions')
      .select('id, extracted_vitals')
      .eq('session_token', token)
      .single();

    if (sessErr || !sessionRow) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const resp = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
              data: dataBase64,
            },
          },
          { type: 'text', text: VITALS_EXTRACT_PROMPT },
        ],
      }],
    });

    const text = resp.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '');

    const extracted = ExtractedVitalsSchema.parse(JSON.parse(text));

    // Merge with any previously captured readings — separate photos may
    // supply BP, weight, and temperature at different times.
    const existing = (sessionRow.extracted_vitals ?? {}) as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...existing };
    for (const [key, value] of Object.entries(extracted)) {
      if (value !== null && value !== undefined && value !== '') merged[key] = value;
    }

    const { data: updated, error: updateErr } = await sb()
      .from('questionnaire_sessions')
      .update({
        extracted_vitals: merged,
        extracted_vitals_status: 'pending_review',
        extracted_vitals_at: new Date().toISOString(),
      })
      .eq('id', sessionRow.id)
      .select('extracted_vitals, extracted_vitals_status')
      .single();

    if (updateErr) throw updateErr;

    await audit({
      action: 'extract',
      entityType: 'questionnaire_session',
      entityId: sessionRow.id,
      payload: { event: 'vitals_photo', extracted },
    });

    res.json({ extracted, vitals: updated.extracted_vitals, status: updated.extracted_vitals_status });
  } catch (err) {
    req.log.info({ err }, '[questionnaire/vitals-photo] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// POST /api/questionnaire/session/:token/vitals-photo/review
// Staff confirm or reject the values Claude read off a vitals photo. On
// confirm, the (possibly edited) values are staged for the next EMR
// population pass, which writes them into the vitals table.
router.post('/api/questionnaire/session/:token/vitals-photo/review', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const { token } = req.params;
  const { values, action, nurseUserId } = (req.body ?? {}) as {
    values?: Record<string, unknown>;
    action?: 'confirm' | 'reject';
    nurseUserId?: string;
  };

  if (action !== 'confirm' && action !== 'reject') {
    res.status(400).json({ error: 'action must be "confirm" or "reject"' });
    return;
  }
  if (!nurseUserId) {
    res.status(400).json({ error: 'nurseUserId is required' });
    return;
  }

  try {
    const { data: sessionRow, error: sessErr } = await sb()
      .from('questionnaire_sessions')
      .select('id, extracted_vitals')
      .eq('session_token', token)
      .single();

    if (sessErr || !sessionRow) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const update: Record<string, unknown> = {
      extracted_vitals_status: action === 'confirm' ? 'confirmed' : 'rejected',
      vitals_confirmed_by: nurseUserId,
      vitals_confirmed_at: new Date().toISOString(),
    };

    if (action === 'confirm' && values) {
      update.extracted_vitals = values;
    }

    const { data: updated, error: updateErr } = await sb()
      .from('questionnaire_sessions')
      .update(update)
      .eq('id', sessionRow.id)
      .select('extracted_vitals, extracted_vitals_status')
      .single();

    if (updateErr) throw updateErr;

    await audit({
      action: 'classify',
      entityType: 'questionnaire_session',
      entityId: sessionRow.id,
      payload: { event: 'vitals_review', decision: action, nurseUserId },
    });

    res.json({ vitals: updated.extracted_vitals, status: updated.extracted_vitals_status });
  } catch (err) {
    req.log.info({ err }, '[questionnaire/vitals-photo/review] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// GET /api/questionnaire/nurse/queue
router.get('/api/questionnaire/nurse/queue', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  try {
    const { data, error } = await sb()
      .from('questionnaire_sessions')
      .select(
        `id, patient_id, status, red_flags_detected, started_at, completed_at, session_token,
         template:questionnaire_templates(name),
         patient:patients(full_name)`,
      )
      .in('status', ['completed', 'in_progress', 'nurse_reviewed'])
      .order('completed_at', { ascending: false });

    if (error) throw error;

    type QueueRow = {
      id: string;
      patient_id: string | null;
      status: string;
      red_flags_detected: Array<{ question_key: string; severity: string; message?: string }> | null;
      started_at: string | null;
      completed_at: string | null;
      session_token: string;
      template: { name: string } | { name: string }[] | null;
      patient: { full_name: string } | { full_name: string }[] | null;
    };

    const rows = (data ?? []) as unknown as QueueRow[];
    const single = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

    const sessions = rows.map((row) => ({
      sessionToken: row.session_token,
      patientId: row.patient_id,
      patientName: single(row.patient)?.full_name ?? null,
      templateKey: single(row.template)?.name ?? 'general_screening',
      completedAt: row.completed_at ?? row.started_at ?? '',
      status: row.status,
      redFlags: (row.red_flags_detected ?? []).map((f) => ({
        questionId: f.question_key,
        severity: f.severity,
        label: f.message,
      })),
    }));

    // Sort: sessions with red flags first, then by completion/start time desc
    const sorted = sessions.sort((a, b) => {
      if (a.redFlags.length > 0 && b.redFlags.length === 0) return -1;
      if (a.redFlags.length === 0 && b.redFlags.length > 0) return 1;
      return b.completedAt.localeCompare(a.completedAt);
    });

    res.json({ sessions: sorted, total: sorted.length });
  } catch (err) {
    req.log.info({ err }, '[questionnaire/nurse-queue] error');
    res.status(502).json({ error: errStr(err) });
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
        logger.error({ err }, '[questionnaire] async summary generation failed'),
      );
      res.status(202).json({ generating: true });
      return;
    }

    res.json({ summary });
  } catch (err) {
    req.log.info({ err }, '[questionnaire/summary] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// POST /api/questionnaire/session/:token/nurse-review
router.post('/api/questionnaire/session/:token/nurse-review', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

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
    res.status(502).json({ error: errStr(err) });
  }
});

// POST /api/questionnaire/session/:token/staff-review
router.post('/api/questionnaire/session/:token/staff-review', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const { token } = req.params;
  const { staffNotes, staffUserId } = (req.body ?? {}) as {
    staffNotes?: string;
    staffUserId?: string;
  };

  if (!staffUserId) {
    res.status(400).json({ error: 'staffUserId is required' });
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
        status: 'staff_reviewed',
        staff_reviewed_by: staffUserId,
        staff_reviewed_at: new Date().toISOString(),
        staff_notes: staffNotes ?? null,
      })
      .eq('id', sessionRow.id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    await audit({
      action: 'classify',
      entityType: 'questionnaire_session',
      entityId: sessionRow.id,
      payload: { event: 'staff_reviewed', staffUserId },
    });

    res.json({ session: updated });
  } catch (err) {
    req.log.info({ err }, '[questionnaire/staff-review] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// POST /api/questionnaire/session/:token/doctor-approve
router.post('/api/questionnaire/session/:token/doctor-approve', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const { token } = req.params;
  const { doctorUserId } = (req.body ?? {}) as { doctorUserId?: string };

  if (!doctorUserId) {
    res.status(400).json({ error: 'doctorUserId is required' });
    return;
  }

  try {
    const { data: sessionRow, error: sessErr } = await sb()
      .from('questionnaire_sessions')
      .select('id, status, encounter_id, patient_id, nurse_reviewed_at, staff_reviewed_at')
      .eq('session_token', token)
      .single();

    if (sessErr || !sessionRow) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    if (!sessionRow.nurse_reviewed_at && !sessionRow.staff_reviewed_at) {
      res.status(422).json({ error: 'Staff or nurse review is required before doctor approval. This session has not been reviewed.' });
      return;
    }

    // Populate EMR asynchronously — but we need the encounter ID synchronously
    let encounterId: string | null = null;
    let emrError: string | null = null;
    try {
      encounterId = await populateEMR(
        sessionRow.id,
        sessionRow.encounter_id ?? undefined,
      );
    } catch (emrErr) {
      // EMR population failure is non-fatal for the approval itself, but it
      // leaves emr_populated permanently false with no retry path — log at
      // warn (not info) and surface the message in the response so staff
      // know to link the patient record and re-run population manually.
      emrError = emrErr instanceof Error ? emrErr.message : String(emrErr);
      req.log.warn({ err: emrErr }, '[questionnaire/doctor-approve] EMR population failed');
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

    res.json({ approved: true, encounterId, emrPopulated: encounterId !== null, emrError });
  } catch (err) {
    req.log.info({ err }, '[questionnaire/doctor-approve] error');
    res.status(502).json({ error: errStr(err) });
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
    res.status(502).json({ error: errStr(err) });
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
    res.status(502).json({ error: errStr(err) });
  }
});

export default router;
