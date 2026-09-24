/**
 * Drug-interaction checker — hazard log H-07 (false reassurance).
 *
 * 1. Lint: every term used by a rule is defined in DRUG_TERMS, and every class has members.
 *    Adding a rule against an unmapped class (e.g. "fluoroquinolone") fails here.
 * 2. Class-based rules now fire on real prescription strings (generics, old INNs, brands).
 * 3. False-match guards ported from the iOS tests (DrugInteractionTests.swift): "arb" inside
 *    carbamazepine / bicarbonate / carbonate, "5-ASA" (mesalazine) read as aspirin.
 * 4. Never-remove invariant: every alert the pre-H-07 engine raised is still raised, for the
 *    same medication pair, with the same effect at the same or higher severity.
 */
import { describe, it, expect } from 'vitest';
import {
  checkInteractions, INTERACTIONS, LEGACY_TERMS, ORIGINAL_RULE_COUNT, type DrugInteraction,
} from '@/lib/drug-interactions';
import { DRUG_TERMS, parseMember, matchTerm, containsWholeWord } from '@/lib/drug-classes';
const RANK = { contraindicated: 3, major: 2, moderate: 1 } as const;

function find(meds: string[], a: RegExp, b: RegExp) {
  return checkInteractions(meds).find(h =>
    (a.test(h.matchedA) && b.test(h.matchedB)) || (b.test(h.matchedA) && a.test(h.matchedB)));
}

function allRules(h: { interaction: DrugInteraction; related: DrugInteraction[] }) {
  return [h.interaction, ...h.related];
}

// ── 1. Lint ──────────────────────────────────────────────────────────────────

describe('interaction vocabulary lint (H-07)', () => {
  const terms = [...new Set(INTERACTIONS.flatMap(r => r.drugs))];

  it('every rule term is defined in DRUG_TERMS', () => {
    const unmapped = terms.filter(t => !DRUG_TERMS[t]);
    expect(unmapped, `unmapped rule terms: ${unmapped.join(', ')}`).toEqual([]);
  });

  it('every class used by a rule has at least one member', () => {
    for (const t of terms) {
      const def = DRUG_TERMS[t];
      expect(def, t).toBeDefined();
      expect(def.members.length, `${t} has no members`).toBeGreaterThan(0);
      for (const m of def.members) expect(parseMember(m).generic, `${t}: empty member`).not.toBe('');
    }
  });

  it('every term cites its source standard', () => {
    for (const [t, def] of Object.entries(DRUG_TERMS)) {
      expect(def.source.length, `${t} has no source`).toBeGreaterThan(0);
    }
  });

  it('every class member itself matches its class (self-consistency)', () => {
    for (const [t, def] of Object.entries(DRUG_TERMS)) {
      for (const m of def.members) {
        for (const name of parseMember(m).names) {
          expect(matchTerm(t, `${name} 10 mg`), `${t} ← ${name}`).not.toBeNull();
        }
      }
    }
  });

  it('rule terms are lowercase keys', () => {
    for (const t of terms) expect(t).toBe(t.toLowerCase());
  });
});

// ── 2. Class-based rules fire on real prescriptions ─────────────────────────

describe('class membership — headline cases', () => {
  it('warfarin + diclofenac alerts (bleeding, major, via NSAID class)', () => {
    const h = find(['Warfarin 5 mg od', 'Diclofenac 50 mg tds'], /warfarin/, /diclofenac/);
    expect(h).toBeDefined();
    expect(h!.interaction.severity).toBe('major');
    expect(h!.interaction.effect).toMatch(/bleeding/i);
    expect([h!.viaClassA, h!.viaClassB]).toContain('NSAID');
  });

  it('tramadol + sertraline alerts (serotonin syndrome)', () => {
    const h = find(['Tramadol 50mg qds prn', 'Sertraline 100mg od'], /tramadol/, /sertraline/);
    expect(h).toBeDefined();
    expect(h!.interaction.severity).toBe('major');
    expect(h!.interaction.effect).toMatch(/serotonin/i);
  });

  it('morphine + diazepam alerts (opioid + benzodiazepine)', () => {
    const h = find(['Morphine sulfate 10mg', 'Diazepam 5mg nocte'], /morphine/, /diazepam/);
    expect(h?.interaction.severity).toBe('contraindicated');
    expect(h?.interaction.effect).toMatch(/respiratory/i);
  });
});

describe('class membership — per class', () => {
  const cases: [string, string[], RegExp][] = [
    // NSAIDs (generics, old INNs, brands)
    ['warfarin + Voltaren', ['Coumadin 3mg', 'Voltaren 75mg'], /bleeding/i],
    ['warfarin + indomethacin PR', ['warfarin', 'indomethacin 100mg PR'], /bleeding/i],
    ['lithium + naproxen', ['Priadel 400mg', 'Naproxen 500mg bd'], /lithium toxicity/i],
    ['methotrexate + Advil', ['methotrexate 15mg weekly', 'Advil 400mg'], /methotrexate/i],
    // Anticoagulants: DOACs and heparins
    ['Xarelto + naproxen', ['Xarelto 20mg', 'naproxen 250mg'], /bleeding/i],
    ['apixaban + ketorolac', ['apixaban 5mg bd', 'ketorolac 10mg'], /bleeding/i],
    ['dabigatran + celecoxib', ['Pradaxa 150mg', 'Celebrex 200mg'], /bleeding/i],
    ['enoxaparin + diclofenac', ['Clexane 40mg sc', 'diclofenac 50mg'], /bleeding/i],
    ['tinzaparin + ibuprofen', ['tinzaparin 4500 units', 'ibuprofen 400mg'], /bleeding/i],
    // Antiplatelets
    ['warfarin + clopidogrel', ['warfarin', 'Plavix 75mg'], /bleeding/i],
    ['rivaroxaban + ASA', ['rivaroxaban', 'ASA 81 mg'], /bleeding/i],
    ['apixaban + ticagrelor', ['Eliquis', 'Brilinta 90mg'], /bleeding/i],
    // SSRIs / SNRIs
    ['warfarin + citalopram', ['warfarin', 'citalopram 20mg'], /bleeding/i],
    ['tramadol + fluoxetine brand', ['Ultram 50mg', 'Prozac 20mg'], /serotonin/i],
    ['tramadol + venlafaxine', ['tramadol', 'Effexor XR 75mg'], /serotonin/i],
    ['naproxen + duloxetine', ['naproxen', 'duloxetine 60mg'], /GI bleeding/i],
    // MAOIs
    ['linezolid + sertraline', ['linezolid 600mg bd', 'sertraline'], /serotonin/i],
    ['phenelzine + tramadol', ['phenelzine 15mg', 'tramadol'], /serotonin/i],
    ['methylene blue + fluoxetine', ['methylene blue 1mg/kg IV', 'fluoxetine 20mg'], /serotonin/i],
    ['selegiline + meperidine', ['selegiline', 'meperidine 50mg'], /serotonin/i],
    // Opioids + benzodiazepines / gabapentinoids
    ['fentanyl + midazolam', ['fentanyl 50mcg', 'midazolam 2mg'], /respiratory/i],
    ['oxycodone + lorazepam', ['OxyContin 10mg', 'Ativan 1mg'], /respiratory/i],
    ['co-codamol + alprazolam', ['co-codamol 30/500', 'Xanax 0.5mg'], /respiratory/i],
    ['oxycodone + pregabalin', ['oxycodone 5mg', 'Lyrica 75mg'], /respiratory/i],
    ['morphine + gabapentin', ['morphine', 'gabapentin 300mg'], /respiratory/i],
    // QT-prolonging drugs
    ['ondansetron + azithromycin', ['ondansetron 4mg', 'azithromycin 500mg'], /QT/],
    ['haloperidol + erythromycin', ['haloperidol 0.5mg', 'erythromycin'], /QT/],
    ['domperidone + citalopram', ['Motilium 10mg', 'Celexa 20mg'], /QT/],
    // ACE inhibitors / ARBs / potassium-sparing diuretics / potassium
    ['ramipril + spironolactone', ['ramipril 5mg', 'spironolactone 25mg'], /hyperkalaemia/i],
    ['perindopril + Slow-K', ['Coversyl 4mg', 'Slow-K 600mg'], /hyperkalaemia/i],
    ['losartan + amiloride', ['losartan 50mg', 'amiloride 5mg'], /hyperkalaemia/i],
    ['valsartan + potassium chloride', ['Diovan 80mg', 'potassium chloride 600mg'], /hyperkalaemia/i],
    ['lisinopril + ibuprofen', ['lisinopril 10mg', 'ibuprofen 400mg'], /kidney/i],
    ['candesartan + diclofenac', ['candesartan 8mg', 'diclofenac'], /kidney/i],
    // Diuretics
    ['lithium + bendroflumethiazide', ['lithium carbonate 400mg', 'bendroflumethiazide 2.5mg'], /lithium/i],
    ['lithium + frusemide', ['lithium', 'frusemide 40mg'], /lithium/i],
    ['gentamicin + Lasix', ['gentamicin 5mg/kg', 'Lasix 40mg'], /ototoxicity/i],
    // Macrolides / azoles
    ['warfarin + clarithromycin', ['warfarin', 'clarithromycin 500mg bd'], /INR|anticoagulation/i],
    ['clarithromycin + simvastatin', ['Klaricid 500mg', 'simvastatin 40mg'], /myopathy/i],
    ['warfarin + miconazole oral gel', ['warfarin', 'miconazole oral gel'], /INR|anticoagulation/i],
    ['warfarin + itraconazole', ['Marevan', 'itraconazole 200mg'], /INR|anticoagulation/i],
    // Corticosteroids / insulin / beta-blockers
    ['dexamethasone + Lantus', ['dexamethasone 8mg IV', 'Lantus 20 units'], /glucose/i],
    ['prednisolone + naproxen', ['prednisolone 40mg', 'naproxen 500mg'], /GI bleed|ulcer/i],
    ['NovoRapid + bisoprolol', ['NovoRapid sliding scale', 'bisoprolol 5mg'], /hypoglycaemia/i],
    // Antacids / neuromuscular blockers / contrast / others
    ['ciprofloxacin + Gaviscon', ['Cipro 500mg', 'Gaviscon 10ml'], /absorption/i],
    ['clindamycin + rocuronium', ['clindamycin 600mg', 'rocuronium'], /neuromuscular/i],
    ['Glucophage + Omnipaque', ['Glucophage 500mg', 'Omnipaque 350'], /lactic/i],
    ['aminophylline + ciprofloxacin', ['aminophylline infusion', 'ciprofloxacin'], /theophylline/i],
    ['clopidogrel + Nexium', ['clopidogrel', 'Nexium 40mg'], /CYP2C19/],
    ['acetaminophen + alcohol', ['acetaminophen 1g', 'alcohol excess'], /hepatotoxicity/i],
    ['digoxin + Cordarone', ['Lanoxin 125mcg', 'Cordarone 200mg'], /digoxin/i],
  ];

  for (const [label, meds, effect] of cases) {
    it(label, () => {
      const hits = checkInteractions(meds);
      const effects = hits.flatMap(h => allRules(h).map(r => r.effect));
      expect(effects.some(e => effect.test(e)), `${label}: got ${JSON.stringify(effects)}`).toBe(true);
    });
  }
});

describe('matching precision', () => {
  it('brand names match only as whole words ("ASA" is not "nasal")', () => {
    expect(matchTerm('aspirin', 'mometasone nasal spray')).toBeNull();
    expect(matchTerm('aspirin', 'asa 81mg')?.canonical).toBe('aspirin');
    expect(matchTerm('ssri', 'escitalopram 10mg')?.canonical).toBe('escitalopram');
  });

  it('no alert for a non-interacting pair', () => {
    expect(checkInteractions(['paracetamol 1g qds', 'amoxicillin 500mg tds'])).toEqual([]);
  });

  it('a class match never pairs an entry with itself', () => {
    // "losartan potassium" is one drug (ARB salt), not ARB + potassium supplement.
    expect(checkInteractions(['losartan potassium 50mg'])).toEqual([]);
    // co-codamol is opioid + paracetamol in one product: no self-interaction.
    expect(checkInteractions(['co-codamol 30/500'])).toEqual([]);
  });

  it('QT + QT needs two different drugs', () => {
    expect(checkInteractions(['ondansetron 4mg', 'ondansetron 8mg'])).toEqual([]);
    expect(checkInteractions(['Zofran 4mg', 'ondansetron 8mg'])).toEqual([]);
    expect(checkInteractions(['ondansetron 4mg', 'Zithromax 500mg']).length).toBe(1);
  });

  it('every NSAID in the list is paired, not just the first', () => {
    const hits = checkInteractions(['warfarin', 'diclofenac 50mg', 'ibuprofen 400mg']);
    const partners = hits.map(h => (h.matchedA.includes('warfarin') ? h.matchedB : h.matchedA)).sort();
    expect(partners).toEqual(['diclofenac 50mg', 'ibuprofen 400mg']);
  });

  it('one card per medication pair; other distinct effects kept as related', () => {
    // warfarin + aspirin: original rule plus the new anticoagulant + antiplatelet rule share
    // the same effect → one card, original wording.
    const hits = checkInteractions(['warfarin', 'aspirin 75mg']);
    expect(hits).toHaveLength(1);
    expect(hits[0].interaction.action).toBe('Monitor INR closely; consider PPI cover');
    // heparin + diclofenac: original moderate "Additive bleeding risk" + new major
    // "Increased bleeding risk" → the major headline, the moderate kept as related.
    const hep = checkInteractions(['heparin 5000 units sc', 'diclofenac']);
    expect(hep).toHaveLength(1);
    expect(hep[0].interaction.severity).toBe('major');
    expect(hep[0].related.map(r => r.effect)).toContain('Additive bleeding risk');
  });

  it('results are ordered most severe first', () => {
    const hits = checkInteractions(['ondansetron', 'azithromycin', 'phenelzine', 'sertraline']);
    const ranks = hits.map(h => RANK[h.interaction.severity]);
    expect([...ranks].sort((a, b) => b - a)).toEqual(ranks);
    expect(hits[0].interaction.severity).toBe('contraindicated');
  });

  it('severity order is clinical, not alphabetical (iOS parity case)', () => {
    const hits = checkInteractions(['ondansetron', 'azithromycin', 'phenelzine', 'sertraline',
      'Clopidogrel 75mg', 'Omeprazole 20mg', 'Warfarin']);
    const sev = hits.map(h => h.interaction.severity);
    const ranks = sev.map(s => RANK[s]);
    expect([...ranks].sort((a, b) => b - a)).toEqual(ranks);
    expect(sev[0]).toBe('contraindicated');
    expect(sev).toContain('major');
    expect(sev[sev.length - 1]).toBe('moderate');
    // Deterministic: the same list always gives the same order.
    expect(checkInteractions(['ondansetron', 'azithromycin', 'phenelzine', 'sertraline',
      'Clopidogrel 75mg', 'Omeprazole 20mg', 'Warfarin'])).toEqual(hits);
  });
});

// ── 3. False-match guards (found by the iOS port) ────────────────────────────

/** Rules whose terms include `term`, among every rule shown for these medications. */
function rulesUsing(meds: string[], term: string) {
  return checkInteractions(meds).flatMap(allRules).filter(r => r.drugs.includes(term));
}

describe('false-match guards (iOS parity)', () => {
  it('only the original 36 rules\' terms keep raw substring matching', () => {
    expect(ORIGINAL_RULE_COUNT).toBe(36);
    for (const t of ['warfarin', 'aspirin', 'nsaid', 'ssri', 'opioid', 'benzodiazepine', 'ace inhibitor',
      'contrast', 'potassium', 'maoi', 'heparin', 'diuretic']) {
      expect(LEGACY_TERMS.has(t), t).toBe(true);
    }
    for (const t of ['arb', 'anticoagulant', 'antiplatelet', 'snri', 'qt prolonging', 'macrolide',
      'azole antifungal', 'gabapentinoid', 'potassium-sparing diuretic']) {
      expect(LEGACY_TERMS.has(t), t).toBe(false);
    }
  });

  const ARB_LOOKALIKES = [
    'Carbamazepine (Tegretol)', 'Carboplatin AUC5 IV', 'Sodium bicarbonate 1.26% IV',
    'Ferric carboxymaltose (Ferinject) 1g IV', 'Calcium carbonate + D3 (Adcal-D3)',
    'Carbimazole 20mg', // also on the formulary; same raw-"arb" false alert
  ];

  it('"arb" does not match inside carbamazepine / carboplatin / bicarbonate / carboxymaltose / carbonate', () => {
    for (const med of ARB_LOOKALIKES) {
      expect(matchTerm('arb', med.toLowerCase(), LEGACY_TERMS.has('arb')), med).toBeNull();
      // No ARB rule (+ NSAID, + potassium, + potassium-sparing diuretic) for any of them.
      for (const partner of ['Ibuprofen 400mg', 'Potassium chloride IV', 'Spironolactone 25mg', 'Amiloride 5mg']) {
        expect(rulesUsing([partner, med], 'arb'), `${partner} + ${med}`).toEqual([]);
      }
    }
  });

  it('the reported false alerts are gone', () => {
    expect(checkInteractions(['Ibuprofen 400mg', 'Carbamazepine (Tegretol)'])).toEqual([]);
    expect(checkInteractions(['Sodium bicarbonate', 'Potassium chloride IV'])).toEqual([]);
    expect(checkInteractions(['Spironolactone', 'Calcium carbonate + D3 (Adcal-D3)'])).toEqual([]);
    expect(checkInteractions(['Diclofenac 50mg', 'Carboplatin'])).toEqual([]);
    expect(checkInteractions(['Naproxen 500mg', 'Ferric carboxymaltose'])).toEqual([]);
  });

  it('real ARBs, and the literal class name, still match', () => {
    expect(matchTerm('arb', 'losartan 50mg')?.canonical).toBe('losartan');
    expect(matchTerm('arb', 'entresto 49/51mg')?.canonical).toBe('valsartan');
    expect(matchTerm('arb', 'arb (unspecified)')?.canonical).toBe('arb');
    expect(rulesUsing(['Ibuprofen 400mg', 'Candesartan 8mg'], 'arb').length).toBeGreaterThan(0);
    expect(rulesUsing(['ARB', 'Potassium chloride IV'], 'arb').length).toBeGreaterThan(0);
    expect(rulesUsing(['losartan potassium 50mg', 'Spironolactone'], 'arb').length).toBeGreaterThan(0);
  });

  it('the literal name of any H-07 class matches as a whole word, never as a substring', () => {
    expect(matchTerm('snri', 'snri prn')?.canonical).toBe('snri');
    expect(rulesUsing(['tramadol', 'SNRI'], 'snri').length).toBeGreaterThan(0);
    expect(matchTerm('macrolide', 'nonmacrolides')).toBeNull();
  });

  it('"5-ASA" (mesalazine) is not aspirin', () => {
    const mesalazine = 'Mesalazine (5-ASA, Pentasa)';
    expect(matchTerm('aspirin', mesalazine.toLowerCase(), true)).toBeNull();
    expect(matchTerm('antiplatelet', mesalazine.toLowerCase())).toBeNull();
    expect(containsWholeWord('asa', '5-asa')).toBe(false);
    expect(checkInteractions(['Warfarin', mesalazine])).toEqual([]);
    expect(checkInteractions(['Heparin 5000 units sc', mesalazine])).toEqual([]);
    expect(checkInteractions(['Rivaroxaban 20mg', '5-ASA 800mg'])).toEqual([]);
  });

  it('ASA as aspirin still matches (including after a letter-hyphen or in brackets)', () => {
    expect(containsWholeWord('asa', 'asa 81 mg')).toBe(true);
    expect(containsWholeWord('asa', 'aspirin (asa) 75mg')).toBe(true);
    expect(containsWholeWord('asa', 'low-asa')).toBe(true);
    expect(containsWholeWord('asa', 'nasal')).toBe(false);
    expect(checkInteractions(['Warfarin 5mg', 'ASA 81 mg'])).toHaveLength(1);
    expect(checkInteractions(['Warfarin 5mg', 'Mometasone nasal spray'])).toEqual([]);
  });

  it('an entry is never paired with itself through a class/brand match', () => {
    expect(checkInteractions(['co-codamol 30/500', 'amoxicillin 500mg'])).toEqual([]);
    expect(checkInteractions(['losartan potassium 50mg'])).toEqual([]);
  });

  it('legacy literal class names still fire exactly as before', () => {
    expect(matchTerm('nsaid', 'nsaid prn', true)?.legacy).toBe(true);
    expect(find(['warfarin 5mg', 'nsaid prn'], /warfarin/, /nsaid/)).toBeDefined();
    expect(find(['opioid analgesia', 'benzodiazepine'], /opioid/, /benzodiazepine/)).toBeDefined();
  });
});

// ── 3b. Rules ported from iOS (platform parity) ─────────────────────────────

/** The rule with exactly these terms (either order) among every rule shown for `meds`. */
function ruleFor(meds: string[], a: string, b: string) {
  return checkInteractions(meds).flatMap(allRules)
    .find(r => (r.drugs[0] === a && r.drugs[1] === b) || (r.drugs[0] === b && r.drugs[1] === a));
}

describe('rules ported from iOS — same grade and wording as DrugInteractionService.swift', () => {
  // [terms, severity, effect, action, positive medication lists (generic + brand)]
  const PORTED: [[string, string], DrugInteraction['severity'], string, string, string[][]][] = [
    [['gentamicin', 'vancomycin'], 'major',
      'Acute kidney injury — additive renal tubular toxicity',
      'Monitor renal function and drug levels closely; ensure adequate hydration',
      [['Gentamicin 5mg/kg IV', 'Vancomycin 1g IV bd'], ['Cidomycin 80mg', 'Vancocin 1g']]],
    [['gentamicin', 'nsaid'], 'moderate',
      'Increased nephrotoxicity and ototoxicity',
      'Avoid if possible; monitor renal function and gentamicin levels',
      [['gentamicin 5mg/kg', 'naproxen 500mg bd'], ['Genticin', 'Voltarol 50mg']]],
    [['methotrexate', 'ciprofloxacin'], 'major',
      'Methotrexate toxicity',
      'Avoid; use alternative antibiotic',
      [['Methotrexate 15mg weekly', 'Ciprofloxacin 500mg bd'], ['Metoject 15mg', 'Ciproxin 500mg']]],
    [['methotrexate', 'co-amoxiclav'], 'moderate',
      'Risk of methotrexate accumulation and toxicity',
      'Use alternative antibiotic where possible; monitor FBC',
      [['methotrexate', 'Co-amoxiclav 625mg tds'], ['Maxtrex 2.5mg', 'Augmentin 1.2g IV']]],
    [['clopidogrel', 'lansoprazole'], 'moderate',
      'Reduced antiplatelet effect',
      'Prefer pantoprazole; cardiologist input for dual antiplatelet patients',
      [['Clopidogrel 75mg od', 'Lansoprazole 30mg od'], ['Plavix 75mg', 'Zoton FasTab 15mg']]],
  ];

  for (const [[a, b], severity, effect, action, lists] of PORTED) {
    it(`${a} + ${b} is on the rule list with the iOS grade and wording`, () => {
      const rule = INTERACTIONS.find(r => r.drugs[0] === a && r.drugs[1] === b);
      expect(rule).toEqual({ drugs: [a, b], severity, effect, action });
      // Appended after the original block: the legacy substring set is unchanged.
      expect(INTERACTIONS.indexOf(rule!)).toBeGreaterThanOrEqual(ORIGINAL_RULE_COUNT);
    });
    for (const meds of lists) {
      it(`${a} + ${b} fires for ${meds.join(' + ')}`, () => {
        expect(ruleFor(meds, a, b), JSON.stringify(checkInteractions(meds))).toBeDefined();
        expect(ruleFor([...meds].reverse(), a, b)).toBeDefined();
      });
    }
  }

  it('false-match guards: related drugs that are NOT the rule term do not fire it', () => {
    // Teicoplanin is a different glycopeptide; the rule names vancomycin only.
    expect(ruleFor(['Gentamicin 5mg/kg', 'Teicoplanin 400mg'], 'gentamicin', 'vancomycin')).toBeUndefined();
    // Aspirin is deliberately not in the NSAID class (BNF: antiplatelet).
    expect(ruleFor(['Gentamicin 5mg/kg', 'Aspirin 75mg'], 'gentamicin', 'nsaid')).toBeUndefined();
    // Levofloxacin is not ciprofloxacin ("floxacin" is never a substring match).
    expect(ruleFor(['Methotrexate 15mg weekly', 'Levofloxacin 500mg'], 'methotrexate', 'ciprofloxacin')).toBeUndefined();
    // "co-am…" diuretic combinations are not co-amoxiclav.
    expect(ruleFor(['Methotrexate 15mg weekly', 'Co-amilofruse 5/40'], 'methotrexate', 'co-amoxiclav')).toBeUndefined();
    expect(ruleFor(['Methotrexate 15mg weekly', 'Co-amilozide 2.5/25'], 'methotrexate', 'co-amoxiclav')).toBeUndefined();
    // Pantoprazole is the recommended alternative: no alert at all.
    expect(checkInteractions(['Clopidogrel 75mg', 'Pantoprazole 40mg'])).toEqual([]);
    // Dexlansoprazole is a different product name; "lansoprazole" must match as a whole word.
    expect(matchTerm('lansoprazole', 'dexlansoprazole 60mg')).toBeNull();
  });

  it('one entry naming both drugs is never paired with itself', () => {
    expect(checkInteractions(['Gentamicin + vancomycin cement spacer'])).toEqual([]);
    expect(checkInteractions(['Gentamicin + vancomycin cement spacer', 'Paracetamol 1g'])).toEqual([]);
  });
});

describe('specific-drug synonym lists shared with iOS', () => {
  const CASES: [string, string, string][] = [
    ['diclofenac', 'Voltarol 50mg', 'diclofenac'],
    ['diclofenac', 'Arthrotec 50', 'diclofenac'],
    ['ketorolac', 'Toradol 10mg', 'ketorolac'],
    ['enoxaparin', 'Clexane 40mg sc', 'enoxaparin'],
    ['enoxaparin', 'Inhixa 40mg', 'enoxaparin'],
    ['venlafaxine', 'Efexor XL 75mg', 'venlafaxine'],
    ['fentanyl', 'Durogesic 12mcg/h', 'fentanyl'],
    ['vancomycin', 'Vancocin 125mg qds', 'vancomycin'],
    ['co-amoxiclav', 'Augmentin 625mg', 'co-amoxiclav'],
    ['co-amoxiclav', 'amoxicillin-clavulanate 875/125', 'co-amoxiclav'],
    ['lansoprazole', 'Prevacid 30mg', 'lansoprazole'],
    ['ondansetron', 'Zofran 4mg', 'ondansetron'],
  ];
  for (const [term, entry, canonical] of CASES) {
    it(`${term} ← ${entry}`, () => {
      expect(DRUG_TERMS[term]?.kind).toBe('drug');
      expect(matchTerm(term, entry.toLowerCase())?.canonical).toBe(canonical);
    });
  }

  it('the new synonym lists match whole words only', () => {
    expect(matchTerm('co-amoxiclav', 'amoxicillin 500mg tds')).toBeNull();
    expect(matchTerm('diclofenac', 'aceclofenac 100mg')).toBeNull();
    expect(matchTerm('fentanyl', 'alfentanil 500mcg')).toBeNull();
    expect(matchTerm('fentanyl', 'remifentanil infusion')).toBeNull();
  });
});

// ── 4. Never remove an alert ────────────────────────────────────────────────

/** Verbatim copy of the pre-H-07 matcher, run over the original 36 rules. */
function legacyCheck(medList: string[]) {
  const original = INTERACTIONS.slice(0, ORIGINAL_RULE_COUNT);
  const lc = medList.map(m => m.toLowerCase());
  const found: { interaction: DrugInteraction; matchedA: string; matchedB: string }[] = [];
  for (const ix of original) {
    const [a, b] = ix.drugs;
    const matchA = lc.filter(m => m.includes(a));
    const matchB = lc.filter(m => m.includes(b));
    if (matchA.length > 0 && matchB.length > 0) found.push({ interaction: ix, matchedA: matchA[0], matchedB: matchB[0] });
  }
  return found;
}

describe('never-remove invariant', () => {
  it('the original rule block is intact at the head of INTERACTIONS', () => {
    expect(INTERACTIONS[0].drugs).toEqual(['warfarin', 'aspirin']);
    expect(INTERACTIONS[ORIGINAL_RULE_COUNT - 1].drugs).toEqual(['lithium', 'diuretic']);
  });

  const SAMPLE = [
    'warfarin 5mg', 'aspirin 75mg', 'nsaid prn', 'ibuprofen 400mg', 'metronidazole 400mg', 'ciprofloxacin 500mg',
    'fluconazole 150mg', 'amiodarone 200mg', 'heparin 5000 units', 'rivaroxaban 20mg', 'apixaban 5mg',
    'clopidogrel 75mg', 'omeprazole 20mg', 'esomeprazole 40mg', 'alcohol', 'theophylline', 'antacid',
    'gentamicin', 'furosemide 40mg', 'clindamycin', 'neuromuscular blocking agent', 'metformin 500mg',
    'iv contrast', 'digoxin', 'ace inhibitor', 'potassium chloride', 'losartan potassium', 'lisinopril 10mg',
    'amlodipine 5mg', 'simvastatin 40mg', 'tramadol 50mg', 'ssri', 'sertraline 50mg', 'fluoxetine 20mg',
    'opioid analgesia', 'benzodiazepine', 'morphine 10mg', 'midazolam 2mg', 'steroid', 'corticosteroid cream',
    'paracetamol 1g', 'insulin', 'beta blocker', 'maoi', 'pethidine 50mg', 'lithium', 'diuretic',
    'morphine + midazolam infusion',
    // False-match guards (iOS corpus): these must not create or remove any legacy alert.
    'Mesalazine (5-ASA, Pentasa)', 'Carbamazepine (Tegretol)', 'sodium bicarbonate', 'calcium carbonate',
    'carboplatin', 'ferric carboxymaltose', 'Venlafaxine (Efexor)', 'Linezolid', 'Clarithromycin',
  ];

  it('every pre-H-07 alert still fires (same pair, same effect, severity ≥) for all pairs and triples', () => {
    const lists: string[][] = [];
    for (let i = 0; i < SAMPLE.length; i++) {
      lists.push([SAMPLE[i]]);
      for (let j = i + 1; j < SAMPLE.length; j++) {
        lists.push([SAMPLE[i], SAMPLE[j]]);
        for (let k = j + 1; k < SAMPLE.length; k += 7) lists.push([SAMPLE[i], SAMPLE[j], SAMPLE[k]]);
      }
    }
    let checked = 0;
    for (const meds of lists) {
      const now = checkInteractions(meds);
      for (const old of legacyCheck(meds)) {
        checked++;
        const pair = [old.matchedA, old.matchedB].sort().join(' | ');
        const same = now.filter(h => [h.matchedA, h.matchedB].sort().join(' | ') === pair);
        const ok = same.some(h => allRules(h).some(r =>
          r.effect.toLowerCase() === old.interaction.effect.toLowerCase()
          && RANK[r.severity] >= RANK[old.interaction.severity])
          || (RANK[h.interaction.severity] >= RANK[old.interaction.severity]
            && h.interaction.effect.toLowerCase() === old.interaction.effect.toLowerCase()));
        expect(ok, `lost alert ${old.interaction.drugs.join('+')} for ${JSON.stringify(meds)}`).toBe(true);
      }
    }
    expect(checked).toBeGreaterThan(50);
  });
});
