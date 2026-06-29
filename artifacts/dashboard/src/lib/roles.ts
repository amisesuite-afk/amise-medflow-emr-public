/**
 * Role-based access control helpers.
 * Single source of truth for what each role can see/do.
 */

import type { UserRole } from './supabase';
import type { Section } from '@/context/AppContext';

const ROLE_RANK: Record<UserRole, number> = {
  front_desk: 0,
  nurse:      1,
  doctor:     2,
  admin:      3,
};

/**
 * True if userRole meets or exceeds minRole in the clinical hierarchy.
 * Undefined / null role is treated as front_desk (most restrictive).
 */
export function hasRole(userRole: UserRole | undefined | null, minRole: UserRole): boolean {
  return ROLE_RANK[userRole ?? 'front_desk'] >= ROLE_RANK[minRole];
}

/**
 * True if userRole is one of the explicitly listed roles.
 * Use for non-hierarchical gates (e.g. billing = front_desk + admin only).
 */
export function roleIn(userRole: UserRole | undefined | null, ...allowed: UserRole[]): boolean {
  return allowed.includes(userRole ?? 'front_desk');
}

/** Minimum role required to access a consultation sub-section.
 *  hasRole() uses hierarchy: front_desk < nurse < doctor < admin.
 *  So minRole:'nurse' grants nurse, doctor, AND admin. */
export const SECTION_MIN_ROLE: Partial<Record<Section, UserRole>> = {
  nurse_apcq:      'nurse',
  examination:     'nurse',
  investigations:  'nurse',
  radiology:       'nurse',
  attachments:     'nurse',
  assessment:      'doctor',
  plan:            'doctor',
  procedures:      'doctor',
  prescriptions:   'doctor',
  ai_consultant:   'doctor',
};
