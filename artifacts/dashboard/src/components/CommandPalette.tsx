import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { Section, TopSection } from '@/context/AppContext';

interface Command {
  id: string;
  label: string;
  group: string;
  shortcut?: string;
  action: () => void;
}

interface Props {
  onSection: (s: Section) => void;
  onTopSection: (s: TopSection) => void;
  topSection: TopSection;
  userRole: string;
}

const CONSULT_SECTIONS: Array<{ id: Section; label: string }> = [
  { id: 'nurse_apcq',        label: 'Chief Complaint' },
  { id: 'hpi',               label: 'History of Present Illness' },
  { id: 'triage',            label: 'Triage / Vitals' },
  { id: 'pmh',               label: 'Past Medical History' },
  { id: 'surgical',          label: 'Surgical History' },
  { id: 'medications',       label: 'Medications' },
  { id: 'allergies',         label: 'Allergies' },
  { id: 'family_hx',         label: 'Family History' },
  { id: 'toxic',             label: 'Social History' },
  { id: 'ros',               label: 'Systems Review' },
  { id: 'examination',       label: 'Physical Examination' },
  { id: 'investigations',    label: 'Bloods / Labs' },
  { id: 'radiology',         label: 'Imaging' },
  { id: 'attachments',       label: 'Attachments' },
  { id: 'assessment',        label: 'Assessment' },
  { id: 'ai_consultant',     label: 'AI Aid' },
  { id: 'plan',              label: 'Plan' },
  { id: 'prescriptions',       label: 'Prescriptions' },
  { id: 'referring_providers', label: 'Referrals' },
  { id: 'who_checklist',       label: 'WHO Safety Checklist' },
  { id: 'consent',             label: 'Surgical Consent' },
  { id: 'letters',             label: 'Letter / Document Generator' },
  { id: 'patient_education',   label: 'Patient Education' },
];

const TOP_SECTIONS: Array<{ id: TopSection; label: string }> = [
  { id: 'consultation',    label: 'Consultation' },
  { id: 'dashboard',       label: 'Dashboard' },
  { id: 'patients',        label: 'Patient Registry' },
  { id: 'scheduling',      label: 'Scheduling' },
  { id: 'visit_lifecycle', label: 'Visits' },
  { id: 'finaldoc',        label: 'Summary' },
  { id: 'billing',         label: 'Billing' },
  { id: 'analytics',       label: 'Analytics' },
  { id: 'vademecum',       label: 'Disease Dictionary' },
  { id: 'booking_inbox',   label: 'Booking Inbox' },
  { id: 'settings',        label: 'Settings' },
];

// Alt+1–9 map to first 9 consultation sections
export const ALT_SHORTCUTS = CONSULT_SECTIONS.slice(0, 9);

export default function CommandPalette({ onSection, onTopSection, topSection }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [];

    if (topSection === 'consultation') {
      CONSULT_SECTIONS.forEach((s, i) => {
        const shortcut = i < 9 ? `Alt+${i + 1}` : undefined;
        list.push({
          id: `section:${s.id}`,
          label: s.label,
          group: 'Consultation',
          shortcut,
          action: () => { onSection(s.id); setOpen(false); },
        });
      });
    }

    TOP_SECTIONS.forEach(s => {
      list.push({
        id: `top:${s.id}`,
        label: s.label,
        group: 'Navigate',
        action: () => {
          onTopSection(s.id);
          if (s.id === 'consultation') onSection('nurse_apcq');
          setOpen(false);
        },
      });
    });

    return list;
  }, [topSection, onSection, onTopSection]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(c => c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q));
  }, [commands, query]);

  // Open on ⌘K / Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
        setQuery('');
        setCursor(0);
      }
      // Alt+1–9 direct shortcuts (consultation sections)
      if (e.altKey && e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key) - 1;
        const sec = ALT_SHORTCUTS[idx];
        if (sec) {
          e.preventDefault();
          onTopSection('consultation');
          onSection(sec.id);
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSection, onTopSection]);

  // Arrow nav + Enter + Escape inside the palette
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    if (e.key === 'Enter') {
      e.preventDefault();
      filtered[cursor]?.action();
    }
  }, [filtered, cursor]);

  // Reset cursor when filter changes
  useEffect(() => { setCursor(0); }, [query]);

  // Focus input on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${cursor}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  // Group items
  const groups: Record<string, Command[]> = {};
  for (const cmd of filtered) {
    if (!groups[cmd.group]) groups[cmd.group] = [];
    groups[cmd.group].push(cmd);
  }

  return (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 'clamp(60px, 12vh, 160px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        onKeyDown={onKeyDown}
        style={{
          width: '100%', maxWidth: 520,
          background: '#fff', borderRadius: 10,
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: 16, color: '#94a3b8' }}>⌘</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Go to section or navigate…"
            style={{
              flex: 1, border: 'none', outline: 'none',
              fontSize: 15, color: '#0f172a', background: 'transparent',
            }}
          />
          <kbd style={{ fontSize: 10, padding: '2px 6px', background: '#f1f5f9', borderRadius: 4, color: '#64748b', border: '1px solid #e2e8f0' }}>Esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ maxHeight: 360, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 13, color: '#94a3b8' }}>
              No results for "{query}"
            </div>
          ) : (
            Object.entries(groups).map(([group, items]) => (
              <div key={group}>
                <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8' }}>
                  {group}
                </div>
                {items.map(cmd => {
                  const globalIdx = filtered.indexOf(cmd);
                  const active = globalIdx === cursor;
                  return (
                    <button
                      key={cmd.id}
                      data-idx={globalIdx}
                      type="button"
                      onClick={cmd.action}
                      onMouseEnter={() => setCursor(globalIdx)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        width: '100%', textAlign: 'left',
                        padding: '9px 16px', border: 'none',
                        background: active ? '#0f172a' : 'transparent',
                        color: active ? '#f1f5f9' : '#334155',
                        cursor: 'pointer', fontSize: 13, fontWeight: 500,
                      }}
                    >
                      <span style={{ flex: 1 }}>{cmd.label}</span>
                      {cmd.shortcut && (
                        <kbd style={{
                          fontSize: 10, padding: '2px 6px',
                          background: active ? 'rgba(255,255,255,0.12)' : '#f1f5f9',
                          borderRadius: 4, color: active ? '#94a3b8' : '#64748b',
                          border: `1px solid ${active ? 'rgba(255,255,255,0.12)' : '#e2e8f0'}`,
                          fontFamily: 'inherit', whiteSpace: 'nowrap',
                        }}>
                          {cmd.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div style={{ padding: '8px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 14, alignItems: 'center' }}>
          {[['↑↓', 'navigate'], ['↵', 'select'], ['Esc', 'close'], ['Alt+1–9', 'jump section']].map(([k, l]) => (
            <span key={k} style={{ fontSize: 10, color: '#94a3b8', display: 'flex', gap: 4, alignItems: 'center' }}>
              <kbd style={{ padding: '1px 5px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 3, fontSize: 10, fontFamily: 'inherit' }}>{k}</kbd>
              {l}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
