/**
 * P4 — AI Provider Settings card.
 * Mounted inside SettingsTab (admin only).
 */

import { useState } from 'react';
import {
  getAIProviderConfig, setAIProviderConfig, testOllamaConnection,
  DEFAULT_CONFIG, type AIProviderConfig,
} from '@/lib/ai-provider';
import { getAllLearnedTerms, deleteLearnedTerm } from '@/lib/learning-store';
import CollapsibleCard from '@/components/CollapsibleCard';

export default function AIProviderSettings() {
  const [config, setConfigState] = useState<AIProviderConfig>(getAIProviderConfig);
  const [testing, setTesting]   = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; models?: string[]; error?: string } | null>(null);
  const [learnedCount, setLearnedCount] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);

  function save(patch: Partial<AIProviderConfig>) {
    const next = { ...config, ...patch };
    setConfigState(next);
    setAIProviderConfig(next);
  }

  async function testConnection() {
    setTesting(true); setTestResult(null);
    const result = await testOllamaConnection(config.ollamaUrl);
    setTestResult(result);
    setTesting(false);
  }

  async function loadLearnedCount() {
    const terms = await getAllLearnedTerms().catch(() => []);
    setLearnedCount(terms.length);
  }

  async function clearLearned() {
    if (!confirm('Clear all learned terms from the local dictionary? This cannot be undone.')) return;
    setClearing(true);
    const terms = await getAllLearnedTerms().catch(() => []);
    for (const t of terms) { if (t.id) await deleteLearnedTerm(t.id).catch(() => {}); }
    setLearnedCount(0);
    setClearing(false);
  }

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '7px 10px',
    border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13,
    background: '#fff', color: '#1e293b',
  };

  return (
    <CollapsibleCard title="AI provider" defaultOpen>
      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 14, lineHeight: 1.6 }}>
        Routing: <strong>Local engine</strong> → <strong>Ollama</strong> (if configured) → <strong>Cloud Claude</strong>.
        Local handles ~88 % of tasks at zero token cost.
      </p>

      {/* Provider selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['cloud', 'ollama'] as const).map(type => (
          <button
            key={type}
            type="button"
            onClick={() => { save({ type }); setTestResult(null); }}
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
              border: `2px solid ${config.type === type ? (type === 'ollama' ? '#10b981' : '#3b82f6') : '#e2e8f0'}`,
              background: config.type === type ? (type === 'ollama' ? 'rgba(16,185,129,.07)' : 'rgba(59,130,246,.06)') : '#fff',
              fontWeight: 700, fontSize: 13,
              color: config.type === type ? (type === 'ollama' ? '#059669' : '#3b82f6') : '#64748b',
            }}
          >
            {type === 'cloud' ? '☁️ Cloud Claude' : '🟢 Ollama (local)'}
            <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2, color: '#94a3b8' }}>
              {type === 'cloud' ? 'API tokens per parse' : 'Zero tokens, LAN only'}
            </div>
          </button>
        ))}
      </div>

      {/* Ollama config */}
      {config.type === 'ollama' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <div style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 8, padding: '10px 12px', fontSize: 11.5, color: '#92400e', lineHeight: 1.6 }}>
            <strong>Setup:</strong> Run <code style={{ background: 'rgba(0,0,0,.07)', padding: '1px 4px', borderRadius: 3 }}>OLLAMA_ORIGINS=* ollama serve</code> on your local machine or LAN server. Then install a model: <code style={{ background: 'rgba(0,0,0,.07)', padding: '1px 4px', borderRadius: 3 }}>ollama pull phi3:mini</code>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Ollama URL</label>
            <input
              style={inp}
              value={config.ollamaUrl}
              onChange={e => save({ ollamaUrl: e.target.value })}
              placeholder="http://localhost:11434"
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Model</label>
            <input
              style={inp}
              value={config.ollamaModel}
              onChange={e => save({ ollamaModel: e.target.value })}
              placeholder="phi3:mini"
            />
            {testResult?.models && testResult.models.length > 0 && (
              <div style={{ marginTop: 4, fontSize: 11, color: '#64748b' }}>
                Available: {testResult.models.join(', ')}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => void testConnection()}
              disabled={testing}
              style={{
                padding: '7px 14px', borderRadius: 6, border: 'none', cursor: testing ? 'wait' : 'pointer',
                background: '#0b8278', color: '#fff', fontSize: 12, fontWeight: 700,
              }}
            >
              {testing ? 'Testing…' : '⚡ Test connection'}
            </button>

            <button
              type="button"
              onClick={() => save({ ollamaUrl: DEFAULT_CONFIG.ollamaUrl, ollamaModel: DEFAULT_CONFIG.ollamaModel })}
              style={{
                padding: '7px 12px', borderRadius: 6, border: '1px solid #e2e8f0',
                background: '#fff', color: '#64748b', fontSize: 12, cursor: 'pointer',
              }}
            >
              Reset defaults
            </button>

            {testResult && (
              <span style={{ fontSize: 12, fontWeight: 700, color: testResult.ok ? '#059669' : '#dc2626' }}>
                {testResult.ok ? `✓ Connected` : `✕ ${testResult.error}`}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Learning store management */}
      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10 }}>
          Local dictionary (learned terms)
        </div>
        <p style={{ fontSize: 12, color: '#64748b', marginBottom: 10, lineHeight: 1.6 }}>
          Each time cloud or Ollama matches a chip that local missed, the term is saved here.
          On the next encounter it is matched locally — no cloud call needed.
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => void loadLearnedCount()}
            style={{
              padding: '6px 12px', borderRadius: 6, border: '1px solid #e2e8f0',
              background: '#fff', color: '#475569', fontSize: 12, cursor: 'pointer',
            }}
          >
            Count learned terms
          </button>
          {learnedCount !== null && (
            <span style={{ fontSize: 12, color: '#64748b' }}>
              {learnedCount} term{learnedCount !== 1 ? 's' : ''} stored
            </span>
          )}
          {learnedCount !== null && learnedCount > 0 && (
            <button
              type="button"
              onClick={() => void clearLearned()}
              disabled={clearing}
              style={{
                padding: '6px 12px', borderRadius: 6, border: '1px solid #fca5a5',
                background: '#fff', color: '#dc2626', fontSize: 12, cursor: 'pointer',
              }}
            >
              {clearing ? 'Clearing…' : 'Clear all'}
            </button>
          )}
        </div>
      </div>
    </CollapsibleCard>
  );
}
