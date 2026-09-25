/**
 * Lifestyle history, fasting / sleep safety prompts and evidence-graded non-drug suggestions.
 *
 * DRIFT NOTE: the first describe block is ported one for one in
 * ios/AmiseMedFlowTests/LifestylePracticesTests.swift (same test names, same inputs, same
 * expected strings), so both platforms agree. Twin modules:
 * lib/triage-engine/src/lifestyle-practices.ts and ios/AmiseMedFlow/Services/LifestylePractices.swift.
 * Change both modules and both test files in the same PR.
 */
import { describe, expect, it } from 'vitest';
import {
  appendPlanLine, emptyLifestyleHistory, isLifestyleRecorded, lifestylePlanSuggestions,
  lifestyleSafetyPrompts, lifestyleSummary, parseLifestyleHistory, toggleFasting, toggleTherapy,
  usesDetoxOrCleanse, usesIvVitaminDrips, PLAN_LINES, PROMPT_TEXT,
  type LifestyleContext, type LifestyleHistory,
} from '@workspace/triage-engine/lifestyle-practices';
import {
  LIFESTYLE_QUESTIONS, lifestyleQuestionnaireLine, placeLifestyleQuestions,
} from '@workspace/triage-engine/lifestyle-questions';
import { createSession, processAnswer, QUESTION_BANK } from '@workspace/triage-engine/apcq';

function history(patch: Partial<LifestyleHistory> = {}): LifestyleHistory {
  return { ...emptyLifestyleHistory(), ...patch };
}

function ctx(patch: Partial<LifestyleContext> = {}): LifestyleContext {
  return {
    lifestyle: history(),
    ageYears: 45,
    diagnosisText: '',
    problemText: '',
    complaintText: '',
    medicationText: '',
    bmi: null,
    procedureBooked: false,
    ...patch,
  };
}

const ids = (xs: { id: string }[]) => xs.map(x => x.id);

// ── iOS LifestylePracticesTests, 1:1 ────────────────────────────────────────────────────────
describe('LifestylePractices (iOS parity vectors)', () => {
  it('testEmptyRecordIsNotRecorded', () => {
    const h = emptyLifestyleHistory();
    expect(isLifestyleRecorded(h)).toBe(false);
    expect(lifestyleSummary(h)).toBeNull();
  });

  it('testDecodeToleratesUnknownAndMissingValues', () => {
    const h = parseLifestyleHistory({ fasting: ['ramadan', 'bogus'], sleepHours: 30, nightShift: 'yes', extra: 1 });
    expect(h.fasting).toEqual(['ramadan']);
    expect(h.sleepHours).toBeNull();
    expect(h.nightShift).toBeNull();
    expect(h.fastingStatus).toBeNull();
    expect(parseLifestyleHistory({ fasting: ['none', 'ramadan'] }).fasting).toEqual(['ramadan']);
    expect(parseLifestyleHistory({ sleepHours: 5.5, fastingStatus: 'planned' }).sleepHours).toBe(5.5);
    expect(parseLifestyleHistory({ fastingStatus: 'sometimes' }).fastingStatus).toBeNull();
  });

  it('testSummaryWording', () => {
    expect(lifestyleSummary(history({
      fasting: ['ramadan'], fastingStatus: 'current', therapies: ['acupuncture', 'yoga'], nightShift: true, sleepHours: 5,
    }))).toBe('Fasting: Ramadan (currently fasting). Complementary therapies: Acupuncture, Yoga. Night-shift work; usual sleep 5 h a night.');
    expect(lifestyleSummary(history({ fasting: ['none'], nightShift: false })))
      .toBe('No religious or ritual fasting. No night-shift work.');
    expect(lifestyleSummary(history({
      fasting: ['other'], fastingOther: 'Ethiopian Orthodox fasts', fastingStatus: 'planned', fastingWhen: 'Hudadi, March',
    }))).toBe('Fasting: Ethiopian Orthodox fasts (next planned: Hudadi, March).');
    expect(lifestyleSummary(history({ fasting: ['daniel_fast', 'time_restricted'], fastingStatus: 'not_currently' })))
      .toBe('Fasting: Daniel Fast, Time-restricted eating / intermittent fasting (not currently fasting).');
    expect(lifestyleSummary(history({ sleepHours: 5.5 }))).toBe('Usual sleep 5.5 h a night.');
    expect(lifestyleSummary(history({ therapies: ['other'] }))).toBe('Complementary therapies: Other.');
    expect(lifestyleSummary(history({ therapies: ['detox_cleanse', 'iv_vitamin_drips'] })))
      .toBe('Complementary therapies: Detox or cleanse programmes, IV vitamin drips.');
  });

  it('testNoneIsExclusive', () => {
    let h = toggleFasting(history(), 'ramadan');
    expect(h.fasting).toEqual(['ramadan']);
    h = toggleFasting({ ...h, fastingStatus: 'current' }, 'none');
    expect(h.fasting).toEqual(['none']);
    expect(h.fastingStatus).toBeNull();
    h = toggleFasting(h, 'daniel_fast');
    expect(h.fasting).toEqual(['daniel_fast']);
    const t = toggleTherapy(toggleTherapy(history(), 'yoga'), 'yoga');
    expect(t.therapies).toEqual([]);
  });

  it('testHelpersForOtherModules', () => {
    expect(usesDetoxOrCleanse(history({ therapies: ['detox_cleanse'] }))).toBe(true);
    expect(usesDetoxOrCleanse(history({ therapies: ['yoga'] }))).toBe(false);
    expect(usesIvVitaminDrips(history({ therapies: ['iv_vitamin_drips'] }))).toBe(true);
    expect(usesIvVitaminDrips(history())).toBe(false);
  });

  it('testFastingWithInsulinOrSulfonylureaWarns', () => {
    const ramadan = history({ fasting: ['ramadan'], fastingStatus: 'current' });
    const su = lifestyleSafetyPrompts(ctx({ lifestyle: ramadan, problemText: 'Type 2 diabetes', medicationText: 'Gliclazide 80 mg BD' }));
    expect(ids(su)).toEqual(['fasting-diabetes-insulin-su']);
    expect(su[0]!.grade).toBe('warning');
    expect(su[0]!.text).toBe(PROMPT_TEXT.fastingInsulin);
    expect(su[0]!.text).toBe('Fasting with insulin/sulfonylurea: risk of hypoglycaemia and dehydration — pre-fast risk stratification and medication review recommended (IDF-DAR 2021).');
    const insulin = lifestyleSafetyPrompts(ctx({ lifestyle: ramadan, problemText: 'Diabetic', medicationText: 'Lantus 20 units nocte' }));
    expect(ids(insulin)).toEqual(['fasting-diabetes-insulin-su']);
    // Insulin written in the problem list counts too.
    const inPmh = lifestyleSafetyPrompts(ctx({ lifestyle: ramadan, problemText: 'Type 1 diabetes on insulin pump' }));
    expect(ids(inPmh)).toEqual(['fasting-diabetes-insulin-su']);
  });

  it('testFastingWithDiabetesOnOtherAgentsIsLowerGrade', () => {
    const lent = history({ fasting: ['orthodox_lent'], fastingStatus: 'planned', fastingWhen: 'Lent' });
    const p = lifestyleSafetyPrompts(ctx({ lifestyle: lent, problemText: 'T2DM', medicationText: 'Metformin 500 mg BD' }));
    expect(ids(p)).toEqual(['fasting-diabetes']);
    expect(p[0]!.grade).toBe('caution');
    expect(p[0]!.text).toBe('Fasting with diabetes: risk of hypoglycaemia and dehydration — pre-fast risk stratification recommended (IDF-DAR 2021).');
    // "Non-insulin-dependent" is not insulin.
    const niddm = lifestyleSafetyPrompts(ctx({ lifestyle: lent, problemText: 'Non-insulin-dependent diabetes' }));
    expect(ids(niddm)).toEqual(['fasting-diabetes']);
  });

  it('testFastingPromptsNeedDiabetesAndAnActiveFast', () => {
    const ramadan = history({ fasting: ['ramadan'] });   // status not recorded: still counts
    expect(ids(lifestyleSafetyPrompts(ctx({ lifestyle: ramadan, problemText: 'Diabetes mellitus', medicationText: 'Insulin glargine' }))))
      .toEqual(['fasting-diabetes-insulin-su']);
    const notNow = history({ fasting: ['ramadan'], fastingStatus: 'not_currently' });
    expect(lifestyleSafetyPrompts(ctx({ lifestyle: notNow, problemText: 'Diabetes mellitus', medicationText: 'Insulin glargine' }))).toEqual([]);
    const none = history({ fasting: ['none'] });
    expect(lifestyleSafetyPrompts(ctx({ lifestyle: none, problemText: 'Diabetes mellitus', medicationText: 'Insulin glargine' }))).toEqual([]);
    expect(lifestyleSafetyPrompts(ctx({ lifestyle: ramadan, problemText: 'No diabetes', medicationText: 'Insulin glargine' }))).toEqual([]);
    expect(lifestyleSafetyPrompts(ctx({ lifestyle: ramadan, problemText: 'Pre-diabetes' }))).toEqual([]);
    expect(lifestyleSafetyPrompts(ctx({ lifestyle: ramadan, problemText: 'Diabetes insipidus' }))).toEqual([]);
    expect(lifestyleSafetyPrompts(ctx({ lifestyle: ramadan, problemText: 'Insulin resistance' }))).toEqual([]);
    // Time-restricted eating with insulin also warns (fasting windows).
    const tre = history({ fasting: ['time_restricted'], fastingStatus: 'current' });
    expect(ids(lifestyleSafetyPrompts(ctx({ lifestyle: tre, problemText: 'Type 2 diabetes', medicationText: 'Humalog' }))))
      .toEqual(['fasting-diabetes-insulin-su']);
  });

  it('testReligiousFastWithABookedProcedure', () => {
    const ramadan = history({ fasting: ['ramadan'], fastingStatus: 'current' });
    const p = lifestyleSafetyPrompts(ctx({ lifestyle: ramadan, procedureBooked: true }));
    expect(ids(p)).toEqual(['fasting-perioperative']);
    expect(p[0]!.text).toBe('Religious fast overlaps the pre-operative fast — check hydration and glucose plan.');
    // Both prompts, most serious first.
    const both = lifestyleSafetyPrompts(ctx({ lifestyle: ramadan, procedureBooked: true, problemText: 'Type 2 diabetes', medicationText: 'Glimepiride' }));
    expect(ids(both)).toEqual(['fasting-diabetes-insulin-su', 'fasting-perioperative']);
    // Time-restricted eating is not a religious fast; no procedure, no prompt.
    const tre = history({ fasting: ['time_restricted'], fastingStatus: 'current' });
    expect(lifestyleSafetyPrompts(ctx({ lifestyle: tre, procedureBooked: true }))).toEqual([]);
    expect(lifestyleSafetyPrompts(ctx({ lifestyle: ramadan, procedureBooked: false }))).toEqual([]);
  });

  it('testNightShiftAndShortSleepInCardiometabolicContext', () => {
    const shift = history({ nightShift: true });
    const p = lifestyleSafetyPrompts(ctx({ lifestyle: shift, problemText: 'Hypertension' }));
    expect(ids(p)).toEqual(['night-shift-short-sleep']);
    expect(p[0]!.grade).toBe('info');
    expect(p[0]!.text).toBe('Night-shift work / short sleep is associated with metabolic, cardiovascular and mood disorders.');
    expect(lifestyleSafetyPrompts(ctx({ lifestyle: shift, problemText: 'Inguinal hernia' }))).toEqual([]);
    expect(ids(lifestyleSafetyPrompts(ctx({ lifestyle: history({ sleepHours: 5 }), bmi: 32 })))).toEqual(['night-shift-short-sleep']);
    expect(lifestyleSafetyPrompts(ctx({ lifestyle: history({ sleepHours: 6 }), bmi: 32 }))).toEqual([]);
    expect(ids(lifestyleSafetyPrompts(ctx({ lifestyle: history({ sleepHours: 5.5 }), problemText: 'Hypercholesterolaemia' }))))
      .toEqual(['night-shift-short-sleep']);
    expect(lifestyleSafetyPrompts(ctx({ lifestyle: history({ nightShift: false, sleepHours: 7 }), problemText: 'Hypertension' }))).toEqual([]);
  });

  it('testTaiChiForOlderAdultsAndFalls', () => {
    const s65 = lifestylePlanSuggestions(ctx({ ageYears: 65 }));
    expect(ids(s65)).toEqual(['tai-chi']);
    expect(s65[0]!.evidence).toBe('Works');
    expect(s65[0]!.reason).toBe('Age 65 (≥ 65)');
    expect(s65[0]!.planLine).toBe('Non-drug: tai chi programme for balance and falls prevention (evidence: works — 24 RCTs, falls RR 0.76; Huang ZG et al. 2023).');
    expect(lifestylePlanSuggestions(ctx({ ageYears: 64 }))).toEqual([]);
    expect(lifestylePlanSuggestions(ctx({ ageYears: null }))).toEqual([]);
    const falls = lifestylePlanSuggestions(ctx({ ageYears: 58, problemText: 'Recurrent falls' }));
    expect(falls[0]!.reason).toBe('falls or frailty recorded');
    const postOp = lifestylePlanSuggestions(ctx({ ageYears: 70, procedureBooked: true, problemText: 'Frail' }));
    expect(postOp[0]!.reason).toBe('Age 70 (≥ 65); falls or frailty recorded; post-operative rehabilitation');
  });

  it('testBackPainSuggestsYogaAndAcupuncture', () => {
    const s = lifestylePlanSuggestions(ctx({ complaintText: 'Chronic low back pain' }));
    expect(ids(s)).toEqual(['yoga', 'acupuncture']);
    expect(s[0]!.evidence).toBe('Works');
    expect(s[0]!.planLine).toBe(PLAN_LINES.yoga);
    expect(s[1]!.evidence).toBe('Modest');
    expect(lifestylePlanSuggestions(ctx({ complaintText: 'Abdominal pain. No back pain' }))).toEqual([]);
    expect(ids(lifestylePlanSuggestions(ctx({ problemText: 'Osteoarthritis of the knee' })))).toEqual(['acupuncture']);
    expect(ids(lifestylePlanSuggestions(ctx({ problemText: 'Migraine' })))).toEqual(['acupuncture']);
    const already = lifestylePlanSuggestions(ctx({ complaintText: 'Back pain', lifestyle: history({ therapies: ['yoga'] }) }));
    expect(already[0]!.alreadyUsed).toBe(true);
    expect(already[1]!.alreadyUsed).toBe(false);
  });

  it('testDepressionSuggestsMbctReferral', () => {
    const s = lifestylePlanSuggestions(ctx({ problemText: 'Recurrent depression' }));
    expect(ids(s)).toEqual(['mbct']);
    expect(s[0]!.planLine).toBe('Referral option: mindfulness-based cognitive therapy (MBCT) for relapse prevention in recurrent depression (evidence: works — HR 0.69; Kuyken W et al., JAMA Psychiatry 2016).');
    expect(lifestylePlanSuggestions(ctx({ problemText: 'ST depression on ECG' }))).toEqual([]);
    expect(lifestylePlanSuggestions(ctx({ problemText: 'No depression' }))).toEqual([]);
  });

  it('testAnxietySuggestsSlowBreathing', () => {
    const s = lifestylePlanSuggestions(ctx({ problemText: 'Anxiety', procedureBooked: true }));
    expect(ids(s)).toEqual(['slow-breathing']);
    expect(s[0]!.evidence).toBe('Modest');
    expect(s[0]!.reason).toBe('Anxiety recorded; procedure booked');
    expect(s[0]!.planLine).toContain('not a treatment for high blood pressure');
    expect(lifestylePlanSuggestions(ctx({ problemText: 'Anxious about the procedure' }))[0]!.reason).toBe('Anxiety recorded');
  });

  it('testTimeRestrictedEatingNeedsObesity', () => {
    const s = lifestylePlanSuggestions(ctx({ bmi: 32 }));
    expect(ids(s)).toEqual(['time-restricted-eating']);
    expect(s[0]!.reason).toBe('BMI 32 (≥ 30)');
    expect(s[0]!.planLine).toBe(PLAN_LINES.timeRestricted);
    expect(lifestylePlanSuggestions(ctx({ bmi: 31.26 }))[0]!.reason).toBe('BMI 31.3 (≥ 30)');
    expect(lifestylePlanSuggestions(ctx({ bmi: 29.9 }))).toEqual([]);
    expect(lifestylePlanSuggestions(ctx({ problemText: 'Obesity' }))[0]!.reason).toBe('Obesity recorded');
    // Diabetes on insulin / a sulfonylurea: only with the fasting safety note.
    const dm = lifestylePlanSuggestions(ctx({ bmi: 33, problemText: 'Type 2 diabetes', medicationText: 'Insulin glargine' }));
    expect(dm[0]!.planLine).toBe(`${PLAN_LINES.timeRestricted} ${PLAN_LINES.timeRestrictedDiabetesNote}`);
    const metformin = lifestylePlanSuggestions(ctx({ bmi: 33, problemText: 'Type 2 diabetes', medicationText: 'Metformin' }));
    expect(metformin[0]!.planLine).toBe(PLAN_LINES.timeRestricted);
  });

  it('testNoBenefitInformationOnlyWhenRecorded', () => {
    expect(lifestylePlanSuggestions(ctx())).toEqual([]);
    const s = lifestylePlanSuggestions(ctx({ lifestyle: history({ therapies: ['cupping', 'detox_cleanse', 'iv_vitamin_drips'] }) }));
    expect(ids(s)).toEqual(['counsel-cupping', 'counsel-detox', 'counsel-iv-drips']);
    expect(s.map(x => x.evidence)).toEqual(['No benefit shown', 'No benefit shown', 'Mixed']);
    expect(s.every(x => x.kind === 'counsel')).toBe(true);
    expect(s[1]!.planLine).toBe('Discussed detox teas / colon cleanses: no reliable evidence of benefit; risks of dehydration, electrolyte disturbance and laxative dependence.');
    const other = lifestylePlanSuggestions(ctx({ lifestyle: history({ therapies: ['other'], therapiesOther: 'Colon cleanse' }) }));
    expect(ids(other)).toEqual(['counsel-detox']);
  });

  it('testAppendPlanLine', () => {
    expect(appendPlanLine('', 'Line')).toBe('Line');
    expect(appendPlanLine('Plan\n', 'Line')).toBe('Plan\nLine');
    expect(appendPlanLine('Plan\nLine', 'Line')).toBe('Plan\nLine');
  });
});

// ── Web-only ─────────────────────────────────────────────────────────────────────────────────
describe('lifestyle wording safety (hazard H-10)', () => {
  const MEDICINE = /\b(insulin|sulfonylurea|sulphonylurea|diabet\w*\s+(medic\w*|tablets?)|blood[- ]?thinn\w*|anticoagula\w*|metformin|gliclazide)\b/i;
  const INSTRUCTION = /\b(take|takes|taking|hold|holding|stop|stopping|adjust\w*|skip\w*|omit\w*|withh[eo]ld\w*|pause\w*|discontinue\w*|reduce|increase)\b/i;

  it('no prompt or plan line tells anyone to take, hold, stop or adjust a medicine', () => {
    const texts = [...Object.values(PROMPT_TEXT), ...Object.values(PLAN_LINES)];
    for (const t of texts) {
      for (const sentence of t.split(/(?<=[.!?])\s+/)) {
        expect(MEDICINE.test(sentence) && INSTRUCTION.test(sentence), sentence).toBe(false);
      }
    }
  });

  it('questionnaire wording gives no advice and names no medicine', () => {
    for (const q of Object.values(LIFESTYLE_QUESTIONS)) {
      const all = [q.text, q.helpText ?? '', ...(q.options ?? []).map(o => o.label)].join(' ');
      expect(MEDICINE.test(all), q.key).toBe(false);
      expect(INSTRUCTION.test(all), q.key).toBe(false);
    }
  });
});

describe('lifestyle questionnaire placement (APCQ)', () => {
  it('asks the lifestyle questions last in eligible templates', () => {
    const s = createSession({ sessionId: 's', templateKey: 'general_screening', mode: 'screening' });
    expect(s.queuedKeys.slice(-2)).toEqual(['religious_fasting', 'complementary_therapies']);
    expect(QUESTION_BANK.religious_fasting?.text).toBe('Do you fast for religious or other reasons (for example Ramadan, Lent, a Daniel Fast or intermittent fasting)?');
    expect(QUESTION_BANK.complementary_therapies?.text).toBe('Do you use any traditional or complementary treatments (for example acupuncture, cupping, yoga, detox or cleanse programmes, vitamin drips)?');
    const fu = createSession({ sessionId: 's', templateKey: 'follow_up', mode: 'screening' });
    expect(fu.queuedKeys).not.toContain('religious_fasting');
  });

  it('never displaces a clinical question', () => {
    let s = createSession({ sessionId: 's', templateKey: 'general_screening', mode: 'screening' });
    s = processAnswer(s, { questionKey: 'chief_complaint', value: ['abdominal_pain'] });
    const clinical = s.queuedKeys.filter(k => !k.startsWith('religious_') && k !== 'complementary_therapies');
    expect(s.queuedKeys.slice(0, clinical.length)).toEqual(clinical);
    expect(s.responses.length + s.queuedKeys.length).toBeLessThanOrEqual(18);
  });

  it('asks the timing follow-up after a fasting answer', () => {
    const q = placeLifestyleQuestions(['a', 'religious_fasting_timing', 'b'], new Set(['religious_fasting']), 'general_screening', 18);
    expect(q).toEqual(['a', 'b', 'religious_fasting_timing', 'complementary_therapies']);
    expect(placeLifestyleQuestions(['a'], new Set(), 'general_screening', 2)).toEqual(['a', 'religious_fasting']);
    expect(placeLifestyleQuestions(['a', 'b'], new Set(), 'general_screening', 2)).toEqual(['a', 'b']);
  });

  it('turns answers into short social-history lines', () => {
    expect(lifestyleQuestionnaireLine('religious_fasting', 'Ramadan')).toBe('Fasting (patient-reported): Ramadan');
    expect(lifestyleQuestionnaireLine('complementary_therapies', 'No')).toBeNull();
    expect(lifestyleQuestionnaireLine('smoking_status', 'Current smoker')).toBeUndefined();
  });
});
