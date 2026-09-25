import { useEffect, useRef, useState } from 'react';
import type { Section } from '@/context/AppContext';
import { type ConsultToolId, type ConsultTool } from '@/lib/consult-steps';

interface Props {
  tools: readonly ConsultTool[];
  /** The step on screen: its own tool is shown as "you are here" instead of opening twice. */
  activeSection: Section;
  onOpen: (tool: ConsultToolId) => void;
}

/**
 * "🧰 Tools" — Scores, Vitals, Prescriptions (and Notes, Tasks) opened in a side panel over the
 * current step, so the clinician never has to leave the step they are on (UX review top-10 #10).
 */
export default function ConsultToolsMenu({ tools, activeSection, onOpen }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (tools.length === 0) return null;

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="consult-tools"
        onClick={() => setOpen(o => !o)}
        title="Scores, vitals, prescriptions — opened over this step"
        className="wf-action"
        style={{ border: '1.5px solid #0d9488', background: open ? '#0d9488' : 'transparent', color: open ? '#fff' : '#0d9488' }}
      >
        🧰 Tools ▾
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Consultation tools"
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 900, minWidth: 220,
            background: 'var(--bg, #fff)', border: '1px solid #cbd5e1', borderRadius: 10,
            boxShadow: '0 8px 24px rgba(15,23,42,.18)', padding: 6,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 8px 6px' }}>
            Open over this step
          </div>
          {tools.map(t => {
            const here = t.id === activeSection;
            return (
              <button
                key={t.id}
                type="button"
                role="menuitem"
                disabled={here}
                data-testid={`consult-tool-${t.id}`}
                onClick={() => { setOpen(false); onOpen(t.id); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 40,
                  padding: '8px 10px', border: 'none', borderRadius: 7, textAlign: 'left',
                  background: 'transparent', color: here ? '#94a3b8' : 'var(--ink, #0f172a)',
                  fontSize: 13, fontWeight: 600, cursor: here ? 'default' : 'pointer',
                }}
              >
                <span aria-hidden="true" style={{ width: 18, textAlign: 'center' }}>{t.icon}</span>
                {t.label}
                {here && <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 500 }}>on screen</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
