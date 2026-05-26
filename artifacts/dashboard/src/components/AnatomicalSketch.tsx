import { useState } from 'react';
import { useAppContext, AnatomicalFinding } from '@/context/AppContext';
import { useSpeechInput } from '@/hooks/useSpeechInput';

type ZoneMeta = {
  label: string;
  subLocations?: string[];
  findings: string[];
};

const ZONE_META: Record<string, ZoneMeta> = {
  head_neck: {
    label: 'Head / Neck',
    findings: ['Lymphadenopathy', 'Thyroid enlarged', 'JVP elevated', 'Trachea deviated', 'Icterus', 'Pallor', 'Cyanosis', 'Facial asymmetry', 'Parotid swelling', 'Neck mass'],
  },
  breast_R: {
    label: 'Right Breast',
    subLocations: ['UOQ', 'UIQ', 'LOQ', 'LIQ', 'Periareolar', 'Nipple', 'Axillary tail', 'Axilla'],
    findings: ['Mass present', 'Tender', 'Hard', 'Firm', 'Soft', 'Mobile', 'Fixed', 'Smooth', 'Irregular border', 'Skin tethering', "Peau d'orange", 'Skin erythema', 'Ulceration', 'Nipple discharge', 'Nipple inversion', 'Eczematous change', 'Swelling', 'Axillary node palpable', 'No abnormality'],
  },
  breast_L: {
    label: 'Left Breast',
    subLocations: ['UOQ', 'UIQ', 'LOQ', 'LIQ', 'Periareolar', 'Nipple', 'Axillary tail', 'Axilla'],
    findings: ['Mass present', 'Tender', 'Hard', 'Firm', 'Soft', 'Mobile', 'Fixed', 'Smooth', 'Irregular border', 'Skin tethering', "Peau d'orange", 'Skin erythema', 'Ulceration', 'Nipple discharge', 'Nipple inversion', 'Eczematous change', 'Swelling', 'Axillary node palpable', 'No abnormality'],
  },
  chest_R: {
    label: 'Right Chest',
    findings: ['Dull to percussion', 'Stony dull', 'Resonant', 'Reduced breath sounds', 'Crackles', 'Wheeze', 'Pleural rub', 'Chest wall tenderness', 'Subcutaneous emphysema', 'Normal'],
  },
  chest_L: {
    label: 'Left Chest',
    findings: ['Dull to percussion', 'Stony dull', 'Resonant', 'Reduced breath sounds', 'Crackles', 'Wheeze', 'Pleural rub', 'Chest wall tenderness', 'Subcutaneous emphysema', 'Normal'],
  },
  abd_RUQ: {
    label: 'Abdomen — RUQ',
    findings: ["Murphy's sign +", 'Tender RUQ', 'Guarding', 'Rigidity', 'Mass palpable', 'Hepatomegaly', 'Rebound', 'Wound present', 'Normal'],
  },
  abd_epi: {
    label: 'Abdomen — Epigastric',
    findings: ['Epigastric tenderness', 'Guarding', 'Mass palpable', 'Pulsatile mass (AAA?)', 'Rebound', 'Hernia present', 'Normal'],
  },
  abd_LUQ: {
    label: 'Abdomen — LUQ',
    findings: ['Tender LUQ', 'Splenomegaly', 'Guarding', 'Mass palpable', 'Rebound', 'Normal'],
  },
  abd_Rflank: {
    label: 'Abdomen — Right Flank',
    findings: ['Tender', 'Mass palpable', 'Loin tenderness', 'Renal angle tenderness', 'Normal'],
  },
  abd_umbil: {
    label: 'Abdomen — Umbilical',
    findings: ['Periumbilical tenderness', 'Umbilical hernia', 'Distension', 'Mass palpable', 'Normal'],
  },
  abd_Lflank: {
    label: 'Abdomen — Left Flank',
    findings: ['Tender', 'Mass palpable', 'Loin tenderness', 'Renal angle tenderness', 'Normal'],
  },
  abd_RIF: {
    label: 'Abdomen — RIF (Right Iliac Fossa)',
    findings: ["Rovsing's sign +", 'McBurney point tender', 'Tender RIF', 'Guarding', 'Rigidity', 'Rebound', 'Mass palpable', 'Hernia orifice checked', 'Normal'],
  },
  abd_hypo: {
    label: 'Abdomen — Hypogastric',
    findings: ['Suprapubic tenderness', 'Bladder distension', 'Uterine mass', 'Mass palpable', 'Hernia present', 'Normal'],
  },
  abd_LIF: {
    label: 'Abdomen — LIF (Left Iliac Fossa)',
    findings: ['Tender LIF', 'Sigmoid mass', 'Guarding', 'Rebound', 'Mass palpable', 'Normal'],
  },
  genitalia: {
    label: 'Genitalia / Perineum',
    findings: ['Scrotal swelling', 'Testicular tenderness', 'Vulvar lesion', 'Labial swelling', 'Urethral discharge', 'Hernia orifices clear', 'Perineal wound', 'Normal'],
  },
  groin_R: {
    label: 'Right Groin',
    findings: ['Inguinal hernia present', 'Femoral hernia present', 'Reducible', 'Irreducible', 'Tender', 'Lymph node enlarged', 'Femoral pulse reduced', 'Scrotal swelling', 'Normal'],
  },
  groin_L: {
    label: 'Left Groin',
    findings: ['Inguinal hernia present', 'Femoral hernia present', 'Reducible', 'Irreducible', 'Tender', 'Lymph node enlarged', 'Femoral pulse reduced', 'Scrotal swelling', 'Normal'],
  },
  arm_R: {
    label: 'Right Upper Arm',
    findings: ['Oedema', 'Wound', 'Tenderness', 'Haematoma', 'Deltoid injection site', 'Weakness', 'Normal'],
  },
  arm_L: {
    label: 'Left Upper Arm',
    findings: ['Oedema', 'Wound', 'Tenderness', 'Haematoma', 'Deltoid injection site', 'Weakness', 'Normal'],
  },
  forearm_R: {
    label: 'Right Forearm',
    findings: ['Oedema', 'IV access site', 'Wound', 'Tenderness', 'Bruising', 'Deformity', 'Radial pulse reduced', 'Normal'],
  },
  forearm_L: {
    label: 'Left Forearm',
    findings: ['Oedema', 'IV access site', 'Wound', 'Tenderness', 'Bruising', 'Deformity', 'Radial pulse reduced', 'Normal'],
  },
  hand_R: {
    label: 'Right Hand / Wrist',
    findings: ['Swelling', 'Tenderness', 'Deformity', 'IV site', 'Pallor', 'Reduced grip', 'Wound', 'Normal'],
  },
  hand_L: {
    label: 'Left Hand / Wrist',
    findings: ['Swelling', 'Tenderness', 'Deformity', 'IV site', 'Pallor', 'Reduced grip', 'Wound', 'Normal'],
  },
  thigh_R: {
    label: 'Right Thigh',
    findings: ['Oedema', 'DVT signs', 'Haematoma', 'Wound', 'Tenderness', 'Femoral pulse reduced', 'Weakness', 'Normal'],
  },
  thigh_L: {
    label: 'Left Thigh',
    findings: ['Oedema', 'DVT signs', 'Haematoma', 'Wound', 'Tenderness', 'Femoral pulse reduced', 'Weakness', 'Normal'],
  },
  knee_R: {
    label: 'Right Knee',
    findings: ['Effusion', 'Tenderness', 'Erythema', 'Swelling', 'Locked', 'Reduced flexion', 'Normal'],
  },
  knee_L: {
    label: 'Left Knee',
    findings: ['Effusion', 'Tenderness', 'Erythema', 'Swelling', 'Locked', 'Reduced flexion', 'Normal'],
  },
  leg_R: {
    label: 'Right Lower Leg / Calf',
    findings: ['Oedema', "DVT signs (Homan's)", 'Varicose veins', 'Calf tenderness', 'Wound', 'Ulcer', 'Cellulitis', 'Erythema', 'Normal'],
  },
  leg_L: {
    label: 'Left Lower Leg / Calf',
    findings: ['Oedema', "DVT signs (Homan's)", 'Varicose veins', 'Calf tenderness', 'Wound', 'Ulcer', 'Cellulitis', 'Erythema', 'Normal'],
  },
  foot_R: {
    label: 'Right Foot',
    findings: ['Wagner 0 (intact skin)', 'Wagner 1 (superficial ulcer)', 'Wagner 2 (deep ulcer)', 'Wagner 3 (deep infection)', 'Wagner 4 (forefoot gangrene)', 'Wagner 5 (whole foot gangrene)', 'DP pulse absent', 'PT pulse absent', 'Sensation reduced', 'Cellulitis', 'Abscess', 'Osteomyelitis suspected', 'Dry gangrene', 'Wet gangrene', 'Normal'],
  },
  foot_L: {
    label: 'Left Foot',
    findings: ['Wagner 0 (intact skin)', 'Wagner 1 (superficial ulcer)', 'Wagner 2 (deep ulcer)', 'Wagner 3 (deep infection)', 'Wagner 4 (forefoot gangrene)', 'Wagner 5 (whole foot gangrene)', 'DP pulse absent', 'PT pulse absent', 'Sensation reduced', 'Cellulitis', 'Abscess', 'Osteomyelitis suspected', 'Dry gangrene', 'Wet gangrene', 'Normal'],
  },
  // Back view zones
  back_head: {
    label: 'Head / Neck (posterior)',
    findings: ['Occipital tenderness', 'Cervical lymphadenopathy', 'Nuchal rigidity', 'C-spine tenderness', 'Neck swelling', 'Normal'],
  },
  back_upper_R: {
    label: 'Right Upper Back / Shoulder',
    findings: ['Tenderness', 'Swelling', 'Winged scapula', 'Wound', 'Subcutaneous crepitus', 'Normal'],
  },
  back_upper_L: {
    label: 'Left Upper Back / Shoulder',
    findings: ['Tenderness', 'Swelling', 'Winged scapula', 'Wound', 'Subcutaneous crepitus', 'Normal'],
  },
  back_lumbar: {
    label: 'Lower Back / Lumbar',
    findings: ['Renal angle tenderness (R)', 'Renal angle tenderness (L)', 'CVAT positive', 'Lumbar tenderness', 'Muscle spasm', 'Sacral oedema', 'Wound / drain', 'Normal'],
  },
  gluteal_R: {
    label: 'Right Gluteal',
    findings: ['Tenderness', 'Injection site', 'Pressure sore', 'Abscess', 'Wound', 'Haematoma', 'Normal'],
  },
  gluteal_L: {
    label: 'Left Gluteal',
    findings: ['Tenderness', 'Injection site', 'Pressure sore', 'Abscess', 'Wound', 'Haematoma', 'Normal'],
  },
  perianal: {
    label: 'Perianal / Rectal',
    findings: ['Haemorrhoids (external)', 'Fistula in ano', 'Pilonidal sinus', 'Perianal abscess', 'Anal fissure', 'Rectal prolapse', 'PR examination performed', 'PR — normal', 'PR — melaena', 'PR — fresh blood', 'PR — mass palpable', 'PR — tenderness', 'Normal'],
  },
  post_knee_R: {
    label: 'Right Popliteal / Posterior Knee',
    findings: ["Baker's cyst", 'Popliteal pulse reduced', 'Popliteal tenderness', 'Swelling', 'Normal'],
  },
  post_knee_L: {
    label: 'Left Popliteal / Posterior Knee',
    findings: ["Baker's cyst", 'Popliteal pulse reduced', 'Popliteal tenderness', 'Swelling', 'Normal'],
  },
  heel_R: {
    label: 'Right Heel',
    findings: ['Pressure sore', 'Ulcer', 'Callus', 'Achilles tenderness', 'Normal'],
  },
  heel_L: {
    label: 'Left Heel',
    findings: ['Pressure sore', 'Ulcer', 'Callus', 'Achilles tenderness', 'Normal'],
  },
};

export function describeAnatomicalFindings(findings: AnatomicalFinding[]): string {
  if (!findings.length) return '';
  return findings
    .filter(f => f.findings.length > 0 || f.notes.trim())
    .map(f => {
      const meta = ZONE_META[f.zone];
      const label = meta?.label ?? f.zone;
      const loc = f.subLocation ? ` (${f.subLocation})` : '';
      const parts: string[] = [];
      if (f.findings.length) parts.push(f.findings.join(', '));
      if (f.notes.trim()) parts.push(f.notes.trim());
      return `${label}${loc}: ${parts.join('. ')}`;
    })
    .join('. ');
}

function getEntryKey(zone: string, subLocation: string | null): string {
  return subLocation ? `${zone}::${subLocation}` : zone;
}

export default function AnatomicalSketch() {
  const { anatomicalFindings, setAnatomicalFindings } = useAppContext();
  const [activeZone, setActiveZone] = useState<string | null>(null);
  const [subLocation, setSubLocation] = useState<string | null>(null);
  const [view, setView] = useState<'front' | 'back'>('front');
  const speech = useSpeechInput();

  function selectZone(zoneId: string) {
    if (activeZone === zoneId) {
      setActiveZone(null);
      setSubLocation(null);
    } else {
      setActiveZone(zoneId);
      setSubLocation(null);
    }
  }

  function getEntry(zone: string, sub: string | null): AnatomicalFinding | undefined {
    return anatomicalFindings.find(f => f.zone === zone && (f.subLocation ?? null) === sub);
  }

  function updateFindings(zone: string, sub: string | null, newFindings: string[]) {
    const existing = getEntry(zone, sub);
    if (existing) {
      setAnatomicalFindings(anatomicalFindings.map(f =>
        f.zone === zone && (f.subLocation ?? null) === sub
          ? { ...f, findings: newFindings }
          : f
      ));
    } else {
      const entry: AnatomicalFinding = { zone, findings: newFindings, notes: '' };
      if (sub) entry.subLocation = sub;
      setAnatomicalFindings([...anatomicalFindings, entry]);
    }
  }

  function updateNotes(zone: string, sub: string | null, notes: string) {
    const existing = getEntry(zone, sub);
    if (existing) {
      setAnatomicalFindings(anatomicalFindings.map(f =>
        f.zone === zone && (f.subLocation ?? null) === sub
          ? { ...f, notes }
          : f
      ));
    } else {
      const entry: AnatomicalFinding = { zone, findings: [], notes };
      if (sub) entry.subLocation = sub;
      setAnatomicalFindings([...anatomicalFindings, entry]);
    }
  }

  function toggleFinding(zone: string, sub: string | null, finding: string) {
    const existing = getEntry(zone, sub);
    const current = existing?.findings ?? [];
    const next = current.includes(finding) ? current.filter(f => f !== finding) : [...current, finding];
    updateFindings(zone, sub, next);
  }

  const meta = activeZone ? ZONE_META[activeZone] : null;
  const needsSub = meta?.subLocations && meta.subLocations.length > 0;
  const canShowFindings = activeZone && (!needsSub || subLocation !== null);
  const currentEntry = activeZone ? getEntry(activeZone, subLocation) : undefined;
  const currentFindings = currentEntry?.findings ?? [];
  const currentNotes = currentEntry?.notes ?? '';

  function hasAnyFindings(zoneId: string): boolean {
    return anatomicalFindings.some(f => f.zone === zoneId && (f.findings.length > 0 || f.notes.trim() !== ''));
  }

  function zoneFill(zoneId: string): string {
    if (activeZone === zoneId) return '#ccfbf1';
    if (hasAnyFindings(zoneId)) return '#fde68a';
    if (zoneId === 'breast_R' || zoneId === 'breast_L') return '#dbeafe';
    return '#f3f4f6';
  }

  function zoneStroke(zoneId: string): string {
    if (activeZone === zoneId) return '#0d9488';
    if (hasAnyFindings(zoneId)) return '#f59e0b';
    if (zoneId === 'breast_R' || zoneId === 'breast_L') return '#bfdbfe';
    return '#9ca3af';
  }

  const _entryKey = getEntryKey;
  void _entryKey;

  // SVG zone helper (inline so it closes over helpers)
  function Z(zoneId: string, shape: React.ReactNode, label: string, lx: number, ly: number, fs = 8) {
    return (
      <g key={zoneId} onClick={() => selectZone(zoneId)} style={{ cursor: 'pointer' }}>
        {shape}
        <text x={lx} y={ly} fontSize={fs} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">{label}</text>
      </g>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {/* Left panel: toggle + SVG */}
      <div style={{ flexShrink: 0 }}>
        {/* Front / Back toggle */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {(['front', 'back'] as const).map(v => (
            <button key={v} type="button" onClick={() => { setView(v); setActiveZone(null); setSubLocation(null); }}
              style={{
                padding: '4px 14px', borderRadius: 6, fontSize: 12, fontWeight: view === v ? 700 : 500,
                border: view === v ? '2px solid #0d9488' : '1px solid #d1d5db',
                background: view === v ? '#0d9488' : '#fff',
                color: view === v ? '#fff' : '#374151',
                cursor: 'pointer',
              }}>
              {v === 'front' ? 'Front' : 'Back'}
            </button>
          ))}
          <span style={{ fontSize: 11, color: '#9ca3af', alignSelf: 'center', marginLeft: 4 }}>
            {hasAnyFindings('any') ? '' : ''}
            <span style={{ display: 'inline-block', width: 10, height: 10, background: '#fde68a', border: '1px solid #f59e0b', borderRadius: 2, marginRight: 3 }} />
            = findings recorded
          </span>
        </div>

        {/* FRONT VIEW SVG */}
        {view === 'front' && (
          <svg viewBox="0 0 240 490" width={220} height={450} style={{ display: 'block', userSelect: 'none' }}>
            {/* Head + Neck */}
            <g onClick={() => selectZone('head_neck')} style={{ cursor: 'pointer' }}>
              <ellipse cx={120} cy={38} rx={28} ry={33} fill={zoneFill('head_neck')} stroke={zoneStroke('head_neck')} strokeWidth={1.5} />
              <rect x={109} y={69} width={22} height={18} rx={4} fill={zoneFill('head_neck')} stroke={zoneStroke('head_neck')} strokeWidth={1.5} />
              <text x={120} y={38} fontSize={8} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Head/Neck</text>
            </g>

            {/* Torso background */}
            <rect x={72} y={87} width={96} height={175} rx={10} fill="#e5e7eb" stroke="none" />

            {/* Chest */}
            <g onClick={() => selectZone('chest_R')} style={{ cursor: 'pointer' }}>
              <rect x={72} y={87} width={48} height={58} rx={6} fill={zoneFill('chest_R')} stroke={zoneStroke('chest_R')} strokeWidth={1.5} />
              <text x={96} y={116} fontSize={8} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Rt Chest</text>
            </g>
            <g onClick={() => selectZone('chest_L')} style={{ cursor: 'pointer' }}>
              <rect x={120} y={87} width={48} height={58} rx={6} fill={zoneFill('chest_L')} stroke={zoneStroke('chest_L')} strokeWidth={1.5} />
              <text x={144} y={116} fontSize={8} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Lt Chest</text>
            </g>

            {/* Abdomen 9-zone */}
            {/* Row 1 */}
            <g onClick={() => selectZone('abd_RUQ')} style={{ cursor: 'pointer' }}>
              <rect x={72} y={145} width={32} height={28} fill={zoneFill('abd_RUQ')} stroke={zoneStroke('abd_RUQ')} strokeWidth={1.5} />
              <text x={88} y={159} fontSize={8} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">RUQ</text>
            </g>
            <g onClick={() => selectZone('abd_epi')} style={{ cursor: 'pointer' }}>
              <rect x={104} y={145} width={32} height={28} fill={zoneFill('abd_epi')} stroke={zoneStroke('abd_epi')} strokeWidth={1.5} />
              <text x={120} y={159} fontSize={8} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Epigas</text>
            </g>
            <g onClick={() => selectZone('abd_LUQ')} style={{ cursor: 'pointer' }}>
              <rect x={136} y={145} width={32} height={28} fill={zoneFill('abd_LUQ')} stroke={zoneStroke('abd_LUQ')} strokeWidth={1.5} />
              <text x={152} y={159} fontSize={8} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">LUQ</text>
            </g>
            {/* Row 2 */}
            <g onClick={() => selectZone('abd_Rflank')} style={{ cursor: 'pointer' }}>
              <rect x={72} y={173} width={32} height={28} fill={zoneFill('abd_Rflank')} stroke={zoneStroke('abd_Rflank')} strokeWidth={1.5} />
              <text x={88} y={187} fontSize={8} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Rt Flank</text>
            </g>
            <g onClick={() => selectZone('abd_umbil')} style={{ cursor: 'pointer' }}>
              <rect x={104} y={173} width={32} height={28} fill={zoneFill('abd_umbil')} stroke={zoneStroke('abd_umbil')} strokeWidth={1.5} />
              <text x={120} y={187} fontSize={8} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Umbil</text>
            </g>
            <g onClick={() => selectZone('abd_Lflank')} style={{ cursor: 'pointer' }}>
              <rect x={136} y={173} width={32} height={28} fill={zoneFill('abd_Lflank')} stroke={zoneStroke('abd_Lflank')} strokeWidth={1.5} />
              <text x={152} y={187} fontSize={8} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Lt Flank</text>
            </g>
            {/* Row 3 */}
            <g onClick={() => selectZone('abd_RIF')} style={{ cursor: 'pointer' }}>
              <rect x={72} y={201} width={32} height={28} fill={zoneFill('abd_RIF')} stroke={zoneStroke('abd_RIF')} strokeWidth={1.5} />
              <text x={88} y={215} fontSize={8} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">RIF</text>
            </g>
            <g onClick={() => selectZone('abd_hypo')} style={{ cursor: 'pointer' }}>
              <rect x={104} y={201} width={32} height={28} fill={zoneFill('abd_hypo')} stroke={zoneStroke('abd_hypo')} strokeWidth={1.5} />
              <text x={120} y={215} fontSize={8} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Hypogas</text>
            </g>
            <g onClick={() => selectZone('abd_LIF')} style={{ cursor: 'pointer' }}>
              <rect x={136} y={201} width={32} height={28} fill={zoneFill('abd_LIF')} stroke={zoneStroke('abd_LIF')} strokeWidth={1.5} />
              <text x={152} y={215} fontSize={8} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">LIF</text>
            </g>

            {/* Genitalia / Perineum */}
            <g onClick={() => selectZone('genitalia')} style={{ cursor: 'pointer' }}>
              <rect x={104} y={233} width={32} height={20} rx={6} fill={zoneFill('genitalia')} stroke={zoneStroke('genitalia')} strokeWidth={1.5} />
              <text x={120} y={243} fontSize={7} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Perineum</text>
            </g>

            {/* Groin */}
            <g onClick={() => selectZone('groin_R')} style={{ cursor: 'pointer' }}>
              <rect x={72} y={262} width={46} height={20} rx={4} fill={zoneFill('groin_R')} stroke={zoneStroke('groin_R')} strokeWidth={1.5} />
              <text x={95} y={272} fontSize={8} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Rt Groin</text>
            </g>
            <g onClick={() => selectZone('groin_L')} style={{ cursor: 'pointer' }}>
              <rect x={122} y={262} width={46} height={20} rx={4} fill={zoneFill('groin_L')} stroke={zoneStroke('groin_L')} strokeWidth={1.5} />
              <text x={145} y={272} fontSize={8} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Lt Groin</text>
            </g>

            {/* Right arm: upper arm → forearm → hand */}
            <g onClick={() => selectZone('arm_R')} style={{ cursor: 'pointer' }}>
              <rect x={40} y={97} width={30} height={62} rx={10} fill={zoneFill('arm_R')} stroke={zoneStroke('arm_R')} strokeWidth={1.5} />
              <text x={55} y={128} fontSize={7} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Rt Arm</text>
            </g>
            <g onClick={() => selectZone('forearm_R')} style={{ cursor: 'pointer' }}>
              <rect x={42} y={163} width={27} height={55} rx={8} fill={zoneFill('forearm_R')} stroke={zoneStroke('forearm_R')} strokeWidth={1.5} />
              <text x={56} y={190} fontSize={7} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Forearm</text>
            </g>
            <g onClick={() => selectZone('hand_R')} style={{ cursor: 'pointer' }}>
              <ellipse cx={56} cy={232} rx={14} ry={18} fill={zoneFill('hand_R')} stroke={zoneStroke('hand_R')} strokeWidth={1.5} />
              <text x={56} y={232} fontSize={7} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Hand R</text>
            </g>

            {/* Left arm: upper arm → forearm → hand */}
            <g onClick={() => selectZone('arm_L')} style={{ cursor: 'pointer' }}>
              <rect x={170} y={97} width={30} height={62} rx={10} fill={zoneFill('arm_L')} stroke={zoneStroke('arm_L')} strokeWidth={1.5} />
              <text x={185} y={128} fontSize={7} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Lt Arm</text>
            </g>
            <g onClick={() => selectZone('forearm_L')} style={{ cursor: 'pointer' }}>
              <rect x={171} y={163} width={27} height={55} rx={8} fill={zoneFill('forearm_L')} stroke={zoneStroke('forearm_L')} strokeWidth={1.5} />
              <text x={185} y={190} fontSize={7} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Forearm</text>
            </g>
            <g onClick={() => selectZone('hand_L')} style={{ cursor: 'pointer' }}>
              <ellipse cx={184} cy={232} rx={14} ry={18} fill={zoneFill('hand_L')} stroke={zoneStroke('hand_L')} strokeWidth={1.5} />
              <text x={184} y={232} fontSize={7} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Hand L</text>
            </g>

            {/* Right leg: thigh → knee → calf */}
            <g onClick={() => selectZone('thigh_R')} style={{ cursor: 'pointer' }}>
              <rect x={75} y={286} width={38} height={65} rx={10} fill={zoneFill('thigh_R')} stroke={zoneStroke('thigh_R')} strokeWidth={1.5} />
              <text x={94} y={318} fontSize={7} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Thigh R</text>
            </g>
            <g onClick={() => selectZone('knee_R')} style={{ cursor: 'pointer' }}>
              <rect x={77} y={355} width={34} height={22} rx={6} fill={zoneFill('knee_R')} stroke={zoneStroke('knee_R')} strokeWidth={1.5} />
              <text x={94} y={366} fontSize={6} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Knee R</text>
            </g>
            <g onClick={() => selectZone('leg_R')} style={{ cursor: 'pointer' }}>
              <rect x={79} y={381} width={30} height={62} rx={8} fill={zoneFill('leg_R')} stroke={zoneStroke('leg_R')} strokeWidth={1.5} />
              <text x={94} y={412} fontSize={7} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Calf R</text>
            </g>
            <g onClick={() => selectZone('foot_R')} style={{ cursor: 'pointer' }}>
              <ellipse cx={94} cy={455} rx={22} ry={12} fill={zoneFill('foot_R')} stroke={zoneStroke('foot_R')} strokeWidth={1.5} />
              <text x={94} y={455} fontSize={7} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Rt Foot</text>
            </g>

            {/* Left leg: thigh → knee → calf */}
            <g onClick={() => selectZone('thigh_L')} style={{ cursor: 'pointer' }}>
              <rect x={127} y={286} width={38} height={65} rx={10} fill={zoneFill('thigh_L')} stroke={zoneStroke('thigh_L')} strokeWidth={1.5} />
              <text x={146} y={318} fontSize={7} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Thigh L</text>
            </g>
            <g onClick={() => selectZone('knee_L')} style={{ cursor: 'pointer' }}>
              <rect x={129} y={355} width={34} height={22} rx={6} fill={zoneFill('knee_L')} stroke={zoneStroke('knee_L')} strokeWidth={1.5} />
              <text x={146} y={366} fontSize={6} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Knee L</text>
            </g>
            <g onClick={() => selectZone('leg_L')} style={{ cursor: 'pointer' }}>
              <rect x={131} y={381} width={30} height={62} rx={8} fill={zoneFill('leg_L')} stroke={zoneStroke('leg_L')} strokeWidth={1.5} />
              <text x={146} y={412} fontSize={7} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Calf L</text>
            </g>
            <g onClick={() => selectZone('foot_L')} style={{ cursor: 'pointer' }}>
              <ellipse cx={146} cy={455} rx={22} ry={12} fill={zoneFill('foot_L')} stroke={zoneStroke('foot_L')} strokeWidth={1.5} />
              <text x={146} y={455} fontSize={7} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Lt Foot</text>
            </g>

            {/* Breasts rendered on top of chest */}
            <g onClick={() => selectZone('breast_R')} style={{ cursor: 'pointer' }}>
              <ellipse cx={90} cy={118} rx={17} ry={17} fill={zoneFill('breast_R')} stroke={zoneStroke('breast_R')} strokeWidth={1.5} />
              <text x={90} y={118} fontSize={8} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Rt Breast</text>
            </g>
            <g onClick={() => selectZone('breast_L')} style={{ cursor: 'pointer' }}>
              <ellipse cx={150} cy={118} rx={17} ry={17} fill={zoneFill('breast_L')} stroke={zoneStroke('breast_L')} strokeWidth={1.5} />
              <text x={150} y={118} fontSize={8} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Lt Breast</text>
            </g>
          </svg>
        )}

        {/* BACK VIEW SVG */}
        {view === 'back' && (
          <svg viewBox="0 0 240 490" width={220} height={450} style={{ display: 'block', userSelect: 'none' }}>
            {/* Head (posterior) */}
            <g onClick={() => selectZone('back_head')} style={{ cursor: 'pointer' }}>
              <ellipse cx={120} cy={38} rx={28} ry={33} fill={zoneFill('back_head')} stroke={zoneStroke('back_head')} strokeWidth={1.5} />
              <rect x={109} y={69} width={22} height={18} rx={4} fill={zoneFill('back_head')} stroke={zoneStroke('back_head')} strokeWidth={1.5} />
              <text x={120} y={38} fontSize={8} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Post Head</text>
            </g>

            {/* Torso background */}
            <rect x={72} y={87} width={96} height={175} rx={10} fill="#e5e7eb" stroke="none" />

            {/* Right upper back (patient right = viewer left) */}
            <g onClick={() => selectZone('back_upper_R')} style={{ cursor: 'pointer' }}>
              <rect x={72} y={87} width={48} height={90} rx={6} fill={zoneFill('back_upper_R')} stroke={zoneStroke('back_upper_R')} strokeWidth={1.5} />
              <text x={96} y={132} fontSize={7} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Upper R</text>
            </g>

            {/* Left upper back */}
            <g onClick={() => selectZone('back_upper_L')} style={{ cursor: 'pointer' }}>
              <rect x={120} y={87} width={48} height={90} rx={6} fill={zoneFill('back_upper_L')} stroke={zoneStroke('back_upper_L')} strokeWidth={1.5} />
              <text x={144} y={132} fontSize={7} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Upper L</text>
            </g>

            {/* Lower back / Lumbar (full width) */}
            <g onClick={() => selectZone('back_lumbar')} style={{ cursor: 'pointer' }}>
              <rect x={72} y={177} width={96} height={85} rx={6} fill={zoneFill('back_lumbar')} stroke={zoneStroke('back_lumbar')} strokeWidth={1.5} />
              <text x={120} y={219} fontSize={8} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Lumbar</text>
            </g>

            {/* Arms (same zones as front) */}
            <g onClick={() => selectZone('arm_R')} style={{ cursor: 'pointer' }}>
              <rect x={40} y={97} width={30} height={62} rx={10} fill={zoneFill('arm_R')} stroke={zoneStroke('arm_R')} strokeWidth={1.5} />
              <text x={55} y={128} fontSize={7} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Rt Arm</text>
            </g>
            <g onClick={() => selectZone('forearm_R')} style={{ cursor: 'pointer' }}>
              <rect x={42} y={163} width={27} height={55} rx={8} fill={zoneFill('forearm_R')} stroke={zoneStroke('forearm_R')} strokeWidth={1.5} />
              <text x={56} y={190} fontSize={7} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Forearm</text>
            </g>
            <g onClick={() => selectZone('arm_L')} style={{ cursor: 'pointer' }}>
              <rect x={170} y={97} width={30} height={62} rx={10} fill={zoneFill('arm_L')} stroke={zoneStroke('arm_L')} strokeWidth={1.5} />
              <text x={185} y={128} fontSize={7} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Lt Arm</text>
            </g>
            <g onClick={() => selectZone('forearm_L')} style={{ cursor: 'pointer' }}>
              <rect x={171} y={163} width={27} height={55} rx={8} fill={zoneFill('forearm_L')} stroke={zoneStroke('forearm_L')} strokeWidth={1.5} />
              <text x={185} y={190} fontSize={7} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Forearm</text>
            </g>

            {/* Gluteal regions */}
            <g onClick={() => selectZone('gluteal_R')} style={{ cursor: 'pointer' }}>
              <rect x={72} y={262} width={46} height={53} rx={8} fill={zoneFill('gluteal_R')} stroke={zoneStroke('gluteal_R')} strokeWidth={1.5} />
              <text x={95} y={288} fontSize={7} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Glut R</text>
            </g>
            <g onClick={() => selectZone('gluteal_L')} style={{ cursor: 'pointer' }}>
              <rect x={122} y={262} width={46} height={53} rx={8} fill={zoneFill('gluteal_L')} stroke={zoneStroke('gluteal_L')} strokeWidth={1.5} />
              <text x={145} y={288} fontSize={7} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Glut L</text>
            </g>

            {/* Perianal (rendered on top of gluteals) */}
            <g onClick={() => selectZone('perianal')} style={{ cursor: 'pointer' }}>
              <rect x={104} y={278} width={32} height={18} rx={6} fill={zoneFill('perianal')} stroke={zoneStroke('perianal')} strokeWidth={1.5} />
              <text x={120} y={287} fontSize={6} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Perianal</text>
            </g>

            {/* Posterior thighs (same zones as front thigh) */}
            <g onClick={() => selectZone('thigh_R')} style={{ cursor: 'pointer' }}>
              <rect x={75} y={320} width={38} height={58} rx={10} fill={zoneFill('thigh_R')} stroke={zoneStroke('thigh_R')} strokeWidth={1.5} />
              <text x={94} y={349} fontSize={7} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Thigh R</text>
            </g>
            <g onClick={() => selectZone('thigh_L')} style={{ cursor: 'pointer' }}>
              <rect x={127} y={320} width={38} height={58} rx={10} fill={zoneFill('thigh_L')} stroke={zoneStroke('thigh_L')} strokeWidth={1.5} />
              <text x={146} y={349} fontSize={7} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Thigh L</text>
            </g>

            {/* Posterior knees / popliteal */}
            <g onClick={() => selectZone('post_knee_R')} style={{ cursor: 'pointer' }}>
              <rect x={77} y={382} width={34} height={22} rx={6} fill={zoneFill('post_knee_R')} stroke={zoneStroke('post_knee_R')} strokeWidth={1.5} />
              <text x={94} y={393} fontSize={6} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Poplit R</text>
            </g>
            <g onClick={() => selectZone('post_knee_L')} style={{ cursor: 'pointer' }}>
              <rect x={129} y={382} width={34} height={22} rx={6} fill={zoneFill('post_knee_L')} stroke={zoneStroke('post_knee_L')} strokeWidth={1.5} />
              <text x={146} y={393} fontSize={6} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Poplit L</text>
            </g>

            {/* Posterior calves (same leg_R/L zones as front) */}
            <g onClick={() => selectZone('leg_R')} style={{ cursor: 'pointer' }}>
              <rect x={79} y={408} width={30} height={42} rx={8} fill={zoneFill('leg_R')} stroke={zoneStroke('leg_R')} strokeWidth={1.5} />
              <text x={94} y={429} fontSize={7} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Calf R</text>
            </g>
            <g onClick={() => selectZone('leg_L')} style={{ cursor: 'pointer' }}>
              <rect x={131} y={408} width={30} height={42} rx={8} fill={zoneFill('leg_L')} stroke={zoneStroke('leg_L')} strokeWidth={1.5} />
              <text x={146} y={429} fontSize={7} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Calf L</text>
            </g>

            {/* Heels */}
            <g onClick={() => selectZone('heel_R')} style={{ cursor: 'pointer' }}>
              <ellipse cx={94} cy={462} rx={22} ry={12} fill={zoneFill('heel_R')} stroke={zoneStroke('heel_R')} strokeWidth={1.5} />
              <text x={94} y={462} fontSize={7} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Heel R</text>
            </g>
            <g onClick={() => selectZone('heel_L')} style={{ cursor: 'pointer' }}>
              <ellipse cx={146} cy={462} rx={22} ry={12} fill={zoneFill('heel_L')} stroke={zoneStroke('heel_L')} strokeWidth={1.5} />
              <text x={146} y={462} fontSize={7} textAnchor="middle" dominantBaseline="middle" fill="#374151" pointerEvents="none">Heel L</text>
            </g>
          </svg>
        )}
      </div>

      {/* Drill-down panel */}
      {activeZone && meta && (
        <div style={{ flex: 1, minWidth: 240, background: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb', padding: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#0d9488', marginBottom: 10 }}>
            {meta.label}
          </div>

          {/* Sub-location step */}
          {needsSub && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>
                Quadrant / location:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {meta.subLocations!.map(sl => {
                  const isOn = subLocation === sl;
                  return (
                    <button key={sl} type="button" onClick={() => setSubLocation(isOn ? null : sl)}
                      style={{ padding: '3px 10px', borderRadius: 14, border: isOn ? '1px solid #0d9488' : '1px solid #d1d5db', background: isOn ? '#0d9488' : '#f9fafb', color: isOn ? '#fff' : '#374151', fontSize: 12, cursor: 'pointer', fontWeight: isOn ? 600 : 400 }}>
                      {sl}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Findings chips */}
          {canShowFindings && (
            <>
              {needsSub && subLocation && (
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>
                  Findings for {meta.label} — {subLocation}:
                </div>
              )}
              {!needsSub && (
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Findings:</div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {meta.findings.map(finding => {
                  const isOn = currentFindings.includes(finding);
                  return (
                    <button key={finding} type="button" onClick={() => toggleFinding(activeZone, subLocation, finding)}
                      style={{ padding: '3px 10px', borderRadius: 14, border: isOn ? '1px solid #0d9488' : '1px solid #d1d5db', background: isOn ? '#0d9488' : '#f9fafb', color: isOn ? '#fff' : '#374151', fontSize: 12, cursor: 'pointer', fontWeight: isOn ? 600 : 400, transition: 'all 0.12s' }}>
                      {finding}
                    </button>
                  );
                })}
              </div>

              {/* Notes textarea + dictate */}
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Notes:</div>
              <textarea
                value={currentNotes}
                onChange={e => updateNotes(activeZone, subLocation, e.target.value)}
                placeholder="Additional findings or free-text…"
                style={{ width: '100%', minHeight: 64, fontSize: 13, borderRadius: 6, border: '1px solid #d1d5db', padding: '6px 8px', resize: 'vertical', boxSizing: 'border-box' }}
              />
              <div style={{ marginTop: 6 }}>
                <button type="button"
                  onClick={() => {
                    if (speech.listening) {
                      speech.stop();
                    } else {
                      speech.start(text => {
                        const updated = currentNotes + (currentNotes ? ' ' : '') + text;
                        updateNotes(activeZone, subLocation, updated);
                      });
                    }
                  }}
                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid', borderColor: speech.listening ? '#ef4444' : '#d1d5db', background: speech.listening ? '#fee2e2' : '#f9fafb', color: speech.listening ? '#dc2626' : '#374151', fontSize: 12, cursor: speech.supported ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 4 }}
                  disabled={!speech.supported}
                  title={speech.supported ? 'Click to dictate findings' : 'Use Chrome or Edge for dictation'}>
                  {speech.listening ? '⏹ Stop' : '🎤 Dictate'}
                </button>
              </div>
            </>
          )}

          {needsSub && !subLocation && (
            <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>
              Select a quadrant / location above to record findings.
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!activeZone && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13, fontStyle: 'italic', minHeight: 100 }}>
          Tap a body zone to record findings
        </div>
      )}
    </div>
  );
}
