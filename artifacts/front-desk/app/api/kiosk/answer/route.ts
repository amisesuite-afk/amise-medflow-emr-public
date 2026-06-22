import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import {
  createSession,
  getNextQuestion,
  processAnswer,
  checkRedFlag,
  QUESTION_BANK,
} from '@workspace/triage-engine/apcq';
import type { SessionState } from '@workspace/triage-engine/apcq';

export const runtime = 'nodejs';

function encodeValue(v: string | string[]): string {
  return Array.isArray(v) ? JSON.stringify(v) : v;
}

function decodeValue(raw: string | null): string | string[] {
  if (!raw) return '';
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : raw;
  } catch {
    return raw;
  }
}

function displayValue(question: (typeof QUESTION_BANK)[string], value: string | string[]): string {
  const vals = Array.isArray(value) ? value : [value];
  if (!question.options) return vals.join(', ');
  return vals
    .map(v => question.options!.find(o => o.value === v)?.label ?? v)
    .join(', ');
}

function reconstructState(
  sessionId: string,
  templateKey: string,
  mode: 'screening' | 'condition_specific',
  rows: Array<{ question_key: string; answer_value: string | null; sequence_number: number }>,
): SessionState {
  const sorted = [...rows].sort((a, b) => a.sequence_number - b.sequence_number);
  let state = createSession({ sessionId, templateKey, mode });
  for (const row of sorted) {
    if (!row.answer_value) continue;
    state = processAnswer(state, { questionKey: row.question_key, value: decodeValue(row.answer_value) });
  }
  return state;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json() as {
    token?: string;
    questionKey?: string;
    value?: string | string[];
  };

  const { token, questionKey, value } = body;

  if (!token || !questionKey || value === undefined || value === null) {
    return NextResponse.json({ error: 'token, questionKey and value are required' }, { status: 400 });
  }

  const sb = getServiceClient();

  try {
    // Load session
    const { data: sessionRow, error: sessErr } = await sb
      .from('questionnaire_sessions')
      .select('id, status, template_id, mode, red_flags_detected')
      .eq('session_token', token)
      .single();

    if (sessErr || !sessionRow) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    if (sessionRow.status !== 'in_progress') {
      return NextResponse.json({ error: `Session already '${sessionRow.status}'` }, { status: 409 });
    }

    // Resolve template key
    const { data: tmpl } = await sb
      .from('questionnaire_templates')
      .select('name')
      .eq('id', sessionRow.template_id)
      .single();

    const templateKey = (tmpl?.name as string) ?? 'general_screening';
    const sessionId: string = sessionRow.id;
    const mode = ((sessionRow.mode as string) === 'condition_specific'
      ? 'condition_specific'
      : 'screening') as 'screening' | 'condition_specific';

    // Load existing responses
    const { data: existing } = await sb
      .from('questionnaire_responses')
      .select('question_key, answer_value, sequence_number')
      .eq('session_id', sessionId)
      .order('sequence_number', { ascending: true });

    const existingRows = existing ?? [];
    const state = reconstructState(sessionId, templateKey, mode, existingRows);

    const question = QUESTION_BANK[questionKey];
    if (!question) {
      return NextResponse.json({ error: `Unknown question: '${questionKey}'` }, { status: 400 });
    }

    const redFlag = checkRedFlag(question, value);
    const isRedFlag = redFlag !== null;
    const sequenceNumber = existingRows.length + 1;

    // Persist response
    await sb.from('questionnaire_responses').insert({
      session_id: sessionId,
      question_key: questionKey,
      question_text: question.text,
      answer_value: encodeValue(value),
      answer_display: displayValue(question, value),
      is_red_flag: isRedFlag,
      answered_at: new Date().toISOString(),
      sequence_number: sequenceNumber,
    });

    // Append red flag to session if detected
    if (isRedFlag && redFlag) {
      const existing = (sessionRow.red_flags_detected as Array<Record<string, unknown>>) ?? [];
      await sb
        .from('questionnaire_sessions')
        .update({
          red_flags_detected: [
            ...existing,
            {
              question_key: redFlag.questionKey,
              answer: redFlag.answerValue,
              severity: redFlag.severity,
              message: redFlag.message,
            },
          ],
        })
        .eq('id', sessionId);
    }

    const newState = processAnswer(state, { questionKey, value });
    const nextQuestion = newState.isComplete ? null : getNextQuestion(newState);
    const isComplete = newState.isComplete || nextQuestion === null;

    if (isComplete) {
      await sb
        .from('questionnaire_sessions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          total_questions_shown: sequenceNumber,
        })
        .eq('id', sessionId);
    }

    return NextResponse.json({
      nextQuestion: isComplete ? null : nextQuestion,
      isComplete,
      redFlagsDetected: isRedFlag,
      redFlagSeverity: redFlag?.severity ?? null,
      estimatedRemaining: newState.estimatedRemaining,
    });
  } catch (err) {
    console.error('[kiosk/answer]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
