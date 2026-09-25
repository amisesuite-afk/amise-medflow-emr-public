/**
 * Negation-aware matcher (lib/triage-engine/src/negation.ts). The negative phrases are the exact
 * wording from the clinical-validation vignettes that fired emergency triage, alarms and operative
 * plans; the positive controls must keep firing.
 */
import { describe, expect, it } from 'vitest';
import { containsAffirmed, containsAnyAffirmed, findAffirmed, isNegatedAt, joinClauses, testAffirmed } from '@workspace/triage-engine';

describe('explicit negations do not match', () => {
  const cases: Array<[string, string]> = [
    ['No guarding', 'guarding'],
    ['No guarding, no rebound', 'rebound'],
    ['No guarding, no rebound', 'guarding'],
    ['Soft, no peritonism', 'peritonism'],
    ['No peritonism or rigidity', 'rigid'],
    ["Murphy's sign negative", 'murphy'],
    ["Murphy's sign negative", "murphy's"],
    ["Murphy's sign is negative", 'murphy'],
    ['no black stools', 'black stool'],
    ['No bleeding', 'bleeding'],
    ['no vomiting', 'vomiting'],
    ['Soft, non-tender', 'tender'],
    ['abdomen nontender', 'tender'],
    ['afebrile', 'febrile'],
    ['Apyrexial, anicteric', 'icteric'],
    ['No chest pain described', 'chest pain'],
    ['CT: no free gas', 'free gas'],
    ['No cholangitis', 'cholangitis'],
    ['not jaundiced', 'jaundice'],
    ['Patient denies chest pain', 'chest pain'],
    ['Painless', 'pain'],
    ['pain-free since yesterday', 'pain'],
    ['without guarding', 'guarding'],
    ['nil vomiting', 'vomiting'],
    ['Rovsing -ve', 'rovsing'],
    ['negative Murphy\'s sign', 'murphy'],
    ['CT negative for perforation', 'perforation'],
    ['Pregnancy test negative', 'pregnancy'],
    ['Guarding: absent', 'guarding'],
    ['rebound not elicited', 'rebound'],
    ['No episodes of severe pain', 'severe pain'],
    ['No family history of thyroid cancer', 'cancer'],
    ['No difficulty swallowing, no weight loss, no vomiting, no black stools', 'weight loss'],
    ['No chest pain, breathlessness or haemoptysis', 'breathless'],
    ['No chest pain, breathlessness or haemoptysis', 'haemoptysis'],
    ['Irreducible inguinal hernia', 'reducible'],
    ['Non-smoker', 'smok'],
    ['Appendicitis excluded on CT', 'appendicitis'],
    ['He doesn\'t have a fever', 'fever'],
    ['Has not been vomiting', 'vomiting'],
  ];
  it.each(cases)('%s — %s', (text, term) => {
    expect(containsAffirmed(text, term)).toBe(false);
  });

  it('negates regex matches too (triage red-flag patterns)', () => {
    expect(testAffirmed(/\b(bleed(ing)?|melaena)\b/i, 'No bleeding. No melaena.')).toBe(false);
    expect(testAffirmed(/\b(chest pain|crushing pain|left arm|jaw pain)\b/i, 'No chest pain described')).toBe(false);
    expect(testAffirmed(/\b(severe (abdominal |belly |stomach )?pain|acute abdomen)\b/i, 'no episodes of severe pain')).toBe(false);
  });
});

describe('positive findings still match (positive controls)', () => {
  const cases: Array<[string, string]> = [
    ['guarding present', 'guarding'],
    ['rigid abdomen with guarding', 'guarding'],
    ['rigid abdomen with guarding', 'rigid'],
    ["Murphy's sign positive", 'murphy'],
    ['RIF tenderness with rebound', 'rebound'],
    ['Febrile 38.9', 'febrile'],
    ['Jaundiced', 'jaundice'],
    ['Haematemesis this morning', 'haematemesis'],
    ['Tender RIF', 'tender'],
    ['Localised guarding in the RIF', 'guarding'],
    ['CT: free gas under the diaphragm', 'free gas'],
    ['Adhesive SBO with strangulation', 'strangulation'],
  ];
  it.each(cases)('%s — %s', (text, term) => {
    expect(containsAffirmed(text, term)).toBe(true);
  });
});

describe('scope ends where a new assertion starts', () => {
  it('a comma ends the scope ("No vomiting, rigid abdomen")', () => {
    expect(containsAffirmed('No vomiting, rigid abdomen', 'rigid')).toBe(true);
  });
  it('"but" ends the scope', () => {
    expect(containsAffirmed('No rebound but guarding in RIF', 'guarding')).toBe(true);
  });
  it('"and" ends the scope (safety bias: over-triage)', () => {
    expect(containsAffirmed('No nausea and vomiting', 'vomiting')).toBe(true);
  });
  it('"with" ends the scope', () => {
    expect(containsAffirmed('No fever with rigid abdomen', 'rigid')).toBe(true);
  });
  it('a full stop ends the scope', () => {
    expect(containsAffirmed('No vomiting. Guarding in RIF.', 'guarding')).toBe(true);
  });
  it('"non-" negates only its own word', () => {
    expect(containsAffirmed('Non-bilious vomiting', 'vomiting')).toBe(true);
    expect(containsAffirmed('Non-operative management of appendicitis', 'appendicitis')).toBe(true);
  });
  it('a negation more than five words back does not reach the term', () => {
    expect(containsAffirmed('No history of any previous abdominal surgery in the past, rigid', 'rigid')).toBe(true);
    expect(containsAffirmed('No recent travel to any tropical area this year guarding', 'guarding')).toBe(true);
  });
  it('the post-cue must be close ("rigid abdomen, CT negative" keeps rigid)', () => {
    expect(containsAffirmed('rigid abdomen, CT negative', 'rigid')).toBe(true);
    expect(containsAffirmed('rigid abdomen CT scan negative', 'rigid')).toBe(true);
  });
});

describe('hedges and pseudo-negations are not negations', () => {
  const kept: Array<[string, string]> = [
    ['Appendicitis cannot be excluded', 'appendicitis'],
    ['Perforation not excluded', 'perforation'],
    ['Perforation not ruled out', 'perforation'],
    ['No improvement in pain', 'pain'],
    ['No change in the guarding', 'guarding'],
    ['Pain not relieved by analgesia', 'pain'],
    ['?appendicitis', 'appendicitis'],
    ['CT to exclude perforation', 'perforation'],
    ["Can't swallow saliva", 'swallow'],
    ['Unable to pass flatus', 'flatus'],
    ['Nil by mouth, guarding in RIF', 'guarding'],
    ['No doubt peritonitis', 'peritonitis'],
    ["It hasn't stopped bleeding", 'bleeding'],
    ['Vomiting has not settled', 'vomiting'],
    ["I don't know if it is bleeding", 'bleeding'],
    ['Bleeding has not yet settled', 'bleeding'],
    ['Ex-smoker', 'smok'],
  ];
  it.each(kept)('%s — %s', (text, term) => {
    expect(containsAffirmed(text, term)).toBe(true);
  });
});

describe('terms written as negatives keep matching', () => {
  it('a cue inside the term does not negate the term', () => {
    expect(containsAffirmed('Absolute constipation, no flatus for 2 days', 'no flatus')).toBe(true);
    expect(containsAffirmed('Distended with absent bowel sounds', 'absent bowel sounds')).toBe(true);
    expect(containsAffirmed('Irreducible, tender lump', 'irreducible')).toBe(true);
  });
});

describe('several occurrences: one affirmed occurrence is enough', () => {
  it('finds the affirmed one', () => {
    const text = 'No guarding on admission. Now guarding in the RIF.';
    expect(containsAffirmed(text, 'guarding')).toBe(true);
    expect(findAffirmed(text, 'guarding')?.index).toBe(text.toLowerCase().lastIndexOf('guarding'));
  });
  it('containsAnyAffirmed', () => {
    expect(containsAnyAffirmed('No rebound, no guarding', ['rebound', 'guarding'])).toBe(false);
    expect(containsAnyAffirmed('No rebound; guarding present', ['rebound', 'guarding'])).toBe(true);
  });
});

describe('wholeWord option', () => {
  it('requires word boundaries', () => {
    expect(containsAffirmed('Hinchey III diverticulitis', 'hinchey i', { wholeWord: true })).toBe(false);
    expect(containsAffirmed('Hinchey III diverticulitis', 'hinchey iii', { wholeWord: true })).toBe(true);
    expect(containsAffirmed('Bethesda VI', 'bethesda v', { wholeWord: true })).toBe(false);
    expect(containsAffirmed('Primary hyperparathyroidism for parathyroidectomy', 'thyroidectomy', { wholeWord: true })).toBe(false);
    expect(containsAffirmed('Irreducible inguinal hernia', 'reducible inguinal', { wholeWord: true })).toBe(false);
  });
  it('allows a plural after a long final word, and digits after a code', () => {
    expect(containsAffirmed('SBO secondary to adhesions', 'adhesion', { wholeWord: true })).toBe(true);
    expect(containsAffirmed('Tokyo grade is unclear', 'grade i', { wholeWord: true })).toBe(false);
    expect(containsAffirmed('K35.30 perforated appendicitis', 'k35.3', { wholeWord: true })).toBe(true);
    expect(containsAffirmed('diameter 16mm', '6mm', { wholeWord: true })).toBe(false);
  });
  it('substring semantics are the default', () => {
    expect(containsAffirmed('Acute appendicitis', 'append')).toBe(true);
  });
});

describe('isNegatedAt and joinClauses', () => {
  it('isNegatedAt uses offsets into the original text', () => {
    const text = 'Soft, no guarding';
    const i = text.indexOf('guarding');
    expect(isNegatedAt(text, i, i + 'guarding'.length)).toBe(true);
  });
  it('joinClauses keeps a negation inside its own item', () => {
    const text = joinClauses(['No vomiting', 'Fever']);
    expect(containsAffirmed(text, 'fever')).toBe(true);
    expect(containsAffirmed(text, 'vomiting')).toBe(false);
  });
});
