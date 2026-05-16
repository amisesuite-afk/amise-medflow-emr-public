export const RULES_VERSION = '1.1.0';

export type AppointmentType =
  | 'new_consult'
  | 'follow_up'
  | 'post_op'
  | 'ercp_workup'
  | 'ercp'
  | 'breast'
  | 'telephone';

export type Severity = 'urgent' | 'priority' | 'review';

export interface RedFlag {
  pattern: RegExp;
  reason: string;
  severity: Severity;
}

export const RED_FLAGS: RedFlag[] = [
  { pattern: /\b(bleed(ing)?|haematemesis|hematemesis|melaena|melena|rectal bleed|pr bleed|coughing up blood|vomiting blood)\b/i,
    reason: 'GI or other bleeding', severity: 'urgent' },
  { pattern: /\b(severe (abdominal |belly |stomach )?pain|acute abdomen|peritonitis|can'?t move|writhing)\b/i,
    reason: 'Acute abdominal pain', severity: 'urgent' },
  { pattern: /\b(jaundice|yellow(ing)? (of )?(eyes|skin)|dark urine|pale stool|clay(-| )?colou?red stool)\b/i,
    reason: 'Possible biliary obstruction', severity: 'urgent' },
  { pattern: /\b(after (my |the )?(surgery|operation|procedure)|post[- ]?op|wound (discharge|infected|opened|leaking|red|pus)|fever (after|since)|breathless|shortness of breath)\b/i,
    reason: 'Post-operative concern', severity: 'urgent' },
  { pattern: /\b(new lump|growing lump|breast lump|weight loss|losing weight|night sweats|cancer)\b/i,
    reason: 'Possible malignancy', severity: 'priority' },
  { pattern: /\b(pregnant|pregnancy|expecting)\b/i,
    reason: 'Pregnancy mentioned — clinical review required', severity: 'review' },
  { pattern: /\b(suicid(e|al)|kill myself|self[- ]?harm|end (it|my life)|can'?t go on)\b/i,
    reason: 'Mental health crisis', severity: 'urgent' },
  { pattern: /\b(dosage|dose of|increase my (med|dose)|what (medication|tablet|pill)|my results|biopsy result|test result)\b/i,
    reason: 'Clinical query — defer to doctor', severity: 'review' },
  { pattern: /\b(chest pain|crushing pain|radiating to|left arm|jaw pain)\b/i,
    reason: 'Possible cardiac event', severity: 'urgent' },
  { pattern: /\b(fever|chills|rigors|confusion|collapse|fainting|syncope)\b/i,
    reason: 'Systemic red flag symptom', severity: 'priority' },
  { pattern: /\b(unable to pass stool|unable to pass gas|obstructed|strangulated|irreducible hernia|vomiting repeatedly)\b/i,
    reason: 'Possible obstruction or complicated hernia', severity: 'urgent' },
];

export function scanRedFlags(text: string): { flagged: boolean; matches: RedFlag[] } {
  const matches = RED_FLAGS.filter(rf => rf.pattern.test(text));
  return { flagged: matches.length > 0, matches };
}
