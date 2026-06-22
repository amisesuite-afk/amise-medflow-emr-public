import CollapsibleCard from '@/components/CollapsibleCard';
import IcdCodeBadge from '@/components/IcdCode';
import { useAppContext } from '@/context/AppContext';
import { usePane } from '@/hooks/usePane';

interface Props {
  onAddDifferential: (name: string) => void;
  onExportDifferential: (text: string) => void;
}

function ProbBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 50 ? '#0b8278' : pct >= 25 ? '#0f5f76' : '#94a3b8';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
      <div style={{ flex: 1, height: 5, background: '#e4f5f2', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: color,
          borderRadius: 3, transition: 'width .35s ease',
        }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, width: 30, textAlign: 'right', flexShrink: 0 }}>
        {pct}%
      </span>
    </div>
  );
}

export default function PaneDifferential({ onAddDifferential, onExportDifferential }: Props) {
  const { age, sex, encounterId, patientId } = useAppContext();
  const parsedAge = parseInt(age, 10) || null;
  const { nextQuestion, top, converged, answer, reset, state, exportDifferential } = usePane({
    age: parsedAge,
    sex,
    encounterId,
    patientId,
  });

  const titleSuffix = converged
    ? ' — converged'
    : state.iteration > 0
      ? ` — Q${state.iteration + 1}`
      : '';

  return (
    <CollapsibleCard title={`Probabilistic Differential (PANE)${titleSuffix}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* ── Disclaimer ── */}
        <p style={{ fontSize: 11, color: '#5a706c', fontStyle: 'italic', marginBottom: 2 }}>
          Bayesian decision support only — not a diagnosis. Clinical judgement overrides all suggestions.
        </p>

        {/* ── Ranked differentials ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {top.map((r, i) => {
            const pct = Math.round(r.probability * 100);
            return (
              <div key={r.disease.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  flexShrink: 0, fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                  letterSpacing: '0.06em', color: '#5a706c', width: 16, textAlign: 'right',
                }}>
                  {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => onAddDifferential(r.disease.label)}
                  style={{
                    flexShrink: 0, textAlign: 'left', padding: 0, background: 'none', border: 'none',
                    cursor: 'pointer', fontSize: 13, fontWeight: i === 0 ? 700 : 400,
                    color: i === 0 ? '#0f2e29' : '#374151',
                    textDecoration: pct >= 40 ? 'underline dotted' : 'none',
                  }}
                  title="Click to add to differentials"
                >
                  {r.disease.label}
                </button>
                <IcdCodeBadge code={r.disease.icd10} compact />
                <ProbBar value={r.probability} />
              </div>
            );
          })}
        </div>

        {/* ── Next question or convergence notice ── */}
        {!converged && nextQuestion ? (
          <div style={{
            borderLeft: '3px solid #0b8278', paddingLeft: 10,
            background: '#f0f6f4', borderRadius: '0 6px 6px 0', padding: '10px 12px 10px 12px',
            marginTop: 4,
          }}>
            <div style={{
              fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
              letterSpacing: '0.06em', color: '#0b8278', marginBottom: 5,
            }}>
              Most informative question now
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f2e29', marginBottom: 10 }}>
              {nextQuestion.question}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => answer(nextQuestion.id, true)}
                style={{
                  padding: '5px 18px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                  background: '#0b8278', color: '#fff', border: 'none', cursor: 'pointer',
                }}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => answer(nextQuestion.id, false)}
                style={{
                  padding: '5px 18px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  background: '#fff', color: '#374151',
                  border: '1px solid #d8e8e4', cursor: 'pointer',
                }}
              >
                No
              </button>
              <span style={{ fontSize: 11, color: '#9ca3af', alignSelf: 'center', marginLeft: 4 }}>
                [{nextQuestion.category}]
              </span>
            </div>
          </div>
        ) : converged ? (
          <div style={{
            background: '#f0fdf4', border: '1px solid #86efac',
            borderRadius: 6, padding: '9px 12px',
            display: 'flex', alignItems: 'center', gap: 8, marginTop: 4,
          }}>
            <span style={{ fontSize: 16 }}>✓</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#14532d' }}>
                Engine converged after {state.iteration} question{state.iteration !== 1 ? 's' : ''}
              </div>
              <div style={{ fontSize: 11, color: '#4d7c0f' }}>
                Leading: <strong>{top[0]?.disease.label}</strong>
                {top[0] && ` (${Math.round(top[0].probability * 100)}%)`}
                {' '}— click the name above to add to differentials
              </div>
            </div>
          </div>
        ) : null}

        {/* ── Footer: answered count + export + reset ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderTop: '1px solid #e4f5f2', paddingTop: 8, marginTop: 2,
        }}>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>
            {state.iteration} / 8 questions answered
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            {state.iteration > 0 && (
              <button
                type="button"
                onClick={() => onExportDifferential(exportDifferential())}
                title="Append PANE summary to differentials field"
                style={{
                  fontSize: 11, color: '#0b8278', background: 'none',
                  border: '1px solid #0b8278', borderRadius: 4, padding: '3px 10px', cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Export to Differentials
              </button>
            )}
            <button
              type="button"
              onClick={reset}
              style={{
                fontSize: 11, color: '#5a706c', background: 'none',
                border: '1px solid #d8e8e4', borderRadius: 4, padding: '3px 10px', cursor: 'pointer',
              }}
            >
              Reset
            </button>
          </div>
        </div>

      </div>
    </CollapsibleCard>
  );
}
