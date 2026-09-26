/**
 * DISABLE_AI kill switch for the front-desk conversational intake
 * (compliance G-8 / A-20). With DISABLE_AI=true, the WhatsApp/SMS/web intake
 * must send nothing to Anthropic, fall back to the deterministic triage, and
 * still redirect emergencies. The Anthropic SDK is mocked.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ConversationThread } from '@/types';

const sdk = vi.hoisted(() => ({ create: vi.fn(), stream: vi.fn() }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: sdk.create, stream: sdk.stream };
  },
}));
vi.mock('@/lib/calendar', () => ({ findSlots: vi.fn().mockResolvedValue([]) }));

const { runIntakeTurn, draftProcedurePrepAdjustment } = await import('@/lib/claude');
const gate = await import('@/lib/ai-gate');

function thread(): ConversationThread {
  return {
    id: 't-1',
    channel: 'whatsapp',
    patient_phone: '+17580000000',
    patient_name: null,
    patient_dob: null,
    chief_complaint: null,
    messages: [],
    triage_level: 'INFO',
    status: 'active',
    intake_complete: false,
    draft_reply: null,
  } as unknown as ConversationThread;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DISABLE_AI = 'true';
});
afterEach(() => {
  delete process.env.DISABLE_AI;
});

describe('front-desk DISABLE_AI=true', () => {
  it('an intake turn sends nothing to Anthropic and replies with a holding message', async () => {
    const out = await runIntakeTurn(thread(), 'Hello, I would like to book a follow-up appointment please');
    expect(sdk.create).not.toHaveBeenCalled();
    expect(sdk.stream).not.toHaveBeenCalled();
    expect(out.emergent).toBe(false);
    expect(out.reply).toMatch(/member of our team will be in touch/);
    expect(out.updatedThread.intake_complete).toBe(false);
  });

  it('an emergency still gets the ER/911 redirect from the deterministic triage', async () => {
    const out = await runIntakeTurn(thread(), 'I am vomiting blood and passing out, severe chest pain and cannot breathe');
    expect(sdk.create).not.toHaveBeenCalled();
    expect(out.emergent).toBe(true);
    expect(out.reply).toMatch(/call 911/);
    expect(out.updatedThread.status).toBe('escalated');
  });

  it('procedure-prep adjustment drafting is skipped', async () => {
    const out = await draftProcedurePrepAdjustment('colonoscopy', 'Ann', ['I take warfarin every day']);
    expect(sdk.create).not.toHaveBeenCalled();
    expect(out).toEqual({ body: '', flagged: false, safe: true, violations: [] });
  });

  it('the gated client itself refuses to send', () => {
    const client = gate.createAnthropicClient();
    expect(() => client.messages.create({ model: 'm', max_tokens: 1, messages: [] })).toThrow(gate.AiDisabledError);
    expect(sdk.create).not.toHaveBeenCalled();
  });

  it('positive control: with DISABLE_AI unset the intake does call Claude', async () => {
    delete process.env.DISABLE_AI;
    sdk.create.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify({
        reply: 'Thank you.', section_completed: null, extracted: {},
        triage: { level: 'INFO', reason: 'x', red_flags: [] },
        intake_complete: false, appointment_intent: false,
      }) }],
    });
    await runIntakeTurn(thread(), 'Hello');
    expect(sdk.create).toHaveBeenCalledTimes(1);
  });
});

describe('every front-desk Anthropic client is created through lib/ai-gate.ts', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap(name => {
      if (['node_modules', '.next', 'test'].includes(name)) return [];
      const p = join(dir, name);
      if (statSync(p).isDirectory()) return walk(p);
      return /\.(ts|tsx)$/.test(p) ? [p] : [];
    });
  }

  it('no `new Anthropic(` outside lib/ai-gate.ts', () => {
    const offenders = walk(root)
      .filter(f => relative(root, f) !== join('lib', 'ai-gate.ts'))
      .filter(f => /new\s+Anthropic\s*\(/.test(readFileSync(f, 'utf8')))
      .map(f => relative(root, f));
    expect(offenders).toEqual([]);
  });
});
