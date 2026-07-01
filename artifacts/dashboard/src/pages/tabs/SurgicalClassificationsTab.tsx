import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';

// ── Types ──────────────────────────────────────────────────────────────────────

type Hue = 'green' | 'amber' | 'orange' | 'red' | 'blue' | 'purple';

interface ClassOption {
  grade: string;
  label: string;
  description: string;
  color: Hue;
}

interface ClassSystem {
  id: string;
  title: string;
  subtitle?: string;
  reference?: string;
  hasSide?: boolean;
  options: ClassOption[];
}

interface ClassCategory {
  label: string;
  icon: string;
  systems: ClassSystem[];
}

// ── Classification data ────────────────────────────────────────────────────────

const CLASSIFICATIONS: ClassCategory[] = [
  {
    label: 'Hernia',
    icon: '🩺',
    systems: [
      {
        id: 'gilbert_inguinal',
        title: "Gilbert's Inguinal Hernia Classification",
        subtitle: 'Types I–VII — defect size and posterior wall integrity',
        reference: 'Gilbert AI, 1989',
        hasSide: true,
        options: [
          { grade: 'I',   label: 'Type I',   description: 'Indirect — small defect, tight internal ring, easily reduced sac', color: 'green' },
          { grade: 'II',  label: 'Type II',  description: 'Indirect — moderate defect, internal ring dilated ≤4 cm, sac reducible', color: 'green' },
          { grade: 'III', label: 'Type III', description: 'Indirect — large defect, ring >4 cm, scrotal/fundicular, posterior wall intact', color: 'amber' },
          { grade: 'IV',  label: 'Type IV',  description: 'Direct — total floor defect (entire Hesselbach triangle), floor blowout', color: 'amber' },
          { grade: 'V',   label: 'Type V',   description: 'Direct — small diverticular defect, isolated bulge in posterior wall', color: 'amber' },
          { grade: 'VI',  label: 'Type VI',  description: 'Combined (Pantaloon) — concurrent indirect + direct components', color: 'orange' },
          { grade: 'VII', label: 'Type VII', description: 'Femoral hernia', color: 'red' },
        ],
      },
      {
        id: 'nyhus_inguinal',
        title: 'Nyhus Classification (Inguinal Hernia)',
        subtitle: 'Anatomical classification by defect type and floor weakness',
        reference: 'Nyhus LM, 1993',
        hasSide: true,
        options: [
          { grade: 'I',    label: 'Type I',    description: 'Indirect — normal internal ring, floor intact (paediatric)', color: 'green' },
          { grade: 'IIa',  label: 'Type IIa',  description: 'Indirect — dilated internal ring, floor intact', color: 'green' },
          { grade: 'IIb',  label: 'Type IIb',  description: 'Indirect — dilated ring, floor minimally distorted', color: 'amber' },
          { grade: 'IIIa', label: 'Type IIIa', description: 'Direct — floor weakness (Hesselbach triangle)', color: 'amber' },
          { grade: 'IIIb', label: 'Type IIIb', description: 'Indirect — large defect, scrotal, sliding, or pantaloon', color: 'orange' },
          { grade: 'IIIc', label: 'Type IIIc', description: 'Femoral hernia', color: 'orange' },
          { grade: 'IV',   label: 'Type IV',   description: 'Recurrent hernia — any type; may be combined', color: 'red' },
        ],
      },
      {
        id: 'ehs_ventral',
        title: 'EHS Ventral / Incisional Hernia (Width)',
        subtitle: 'European Hernia Society — width classification',
        reference: 'Muysoms FE et al., Hernia 2009',
        hasSide: false,
        options: [
          { grade: 'W1', label: 'W1 ≤4 cm',    description: 'Small defect — width ≤4 cm', color: 'green' },
          { grade: 'W2', label: 'W2 4–10 cm',  description: 'Medium defect — width 4–10 cm', color: 'amber' },
          { grade: 'W3', label: 'W3 >10 cm',   description: 'Large defect — width >10 cm', color: 'red' },
        ],
      },
      {
        id: 'chevrel_incisional',
        title: 'CRH (Chevrel-Rath-Mannell) — Incisional Hernia',
        subtitle: 'Location · Width · Number of recurrences',
        reference: 'Chevrel JP, Rath AM, Hernia 2000',
        hasSide: false,
        options: [
          { grade: 'M',  label: 'M — Midline',     description: 'Midline location (L = lateral, ML = both)', color: 'blue' },
          { grade: 'W1', label: 'W1 <5 cm',         description: 'Width <5 cm', color: 'green' },
          { grade: 'W2', label: 'W2 5–10 cm',       description: 'Width 5–10 cm', color: 'amber' },
          { grade: 'W3', label: 'W3 10–15 cm',      description: 'Width 10–15 cm', color: 'orange' },
          { grade: 'W4', label: 'W4 >15 cm',        description: 'Width >15 cm ("loss of domain")', color: 'red' },
          { grade: 'R0', label: 'R0 — Primary',     description: 'No prior repair', color: 'green' },
          { grade: 'R1', label: 'R1 — 1st recur.', description: 'One prior repair', color: 'amber' },
          { grade: 'R2', label: 'R2 — 2nd recur.', description: 'Two prior repairs', color: 'orange' },
          { grade: 'R3', label: 'R3 — ≥3 recur.',  description: 'Three or more prior repairs', color: 'red' },
        ],
      },
    ],
  },
  {
    label: 'Chronic Venous Disease',
    icon: '🦵',
    systems: [
      {
        id: 'ceap_clinical',
        title: 'CEAP Clinical Classification — Varicose Veins / CVD',
        subtitle: 'C0–C6 clinical severity of chronic venous disease',
        reference: 'Lurie F et al., J Vasc Surg 2020 (revised)',
        hasSide: true,
        options: [
          { grade: 'C0',  label: 'C0',  description: 'No visible or palpable signs of venous disease', color: 'green' },
          { grade: 'C1',  label: 'C1',  description: 'Telangiectasia or reticular veins (<3 mm)', color: 'green' },
          { grade: 'C2',  label: 'C2',  description: 'Varicose veins (≥3 mm diameter)', color: 'amber' },
          { grade: 'C2r', label: 'C2r', description: 'Recurrent varicose veins (post-treatment)', color: 'amber' },
          { grade: 'C3',  label: 'C3',  description: 'Oedema — without skin changes', color: 'amber' },
          { grade: 'C4a', label: 'C4a', description: 'Pigmentation or eczema', color: 'orange' },
          { grade: 'C4b', label: 'C4b', description: 'Lipodermatosclerosis or atrophie blanche', color: 'orange' },
          { grade: 'C4c', label: 'C4c', description: 'Corona phlebectatica', color: 'orange' },
          { grade: 'C5',  label: 'C5',  description: 'Healed venous ulcer', color: 'red' },
          { grade: 'C6',  label: 'C6',  description: 'Active venous ulcer', color: 'red' },
          { grade: 'C6r', label: 'C6r', description: 'Recurrent active venous ulcer', color: 'red' },
        ],
      },
      {
        id: 'widmer_venous',
        title: 'Widmer Classification — Chronic Venous Insufficiency',
        subtitle: 'Clinical staging of CVI severity',
        reference: 'Widmer LK, 1978',
        hasSide: true,
        options: [
          { grade: 'I',   label: 'Grade I',   description: 'Dilated veins, ankle oedema, corona phlebectatica paraplantaris', color: 'green' },
          { grade: 'II',  label: 'Grade II',  description: 'Trophic skin changes — lipodermatosclerosis, hyperpigmentation, white atrophy', color: 'amber' },
          { grade: 'III', label: 'Grade III', description: 'Frank venous ulceration — florid or healed', color: 'red' },
        ],
      },
    ],
  },
  {
    label: 'Anorectal',
    icon: '🔬',
    systems: [
      {
        id: 'goligher_haemorrhoids',
        title: "Goligher's Internal Haemorrhoid Classification",
        subtitle: 'Grade I–IV by degree of prolapse — guides treatment selection',
        reference: 'Goligher JC, 1975',
        hasSide: false,
        options: [
          { grade: 'I',   label: 'Grade I',   description: 'Bleed only — no prolapse, arise above dentate line', color: 'green' },
          { grade: 'II',  label: 'Grade II',  description: 'Prolapse on straining — reduce spontaneously', color: 'green' },
          { grade: 'III', label: 'Grade III', description: 'Prolapse on straining — require manual reduction', color: 'amber' },
          { grade: 'IV',  label: 'Grade IV',  description: 'Permanently prolapsed — irreducible, incarceration risk', color: 'red' },
        ],
      },
      {
        id: 'parks_fistula',
        title: "Parks' Classification — Anal Fistula-in-Ano",
        subtitle: 'Relationship of track to external anal sphincter',
        reference: 'Parks AG, Gordon PH, Hardcastle JD, 1976',
        hasSide: false,
        options: [
          { grade: 'Intersphincteric',  label: 'Intersphincteric',  description: 'Track between internal and external sphincter — most common (70%); low risk to continence', color: 'green' },
          { grade: 'Transsphincteric',  label: 'Transsphincteric',  description: 'Track crosses external sphincter — moderate continence risk; LIFT or staged seton', color: 'amber' },
          { grade: 'Suprasphincteric',  label: 'Suprasphincteric',  description: 'Track loops above puborectalis — high continence risk; technically demanding', color: 'orange' },
          { grade: 'Extrasphincteric',  label: 'Extrasphincteric',  description: 'Track entirely outside sphincters — rarest; often secondary to pelvic pathology or Crohn\'s', color: 'red' },
        ],
      },
    ],
  },
  {
    label: 'Peripheral Arterial Disease',
    icon: '🫀',
    systems: [
      {
        id: 'fontaine_pad',
        title: 'Fontaine Classification — PAD',
        subtitle: 'Clinical staging of peripheral arterial occlusive disease',
        reference: 'Fontaine R et al., 1954',
        hasSide: true,
        options: [
          { grade: 'I',   label: 'Stage I',   description: 'Asymptomatic — haemodynamically significant stenosis, no symptoms', color: 'green' },
          { grade: 'IIa', label: 'Stage IIa', description: 'Intermittent claudication — walking distance >200 m', color: 'green' },
          { grade: 'IIb', label: 'Stage IIb', description: 'Intermittent claudication — walking distance <200 m', color: 'amber' },
          { grade: 'III', label: 'Stage III', description: 'Ischaemic rest pain — nocturnal, foot dependent for relief', color: 'orange' },
          { grade: 'IV',  label: 'Stage IV',  description: 'Tissue loss — trophic ulceration, gangrene, necrosis', color: 'red' },
        ],
      },
      {
        id: 'rutherford_pad',
        title: 'Rutherford Classification — Chronic Limb Ischaemia',
        subtitle: 'SVS/ISCVS categories for chronic peripheral arterial disease',
        reference: 'Rutherford RB et al., J Vasc Surg 1997',
        hasSide: true,
        options: [
          { grade: '0', label: 'Cat 0 — Asymptomatic',  description: 'No haemodynamic compromise — normal treadmill/reactive hyperaemia test', color: 'green' },
          { grade: '1', label: 'Cat 1 — Mild IC',        description: 'Mild intermittent claudication — completes treadmill; post-exercise ABI >50 mmHg', color: 'green' },
          { grade: '2', label: 'Cat 2 — Moderate IC',    description: 'Moderate claudication — between categories 1 and 3', color: 'amber' },
          { grade: '3', label: 'Cat 3 — Severe IC',      description: 'Severe claudication — cannot complete standard treadmill; post-exercise ABI <50 mmHg', color: 'amber' },
          { grade: '4', label: 'Cat 4 — Rest pain',      description: 'Ischaemic rest pain — rest ABI usually <40 mmHg; ankle/metatarsal pressure <30 mmHg', color: 'orange' },
          { grade: '5', label: 'Cat 5 — Minor loss',     description: 'Minor tissue loss — non-healing ulcer, focal gangrene with diffuse pedal ischaemia', color: 'red' },
          { grade: '6', label: 'Cat 6 — Major loss',     description: 'Major tissue loss — gangrene above TM level; foot not salvageable', color: 'red' },
        ],
      },
    ],
  },
  {
    label: 'General Surgical',
    icon: '🏥',
    systems: [
      {
        id: 'asa_status',
        title: 'ASA Physical Status Classification',
        subtitle: 'Pre-operative risk stratification — American Society of Anesthesiologists',
        reference: 'ASA, revised 2020',
        hasSide: false,
        options: [
          { grade: 'I',   label: 'ASA I',   description: 'Normal healthy patient — no organic, physiological or psychiatric disease', color: 'green' },
          { grade: 'II',  label: 'ASA II',  description: 'Mild systemic disease — controlled DM/HTN, BMI <40, mild COPD, social alcohol', color: 'green' },
          { grade: 'III', label: 'ASA III', description: 'Severe systemic disease — poorly controlled DM/HTN, morbid obesity, active hepatitis, EF <35%, ESRD on dialysis', color: 'amber' },
          { grade: 'IV',  label: 'ASA IV',  description: 'Constant threat to life — recent MI/CVA (<3 mo), ongoing cardiac ischaemia, severe valvular disease, sepsis', color: 'orange' },
          { grade: 'V',   label: 'ASA V',   description: 'Moribund — not expected to survive without the operation (ruptured AAA, massive haemorrhage, intracranial bleed)', color: 'red' },
          { grade: 'VI',  label: 'ASA VI',  description: 'Brain-dead — organ procurement only', color: 'red' },
        ],
      },
      {
        id: 'clavien_dindo',
        title: 'Clavien-Dindo — Post-operative Complications',
        subtitle: 'Grading by treatment required; suffix "d" if complication present at discharge',
        reference: 'Dindo D, Demartines N, Clavien PA, Ann Surg 2004',
        hasSide: false,
        options: [
          { grade: 'I',    label: 'Grade I',    description: 'Deviation from normal course — bed rest, physiotherapy, oral drugs, wound care only', color: 'green' },
          { grade: 'II',   label: 'Grade II',   description: 'Pharmacological treatment beyond Grade I — blood transfusion, TPN, IV antibiotics', color: 'green' },
          { grade: 'IIIa', label: 'Grade IIIa', description: 'Intervention required — under local anaesthesia (e.g. drain insertion, endoscopy)', color: 'amber' },
          { grade: 'IIIb', label: 'Grade IIIb', description: 'Intervention required — under general/regional/spinal anaesthesia', color: 'amber' },
          { grade: 'IVa',  label: 'Grade IVa',  description: 'Life-threatening — ICU management; single organ dysfunction (incl. dialysis)', color: 'orange' },
          { grade: 'IVb',  label: 'Grade IVb',  description: 'Life-threatening — ICU management; multi-organ dysfunction', color: 'red' },
          { grade: 'V',    label: 'Grade V',    description: 'Death', color: 'red' },
        ],
      },
      {
        id: 'altemeier_wound',
        title: 'Altemeier Wound Classification',
        subtitle: 'Surgical site contamination category — predicts SSI risk',
        reference: 'NAS/NRC Ad Hoc Committee, 1964',
        hasSide: false,
        options: [
          { grade: 'Clean',              label: 'Clean (I)',              description: 'Elective, primarily closed, no inflammation — GI / respiratory / biliary not entered. SSI risk <2%', color: 'green' },
          { grade: 'Clean-contaminated', label: 'Clean-Contaminated (II)', description: 'Controlled entry into GI/respiratory/biliary/GU tract, no significant spillage. SSI risk <10%', color: 'amber' },
          { grade: 'Contaminated',       label: 'Contaminated (III)',       description: 'Acute non-purulent inflammation, major GI spillage, open fresh traumatic wounds. SSI risk ~20%', color: 'orange' },
          { grade: 'Dirty-infected',     label: 'Dirty-Infected (IV)',      description: 'Existing clinical infection, perforated viscera, old traumatic wounds. SSI risk ~40%', color: 'red' },
        ],
      },
      {
        id: 'hinchey_diverticulitis',
        title: 'Hinchey Classification — Perforated Diverticulitis',
        subtitle: 'Stages I–IV of diverticular perforation severity; guides operative vs. non-operative approach',
        reference: 'Hinchey EJ et al., Adv Surg 1978',
        hasSide: false,
        options: [
          { grade: 'I',   label: 'Stage I',   description: 'Pericolic / mesenteric abscess — localised, adjacent to perforation site', color: 'green' },
          { grade: 'II',  label: 'Stage II',  description: 'Pelvic / intra-abdominal / retroperitoneal abscess — walled-off distant collection', color: 'amber' },
          { grade: 'III', label: 'Stage III', description: 'Generalised purulent peritonitis — ruptured pericolic / pelvic abscess; no faecal contamination', color: 'orange' },
          { grade: 'IV',  label: 'Stage IV',  description: 'Generalised faecal peritonitis — free perforation of unprepared diverticulum', color: 'red' },
        ],
      },
      {
        id: 'child_pugh',
        title: 'Child-Pugh Classification — Hepatic Reserve',
        subtitle: 'Classes A / B / C for liver disease severity and surgical risk stratification',
        reference: 'Child CG, Turcotte JG, 1964 · Pugh RN et al., Br J Surg 1973',
        hasSide: false,
        options: [
          { grade: 'A', label: 'Class A (5–6 pts)',   description: 'Well-compensated — 1-year survival ~100%; surgical mortality <5%', color: 'green' },
          { grade: 'B', label: 'Class B (7–9 pts)',   description: 'Significant compromise — 1-year survival ~80%; surgical mortality 10–15%', color: 'amber' },
          { grade: 'C', label: 'Class C (10–15 pts)', description: 'Decompensated — 1-year survival ~45%; surgical mortality >25%; consider transplant listing', color: 'red' },
        ],
      },
    ],
  },
];

// ── Colour maps ────────────────────────────────────────────────────────────────

const HUE_BG: Record<Hue, string> = {
  green:  '#d1fae5', amber:  '#fef3c7', orange: '#ffedd5',
  red:    '#fee2e2', blue:   '#dbeafe', purple: '#ede9fe',
};
const HUE_BORDER: Record<Hue, string> = {
  green:  '#6ee7b7', amber:  '#fcd34d', orange: '#fdba74',
  red:    '#fca5a5', blue:   '#93c5fd', purple: '#c4b5fd',
};
const HUE_TEXT: Record<Hue, string> = {
  green:  '#065f46', amber:  '#78350f', orange: '#7c2d12',
  red:    '#7f1d1d', blue:   '#1e3a8a', purple: '#4c1d95',
};

const SIDE_OPTIONS = ['Left', 'Right', 'Bilateral'] as const;
type Side = typeof SIDE_OPTIONS[number];

// ── Classification card ────────────────────────────────────────────────────────

function ClassSystemCard({
  system, value, side, onSelect, onSide,
}: {
  system: ClassSystem;
  value: string;
  side: Side | '';
  onSelect: (grade: string) => void;
  onSide: (s: Side | '') => void;
}) {
  const selected = system.options.find(o => o.grade === value);

  return (
    <div style={{ marginBottom: 4 }}>
      {/* Header */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{system.title}</div>
        {system.subtitle && (
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{system.subtitle}</div>
        )}
        {system.reference && (
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1, fontStyle: 'italic' }}>{system.reference}</div>
        )}
      </div>

      {/* Side selector */}
      {system.hasSide && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: '#64748b', alignSelf: 'center', fontWeight: 600 }}>Side:</span>
          {SIDE_OPTIONS.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => onSide(side === s ? '' : s)}
              style={{
                padding: '3px 10px', borderRadius: 999, fontSize: 11, cursor: 'pointer',
                border: side === s ? '1.5px solid #0d9488' : '1px solid #d1d5db',
                background: side === s ? '#0d9488' : '#f9fafb',
                color: side === s ? '#fff' : '#374151',
                fontWeight: side === s ? 700 : 400,
              }}
            >{s}</button>
          ))}
        </div>
      )}

      {/* Grade chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {system.options.map(opt => {
          const isActive = value === opt.grade;
          return (
            <button
              key={opt.grade}
              type="button"
              onClick={() => onSelect(isActive ? '' : opt.grade)}
              style={{
                padding: '5px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                border: isActive ? `2px solid ${HUE_BORDER[opt.color]}` : '1px solid #e2e8f0',
                background: isActive ? HUE_BG[opt.color] : '#f8fafc',
                color: isActive ? HUE_TEXT[opt.color] : '#374151',
                fontWeight: isActive ? 700 : 500,
                transition: 'all 0.1s',
              }}
            >{opt.label}</button>
          );
        })}
      </div>

      {/* Selected description */}
      {selected && (
        <div style={{
          padding: '10px 14px', borderRadius: 8,
          background: HUE_BG[selected.color],
          border: `1px solid ${HUE_BORDER[selected.color]}`,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: HUE_TEXT[selected.color], marginBottom: 2 }}>
            {selected.label}{system.hasSide && side ? ` — ${side}` : ''}
          </div>
          <div style={{ fontSize: 12, color: HUE_TEXT[selected.color] }}>{selected.description}</div>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SurgicalClassificationsTab() {
  const { surgicalClassifications, setSurgicalClassifications } = useAppContext();
  const [activeCategory, setActiveCategory] = useState(0);

  function setGrade(systemId: string, grade: string) {
    setSurgicalClassifications({ ...surgicalClassifications, [systemId]: grade });
  }
  function setSide(systemId: string, side: Side | '') {
    setSurgicalClassifications({ ...surgicalClassifications, [`${systemId}_side`]: side });
  }

  // Active classifications for the summary badge
  const activeCount = CLASSIFICATIONS
    .flatMap(c => c.systems)
    .filter(s => surgicalClassifications[s.id])
    .length;

  return (
    <div style={{ padding: '16px 20px', maxWidth: 960 }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#1e293b' }}>Surgical Classifications</div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
          Select applicable grade for each classification system. Recorded values appear in the encounter summary.
        </div>
      </div>

      {/* Category tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
        {CLASSIFICATIONS.map((cat, i) => {
          const catActive = cat.systems.filter(s => surgicalClassifications[s.id]).length;
          return (
            <button
              key={cat.label}
              type="button"
              onClick={() => setActiveCategory(i)}
              style={{
                padding: '6px 14px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
                border: activeCategory === i ? '2px solid #0d9488' : '1px solid #e2e8f0',
                background: activeCategory === i ? '#0d9488' : '#f8fafc',
                color: activeCategory === i ? '#fff' : '#374151',
                fontWeight: activeCategory === i ? 700 : 500,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              {catActive > 0 && (
                <span style={{
                  background: activeCategory === i ? 'rgba(255,255,255,0.3)' : '#0d9488',
                  color: '#fff', borderRadius: 999, fontSize: 10, fontWeight: 700,
                  padding: '1px 6px',
                }}>{catActive}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Category systems */}
      {CLASSIFICATIONS[activeCategory]?.systems.map(system => (
        <CollapsibleCard
          key={system.id}
          title={system.title}
          badge={surgicalClassifications[system.id]
            ? `${surgicalClassifications[system.id]}${surgicalClassifications[`${system.id}_side`] ? ` · ${surgicalClassifications[`${system.id}_side`]}` : ''}`
            : undefined}
          defaultOpen={true}
        >
          <ClassSystemCard
            system={system}
            value={surgicalClassifications[system.id] ?? ''}
            side={(surgicalClassifications[`${system.id}_side`] as Side | '') ?? ''}
            onSelect={grade => setGrade(system.id, grade)}
            onSide={s => setSide(system.id, s)}
          />
        </CollapsibleCard>
      ))}

      {/* Summary */}
      {activeCount > 0 && (
        <CollapsibleCard title={`Active Classifications (${activeCount})`} defaultOpen={true}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {CLASSIFICATIONS.flatMap(cat =>
              cat.systems
                .filter(s => surgicalClassifications[s.id])
                .map(s => {
                  const opt = s.options.find(o => o.grade === surgicalClassifications[s.id]);
                  const sideStr = surgicalClassifications[`${s.id}_side`];
                  return (
                    <div key={s.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '8px 12px', borderRadius: 8,
                      background: opt ? HUE_BG[opt.color] : '#f8fafc',
                      border: `1px solid ${opt ? HUE_BORDER[opt.color] : '#e2e8f0'}`,
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{s.title}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: opt ? HUE_TEXT[opt.color] : '#1e293b', marginTop: 1 }}>
                          {opt?.label}{sideStr ? ` — ${sideStr}` : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setGrade(s.id, '')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16, padding: 0 }}
                      >×</button>
                    </div>
                  );
                })
            )}
          </div>
        </CollapsibleCard>
      )}
    </div>
  );
}
