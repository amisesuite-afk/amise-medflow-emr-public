import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APPLIED_MARKER, buildCatalogue, itemHash, parseChangeLog, parseDecisionRefs, parseSurgeonDecisions,
  readCatalogueInputs, refMatches,
} from './signoff/catalogue';
import { catalogueDiff } from './signoff-catalogue';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');

const LOG = `# Fix: example

Intro.

## Needs sign-off

Deliberate differences:

1. **Threshold** of 6 mm, or 8 mm after
   cholecystectomy.
2. **Paediatric bands**:
   - HR from NG51;
   - SBP from PALS.

   Please confirm the combination.
3. **Aspirin** 150–300 mg.

Content choices:

4. **Oxygen targets** 88–92%.

### A. Printed sheet

| # | Before | After |
|---|---|---|
| A1 | Nothing from midnight | Nothing to eat for 6 hours |
| A2 | Stop 2 hours before | Examples only |

Allowed by the lint after review: the thyroxine sentence. Please confirm.

### C. iPad

- C1. The questions are the web's.

## Not done

5. Not an item.
`;

describe('parseChangeLog', () => {
  const items = parseChangeLog(LOG, 'example');

  it('gives stable ids for numbered items, labelled bullets, table rows and trailing paragraphs', () => {
    expect(items.map(i => i.number)).toEqual(['1', '2', '3', '4', 'A1', 'A2', 'note-1', 'C1']);
    expect(parseChangeLog(LOG, 'example').map(i => i.number)).toEqual(items.map(i => i.number));
  });

  it('keeps continuation lines (indented, after a blank line) with their item and stops at the next section', () => {
    expect(items[0].text).toBe('**Threshold** of 6 mm, or 8 mm after\ncholecystectomy.');
    expect(items[1].text).toContain('Please confirm the combination.');
    expect(items.some(i => i.text.includes('Not an item'))).toBe(false);
  });

  it('turns a paragraph ending in a colon into the group label, and sub-headings into groups with anchors', () => {
    expect(items[0].group).toBe('Deliberate differences');
    expect(items[3].group).toBe('Content choices');
    expect(items[4].group).toBe('A. Printed sheet');
    expect(items[4].anchor).toBe('a-printed-sheet');
    expect(items[0].anchor).toBe('needs-sign-off');
    expect(items[4].text).toBe('Before: Nothing from midnight\nAfter: Nothing to eat for 6 hours');
    expect(items[0].title).toBe('Threshold');
  });

  it('fails loudly on a log without items or with a duplicate number', () => {
    expect(() => parseChangeLog('# x\n\n## Needs sign-off\n\nNothing.\n', 'x')).toThrow(/no "Needs sign-off" items/);
    expect(() => parseChangeLog('## Needs sign-off\n\n1. a\n1. b\n', 'x')).toThrow(/duplicate/);
  });
});

describe('item hashes', () => {
  it('ignore reflowed whitespace but change when the wording changes', () => {
    expect(itemHash('Hb < 70 g/L\nfor  transfusion')).toBe(itemHash('Hb < 70 g/L for transfusion'));
    expect(itemHash('Hb < 70 g/L')).not.toBe(itemHash('Hb < 80 g/L'));
    expect(itemHash('x')).toMatch(/^[0-9a-f]{16}$/);
  });

  it('an edit to one item changes only that item\'s hash; ids stay put', () => {
    const before = parseChangeLog(LOG, 'example');
    const after = parseChangeLog(LOG.replace('150–300 mg', '300 mg'), 'example');
    expect(after.map(i => i.number)).toEqual(before.map(i => i.number));
    const changed = after.filter((a, k) => itemHash(a.text) !== itemHash(before[k].text)).map(i => i.number);
    expect(changed).toEqual(['3']);
  });
});

const DECISIONS = `# Decisions

## A. Unsafe content

| # | Now | Proposed | Source | Finding |
|---|---|---|---|---|
| A1 | TXA in every bleed | Remove | ESGE 2021 | upper-gi |
| A2 | Aggressive fluids | Goal-directed | WATERFALL | hpb |

## F. Software bugs fixed

Done:

- Negated findings no longer fire.
- Whole-word matching:
  "irreducible" no longer matches.

In progress: more.

## G. Phase 2

### G1. Scope

| # | Question |
|---|---|
| G1.1 | Recognise and redirect? |

### G3. Missing recognition

ACS; stroke.

## H. Register

| x | y |
|---|---|
| H1 | not parsed |

## I. Decisions made

### I1. Herbal products — DECIDED

- **Decision:** may stop herbal products.

### I2. Outcomes governance

- **Defaults:**
  1. **Retention.** Kept indefinitely,
     retracted not deleted.
  2. **Reminder.** 14 days.

### I3. Clinical sign-off — applied
${APPLIED_MARKER}

- recorded decisions
`;

describe('parseSurgeonDecisions', () => {
  it('parses table rows, F bullets, G3, I subsections and numbered I defaults; skips H and applied records', () => {
    const items = parseSurgeonDecisions(DECISIONS);
    expect(items.map(i => i.number)).toEqual(['A1', 'A2', 'F1', 'F2', 'G1.1', 'G3', 'I1', 'I2.1', 'I2.2']);
    expect(items.find(i => i.number === 'F2')!.text).toBe('Whole-word matching:\n"irreducible" no longer matches.');
    expect(items.find(i => i.number === 'I2.1')!.text).toBe('**Retention.** Kept indefinitely,\nretracted not deleted.');
    expect(items.find(i => i.number === 'A1')!.text).toBe('Now: TXA in every bleed\nProposed: Remove\nSource: ESGE 2021\nFinding: upper-gi');
  });
});

describe('registry references to SURGEON-DECISIONS', () => {
  it('expands ranges, subsection references and whole sections, and stops at prose', () => {
    expect(parseDecisionRefs('(SURGEON-DECISIONS A1–A3, B2, G2 content, new protocols, C4)')).toEqual(['A1', 'A2', 'A3', 'B2', 'G2']);
    expect(parseDecisionRefs('SURGEON-DECISIONS C5, G2.1–G2.3, A22). See C9')).toEqual(['C5', 'G2.1', 'G2.2', 'G2.3', 'A22']);
    expect(parseDecisionRefs('SURGEON-DECISIONS A, C9/C1: added NG12')).toEqual(['A*', 'C9', 'C1']);
    expect(parseDecisionRefs('SURGEON-DECISIONS C1–C3, G1.1, G3 and the prompt parts of G2)')).toEqual(['C1', 'C2', 'C3', 'G1.1', 'G3']);
    expect(refMatches('A*', 'A17')).toBe(true);
    expect(refMatches('G2', 'G2.13')).toBe(true);
    expect(refMatches('G2', 'G21')).toBe(false);
    expect(refMatches('A2', 'A22')).toBe(false);
  });
});

describe('the repository catalogue', () => {
  const catalogue = buildCatalogue(readCatalogueInputs(REPO_ROOT));

  it('has unique ids that fit the database CHECK, and every item has a hash and a source document', () => {
    const ids = catalogue.items.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const it of catalogue.items) {
      expect(it.id).toMatch(/^[a-z0-9-]{1,64}#[A-Za-z0-9.-]{1,16}$/);
      expect(it.hash).toMatch(/^[0-9a-f]{16}$/);
      expect(it.text.length).toBeGreaterThan(0);
    }
  });

  it('numbers each change log\'s numbered items 1…n with none dropped', () => {
    for (const src of catalogue.sources) {
      if (src.id === 'surgeon-decisions') continue;
      const nums = catalogue.items.filter(i => i.source === src.id && /^\d+$/.test(i.number)).map(i => Number(i.number));
      if (!nums.length) continue;
      const groups: number[][] = [];
      for (const n of nums) {
        if (n === 1 || !groups.length) groups.push([n]);
        else groups[groups.length - 1].push(n);
      }
      for (const g of groups) expect(g, src.id).toEqual(g.map((_, k) => k + 1));
    }
  });

  it('links rule sets that exist in the registry, and the register items to theirs', () => {
    const inputs = readCatalogueInputs(REPO_ROOT);
    const known = new Set(inputs.registry.ruleSets.map(r => r.id));
    for (const it of catalogue.items) for (const id of it.ruleSetIds) expect(known.has(id)).toBe(true);
    expect(catalogue.items.find(i => i.id === 'bayes-treatment#1')!.ruleSetIds).toEqual(['treatment-decision-support']);
    expect(catalogue.items.find(i => i.id === 'surgeon-decisions#E2')!.ruleSetIds).toContain('triage-rules-red-flags');
    for (const rs of catalogue.ruleSets) expect(rs.itemIds.length).toBeGreaterThan(0);
  });

  it('catalogueDiff names new, changed and removed items', () => {
    const edited = {
      ...catalogue,
      items: catalogue.items.slice(1).map((i, k) => (k === 0 ? { ...i, hash: '0000000000000000' } : i)),
    };
    const diff = catalogueDiff(edited, catalogue);
    expect(diff).toContain(`new item ${catalogue.items[0].id}`);
    expect(diff).toContain(`changed item ${catalogue.items[1].id}`);
    expect(catalogueDiff(null, catalogue)).toEqual(['the catalogue file is missing']);
  });
});
