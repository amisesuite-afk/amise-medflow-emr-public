/**
 * Interactive tick-list view of a ManagementProtocol.
 *
 * Replaces the static "Generate plan" button in PlanTab with:
 *  - Diagnosis picker (pane-engine suggestions + manual fallback)
 *  - Checkbox per management step (grouped by phase)
 *  - Checkbox per investigation (with urgency badge)
 *  - Inline weight-based dose badge for weight-sensitive drugs
 *  - Disposition selector (admit / discharge / follow-up / refer)
 *  - "Apply to Plan" generates text only from ticked items
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  getProtocol,
  getAllProtocols,
  type ManagementProtocol,
  type ManagementStep,
} from '@workspace/pane-engine';
import type { RankedDiagnosis } from '@workspace/pane-engine';
import { useAppContext } from '@/context/AppContext';

// ─── Investigation label matcher ─────────────────────────────────────────────
// Returns true if the protocol investigation label plausibly matches any
// item already in the ordered-investigations list.
// Strategy: (1) uppercase abbreviation overlap, (2) significant keyword overlap.

const MED_STOP = new Set(['blood', 'urine', 'serum', 'plasma', 'total', 'level',
  'tests', 'panel', 'screen', 'rapid', 'fluid', 'whole', 'study', 'assay']);

function medAbbrevs(s: string): string[] {
  // Capture 2-6 uppercase letter runs optionally followed by lowercase 's'
  return [...s.matchAll(/\b([A-Z]{2,6})s?\b/g)].map(m => m[1].toLowerCase());
}

function medTokens(s: string): string[] {
  return s.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 5 && !MED_STOP.has(t));
}

function matchesOrdered(invLabel: string, orderedInvestigations: string[]): boolean {
  const invAbbr = new Set(medAbbrevs(invLabel));
  const invTok  = new Set(medTokens(invLabel));
  for (const ord of orderedInvestigations) {
    const ordAbbr = new Set(medAbbrevs(ord));
    const ordTok  = new Set(medTokens(ord));
    for (const a of invAbbr) if (ordAbbr.has(a)) return true;
    for (const t of invTok)  if (ordTok.has(t))  return true;
  }
  return false;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Disposition = '' | 'admit_ward' | 'admit_hdu' | 'admit_icu' | 'discharge' | 'followup' | 'day_surgery' | 'refer_urgent' | 'refer_routine';

const DISPOSITION_LABELS: Record<Disposition, string> = {
  '':              '— select —',
  admit_ward:      'Admit to surgical ward',
  admit_hdu:       'Admit to HDU',
  admit_icu:       'Admit to ICU',
  discharge:       'Discharge home',
  followup:        'Discharge with outpatient follow-up',
  day_surgery:     'List for day surgery / elective',
  refer_urgent:    'Urgent referral / transfer',
  refer_routine:   'Routine referral',
};

// ─── Weight-based dose helper ─────────────────────────────────────────────────

interface WeightDrug { keyword: string; label: string; doseFor(wt: number): string; }

const WEIGHT_DRUGS: WeightDrug[] = [
  { keyword: 'gentamicin',   label: 'Gentamicin',   doseFor: wt => `${Math.round(wt * 5)} mg IV OD (5 mg/kg)` },
  { keyword: 'vancomycin',   label: 'Vancomycin',   doseFor: wt => `Loading ${Math.min(Math.round(wt * 25), 3000)} mg IV (25 mg/kg)` },
  { keyword: 'enoxaparin',   label: 'Enoxaparin',   doseFor: wt => `Treatment: ${Math.round(wt)} mg SC BD (1 mg/kg) · Prophylaxis: 40 mg SC OD` },
  { keyword: 'morphine',     label: 'Morphine',     doseFor: wt => `${(wt * 0.1).toFixed(1)}–${(wt * 0.15).toFixed(1)} mg IV (0.1–0.15 mg/kg)` },
  { keyword: 'tramadol',     label: 'Tramadol',     doseFor: wt => `Adult: 50–100 mg QDS (fixed; max 400 mg/day)` },
  { keyword: 'paracetamol',  label: 'Paracetamol',  doseFor: wt => wt < 50 ? `${Math.round(wt * 15)} mg QDS (15 mg/kg)` : '1 g QDS (fixed dose)' },
];

function weightBadge(stepText: string, weightKg: string): WeightDrug | null {
  const wt = parseFloat(weightKg);
  if (!wt || wt <= 0 || !stepText) return null;
  const lower = stepText.toLowerCase();
  return WEIGHT_DRUGS.find(d => lower.includes(d.keyword)) ?? null;
}

// ─── Phase config ─────────────────────────────────────────────────────────────

const PHASE_ORDER: ManagementStep['phase'][] = ['immediate', 'conservative', 'surgical', 'followup'];
const PHASE_LABELS: Record<ManagementStep['phase'], string> = {
  immediate:    'Immediate',
  conservative: 'Conservative / Medical',
  surgical:     'Surgical',
  followup:     'Follow-up',
};
const PHASE_COLORS: Record<ManagementStep['phase'], string> = {
  immediate:    '#dc2626',
  conservative: '#1d4ed8',
  surgical:     '#7c3aed',
  followup:     '#0f766e',
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Top-ranked diagnoses from the pane engine (may be empty). */
  paneTop: RankedDiagnosis[];
  paneConverged: boolean;
  /** Pre-selected ICD code string from the ICD picker (optional). */
  icdCode: string | null;
  weightKg: string;
  onApplyPlan(planText: string, disposition: string): void;
}

// ─── Plan text builder ────────────────────────────────────────────────────────

function buildPlanFromSelections(
  protocol: ManagementProtocol,
  checkedSteps: Set<number>,
  checkedInvx: Set<number>,
  disposition: Disposition,
): string {
  const lines: string[] = [`## ${protocol.label}\n`];

  const stepsByPhase = new Map<ManagementStep['phase'], { step: string; idx: number }[]>();
  protocol.management.forEach((s, i) => {
    if (!checkedSteps.has(i)) return;
    if (!stepsByPhase.has(s.phase)) stepsByPhase.set(s.phase, []);
    stepsByPhase.get(s.phase)!.push({ step: s.step, idx: i });
  });

  for (const phase of PHASE_ORDER) {
    const steps = stepsByPhase.get(phase);
    if (!steps?.length) continue;
    lines.push(`### ${PHASE_LABELS[phase]}`);
    steps.forEach(s => lines.push(`- ${s.step}`));
    lines.push('');
  }

  const invxTicked = protocol.investigations.filter((_, i) => checkedInvx.has(i));
  if (invxTicked.length > 0) {
    lines.push('### Investigations');
    invxTicked.forEach(inv => lines.push(`- ${inv.label} [${inv.urgency.toUpperCase()}]`));
    lines.push('');
  }

  if (disposition) {
    lines.push(`### Disposition`);
    lines.push(`- ${DISPOSITION_LABELS[disposition]}`);
    lines.push('');
  }

  if (protocol.referral) {
    lines.push(`### Referral\n- ${protocol.referral}`);
  }

  return lines.join('\n');
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InteractiveProtocolPanel({ paneTop, paneConverged, icdCode, weightKg, onApplyPlan }: Props) {
  const { orderedInvestigations } = useAppContext();
  const allProtocols = useMemo(() => getAllProtocols(), []);

  // ── Diagnosis selection ──
  // Prefer the pane engine suggestion when converged, otherwise let the clinician pick
  const suggestedDiseaseId = (paneConverged && paneTop[0]?.probability >= 0.5)
    ? paneTop[0].disease.id
    : null;
  const [selectedDiseaseId, setSelectedDiseaseId] = useState<string>(suggestedDiseaseId ?? '');
  const [manualSearch, setManualSearch] = useState('');
  const [showManual, setShowManual] = useState(!suggestedDiseaseId);

  const protocol: ManagementProtocol | null = useMemo(() => {
    if (selectedDiseaseId) return getProtocol(selectedDiseaseId) ?? null;
    if (icdCode) {
      const code = icdCode.split(' ')[0].trim();
      return allProtocols.find((p: ManagementProtocol) => p.icd10Prefixes.some((px: string) => code.startsWith(px))) ?? null;
    }
    return null;
  }, [selectedDiseaseId, icdCode, allProtocols]);

  const filteredProtocols = useMemo(() => {
    if (!manualSearch.trim()) return allProtocols.slice(0, 12);
    const q = manualSearch.toLowerCase();
    return allProtocols.filter((p: ManagementProtocol) => p.label.toLowerCase().includes(q) || p.diseaseId.includes(q)).slice(0, 10);
  }, [manualSearch, allProtocols]);

  // ── Tick state ──
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());
  const [checkedInvx, setCheckedInvx]   = useState<Set<number>>(new Set());
  const [disposition, setDisposition]   = useState<Disposition>('');

  // Reset tick state when protocol changes; pre-populate investigations that are
  // already ordered so the plan reflects work already done in the Investigations tab.
  const [lastProtocol, setLastProtocol] = useState<string | null>(null);
  if (protocol && protocol.diseaseId !== lastProtocol) {
    setLastProtocol(protocol.diseaseId);
    setCheckedSteps(new Set());
    setDisposition('');
    const preChecked = new Set<number>(
      protocol.investigations
        .map((inv, i) => matchesOrdered(inv.label, orderedInvestigations) ? i : -1)
        .filter((i): i is number => i >= 0)
    );
    setCheckedInvx(preChecked);
  }

  // Keep investigation ticks in sync whenever orderedInvestigations changes
  // (additive only — never removes a tick the clinician manually set).
  useEffect(() => {
    if (!protocol) return;
    setCheckedInvx(prev => {
      let changed = false;
      const next = new Set(prev);
      protocol.investigations.forEach((inv, i) => {
        if (!next.has(i) && matchesOrdered(inv.label, orderedInvestigations)) {
          next.add(i);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [orderedInvestigations, protocol]);

  function toggleStep(i: number) {
    setCheckedSteps(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });
  }
  function toggleInvx(i: number) {
    setCheckedInvx(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });
  }
  function selectAll() {
    if (!protocol) return;
    setCheckedSteps(new Set(protocol.management.map((_, i) => i)));
    setCheckedInvx(new Set(protocol.investigations.map((_, i) => i)));
  }
  function clearAll() {
    setCheckedSteps(new Set());
    setCheckedInvx(new Set());
  }

  const totalItems = (protocol?.management.length ?? 0) + (protocol?.investigations.length ?? 0);
  const tickedItems = checkedSteps.size + checkedInvx.size;
  const pct = totalItems > 0 ? Math.round((tickedItems / totalItems) * 100) : 0;

  function handleApply() {
    if (!protocol) return;
    onApplyPlan(buildPlanFromSelections(protocol, checkedSteps, checkedInvx, disposition), DISPOSITION_LABELS[disposition]);
  }

  // ── Render ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Diagnosis selector ─────────────────────────────────────────── */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
          Working Diagnosis
        </div>

        {/* Pane engine suggestions */}
        {paneTop.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {paneTop.slice(0, 3).map(rd => {
              const hasProto = !!getProtocol(rd.disease.id);
              const isSelected = selectedDiseaseId === rd.disease.id;
              return (
                <button
                  key={rd.disease.id}
                  type="button"
                  disabled={!hasProto}
                  onClick={() => { setSelectedDiseaseId(rd.disease.id); setShowManual(false); }}
                  style={{
                    padding: '6px 12px', borderRadius: 7, border: `2px solid ${isSelected ? '#1d4ed8' : hasProto ? '#cbd5e1' : '#e2e8f0'}`,
                    background: isSelected ? '#eff6ff' : '#fff',
                    color: isSelected ? '#1d4ed8' : hasProto ? '#334155' : '#94a3b8',
                    fontWeight: isSelected ? 700 : 500, fontSize: 12, cursor: hasProto ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <span>{rd.disease.label}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                    background: rd.probability >= 0.7 ? '#dcfce7' : rd.probability >= 0.4 ? '#fefce8' : '#f1f5f9',
                    color: rd.probability >= 0.7 ? '#15803d' : rd.probability >= 0.4 ? '#b45309' : '#64748b',
                  }}>
                    {Math.round(rd.probability * 100)}%
                  </span>
                  {!hasProto && <span style={{ fontSize: 10, color: '#94a3b8' }}>no protocol</span>}
                </button>
              );
            })}
            <button type="button" onClick={() => setShowManual(v => !v)}
              style={{ padding: '6px 10px', borderRadius: 7, border: '1px dashed #cbd5e1', background: '#fff', color: '#64748b', fontSize: 11, cursor: 'pointer' }}>
              {showManual ? 'Hide search' : '+ Other'}
            </button>
          </div>
        )}

        {/* Manual search */}
        {(showManual || paneTop.length === 0) && (
          <div>
            <input
              style={searchInp}
              value={manualSearch}
              onChange={e => setManualSearch(e.target.value)}
              placeholder="Search diagnosis (e.g. cholecystitis, pancreatitis)…"
            />
            {filteredProtocols.length > 0 && (
              <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {filteredProtocols.map((p: ManagementProtocol) => (
                  <button key={p.diseaseId} type="button"
                    onClick={() => { setSelectedDiseaseId(p.diseaseId); setManualSearch(''); }}
                    style={{
                      padding: '4px 10px', borderRadius: 6, border: `1px solid ${selectedDiseaseId === p.diseaseId ? '#1d4ed8' : '#e2e8f0'}`,
                      background: selectedDiseaseId === p.diseaseId ? '#eff6ff' : '#fff',
                      color: selectedDiseaseId === p.diseaseId ? '#1d4ed8' : '#334155',
                      fontSize: 11, cursor: 'pointer',
                    }}>
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {protocol && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
              Protocol: <span style={{ color: '#1d4ed8' }}>{protocol.label}</span>
            </span>
            {/* Weight indicator */}
            {weightKg && (
              <span style={{ fontSize: 11, color: '#475569', background: '#f1f5f9', borderRadius: 5, padding: '2px 8px' }}>
                Weight: {weightKg} kg
              </span>
            )}
          </div>
        )}
      </div>

      {protocol && (
        <>
          {/* ── Red flags ───────────────────────────────────────────────── */}
          {protocol.redFlags.length > 0 && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                ⚠ Red Flags — escalate immediately if present
              </div>
              {protocol.redFlags.map((rf, i) => (
                <div key={i} style={{ fontSize: 12, color: '#7f1d1d', marginBottom: 3 }}>• {rf}</div>
              ))}
            </div>
          )}

          {/* ── Progress + controls ──────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 120, background: '#e2e8f0', borderRadius: 99, height: 6, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#15803d' : '#1d4ed8', borderRadius: 99, transition: 'width 0.2s' }} />
            </div>
            <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>{tickedItems}/{totalItems} selected</span>
            <button type="button" onClick={selectAll} style={chipBtn}>Select all</button>
            <button type="button" onClick={clearAll} style={chipBtn}>Clear</button>
          </div>

          {/* ── Management steps ─────────────────────────────────────────── */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px' }}>
            <div style={sectionLabel}>Management Steps</div>
            {PHASE_ORDER.map(phase => {
              const steps = protocol.management
                .map((s, i) => ({ ...s, idx: i }))
                .filter(s => s.phase === phase);
              if (!steps.length) return null;
              return (
                <div key={phase} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: PHASE_COLORS[phase], textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>
                    {PHASE_LABELS[phase]}
                  </div>
                  {steps.map(s => {
                    const wDrug = weightBadge(s.step, weightKg);
                    const checked = checkedSteps.has(s.idx);
                    return (
                      <label key={s.idx} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 8px',
                        borderRadius: 7, marginBottom: 3, cursor: 'pointer',
                        background: checked ? `${PHASE_COLORS[phase]}10` : 'transparent',
                        border: `1px solid ${checked ? PHASE_COLORS[phase] + '40' : 'transparent'}`,
                      }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleStep(s.idx)}
                          style={{ marginTop: 2, flexShrink: 0, width: 15, height: 15 }}
                        />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 13, color: '#0f172a', lineHeight: 1.4 }}>{s.step}</span>
                          {wDrug && weightKg && (
                            <div style={{ marginTop: 3, fontSize: 11, background: '#fef9c3', border: '1px solid #fde047', borderRadius: 5, padding: '2px 8px', display: 'inline-block', color: '#854d0e', fontWeight: 600 }}>
                              {wDrug.label} for {weightKg} kg → {wDrug.doseFor(parseFloat(weightKg))}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* ── Investigations ───────────────────────────────────────────── */}
          {protocol.investigations.length > 0 && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px' }}>
              <div style={sectionLabel}>Investigations</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 4 }}>
                {protocol.investigations.map((inv, i) => {
                  const checked = checkedInvx.has(i);
                  const urgColor: Record<string, string> = { stat: '#dc2626', urgent: '#b45309', routine: '#475569' };
                  return (
                    <label key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 7, cursor: 'pointer',
                      background: checked ? '#eff6ff' : 'transparent',
                      border: `1px solid ${checked ? '#bfdbfe' : 'transparent'}`,
                    }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleInvx(i)}
                        style={{ flexShrink: 0, width: 15, height: 15 }}
                      />
                      <span style={{ flex: 1, fontSize: 12, color: '#0f172a' }}>{inv.label}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, border: `1px solid ${urgColor[inv.urgency]}30`, color: urgColor[inv.urgency], background: `${urgColor[inv.urgency]}10`, flexShrink: 0 }}>
                        {inv.urgency}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Disposition ──────────────────────────────────────────────── */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px' }}>
            <div style={sectionLabel}>Disposition</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(Object.entries(DISPOSITION_LABELS) as [Disposition, string][])
                .filter(([k]) => k !== '')
                .map(([key, label]) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, cursor: 'pointer', border: `2px solid ${disposition === key ? '#1d4ed8' : '#e2e8f0'}`, background: disposition === key ? '#eff6ff' : '#fff', fontSize: 12, fontWeight: disposition === key ? 700 : 400, color: disposition === key ? '#1d4ed8' : '#334155' }}>
                    <input type="radio" name="ip-disposition" value={key} checked={disposition === key} onChange={() => setDisposition(key)} style={{ width: 14, height: 14 }} />
                    {label}
                  </label>
                ))}
            </div>
            {protocol.referral && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#475569', background: '#f1f5f9', borderRadius: 6, padding: '6px 10px' }}>
                <span style={{ fontWeight: 600 }}>Referral: </span>{protocol.referral}
              </div>
            )}
          </div>

          {/* ── Key points ──────────────────────────────────────────────── */}
          {protocol.keyPoints.length > 0 && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Clinical Pearls</div>
              {protocol.keyPoints.map((pt, i) => (
                <div key={i} style={{ fontSize: 12, color: '#14532d', marginBottom: 3 }}>• {pt}</div>
              ))}
            </div>
          )}

          {/* ── Apply button ─────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleApply}
              disabled={tickedItems === 0 && !disposition}
              style={{
                padding: '10px 24px', borderRadius: 8, border: 'none',
                background: (tickedItems > 0 || disposition) ? '#1d4ed8' : '#d1d5db',
                color: '#fff', fontWeight: 700, fontSize: 13,
                cursor: (tickedItems > 0 || disposition) ? 'pointer' : 'default',
              }}
            >
              Apply to Plan ({tickedItems} steps{disposition ? ' + disposition' : ''})
            </button>
            {tickedItems === 0 && !disposition && (
              <span style={{ fontSize: 12, color: '#94a3b8' }}>Tick items above to build a focused plan</span>
            )}
          </div>
        </>
      )}

      {!protocol && (
        <div style={{ fontSize: 12, color: '#94a3b8', padding: '12px 0' }}>
          Select a diagnosis above to load the management protocol.
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sectionLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#475569',
  textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8,
};
const chipBtn: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 6, border: '1px solid #cbd5e1',
  background: '#fff', color: '#475569', fontSize: 11, cursor: 'pointer',
};
const searchInp: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1',
  fontSize: 13, color: '#0f172a', background: '#fff', width: '100%', boxSizing: 'border-box',
};
