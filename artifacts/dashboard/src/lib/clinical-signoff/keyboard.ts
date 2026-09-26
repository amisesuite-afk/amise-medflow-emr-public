/**
 * Clinical sign-off page — keyboard map (pure, so it is unit-tested without a DOM).
 *
 * Outside a text field:  j / ↓ next item · k / ↑ previous · a approve · m approve with amendment ·
 *                        r reject · d defer · / search · 1–6 status filter · g group by change
 *                        log / rule set · e export
 * Anywhere:              Ctrl / ⌘ + Enter record the decision · Esc leave the text field
 */
import type { SignoffDecision } from './types';
import { STATUS_FILTERS } from './status';
import type { StatusFilter } from './status';

export type SignoffKeyAction =
  | { type: 'move'; delta: 1 | -1 }
  | { type: 'decide'; decision: SignoffDecision }
  | { type: 'search' }
  | { type: 'filter'; filter: StatusFilter }
  | { type: 'toggle-group' }
  | { type: 'export' }
  | { type: 'submit' }
  | { type: 'blur' }
  | null;

export interface KeyInput {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  /** The event target is an input, textarea, select or contenteditable. */
  inField: boolean;
}

export function signoffKeyAction(e: KeyInput): SignoffKeyAction {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) return { type: 'submit' };
  if (e.inField) return e.key === 'Escape' ? { type: 'blur' } : null;
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  switch (e.key) {
    case 'j': case 'ArrowDown': return { type: 'move', delta: 1 };
    case 'k': case 'ArrowUp': return { type: 'move', delta: -1 };
    case 'a': return { type: 'decide', decision: 'approved' };
    case 'm': return { type: 'decide', decision: 'approved_with_amendment' };
    case 'r': return { type: 'decide', decision: 'rejected' };
    case 'd': return { type: 'decide', decision: 'deferred' };
    case '/': return { type: 'search' };
    case 'g': return { type: 'toggle-group' };
    case 'e': return { type: 'export' };
    default: {
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= STATUS_FILTERS.length) return { type: 'filter', filter: STATUS_FILTERS[n - 1].id };
      return null;
    }
  }
}

export const KEY_HINTS: [string, string][] = [
  ['j / k', 'next / previous'],
  ['a', 'approve'],
  ['m', 'amend'],
  ['r', 'reject'],
  ['d', 'defer'],
  ['Ctrl+Enter', 'record'],
  ['/', 'search'],
  ['1–6', 'filter'],
  ['g', 'group'],
  ['e', 'export'],
];
