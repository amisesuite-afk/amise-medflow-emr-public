/**
 * ConsultContextBanner
 *
 * Algorithm-derived hints for the current consultation section, pulled
 * directly from the active CC matrix. Appears between the workflow progress
 * bar and the section content to give the clinician section-specific
 * focus points without requiring a separate reference lookup.
 */

import { useAppContext, type Section } from '@/context/AppContext';
import { getMatrix, type CCTemplate } from '@/lib/cc-matrices';

interface SectionHint {
  icon: string;
  label: string;
  items: string[];
  prose?: boolean; // render as flowing text instead of chips
}

function buildHint(matrix: CCTemplate, section: Section): SectionHint | null {
  switch (section) {
    case 'hpi':
      if (!matrix.prompts.length) return null;
      return {
        icon: '📝',
        label: 'SOCRATES prompts',
        items: matrix.prompts.slice(0, 6).map(p => p.label),
      };

    case 'examination': {
      const items: string[] = [];
      // Surface exam-relevant prompt hints (sign prompts contain physical findings)
      const signPrompt = matrix.prompts.find(p =>
        ['signs', 'exam', 'murphy', 'mass', 'hernia', 'wound', 'bowel', 'tenderness'].some(k =>
          p.key.toLowerCase().includes(k)
        )
      );
      if (signPrompt?.hint) {
        const chips = signPrompt.hint
          .split(/\s*·\s*|\s*→\s*/)
          .slice(0, 5)
          .map(s => s.replace(/\s*\([^)]*\)/g, '').trim())
          .filter(Boolean);
        items.push(...chips);
      }
      // Fallback: top DDx to differentiate
      if (!items.length && matrix.ddx.length) {
        items.push(...matrix.ddx.slice(0, 3));
        return { icon: '🩺', label: 'Differentiate', items };
      }
      return items.length ? { icon: '🩺', label: 'Elicit', items } : null;
    }

    case 'investigations':
      if (!matrix.labs.length) return null;
      return { icon: '🧪', label: 'Bloods', items: matrix.labs.slice(0, 6) };

    case 'radiology':
      if (!matrix.imaging.length) return null;
      return { icon: '📡', label: 'Imaging', items: matrix.imaging.slice(0, 3) };

    case 'assessment': {
      const items: string[] = [];
      if (matrix.icd10Hint) items.push(matrix.icd10Hint);
      items.push(...matrix.ddx.slice(0, 4).map((d, i) => `${i + 1}. ${d}`));
      return items.length ? { icon: '🎯', label: 'DDx', items } : null;
    }

    case 'plan':
      if (!matrix.pearl) return null;
      return { icon: '💡', label: 'Pearl', items: [matrix.pearl], prose: true };

    default:
      return null;
  }
}

export default function ConsultContextBanner() {
  const { activeCcKey, activeSection } = useAppContext();
  if (!activeCcKey) return null;

  const matrix = getMatrix(activeCcKey);
  if (!matrix) return null;

  const hint = buildHint(matrix, activeSection as Section);
  if (!hint) return null;

  return (
    <div style={{
      margin: '0 0 8px',
      padding: '7px 12px 8px',
      background: 'var(--surface, #1e293b)',
      border: '1px solid var(--line, #334155)',
      borderRadius: 8,
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: 13, flexShrink: 0, lineHeight: 1.8 }}>{hint.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.07em', color: '#64748b', marginRight: 8,
          lineHeight: 1.8,
        }}>
          {hint.label}
        </span>
        {hint.prose ? (
          <span style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
            {hint.items[0]}
          </span>
        ) : (
          <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4, verticalAlign: 'middle' }}>
            {hint.items.map((item, i) => (
              <span key={i} style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 20,
                background: '#0f172a', color: '#94a3b8',
                border: '1px solid #1e293b',
                whiteSpace: 'nowrap',
                lineHeight: 1.5,
              }}>
                {item}
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
