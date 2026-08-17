import { useAppContext } from '@/context/AppContext';
import { usePathway } from '@/lib/usePathway';

/** Auto-surfaces suggested investigations once a clinical pathway match is
 * high-confidence — a dismiss-free nudge, not an auto-order. */
export default function PathwayConfidenceBanner() {
  const { topSection, setActiveSection } = useAppContext();
  const { activePathway, matchedPathways } = usePathway();
  const topMatchScore = matchedPathways[0]?.score ?? 0;
  const highConfidence = topMatchScore >= 15 && activePathway !== null;

  if (!highConfidence || !activePathway || activePathway.suggestedInvestigations.length === 0 || topSection !== 'consultation') {
    return null;
  }

  return (
    <div style={{ margin: '0 0 12px', padding: '12px 16px', borderRadius: 8, background: '#eef2ff', border: '1px solid #c7d2fe', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
      <span style={{ fontSize: 16 }}>⚑</span>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ color: '#312e81', fontWeight: 700, fontSize: 13 }}>
          Pathway match: {activePathway.name}
        </div>
        <div style={{ color: '#3730a3', fontSize: 12, marginTop: 2 }}>
          Suggested: {activePathway.suggestedInvestigations.slice(0, 6).join(', ')}
          {activePathway.suggestedInvestigations.length > 6 ? ` (+${activePathway.suggestedInvestigations.length - 6} more)` : ''}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setActiveSection('investigations')}
        style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: '#312e81', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
      >
        Go to Labs →
      </button>
    </div>
  );
}
