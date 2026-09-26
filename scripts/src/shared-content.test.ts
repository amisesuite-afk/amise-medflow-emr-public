/**
 * Shared clinical content (clinical-content/rules/*.json): the library passes its own lint, the lint
 * catches drift between a schema and the Swift / TypeScript types that read it, and the web
 * modules read the shared files (no platform copy).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as lifestyle from '../../lib/triage-engine/src/lifestyle-practices';
import { ZEBRA_RULES, ZEBRA_RULES_VERSION } from '../../lib/triage-engine/src/diagnostic-reasoning/zebra-rules';
import {
  HERBAL_PREOP_PATIENT_TEXT, SUPPLEMENT_CATALOGUE_VERSION, SUPPLEMENT_ITEMS, SUPPLEMENT_PROMPTS, SUPPLEMENT_TRIGGER_TERMS,
} from '../../artifacts/dashboard/src/lib/supplement-catalogue';
import { REPO_ROOT } from './clinval/load';
import { checkSharedContent, compareSwift, compareTs, parseSwift, parseTs, type Schema } from './shared-content';

const readJson = (p: string) => JSON.parse(readFileSync(join(REPO_ROOT, p), 'utf8')) as Record<string, unknown>;

describe('shared clinical content library', () => {
  it('passes lint:shared-content', () => {
    const { problems, checked } = checkSharedContent(REPO_ROOT);
    expect(problems).toEqual([]);
    expect(checked).toEqual(['decision-rules', 'diagnostic-reasoning-rules', 'exam-signs', 'lifestyle-practices', 'supplement-catalogue', 'zebra-rules']);
  });

  it('the web modules read the shared files', () => {
    const zebra = readJson('clinical-content/rules/zebra-rules.json');
    expect(ZEBRA_RULES).toEqual(zebra.rules);
    expect(ZEBRA_RULES_VERSION).toBe(zebra.version);

    const supplements = readJson('clinical-content/rules/supplement-catalogue.json') as {
      version: string; items: unknown; prompts: unknown; triggerTerms: unknown; text: { herbalPreOpPatientText: string };
    };
    expect(SUPPLEMENT_CATALOGUE_VERSION).toBe(supplements.version);
    expect(SUPPLEMENT_ITEMS).toEqual(supplements.items);
    expect(SUPPLEMENT_PROMPTS).toEqual(supplements.prompts);
    expect(SUPPLEMENT_TRIGGER_TERMS).toEqual(supplements.triggerTerms);
    expect(HERBAL_PREOP_PATIENT_TEXT).toBe(supplements.text.herbalPreOpPatientText);

    const life = readJson('clinical-content/rules/lifestyle-practices.json') as {
      version: string; planLines: unknown; promptText: unknown; sources: unknown;
      thresholds: { olderAdultAge: number; shortSleepHours: number; obesityBMI: number };
    };
    expect(lifestyle.LIFESTYLE_PRACTICES_VERSION).toBe(life.version);
    expect(lifestyle.PLAN_LINES).toEqual(life.planLines);
    expect(lifestyle.PROMPT_TEXT).toEqual(life.promptText);
    expect(lifestyle.SOURCES).toEqual(life.sources);
    expect([lifestyle.OLDER_ADULT_AGE, lifestyle.SHORT_SLEEP_HOURS, lifestyle.OBESITY_BMI])
      .toEqual([life.thresholds.olderAdultAge, life.thresholds.shortSleepHours, life.thresholds.obesityBMI]);
  });

  it('lifestyle labels are keyed by the stored values, in display order', () => {
    expect(Object.keys(lifestyle.FASTING_LABELS)).toEqual([...lifestyle.FASTING_PRACTICES]);
    expect(Object.keys(lifestyle.FASTING_STATUS_LABELS)).toEqual([...lifestyle.FASTING_STATUSES]);
    expect(Object.keys(lifestyle.THERAPY_LABELS)).toEqual([...lifestyle.COMPLEMENTARY_THERAPIES]);
  });

  it('the iOS Swift enums use the same stored values as the web', () => {
    const swift = parseSwift([readFileSync(join(REPO_ROOT, 'ios/AmiseMedFlow/Services/LifestylePractices.swift'), 'utf8')]);
    expect(swift.stringEnums.get('Fasting')).toEqual([...lifestyle.FASTING_PRACTICES]);
    expect(swift.stringEnums.get('FastStatus')).toEqual([...lifestyle.FASTING_STATUSES]);
    expect(swift.stringEnums.get('Therapy')).toEqual([...lifestyle.COMPLEMENTARY_THERAPIES]);
  });
});

// ── Drift detection ──────────────────────────────────────────────────────────────────────────

const SCHEMA: Schema = {
  type: 'object',
  required: ['version', 'items', 'grade'],
  properties: {
    $schema: { type: 'string' },
    version: { type: 'string' },
    count: { type: 'integer' },
    items: { type: 'array', items: { $ref: '#/$defs/item' } },
    grade: { enum: ['Works', 'No benefit shown'] },
    byId: { type: 'object', additionalProperties: { type: 'array', items: { type: 'string' } } },
  },
  $defs: {
    item: {
      type: 'object',
      required: ['id', 'link'],
      properties: { id: { type: 'string' }, link: { type: ['string', 'null'] } },
    },
  },
};

const SWIFT_OK = `
enum Outer {
    struct File: Codable {
        let version: String
        let count: Int?
        let items: [Item]
        let grade: Grade
        let byId: [String: [String]]?
        static let shared = 1
        var computed: String { version }
    }
    struct Item: Codable {
        let id: String
        let link: String?
    }
    enum Grade: String, Codable {
        case works = "Works"
        case noBenefit = "No benefit shown"
    }
}`;

const TS_OK = `
export type Grade = 'Works' | 'No benefit shown';
export interface Item { id: string; link: string | null }
export interface File {
  /** Version. */
  version: string;
  count?: number;
  items: Item[];
  grade: Grade;
  byId?: Record<string, string[]>;
}`;

describe('lint:shared-content catches drift', () => {
  const ignore = ['/$schema'];

  it('accepts types that agree with the schema', () => {
    expect(compareSwift(SCHEMA, parseSwift([SWIFT_OK]), 'Outer.File', ignore)).toEqual([]);
    expect(compareTs(SCHEMA, parseTs([TS_OK]), 'File', ignore)).toEqual([]);
  });

  it('a field the schema does not have (a rename on one side)', () => {
    const swift = SWIFT_OK.replace('let id: String', 'let identifier: String');
    expect(compareSwift(SCHEMA, parseSwift([swift]), 'Outer.File', ignore).join('\n')).toMatch(/identifier: not a property/);
    const ts = TS_OK.replace('id: string;', 'identifier: string;');
    expect(compareTs(SCHEMA, parseTs([ts]), 'File', ignore).join('\n')).toMatch(/identifier: not a property/);
  });

  it('a schema property nobody reads', () => {
    const swift = SWIFT_OK.replace('        let count: Int?\n', '');
    expect(compareSwift(SCHEMA, parseSwift([swift]), 'Outer.File', ignore).join('\n')).toMatch(/"count" is not read/);
    expect(compareSwift(SCHEMA, parseSwift([swift]), 'Outer.File', [...ignore, '/count'])).toEqual([]);
  });

  it('a non-optional field the schema does not require', () => {
    const swift = SWIFT_OK.replace('let count: Int?', 'let count: Int');
    expect(compareSwift(SCHEMA, parseSwift([swift]), 'Outer.File', ignore).join('\n')).toMatch(/count: non-optional here/);
    const ts = TS_OK.replace('count?: number;', 'count: number;');
    expect(compareTs(SCHEMA, parseTs([ts]), 'File', ignore).join('\n')).toMatch(/count: non-optional here/);
  });

  it('a wrong type, a missing null, an enum value that differs', () => {
    const swift = SWIFT_OK.replace('let count: Int?', 'let count: String?')
      .replace('let link: String?', 'let link: String')
      .replace('case noBenefit = "No benefit shown"', 'case noBenefit = "No benefit"');
    const problems = compareSwift(SCHEMA, parseSwift([swift]), 'Outer.File', ignore).join('\n');
    expect(problems).toMatch(/count: Swift String/);
    expect(problems).toMatch(/link: the schema allows null/);
    expect(problems).toMatch(/raw values \[No benefit, Works\] differ/);

    const ts = TS_OK.replace('link: string | null', 'link: string').replace("'No benefit shown'", "'No benefit'");
    const tsProblems = compareTs(SCHEMA, parseTs([ts]), 'File', ignore).join('\n');
    expect(tsProblems).toMatch(/link: the schema allows null/);
    expect(tsProblems).toMatch(/literals \[No benefit, Works\] differ/);
  });

  it('a struct that is not Codable', () => {
    const swift = SWIFT_OK.replace('struct Item: Codable', 'struct Item: Equatable');
    expect(compareSwift(SCHEMA, parseSwift([swift]), 'Outer.File', ignore).join('\n')).toMatch(/Item is not Codable/);
  });
});
