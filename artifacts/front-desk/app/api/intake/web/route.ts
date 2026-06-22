import { NextRequest, NextResponse } from 'next/server';
import { runIntakeTurn } from '@/lib/claude';
import { getThread, getOrCreateThread, updateThread, logAudit } from '@/lib/supabase';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

interface WebIntakeBody {
  threadId?: string;
  message: string;
  patientName?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: WebIntakeBody = await req.json();

    if (!body.message || typeof body.message !== 'string' || !body.message.trim()) {
      return NextResponse.json(
        { error: 'Message is required.' },
        { status: 400 },
      );
    }

    const message = body.message.trim();
    let thread;

    if (body.threadId) {
      // Resume existing thread
      thread = await getThread(body.threadId);
      if (!thread) {
        return NextResponse.json(
          { error: 'Thread not found.' },
          { status: 404 },
        );
      }
    } else {
      // Create a new thread — use 'sms' as the channel value since the DB
      // check constraint only allows 'whatsapp', 'email', 'sms'.
      const identifier = `web-${randomUUID()}`;
      thread = await getOrCreateThread(identifier, 'sms');
    }

    // If a patient name was provided on the first message, attach it
    if (body.patientName && !thread.patient_name) {
      await updateThread(thread.id, { patient_name: body.patientName });
      thread.patient_name = body.patientName;
    }

    // Run the Claude intake turn
    const { reply, updatedThread, emergent } = await runIntakeTurn(thread, message);

    // Persist conversation state
    await updateThread(thread.id, updatedThread);
    await logAudit(thread.id, 'web_intake_turn', 'claude', {
      triage_level: updatedThread.triage_level,
      emergent,
      channel: 'web',
    });

    return NextResponse.json({
      threadId: thread.id,
      reply,
      triage_level: updatedThread.triage_level ?? thread.triage_level,
      intake_complete: updatedThread.intake_complete ?? false,
    });
  } catch (err) {
    console.error('[web-intake] Error:', err);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again shortly.' },
      { status: 500 },
    );
  }
}
