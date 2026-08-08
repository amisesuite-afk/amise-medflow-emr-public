import { useState, useRef, useEffect, useMemo } from 'react';
import { CPT_CODES, type CptCode } from '@/data/cpt-db';
import { ICD_CODES } from '@/data/icd-db';
import { useAppContext } from '@/context/AppContext';

const CATEGORIES = [...new Set(CPT_CODES.map(c => c.category))];
const CPT_LOOKUP: Record<string, CptCode> = Object.fromEntries(CPT_CODES.map(c => [c.code, c]));

// ICD category → CPT category tab(s), ordered by relevance
const ICD_CAT_TO_CPT_CATS: Record<string, string[]> = {
  'Appendix':               ['Appendix'],
  'Biliary':                ['Biliary', 'ERCP', 'Hepatopancreatic'],
  'Upper GI':               ['Endoscopy — OGD', 'Upper GI Surgery'],
  'Colorectal':             ['Colorectal', 'Endoscopy — Colonoscopy', 'Anorectal'],
  'Bowel obstruction':      ['Colorectal', 'Upper GI Surgery'],
  'Hernia':                 ['Hernia'],
  'Anorectal / Perianal':   ['Anorectal'],
  'Vascular':               ['Vascular'],
  'Breast Ca':              ['Breast Surgery'],
  'Liver':                  ['Hepatopancreatic'],
  'Diabetic foot':          ['Wound & Skin', 'Vascular'],
  'Surgical complications': ['Wound & Skin'],
};

// ICD code prefix → CPT codes (more specific; longest-prefix-wins, ordered by priority)
// Sorted by descending prefix length so more specific matches win over general ones.
const ICD_PREFIX_CPT: Array<{ prefix: string; cats: string[]; cptCodes: string[] }> = [
  // Appendix
  { prefix: 'K35.2',  cats: ['Appendix'], cptCodes: ['44960', '44970', '44950'] },
  { prefix: 'K35.3',  cats: ['Appendix'], cptCodes: ['44960', '44970'] },
  { prefix: 'K35',    cats: ['Appendix'], cptCodes: ['44970', '44950', '44960'] },
  { prefix: 'K36',    cats: ['Appendix'], cptCodes: ['44970', '44950'] },
  { prefix: 'K37',    cats: ['Appendix'], cptCodes: ['44970', '44950'] },
  { prefix: 'K38',    cats: ['Appendix'], cptCodes: ['44970'] },
  // Biliary — CBD stones / cholangitis → ERCP first
  { prefix: 'K80.30', cats: ['ERCP', 'Biliary'], cptCodes: ['43264', '43260', '47562'] },
  { prefix: 'K80.31', cats: ['ERCP', 'Biliary'], cptCodes: ['43264', '43260', '47562'] },
  { prefix: 'K80.40', cats: ['ERCP', 'Biliary'], cptCodes: ['43264', '43260', '47562'] },
  { prefix: 'K80.41', cats: ['ERCP', 'Biliary'], cptCodes: ['43264', '43260', '47562'] },
  { prefix: 'K80.50', cats: ['ERCP'],             cptCodes: ['43264', '43265', '43260'] },
  { prefix: 'K80.51', cats: ['ERCP'],             cptCodes: ['43264', '43265', '43260'] },
  { prefix: 'K80.60', cats: ['ERCP', 'Biliary'], cptCodes: ['43264', '47562', '43260'] },
  { prefix: 'K80.67', cats: ['ERCP', 'Biliary'], cptCodes: ['43264', '47562', '43260'] },
  { prefix: 'K80.0',  cats: ['Biliary'],          cptCodes: ['47562', '47563', '47600'] },
  { prefix: 'K80.1',  cats: ['Biliary'],          cptCodes: ['47562', '47563', '47600'] },
  { prefix: 'K80.2',  cats: ['Biliary'],          cptCodes: ['47562', '47563', '47600'] },
  { prefix: 'K80',    cats: ['Biliary', 'ERCP'],  cptCodes: ['47562', '43264', '43260'] },
  { prefix: 'K81',    cats: ['Biliary'],          cptCodes: ['47562', '47563', '47600'] },
  { prefix: 'K82',    cats: ['Biliary'],          cptCodes: ['47562', '47600'] },
  { prefix: 'K83.0',  cats: ['ERCP', 'Biliary'], cptCodes: ['43260', '43274', '43264'] },
  { prefix: 'K83.1',  cats: ['ERCP', 'Biliary'], cptCodes: ['43274', '43277', '43260'] },
  { prefix: 'K83',    cats: ['ERCP', 'Biliary'], cptCodes: ['43260', '43274'] },
  { prefix: 'K85',    cats: ['Hepatopancreatic', 'ERCP'], cptCodes: ['48150', '43264', '47379'] },
  { prefix: 'K86',    cats: ['Hepatopancreatic'], cptCodes: ['48150', '48153', '48100'] },
  // Upper GI
  { prefix: 'K21',    cats: ['Endoscopy — OGD', 'Upper GI Surgery'], cptCodes: ['43235', '43239', '43280'] },
  { prefix: 'K22.1',  cats: ['Endoscopy — OGD'], cptCodes: ['43235', '43255', '43239'] },
  { prefix: 'K22.2',  cats: ['Endoscopy — OGD'], cptCodes: ['43257', '43235'] },
  { prefix: 'K22',    cats: ['Endoscopy — OGD'], cptCodes: ['43235', '43239'] },
  { prefix: 'K25',    cats: ['Endoscopy — OGD'], cptCodes: ['43235', '43255', '43239'] },
  { prefix: 'K26',    cats: ['Endoscopy — OGD'], cptCodes: ['43235', '43255', '43239'] },
  { prefix: 'K27',    cats: ['Endoscopy — OGD'], cptCodes: ['43235', '43255'] },
  { prefix: 'K29',    cats: ['Endoscopy — OGD'], cptCodes: ['43235', '43239', '43255'] },
  { prefix: 'K31',    cats: ['Endoscopy — OGD', 'Upper GI Surgery'], cptCodes: ['43235', '43239'] },
  // Hernia
  { prefix: 'K40',    cats: ['Hernia'], cptCodes: ['49650', '49505', '49520'] },
  { prefix: 'K41',    cats: ['Hernia'], cptCodes: ['49650', '49505'] },
  { prefix: 'K42',    cats: ['Hernia'], cptCodes: ['49659', '49650'] },
  { prefix: 'K43',    cats: ['Hernia'], cptCodes: ['49652', '49655', '49560'] },
  { prefix: 'K44',    cats: ['Hernia'], cptCodes: ['49659', '49652'] },
  { prefix: 'K45',    cats: ['Hernia'], cptCodes: ['49652', '49560'] },
  { prefix: 'K46',    cats: ['Hernia'], cptCodes: ['49659', '49650'] },
  // Colorectal
  { prefix: 'K57',    cats: ['Colorectal', 'Endoscopy — Colonoscopy'], cptCodes: ['44140', '44204', '45378'] },
  { prefix: 'K58',    cats: ['Endoscopy — Colonoscopy'], cptCodes: ['45378', '45380'] },
  { prefix: 'K59',    cats: ['Endoscopy — Colonoscopy', 'Colorectal'], cptCodes: ['45393', '45378', '44140'] },
  { prefix: 'K63',    cats: ['Colorectal', 'Endoscopy — Colonoscopy'], cptCodes: ['44140', '44204', '45378'] },
  // Anorectal
  { prefix: 'K64',    cats: ['Anorectal'], cptCodes: ['46221', '46250', '46255'] },
  { prefix: 'K60',    cats: ['Anorectal'], cptCodes: ['46270', '46080', '46050'] },
  { prefix: 'K61',    cats: ['Anorectal'], cptCodes: ['46060', '46050'] },
  { prefix: 'K62',    cats: ['Anorectal', 'Colorectal'], cptCodes: ['46050', '45378', '45160'] },
  // Cancers
  { prefix: 'C18',    cats: ['Colorectal'], cptCodes: ['44140', '44145', '44204'] },
  { prefix: 'C19',    cats: ['Colorectal'], cptCodes: ['44145', '45110', '44207'] },
  { prefix: 'C20',    cats: ['Colorectal'], cptCodes: ['45110', '44145', '44207'] },
  { prefix: 'C50',    cats: ['Breast Surgery'], cptCodes: ['19301', '19303', '19307'] },
  { prefix: 'C44',    cats: ['Wound & Skin'],   cptCodes: ['11600', '11400'] },
  { prefix: 'C22',    cats: ['Hepatopancreatic'], cptCodes: ['47379', '47100'] },
  { prefix: 'C25',    cats: ['Hepatopancreatic'], cptCodes: ['48150', '48153'] },
  // Vascular
  { prefix: 'I70',    cats: ['Vascular'], cptCodes: ['37220', '37228', '35301'] },
  { prefix: 'I73',    cats: ['Vascular'], cptCodes: ['37228', '37220'] },
  // Wound / soft tissue
  { prefix: 'L02',    cats: ['Wound & Skin'], cptCodes: ['10060', '10061'] },
  { prefix: 'L03',    cats: ['Wound & Skin'], cptCodes: ['10060', '11042', '11043'] },
  { prefix: 'M72',    cats: ['Wound & Skin'], cptCodes: ['11043', '11044'] },
].sort((a, b) => b.prefix.length - a.prefix.length); // longest prefix wins

function splitLabel(label: string): { code: string; desc: string } {
  const idx = label.indexOf(' — ');
  return idx === -1 ? { code: label, desc: '' } : { code: label.slice(0, idx), desc: label.slice(idx + 3) };
}

export default function CptPicker() {
  const { cptCodes, setCptCodes, icdCodes } = useAppContext();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>(CATEGORIES[0]);
  const [searchOpen, setSearchOpen] = useState(false);
  const userBrowsedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isSearching = query.trim().length >= 2;

  // ── ICD → CPT inference ────────────────────────────────────────────────────
  const { suggestedCats, suggestedCodes } = useMemo(() => {
    if (icdCodes.length === 0) return { suggestedCats: [] as string[], suggestedCodes: [] as CptCode[] };

    const catSet: string[] = [];
    const codeSet: string[] = [];

    for (const icd of icdCodes) {
      const icdCode = icd.split(' — ')[0]?.trim() ?? '';

      // Code-level: longest prefix match first
      let matched = false;
      for (const { prefix, cats, cptCodes: suggested } of ICD_PREFIX_CPT) {
        if (icdCode.startsWith(prefix)) {
          cats.forEach(c => { if (!catSet.includes(c)) catSet.push(c); });
          suggested.forEach(c => { if (!codeSet.includes(c)) codeSet.push(c); });
          matched = true;
          break;
        }
      }

      // Category-level fallback if no prefix matched
      if (!matched) {
        const icdEntry = ICD_CODES.find(i => i.code === icdCode);
        if (icdEntry) {
          const mapped = ICD_CAT_TO_CPT_CATS[icdEntry.category] ?? [];
          mapped.forEach(c => { if (!catSet.includes(c)) catSet.push(c); });
        }
      }
    }

    const codes = codeSet
      .map(code => CPT_LOOKUP[code])
      .filter((c): c is CptCode => !!c)
      .slice(0, 8);

    return { suggestedCats: catSet, suggestedCodes: codes };
  }, [icdCodes]);

  // Auto-select first suggested category when ICD codes first appear
  useEffect(() => {
    if (suggestedCats.length > 0 && !userBrowsedRef.current) {
      setActiveCategory(suggestedCats[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedCats.join(',')]);

  // Ordered category list: suggested first, rest after
  const orderedCategories = useMemo(() => {
    const rest = CATEGORIES.filter(c => !suggestedCats.includes(c));
    return [...suggestedCats.filter(c => CATEGORIES.includes(c)), ...rest];
  }, [suggestedCats]);

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

      {/* ── ICD-linked suggestions ── */}
      {suggestedCodes.length > 0 && (
        <div style={{
          background: '#faf5ff', border: '1.5px solid #e9d5ff',
          borderRadius: 10, padding: '10px 14px',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 800, color: '#7c3aed',
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>●</span>
            Suggested for your diagnoses
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
            {suggestedCodes.map(c => {
              const label = `${c.code} — ${c.description}`;
              const added = cptCodes.includes(label);
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => { if (!added) add(c); }}
                  disabled={added}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    padding: '7px 10px', borderRadius: 7, textAlign: 'left',
                    border: `1.5px solid ${added ? '#c4b5fd' : '#e9d5ff'}`,
                    background: added ? '#f5f3ff' : '#fff',
                    cursor: added ? 'default' : 'pointer',
                    transition: 'all 0.1s',
                  }}
                  onMouseEnter={e => { if (!added) (e.currentTarget as HTMLButtonElement).style.background = '#f5f3ff'; }}
                  onMouseLeave={e => { if (!added) (e.currentTarget as HTMLButtonElement).style.background = '#fff'; }}
                >
                  <span style={{
                    fontFamily: 'monospace', fontSize: 11, fontWeight: 700, flexShrink: 0,
                    color: added ? '#fff' : '#7c3aed',
                    background: added ? '#7c3aed' : '#ede9fe',
                    padding: '2px 6px', borderRadius: 3,
                  }}>
                    {c.code}{added ? ' ✓' : ''}
                  </span>
                  <span style={{
                    fontSize: 11.5, lineHeight: 1.35,
                    color: added ? '#6d28d9' : '#374151',
                    fontWeight: added ? 600 : 400,
                  }}>
                    {c.description}
                  </span>
                </button>
              );
            })}
          </div>
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
                      onMouseLeave={e => { if (!added) (e.currentTarget as HTMLButtonElement).style.background = added ? '#f5f3ff' : 'transparent'; }}
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

        {/* Category tabs — suggested first, then rest */}
        <div style={{
          display: 'flex', overflowX: 'auto', gap: 0,
          borderBottom: '1px solid #e5e7eb',
          background: '#fafafa',
          scrollbarWidth: 'none',
        }}>
          {orderedCategories.map((cat, tabIdx) => {
            const isActive = cat === activeCategory;
            const isSuggested = suggestedCats.includes(cat);
            const isFirstSuggested = suggestedCats.length > 0 && tabIdx === 0;
            const count = CPT_CODES.filter(c => c.category === cat && cptCodes.includes(`${c.code} — ${c.description}`)).length;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => { setActiveCategory(cat); userBrowsedRef.current = true; }}
                style={{
                  flexShrink: 0,
                  padding: '8px 13px',
                  fontSize: 11.5,
                  fontWeight: isActive ? 700 : isSuggested ? 600 : 500,
                  color: isActive ? '#7c3aed' : isSuggested ? '#6d28d9' : '#6b7280',
                  background: isActive ? '#fff' : 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #7c3aed' : isSuggested ? '2px solid #c4b5fd' : '2px solid transparent',
                  borderRight: isFirstSuggested && !isActive && suggestedCats.length < orderedCategories.length
                    ? '1px solid #e5e7eb' : 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                {isSuggested && !isActive && (
                  <span style={{ fontSize: 7, color: '#7c3aed', lineHeight: 1 }}>●</span>
                )}
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
