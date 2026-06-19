import { useState, useRef, useEffect } from 'react';
import { ICD_CODES } from '@/data/icd-db';

interface IcdDetail {
  descriptor: string;
  category: string;
  note?: string;
  alternatives?: { code: string; label: string }[];
}

const ICD_LOOKUP: Record<string, { description: string; category: string }> = {};
for (const c of ICD_CODES) {
  ICD_LOOKUP[c.code] = { description: c.description, category: c.category };
}

const ICD_DETAIL: Record<string, IcdDetail> = {
  'K81.0': {
    descriptor: 'Acute cholecystitis (acalculous)',
    category: 'Biliary',
    note: 'Use K80.0x for calculous acute cholecystitis',
    alternatives: [
      { code: 'K80.00', label: 'Gallstones + acute cholecystitis, no obstruction' },
      { code: 'K80.01', label: 'Gallstones + acute cholecystitis, with obstruction' },
      { code: 'K81.2', label: 'Acute cholecystitis with gangrene' },
      { code: 'K82.A1', label: 'Gangrene of gallbladder' },
      { code: 'K82.2', label: 'Perforation of gallbladder' },
    ],
  },
  'K27.9': {
    descriptor: 'Peptic ulcer, unspecified',
    category: 'Upper GI',
    note: 'Least-specific PUD code -- specify gastric (K25) or duodenal (K26) when site is known',
    alternatives: [
      { code: 'K25.0', label: 'Gastric ulcer, acute, with haemorrhage' },
      { code: 'K25.1', label: 'Gastric ulcer, acute, with perforation' },
      { code: 'K25.3', label: 'Gastric ulcer, acute, no haemorrhage/perforation' },
      { code: 'K25.9', label: 'Gastric ulcer, unspecified' },
      { code: 'K26.0', label: 'Duodenal ulcer, acute, with haemorrhage' },
      { code: 'K26.1', label: 'Duodenal ulcer, acute, with perforation' },
      { code: 'K26.3', label: 'Duodenal ulcer, acute, no haemorrhage/perforation' },
      { code: 'K26.9', label: 'Duodenal ulcer, unspecified' },
      { code: 'K27.0', label: 'Peptic ulcer, acute, with haemorrhage' },
      { code: 'K27.1', label: 'Peptic ulcer, acute, with perforation' },
    ],
  },
  'K85.9': {
    descriptor: 'Acute pancreatitis, unspecified',
    category: 'Biliary',
    note: 'Specify aetiology when known: biliary (K85.1), alcoholic (K85.2), idiopathic (K85.0)',
    alternatives: [
      { code: 'K85.0', label: 'Idiopathic acute pancreatitis' },
      { code: 'K85.1', label: 'Biliary acute pancreatitis' },
      { code: 'K85.2', label: 'Alcohol-induced acute pancreatitis' },
      { code: 'K86.0', label: 'Alcohol-induced chronic pancreatitis' },
      { code: 'K86.1', label: 'Other chronic pancreatitis' },
    ],
  },
};

function getDetail(code: string): IcdDetail | null {
  if (ICD_DETAIL[code]) return ICD_DETAIL[code];
  const entry = ICD_LOOKUP[code];
  if (entry) return { descriptor: entry.description, category: entry.category };
  return null;
}

interface Props {
  code: string;
  compact?: boolean;
}

const INFO_ICON = (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0, opacity: 0.6 }}>
    <circle cx={12} cy={12} r={10} />
    <line x1={12} y1={16} x2={12} y2={12} />
    <line x1={12} y1={8} x2={12.01} y2={8} />
  </svg>
);

export default function IcdCodeBadge({ code, compact }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const detail = getDetail(code);
  const curated = ICD_DETAIL[code];
  const hasPopover = !!curated;

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    document.addEventListener('touchstart', handle);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('touchstart', handle);
    };
  }, [open]);

  if (!detail) {
    return (
      <span style={{ fontFamily: 'monospace', fontSize: compact ? 10 : 12, color: '#9ca3af' }}>
        {code}
      </span>
    );
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {hasPopover ? (
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: 0, background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'monospace', fontSize: compact ? 10 : 12,
            color: '#7dd3fc',
          }}
        >
          <span>{code}</span>
          {!compact && (
            <span style={{ fontFamily: 'system-ui, sans-serif', fontSize: 11, color: '#94a3b8' }}>
              {detail.descriptor}
            </span>
          )}
          {INFO_ICON}
        </button>
      ) : (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontFamily: 'monospace', fontSize: compact ? 10 : 12, color: '#7dd3fc' }}>
            {code}
          </span>
          {!compact && (
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              {detail.descriptor}
            </span>
          )}
        </span>
      )}

      {open && curated && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          zIndex: 100,
          marginTop: 4,
          background: '#0f1f33',
          border: '1px solid #1F7A8C',
          borderRadius: 8,
          padding: '10px 12px',
          minWidth: 300,
          maxWidth: 380,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          fontSize: 12,
        }}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#7dd3fc' }}>{code}</span>
            <span style={{ color: 'rgba(255,255,255,0.92)', marginLeft: 8 }}>{curated.descriptor}</span>
          </div>

          {curated.note && (
            <div style={{
              padding: '5px 8px', borderRadius: 4, fontSize: 11, marginBottom: 8,
              background: curated.note.startsWith('Least-specific') ? '#5c3a0a' : '#1e293b',
              color: curated.note.startsWith('Least-specific') ? '#fcd34d' : '#94a3b8',
              border: curated.note.startsWith('Least-specific') ? '1px solid #92400e' : '1px solid #374151',
            }}>
              {curated.note}
            </div>
          )}

          {curated.alternatives && curated.alternatives.length > 0 && (
            <div>
              <div style={{
                fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                color: '#C8A24B', letterSpacing: '0.05em', marginBottom: 4,
              }}>
                More specific codes
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {curated.alternatives.map(alt => (
                  <div key={alt.code} style={{ display: 'flex', gap: 8, padding: '2px 0' }}>
                    <span style={{
                      fontFamily: 'monospace', fontSize: 11, color: '#7dd3fc',
                      flexShrink: 0, minWidth: 50,
                    }}>
                      {alt.code}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>
                      {alt.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
