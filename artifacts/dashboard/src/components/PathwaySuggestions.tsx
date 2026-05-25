import { getActivePathways } from '@/lib/clinical-pathways';
import { useAppContext } from '@/context/AppContext';

const URGENCY_META = {
  urgent:   { bg: '#fef2f2', border: '#fca5a5', titleColor: '#b91c1c', badge: '#b91c1c' },
  priority: { bg: '#fffbeb', border: '#fcd34d', titleColor: '#a16207', badge: '#a16207' },
  routine:  { bg: '#f0f9ff', border: '#7dd3fc', titleColor: '#0369a1', badge: '#0369a1' },
};

export default function PathwaySuggestions() {
  const { symptoms, symptomDetails, orderedInvestigations, setOrderedInvestigations } = useAppContext();
  const pathways = getActivePathways(symptoms, symptomDetails);

  if (pathways.length === 0) return null;

  function toggleInvestigation(item: string) {
    if (orderedInvestigations.includes(item)) {
      setOrderedInvestigations(orderedInvestigations.filter(i => i !== item));
    } else {
      setOrderedInvestigations([...orderedInvestigations, item]);
    }
  }

  return (
    <div className="ps-wrapper">
      <div className="ps-heading">
        <span className="ps-heading-icon">🧭</span>
        <span className="ps-heading-text">Clinical pathway suggestions</span>
        <span className="ps-heading-count">{pathways.length} active</span>
      </div>

      {pathways.map(p => {
        const m = URGENCY_META[p.urgency];
        return (
          <div
            key={p.id}
            className="ps-card"
            style={{ background: m.bg, borderColor: m.border }}
          >
            <div className="ps-card-header">
              <span className="ps-card-title" style={{ color: m.titleColor }}>{p.title}</span>
              <span className="ps-urgency" style={{ background: m.badge }}>{p.urgency.toUpperCase()}</span>
            </div>

            <div className="ps-body">
              <div className="ps-section">
                <div className="ps-section-lbl">Likely diagnoses</div>
                <div className="ps-chips">
                  {p.suggestedDiagnoses.map(d => (
                    <span key={d} className="ps-chip">{d}</span>
                  ))}
                </div>
              </div>

              {p.redFlags.length > 0 && (
                <div className="ps-section">
                  <div className="ps-section-lbl ps-section-lbl--danger">⚠ Red flags</div>
                  <ul className="ps-redflags">
                    {p.redFlags.map(f => <li key={f}>{f}</li>)}
                  </ul>
                </div>
              )}

              <div className="ps-section">
                <div className="ps-section-lbl">
                  Labs / Imaging
                  <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 6, color: '#6b7280' }}>
                    — click to order
                  </span>
                </div>
                <div className="ps-chips">
                  {p.labsImaging.map(l => {
                    const ordered = orderedInvestigations.includes(l);
                    return (
                      <button
                        key={l}
                        type="button"
                        className={`ps-chip ps-chip--lab${ordered ? ' ps-chip--lab-ordered' : ''}`}
                        onClick={() => toggleInvestigation(l)}
                        title={ordered ? 'Click to remove from orders' : 'Click to add to investigations'}
                        style={{
                          cursor: 'pointer',
                          background: ordered ? '#d1fae5' : undefined,
                          borderColor: ordered ? '#10b981' : undefined,
                          color: ordered ? '#065f46' : undefined,
                          fontWeight: ordered ? 600 : undefined,
                        }}
                      >
                        {ordered ? '✓ ' : ''}{l}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="ps-referral-row">
                <span className="ps-section-lbl">Referral:</span>
                <span className="ps-referral-value">{p.referral}</span>
              </div>

              {p.note && (
                <div className="ps-note">{p.note}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
