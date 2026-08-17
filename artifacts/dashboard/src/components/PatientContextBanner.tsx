import { useAppContext } from '@/context/AppContext';
import { VISIT_TYPES } from '@/lib/visit-types';

interface PatientContextBannerProps {
  guidedMode: boolean;
  setGuidedMode: React.Dispatch<React.SetStateAction<boolean>>;
  setNotifyOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setNotifyStatus: React.Dispatch<React.SetStateAction<{ ok: boolean; msg: string } | null>>;
}

const ACUITY_COLORS: Record<string, { bg: string; text: string }> = {
  urgent:   { bg: '#7f1d1d', text: '#fca5a5' },
  priority: { bg: '#431407', text: '#fb923c' },
  review:   { bg: '#422006', text: '#fbbf24' },
  routine:  { bg: '#052e16', text: '#86efac' },
};

/** Sticky patient-context banner at the top of consultation — name, MRN, age/sex,
 * allergies, visit-type badge, notify trigger, guided-mode toggle, acuity. Hidden in
 * ambient mode, where the slim header already covers this context. */
export default function PatientContextBanner({ guidedMode, setGuidedMode, setNotifyOpen, setNotifyStatus }: PatientContextBannerProps) {
  const {
    topSection, patientId, patientName, mrNumber, age, sex, phone, allergies,
    visitType: ctxVisitType, triageResult,
  } = useAppContext();

  const consultAmbient = topSection === 'consultation' && (!!patientId || !!patientName);
  if (topSection !== 'consultation' || consultAmbient) return null;

  const allergyList = allergies.split(',').map(a => a.trim()).filter(Boolean);
  const ac = ACUITY_COLORS[triageResult.acuity] ?? { bg: '#1e293b', text: '#94a3b8' };
  const vt = ctxVisitType ? VISIT_TYPES.find(v => v.id === ctxVisitType) : null;

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 50, marginBottom: 8,
      background: '#0f172a', borderBottom: '1px solid #1e293b',
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '0 14px', height: 36, flexWrap: 'nowrap', overflow: 'hidden',
    }}>
      <span style={{ fontWeight: 700, fontSize: 13, color: '#f1f5f9', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {patientName.trim() || '—'}
      </span>
      {mrNumber && (
        <span style={{ fontSize: 10, color: '#0d9488', background: '#0d948818', borderRadius: 4, padding: '1px 6px', fontWeight: 700, letterSpacing: '0.05em', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {mrNumber}
        </span>
      )}
      {(age || (sex && sex !== 'unknown')) && (
        <span style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {[age && `${age}y`, sex !== 'unknown' && sex].filter(Boolean).join(' · ')}
        </span>
      )}
      {allergyList.length > 0 && (
        <span style={{ fontSize: 11, color: '#fbbf24', background: '#422006', border: '1px solid #78350f', borderRadius: 4, padding: '1px 7px', whiteSpace: 'nowrap', flexShrink: 0 }}>
          ⚠ {allergyList.slice(0, 2).join(', ')}{allergyList.length > 2 ? ` +${allergyList.length - 2}` : ''}
        </span>
      )}
      {allergyList.length === 0 && (
        <span style={{ fontSize: 11, color: '#334155', whiteSpace: 'nowrap', flexShrink: 0 }}>NKDA</span>
      )}
      {/* Visit type badge — persistent context during encounter */}
      {vt && (
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
          color: vt.color, background: `${vt.color}22`,
          border: `1px solid ${vt.color}55`,
          borderRadius: 4, padding: '1px 7px', whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          {vt.icon} {vt.label}
        </span>
      )}

      {/* Notify patient button */}
      {patientId && phone && (
        <button
          type="button"
          onClick={() => { setNotifyOpen(true); setNotifyStatus(null); }}
          title="Send patient notification (SMS/WhatsApp)"
          style={{
            marginLeft: 'auto', padding: '2px 10px', borderRadius: 5, border: 'none',
            cursor: 'pointer', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
            flexShrink: 0, whiteSpace: 'nowrap',
            background: '#0f3460', color: '#93c5fd',
            transition: 'all 0.15s',
          }}
        >
          ✉ Notify
        </button>
      )}

      {/* Guided mode toggle */}
      <button
        type="button"
        onClick={() => setGuidedMode(g => !g)}
        title={guidedMode ? 'Exit guided mode — show all sections' : 'Enter guided mode — one step at a time'}
        style={{
          marginLeft: patientId && phone ? undefined : 'auto',
          padding: '2px 10px', borderRadius: 5, border: 'none',
          cursor: 'pointer', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
          flexShrink: 0, whiteSpace: 'nowrap',
          background: guidedMode ? '#0d9488' : '#1e293b',
          color: guidedMode ? '#fff' : '#475569',
          transition: 'all 0.15s',
        }}
      >
        {guidedMode ? '✦ GUIDED' : '✦ GUIDE'}
      </button>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: ac.text, background: ac.bg, borderRadius: 4, padding: '2px 8px', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {triageResult.acuity}
      </span>
    </div>
  );
}
