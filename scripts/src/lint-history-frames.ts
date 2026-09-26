/**
 * lint:history-frames — the history structure matches the chief complaint on both platforms.
 * See history-frames-audit.ts for the checks and
 * docs/clinical-validation/changes/history-by-complaint.md for the frames.
 *
 *   pnpm --filter @workspace/scripts run lint:history-frames            # check (exit 1 on a problem)
 *   pnpm --filter @workspace/scripts run lint:history-frames -- --chips # chip → engine feature table (markdown)
 *   pnpm --filter @workspace/scripts run lint:history-frames -- --vectors # current choice per complaint (JSON)
 */

import { classifyComplaint } from '../../lib/triage-engine/src/history-frames/index';
import { corpus } from './history-frames-corpus';
import { runAudit } from './history-frames-audit';

const args = new Set(process.argv.slice(2));

if (args.has('--vectors')) {
  const vectors = corpus().map(e => {
    const c = classifyComplaint(e.complaint, e.system);
    return { complaint: e.complaint, ...(e.system ? { system: e.system } : {}), source: e.source, expectedFrame: c.frameId,
      ...(c.secondary.length ? { secondary: c.secondary } : {}) };
  });
  console.log(JSON.stringify(vectors, null, 2));
  process.exit(0);
}

const { problems, chips } = runAudit();

if (args.has('--chips')) {
  console.log('| Frame | Question | Chip | iOS (key = value → feature) | Web (PANE) |');
  console.log('|---|---|---|---|---|');
  for (const c of chips) {
    const ios = c.ios.length
      ? `${c.iosKey} = ${c.iosValue} → ${[...new Set(c.ios.map(h => `${h.key}: ${h.value}`))].slice(0, 3).join('; ')}`
      : 'record only';
    const web = c.web.length ? c.web.join(', ') : 'record only';
    console.log(`| ${c.frame} | ${c.dim} | ${c.label} | ${ios} | ${web} |`);
  }
  process.exit(0);
}

const iosMapped = chips.filter(c => c.ios.length).length;
const webMapped = chips.filter(c => c.web.length).length;
console.log(`History frames: ${chips.length} chips; iOS engine-mapped ${iosMapped}, web engine-mapped ${webMapped}; `
  + `record only: iOS ${chips.length - iosMapped}, web ${chips.length - webMapped}.`);

if (problems.length) {
  const byCheck = new Map<string, number>();
  for (const p of problems) byCheck.set(p.check, (byCheck.get(p.check) ?? 0) + 1);
  for (const p of problems) console.error(`✗ [${p.check}] ${p.where}: ${p.detail}`);
  console.error(`\n${problems.length} problem(s): ${[...byCheck].map(([k, n]) => `${k} ${n}`).join(', ')}`);
  process.exit(1);
}
console.log('✓ lint:history-frames — every complaint gets the right frame; every chip maps or is record only.');
