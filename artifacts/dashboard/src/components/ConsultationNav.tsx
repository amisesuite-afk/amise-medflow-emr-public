import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppContext, type Section } from '@/context/AppContext';
import { type SectionCompletion } from '@/components/NavSidebar';
import VoiceDictation from '@/components/VoiceDictation';
import ClinicalWorkflowBar from '@/components/ClinicalWorkflowBar';
import ConsultToolsMenu from '@/components/ConsultToolsMenu';
import { getMatrix } from '@/lib/cc-matrices';
import { neighbours, workflowSteps, type ConsultTool, type ConsultToolId } from '@/lib/consult-steps';

interface ConsultationNavProps {
  consultTabs: { id: Section; label: string }[];
  sectionCompletion: SectionCompletion;
  completeEncounter: () => void;
  completing: boolean;
  ambientMode: boolean;
  setAmbientMode: React.Dispatch<React.SetStateAction<boolean>>;
  guidedMode: boolean;
  setGuidedMode: React.Dispatch<React.SetStateAction<boolean>>;
  headerVisitMode: 'new' | 'followup';
  /** Tools this user may open over the current step (Scores, Vitals, Prescriptions, Notes, Tasks). */
  tools: readonly ConsultTool[];
  onOpenTool: (tool: ConsultToolId) => void;
}

const SECTION_ICONS: Partial<Record<Section, string>> = {
  brief: '📄', triage: '⚡', hpi: '💬', pmh: '📋', surgical: '🔪',
  medications: '💊', allergies: '⚠️', family_hx: '🧬', toxic: '🚬',
  ros: '🔍', examination: '🩺', wounds: '🩹',
  investigations: '🧪', blood_gas: '💨', radiology: '🩻', attachments: '📎',
  assessment: '🎯', plan: '📌', procedures: '🔬',
  who_checklist: '✅', periop: '🏥', consent: '✍️',
  prescriptions: '💊', dosing: '💉', fluid_nutrition: '💧',
  referring_providers: '↗️', encounter_history: '📅',
  progress: '📝', monitoring: '📊', tasks: '✓',
};

/** Consultation section navigation — three mutually-exclusive UI modes sharing
 * the same prev/next tab logic: an algorithm-guided CC workflow (the pathway bar), a
 * one-step-at-a-time guided mode with progress dots, or the full scrollable tab strip. Also owns
 * the shared voice-dictation trigger/panel, the Tools menu (every mode) and the tab strip's
 * scroll-into-view / arrow-visibility behaviour.
 *
 * CC workflow (UX review M6): the action row (Back / Dictate / Ambient / Next / Summary) is the
 * pathway bar's header now, not a separate layer, and Back / Next follow the bar's own order. */
export default function ConsultationNav({
  consultTabs, sectionCompletion, completeEncounter, completing,
  ambientMode, setAmbientMode, guidedMode, setGuidedMode, headerVisitMode,
  tools, onOpenTool,
}: ConsultationNavProps) {
  const { topSection, activeSection, setActiveSection, activeCcKey, setTopSection, visitType: ctxVisitType } = useAppContext();
  const [voiceOpen, setVoiceOpen] = useState(false);
  const tabStripRef = useRef<HTMLDivElement>(null);
  const [tsCanLeft, setTsCanLeft]   = useState(false);
  const [tsCanRight, setTsCanRight] = useState(true);

  // Scroll the active tab chip into view when the section changes.
  // scrollIntoView() is unreliable for overflow-x containers on iOS Safari,
  // so we manipulate scrollLeft on the strip element directly.
  useEffect(() => {
    if (topSection !== 'consultation') return;
    const strip = tabStripRef.current;
    if (!strip) return;
    const el = strip.querySelector<HTMLElement>(`#tab-${activeSection}`);
    if (!el) return;
    const elLeft = el.offsetLeft;
    const elRight = elLeft + el.offsetWidth;
    // Centre the active tab in the visible strip window.
    const targetLeft = elLeft - (strip.clientWidth - el.offsetWidth) / 2;
    strip.scrollLeft = Math.max(0, Math.min(targetLeft, strip.scrollWidth - strip.clientWidth));
    // Update arrow visibility immediately after the scroll.
    setTsCanLeft(strip.scrollLeft > 1);
    setTsCanRight(strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1);
    void elLeft; void elRight; // used above for centre calc
  }, [activeSection, topSection]);

  // Keep arrow visibility in sync with manual strip scrolling.
  useEffect(() => {
    const strip = tabStripRef.current;
    if (!strip) return;
    function sync() {
      if (!strip) return;
      setTsCanLeft(strip.scrollLeft > 1);
      setTsCanRight(strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1);
    }
    sync();
    strip.addEventListener('scroll', sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(strip);
    return () => { strip.removeEventListener('scroll', sync); ro.disconnect(); };
  }, [consultTabs]);

  // CC pathway: the bar's steps (matrix order, Scores after Assessment, role-allowed), so Back /
  // Next walk exactly the pills shown.
  const allowedIds = useMemo(() => new Set(consultTabs.map(t => t.id)), [consultTabs]);
  const ccSteps = useMemo(() => {
    const matrix = activeCcKey ? getMatrix(activeCcKey) : undefined;
    if (!matrix) return consultTabs;
    const byId = new Map(consultTabs.map(t => [t.id, t] as const));
    return workflowSteps(matrix.sections)
      .filter(s => allowedIds.has(s))
      .map(s => byId.get(s)!)
      .filter(Boolean);
  }, [activeCcKey, consultTabs, allowedIds]);

  if (topSection !== 'consultation' || ambientMode) return null;

  const toolsMenu = <ConsultToolsMenu tools={tools} activeSection={activeSection} onOpen={onOpenTool} />;

  const curIdx = Math.max(0, consultTabs.findIndex(t => t.id === activeSection));
  const total = consultTabs.length;
  const prevTab = curIdx > 0 ? consultTabs[curIdx - 1] : null;
  const nextTab = curIdx < total - 1 ? consultTabs[curIdx + 1] : null;

  let nav: React.ReactNode;

  // ── Algorithm-guided mode: CC drives the workflow; the pathway bar is the navigation ──
  if (activeCcKey) {
    const { prev: ccPrev, next: ccNext } = neighbours(ccSteps, activeSection);
    nav = (
      <ClinicalWorkflowBar
        allowed={allowedIds}
        leading={ccPrev ? (
          <button type="button" onClick={() => setActiveSection(ccPrev.id)} className="wf-action"
            aria-label={`Back: ${ccPrev.label}`}
            style={{ border: '1px solid var(--line)', background: 'transparent', color: 'var(--muted)', fontWeight: 600 }}>
            ← {ccPrev.label}
          </button>
        ) : null}
        actions={<>
          {toolsMenu}
          <button
            type="button"
            onClick={() => setVoiceOpen(v => !v)}
            title="Voice dictation — dictate into SOAP sections"
            className="wf-action"
            style={{
              border: 'none',
              background: voiceOpen ? '#0d9488' : '#f0fdf4',
              color: voiceOpen ? '#fff' : '#0d9488',
            }}
          >
            🎙 Dictate
          </button>
          <button type="button" onClick={() => setAmbientMode(true)} className="wf-action"
            style={{ border: '1px solid #6ee7b7', background: '#f0fdf4', color: '#0d9488' }}>
            🎙 Ambient
          </button>
          {ccNext && (
            <button type="button" onClick={() => setActiveSection(ccNext.id)} className="wf-action"
              style={{ border: 'none', background: '#0d9488', color: '#fff' }}>
              {SECTION_ICONS[ccNext.id] ?? ''} {ccNext.label} →
            </button>
          )}
          <button type="button" onClick={() => setTopSection('finaldoc')} className="wf-action"
            title="Open encounter summary, export, and sign-off"
            style={{ border: '1.5px solid #0d9488', background: 'transparent', color: '#0d9488' }}>
            📋 Summary
          </button>
        </>}
      />
    );
  } else if (guidedMode) {
    nav = (
      <div style={{ marginBottom: 8 }}>
        {/* Step header — section name + exit */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0 8px', borderBottom: '2px solid #f0fdf4' }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.1em', background: '#f0fdf4', padding: '2px 8px', borderRadius: 4, flexShrink: 0 }}>
            {curIdx + 1} / {total}
          </span>
          <span style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', flex: 1 }}>
            {SECTION_ICONS[consultTabs[curIdx]?.id as Section] ?? ''} {consultTabs[curIdx]?.label ?? ''}
          </span>
          {toolsMenu}
          {/* Voice dictation toggle */}
          <button
            type="button"
            onClick={() => setVoiceOpen(v => !v)}
            title="Voice dictation — dictate into SOAP sections"
            style={{
              padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
              background: voiceOpen ? '#0d9488' : '#f0fdf4',
              color: voiceOpen ? '#fff' : '#0d9488',
            }}
          >
            🎙 Dictate
          </button>
          <button type="button" onClick={() => setAmbientMode(true)}
            style={{ fontSize: 11, color: '#0d9488', background: '#f0fdf4', border: '1px solid #6ee7b7', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
            🎙 Ambient
          </button>
          <button type="button" onClick={() => setGuidedMode(false)}
            style={{ fontSize: 11, color: '#6b7280', background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
            ☰ All sections
          </button>
        </div>
        {/* Voice dictation panel */}
        {voiceOpen && (
          <div style={{ marginBottom: 10 }}>
            <VoiceDictation
              visitType={ctxVisitType ?? headerVisitMode}
              onClose={() => setVoiceOpen(false)}
            />
          </div>
        )}
        {/* Progress dots — tap or keyboard-navigate to any section */}
        <div role="tablist" aria-label="Consultation sections" style={{ display: 'flex', gap: 5, padding: '8px 0 10px', alignItems: 'center' }}>
          {consultTabs.map((t, i) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={i === curIdx}
              aria-label={t.label}
              onClick={() => setActiveSection(t.id)}
              style={{
                width: i === curIdx ? 28 : 8, height: 8, borderRadius: 4, cursor: 'pointer',
                transition: 'all 0.2s ease', border: 'none', padding: 0,
                background: i === curIdx ? '#0d9488'
                  : sectionCompletion[t.id as Section] ? '#6ee7b7'
                  : '#e2e8f0',
              }}
            />
          ))}
        </div>
        {/* Prev / Next */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingBottom: 4 }}>
          {prevTab ? (
            <button type="button" onClick={() => setActiveSection(prevTab.id)}
              style={{ padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151' }}>
              ← {SECTION_ICONS[prevTab.id] ?? ''} {prevTab.label}
            </button>
          ) : <span />}
          {nextTab ? (
            <button type="button" onClick={() => setActiveSection(nextTab.id)}
              style={{ padding: '11px 28px', borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: 'pointer', border: 'none', background: '#0d9488', color: '#fff', boxShadow: '0 2px 10px rgba(13,148,136,0.25)' }}>
              {SECTION_ICONS[nextTab.id] ?? ''} {nextTab.label} →
            </button>
          ) : (
            <button type="button" onClick={completeEncounter} disabled={completing}
              style={{ padding: '11px 22px', borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: completing ? 'wait' : 'pointer', border: '2px solid #0d9488', background: '#f0fdfa', color: '#0d9488', opacity: completing ? 0.7 : 1 }}>
              {completing ? '⏳ Closing…' : '✓ Finish & Summary'}
            </button>
          )}
        </div>
      </div>
    );
  } else {
    // Full tab strip
    nav = (
      <>
        <div className="consult-tabstrip-wrap">
          {tsCanLeft && <div className="ts-fade ts-fade--left" />}
          {tsCanLeft && (
            <button className="ts-scroll-btn ts-scroll-btn--left" aria-label="Scroll tabs left"
              onClick={() => { const s = tabStripRef.current; if (s) s.scrollLeft -= 160; }}>‹</button>
          )}
          <div ref={tabStripRef} className="consult-tabstrip" role="tablist" aria-label="Consultation sections">
            {consultTabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeSection === tab.id}
                aria-controls={`tabpanel-${tab.id}`}
                id={`tab-${tab.id}`}
                className={`ct-tab${activeSection === tab.id ? ' ct-tab--active' : ''}`}
                onClick={() => setActiveSection(tab.id)}
              >
                {SECTION_ICONS[tab.id] && <span style={{ marginRight: 3, fontSize: 11, lineHeight: 1 }}>{SECTION_ICONS[tab.id]}</span>}{tab.label}
              </button>
            ))}
          </div>
          {tsCanRight && <div className="ts-fade ts-fade--right" />}
          {tsCanRight && (
            <button className="ts-scroll-btn ts-scroll-btn--right" aria-label="Scroll tabs right"
              onClick={() => { const s = tabStripRef.current; if (s) s.scrollLeft += 160; }}>›</button>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0 8px', gap: 8, alignItems: 'center' }}>
          {prevTab ? (
            <button type="button" onClick={() => setActiveSection(prevTab.id)}
              style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--line)', background: 'transparent', color: 'var(--muted)' }}>
              ← {SECTION_ICONS[prevTab.id] ?? ''} {prevTab.label}
            </button>
          ) : <span />}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {toolsMenu}
            <button
              type="button"
              onClick={() => setVoiceOpen(v => !v)}
              title="Voice dictation — dictate into SOAP sections"
              style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                cursor: 'pointer', border: 'none', whiteSpace: 'nowrap',
                background: voiceOpen ? '#0d9488' : '#f0fdf4',
                color: voiceOpen ? '#fff' : '#0d9488',
              }}
            >
              🎙 Dictate
            </button>
            <button type="button" onClick={() => setAmbientMode(true)}
              style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid #6ee7b7', background: '#f0fdf4', color: '#0d9488' }}>
              🎙 Ambient
            </button>
            {nextTab && (
              <button type="button" onClick={() => setActiveSection(nextTab.id)}
                style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#1F7A8C', color: '#fff' }}>
                {SECTION_ICONS[nextTab.id] ?? ''} {nextTab.label} →
              </button>
            )}
            <button type="button" onClick={() => setTopSection('finaldoc')}
              title="Open encounter summary, export, and sign-off"
              style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1.5px solid #0d9488', background: 'transparent', color: '#0d9488' }}>
              📋 Summary
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {nav}
      {/* Voice dictation panel — shared across all non-guided consultation modes */}
      {!guidedMode && voiceOpen && (
        <div style={{ marginBottom: 10 }}>
          <VoiceDictation
            visitType={ctxVisitType ?? headerVisitMode}
            onClose={() => setVoiceOpen(false)}
          />
        </div>
      )}
    </>
  );
}
