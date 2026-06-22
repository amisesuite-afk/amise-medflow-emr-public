import { useState, useRef, useEffect } from 'react';
import { ICD_CODES, type IcdCode } from '@/data/icd-db';
import { useAppContext } from '@/context/AppContext';

function splitLabel(label: string): { code: string; desc: string } {
  const idx = label.indexOf(' — ');
  return idx === -1 ? { code: label, desc: '' } : { code: label.slice(0, idx), desc: label.slice(idx + 3) };
}

export default function IcdPicker() {
  const { icdCodes, setIcdCodes } = useAppContext();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered: IcdCode[] = query.trim().length === 0
    ? []
    : ICD_CODES.filter(c =>
        c.code.toLowerCase().includes(query.toLowerCase()) ||
        c.description.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 20);

  // Group filtered results by category
  const grouped: Record<string, IcdCode[]> = {};
  for (const code of filtered) {
    if (!grouped[code.category]) grouped[code.category] = [];
    grouped[code.category].push(code);
  }

  function select(code: IcdCode) {
    const label = `${code.code} — ${code.description}`;
    if (!icdCodes.includes(label)) {
      setIcdCodes([...icdCodes, label]);
    }
    setQuery('');
    setOpen(false);
  }

  function remove(label: string) {
    setIcdCodes(icdCodes.filter(c => c !== label));
  }

  // Close dropdown on outside click
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
      {/* Selected codes */}
      {icdCodes.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {icdCodes.map(label => {
            const { code, desc } = splitLabel(label);
            return (
              <span
                key={label}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0,
                  borderRadius: 6,
                  border: '1px solid #7dd3fc',
                  overflow: 'hidden',
                  fontSize: 12,
                }}
              >
                <span style={{
                  padding: '4px 8px',
                  background: '#0369a1',
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
                  background: '#e0f2fe',
                  color: '#0c4a6e',
                  fontWeight: 500,
                }}>
                  {desc}
                </span>
                <button
                  type="button"
                  onClick={() => remove(label)}
                  style={{
                    padding: '0 8px',
                    background: '#bae6fd',
                    border: 'none',
                    borderLeft: '1px solid #7dd3fc',
                    cursor: 'pointer',
                    color: '#0369a1',
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

      {/* Search input */}
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search ICD-10 code or description…"
        style={{ width: '100%', fontSize: 13 }}
      />

      {/* Dropdown */}
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
            maxHeight: 300,
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
                const alreadyAdded = icdCodes.includes(label);
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
                      background: alreadyAdded ? '#f0fdf4' : 'transparent',
                      border: 'none',
                      cursor: alreadyAdded ? 'default' : 'pointer',
                      textAlign: 'left',
                      borderBottom: '1px solid #f3f4f6',
                    }}
                    onMouseEnter={e => { if (!alreadyAdded) (e.currentTarget as HTMLButtonElement).style.background = '#f0f9ff'; }}
                    onMouseLeave={e => { if (!alreadyAdded) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                  >
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: 12,
                        color: '#0369a1',
                        fontWeight: 600,
                        minWidth: 56,
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
          No ICD-10 codes match "{query}"
        </div>
      )}
    </div>
  );
}
