/**
 * P4 — AI provider abstraction.
 *
 * Routing priority:
 *   1. Local engine (LocalNarrator, free, instant) — always tried first.
 *   2. Ollama (local LAN / loopback) — if configured and confidence < 0.7.
 *   3. Cloud Claude — fallback when Ollama unavailable or unconfigured.
 *
 * Config is persisted in localStorage so the surgeon sets it once
 * in Settings → AI Provider and it persists across sessions.
 *
 * Ollama requires CORS headers:
 *   OLLAMA_ORIGINS=* ollama serve
 */

export type AIProviderType = 'cloud' | 'ollama';

export interface AIProviderConfig {
  type: AIProviderType;
  ollamaUrl: string;     // e.g. http://localhost:11434 or http://192.168.1.10:11434
  ollamaModel: string;   // e.g. phi3:mini, llama3.2:3b, mistral:7b
}

const STORAGE_KEY = 'amise-ai-provider';

export const DEFAULT_CONFIG: AIProviderConfig = {
  type: 'cloud',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'phi3:mini',
};

export function getAIProviderConfig(): AIProviderConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_CONFIG };
}

export function setAIProviderConfig(patch: Partial<AIProviderConfig>): void {
  const current = getAIProviderConfig();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
}

// ── Section-specific prompts for Ollama ──────────────────────────────────────

function buildOllamaPrompt(section: string, text: string, chipOptions: string[]): string {
  const chips = chipOptions.length > 0 ? `\nAvailable options: ${chipOptions.join(', ')}` : '';

  const instructions: Record<string, string> = {
    pmh: `Extract past medical history from the text below.${chips}\nReturn JSON: {"matched":["exact option labels from the list above"],"additional":["conditions not in the list"],"notes":"clean prose summary"}`,
    medications: `Extract medications from the text below.${chips}\nReturn JSON: {"matched":["exact option labels from the list above"],"medicationsText":"full medication list with doses as prose"}`,
    allergies: `Extract allergies from the text below.\nReturn JSON: {"allergies":"comma-separated list of allergens and reactions"}`,
    examination: `Extract examination findings from the text below.\nReturn JSON: {"general":null,"cardio":null,"resp":null,"abdomen":null,"neuro":null,"extremities":null,"breast":null,"wound":null} — fill each key with the finding or leave null if not mentioned.`,
  };

  const instruction = instructions[section] ?? `Extract structured clinical data from the text below.\nReturn valid JSON.`;

  return `You are a surgical EMR data extraction assistant. ${instruction}\n\nText:\n${text}\n\nRespond with ONLY valid JSON, no explanation.`;
}

// ── Ollama call ───────────────────────────────────────────────────────────────

export async function parseWithOllama(
  section: string,
  text: string,
  chipOptions: string[],
  config: AIProviderConfig,
): Promise<Record<string, unknown>> {
  const prompt = buildOllamaPrompt(section, text, chipOptions);

  const r = await fetch(`${config.ollamaUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.ollamaModel,
      prompt,
      format: 'json',
      stream: false,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!r.ok) throw new Error(`Ollama ${r.status}: ${await r.text()}`);

  const data = await r.json() as { response: string };
  return JSON.parse(data.response) as Record<string, unknown>;
}

// ── Connectivity check ────────────────────────────────────────────────────────

export async function testOllamaConnection(url: string): Promise<{ ok: boolean; models?: string[]; error?: string }> {
  try {
    const r = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(5_000) });
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
    const data = await r.json() as { models: Array<{ name: string }> };
    return { ok: true, models: data.models?.map(m => m.name) ?? [] };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Connection failed' };
  }
}
