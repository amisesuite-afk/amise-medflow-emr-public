/**
 * Every screen that shows a management protocol for a patient reads it through the shared
 * plan-builder helpers (patientProtocol → pane-engine resolveProtocol + adaptProtocolForPatient),
 * never raw (docs/clinical-validation/changes/web-plan-filter-everywhere.md):
 *
 *   SummaryTab discharge summary   dischargeProtocolFill / dischargeMedicationLines
 *   InvestigationsTab              patientProtocol + investigationsWithCaveats
 *   AmbientConsultation            patientProtocol (+ investigationsWithCaveats), seedInvestigations
 *   DictionaryTab                  seedInvestigations (launch), ManagementPanel with the patient
 *   Suggested investigations       seedInvestigations (confirmed diagnosis, else the leader only)
 *
 * Each consumer's filtered output is tested for a pregnancy, a penicillin-anaphylaxis and a child
 * case, then source scans keep raw protocol reads and context-free applyModifiers calls out.
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  dischargeMedicationLines, dischargeProtocolFill, investigationsWithCaveats, patientProtocol, planPatientContext,
  seedInvestigations,
} from '../plan-builder';
import type { PlanContextSource } from '../plan-builder';
import { managementPanelSource } from '../management-panel-source';
import { parseImagingToRequest } from '../imaging-utils';
import { readSrc } from './helpers/source-scan';

const PREGNANT_26: PlanContextSource = { age: 30, sex: 'female', hpiNotes: 'G2P1, 26 weeks pregnant', allergies: '' };
const PEN_ANAPHYLAXIS: PlanContextSource = { age: 45, sex: 'female', allergies: 'Penicillin (anaphylaxis)' };
const CHILD_8: PlanContextSource = { age: 8, sex: 'male', allergies: '' };

function adapted(id: string, src: PlanContextSource) {
  const p = patientProtocol(id, null, planPatientContext(src));
  if (!p) throw new Error(`no protocol for ${id}`);
  return p;
}
const dischargeText = (id: string, src: PlanContextSource) => dischargeProtocolFill(adapted(id, src)).dischargeNotes.join('\n');

// ── SummaryTab discharge medicines ──────────────────────────────────────────────────────────

describe('SummaryTab discharge medicines — a withheld drug never appears as a medicine', () => {
  it('adult with no allergy: the protocol discharge medicines as written', () => {
    const lines = dischargeMedicationLines(adapted('perianal_abscess', { age: 45, sex: 'male', allergies: '' }));
    expect(lines.map(l => l.status)).toEqual(['medication', 'medication', 'medication']);
    expect(lines[0]?.text).toMatch(/^Co-amoxiclav 625 mg/);
  });

  it('penicillin anaphylaxis: co-amoxiclav is replaced by a withheld line with the reason and the alternative', () => {
    const lines = dischargeMedicationLines(adapted('perianal_abscess', PEN_ANAPHYLAXIS));
    const withheld = lines.filter(l => l.status === 'withheld');
    expect(withheld).toHaveLength(1);
    expect(withheld[0]?.text).toMatch(/^⚠ WITHHELD — Co-amoxiclav .*allergy: Penicillin \(anaphylaxis\)\. Alternative: Choose a non-penicillin regimen/);
    expect(lines.some(l => l.status !== 'withheld' && /co-amoxiclav|amoxicillin|penicillin/i.test(l.text))).toBe(false);
    expect(dischargeText('perianal_abscess', PEN_ANAPHYLAXIS)).not.toMatch(/^Co-amoxiclav/m);
  });

  it('penicillin anaphylaxis: the protocol\'s own alternative is named (mastitis: flucloxacillin → cefalexin) with the cephalosporin caution', () => {
    const lines = dischargeMedicationLines(adapted('mastitis', PEN_ANAPHYLAXIS));
    expect(lines.find(l => /Flucloxacillin/.test(l.text))?.text).toMatch(/WITHHELD .*Protocol alternative: Cefalexin \(listed below\)/);
    expect(lines.some(l => l.status === 'medication' && /^Cefalexin/.test(l.text))).toBe(true);
    expect(lines.some(l => l.status === 'medication' && /flucloxacillin|co-amoxiclav/i.test(l.text))).toBe(false);
    expect(dischargeText('mastitis', PEN_ANAPHYLAXIS)).toMatch(/avoid cephalosporins and carbapenems unless there is no alternative/);
  });

  it('pregnancy (26 weeks): ibuprofen is withheld with the reason; paracetamol stays', () => {
    const lines = dischargeMedicationLines(adapted('umbilical_hernia', PREGNANT_26));
    const withheld = lines.find(l => l.status === 'withheld');
    expect(withheld?.text).toMatch(/^⚠ WITHHELD — Ibuprofen .*pregnancy ≥ 20 weeks\. Avoid NSAIDs from 20 weeks' gestation .*Use paracetamol ± an opioid/);
    expect(lines.some(l => l.status === 'medication' && /ibuprofen/i.test(l.text))).toBe(false);
    expect(lines.some(l => l.status === 'medication' && /^Paracetamol/.test(l.text))).toBe(true);
  });

  it('pregnancy: a tetracycline is withheld (PID doxycycline)', () => {
    const text = dischargeText('pelvic_inflammatory_disease', PREGNANT_26);
    expect(text).toMatch(/⚠ WITHHELD — Doxycycline .*: pregnancy\. Tetracyclines are avoided in pregnancy \(BNF\)/);
    expect(text).not.toMatch(/^Doxycycline/m);
  });

  it('child (8 years): no adult dose; every medicine says "calculate per BNFc" and why', () => {
    const lines = dischargeMedicationLines(adapted('perianal_abscess', CHILD_8));
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      expect(l.status).toBe('bnfc');
      expect(l.text).toMatch(/calculate per BNFc/);
      expect(l.reason).toMatch(/under 16/);
    }
    const text = dischargeText('perianal_abscess', CHILD_8);
    expect(text).not.toMatch(/\b(625 mg|400 mg|1 g)\b/);
    expect(text).toMatch(/Under 16 \(8 years\): adult doses removed/);
  });

  it('warning signs keep the protocol red flags without the clinician-facing safety lines; follow-up keeps the referral', () => {
    const fill = dischargeProtocolFill(adapted('perianal_abscess', PEN_ANAPHYLAXIS));
    expect(fill.warningSigns.some(w => /Allergy cross-check/.test(w))).toBe(false);
    expect(fill.warningSigns.length).toBeGreaterThan(0);
    expect(fill.followUp.some(f => /^Referral: /.test(f))).toBe(true);
  });

  it('SummaryTab fills from the confirmed diagnosis through the shared helpers, never the raw protocol', () => {
    const src = readSrc('pages/tabs/SummaryTab.tsx');
    expect(src).toMatch(/confirmedPlanSource\(/);
    expect(src).toMatch(/patientProtocol\(/);
    expect(src).toMatch(/dischargeProtocolFill\(/);
    expect(src).not.toMatch(/\bgetProtocol(ByIcd)?\b/);
  });
});

// ── InvestigationsTab / Ambient: adapted investigations, caveat kept apart from the order ──

describe('InvestigationsTab and Ambient protocol investigations', () => {
  it('pregnancy: ionising imaging carries the caveat; the orderable label is the protocol wording (modality parses as CT)', () => {
    const invs = investigationsWithCaveats(adapted('bowel_obstruction', PREGNANT_26));
    const ct = invs.find(i => /^CT abdomen\/pelvis/.test(i.label));
    expect(ct?.caveat).toMatch(/pregnancy: only if ultrasound\/MRI cannot answer the question/);
    expect(ct?.label).not.toMatch(/pregnancy: only if/);
    expect(parseImagingToRequest(ct!.label).modality).toBe('CT');
    // A caveat that names other modalities never turns the request into one of them.
    expect(parseImagingToRequest(`${ct!.label} — ${ct!.caveat}`).modality).toBe('CT');
  });

  it('child: CT carries "ultrasound first"; the adult-only CT branch is resolved', () => {
    const invs = investigationsWithCaveats(adapted('appendicitis', CHILD_8));
    expect(invs.find(i => /^CT abdomen/.test(i.label))?.caveat).toMatch(/child: ultrasound first/);
  });

  it('penicillin anaphylaxis: Ambient\'s adapted protocol offers no penicillin medicine and lists what was withheld', () => {
    const p = adapted('appendicitis', PEN_ANAPHYLAXIS);
    expect((p.medications ?? []).some(m => /co-amoxiclav|amoxicillin|piperacillin|penicillin/i.test(m.drugName))).toBe(false);
    expect(p.withheld.some(w => w.from === 'medication' && /allergy/.test(w.reason))).toBe(true);
    expect(p.management.some(m => /ALLERGY — penicillin allergy recorded/.test(m.step))).toBe(true);
  });

  it('pregnancy / child: Ambient medicines are filtered (no DOAC in pregnancy; BNFc doses for a child)', () => {
    expect((adapted('deep_vein_thrombosis', PREGNANT_26).medications ?? []).some(m => /apixaban|rivaroxaban|warfarin/i.test(m.drugName))).toBe(false);
    for (const m of adapted('appendicitis', CHILD_8).medications ?? []) expect(m.dose).toMatch(/BNFc|APLS/);
  });
});

// ── Suggested investigations (seedInvestigations) and the Dictionary launch ─────────────────

describe('seedInvestigations — one diagnosis, adapted, suggestions only', () => {
  const adult = planPatientContext({ age: 45, sex: 'male', allergies: '' });

  it('the confirmed diagnosis wins over the PANE leader, and only its tests are seeded', () => {
    const source = managementPanelSource({ diseaseId: 'appendicitis', icdCode: 'K35.80', locked: true }, [], { diseaseId: 'renal_colic', probability: 0.9 });
    const seed = seedInvestigations(source, adult, { leader: { diseaseId: 'renal_colic', probability: 0.9 } });
    expect(seed.confirmed).toBe(true);
    expect(seed.protocol?.diseaseId).toBe('appendicitis');
    expect(new Set(seed.items.map(i => i.reason))).toEqual(new Set(['Acute Appendicitis']));
  });

  it('nothing confirmed: the leader only (≥ 20%), and no stat test from a diagnosis that is only being considered', () => {
    const source = managementPanelSource(null, [], { diseaseId: 'subarachnoid_haemorrhage', probability: 0.34 });
    const seed = seedInvestigations(source, adult);
    expect(seed.confirmed).toBe(false);
    expect(seed.items.every(i => i.urgency !== 'stat')).toBe(true);
    expect(seed.heldBack.map(i => i.label)).toContain('Non-contrast CT head immediately');
    expect(seed.items.every(i => /\(leading differential\)$/.test(i.reason))).toBe(true);
    // Below the 20% threshold nothing is seeded.
    expect(seedInvestigations(managementPanelSource(null, [], { diseaseId: 'appendicitis', probability: 0.1 }), adult).items).toEqual([]);
  });

  it('confirmed diagnosis without a protocol: the leading differential is used, as considered', () => {
    const preg = planPatientContext(PREGNANT_26);
    const source = managementPanelSource(null, ['O26.83 — Pregnancy-related renal disease'], null);
    const seed = seedInvestigations(source, preg, { leader: { diseaseId: 'renal_colic', probability: 0.95 } });
    expect(seed.confirmed).toBe(false);
    expect(seed.protocol?.diseaseId).toBe('renal_colic');
    // Pregnancy: the CT carries its caveat; the ultrasound does not.
    expect(seed.items.find(i => /CT KUB/.test(i.label))?.caveat).toMatch(/pregnancy: only if ultrasound\/MRI/);
    expect(seed.items.find(i => /^USS KUB/.test(i.label))?.caveat).toBeNull();
  });

  it('pregnancy: a known pregnancy gets no pregnancy test; the not-pregnant CT branch is dropped', () => {
    const seed = seedInvestigations({ diseaseId: 'appendicitis', icdCode: null, source: 'confirmed' }, planPatientContext(PREGNANT_26));
    expect(seed.items.some(i => /hcg|pregnancy test/i.test(i.label))).toBe(false);
    expect(seed.items.some(i => /not pregnant/.test(i.label))).toBe(false);
  });

  it('penicillin anaphylaxis: the seeded tests are unchanged but the adapted protocol behind them withholds penicillins', () => {
    const seed = seedInvestigations({ diseaseId: 'appendicitis', icdCode: null, source: 'confirmed' }, planPatientContext(PEN_ANAPHYLAXIS));
    expect(seed.items.length).toBeGreaterThan(0);
    expect((seed.protocol?.medications ?? []).some(m => /co-amoxiclav/i.test(m.drugName))).toBe(false);
  });

  it('child: CT is seeded with "ultrasound first"; the Dictionary launch pre-adds only caveat-free tests', () => {
    const seed = seedInvestigations({ diseaseId: 'appendicitis', icdCode: 'K35.80', source: 'confirmed' }, planPatientContext(CHILD_8));
    const ct = seed.items.find(i => /^CT abdomen/.test(i.label));
    expect(ct?.caveat).toMatch(/child: ultrasound first/);
    const dictionaryAdds = seed.items.filter(i => !i.caveat).map(i => i.label);
    expect(dictionaryAdds).not.toContain(ct?.label);
    expect(readSrc('pages/tabs/DictionaryTab.tsx')).toMatch(/items\.filter\(i => !i\.caveat\)/);
  });
});

// ── Source scans ─────────────────────────────────────────────────────────────────────────────

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== '__tests__') out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}
const SRC = fileURLToPath(new URL('../../', import.meta.url));
const rel = (f: string) => f.slice(SRC.length).replace(/\\/g, '/');

describe('no raw protocol reads for a patient (regression guard)', () => {
  it('only plan-builder.ts imports the pane-engine protocol lookups', () => {
    const offenders: string[] = [];
    for (const f of sourceFiles(SRC)) {
      const src = readSrc(rel(f));
      const imports = [...src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'@workspace\/pane-engine'/g)].map(m => m[1]).join(',');
      if (/\b(getProtocol|getProtocolByIcd|resolveProtocol|getAllProtocols)\b/.test(imports) && rel(f) !== 'lib/plan-builder.ts') offenders.push(rel(f));
    }
    expect(offenders).toEqual([]);
  });

  it('the consumers read protocols through the shared helpers', () => {
    expect(readSrc('pages/tabs/InvestigationsTab.tsx')).toMatch(/patientProtocol\(activeDiseaseId, activeIcdCode, planPatient\)/);
    expect(readSrc('pages/tabs/InvestigationsTab.tsx')).toMatch(/confirmedPlanSource\(/);
    const ambient = readSrc('components/AmbientConsultation.tsx');
    expect(ambient.match(/patientProtocol\(/g)?.length).toBeGreaterThanOrEqual(3);
    expect(ambient).toMatch(/seedInvestigations\(/);
    expect(readSrc('components/SuggestedInvestigationsPanel.tsx')).toMatch(/seedInvestigations\(managementPanelSource\(/);
    expect(readSrc('pages/tabs/DictionaryTab.tsx')).toMatch(/patient=\{hasPatient \? planPatient : null\}/);
  });

  it('every applyModifiers call passes the pregnancy context', () => {
    const missing: string[] = [];
    for (const f of sourceFiles(SRC)) {
      const src = readSrc(rel(f));
      for (const m of src.matchAll(/applyModifiers\(\s*DISEASES\b/g)) {
        // Bracket-match the call.
        let depth = 0; let end = m.index!;
        for (let i = m.index! + 'applyModifiers'.length; i < src.length; i++) {
          if (src[i] === '(') depth++;
          else if (src[i] === ')' && --depth === 0) { end = i; break; }
        }
        const call = src.slice(m.index, end + 1);
        if (!/pregnancyPossible/.test(call)) missing.push(`${rel(f)}: ${call}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
