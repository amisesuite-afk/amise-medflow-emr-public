/**
 * Guideline registry lint: every clinical rule set is registered, and the registry points at
 * real files.
 *
 * Reads clinical-content/registry.json (design: docs/CLINICAL-CONTENT-UPGRADES.md; inventory:
 * docs/CLINICAL-CONTENT-INVENTORY.md).
 *
 * FAILS (exit 1) when:
 *   - the registry is malformed (missing or mistyped field, duplicate id, bad date or version);
 *   - a registry entry's file or test path (a `*` is allowed in the last path segment) matches
 *     no file;
 *   - a known rule-set file (KNOWN_RULE_SET_FILES below, taken from the inventory) is not
 *     covered by any registry entry, or a known pattern no longer matches any file;
 *   - an entry's versionStamp does not read the entry's contentVersion from its file (for
 *     example DiagnosticDatabase.json "version" or RULES_VERSION in rules.ts);
 *   - DiagnosticDatabase.json would not decode with the iOS engine's Codable structs (the iOS
 *     differential would then silently use its built-in fallback lists), or breaks a 2.0.0
 *     content rule (presentations / supersedes naming unknown candidates, a curated feature
 *     without a citation or whose logLR disagrees with its likelihood ratio). Checks:
 *     diagnostic-database-schema.ts.
 *
 * WARNS (never fails) with a review-due list when:
 *   - lastReviewed is "unknown" (no documented clinical review), or nextReviewDue is "unknown"
 *     or has passed (today in America/St_Lucia; override with REGISTRY_TODAY=YYYY-MM-DD);
 *   - a file that looks like clinical content (ADVISORY_SCAN below) is neither registered nor
 *     listed under "excluded" with a reason.
 *
 * Health-information library (artifacts/front-desk/content/health-info.ts, per-article review
 * metadata; checks in content/health-info-governance.ts, also run by the front-desk vitest):
 *   FAILS when an APPROVED article lacks lastReviewed, reviewedBy, reviewDue or sources (or has
 *     a malformed field, a duplicate slug, or urgent-care text without 911 and the emergency
 *     departments); WARNS when an approved article is past (or within 30 days of) reviewDue.
 *
 * Adding a rule set: add it to the inventory, to KNOWN_RULE_SET_FILES and to the registry in
 * the same PR.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEALTH_ARTICLES } from '../../artifacts/front-desk/content/health-info';
import { auditHealthLibrary } from '../../artifacts/front-desk/content/health-info-governance';
import { contentProblems, decodeProblems } from './diagnostic-database-schema';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const REGISTRY_FILE = 'clinical-content/registry.json';

// ── Known rule-set files (docs/CLINICAL-CONTENT-INVENTORY.md) ──────────────────────────────
// Every file these patterns match must be covered by a registry entry.

const KNOWN_RULE_SET_FILES: string[] = [
  // iOS — Bayesian differential
  'ios/AmiseMedFlow/Resources/DiagnosticDatabase.json',
  'ios/AmiseMedFlow/Services/BayesianDiagnosisEngine*.swift',
  'ios/AmiseMedFlow/Services/BayesianDecisionEngine*.swift',
  'ios/AmiseMedFlow/Services/BayesianFeatureNetwork.swift',
  'ios/AmiseMedFlow/Services/BayesianSensorFusion.swift',
  'ios/AmiseMedFlow/Services/SequentialDiagnosisEngine*.swift',
  'ios/AmiseMedFlow/Services/DynamicBayesianNetwork*.swift',
  'ios/AmiseMedFlow/Services/ValueOfInformationEngine.swift',
  'ios/AmiseMedFlow/Services/ClinicalChangePointDetector.swift',
  'ios/AmiseMedFlow/Services/AutoFunctionEngine*.swift',
  'ios/AmiseMedFlow/Services/ClinicalPipelineOrchestrator*.swift',
  'ios/AmiseMedFlow/Services/ClinicalPathwayEngine.swift',
  'ios/AmiseMedFlow/Services/SurgicalAlgorithmEngine.swift',
  'ios/AmiseMedFlow/Services/EncounterQuestionnaire.swift',
  'ios/AmiseMedFlow/Services/ClinicalTextParser.swift',
  'ios/AmiseMedFlow/Views/Consultation/ConsultationViewChipData.swift',
  'ios/AmiseMedFlow/Views/Consultation/ConsultationViewEarlyForms.swift',
  // History frames (complaint -> history questions; web + iOS twins)
  'lib/triage-engine/src/history-frames/*.ts',
  'ios/AmiseMedFlow/Services/HistoryFrames.swift',
  'ios/AmiseMedFlow/Services/HistoryFrameData.swift',
  'ios/AmiseMedFlow/Views/Consultation/ConsultationView+HistoryFrame.swift',
  'artifacts/dashboard/src/lib/hpi-fields.ts',
  // iOS — scores, NEWS2, pathways, risk, screening
  'ios/AmiseMedFlow/Services/ClinicalScoringEngine*.swift',
  'ios/AmiseMedFlow/Services/PatientScoreAutoPopulator*.swift',
  'ios/AmiseMedFlow/Services/NEWS2Chart.swift',
  'ios/AmiseMedFlow/Services/ConsultPathway*.swift',
  'ios/AmiseMedFlow/Services/VisitRiskAssessment.swift',
  'ios/AmiseMedFlow/Views/Consultation/PathwayData.swift',
  'ios/AmiseMedFlow/Services/SuspectedCancerScreening*.swift',
  // iOS — medicines, bowel prep
  'ios/AmiseMedFlow/Services/DrugInteractionService.swift',
  'ios/AmiseMedFlow/Services/DrugClasses.swift',
  'ios/AmiseMedFlow/Services/SupplementCatalogue.swift',
  'ios/AmiseMedFlow/Services/SupplementAlerts.swift',
  'ios/AmiseMedFlow/Services/SurgicalDrug*.swift',
  'ios/AmiseMedFlow/Services/CustomDrugStore.swift',
  'ios/AmiseMedFlow/Services/DiagnosisDosingGuide.swift',
  'ios/AmiseMedFlow/Services/BowelPrepProtocols*.swift',
  // iOS — diagnosis radiation, mappers, management, risk, templates, lab catalogue
  'ios/AmiseMedFlow/Services/DiagnosisScoreMapper*.swift',
  'ios/AmiseMedFlow/Services/DiagnosisRadiationEngine*.swift',
  'ios/AmiseMedFlow/Services/PlanSafetyFilter*.swift',
  'ios/AmiseMedFlow/Services/ClinicalAcuityEngine*.swift',
  'ios/AmiseMedFlow/Services/PregnancyContext.swift',
  'ios/AmiseMedFlow/Services/SurgicalVademecum*.swift',
  'ios/AmiseMedFlow/Services/ManagementEngine*.swift',
  'ios/AmiseMedFlow/Services/SurgicalRiskEngine*.swift',
  'ios/AmiseMedFlow/Services/ProcedureTemplate*.swift',
  'ios/AmiseMedFlow/Services/LabAnalyteCatalog.swift',
  'ios/AmiseMedFlow/Services/LifestylePractices*.swift',
  // Shared triage engine
  'lib/triage-engine/src/news2.ts',
  'lib/triage-engine/src/rules.ts',
  'lib/triage-engine/src/apcq.ts',
  'lib/triage-engine/src/adaptive-triage.ts',
  'lib/triage-engine/src/emergency-recognition.ts',
  'lib/triage-engine/src/cancer-screening.ts',
  'lib/triage-engine/src/screening/preventive.ts',
  'artifacts/dashboard/src/lib/preventive-screening-prompts.ts',
  'lib/triage-engine/src/pathways.ts',
  'lib/triage-engine/src/pathway-matcher.ts',
  'lib/triage-engine/src/surgical-dictionary.ts',
  'lib/triage-engine/src/condition-codes.ts',
  'lib/triage-engine/src/surgical-catalog.ts',
  'lib/triage-engine/src/formulary.ts',
  'lib/triage-engine/src/report-import/catalog.ts',
  'lib/triage-engine/src/reference-ranges.ts',
  'ios/AmiseMedFlow/Services/LabReferenceRanges.swift',
  'artifacts/api-server/src/lib/lab-feed/loinc.ts',
  'lib/triage-engine/src/lifestyle-practices.ts',
  'lib/triage-engine/src/lifestyle-questions.ts',
  // Diagnostic reasoning layer (web + iOS twins)
  'lib/triage-engine/src/diagnostic-reasoning/*.ts',
  'artifacts/dashboard/src/lib/diagnostic-reasoning.ts',
  'artifacts/dashboard/src/lib/diagnosis-families.ts',
  'clinical-content/rules/*.json',
  'ios/AmiseMedFlow/Services/ZebraCheck.swift',
  'ios/AmiseMedFlow/Services/DiagnosticReasoning*.swift',
  'ios/AmiseMedFlow/Services/LongitudinalPatterns.swift',
  // Pane engine
  'lib/pane-engine/src/vademecum/*.ts',
  'lib/pane-engine/src/vademecum/specialties/*.ts',
  'lib/pane-engine/src/engine/*.ts',
  'lib/pane-engine/src/constants.ts',
  'lib/pane-engine/src/management/protocols/*.ts',
  'lib/pane-engine/src/management/index.ts',
  'lib/pane-engine/src/management/types.ts',
  'lib/pane-engine/src/management/planSafety.ts',
  'artifacts/dashboard/src/lib/plan-builder.ts',
  // Decision support (score / result actions, treatment thresholds) — web and iOS twins
  'lib/pane-engine/src/decision/*.ts',
  'lib/pane-engine/src/decision/treatment-decisions.json',
  'ios/AmiseMedFlow/Resources/TreatmentDecisions.json',
  'ios/AmiseMedFlow/Services/TreatmentDecisionContent.swift',
  'ios/AmiseMedFlow/Services/DecisionSupportPatient.swift',
  'artifacts/dashboard/src/lib/decision-support.ts',
  // What's missing strip and score auto-fill from the record — web and iOS twins
  'lib/pane-engine/src/whats-missing/*.ts',
  'lib/pane-engine/src/whats-missing/whats-missing-rules.json',
  'ios/AmiseMedFlow/Resources/WhatsMissingRules.json',
  'ios/AmiseMedFlow/Services/WhatsMissing*.swift',
  'ios/AmiseMedFlow/Services/PatientScoreAutoPopulator+RecordFill.swift',
  'artifacts/dashboard/src/lib/whats-missing-web.ts',
  // Evidence-based examination signs and decision-rule bands (evidence-exam) — web and iOS
  'clinical-content/rules/exam-signs.json',
  'clinical-content/rules/decision-rules.json',
  'lib/pane-engine/src/evidence/*.ts',
  'ios/AmiseMedFlow/Services/ExamEvidenceCatalogue.swift',
  'ios/AmiseMedFlow/Services/ExamSignRecord.swift',
  'ios/AmiseMedFlow/Services/DecisionRuleEvidence.swift',
  'artifacts/dashboard/src/lib/exam-evidence-features.ts',
  'artifacts/dashboard/src/lib/decision-rule-scores.ts',
  // Dashboard
  'artifacts/dashboard/src/lib/drug-interactions.ts',
  'artifacts/dashboard/src/lib/drug-classes.ts',
  'artifacts/dashboard/src/lib/supplement-catalogue.ts',
  'artifacts/dashboard/src/lib/supplement-prompts.ts',
  'artifacts/dashboard/src/lib/prescription-formulary.ts',
  'artifacts/dashboard/src/lib/dx-variants.ts',
  'artifacts/dashboard/src/lib/clinical-scales.ts',
  'artifacts/dashboard/src/lib/clinical-scores.ts',
  'artifacts/dashboard/src/lib/tg18-autofill.ts',
  'artifacts/dashboard/src/lib/clinical-cds.ts',
  'artifacts/dashboard/src/lib/clinical-inference.ts',
  'artifacts/dashboard/src/lib/symptom-inference.ts',
  'artifacts/dashboard/src/lib/clinical-pathways.ts',
  'artifacts/dashboard/src/lib/transcript-dx-mapper.ts',
  'artifacts/dashboard/src/lib/socrates-to-features.ts',
  'artifacts/dashboard/src/lib/record-text-match.ts',
  'artifacts/dashboard/src/lib/vitals-news2-fields.ts',
  'artifacts/dashboard/src/pages/tabs/DosingTab.tsx',
  'artifacts/dashboard/src/pages/tabs/BookingInboxTab.tsx',
  // Patient-facing text and the outbound safety filter
  'artifacts/api-server/src/lib/sms.ts',
  'artifacts/api-server/src/lib/outbound.ts',
  'artifacts/front-desk/lib/instructions.ts',
  'artifacts/front-desk/content/health-info.ts',
  // Database-seeded guideline summaries
  'supabase-clinical-guidelines-migration.sql',
];

// ── Advisory scan: files that look like clinical content ───────────────────────────────────
// Warned about (not failed) when neither registered nor listed under "excluded".

const ADVISORY_SCAN: { dir: string; name: RegExp }[] = [
  {
    dir: 'ios/AmiseMedFlow/Services',
    name: /(Engine|Scoring|Formulary|Protocol|Vademecum|Guide|Catalog|Rules|Chart|Pathway|Risk|Interaction|Classes|Template|Mapper|Network|Bayesian|Screening|Questionnaire|Parser|Detector|Fusion|Orchestrator|Drug)[^/]*\.swift$/,
  },
  { dir: 'lib/triage-engine/src', name: /\.ts$/ },
  { dir: 'lib/pane-engine/src/vademecum/specialties', name: /\.ts$/ },
  { dir: 'lib/pane-engine/src/management/protocols', name: /\.ts$/ },
  {
    dir: 'artifacts/dashboard/src/lib',
    name: /^(clinical-|drug-|dx-|news2|.*formulary|.*triage|.*red-flag|.*screening|.*dosing|.*prep).*\.ts$/,
  },
];
const ADVISORY_IGNORE = new Set(['lib/triage-engine/src/index.ts']);

// ── Registry shape ──────────────────────────────────────────────────────────────────────────

interface GuidelineRef { name: string; version: string; section: string; citation: string }
interface VersionStamp { file: string; type: 'json-key' | 'regex'; key?: string; pattern?: string }
interface RuleSet {
  id: string;
  title: string;
  platforms: string[];
  kind: string;
  contentVersion: string;
  versionStamp?: VersionStamp;
  files: string[];
  tests: string[];
  ciChecks: string[];
  guidelines: GuidelineRef[];
  citationStatus: string;
  lastReviewed: string;
  reviewer: string;
  reviewEvidence: string;
  reviewPriority: string;
  nextReviewDue: string;
  changeAuthority: string;
  notes?: string;
}
interface Registry {
  registryVersion: string;
  updated: string;
  ruleSets: RuleSet[];
  excluded?: { path: string; reason: string }[];
}

const CITATION_STATUS = new Set(['per-rule', 'per-rule-partial', 'file-header', 'partial', 'none']);
const PRIORITIES = new Set(['P1', 'P2', 'P3']);
const PLATFORMS = new Set(['ios', 'web', 'api', 'front-desk', 'database']);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SEMVER = /^\d+\.\d+\.\d+$/;

const failures: string[] = [];
const warnings: string[] = [];
const fail = (msg: string) => failures.push(msg);
const warn = (msg: string) => warnings.push(msg);

// ── Helpers ─────────────────────────────────────────────────────────────────────────────────

/** Expands a repo-relative path; a `*` is allowed in the last segment only. */
function expand(pattern: string): string[] {
  const dir = dirname(pattern);
  const base = pattern.slice(dir.length + 1);
  if (dir.includes('*')) throw new Error(`"${pattern}": a * is allowed in the last path segment only`);
  if (!base.includes('*')) return existsSync(join(REPO_ROOT, pattern)) ? [pattern] : [];
  const absDir = join(REPO_ROOT, dir);
  if (!existsSync(absDir) || !statSync(absDir).isDirectory()) return [];
  const re = new RegExp('^' + base.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
  return readdirSync(absDir)
    .filter(name => re.test(name) && statSync(join(absDir, name)).isFile())
    .map(name => `${dir}/${name}`)
    .sort();
}

function isValidDate(s: string): boolean {
  if (!DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function todayInStLucia(): string {
  const override = process.env.REGISTRY_TODAY;
  if (override) {
    if (!isValidDate(override)) throw new Error(`REGISTRY_TODAY must be YYYY-MM-DD, got "${override}"`);
    return override;
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/St_Lucia', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const isStrArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);

// ── 1. Registry structure ─────────────────────────────────────────────────────────────────

function loadRegistry(): Registry | null {
  const abs = join(REPO_ROOT, REGISTRY_FILE);
  if (!existsSync(abs)) { fail(`${REGISTRY_FILE} is missing`); return null; }
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(abs, 'utf8')); } catch (e) {
    fail(`${REGISTRY_FILE} is not valid JSON: ${(e as Error).message}`);
    return null;
  }
  const reg = raw as Registry;
  if (!isStr(reg.registryVersion) || !SEMVER.test(reg.registryVersion)) fail('registryVersion must be a semantic version (x.y.z)');
  if (!isStr(reg.updated) || !isValidDate(reg.updated)) fail('updated must be a YYYY-MM-DD date');
  if (!Array.isArray(reg.ruleSets) || reg.ruleSets.length === 0) { fail('ruleSets must be a non-empty array'); return null; }
  if (reg.excluded !== undefined && !(Array.isArray(reg.excluded)
      && reg.excluded.every(e => isStr(e?.path) && isStr(e?.reason) && e.reason.trim() !== ''))) {
    fail('excluded must be an array of { path, reason } with a non-empty reason');
  }
  return reg;
}

function checkEntryShape(rs: RuleSet, index: number, seen: Set<string>): boolean {
  const where = `ruleSets[${index}]${isStr(rs?.id) ? ` (${rs.id})` : ''}`;
  const before = failures.length;
  if (!isStr(rs.id) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(rs.id)) fail(`${where}: id must be kebab-case`);
  else if (seen.has(rs.id)) fail(`${where}: duplicate id`);
  else seen.add(rs.id);
  for (const k of ['title', 'kind', 'reviewer', 'reviewEvidence', 'changeAuthority'] as const) {
    if (!isStr(rs[k]) || rs[k].trim() === '') fail(`${where}: ${k} must be a non-empty string`);
  }
  if (!isStrArray(rs.platforms) || rs.platforms.length === 0 || !rs.platforms.every(p => PLATFORMS.has(p))) {
    fail(`${where}: platforms must be a non-empty subset of ${[...PLATFORMS].join(', ')}`);
  }
  if (!isStr(rs.contentVersion) || !(rs.contentVersion === 'unversioned' || SEMVER.test(rs.contentVersion))) {
    fail(`${where}: contentVersion must be "unversioned" or x.y.z`);
  }
  if (!isStrArray(rs.files) || rs.files.length === 0) fail(`${where}: files must be a non-empty array of paths`);
  if (!isStrArray(rs.tests)) fail(`${where}: tests must be an array of paths`);
  if (!isStrArray(rs.ciChecks)) fail(`${where}: ciChecks must be an array of strings`);
  if (!Array.isArray(rs.guidelines) || !rs.guidelines.every(g =>
    isStr(g?.name) && isStr(g?.version) && isStr(g?.section) && isStr(g?.citation))) {
    fail(`${where}: guidelines must be an array of { name, version, section, citation }`);
  }
  if (!CITATION_STATUS.has(rs.citationStatus)) fail(`${where}: citationStatus must be one of ${[...CITATION_STATUS].join(', ')}`);
  if (!PRIORITIES.has(rs.reviewPriority)) fail(`${where}: reviewPriority must be P1, P2 or P3`);
  for (const k of ['lastReviewed', 'nextReviewDue'] as const) {
    if (!isStr(rs[k]) || !(rs[k] === 'unknown' || isValidDate(rs[k]))) fail(`${where}: ${k} must be YYYY-MM-DD or "unknown"`);
  }
  if (isValidDate(rs.lastReviewed) && isValidDate(rs.nextReviewDue) && rs.nextReviewDue < rs.lastReviewed) {
    fail(`${where}: nextReviewDue is before lastReviewed`);
  }
  if (isValidDate(rs.lastReviewed) && rs.reviewer === 'unknown') {
    fail(`${where}: a dated review must name the reviewer`);
  }
  if (rs.contentVersion === 'unversioned' && rs.versionStamp) {
    fail(`${where}: versionStamp given but contentVersion is "unversioned"`);
  }
  return failures.length === before;
}

// ── 2. Files, tests and version stamps ────────────────────────────────────────────────────

function expandOrFail(where: string, what: string, pattern: string): string[] {
  try {
    const hits = expand(pattern);
    if (hits.length === 0) fail(`${where}: ${what} "${pattern}" matches no file`);
    return hits;
  } catch (e) {
    fail(`${where}: ${(e as Error).message}`);
    return [];
  }
}

function readStamp(stamp: VersionStamp): string | null {
  const abs = join(REPO_ROOT, stamp.file);
  if (!existsSync(abs)) return null;
  const text = readFileSync(abs, 'utf8');
  if (stamp.type === 'json-key' && stamp.key) {
    try {
      const v = (JSON.parse(text) as Record<string, unknown>)[stamp.key];
      return isStr(v) ? v : null;
    } catch { return null; }
  }
  if (stamp.type === 'regex' && stamp.pattern) {
    const m = new RegExp(stamp.pattern).exec(text);
    return m?.[1] ?? null;
  }
  return null;
}

// ── 3. DiagnosticDatabase.json vs the iOS Codable structs ─────────────────────────────────
// Swift's JSONDecoder rejects the whole file on the first mismatch, and the engine's `try?`
// turns that into "no database" (fallback lists). The mirror of the structs and the 2.0.0
// content rules live in diagnostic-database-schema.ts (unit-tested there).

const DIAGNOSTIC_DB = 'ios/AmiseMedFlow/Resources/DiagnosticDatabase.json';

function checkDiagnosticDatabaseDecodes(): void {
  const abs = join(REPO_ROOT, DIAGNOSTIC_DB);
  if (!existsSync(abs)) return; // the registry file check reports it
  const raw = readFileSync(abs, 'utf8');
  let db: Record<string, unknown>;
  try { db = JSON.parse(raw) as Record<string, unknown>; } catch (e) {
    fail(`${DIAGNOSTIC_DB} is not valid JSON: ${(e as Error).message}`);
    return;
  }
  const problems = decodeProblems(db, raw);
  if (problems.length > 0) {
    const lines = problems.map(p => `      ${p.count} × ${p.kind} (e.g. ${p.example})`);
    fail(`${DIAGNOSTIC_DB} would NOT decode with the iOS engine's Codable structs, so the iOS `
      + `differential would use its built-in fallback lists (Settings → Diagnostics):\n${lines.join('\n')}`);
    return;
  }
  for (const p of contentProblems(db)) fail(`${DIAGNOSTIC_DB}: ${p}`);
}

// ── Main ────────────────────────────────────────────────────────────────────────────────────

function main(): void {
  const today = todayInStLucia();
  const reg = loadRegistry();
  const covered = new Set<string>();
  const due: { id: string; priority: string; next: string; last: string; reason: string }[] = [];

  if (reg) {
    const seen = new Set<string>();
    reg.ruleSets.forEach((rs, i) => {
      const shapeOk = checkEntryShape(rs, i, seen);
      const where = isStr(rs?.id) ? rs.id : `ruleSets[${i}]`;
      // Count coverage even for a malformed entry, so one bad field does not cascade into
      // "not registered" failures for all of its files.
      if (isStrArray(rs?.files)) for (const p of rs.files) expandOrFail(where, 'file', p).forEach(f => covered.add(f));
      if (!shapeOk) return;
      for (const p of rs.tests) expandOrFail(where, 'test', p);
      if (rs.versionStamp) {
        const found = readStamp(rs.versionStamp);
        if (found === null) fail(`${where}: could not read the version stamp from ${rs.versionStamp.file}`);
        else if (found !== rs.contentVersion) {
          fail(`${where}: ${rs.versionStamp.file} says version ${found} but the registry says ${rs.contentVersion} — bump both together and add a changelog entry`);
        }
      }
      const reasons: string[] = [];
      if (rs.lastReviewed === 'unknown') reasons.push('no documented clinical review');
      if (rs.nextReviewDue === 'unknown') reasons.push('no review date set');
      else if (rs.nextReviewDue < today) reasons.push(`review overdue since ${rs.nextReviewDue}`);
      if (reasons.length) {
        due.push({ id: rs.id, priority: rs.reviewPriority, next: rs.nextReviewDue, last: rs.lastReviewed, reason: reasons.join('; ') });
      }
    });

    // Known rule-set files must be registered.
    for (const pattern of KNOWN_RULE_SET_FILES) {
      const hits = expand(pattern);
      if (hits.length === 0) {
        fail(`inventory pattern "${pattern}" matches no file — update KNOWN_RULE_SET_FILES, the registry and the inventory`);
      }
      for (const f of hits) {
        if (!covered.has(f)) fail(`${f} is a known clinical rule-set file but no registry entry covers it — add it to ${REGISTRY_FILE}`);
      }
    }

    // Advisory: unregistered files that look like clinical content.
    const excluded = new Set((reg.excluded ?? []).map(e => e.path));
    for (const e of reg.excluded ?? []) {
      if (!existsSync(join(REPO_ROOT, e.path))) warn(`excluded path ${e.path} no longer exists — remove it from ${REGISTRY_FILE}`);
    }
    const unregistered: string[] = [];
    for (const { dir, name } of ADVISORY_SCAN) {
      const absDir = join(REPO_ROOT, dir);
      if (!existsSync(absDir)) continue;
      for (const f of readdirSync(absDir)) {
        const rel = `${dir}/${f}`;
        if (!name.test(f) || !statSync(join(absDir, f)).isFile()) continue;
        if (!covered.has(rel) && !excluded.has(rel) && !ADVISORY_IGNORE.has(rel)) unregistered.push(rel);
      }
    }
    if (unregistered.length) {
      warn(`files that look like clinical content are neither registered nor excluded (register them, or add them to "excluded" with a reason):\n${unregistered.map(f => `      ${f}`).join('\n')}`);
    }
  }

  checkDiagnosticDatabaseDecodes();

  // Health-information library: per-article review governance.
  const library = auditHealthLibrary(HEALTH_ARTICLES, today);
  library.failures.forEach(fail);
  library.warnings.forEach(warn);
  const approved = HEALTH_ARTICLES.filter(a => a.status === 'approved').length;
  console.log(`Health-information library: ${HEALTH_ARTICLES.length} articles, ${approved} approved and public, ${HEALTH_ARTICLES.length - approved} draft.`);

  // ── Report ──
  const total = reg?.ruleSets.length ?? 0;
  console.log(`Guideline registry: ${total} rule sets, ${covered.size} files covered (today ${today}, America/St_Lucia).`);

  if (due.length) {
    due.sort((a, b) => (a.next === b.next ? a.priority.localeCompare(b.priority) || a.id.localeCompare(b.id)
      : a.next === 'unknown' ? -1 : b.next === 'unknown' ? 1 : a.next.localeCompare(b.next)));
    const w = Math.max(...due.map(d => d.id.length));
    console.warn(`\nWARNING: ${due.length} of ${total} rule sets need a clinical review (review-due list):`);
    console.warn(`  ${'rule set'.padEnd(w)}  prio  next due     last reviewed  reason`);
    for (const d of due) {
      console.warn(`  ${d.id.padEnd(w)}  ${d.priority}    ${d.next.padEnd(11)}  ${d.last.padEnd(13)}  ${d.reason}`);
    }
  }
  for (const w of warnings) console.warn(`\nWARNING: ${w}`);
  if (process.env.GITHUB_ACTIONS && (due.length || warnings.length)) {
    console.log(`::warning title=Guideline registry::${due.length} rule set(s) need a clinical review; ${warnings.length} other warning(s). See the lint output.`);
  }

  if (failures.length) {
    console.error(`\nFAILED: ${failures.length} problem(s):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log('\nOK: every registry path exists, every known rule-set file is registered, version stamps match.');
}

main();
