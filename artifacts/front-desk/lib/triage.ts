import type { TriageLevel } from '@/types';

export function triagePriority(level: TriageLevel): number {
  return { EMERGENT: 4, URGENT: 3, ROUTINE: 2, INFO: 1 }[level];
}

export function triageColor(level: TriageLevel): string {
  return {
    EMERGENT: '#ef4444',
    URGENT:   '#f97316',
    ROUTINE:  '#fbbf24',
    INFO:     '#6b7280',
  }[level];
}

export function triageBg(level: TriageLevel): string {
  return {
    EMERGENT: '#7f1d1d',
    URGENT:   '#431407',
    ROUTINE:  '#422006',
    INFO:     '#1f2937',
  }[level];
}

export function triageLabel(level: TriageLevel): string {
  return {
    EMERGENT: '🚨 EMERGENT',
    URGENT:   '⚠ URGENT',
    ROUTINE:  '📋 ROUTINE',
    INFO:     'ℹ INFO',
  }[level];
}

export function shouldAutoSend(level: TriageLevel): boolean {
  return level === 'EMERGENT';
}

export function nurseAlertDelay(level: TriageLevel): number {
  return { EMERGENT: 0, URGENT: 2 * 60 * 1000, ROUTINE: 0, INFO: 0 }[level];
}

export function sortThreads<T extends { triage_level: TriageLevel; updated_at: string }>(threads: T[]): T[] {
  return [...threads].sort((a, b) => {
    const pDiff = triagePriority(b.triage_level) - triagePriority(a.triage_level);
    if (pDiff !== 0) return pDiff;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}
