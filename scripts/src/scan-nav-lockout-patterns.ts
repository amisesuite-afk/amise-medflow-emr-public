/**
 * Advisory (non-blocking) port of emr-review's Category 1 check
 * (.claude/skills/emr-review/SKILL.md): flags newly-added navigation
 * conditionals in the files that have caused real regressions before —
 * {!consultAmbient && ...}, {topSection !== 'consultation' && ...},
 * {!ambientMode && ...}, {zenMode ? ... : ...} — where the conditional can
 * hide an interactive control with no fallback path.
 *
 * Deliberately NOT a hard gate, unlike lint-migration-grants.ts and
 * lint-dx-variant-phases.ts. Whether a flagged conditional actually hides a
 * control with no equivalent elsewhere requires reading the surrounding JSX
 * and judging intent — that's a semantic question a pattern scan can't
 * reliably answer, and a hard gate on an unreliable signal would just teach
 * people to ignore CI. This prints findings for human review (as GitHub
 * Actions warning annotations when run in CI) and always exits 0.
 *
 * Only scans lines *added* by the current branch vs. the base ref — an
 * existing pattern that's been there for months isn't this PR's problem to
 * flag.
 */

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// scripts/src/scan-nav-lockout-patterns.ts -> scripts/src -> scripts -> repo root
const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const BASE_REF = process.env.NAV_LOCKOUT_BASE_REF ?? 'origin/main';

const WATCHED_FILES = [
  'artifacts/dashboard/src/components/NavSidebar.tsx',
  'artifacts/dashboard/src/pages/Home.tsx',
  'artifacts/dashboard/src/pages/tabs/PlanTab.tsx',
  'artifacts/dashboard/src/pages/tabs/AssessmentTab.tsx',
];

const RISKY_PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'consultAmbient conditional', re: /\{\s*!?\s*consultAmbient\s*&&/ },
  { name: "topSection === /!== 'consultation' conditional", re: /\{\s*topSection\s*(?:===|!==)\s*['"]consultation['"]\s*&&/ },
  { name: 'ambientMode conditional', re: /\{\s*!?\s*ambientMode\s*&&/ },
  { name: 'zenMode ternary', re: /\{\s*zenMode\s*\?/ },
];

interface Finding { file: string; line: number; pattern: string; text: string; }

function diffAddedLines(file: string): { line: number; text: string }[] {
  let raw: string;
  try {
    raw = execFileSync('git', ['diff', '--unified=0', `${BASE_REF}...HEAD`, '--', file], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
  } catch (err) {
    console.error(`Could not diff ${file} against ${BASE_REF}:`, err instanceof Error ? err.message : err);
    return [];
  }

  const out: { line: number; text: string }[] = [];
  let currentLine = 0;
  for (const l of raw.split('\n')) {
    const hunk = l.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) { currentLine = parseInt(hunk[1], 10); continue; }
    if (l.startsWith('+++') || l.startsWith('---')) continue;
    if (l.startsWith('+')) {
      out.push({ line: currentLine, text: l.slice(1) });
      currentLine++;
    } else if (!l.startsWith('-')) {
      currentLine++;
    }
  }
  return out;
}

function main() {
  const findings: Finding[] = [];

  for (const file of WATCHED_FILES) {
    for (const { line, text } of diffAddedLines(file)) {
      for (const { name, re } of RISKY_PATTERNS) {
        if (re.test(text)) {
          findings.push({ file, line, pattern: name, text: text.trim() });
        }
      }
    }
  }

  if (findings.length === 0) {
    console.log(`✓ No new navigation-lockout-shaped conditionals added in ${WATCHED_FILES.length} watched file(s) vs. ${BASE_REF}.`);
    return;
  }

  const inActions = !!process.env.GITHUB_ACTIONS;
  console.log(`⚠ ${findings.length} newly-added conditional(s) match a pattern that has caused navigation lockouts before. Not a build failure — review before merging.\n`);
  for (const f of findings) {
    const msg = `Possible nav-lockout pattern (${f.pattern}): does an equivalent control exist in the other branch? — ${f.text}`;
    if (inActions) {
      console.log(`::warning file=${f.file},line=${f.line}::${msg}`);
    } else {
      console.log(`  ${f.file}:${f.line}  [${f.pattern}]\n    ${f.text}`);
    }
  }
  console.log(
    '\nSee .claude/skills/emr-review/SKILL.md Category 1 for what to check: does an interactive ' +
    'control inside this conditional have a reachable equivalent in the other branch?',
  );
  // Advisory only — never fail the build on this signal alone.
  process.exit(0);
}

main();
