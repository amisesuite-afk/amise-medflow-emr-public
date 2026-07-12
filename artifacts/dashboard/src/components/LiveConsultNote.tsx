import { useState } from 'react';
import { PencilIcon } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import { Spinner } from '@/components/ui/spinner';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';

// ── Types ─────────────────────────────────────────────────────────────────────

type SoapSectionKey = 'Subjective' | 'Objective' | 'Assessment' | 'Plan';

interface SoapSection {
  key: SoapSectionKey;
  label: string;
  getValue(ctx: ReturnType<typeof useAppContext>): string;
  setValue(ctx: ReturnType<typeof useAppContext>, value: string): void;
}

// ── Section definitions ───────────────────────────────────────────────────────

const SOAP_SECTIONS: SoapSection[] = [
  {
    key: 'Subjective',
    label: 'Subjective',
    getValue: ctx => ctx.freeText,
    setValue: (ctx, v) => ctx.setFreeText(v),
  },
  {
    key: 'Objective',
    label: 'Objective',
    getValue: ctx => ctx.examGeneral,
    setValue: (ctx, v) => ctx.setExamGeneral(v),
  },
  {
    key: 'Assessment',
    label: 'Assessment',
    getValue: ctx => ctx.assessment,
    setValue: (ctx, v) => ctx.setAssessment(v),
  },
  {
    key: 'Plan',
    label: 'Plan',
    getValue: ctx => ctx.plan,
    setValue: (ctx, v) => ctx.setPlan(v),
  },
];

// ── Inline editor ─────────────────────────────────────────────────────────────

interface InlineEditorProps {
  section: SoapSectionKey;
  initialText: string;
  onRewrite(rewritten: string): void;
  onCancel(): void;
}

function InlineEditor({ section, initialText, onRewrite, onCancel }: InlineEditorProps) {
  const [editText, setEditText] = useState(initialText);
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRewrite() {
    if (!instruction.trim()) {
      setError('Please enter a rewrite instruction.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const headers = await staffAuthHeaders();
      const res = await fetch(`${getApiOrigin()}/api/ai/edit-note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ section, currentText: editText, instruction }),
      });
      const data = await res.json() as { rewritten?: string; error?: string };
      if (!res.ok || !data.rewritten) {
        setError(data.error ?? 'Rewrite failed — please try again.');
        return;
      }
      onRewrite(data.rewritten);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/40">
      <textarea
        className="w-full rounded border border-gray-300 bg-white p-2 text-sm font-mono leading-relaxed text-gray-800 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        rows={6}
        value={editText}
        onChange={e => setEditText(e.target.value)}
        aria-label={`Edit ${section} section text`}
      />
      <input
        type="text"
        className="mt-2 w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-800 placeholder-gray-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
        placeholder="Rewrite instruction…"
        value={instruction}
        onChange={e => setInstruction(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !loading) void handleRewrite(); }}
        aria-label="Rewrite instruction"
      />
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void handleRewrite()}
          disabled={loading}
          className="flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {loading ? <Spinner className="size-3" /> : null}
          {loading ? 'Rewriting…' : 'Rewrite'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="rounded px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-60 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Note section ──────────────────────────────────────────────────────────────

interface NoteSectionProps {
  section: SoapSection;
  ctx: ReturnType<typeof useAppContext>;
}

function NoteSection({ section, ctx }: NoteSectionProps) {
  const [editing, setEditing] = useState(false);
  const text = section.getValue(ctx);

  function handleRewrite(rewritten: string) {
    section.setValue(ctx, rewritten);
    setEditing(false);
  }

  return (
    <div className="group relative rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
          {section.label}
        </h3>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            title={`Edit ${section.label} with AI`}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            <PencilIcon className="size-3" />
            Edit with AI
          </button>
        )}
      </div>

      {/* Content */}
      <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-200">
        {text || <span className="italic text-gray-400 dark:text-gray-600">No content yet.</span>}
      </div>

      {/* Inline editor */}
      {editing && (
        <InlineEditor
          section={section.key}
          initialText={text}
          onRewrite={handleRewrite}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function LiveConsultNote({ onFinalise }: { onFinalise?: () => void }) {
  const ctx = useAppContext();

  return (
    <div className="flex flex-col gap-3">
      {SOAP_SECTIONS.map(section => (
        <NoteSection key={section.key} section={section} ctx={ctx} />
      ))}
    </div>
  );
}
