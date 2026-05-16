import { scanRedFlags, Severity, AppointmentType } from '@workspace/triage-engine';
import { Classification } from './claude.js';

export interface TriageResult {
  flagged: boolean;
  severity: Severity | null;
  reasons: string[];
  recommendedAction: 'auto_book' | 'draft_supervised' | 'escalate_urgent' | 'escalate_priority' | 'escalate_review';
  appointmentType: AppointmentType | null;
}

export function triage(
  messageBody: string,
  subject: string,
  classification: Classification
): TriageResult {
  const combined = `${subject}\n${messageBody}`;
  const { flagged, matches } = scanRedFlags(combined);

  if (flagged) {
    const order: Severity[] = ['urgent', 'priority', 'review'];
    const highest = order.find(s => matches.some(m => m.severity === s))!;

    return {
      flagged: true,
      severity: highest,
      reasons: matches.map(m => m.reason),
      recommendedAction:
        highest === 'urgent'   ? 'escalate_urgent' :
        highest === 'priority' ? 'escalate_priority' :
                                  'escalate_review',
      appointmentType: null,
    };
  }

  const appointmentType: AppointmentType | null =
    classification.category === 'new_consult'  ? 'new_consult' :
    classification.category === 'follow_up'    ? 'follow_up' :
    classification.category === 'post_op'      ? 'post_op' :
    classification.category === 'ercp_workup'  ? 'ercp_workup' :
    classification.category === 'breast'       ? 'breast' :
    null;

  if (!appointmentType) {
    return {
      flagged: false,
      severity: null,
      reasons: ['Out of scope for auto-booking'],
      recommendedAction: 'draft_supervised',
      appointmentType: null,
    };
  }

  if (classification.confidence < 0.7) {
    return {
      flagged: false,
      severity: null,
      reasons: [`Low classifier confidence (${classification.confidence})`],
      recommendedAction: 'draft_supervised',
      appointmentType,
    };
  }

  return {
    flagged: false,
    severity: null,
    reasons: [],
    recommendedAction: 'auto_book',
    appointmentType,
  };
}
