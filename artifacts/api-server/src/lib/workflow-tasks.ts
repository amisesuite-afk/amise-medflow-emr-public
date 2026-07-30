import { sb } from './supabase.js';
import { logger as log } from './logger.js';

export interface CreateTaskInput {
  task_type:
    | 'review_result'
    | 'inform_patient'
    | 'sign_note'
    | 'await_referral'
    | 'await_investigation'
    | 'pay_invoice'
    | 'follow_up_overdue'
    | 'other';
  patient_id?: string | null;
  encounter_id?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  title: string;
  details?: string | null;
  priority?: 'urgent' | 'high' | 'normal' | 'low';
  due_at?: string | null;
  assigned_to?: string | null;
}

/**
 * Upsert an open workflow task.
 * If an open task already exists for the same (task_type, source_type, source_id)
 * the unique partial index prevents a duplicate — we catch the conflict and return
 * the existing row id instead of throwing.
 */
export async function createWorkflowTask(input: CreateTaskInput): Promise<string | null> {
  try {
    const { data, error } = await sb()
      .from('workflow_tasks')
      .insert({
        task_type:   input.task_type,
        patient_id:  input.patient_id   ?? null,
        encounter_id: input.encounter_id ?? null,
        source_type: input.source_type  ?? null,
        source_id:   input.source_id    ?? null,
        title:       input.title,
        details:     input.details      ?? null,
        priority:    input.priority     ?? 'normal',
        due_at:      input.due_at       ?? null,
        assigned_to: input.assigned_to  ?? null,
        status:      'open',
      })
      .select('id')
      .single();

    if (error) {
      // 23505 = unique_violation — task already exists and is open
      if ((error as { code?: string }).code === '23505') {
        log.debug({ input }, 'workflow_tasks: duplicate open task — skipping');
        return null;
      }
      throw error;
    }

    log.info({ id: data.id, type: input.task_type, patient: input.patient_id }, 'workflow task created');
    return data.id as string;
  } catch (err) {
    log.warn({ err, input }, 'createWorkflowTask: failed (non-fatal)');
    return null;
  }
}

/**
 * Auto-resolve an open task when the triggering action completes.
 * e.g. resolve 'await_investigation' when the result arrives.
 */
export async function resolveWorkflowTask(opts: {
  task_type: string;
  source_type: string;
  source_id: string;
  resolved_by?: string | null;
  resolution_note?: string;
}): Promise<void> {
  try {
    const now = new Date().toISOString();
    const { error } = await sb()
      .from('workflow_tasks')
      .update({
        status:          'resolved',
        resolved_at:     now,
        resolved_by:     opts.resolved_by  ?? null,
        resolution_note: opts.resolution_note ?? null,
        updated_at:      now,
      })
      .eq('task_type',   opts.task_type)
      .eq('source_type', opts.source_type)
      .eq('source_id',   opts.source_id)
      .eq('status',      'open');

    if (error) throw error;
  } catch (err) {
    log.warn({ err, opts }, 'resolveWorkflowTask: failed (non-fatal)');
  }
}
