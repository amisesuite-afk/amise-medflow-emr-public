import { useState, useRef, useCallback, useEffect, type TextareaHTMLAttributes } from 'react';
import { matchDotPhrases, type DotPhrase } from '@/data/dot-phrases';

// Matches a dot-trigger at the end of text before the cursor: .word
const TRIGGER_RE = /\.(\w*)$/;

interface Props extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value: string;
  onChange: (v: string) => void;
}

export default function SmartTextarea({ value, onChange, onKeyDown: parentKeyDown, ...rest }: Props) {
  const [matches, setMatches] = useState<DotPhrase[]>([]);
  const [cursorIdx, setCursorIdx] = useState(0);
  const [triggerStart, setTriggerStart] = useState<number | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Check text before cursor for a dot-trigger
  function detectTrigger(el: HTMLTextAreaElement) {
    const pos = el.selectionStart ?? 0;
    const before = el.value.slice(0, pos);
    const m = TRIGGER_RE.exec(before);
    if (m) {
      const found = matchDotPhrases(m[1]);
      setMatches(found);
      setCursorIdx(0);
      setTriggerStart(m.index);
    } else {
      setMatches([]);
      setTriggerStart(null);
    }
  }

  function applyPhrase(phrase: DotPhrase) {
    const el = taRef.current;
    if (!el || triggerStart === null) return;
    const pos = el.selectionStart ?? 0;
    const before = value.slice(0, triggerStart);
    const after = value.slice(pos);
    const expanded = phrase.text;
    const cursorMark = expanded.indexOf('|');
    let newText: string;
    let newCursor: number;
    if (cursorMark !== -1) {
      // Find first |…| pair (placeholder) — select it after insertion
      const endMark = expanded.indexOf('|', cursorMark + 1);
      if (endMark !== -1 && endMark > cursorMark) {
        // Remove both pipes, will select the inner text
        const inner = expanded.slice(cursorMark + 1, endMark);
        newText = before + expanded.slice(0, cursorMark) + inner + expanded.slice(endMark + 1) + after;
        const selStart = before.length + cursorMark;
        const selEnd = selStart + inner.length;
        newCursor = selEnd;
        onChange(newText);
        requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(selStart, selEnd);
        });
      } else {
        newText = before + expanded.replace(/\|/g, '') + after;
        newCursor = before.length + expanded.replace(/\|/g, '').length;
        onChange(newText);
        requestAnimationFrame(() => { el.focus(); el.setSelectionRange(newCursor, newCursor); });
      }
    } else {
      newText = before + expanded + after;
      newCursor = before.length + expanded.length;
      onChange(newText);
      requestAnimationFrame(() => { el.focus(); el.setSelectionRange(newCursor, newCursor); });
    }
    setMatches([]);
    setTriggerStart(null);
  }

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (matches.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setCursorIdx(i => Math.min(i + 1, matches.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setCursorIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Tab' || e.key === 'Enter') {
        if (matches[cursorIdx]) { e.preventDefault(); applyPhrase(matches[cursorIdx]); return; }
      }
      if (e.key === 'Escape') { setMatches([]); setTriggerStart(null); return; }
    }
    parentKeyDown?.(e);
  }, [matches, cursorIdx, parentKeyDown, applyPhrase]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${cursorIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursorIdx]);

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        ref={taRef}
        value={value}
        onChange={e => { onChange(e.target.value); detectTrigger(e.target); }}
        onKeyDown={handleKeyDown}
        onClick={e => detectTrigger(e.currentTarget)}
        {...rest}
      />

      {matches.length > 0 && (
        <div
          ref={listRef}
          style={{
            position: 'absolute', bottom: '100%', left: 0, right: 0,
            marginBottom: 4, zIndex: 300,
            background: '#fff', border: '1px solid #e2e8f0',
            borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            maxHeight: 260, overflowY: 'auto',
          }}
        >
          <div style={{ padding: '4px 10px 2px', fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9' }}>
            Dot phrases — Tab to expand
          </div>
          {matches.map((p, i) => {
            const active = i === cursorIdx;
            return (
              <button
                key={p.trigger}
                data-idx={i}
                type="button"
                onMouseDown={e => { e.preventDefault(); applyPhrase(p); }}
                onMouseEnter={() => setCursorIdx(i)}
                style={{
                  display: 'flex', alignItems: 'baseline', gap: 8,
                  width: '100%', textAlign: 'left',
                  padding: '7px 12px', border: 'none',
                  background: active ? '#0f172a' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <code style={{ fontSize: 11, fontWeight: 700, color: active ? '#93c5fd' : '#3b82f6', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  .{p.trigger}
                </code>
                <span style={{ fontSize: 12, color: active ? '#e2e8f0' : '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
