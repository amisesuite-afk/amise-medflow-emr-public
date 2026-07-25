/**
 * NarrativeInput — dictate or paste clinical notes, then parse into
 * structured database fields.
 *
 * Routing (in order):
 *   1. Local engine  (<5 ms, zero tokens, zero network)  — always tried first
 *   2. Ollama        (local LAN / loopback)               — if configured + low confidence
 *   3. Cloud Claude  (fallback)                           — if Ollama unavailable
 *
 * Voice routing:
 *   • Chrome / Edge  → Web Speech API (instant, no download)
 *   • Other browsers → Whisper.js button (one-time ~40 MB download, then offline)
 *
 * Learning:
 *   Chips returned by cloud/Ollama that local missed → saved to IndexedDB.
 *   On subsequent encounters those terms match locally.
 */

import { useState, useEffect } from 'react';
import { useSpeechInput } from '@/hooks/useSpeechInput';
import { useWhisperSTT } from '@/hooks/useWhisperSTT';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';
import { useToast } from '@/components/ToastProvider';
import { localParse } from '@/lib/local-narrator';
import { getLearnedTerms, saveLearnedTerm } from '@/lib/learning-store';
import { getAIProviderConfig, parseWithOllama } from '@/lib/ai-provider';

const API_ORIGIN = getApiOrigin();
function apiUrl(path: string) {
  if (API_ORIGIN) return `${API_ORIGIN}${path}`;
  return `${(import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')}${path}`;
}

interface CcContext {
  ccKey: string;
  ccLabel: string;
  icd10Hint?: string;
  ddx?: string[];
  pearl?: string;
}

interface NarrativeInputProps {
  section: string;
  placeholder: string;
  chipOptions?: string[];
  ccContext?: CcContext | null;
  onParsed: (data: Record<string, unknown>) => void;
  minHeight?: number;
  label?: string;
}

type ParseSource = 'local' | 'ollama' | 'cloud' | null;

const STRUCTURED_SECTIONS = new Set(['pmh', 'medications', 'allergies']);

export default function NarrativeInput({
  section,
  placeholder,
  chipOptions = [],
  ccContext = null,
  onParsed,
  minHeight = 100,
  label = 'Dictate or paste clinical notes',
}: NarrativeInputProps) {
  const { showToast }  = useToast();
  const [text, setText]               = useState('');
  const [parsing, setParsing]         = useState(false);
  const [parseSource, setParseSource] = useState<ParseSource>(null);

  // Web Speech API (Chrome/Edge — instant, no download)
  const webSpeech = useSpeechInput();

  // Whisper.js (all browsers — ~40 MB one-time download)
  const whisper = useWhisperSTT();

  // Whether to offer Whisper: when Web Speech not supported
  const showWhisper = !webSpeech.supported && whisper.supported;

  // Preload learned terms for this section (async, doesn't block render)
  const [learnedTerms, setLearnedTerms] = useState<Array<{ term: string; chipMatch: string }>>([]);
  useEffect(() => {
    if (!STRUCTURED_SECTIONS.has(section)) return;
    getLearnedTerms(section).then(terms =>
      setLearnedTerms(terms.map(t => ({ term: t.term, chipMatch: t.chipMatch }))),
    ).catch(() => { /* IndexedDB may be unavailable in some contexts */ });
  }, [section]);

  // ── Voice handlers ──────────────────────────────────────────────────────────

  function toggleWebSpeech() {
    if (webSpeech.listening) { webSpeech.stop(); return; }
    webSpeech.start(transcript => {
      setText(prev => { const t = prev.trimEnd(); return t ? `${t} ${transcript}` : transcript; });
    });
  }

  async function startWhisper() {
    await whisper.start(transcript => {
      setText(prev => { const t = prev.trimEnd(); return t ? `${t} ${transcript}` : transcript; });
    });
  }

  // ── Parse routing ───────────────────────────────────────────────────────────

  async function parse(forceCloud = false) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setParsing(true);
    setParseSource(null);

    try {
      // 1. Local parse — free, instant
      if (!forceCloud && STRUCTURED_SECTIONS.has(section)) {
        const local = localParse(trimmed, {
          section: section as 'pmh' | 'medications' | 'allergies',
          chipOptions,
          learnedTerms,
        });
        if (local.confidence >= 0.7) {
          setParseSource('local');
          onParsed({
            matched: local.matched, additional: local.additional,
            notes: local.notes, medicationsText: local.notes, allergies: local.notes,
          });
          showToast('⚡ Parsed locally — zero tokens used', 'success');
          setParsing(false);
          return;
        }
      }

      // 2. Ollama — local LAN inference
      if (!forceCloud) {
        const config = getAIProviderConfig();
        if (config.type === 'ollama') {
          try {
            const parsed = await parseWithOllama(section, trimmed, chipOptions, config);
            setParseSource('ollama');
            onParsed(parsed);
            showToast('🟡 Parsed by Ollama (local)', 'success');
            await learnFromResult(trimmed, parsed);
            setParsing(false);
            return;
          } catch {
            // Ollama unreachable → fall through to cloud
          }
        }
      }

      // 3. Cloud Claude
      const r = await fetch(apiUrl('/api/narrative/parse'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify({ section, text: trimmed, chipOptions, ccContext: ccContext ?? undefined }),
      });
      if (!r.ok) throw new Error(await r.text());
      const { parsed } = await r.json() as { parsed: Record<string, unknown> };
      setParseSource('cloud');
      onParsed(parsed);
      showToast('🤖 AI parsed — review fields below', 'success');
      await learnFromResult(trimmed, parsed);
    } catch {
      showToast('Parse failed — check connection and try again', 'error');
    } finally {
      setParsing(false);
    }
  }

  // ── Learning — save chips cloud found that local missed ─────────────────────

  async function learnFromResult(sourceText: string, parsed: Record<string, unknown>) {
    if (!STRUCTURED_SECTIONS.has(section)) return;
    const cloudMatched = (parsed.matched as string[] | undefined) ?? [];
    if (cloudMatched.length === 0) return;

    const localResult = localParse(sourceText, { section: section as 'pmh' | 'medications' | 'allergies', chipOptions });
    const newTerms = cloudMatched.filter(chip => !localResult.matched.includes(chip));
    const now = new Date().toISOString();
    // Extract a short key phrase (first 80 chars, normalised)
    const keyPhrase = sourceText.toLowerCase().replace(/\s+/g, ' ').slice(0, 80);

    for (const chip of newTerms) {
      await saveLearnedTerm({ term: keyPhrase, chipMatch: chip, section, useCount: 1, lastSeen: now })
        .catch(() => { /* best effort */ });
    }

    // Refresh learned terms in memory
    const updated = await getLearnedTerms(section).catch(() => []);
    setLearnedTerms(updated.map(t => ({ term: t.term, chipMatch: t.chipMatch })));
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const hasText = text.trim().length > 0;
  const isListening = webSpeech.listening || whisper.status === 'recording';

  return (
    <div style={{
      background: 'linear-gradient(135deg, #f0fdfa 0%, #f8fafc 100%)',
      border: `1.5px solid ${isListening ? '#dc2626' : '#99f6e4'}`,
      borderRadius: 10, padding: '12px 14px', marginBottom: 2,
      transition: 'border-color .15s',
    }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 10, fontWeight: 800, color: '#0b8278',
          textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1, minWidth: 120,
        }}>
          🎙 {label}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>

          {/* ── Web Speech button (Chrome/Edge) ── */}
          {webSpeech.supported && (
            <button
              type="button"
              onClick={toggleWebSpeech}
              title={webSpeech.listening ? 'Stop recording' : 'Start voice dictation (Web Speech API)'}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '3px 10px', borderRadius: 20,
                border: `1.5px solid ${webSpeech.listening ? '#dc2626' : '#d1d5db'}`,
                background: webSpeech.listening ? '#fee2e2' : '#fff',
                color: webSpeech.listening ? '#dc2626' : '#6b7280',
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}
            >
              <span style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: webSpeech.listening ? '#dc2626' : '#9ca3af',
                animation: webSpeech.listening ? 'nic-pulse 1.2s ease-in-out infinite' : 'none',
              }} />
              {webSpeech.listening ? '⏹ Stop' : '🎤 Dictate'}
            </button>
          )}

          {/* ── Whisper button (non-Chrome / enhanced mode) ── */}
          {showWhisper && (
            <>
              {whisper.status === 'idle' && (
                <button
                  type="button"
                  onClick={() => void whisper.load()}
                  title="Load Whisper AI speech model (~40 MB, one-time download, then offline)"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '3px 10px', borderRadius: 20,
                    border: '1.5px solid #d1d5db', background: '#fff',
                    color: '#6b7280', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  🎤 Load voice (~40 MB)
                </button>
              )}
              {whisper.status === 'loading' && (
                <span style={{ fontSize: 11, color: '#d97706', fontWeight: 700 }}>
                  ⏬ Loading {whisper.progress}%…
                </span>
              )}
              {whisper.status === 'ready' && (
                <button
                  type="button"
                  onClick={() => void startWhisper()}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '3px 10px', borderRadius: 20,
                    border: '1.5px solid #d1d5db', background: '#fff',
                    color: '#6b7280', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  🎤 Dictate (Whisper)
                </button>
              )}
              {whisper.status === 'recording' && (
                <button
                  type="button"
                  onClick={whisper.stop}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '3px 10px', borderRadius: 20,
                    border: '1.5px solid #dc2626', background: '#fee2e2',
                    color: '#dc2626', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626', animation: 'nic-pulse 1.2s infinite' }} />
                  ⏹ Stop
                </button>
              )}
              {whisper.status === 'transcribing' && (
                <span style={{ fontSize: 11, color: '#0b8278', fontWeight: 700 }}>✦ Transcribing…</span>
              )}
              {whisper.status === 'error' && (
                <span style={{ fontSize: 11, color: '#dc2626' }}>Voice error</span>
              )}
            </>
          )}

          {/* ── Neither supported ── */}
          {!webSpeech.supported && !whisper.supported && (
            <span style={{
              padding: '3px 9px', borderRadius: 20, border: '1.5px solid #e5e7eb',
              fontSize: 11, color: '#c0c0c0',
            }}>
              🎤 No mic access
            </span>
          )}

          {/* ── Parse source badge ── */}
          {parseSource && (
            <span style={{
              fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 9,
              background: parseSource === 'local'  ? 'rgba(245,158,11,.15)'
                         : parseSource === 'ollama' ? 'rgba(16,185,129,.15)'
                         :                            'rgba(59,130,246,.12)',
              color: parseSource === 'local'  ? '#d97706'
                   : parseSource === 'ollama' ? '#059669'
                   :                            '#3b82f6',
              letterSpacing: '0.07em', textTransform: 'uppercase', whiteSpace: 'nowrap',
            }}>
              {parseSource === 'local' ? '⚡ Local' : parseSource === 'ollama' ? '🟢 Ollama' : '🤖 Cloud'}
            </span>
          )}
        </div>
      </div>

      {/* ── Textarea ── */}
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', boxSizing: 'border-box', minHeight,
          padding: '9px 11px', fontSize: 12.5, lineHeight: 1.6,
          borderRadius: 7, fontFamily: 'inherit', resize: 'vertical',
          border: `1.5px solid ${isListening ? '#dc2626' : '#e2e8f0'}`,
          background: '#fff', transition: 'border-color .15s',
        }}
      />

      {/* ── Actions ── */}
      {hasText && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => void parse(false)}
            disabled={parsing}
            style={{
              padding: '6px 15px', borderRadius: 7, border: 'none',
              background: parsing ? '#94a3b8' : '#0b8278',
              color: '#fff', fontSize: 12, fontWeight: 700,
              cursor: parsing ? 'wait' : 'pointer', flexShrink: 0,
            }}
          >
            {parsing ? '⏳ Parsing…' : '⚡ Parse & Fill'}
          </button>

          {STRUCTURED_SECTIONS.has(section) && (
            <button
              type="button"
              onClick={() => void parse(true)}
              disabled={parsing}
              title="Force cloud Claude parse (uses API tokens)"
              style={{
                padding: '6px 10px', borderRadius: 7,
                border: '1.5px solid #bfdbfe', background: 'transparent',
                color: '#3b82f6', fontSize: 11, fontWeight: 700,
                cursor: parsing ? 'wait' : 'pointer', flexShrink: 0,
              }}
            >
              🤖 Cloud AI
            </button>
          )}

          <span style={{ fontSize: 10, color: '#94a3b8', flex: 1, minWidth: 60 }}>
            Local → Ollama → Cloud
          </span>

          <button
            type="button"
            onClick={() => { setText(''); setParseSource(null); }}
            style={{
              padding: '5px 8px', borderRadius: 6,
              border: '1px solid #e2e8f0', background: 'transparent',
              color: '#94a3b8', fontSize: 11, cursor: 'pointer', flexShrink: 0,
            }}
          >
            Clear
          </button>
        </div>
      )}

      {!hasText && (
        <p style={{ margin: '6px 0 0', fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
          Type, paste, or dictate — fields populate automatically.
        </p>
      )}

      <style>{`
        @keyframes nic-pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(220,38,38,.45); }
          50%       { opacity: 0.6; box-shadow: 0 0 0 4px rgba(220,38,38,0); }
        }
      `}</style>
    </div>
  );
}
