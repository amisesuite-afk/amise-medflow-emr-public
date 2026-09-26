/**
 * Clinical sign-off — shared types (dashboard page, scripts/src/signoff-*.ts).
 *
 * The catalogue is generated from the repository's sign-off lists by
 * `pnpm --filter @workspace/scripts run signoff:catalogue` and checked in at
 * artifacts/dashboard/src/data/clinical-signoff-catalogue.json. Decisions are rows of
 * public.clinical_signoffs (Migration 95). No `@/` imports here: the scripts import this file.
 */

export const CATALOGUE_FORMAT = 'amise-signoff-catalogue/1' as const;
export const BUNDLE_FORMAT = 'amise-signoff-bundle/1' as const;

/** One reviewable item: a numbered "Needs sign-off" line, a table row or a SURGEON-DECISIONS entry. */
export interface CatalogueItem {
  /** '<changelog-slug>#<n>' or 'surgeon-decisions#<A1 | G2.13 | I2.3 …>'. Stable while the number is. */
  id: string;
  /** Change-log slug, or 'surgeon-decisions'. */
  source: string;
  /** The item's own number or label within its source ('3', 'A1', 'G2.13', 'note-1'). */
  number: string;
  /** Subheading the item sits under (e.g. "A. Printed prep sheet"), when there is one. */
  group: string | null;
  /** First line / bold lead, for lists. */
  title: string;
  /** The full item text as written (Markdown). */
  text: string;
  /** First 16 hex digits of SHA-256 over the whitespace-normalised text. A new hash = a changed item. */
  hash: string;
  /** Repository path of the document the item comes from. */
  doc: string;
  /** Heading anchor inside that document. */
  anchor: string;
  /** Registry rule sets (clinical-content/registry.json ids) the item is part of, where identifiable. */
  ruleSetIds: string[];
}

export interface CatalogueSource {
  id: string;
  title: string;
  doc: string;
  anchor: string;
  ruleSetIds: string[];
  itemIds: string[];
}

export interface CatalogueRuleSet {
  id: string;
  title: string;
  reviewPriority: string;
  lastReviewed: string;
  reviewer: string;
  itemIds: string[];
}

export interface SignoffCatalogue {
  format: typeof CATALOGUE_FORMAT;
  /** Hash of every item id + hash, so a decision can say which catalogue the reviewer saw. */
  catalogueHash: string;
  /** Base URL for document links (GitHub blob view of the default branch). */
  repoUrl: string;
  sources: CatalogueSource[];
  ruleSets: CatalogueRuleSet[];
  items: CatalogueItem[];
}

export type SignoffDecision = 'approved' | 'approved_with_amendment' | 'rejected' | 'deferred';
export const SIGNOFF_DECISIONS: readonly SignoffDecision[] = ['approved', 'approved_with_amendment', 'rejected', 'deferred'];

export const DECISION_LABEL: Record<SignoffDecision, string> = {
  approved: 'Approved',
  approved_with_amendment: 'Approved with amendment',
  rejected: 'Rejected',
  deferred: 'Deferred',
};

/** Roles that may record a decision (RLS insert policy, Migration 95). */
export type ReviewerRole = 'doctor' | 'admin';

/** One stored decision (one row of public.clinical_signoffs). */
export interface SignoffRecord {
  id: string | null;
  itemId: string;
  itemHash: string;
  catalogueHash: string | null;
  decision: SignoffDecision;
  amendment: string | null;
  comment: string | null;
  reviewerUserId: string;
  reviewerName: string;
  reviewerRole: string;
  ruleSetIds: string[];
  /** ISO timestamp (server clock). */
  decidedAt: string;
}

/**
 * Current state of an item:
 *   pending   no decision yet
 *   approved  latest decision approved, for the current wording
 *   amended   latest decision approved with an amendment, for the current wording
 *   rejected / deferred  latest decision, for the current wording
 *   changed   the wording changed after the latest decision (any decision): review again
 */
export type ItemStatus = 'pending' | 'approved' | 'amended' | 'rejected' | 'deferred' | 'changed';

export interface ProgressCounts {
  total: number;
  /** approved + amended */
  approved: number;
  amended: number;
  pending: number;
  rejected: number;
  deferred: number;
  changed: number;
}

export interface RuleSetProgress extends ProgressCounts {
  id: string;
  title: string;
  /** Every item approved (or approved with amendment) for its current wording. */
  complete: boolean;
}

export interface SignoffBundle {
  format: typeof BUNDLE_FORMAT;
  exportedAt: string;
  exportedBy: { userId: string | null; name: string; role: string | null } | null;
  catalogueHash: string;
  /** Every decision row (full history): the apply script works out each item's latest. */
  records: SignoffRecord[];
  /** Progress at export time (informational; signoff:apply recomputes it from the docs). */
  ruleSets: RuleSetProgress[];
}
