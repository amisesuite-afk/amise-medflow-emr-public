/**
 * NarrativeInput — dictate or paste clinical notes, then parse into
 * structured database fields.
 *
 * Routing:
 *   1. Local parse first (<5 ms, zero tokens) for pmh / medications / allergies.
 *   2. If confidence ≥ 0.7 → use local result, show "⚡ Local" badge.
 *   3. If confidence < 0.7 → escalate to cloud Claude, show "🤖 Cloud" badge.
 *   Surgeon can always force cloud parse with the "Enhanced AI" button.
 */

import { useState } from 'react';
import { useSpeechInput } from '@/hooks/useSpeechInput';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';
import { useToast } from '@/components/ToastProvider';
import { localParse } from '@/lib/local-narrator';

const API_ORIGIN = getApiOrigin();
function apiUrl(path: string) {
  if (API_ORIGIN) return `${API_ORIGIN}${path}`;
  return `${(import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')}${path}`;
}

interface NarrativeInputProps {
  /** API section key — determines the Claude prompt. */
  section: string;
  placeholder: string;
  /** Chip option labels sent to Claude so it can return exact matches. */
  chipOptions?: string[];
  /** Called with parsed structured data after successful AI parse. */
  onParsed: (data: Record<string, unknown>) => void;
  minHeight?: number;
  label?: string;
}

export default function NarrativeInput({
  section,
  placeholder,
  chipOptions,
  onParsed,
  minHeight = 100,
  label = 'Dictate or paste clinical notes',
}: NarrativeInputProps) {
  const { showToast } = useToast();
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseSource, setParseSource] = useState<'local' | 'cloud' | null>(null);
  const { listening, supported, start, stop } = useSpeechInput();

  function toggleVoice() {
    if (listening) { stop(); return; }
    start(transcript => {
      setText(prev => {
        const trimmed = prev.trimEnd();
        return trimmed ? `${trimmed} ${transcript}` : transcript;
      });
    });
  }

  async function parse(forceCloud = false) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setParsing(true);
    setParseSource(null);
    try {
      // 1. Local parse for structured sections — free, instant
      if (!forceCloud && (section === 'pmh' || section === 'medications' || section === 'allergies')) {
        const local = localParse(trimmed, { section: section as 'pmh' | 'medications' | 'allergies', chipOptions });
        if (local.confidence >= 0.7) {
          setParseSource('local');
          onParsed({ matched: local.matched, additional: local.additional, notes: local.notes, medicationsText: local.notes, allergies: local.notes });
          showToast('⚡ Parsed locally — zero tokens used', 'success');
          setParsing(false);
          return;
        }
      }
      // 2. Escalate to cloud Claude
      const r = await fetch(apiUrl('/api/narrative/parse'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify({ section, text: trimmed, chipOptions }),
      });
      if (!r.ok) throw new Error(await r.text());
      const { parsed } = await r.json() as { parsed: Record<string, unknown> };
      setParseSource('cloud');
      onParsed(parsed);
      showToast('🤖 AI parsed — review and confirm fields below', 'success');
    } catch {
      showToast('Parse failed — check connection and try again', 'error');
    } finally {
      setParsing(false);
    }
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #f0fdfa 0%, #f8fafc 100%)',
      border: `1.5px solid ${listening ? '#dc2626' : '#99f6e4'}`,
      borderRadius: 10, padding: '12px 14px', marginBottom: 2,
      transition: 'border-color .15s',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 10, fontWeight: 800, color: '#0b8278',
          textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1, minWidth: 140,
        }}>
          🎙 {label}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Dictate button — always visible; disabled with tooltip when unsupported */}
          {supported ? (
            <button
              type="button"
              onClick={toggleVoice}
              title={listening ? 'Stop recording' : 'Start voice dictation'}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '3px 11px', borderRadius: 20,
                border: `1.5px solid ${listening ? '#dc2626' : '#d1d5db'}`,
                background: listening ? '#fee2e2' : '#fff',
                color: listening ? '#dc2626' : '#6b7280',
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}
            >
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: listening ? '#dc2626' : '#9ca3af',
                display: 'inline-block', flexShrink: 0,
                animation: listening ? 'nic-pulse 1.2s ease-in-out infinite' : 'none',
              }} />
              {listening ? '⏹ Stop' : '🎤 Dictate'}
            </button>
          ) : (
            <button
              type="button"
              disabled
              title="Voice dictation requires Chrome or Edge with microphone access"
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '3px 10px', borderRadius: 20,
                border: '1.5px solid #e5e7eb', background: '#f9fafb',
                color: '#c0c0c0', fontSize: 11, fontWeight: 700, cursor: 'not-allowed',
              }}
            >
              🎤 <span style={{ fontSize: 10 }}>Dictate (use Chrome)</span>
            </button>
          )}

          {/* Parse source badge */}
          {parseSource && (
            <span style={{
              fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 10,
              background: parseSource === 'local' ? 'rgba(245,158,11,.15)' : 'rgba(59,130,246,.12)',
              color: parseSource === 'local' ? '#d97706' : '#3b82f6',
              letterSpacing: '0.07em', textTransform: 'uppercase', whiteSpace: 'nowrap',
            }}>
              {parseSource === 'local' ? '⚡ Local' : '🤖 Cloud'}
            </span>
          )}
        </div>
      </div>

      {/* Narrative textarea */}
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', boxSizing: 'border-box', minHeight,
          padding: '9px 11px', fontSize: 12.5, lineHeight: 1.6,
          borderRadius: 7, fontFamily: 'inherit', resize: 'vertical',
          border: `1.5px solid ${listening ? '#dc2626' : '#e2e8f0'}`,
          background: '#fff',
          transition: 'border-color .15s',
        }}
      />

      {/* Action row */}
      {text.trim() && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => void parse(false)}
            disabled={parsing}
            style={{
              padding: '6px 16px', borderRadius: 7, border: 'none',
              background: parsing ? '#94a3b8' : '#0b8278',
              color: '#fff', fontSize: 12, fontWeight: 700,
              cursor: parsing ? 'wait' : 'pointer', flexShrink: 0,
            }}
          >
            {parsing ? '⏳ Parsing…' : '⚡ Parse & Fill'}
          </button>

          {(section === 'pmh' || section === 'medications' || section === 'allergies') && (
            <button
              type="button"
              onClick={() => void parse(true)}
              disabled={parsing}
              title="Use Claude AI for enhanced parsing (uses cloud tokens)"
              style={{
                padding: '6px 11px', borderRadius: 7,
                border: '1.5px solid #bfdbfe', background: 'transparent',
                color: '#3b82f6', fontSize: 11, fontWeight: 700,
                cursor: parsing ? 'wait' : 'pointer', flexShrink: 0,
              }}
            >
              🤖 Enhanced AI
            </button>
          )}

          <span style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.4, flex: 1, minWidth: 80 }}>
            Local parse first · cloud only if needed
          </span>

          <button
            type="button"
            onClick={() => { setText(''); setParseSource(null); }}
            style={{
              padding: '5px 9px', borderRadius: 6,
              border: '1px solid #e2e8f0', background: 'transparent',
              color: '#94a3b8', fontSize: 11, cursor: 'pointer', flexShrink: 0,
            }}
          >
            Clear
          </button>
        </div>
      )}

      {!text.trim() && (
        <p style={{ margin: '6px 0 0', fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
          Type, paste, or dictate the clinical narrative above — fields below populate automatically.
        </p>
      )}

      <style>{`
        @keyframes nic-pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(220,38,38,0.5); }
          50%       { opacity: 0.6; box-shadow: 0 0 0 4px rgba(220,38,38,0); }
        }
      `}</style>
    </div>
  );
}
