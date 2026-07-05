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
  accentColor: string;
  subtypes: SubType[];
}

const VENUES: Venue[] = [
  {
    key: 'office',
    icon: '🏥',
    label: 'Office',
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
    label: 'Endoscopy',
    accentColor: '#2563eb',
    subtypes: [
      { type: 'endoscopy', mode: 'outpatient', label: 'Endoscopy Encounter', hint: 'Diagnostic or therapeutic endoscopy' },
    ],
  },
  {
    key: 'theatre',
    icon: '⚕️',
    label: 'Theatre',
    accentColor: '#7c3aed',
    subtypes: [
      { type: 'surgical_consult', mode: 'outpatient', label: 'Elective Surgery',  hint: 'Planned operative procedure' },
      { type: 'major_emergency',  mode: 'outpatient', label: 'Emergency Surgery', hint: 'Unplanned / emergency operative case' },
    ],
  },
  {
    key: 'er',
    icon: '🚨',
    label: 'Emergency',
    accentColor: '#dc2626',
    subtypes: [
      { type: 'major_emergency', mode: 'outpatient', label: 'Major Emergency', hint: 'Trauma, acute abdomen, emergency admission' },
    ],
  },
  {
    key: 'ward',
    icon: '🛏️',
    label: 'Ward',
    accentColor: '#d97706',
    subtypes: [
      { type: 'surgical_consult', mode: 'inpatient', site: 'tapion', topSec: 'finaldoc', label: 'Inpatient Review', hint: 'Ward round — Tapion Hospital' },
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
    default:                 return 'office';
  }
}

// Map encounter type to a human-readable description for the summary line
const TYPE_DESC: Record<EncounterType, string> = {
  quick_consult:    'Quick Review',
  surgical_consult: 'Surgical Consult',
  office_procedure: 'Office Procedure',
  endoscopy:        'Endoscopy Encounter',
  major_emergency:  'Major Emergency',
};

export default function EncounterContextPicker() {
  const { encounterType, setEncounterType, encounterMode, setEncounterMode, setCurrentSite, setTopSection } = useAppContext();
  const [expandedVenue, setExpandedVenue] = useState<string | null>(null);

  const currentVenueKey = venueForState(encounterType, encounterMode);

  function selectSubtype(sub: SubType) {
    setEncounterType(sub.type);
    setEncounterMode(sub.mode);
    if (sub.site) setCurrentSite(sub.site);
    if (sub.topSec) setTopSection(sub.topSec as Parameters<typeof setTopSection>[0]);
    setExpandedVenue(null);
  }

  const activeVenue = VENUES.find(v => v.key === currentVenueKey)!;
  const expandedVenueObj = expandedVenue ? VENUES.find(v => v.key === expandedVenue) : null;

  return (
    <div style={{ marginBottom: 8 }}>
      {/* ── Venue strip ── */}
      <div style={{
        display: 'flex', gap: 6, padding: '6px 0',
        borderBottom: expandedVenueObj ? 'none' : '1px solid #e2e8f0',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        {VENUES.map(venue => {
          const isCurrent  = venue.key === currentVenueKey;
          const isExpanded = venue.key === expandedVenue;
          const accent     = venue.accentColor;

          return (
            <button
              key={venue.key}
              type="button"
              onClick={() => setExpandedVenue(isExpanded ? null : venue.key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
                fontSize: 12, fontWeight: isCurrent ? 700 : 500,
                border: isCurrent
                  ? `2px solid ${accent}`
                  : isExpanded
                    ? `1.5px solid ${accent}`
                    : '1.5px solid #e2e8f0',
                background: isCurrent
                  ? `${accent}18`
                  : isExpanded
                    ? `${accent}0c`
                    : '#fff',
                color: isCurrent || isExpanded ? accent : '#6b7280',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>{venue.icon}</span>
              <span>{venue.label}</span>
              {isCurrent && (
                <span style={{
                  fontSize: 10, background: accent, color: '#fff',
                  borderRadius: 4, padding: '1px 5px', marginLeft: 2,
                }}>
                  {TYPE_DESC[encounterType]}
                </span>
              )}
            </button>
          );
        })}

        {/* Current context summary on the right */}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9ca3af' }}>
          Tap a venue to change encounter type
        </span>
      </div>

      {/* ── Sub-type accordion — only shown for the expanded venue ── */}
      {expandedVenueObj && (
        <div style={{
          padding: '12px 14px', marginTop: 0,
          borderRadius: '0 0 10px 10px',
          background: `${expandedVenueObj.accentColor}08`,
          border: `1px solid ${expandedVenueObj.accentColor}30`,
          borderTop: 'none',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: expandedVenueObj.accentColor,
            marginBottom: 10,
          }}>
            {expandedVenueObj.icon} {expandedVenueObj.label} — select encounter type
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {expandedVenueObj.subtypes.map(sub => {
              const isSelected = sub.type === encounterType && sub.mode === encounterMode;
              const accent = expandedVenueObj.accentColor;
              return (
                <button
                  key={sub.label}
                  type="button"
                  onClick={() => selectSubtype(sub)}
                  style={{
                    padding: '9px 16px', borderRadius: 9, cursor: 'pointer',
                    border: `2px solid ${isSelected ? accent : `${accent}55`}`,
                    background: isSelected ? accent : '#fff',
                    color: isSelected ? '#fff' : accent,
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
