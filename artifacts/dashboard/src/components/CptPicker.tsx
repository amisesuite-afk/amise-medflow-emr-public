import { useState, useRef, useEffect } from 'react';
import { CPT_CODES, type CptCode } from '@/data/cpt-db';
import { useAppContext } from '@/context/AppContext';

const CATEGORIES = [...new Set(CPT_CODES.map(c => c.category))];

function splitLabel(label: string): { code: string; desc: string } {
  const idx = label.indexOf(' — ');
  return idx === -1 ? { code: label, desc: '' } : { code: label.slice(0, idx), desc: label.slice(idx + 3) };
}

export default function CptPicker() {
  const { cptCodes, setCptCodes } = useAppContext();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>(CATEGORIES[0]);
  const [searchOpen, setSearchOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isSearching = query.trim().length >= 2;

  const searchResults: CptCode[] = isSearching
    ? CPT_CODES.filter(c =>
        c.code.includes(query) ||
        c.description.toLowerCase().includes(query.toLowerCase()) ||
        c.category.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 16)
    : [];

  const searchGrouped: Record<string, CptCode[]> = {};
  for (const c of searchResults) {
    if (!searchGrouped[c.category]) searchGrouped[c.category] = [];
    searchGrouped[c.category].push(c);
  }

  const browseItems = CPT_CODES.filter(c => c.category === activeCategory);

  function add(code: CptCode) {
    const label = `${code.code} — ${code.description}`;
    if (!cptCodes.includes(label)) setCptCodes([...cptCodes, label]);
    setQuery('');
    setSearchOpen(false);
  }

  function remove(label: string) {
    setCptCodes(cptCodes.filter(c => c !== label));
  }

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setSearchOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Selected codes ── */}
      {cptCodes.length > 0 && (
        <div style={{
          border: '1.5px solid #e9d5ff',
          borderRadius: 10,
          overflow: 'hidden',
          boxShadow: '0 1px 4px rgba(124,58,237,.07)',
        }}>
          {cptCodes.map((label, i) => {
            const { code, desc } = splitLabel(label);
            const isFirst = i === 0;
            return (
              <div key={label} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                background: isFirst ? '#faf5ff' : '#fafafa',
                borderBottom: i < cptCodes.length - 1 ? '1px solid #f3e8ff' : 'none',
              }}>
                {/* Primary / additional badge */}
                <span style={{
                  flexShrink: 0,
                  fontSize: 9,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  padding: '3px 7px',
                  borderRadius: 4,
                  background: isFirst ? '#6d28d9' : '#e5e7eb',
                  color: isFirst ? '#fff' : '#6b7280',
                  minWidth: 66,
                  textAlign: 'center',
                }}>
                  {isFirst ? 'Primary' : 'Additional'}
                </span>
                {/* CPT code badge */}
                <span style={{
                  flexShrink: 0,
                  fontFamily: 'monospace',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#fff',
                  background: isFirst ? '#7c3aed' : '#6b7280',
                  padding: '3px 10px',
                  borderRadius: 5,
                  letterSpacing: '0.04em',
                }}>
                  {code}
                </span>
                {/* Description */}
                <span style={{
                  flex: 1,
                  fontSize: 13.5,
                  fontWeight: isFirst ? 700 : 400,
                  color: isFirst ? '#3b0764' : '#374151',
                }}>
                  {desc}
                </span>
                <button type="button" onClick={() => remove(label)} title="Remove" style={{
                  flexShrink: 0, padding: '2px 8px', background: 'none',
                  border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 18, lineHeight: 1,
                }}>×</button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Search input ── */}
      <div style={{ position: 'relative' }}>
        <span style={{
          position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
          fontSize: 16, color: '#9ca3af', pointerEvents: 'none',
        }}>🔍</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setSearchOpen(true); }}
          onFocus={e => { setSearchOpen(true); (e.target as HTMLInputElement).style.borderColor = '#7c3aed'; }}
          onBlur={e => { (e.target as HTMLInputElement).style.borderColor = '#d1d5db'; }}
          placeholder='Search CPT code or procedure  (e.g. "ERCP", "43264", "cholecystectomy")'
          style={{
            width: '100%', fontSize: 13,
            padding: '11px 14px 11px 38px',
            border: '1.5px solid #d1d5db', borderRadius: 8,
            background: '#fff', outline: 'none',
          }}
        />

        {/* ── Search results dropdown ── */}
        {searchOpen && isSearching && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 70,
            background: '#fff', border: '1px solid #e9d5ff', borderRadius: 10,
            boxShadow: '0 8px 28px rgba(0,0,0,0.14)', maxHeight: 360, overflowY: 'auto',
          }}>
            {searchResults.length === 0 ? (
              <div style={{ padding: '14px 16px', fontSize: 13, color: '#6b7280' }}>
                No CPT codes match <strong>"{query}"</strong>
              </div>
            ) : Object.entries(searchGrouped).map(([cat, codes]) => (
              <div key={cat}>
                <div style={{
                  padding: '5px 14px 4px', fontSize: 9.5, fontWeight: 800,
                  textTransform: 'uppercase', letterSpacing: '0.09em',
                  color: '#7c3aed', background: '#f5f3ff', borderBottom: '1px solid #ede9fe',
                }}>
                  {cat}
                </div>
                {codes.map(c => {
                  const added = cptCodes.includes(`${c.code} — ${c.description}`);
                  return (
                    <button key={c.code} type="button" onClick={() => add(c)} disabled={added}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                        padding: '10px 14px', background: added ? '#f5f3ff' : 'transparent',
                        border: 'none', borderBottom: '1px solid #f3f4f6',
                        cursor: added ? 'default' : 'pointer', textAlign: 'left',
                      }}
                      onMouseEnter={e => { if (!added) (e.currentTarget as HTMLButtonElement).style.background = '#faf5ff'; }}
                      onMouseLeave={e => { if (!added) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                    >
                      <span style={{
                        fontFamily: 'monospace', fontSize: 12.5, fontWeight: 700,
                        color: '#7c3aed', background: '#ede9fe', padding: '3px 8px',
                        borderRadius: 4, minWidth: 58, textAlign: 'center', flexShrink: 0,
                      }}>{c.code}</span>
                      <span style={{ flex: 1, fontSize: 13, color: '#111827', fontWeight: 500 }}>{c.description}</span>
                      {added && <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Browse by category ── */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>

        {/* Category tabs — horizontal scroll */}
        <div style={{
          display: 'flex', overflowX: 'auto', gap: 0,
          borderBottom: '1px solid #e5e7eb',
          background: '#fafafa',
          scrollbarWidth: 'none',
        }}>
          {CATEGORIES.map(cat => {
            const isActive = cat === activeCategory;
            const count = CPT_CODES.filter(c => c.category === cat && cptCodes.includes(`${c.code} — ${c.description}`)).length;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                style={{
                  flexShrink: 0,
                  padding: '8px 13px',
                  fontSize: 11.5,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#7c3aed' : '#6b7280',
                  background: isActive ? '#fff' : 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #7c3aed' : '2px solid transparent',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                {cat}
                {count > 0 && (
                  <span style={{
                    fontSize: 9, fontWeight: 800, background: '#7c3aed',
                    color: '#fff', borderRadius: 999, padding: '1px 5px',
                  }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Code grid — 2 columns */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 0,
          padding: 0,
          maxHeight: 320,
          overflowY: 'auto',
        }}>
          {browseItems.map((c, idx) => {
            const label = `${c.code} — ${c.description}`;
            const added = cptCodes.includes(label);
            const isOdd = idx % 2 === 1;
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => { if (!added) add(c); }}
                disabled={added}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '11px 14px',
                  background: added ? '#f5f3ff' : (isOdd ? '#fdfdfd' : '#fff'),
                  border: 'none',
                  borderTop: '1px solid #f3f4f6',
                  borderLeft: isOdd ? '1px solid #f3f4f6' : 'none',
                  cursor: added ? 'default' : 'pointer',
                  textAlign: 'left',
                  minWidth: 0,
                }}
                onMouseEnter={e => { if (!added) (e.currentTarget as HTMLButtonElement).style.background = '#faf5ff'; }}
                onMouseLeave={e => { if (!added) (e.currentTarget as HTMLButtonElement).style.background = added ? '#f5f3ff' : (isOdd ? '#fdfdfd' : '#fff'); }}
              >
                {/* Code badge */}
                <span style={{
                  flexShrink: 0,
                  fontFamily: 'monospace',
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: added ? '#fff' : '#7c3aed',
                  background: added ? '#7c3aed' : '#ede9fe',
                  padding: '3px 7px',
                  borderRadius: 4,
                  letterSpacing: '0.03em',
                }}>
                  {c.code}
                  {added && ' ✓'}
                </span>
                {/* Description */}
                <span style={{
                  fontSize: 12,
                  color: added ? '#6d28d9' : '#374151',
                  fontWeight: added ? 600 : 400,
                  lineHeight: 1.4,
                  overflow: 'hidden',
                }}>
                  {c.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ fontSize: 11, color: '#9ca3af' }}>
        CPT codes used for insurance pre-authorisation, billing claims, and reimbursement.
      </div>
    </div>
  );
}
