import { useMemo, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { SYMPTOM_BRANCHES } from '@/lib/symptom-branches';
import {
  computeRankedDifferentials,
  computeDxMarkers,
  getSuggestedSymptoms,
  getLeadingDiagnosis,
  type RankedDifferential,
  type DxMarkerSet,
} from '@/lib/symptom-inference';
import { ALL_SYMPTOMS_FLAT } from '@/data/symptoms-db';

const ALL_SYMPTOMS = ALL_SYMPTOMS_FLAT;

const URGENCY_COLOR: Record<string, string> = {
  urgent:   '#b91c1c',
  priority: '#a16207',
  routine:  '#0b8278',
};

function ConfBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="ssp-bar-track">
      <div
        className="ssp-bar-fill"
        style={{ width: `${Math.min(pct, 100)}%`, background: color }}
      />
    </div>
  );
}

const DX_MARKER_CONFIG: { key: keyof DxMarkerSet; label: string; bg: string; fg: string }[] = [
  { key: 'mostCommonId',     label: '★ COMMON',      bg: '#dbeafe', fg: '#1d4ed8' },
  { key: 'clinicalBestId',   label: '⚕ CLINICAL',    bg: '#d1fae5', fg: '#065f46' },
  { key: 'demographicBestId',label: '♟ DEMOGRAPHIC',  bg: '#ede9fe', fg: '#5b21b6' },
  { key: 'anatomicalBestId', label: '⊕ ANATOMICAL',  bg: '#fef3c7', fg: '#92400e' },
  { key: 'temporalBestId',   label: '⏱ TEMPORAL',    bg: '#e0e7ff', fg: '#3730a3' },
];

function DxPanel({ ranked, symptoms, markers }: { ranked: RankedDifferential[]; symptoms: string[]; markers: DxMarkerSet | null }) {
  if (!symptoms.length) return null;
  const top3 = ranked.slice(0, 4).filter(d => d.confidence > 3);
  if (!top3.length) return null;

  return (
    <div className="ssp-dx-panel">
      <div className="ssp-dx-label">Working differentials</div>
      {top3.map((dx, i) => {
        const pills = markers
          ? DX_MARKER_CONFIG.filter(m => markers[m.key] === dx.id)
          : [];
        return (
          <div key={dx.id} className="ssp-dx-row">
            <div className="ssp-dx-name">
              <span className="ssp-dx-rank">{i + 1}</span>
              <span>{dx.name}</span>
              {dx.urgency !== 'routine' && (
                <span
                  className="ssp-dx-urgency"
                  style={{ background: URGENCY_COLOR[dx.urgency] }}
                >
                  {dx.urgency.toUpperCase()}
                </span>
              )}
              {pills.map(p => (
                <span
                  key={p.key}
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    padding: '1px 5px',
                    borderRadius: 4,
                    background: p.bg,
                    color: p.fg,
                    marginLeft: 3,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.label}
                </span>
              ))}
            </div>
            <div className="ssp-dx-bar-row">
              <ConfBar pct={dx.confidence} color={i === 0 ? URGENCY_COLOR[dx.urgency] : '#ccc'} />
              <span className="ssp-dx-pct" style={{ color: i === 0 ? URGENCY_COLOR[dx.urgency] : undefined }}>
                {dx.confidence}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WorkingDxBanner({ name, confidence, urgency }: { name: string; confidence: number; urgency: string }) {
  const color = URGENCY_COLOR[urgency] ?? URGENCY_COLOR.routine;
  return (
    <div className="ssp-working-dx" style={{ borderColor: color }}>
      <span className="ssp-working-icon" style={{ background: color }}>✓</span>
      <div className="ssp-working-body">
        <div className="ssp-working-label">Working diagnosis ({confidence}% match)</div>
        <div className="ssp-working-name" style={{ color }}>{name}</div>
      </div>
    </div>
  );
}

export default function SmartSymptomPicker() {
  const { symptoms, toggleSymptom, symptomDetails, toggleSymptomDetail, age, sex } = useAppContext();
  const [showAll, setShowAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const ageNum = age ? Number(age) : null;

  const ranked = useMemo(
    () => computeRankedDifferentials({ symptoms, symptomDetails, age: ageNum, sex }),
    [symptoms, symptomDetails, ageNum, sex],
  );

  const suggested = useMemo(
    () => getSuggestedSymptoms(ALL_SYMPTOMS, symptoms, ranked),
    [symptoms, ranked],
  );

  const leadingDx = useMemo(
    () => getLeadingDiagnosis(ranked, symptoms),
    [ranked, symptoms],
  );

  const dxMarkers = useMemo(
    () => symptoms.length > 0
      ? computeDxMarkers(ranked, { symptoms, symptomDetails, age: ageNum, sex })
      : null,
    [ranked, symptoms, symptomDetails, ageNum, sex],
  );

  const tier1 = suggested.filter(s => s.tier === 1);
  const tier2 = suggested.filter(s => s.tier === 2);
  const tier3 = suggested.filter(s => s.tier === 3);

  const activeBranches = symptoms.filter(s => SYMPTOM_BRANCHES[s]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return ALL_SYMPTOMS.filter(s =>
      s.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  return (
    <div className="ssp-wrapper">

      {/* ── Symptom search box ── */}
      <div style={{ marginBottom: 10 }}>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search symptoms…"
          style={{ width: '100%', fontSize: 13, borderRadius: 6 }}
        />
        {searchQuery.trim().length > 0 && (
          <div style={{ marginTop: 8 }}>
            {searchResults.length === 0 ? (
              <span style={{ fontSize: 12, color: '#9ca3af' }}>No symptoms match "{searchQuery}"</span>
            ) : (
              <div className="ssp-chips">
                {searchResults.map(sym => (
                  <button
                    key={sym}
                    className={`ssp-chip ssp-chip--t2 ${symptoms.includes(sym) ? 'ssp-chip--on' : ''}`}
                    onClick={() => toggleSymptom(sym)}
                  >
                    {sym}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Working dx banner ── */}
      {leadingDx && (
        <WorkingDxBanner
          name={leadingDx.name}
          confidence={leadingDx.confidence}
          urgency={leadingDx.urgency}
        />
      )}

      {/* ── Differential confidence panel ── */}
      <DxPanel ranked={ranked} symptoms={symptoms} markers={dxMarkers} />

      {/* ── Priority suggestions ── */}
      {(tier1.length > 0 || tier2.length > 0) && (
        <div className="ssp-suggestions">
          {symptoms.length === 0 && (
            <div className="ssp-hint">
              Select the presenting symptom to begin adaptive triage
            </div>
          )}

          {/* Tier 1 — large, high info-gain */}
          {tier1.length > 0 && (
            <div className="ssp-tier">
              {symptoms.length > 0 && (
                <div className="ssp-tier-label">
                  🎯 Ask next
                  <span className="ssp-tier-sub">most discriminating</span>
                </div>
              )}
              <div className="ssp-chips">
                {tier1.map(s => (
                  <button
                    key={s.symptom}
                    className={`ssp-chip ssp-chip--t1 ${symptoms.includes(s.symptom) ? 'ssp-chip--on' : ''}`}
                    onClick={() => toggleSymptom(s.symptom)}
                    title={`Info gain: ${s.infoGain}`}
                  >
                    {s.symptom}
                    <span className="ssp-chip-gain">+{s.infoGain}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tier 2 — normal size */}
          {tier2.length > 0 && symptoms.length > 0 && (
            <div className="ssp-tier">
              <div className="ssp-tier-label">
                Related symptoms
                <span className="ssp-tier-sub">may be relevant</span>
              </div>
              <div className="ssp-chips">
                {tier2.map(s => (
                  <button
                    key={s.symptom}
                    className={`ssp-chip ssp-chip--t2 ${symptoms.includes(s.symptom) ? 'ssp-chip--on' : ''}`}
                    onClick={() => toggleSymptom(s.symptom)}
                  >
                    {s.symptom}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Selected symptoms + branch questions ── */}
      {symptoms.length > 0 && (
        <div className="ssp-selected">
          <div className="ssp-selected-label">
            Selected ({symptoms.length})
          </div>
          <div className="ssp-chips">
            {symptoms.map(sym => (
              <button
                key={sym}
                className="ssp-chip ssp-chip--on ssp-chip--removable"
                onClick={() => toggleSymptom(sym)}
                title="Click to remove"
              >
                {sym} ✕
              </button>
            ))}
          </div>

          {/* Branch questions for selected symptoms */}
          {activeBranches.map(sym => (
            <div key={sym} className="ssp-branch">
              <div className="ssp-branch-title">↳ {sym}</div>
              {SYMPTOM_BRANCHES[sym].map(branch => (
                <div key={branch.question} className="ssp-branch-q">
                  <div className="ssp-branch-q-label">{branch.question}</div>
                  <div className="ssp-chips ssp-chips--compact">
                    {branch.options.map(opt => {
                      const on = (symptomDetails[sym] ?? []).includes(opt);
                      return (
                        <button
                          key={opt}
                          className={`ssp-chip ssp-chip--branch ${on ? 'ssp-chip--on' : ''}`}
                          onClick={() => toggleSymptomDetail(sym, opt)}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── Tier 3 + all symptoms (collapsed) ── */}
      <div className="ssp-all-section">
        <button
          className="ssp-all-toggle"
          onClick={() => setShowAll(v => !v)}
          aria-expanded={showAll}
        >
          <span>{showAll ? '▲ Hide' : '▼ Show'} all symptoms</span>
          {tier3.length > 0 && !showAll && (
            <span className="ssp-tier3-count">{tier3.length} low-priority hidden</span>
          )}
        </button>
        {showAll && (
          <div className="ssp-all-chips">
            {ALL_SYMPTOMS.map(sym => {
              const on = symptoms.includes(sym);
              const suggested_item = suggested.find(s => s.symptom === sym);
              const tier = suggested_item?.tier ?? 3;
              return (
                <button
                  key={sym}
                  className={`ssp-chip ${on ? 'ssp-chip--on' : ''} ssp-chip--t${on ? 'on' : tier}`}
                  onClick={() => toggleSymptom(sym)}
                >
                  {sym}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
