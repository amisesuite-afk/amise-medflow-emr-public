import { useMemo } from 'react';
import { checkInteractions } from '@/lib/drug-interactions';

const SEV_CFG = {
  contraindicated: { bg: '#fef2f2', border: '#fca5a5', color: '#991b1b', label: 'CONTRAINDICATED', dot: '#ef4444' },
  major:           { bg: '#fff7ed', border: '#fdba74', color: '#9a3412', label: 'MAJOR',           dot: '#f97316' },
  moderate:        { bg: '#fefce8', border: '#fde68a', color: '#713f12', label: 'MODERATE',        dot: '#eab308' },
};

interface Props {
  medications: string[];
  medicationsText: string;
}

export default function DrugInteractionAlert({ medications, medicationsText }: Props) {
  const allMeds = useMemo(() => {
    const fromText = medicationsText.split(/[\n,;]+/).map(m => m.trim()).filter(Boolean);
    return [...medications, ...fromText];
  }, [medications, medicationsText]);

  const hits = useMemo(() => checkInteractions(allMeds), [allMeds]);

  if (hits.length === 0) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        Drug interaction alerts
      </div>
      {hits.map((hit, i) => {
        const cfg = SEV_CFG[hit.interaction.severity];
        return (
          <div key={i} style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 7, padding: '8px 12px', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.dot, flexShrink: 0, display: 'inline-block' }} />
              <span style={{ fontSize: 10, fontWeight: 800, color: cfg.color, letterSpacing: '0.06em' }}>{cfg.label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>
                {hit.matchedA} + {hit.matchedB}
              </span>
            </div>
            <div style={{ fontSize: 12, color: cfg.color, marginBottom: 2 }}>{hit.interaction.effect}</div>
            <div style={{ fontSize: 11, color: cfg.color, fontStyle: 'italic' }}>→ {hit.interaction.action}</div>
          </div>
        );
      })}
    </div>
  );
}
