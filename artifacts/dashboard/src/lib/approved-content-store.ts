/**
 * Approved-content channel on the dashboard — the in-memory register of which copy of each
 * channel-enabled shared rule file is in force (docs/APPROVED-CONTENT-CHANNEL.md).
 *
 * Deliberately dependency-free (no Supabase, no workspace imports): pure modules such as
 * supplement-catalogue.ts read it, and they are also imported by the repository scripts and tests,
 * where nothing is ever set here, so they always see the bundled content. The loader
 * (approved-content.ts) fetches and verifies releases and calls `setApprovedContent`.
 *
 * Consumers keep their synchronous imports and ask here at call time:
 *   activeBody(contentId)  → the verified release body, or null (use the bundled copy)
 * so nothing changes until a verified release is loaded, and a failure anywhere leaves the bundled
 * content in force. In memory only: no localStorage key (lib/phi-storage.ts unchanged; this is
 * clinical content, not patient data).
 */

/** What the loader verified for one file (a subset of the triage-engine selection). */
export interface ActiveContent {
  contentId: string;
  /** Rules file name (clinical-content/rules/<file>.json). */
  file: string;
  source: 'bundled' | 'release';
  version: string;
  bundledVersion: string;
  /** The release body when source is 'release'. */
  body: Record<string, unknown> | null;
  release: { id: string | null; version: string; sha256: string; publishedAt: string | null; signoffRef: string | null } | null;
  /** Releases that were refused, newest first (reason codes only). */
  rejected: { version: string; reason: string; detail: string | null }[];
}

const active = new Map<string, ActiveContent>();
const listeners = new Set<() => void>();
let revision = 0;

/** Replaces the register (called by the loader after each fetch). */
export function setApprovedContent(list: ActiveContent[]): void {
  active.clear();
  for (const a of list) active.set(a.contentId, a);
  revision++;
  for (const l of listeners) l();
}

/** The verified release body in force for a content id, or null when the bundled copy is. */
export function activeBody(contentId: string): Record<string, unknown> | null {
  const a = active.get(contentId);
  return a && a.source === 'release' ? a.body : null;
}

/** Version in force (the release's, or `bundledVersion`). */
export function activeVersion(contentId: string, bundledVersion: string): string {
  const a = active.get(contentId);
  return a && a.source === 'release' ? a.version : bundledVersion;
}

export function approvedContentState(): ActiveContent[] {
  return [...active.values()];
}

/** Increases whenever the register changes: add it to a useMemo's dependencies. */
export function approvedContentRevision(): number {
  return revision;
}

export function subscribeApprovedContent(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Test-only. */
export function _resetApprovedContent(): void {
  active.clear();
  revision++;
}
