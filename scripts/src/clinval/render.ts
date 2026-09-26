/**
 * Clinical validation — markdown rendering shared by run-web.ts (web-latest.md) and report.ts
 * (REPORT.md). Plain text status labels, no emoji.
 */

import { addSummaries, listExpectations } from './grade';
import type { ClinvalResult, ExpectationResult, Platform, ResultSummary, Vignette } from './types';

export function statusLabel(r: ExpectationResult | undefined): string {
  if (!r) return 'not run';
  if (r.status === 'na') return 'n/a';
  if (r.status === 'pass') return r.gapResolved ? (r.knownGap ? 'PASS (gap resolved)' : 'PASS (verify: was unverified)') : 'PASS';
  if (r.knownGap) return 'FAIL (known gap)';
  if (r.unverified) return 'FAIL (unverified)';
  return r.severity === 'critical' ? '**FAIL — BLOCKING**' : 'FAIL';
}

function esc(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

export function summaryTable(rows: { label: string; s: ResultSummary; vignettes: number }[]): string {
  const out = [
    '| Platform | Vignettes | Expectations | Pass | Fail | n/a | Critical fail | Blocking | Known-gap fail | Unverified fail | Gap resolved |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const { label, s, vignettes } of rows) {
    out.push(`| ${label} | ${vignettes} | ${s.total} | ${s.pass} | ${s.fail} | ${s.na} | ${s.criticalFail} | ${s.blocking} | ${s.knownGapFail} | ${s.unverifiedFail} | ${s.gapResolved} |`);
  }
  return out.join('\n');
}

export interface RenderOptions {
  title: string;
  generatedAt: string;
  platforms: Platform[];
  sourcesNote: string[];
  includeOutputs?: boolean;
}

export function renderReport(vignettes: Vignette[], results: ClinvalResult[], opt: RenderOptions): string {
  const byKey = new Map<string, ClinvalResult>();
  for (const r of results) byKey.set(`${r.platform}:${r.vignetteId}`, r);
  const lines: string[] = [];
  lines.push(`# ${opt.title}`, '');
  lines.push(`Generated ${opt.generatedAt}.`, '');
  for (const n of opt.sourcesNote) lines.push(`- ${n}`);
  lines.push('');
  lines.push('Status legend: PASS; FAIL — BLOCKING (critical, not flagged: fails the test run); FAIL (known gap) and',
    'FAIL (unverified) are reported only; "PASS (gap resolved)" means the flag can be removed from the vignette;',
    'n/a = the expectation does not apply to that platform or the engine has no such output.', '');

  lines.push('## Summary', '');
  lines.push(summaryTable(opt.platforms.map(p => {
    const rs = results.filter(r => r.platform === p);
    return { label: p, s: addSummaries(rs.map(r => r.summary)), vignettes: rs.length };
  })), '');

  // Blocking and critical failures first.
  const crit: string[] = [];
  const block: string[] = [];
  for (const r of results) {
    for (const e of r.expectations) {
      if (e.status !== 'fail' || e.severity !== 'critical') continue;
      const line = `- \`${r.vignetteId}\` / **${e.id}** (${r.platform}, ${statusLabel(e).replace(/\*/g, '')}): ${esc(e.detail)}`;
      crit.push(line);
      if (e.blocking) block.push(line);
    }
  }
  lines.push('## Blocking failures', '');
  lines.push(block.length ? block.join('\n') : 'None.', '');
  lines.push('## All critical failures (including known gaps and unverified)', '');
  lines.push(crit.length ? crit.join('\n') : 'None.', '');

  // Per condition, per permutation.
  lines.push('## Results by condition and permutation', '');
  const conditions = [...new Set(vignettes.map(v => v.condition))];
  for (const cond of conditions) {
    lines.push(`### ${cond}`, '');
    const vs = vignettes.filter(v => v.condition === cond)
      .sort((a, b) => (a.permutationOf === null ? -1 : 0) - (b.permutationOf === null ? -1 : 0) || a.id.localeCompare(b.id));
    for (const v of vs) {
      lines.push(`#### \`${v.id}\` — ${v.permutationLabel ?? ''}`, '');
      if (v.summary) lines.push(v.summary, '');
      if (v.permutationOf) lines.push(`Permutation of \`${v.permutationOf}\`.`, '');
      const header = ['Expectation', 'Kind', 'Severity', ...opt.platforms.map(p => p), 'Guideline', 'Proposed fix'];
      lines.push(`| ${header.join(' | ')} |`, `|${header.map(() => '---').join('|')}|`);
      const exps = listExpectations(v).sort((a, b) => (a[1].severity === b[1].severity ? 0 : a[1].severity === 'critical' ? -1 : 1));
      const guide = new Map(v.guideline.map(g => [g.id, g]));
      for (const [kind, exp] of exps) {
        const cells = opt.platforms.map(p => statusLabel(byKey.get(`${p}:${v.id}`)?.expectations.find(e => e.id === exp.id)));
        const refs = (exp.guidelineRefs ?? []).map(id => {
          const g = guide.get(id);
          return g ? `${g.name.split(' — ')[0]} ${g.year}` : id;
        }).join('; ');
        lines.push(`| ${exp.id} | ${kind} | ${exp.severity} | ${cells.join(' | ')} | ${esc(refs)} | ${esc(exp.proposedFix ?? '')} |`);
      }
      lines.push('');
      const details: string[] = [];
      for (const p of opt.platforms) {
        const r = byKey.get(`${p}:${v.id}`);
        for (const e of r?.expectations ?? []) {
          if (e.status === 'fail' || e.gapResolved) details.push(`- **${e.id}** (${p}): ${esc(e.detail)}`);
        }
      }
      if (details.length) lines.push('Failure details:', '', ...details, '');
      lines.push('Guidelines:', '');
      for (const g of v.guideline) {
        lines.push(`- **${g.id}** — ${g.name} (${g.year}), ${g.section}.${g.citation ? ` ${g.citation}` : ''}${g.verified ? '' : ' *(statement wording/numbering not yet verified against the source)*'}`);
      }
      lines.push('');
      if (opt.includeOutputs) {
        for (const p of opt.platforms) {
          const r = byKey.get(`${p}:${v.id}`);
          if (!r) continue;
          lines.push('<details><summary>' + `${p} engine outputs` + '</summary>', '');
          if (r.outputs.engineInfo) {
            lines.push(`- engine: ${Object.entries(r.outputs.engineInfo).map(([k, x]) => `${k}=${x}`).join('; ')}`);
          }
          for (const [src, list] of Object.entries(r.outputs.differentials)) {
            lines.push(`- differential ${src}: ${list.map(d => `${d.rank}. ${d.name}`).join('; ') || '(empty)'}`);
          }
          if (r.outputs.emergencyLevel) lines.push(`- emergency level: ${r.outputs.emergencyLevel.level} (${r.outputs.emergencyLevel.raw})`);
          lines.push(`- alarms: ${r.outputs.alarms.map(a => `${a.title} [${a.source}]`).join('; ') || '(none)'}`);
          lines.push(`- recommended scores: ${[...new Set(r.outputs.recommendedScores.map(s => s.score))].join(', ') || '(none)'}`);
          lines.push(`- score values: ${r.outputs.scoreValues.map(s => `${s.score}/${s.mode}@${s.source}=${s.value}`).join('; ') || '(none)'}`);
          if (r.outputs.dxVariant) lines.push(`- dx variant: ${r.outputs.dxVariant.value ?? '(none)'} (${r.outputs.dxVariant.group ?? 'no group'})`);
          if (r.outputs.pathway) lines.push(`- pathway: ${r.outputs.pathway.value}`);
          for (const n of r.outputs.notes) lines.push(`- note: ${esc(n)}`);
          lines.push('', '</details>', '');
        }
      }
    }
  }

  // Gap register.
  lines.push('## Gap register (known gaps and unverified expectations that failed)', '');
  const gaps: string[] = [];
  for (const r of results) {
    for (const e of r.expectations) {
      if (e.status === 'fail' && (e.knownGap || e.unverified)) {
        gaps.push(`| \`${r.vignetteId}\` | ${e.id} | ${r.platform} | ${e.severity} | ${e.knownGap ? 'known gap' : 'unverified'} | ${esc(e.detail).slice(0, 240)} |`);
      }
    }
  }
  if (gaps.length) {
    lines.push('| Vignette | Expectation | Platform | Severity | Flag | Detail |', '|---|---|---|---|---|---|', ...gaps, '');
  } else lines.push('None.', '');
  return lines.join('\n');
}
