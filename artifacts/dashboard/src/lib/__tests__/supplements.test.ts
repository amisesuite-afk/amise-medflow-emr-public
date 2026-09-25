/**
 * Herbs, teas, bush remedies & supplements: catalogue, interaction wiring, note line, storage
 * shape (shared with iOS PathwayData.supplements) and the perioperative / "ask about" prompts.
 * iOS twin: ios/AmiseMedFlowTests/SupplementTests.swift.
 */
import { describe, expect, it } from 'vitest';
import { checkInteractions, INTERACTIONS } from '../drug-interactions';
import { DRUG_TERMS } from '../drug-classes';
import {
  EMPTY_SUPPLEMENT_HISTORY, HERBAL_PREOP_PATIENT_TEXT, SUPPLEMENT_ITEMS, SUPPLEMENT_PATIENT_QUESTION, SUPPLEMENT_PROMPTS,
  isoSeconds, matchSupplements, mergeSupplementsIntoPathwayJson, parsePathwayJson, normaliseSupplementHistory, perioperativeAlertText, recordedSupplementItems,
  searchSupplements, supplementById, supplementInteractionEntries, supplementNoteLine, type SupplementHistory,
} from '../supplement-catalogue';
import { computeSupplementPrompts, isAnaemic, leadIsRaised, labValue, type SupplementPromptInput } from '../supplement-prompts';
import { computeClinicalPrompts, type InferenceInput } from '../clinical-inference';

const taking = (...names: [string, string | null][]): SupplementHistory => ({
  status: 'taking', askedAt: '2026-09-25T14:00:00Z',
  entries: names.map(([name, catalogueId], i) => ({ id: `e${i}`, catalogueId, name, details: '' })),
});

describe('catalogue', () => {
  it('every item has a concern and a source; interaction items point at a defined drug term', () => {
    const ids = new Set<string>();
    for (const item of SUPPLEMENT_ITEMS) {
      expect(ids.has(item.id), item.id).toBe(false);
      ids.add(item.id);
      expect(item.concern.length, item.id).toBeGreaterThan(0);
      expect(item.source.length, item.id).toBeGreaterThan(0);
      if (item.term) {
        expect(DRUG_TERMS[item.term], item.id).toBeDefined();
        expect(item.names, item.id).toBe('');
        expect(INTERACTIONS.some(r => r.drugs.includes(item.term)), `${item.id} has rules`).toBe(true);
      } else {
        expect(item.names.length, item.id).toBeGreaterThan(0);
      }
    }
  });

  it('carries the briefing §7 stop times', () => {
    const stop = (id: string) => supplementById(id)!.stopTime;
    expect(stop('garlic')).toBe('at least 7 days; many advise 2 weeks');
    expect(stop('ginkgo')).toBe('at least 36 hours; SPAQI advises 2 weeks');
    expect(stop('ginseng')).toBe('at least 7 days; SPAQI advises 2 weeks');
    expect(stop('ginger')).toBe('2 weeks (SPAQI)');
    expect(stop('st_johns_wort')).toBe('at least 5 days');
    expect(stop('kava')).toBe('24 hours');
    expect(stop('valerian')).toMatch(/taper over 1–2 weeks/);
    expect(stop('echinacea')).toMatch(/stop early before transplant-type surgery/);
    expect(stop('turmeric')).toBe('2 weeks; check LFTs if symptomatic');
    expect(stop('ashwagandha')).toBe('2 weeks; check LFTs if symptomatic');
    expect(stop('ephedra')).toBe('at least 24 hours; ideally avoid entirely');
  });

  it('has the generic bush-tea entry with the identify-the-plant prompt, and no Caribbean plant as an item', () => {
    const bush = supplementById('bush_tea')!;
    expect(bush.label).toBe('Bush tea / herbal remedy (unspecified)');
    expect(bush.stopTime).toBe('identify the plant; stop non-essential herbal products 1–2 weeks before elective surgery (ASA / SPAQI) — clinician to confirm');
    for (const plant of ['cerasee', 'soursop', 'noni', 'aloe', 'moringa', 'sorrel', 'hibiscus', 'fever grass']) {
      expect(matchSupplements(plant), plant).toEqual([]);
    }
    expect(matchSupplements('bush tea from the market').map(i => i.id)).toEqual(['bush_tea']);
  });

  it('matches names, synonyms and brands as whole words', () => {
    expect(matchSupplements('Garlic 1000 mg daily').map(i => i.id)).toEqual(['garlic']);
    expect(matchSupplements('Curcumin with black pepper').map(i => i.id)).toEqual(['turmeric']);
    expect(matchSupplements("St John's wort 300 mg").map(i => i.id)).toEqual(['st_johns_wort']);
    expect(matchSupplements('Hypericum').map(i => i.id)).toEqual(['st_johns_wort']);
    expect(matchSupplements('ma huang').map(i => i.id)).toEqual(['ephedra']);
    expect(matchSupplements('KSM-66').map(i => i.id)).toEqual(['ashwagandha']);
    expect(matchSupplements('Ayurvedic bhasma').map(i => i.id)).toEqual(['ayurvedic_metals']);
    expect(matchSupplements('ephedrine 6 mg IV')).toEqual([]);     // the drug, not the herb
    expect(matchSupplements('kavalactone-free tea')).toEqual([]);   // whole words only
    expect(searchSupplements('gink').map(i => i.id)).toContain('ginkgo');
  });

  it('builds the clinician-facing perioperative alert text', () => {
    expect(perioperativeAlertText(supplementById('garlic')!)).toBe(
      'Supplement: Garlic (supplement) — Platelet inhibition; the strongest link to surgical bleeding, especially with anticoagulants. Commonly cited stop time: at least 7 days; many advise 2 weeks before elective surgery (Ang-Lee MK et al. JAMA 2001;286:208-16; Proc (Bayl Univ Med Cent) 2022).');
    expect(perioperativeAlertText(supplementById('spermidine')!)).not.toMatch(/stop time/);
  });

  it('patient wording asks and never instructs; the herbal pre-op text says why and when', () => {
    expect(SUPPLEMENT_PATIENT_QUESTION).toBe('Do you take any herbs, bush teas, bush medicines, vitamins or supplements? Please include teas and remedies from the garden or market.');
    expect(HERBAL_PREOP_PATIENT_TEXT).toMatch(/^Herbal remedies, bush teas and supplements: please stop them 2 weeks before your operation or procedure\./);
    expect(HERBAL_PREOP_PATIENT_TEXT).toMatch(/Why: /);
    expect(HERBAL_PREOP_PATIENT_TEXT).toMatch(/When: /);
    expect(HERBAL_PREOP_PATIENT_TEXT).toMatch(/do not stop any prescribed medicine unless the clinic tells you to/);
    expect(HERBAL_PREOP_PATIENT_TEXT).toMatch(/valerian every night, do not stop it suddenly/);
    // The per-product clinician stop times never reach the patient text.
    expect(HERBAL_PREOP_PATIENT_TEXT).not.toMatch(/36 hours|24 h|5 days/);
  });
});

describe('recorded supplements are screened like drugs', () => {
  it('garlic + warfarin, ginkgo + clopidogrel, turmeric + ibuprofen → major bleeding', () => {
    const h = taking(['Garlic (supplement)', 'garlic'], ['Ginkgo', 'ginkgo'], ['Turmeric / curcumin', 'turmeric']);
    const hits = checkInteractions(['Warfarin 5 mg', 'Clopidogrel 75 mg', 'Ibuprofen 400 mg', ...supplementInteractionEntries(h)]);
    const has = (a: string, b: string) => hits.some(x => [x.matchedA, x.matchedB].some(m => m.includes(a)) && [x.matchedA, x.matchedB].some(m => m.includes(b)) && x.interaction.severity === 'major');
    expect(has('warfarin', 'garlic')).toBe(true);
    expect(has('clopidogrel', 'ginkgo')).toBe(true);
    expect(has('ibuprofen', 'turmeric')).toBe(true);
  });

  it("St John's wort: warfarin, apixaban, tacrolimus, sertraline, sumatriptan, Microgynon", () => {
    const sjw = supplementInteractionEntries(taking(["St John's wort", 'st_johns_wort']));
    for (const drug of ['Warfarin 3 mg', 'Apixaban 5 mg bd', 'Tacrolimus (Prograf) 2 mg', 'Sertraline 50 mg', 'Sumatriptan 50 mg', 'Microgynon 30']) {
      const hits = checkInteractions([drug, ...sjw]);
      expect(hits.length, drug).toBe(1);
      expect(hits[0].interaction.severity, drug).toBe('major');
    }
  });

  it('ginseng + gliclazide / insulin (hypoglycaemia); kava / valerian + midazolam; ephedra + phenelzine', () => {
    expect(checkInteractions(['Gliclazide 80 mg', 'Korean ginseng'])[0].interaction.effect).toMatch(/Hypoglycaemia risk, especially in fasting patients/);
    expect(checkInteractions(['Lantus 20 units', 'Ginseng'])[0].interaction.severity).toBe('moderate');
    expect(checkInteractions(['Midazolam 2 mg', 'Kava'])[0].interaction.effect).toBe('Additive sedation / CNS depression');
    expect(checkInteractions(['Propofol', 'Valerian root'])[0].interaction.action).toMatch(/Taper valerian over 1–2 weeks/);
    expect(checkInteractions(['Phenelzine 15 mg', 'Ma huang'])[0].interaction.severity).toBe('contraindicated');
    expect(checkInteractions(['Levothyroxine 100 mcg', 'Ashwagandha'])[0].interaction.severity).toBe('moderate');
    expect(checkInteractions(['Mycophenolate 1 g', 'Echinacea'])[0].interaction.severity).toBe('moderate');
  });

  it('a free-text entry with a catalogue id but no catalogue name still matches its term', () => {
    const h = taking(['the garden tea my aunt makes', 'garlic']);
    expect(supplementInteractionEntries(h)).toEqual(['the garden tea my aunt makes (Garlic (supplement))']);
    expect(checkInteractions(['Warfarin', ...supplementInteractionEntries(h)])).toHaveLength(1);
  });

  it('non-interacting items raise nothing', () => {
    expect(checkInteractions(['Warfarin', 'Spermidine', 'cerasee tea'])).toEqual([]);
  });
});

describe('history: note line and stored shape', () => {
  it('SOAP background line', () => {
    expect(supplementNoteLine(EMPTY_SUPPLEMENT_HISTORY)).toBe('Supplements: not asked.');
    expect(supplementNoteLine({ status: 'none', entries: [], askedAt: null })).toBe('Supplements: none reported.');
    const h = taking(['Garlic (supplement)', 'garlic']);
    h.entries[0].details = '1 capsule daily';
    expect(supplementNoteLine(h)).toBe('Supplements: Garlic (supplement) (1 capsule daily).');
  });

  it('reads tolerant JSON (the iOS shape) and never throws', () => {
    expect(normaliseSupplementHistory(null)).toEqual(EMPTY_SUPPLEMENT_HISTORY);
    expect(normaliseSupplementHistory({ status: 'none' }).status).toBe('none');
    const h = normaliseSupplementHistory({
      status: 'not_asked', askedAt: '2026-09-25T14:00:00Z',
      entries: [{ id: 'A1', catalogueId: 'garlic', name: 'Garlic' }, { name: '' }, 'junk', { name: 'Cerasee', catalogueId: 'not-a-real-id' }],
    });
    expect(h.status).toBe('taking');
    expect(h.entries.map(e => [e.name, e.catalogueId])).toEqual([['Garlic', 'garlic'], ['Cerasee', null]]);
    expect(recordedSupplementItems(h).map(i => i.id)).toEqual(['garlic']);
  });

  it('writes into pathway_data_json without touching the iOS keys; dates have no milliseconds', () => {
    const existing = JSON.stringify({ burns: { mechanism: 'scald' }, wellness: { statuses: {} }, bowelPrep: { regimen: 'x' } });
    const out = JSON.parse(mergeSupplementsIntoPathwayJson(existing, taking(['Kava', 'kava'])));
    expect(out.burns).toEqual({ mechanism: 'scald' });
    expect(out.bowelPrep).toEqual({ regimen: 'x' });
    expect(out.supplements).toEqual({ status: 'taking', entries: [{ id: 'e0', catalogueId: 'kava', name: 'Kava', details: '' }], askedAt: '2026-09-25T14:00:00Z' });
    expect(parsePathwayJson('not json')).toEqual({});
    expect(isoSeconds(new Date('2026-09-25T14:00:00.123Z'))).toBe('2026-09-25T14:00:00Z');
  });
});

const base = (over: Partial<SupplementPromptInput> = {}): SupplementPromptInput => ({
  history: EMPTY_SUPPLEMENT_HISTORY, preOp: false, clinicalText: '', conditionsText: '', sex: 'female',
  pregnant: false, labs: {}, temperatureC: null, ...over,
});
const ids = (i: SupplementPromptInput) => computeSupplementPrompts(i).map(p => p.id);

describe('prompts (iOS twin: SupplementAlerts)', () => {
  it('every prompt id used has wording', () => {
    for (const id of ['not_asked', 'ashwagandha_avoid', 'liver', 'lead', 'aristolochic', 'detox', 'iv_drip', 'periop_note']) {
      expect(SUPPLEMENT_PROMPTS.some(p => p.id === id), id).toBe(true);
    }
  });

  it('mandatory question before a procedure only', () => {
    expect(ids(base({ preOp: true }))).toEqual(['not_asked']);
    expect(ids(base({ preOp: false }))).toEqual([]);
    expect(ids(base({ preOp: true, history: { status: 'none', entries: [], askedAt: null } }))).toEqual([]);
  });

  it('perioperative alert per recorded item; moderate before a procedure', () => {
    const p = computeSupplementPrompts(base({ preOp: true, history: taking(['Ginkgo', 'ginkgo']) }));
    expect(p.map(x => [x.id, x.level])).toEqual([['periop_ginkgo', 'moderate']]);
    expect(p[0].detail).toMatch(/^Supplement: Ginkgo — .* Commonly cited stop time: at least 36 hours; SPAQI advises 2 weeks before elective surgery/);
  });

  it('ashwagandha with thyroid disease, liver disease or pregnancy', () => {
    const h = taking(['Ashwagandha', 'ashwagandha']);
    expect(ids(base({ history: h, conditionsText: 'Hypothyroidism' }))).toContain('ashwagandha_avoid');
    expect(ids(base({ history: h, conditionsText: 'Cirrhosis' }))).toContain('ashwagandha_avoid');
    expect(ids(base({ history: h, pregnant: true }))).toContain('ashwagandha_avoid');
    expect(ids(base({ history: h, conditionsText: 'No thyroid disease' }))).not.toContain('ashwagandha_avoid');
  });

  it('raised LFTs / hepatitis → ask about turmeric and ashwagandha', () => {
    expect(ids(base({ labs: { ALT: '240 U/L' } }))).toContain('liver');
    expect(ids(base({ labs: { ALT: '90 U/L' } }))).not.toContain('liver');
    expect(ids(base({ labs: { 'Fasting glucose': '130' } }))).not.toContain('liver');   // "ast" inside a word
    expect(ids(base({ clinicalText: 'Deranged LFTs, cause unclear' }))).toContain('liver');
    const p = computeSupplementPrompts(base({ labs: { AST: '150' }, history: taking(['Turmeric capsules', 'turmeric']) }));
    expect(p.find(x => x.id === 'liver')!.detail).toMatch(/Recorded: Turmeric \/ curcumin\.$/);
  });

  it('anaemia / abdominal pain / neuropathy / lead → Ayurvedic products', () => {
    expect(ids(base({ labs: { Haemoglobin: '9.1 g/dL' }, clinicalText: 'Colicky abdominal pain' }))).toContain('lead');
    expect(ids(base({ labs: { Haemoglobin: '9.1 g/dL' } }))).not.toContain('lead');
    expect(ids(base({ labs: { 'Blood lead': '12 µg/dL' } }))).toContain('lead');
    expect(ids(base({ labs: { 'Blood lead': '2 µg/dL' } }))).not.toContain('lead');
    expect(ids(base({ clinicalText: 'Peripheral neuropathy', history: taking(['Ayurvedic tablets', 'ayurvedic_metals']) }))).toContain('lead');
    expect(isAnaemic(125, 'male')).toBe(true);      // g/L
    expect(isAnaemic(12.5, 'female')).toBe(false);
    expect(leadIsRaised(0.5, '0.5 umol/L')).toBe(true);
    expect(leadIsRaised(8, '8')).toBe(false);        // no unit, not judged
  });

  it('renal failure / upper-tract urothelial cancer → Chinese herbal slimming products', () => {
    const p = computeSupplementPrompts(base({ clinicalText: 'Rapidly progressive renal failure' }));
    expect(p.find(x => x.id === 'aristolochic')!.detail).toMatch(/slimming pills and Chinese herbal weight-loss products/);
    expect(ids(base({ clinicalText: 'Upper tract urothelial carcinoma' }))).toContain('aristolochic');
  });

  it('electrolytes / dehydration → detox teas; fever / line infection → IV drips', () => {
    expect(ids(base({ labs: { Potassium: '3.1' } }))).toContain('detox');
    expect(ids(base({ labs: { Sodium: '131' } }))).toContain('detox');
    expect(ids(base({ labs: { Potassium: '4.2', Sodium: '139' } }))).not.toContain('detox');
    expect(ids(base({ temperatureC: 38.4 }))).toContain('iv_drip');
    expect(ids(base({ clinicalText: 'Cellulitis at the cannula site' }))).toContain('iv_drip');
    expect(ids(base({ clinicalText: 'Afebrile' }))).not.toContain('iv_drip');
  });

  it('labValue reads whole words only', () => {
    expect(labValue({ HbA1c: '8.2', Hb: '11.0' }, ['hb'])?.value).toBe(11);
    expect(labValue({ Gastrin: '120' }, ['ast'])).toBeNull();
  });
});

describe('wired into clinical-inference', () => {
  const input = (over: Partial<InferenceInput>): InferenceInput => ({
    age: '54', sex: 'female', symptoms: [], comorbidities: [], familyHistory: [], toxicHabits: [],
    medications: [], medicationsText: '', pregnancyPossible: false, ccEntries: [], encounterType: 'surgical_consult',
    examGeneral: '', examAbdomen: '', examBreast: '', examCardio: '', examResp: '', examNeuro: '', examExtremities: '',
    investigationResults: {}, radiologyRequests: [], ...over,
  });

  it('pre-op consult: "not asked" prompt, then per-product alert with an explicit plan action', () => {
    expect(computeClinicalPrompts(input({})).some(p => p.id === 'supplement_not_asked')).toBe(true);
    const p = computeClinicalPrompts(input({ supplementHistory: taking(['Garlic', 'garlic']) }));
    const g = p.find(x => x.id === 'supplement_periop_garlic')!;
    expect(g.type).toBe('safety');
    expect(g.actions[0].addToPlan).toMatch(/Clinician to confirm\.$/);
    expect(p.some(x => x.id === 'supplement_not_asked')).toBe(false);
  });
});
