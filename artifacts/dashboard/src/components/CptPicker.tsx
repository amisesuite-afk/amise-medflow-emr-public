import { useState, useRef, useEffect } from 'react';
import { CPT_CODES, type CptCode } from '@/data/cpt-db';
import { useAppContext } from '@/context/AppContext';

function splitLabel(label: string): { code: string; desc: string } {
  const idx = label.indexOf(' — ');
  return idx === -1 ? { code: label, desc: '' } : { code: label.slice(0, idx), desc: label.slice(idx + 3) };
}

export default function CptPicker() {
  const { cptCodes, setCptCodes } = useAppContext();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered: CptCode[] = query.trim().length === 0
    ? []
    : CPT_CODES.filter(c =>
        c.code.toLowerCase().includes(query.toLowerCase()) ||
        c.description.toLowerCase().includes(query.toLowerCase()) ||
        c.category.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 10);

  const grouped: Record<string, CptCode[]> = {};
  for (const code of filtered) {
    if (!grouped[code.category]) grouped[code.category] = [];
    grouped[code.category].push(code);
  }

  function select(code: CptCode) {
    const label = `${code.code} — ${code.description}`;
    if (!cptCodes.includes(label)) {
      setCptCodes([...cptCodes, label]);
    }
    setQuery('');
    setOpen(false);
  }

  function remove(label: string) {
    setCptCodes(cptCodes.filter(c => c !== label));
  }

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {cptCodes.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {cptCodes.map(label => {
            const { code, desc } = splitLabel(label);
            return (
              <span
                key={label}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0,
                  borderRadius: 6,
                  border: '1px solid #d8b4fe',
                  overflow: 'hidden',
                  fontSize: 12,
                }}
              >
                <span style={{
                  padding: '4px 8px',
                  background: '#7e22ce',
                  color: '#fff',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  fontSize: 11,
                  letterSpacing: '0.04em',
                  whiteSpace: 'nowrap',
                }}>
                  {code}
                </span>
                <span style={{
                  padding: '4px 8px',
                  background: '#fdf4ff',
                  color: '#581c87',
                  fontWeight: 500,
                }}>
                  {desc}
                </span>
                <button
                  type="button"
                  onClick={() => remove(label)}
                  style={{
                    padding: '0 8px',
                    background: '#f3e8ff',
                    border: 'none',
                    borderLeft: '1px solid #d8b4fe',
                    cursor: 'pointer',
                    color: '#7e22ce',
                    fontSize: 15,
                    lineHeight: '24px',
                    alignSelf: 'stretch',
                  }}
                  title="Remove"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search CPT code or procedure name…"
        style={{ width: '100%', fontSize: 13 }}
      />

      {open && filtered.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 50,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            maxHeight: 320,
            overflowY: 'auto',
            marginTop: 2,
          }}
        >
          {Object.entries(grouped).map(([category, codes]) => (
            <div key={category}>
              <div
                style={{
                  padding: '4px 12px',
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#9ca3af',
                  letterSpacing: '0.06em',
                  background: '#f9fafb',
                  borderBottom: '1px solid #f3f4f6',
                }}
              >
                {category}
              </div>
              {codes.map(code => {
                const label = `${code.code} — ${code.description}`;
                const alreadyAdded = cptCodes.includes(label);
                return (
                  <button
                    key={code.code}
                    type="button"
                    onClick={() => select(code)}
                    disabled={alreadyAdded}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '7px 12px',
                      background: alreadyAdded ? '#fdf4ff' : 'transparent',
                      border: 'none',
                      cursor: alreadyAdded ? 'default' : 'pointer',
                      textAlign: 'left',
                      borderBottom: '1px solid #f3f4f6',
                    }}
                    onMouseEnter={e => { if (!alreadyAdded) (e.currentTarget as HTMLButtonElement).style.background = '#faf5ff'; }}
                    onMouseLeave={e => { if (!alreadyAdded) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                  >
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: 12,
                        color: '#7e22ce',
                        fontWeight: 600,
                        minWidth: 48,
                      }}
                    >
                      {code.code}
                    </span>
                    <span style={{ fontSize: 13, color: '#374151', flex: 1 }}>{code.description}</span>
                    {alreadyAdded && <span style={{ fontSize: 11, color: '#16a34a' }}>Added</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {open && query.trim().length > 0 && filtered.length === 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 50,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: '10px 12px',
            fontSize: 13,
            color: '#9ca3af',
            marginTop: 2,
          }}
        >
          No CPT codes match "{query}"
        </div>
      )}
    </div>
  );
}
