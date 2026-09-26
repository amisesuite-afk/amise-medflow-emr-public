import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dedupePlanAgainstOrders } from '@/lib/plan-dedupe';

describe('printed plan: no repeat of investigations requested above (UX review M12)', () => {
  it('leaves out only whole lines that are exactly an ordered item', () => {
    const plan = ['1. FBC', '- LFTs.', 'LFTs and CRP tomorrow', 'Analgesia', '', 'Ultrasound — Abdomen'].join('\n');
    const r = dedupePlanAgainstOrders(plan, ['FBC', 'LFTs', 'Ultrasound — Abdomen']);
    expect(r.removed).toBe(3);
    expect(r.plan).toBe(['LFTs and CRP tomorrow', 'Analgesia', ''].join('\n'));
  });

  it('changes nothing when nothing is ordered or nothing repeats', () => {
    expect(dedupePlanAgainstOrders('FBC', [])).toEqual({ plan: 'FBC', removed: 0 });
    expect(dedupePlanAgainstOrders('Review in clinic', ['FBC'])).toEqual({ plan: 'Review in clinic', removed: 0 });
  });

  it('the summary no longer prints the "may overlap" banner', () => {
    const src = readFileSync(join(__dirname, '..', '..', 'pages', 'tabs', 'SummaryTab.tsx'), 'utf8');
    expect(src).not.toMatch(/may overlap/);
    expect(src).toMatch(/dedupePlanAgainstOrders/);
  });
});
