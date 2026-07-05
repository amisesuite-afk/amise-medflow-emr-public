import { useState } from 'react';
import { useAppContext, type EncounterType } from '@/context/AppContext';
import { type SiteCode } from '@/lib/supabase';

type EncounterMode = 'outpatient' | 'inpatient';

interface SubType {
  type: EncounterType;
  mode: EncounterMode;
  site?: SiteCode;
  topSec?: string;
  label: string;
  hint: string;
}

interface Venue {
  key: string;
  icon: string;
  label: string;
  desc: string;
  accentColor: string;
  subtypes: SubType[];
}

const VENUES: Venue[] = [
  {
    key: 'office',
    icon: '🏥',
    label: 'Office / Clinic',
    desc: 'Outpatient consultations & procedures',
    accentColor: '#0d9488',
    subtypes: [
      { type: 'quick_consult',    mode: 'outpatient', label: 'Quick Review',     hint: 'Results, follow-up, simple visit' },
      { type: 'surgical_consult', mode: 'outpatient', label: 'Surgical Consult', hint: 'Full pre-op assessment & counselling' },
      { type: 'office_procedure', mode: 'outpatient', label: 'Office Procedure', hint: 'FNAC, excision, dressing, injection' },
    ],
  },
  {
    key: 'endo',
    icon: '🔭',
    label: 'Endoscopy Suite',
    desc: 'OGD · Colonoscopy · ERCP · Bronch',
    accentColor: '#2563eb',
    subtypes: [
      { type: 'endoscopy', mode: 'outpatient', label: 'Endoscopy Encounter', hint: 'Diagnostic or therapeutic endoscopy' },
    ],
  },
  {
    key: 'theatre',
    icon: '⚕️',
    label: 'Theatre / OR',
    desc: 'Elective or emergency operative case',
    accentColor: '#7c3aed',
    subtypes: [
      { type: 'surgical_consult', mode: 'outpatient', label: 'Elective Surgery',  hint: 'Planned operative procedure' },
      { type: 'major_emergency',  mode: 'outpatient', label: 'Emergency Surgery', hint: 'Unplanned / emergency operative case' },
    ],
  },
  {
    key: 'er',
    icon: '🚨',
    label: 'Emergency / Acute',
    desc: 'ER referral or acute surgical admission',
    accentColor: '#dc2626',
    subtypes: [
      { type: 'major_emergency', mode: 'outpatient', label: 'Major Emergency', hint: 'Trauma, acute abdomen, emergency admission' },
    ],
  },
  {
    key: 'ward',
    icon: '🛏️',
    label: 'Ward Round',
    desc: 'Inpatient review — Tapion Hospital',
    accentColor: '#d97706',
    subtypes: [
      { type: 'surgical_consult', mode: 'inpatient', site: 'tapion', topSec: 'finaldoc', label: 'Inpatient Review', hint: 'Ward round or inpatient surgical review' },
    ],
  },
];

function venueForState(type: EncounterType, mode: EncounterMode): string {
  if (mode === 'inpatient') return 'ward';
  switch (type) {
    case 'quick_consult':    return 'office';
    case 'office_procedure': return 'office';
    case 'endoscopy':        return 'endo';
    case 'major_emergency':  return 'er';
    default:                 return 'office'; // surgical_consult default
  }
}

export default function EncounterContextPicker() {
  const { encounterType, setEncounterType, encounterMode, setEncounterMode, setCurrentSite, setTopSection } = useAppContext();
  const [open, setOpen] = useState(false);
  const [activeVenueKey, setActiveVenueKey] = useState<string | null>(null);

  const currentVenueKey = venueForState(encounterType, encounterMode);
  const currentVenue    = VENUES.find(v => v.key === currentVenueKey);
  const currentSubtype  = currentVenue?.subtypes.find(s => s.type === encounterType && s.mode === encounterMode);
  const activeVenueObj  = activeVenueKey ? VENUES.find(v => v.key === activeVenueKey) : null;

  function selectSubtype(sub: SubType) {
    setEncounterType(sub.type);
    setEncounterMode(sub.mode);
    if (sub.site) setCurrentSite(sub.site);
    if (sub.topSec) setTopSection(sub.topSec as Parameters<typeof setTopSection>[0]);
    setOpen(false);
    setActiveVenueKey(null);
  }

  function openAndActivate(venueKey: string) {
    setOpen(true);
    setActiveVenueKey(venueKey);
  }

  /* ── Closed: compact summary bar ────────────────────────────────────── */
  if (!open) {
    const accent = currentVenue?.accentColor ?? '#0d9488';
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
        background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 13,
        transition: 'background 0.12s',
      }}
        onClick={() => openAndActivate(currentVenueKey)}
        title="Click to change encounter context"
      >
        <span style={{ fontSize: 18 }}>{currentVenue?.icon}</span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '2px 10px', borderRadius: 999, fontSize: 12,
          background: `${accent}18`, border: `1px solid ${accent}55`,
          color: accent, fontWeight: 700,
        }}>
          {currentVenue?.label}
        </span>
        <span style={{ color: '#94a3b8', fontSize: 11 }}>·</span>
        <span style={{ color: '#374151', fontWeight: 600, fontSize: 12 }}>
          {currentSubtype?.label ?? encounterType.replace(/_/g, ' ')}
        </span>
        <span style={{
          marginLeft: 'auto', fontSize: 11, fontWeight: 600,
          color: '#0d9488', padding: '3px 8px', borderRadius: 6,
          background: '#f0fdfa', border: '1px solid #99f6e4',
        }}>
          Change ▾
        </span>
      </div>
    );
  }

  /* ── Open: venue tile grid + sub-type accordion ──────────────────────── */
  return (
    <div style={{
      borderRadius: 14, border: '1px solid #e2e8f0',
      background: '#fafbfc', padding: 16,
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b7280' }}>
          Where is this encounter happening?
        </span>
        <button type="button" onClick={() => setOpen(false)}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 13 }}>
          ✕
        </button>
      </div>

      {/* Venue tiles */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {VENUES.map(venue => {
          const isActive = activeVenueKey === venue.key;
          return (
            <button
              key={venue.key}
              type="button"
              onClick={() => setActiveVenueKey(isActive ? null : venue.key)}
              style={{
                flex: '1 1 120px', minWidth: 108, maxWidth: 160,
                padding: '12px 10px', borderRadius: 10, cursor: 'pointer',
                textAlign: 'left', transition: 'all 0.15s',
                border: isActive ? `2.5px solid ${venue.accentColor}` : '1.5px solid #e2e8f0',
                background: isActive ? `${venue.accentColor}0f` : '#fff',
                outline: 'none',
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 5, lineHeight: 1 }}>{venue.icon}</div>
              <div style={{
                fontSize: 12, fontWeight: 700, color: isActive ? venue.accentColor : '#1e293b',
                marginBottom: 3, lineHeight: 1.2,
              }}>
                {venue.label}
              </div>
              <div style={{ fontSize: 10, color: '#6b7280', lineHeight: 1.35 }}>
                {venue.desc}
              </div>
            </button>
          );
        })}
      </div>

      {/* Sub-type accordion panel */}
      {activeVenueObj && (
        <div style={{
          padding: '12px 14px', borderRadius: 10,
          background: `${activeVenueObj.accentColor}09`,
          border: `1px solid ${activeVenueObj.accentColor}33`,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: activeVenueObj.accentColor,
            marginBottom: 10,
          }}>
            {activeVenueObj.label} — Select encounter type
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {activeVenueObj.subtypes.map(sub => {
              const isSelected = sub.type === encounterType && sub.mode === encounterMode;
              return (
                <button
                  key={sub.label}
                  type="button"
                  onClick={() => selectSubtype(sub)}
                  style={{
                    padding: '10px 16px', borderRadius: 9, cursor: 'pointer',
                    border: `1.5px solid ${activeVenueObj.accentColor}`,
                    background: isSelected ? activeVenueObj.accentColor : '#fff',
                    color: isSelected ? '#fff' : activeVenueObj.accentColor,
                    fontWeight: 600, fontSize: 13, textAlign: 'left',
                    minWidth: 150, transition: 'all 0.12s',
                  }}
                >
                  <div style={{ marginBottom: 2 }}>{sub.label}</div>
                  <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.8 }}>{sub.hint}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
