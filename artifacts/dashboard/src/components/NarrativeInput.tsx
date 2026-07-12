/**
 * NarrativeInput — dictate or paste clinical notes, then AI-parse into
 * structured database fields.
 *
 * Design principle: the physician captures a COMPLETE narrative first
 * (voice or paste of previous notes verbatim). AI then structures it.
 * Both the raw narrative and the structured data are preserved.
 */

import { useState } from 'react';
import { useSpeechInput } from '@/hooks/useSpeechInput';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';
import { useToast } from '@/components/ToastProvider';

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

  async function parse() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setParsing(true);
    try {
      const r = await fetch(apiUrl('/api/narrative/parse'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify({ section, text: trimmed, chipOptions }),
      });
      if (!r.ok) throw new Error(await r.text());
      const { parsed } = await r.json() as { parsed: Record<string, unknown> };
      onParsed(parsed);
      showToast('Parsed — review and confirm fields below', 'success');
    } catch {
      showToast('Parse failed — check connection and try again', 'error');
    } finally {
      setParsing(false);
    }
  }

  const borderColor = listening ? '#dc2626' : '#e2e8f0';

  return (
    <div style={{
      background: 'linear-gradient(135deg, #f0fdfa 0%, #f8fafc 100%)',
      border: `1.5px solid ${listening ? '#dc2626' : '#99f6e4'}`,
      borderRadius: 10, padding: '12px 14px', marginBottom: 2,
      transition: 'border-color .15s',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
        <span style={{
          fontSize: 10, fontWeight: 800, color: '#0b8278',
          textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1,
        }}>
          🎙 {label}
        </span>

        {supported && (
          <button
            type="button"
            onClick={toggleVoice}
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
            }} />
            {listening ? '⏹ Stop dictating' : '🎤 Dictate'}
          </button>
        )}
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
          border: `1.5px solid ${borderColor}`,
          background: '#fff',
          transition: 'border-color .15s',
        }}
      />

      {/* Actions */}
      {text.trim() && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => void parse()}
            disabled={parsing}
            style={{
              padding: '6px 18px', borderRadius: 7, border: 'none',
              background: parsing ? '#94a3b8' : '#0b8278',
              color: '#fff', fontSize: 12, fontWeight: 700,
              cursor: parsing ? 'wait' : 'pointer',
            }}
          >
            {parsing ? '⏳ Parsing…' : '🤖 AI Parse & Fill →'}
          </button>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>
            AI will populate the fields below — review before saving
          </span>
          <button
            type="button"
            onClick={() => setText('')}
            style={{
              marginLeft: 'auto', padding: '5px 10px', borderRadius: 6,
              border: '1px solid #e2e8f0', background: 'transparent',
              color: '#94a3b8', fontSize: 11, cursor: 'pointer',
            }}
          >
            Clear
          </button>
        </div>
      )}

      {!text.trim() && (
        <p style={{ margin: '6px 0 0', fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
          Type, paste, or dictate the clinical narrative above — AI will extract and populate the structured fields below automatically.
        </p>
      )}
    </div>
  );
}
