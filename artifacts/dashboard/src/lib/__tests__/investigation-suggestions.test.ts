/**
 * Suggested investigations (UX review C3): a chief complaint or a shifting differential makes
 * SUGGESTIONS only; the clinician ticks what to order; the note lists only ordered items; Labs /
 * Imaging are marked done only when something was actually ordered.
 */
import { describe, it, expect } from 'vitest';
import { suggestInvestigations, orderTickedSuggestions } from '@/lib/investigation-suggestions';
import { planPatientContext, seedInvestigations } from '@/lib/plan-builder';
import { computeSectionDone, type CompletionFields } from '@/lib/workflow-completion';
import { parseImagingToRequest } from '@/lib/imaging-utils';
import { effectBodies, functionBody, readSrc } from './helpers/source-scan';

const EMPTY: CompletionFields = {
  symptoms: [], freeText: '', vitals: {}, hpiNotes: '', comorbidities: [],
  surgicalHistory: [], surgicalNotes: '', medications: [], medicationsText: '', allergies: '',
  familyHistory: [], familyHistoryNotes: '', toxicHabits: [], occupation: '', rosFindings: {},
  examGeneral: '', examCardio: '', examResp: '', examAbdomen: '', examNeuro: '', examExtremities: '',
  examBreast: '', examWound: '', orderedInvestigations: [], radiologyRequests: [], attachments: [],
  assessment: '', plan: '', progressNotes: [],
};

describe('suggestInvestigations', () => {
  const biliary = suggestInvestigations({ complaints: ['Biliary colic'], orderedInvestigations: [], radiologyRequests: [] });

  it('lists the complaint\'s curated tests as suggestions, badged with the complaint', () => {
    expect(biliary.map(s => s.label)).toEqual(['LFTs', 'FBC', 'Amylase', 'CRP', 'USS abdomen (gallstones — sensitivity >95%)']);
    for (const s of biliary) expect(s.suggestedFor).toEqual(['Biliary colic']);
    expect(biliary.filter(s => s.kind === 'imaging').map(s => s.label)).toEqual(['USS abdomen (gallstones — sensitivity >95%)']);
  });

  it('never suggests something already ordered', () => {
    const s = suggestInvestigations({
      complaints: ['Biliary colic'], orderedInvestigations: ['LFTs', 'Full blood count FBC'],
      radiologyRequests: [parseImagingToRequest('USS abdomen')],
    });
    expect(s.map(x => x.label)).toEqual(['Amylase', 'CRP']);
  });

  it('tests seeded from the diagnosis are suggested (stat/urgent only), with the diagnosis named', () => {
    const seeded = seedInvestigations(
      { diseaseId: 'cholecystitis', icdCode: null, source: 'pane' }, planPatientContext({ age: 50, sex: 'male' }),
    ).items;
    const s = suggestInvestigations({ complaints: [], seeded, orderedInvestigations: [], radiologyRequests: [] });
    expect(s.length).toBeGreaterThan(0);
    for (const x of s) {
      expect(x.urgency).toBe('urgent'); // considered diagnosis: no stat, and routine stays tap-to-add
      expect(x.suggestedFor[0]).toMatch(/\(leading differential\)$/);
    }
  });

  it('a complaint\'s ionising imaging carries the pregnancy caveat; the orderable label stays clean', () => {
    const patient = planPatientContext({ age: 28, sex: 'female', hpiNotes: '24 weeks pregnant' });
    const s = suggestInvestigations({ complaints: ['Acute abdominal pain'], patient, orderedInvestigations: [], radiologyRequests: [] });
    const ct = s.find(x => x.label === 'CT abdomen/pelvis (contrast)');
    expect(ct?.caveat).toMatch(/pregnancy: only if ultrasound\/MRI cannot answer/);
    expect(s.find(x => x.label === 'USS abdomen')?.caveat).toBeNull();
    // No patient on record: no caveats.
    const plain = suggestInvestigations({ complaints: ['Acute abdominal pain'], orderedInvestigations: [], radiologyRequests: [] });
    expect(plain.every(x => x.caveat === null)).toBe(true);
  });
});

describe('ordering is explicit', () => {
  it('only ticked suggestions are ordered, labs and imaging each to their own list', () => {
    const all = suggestInvestigations({ complaints: ['Biliary colic'], orderedInvestigations: [], radiologyRequests: [] });
    const ticked = all.filter(s => s.label === 'LFTs' || s.kind === 'imaging');
    const next = orderTickedSuggestions(ticked, { orderedInvestigations: [], radiologyRequests: [] as ReturnType<typeof parseImagingToRequest>[] },
      s => parseImagingToRequest(s.label, s.urgency, s.suggestedFor[0]));
    expect(next.orderedInvestigations).toEqual(['LFTs']);
    expect(next.radiologyRequests).toHaveLength(1);
    expect(next.radiologyRequests[0]?.modality).toMatch(/US|Ultrasound/i);
  });

  it('Labs / Imaging are not done until something is ordered', () => {
    const done = computeSectionDone({ ...EMPTY, symptoms: ['Biliary colic'] });
    expect(done.investigations).toBe(false);
    expect(done.radiology).toBe(false);
    expect(computeSectionDone({ ...EMPTY, orderedInvestigations: ['LFTs'] }).investigations).toBe(true);
  });
});

describe('no automatic ordering (regression guard)', () => {
  it('choosing or answering a chief complaint never writes orders', () => {
    for (const f of ['components/ChiefComplaintStrip.tsx', 'pages/tabs/HpiTab.tsx']) {
      expect(readSrc(f)).not.toMatch(/setOrderedInvestigations|setRadiologyRequests/);
    }
  });

  it('the differential and plan generation never write orders', () => {
    const assessment = readSrc('pages/tabs/AssessmentTab.tsx');
    expect(assessment).not.toMatch(/setOrderedInvestigations/);
    const plan = readSrc('pages/tabs/PlanTab.tsx');
    expect(plan).not.toMatch(/setOrderedInvestigations|seedInvestigationsFromProtocol/);
    for (const body of effectBodies(assessment + plan)) expect(body).not.toMatch(/setOrderedInvestigations|setRadiologyRequests/);
  });

  it('the suggestion panel orders only in its explicit button handler', () => {
    const panel = readSrc('components/SuggestedInvestigationsPanel.tsx');
    for (const body of effectBodies(panel)) expect(body).not.toMatch(/setOrderedInvestigations|setRadiologyRequests/);
    expect(functionBody(panel, 'orderTicked')).toMatch(/setOrderedInvestigations/);
  });
});
