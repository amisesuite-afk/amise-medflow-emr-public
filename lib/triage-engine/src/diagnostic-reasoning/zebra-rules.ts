/**
 * Zebra check — rare but real conditions that explain an unusual combination of findings.
 * Clinical rule set `diagnostic-reasoning-zebras` (clinical-content/registry.json), version
 * ZEBRA_RULES_VERSION. UNREVIEWED: every rule, term and citation needs the surgeon's sign-off
 * (docs/clinical-validation/changes/diagnostic-reasoning.md, "Needs sign-off").
 *
 * The rules live once, as data: clinical-content/rules/zebra-rules.json (schema
 * clinical-content/schemas/zebra-rules.schema.json). iOS reads the same file (ZebraCheck.swift,
 * bundled folder "rules"). Change the JSON, not a platform copy; `lint:shared-content` validates it
 * against the schema and checks these types and the Swift Codable structs against it.
 *
 * Matching (zebras.ts / ZebraCheck.swift): negation-aware at word starts (negation.ts /
 * NegationMatcher.swift). A rule matches when every `all` group has an affirmed term, at least
 * `atLeast.count` of the `atLeast.groups` have one, and no `none` term is affirmed. A term matches
 * at a word start and may run on ("headache" finds "headaches").
 */

import rawZebraRules from '../../../../clinical-content/rules/zebra-rules.json';

export interface ZebraRule {
  id: string;
  condition: string;
  icd10: string;
  /** pane-engine disease id when the web model has a node for it (to flag "already in the differential"). */
  paneId: string | null;
  /** The combination that suggests it. */
  explains: string;
  all: string[][];
  atLeast: { count: number; groups: string[][] } | null;
  none: string[];
  /** Consultation module to open for it ('supplements'), or null. */
  link: string | null;
  citation: string;
}

/** clinical-content/rules/zebra-rules.json (checked against its schema by lint:shared-content). */
export interface ZebraRuleFile {
  id: string;
  version: string;
  rules: ZebraRule[];
}

const ZEBRA_RULE_FILE = rawZebraRules as ZebraRuleFile;

export const ZEBRA_RULES_VERSION: string = ZEBRA_RULE_FILE.version;

export const ZEBRA_RULES: ZebraRule[] = ZEBRA_RULE_FILE.rules;
