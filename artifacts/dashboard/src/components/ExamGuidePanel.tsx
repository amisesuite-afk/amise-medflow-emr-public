import { useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';

interface GuideItem {
  finding: string;
  relevance: string;
}

interface GuideSection {
  system: string;
  items: GuideItem[];
}

interface ExamGuide {
  headline: string;
  sections: GuideSection[];
  redFlags: string[];
}

// Keyword rules: if symptoms/assessment contains any match → return guide
const GUIDES: Array<{ match: string[]; guide: ExamGuide }> = [
  {
    match: ['right upper quadrant', 'ruq', 'cholecystitis', 'biliary', 'gallbladder', 'cholelithiasis'],
    guide: {
      headline: 'Right upper quadrant pain — biliary focus',
      sections: [
        {
          system: 'General',
          items: [
            { finding: 'Jaundice (skin, sclera)', relevance: 'Choledocholithiasis / cholangitis' },
            { finding: 'Fever, rigors', relevance: 'Cholecystitis or Charcot triad (cholangitis)' },
          ],
        },
        {
          system: 'Abdomen',
          items: [
            { finding: "Murphy's sign", relevance: 'Inspiratory arrest on RUQ palpation — acute cholecystitis' },
            { finding: 'RUQ tenderness / guarding', relevance: 'Localised peritonism — cholecystitis severity' },
            { finding: 'Palpable gallbladder (Courvoisier)', relevance: 'Painless jaundice + palpable GB → periampullary malignancy until proven otherwise' },
            { finding: 'Hepatomegaly', relevance: 'Hepatic pathology / congestion' },
          ],
        },
      ],
      redFlags: [
        'Charcot triad (fever + jaundice + RUQ pain) → urgent ERCP',
        'Reynolds pentad (+shock, altered consciousness) → septic cholangitis, emergency',
        'Rigidity / diffuse peritonism → perforation',
      ],
    },
  },
  {
    match: ['right iliac fossa', 'rif', 'appendicitis', 'appendix'],
    guide: {
      headline: 'Right iliac fossa pain — appendicitis focus',
      sections: [
        {
          system: 'General',
          items: [
            { finding: 'Low-grade fever (37.5–38.5°C)', relevance: 'Consistent with appendicitis' },
            { finding: 'High fever / rigors', relevance: 'Perforation / abscess' },
          ],
        },
        {
          system: 'Abdomen',
          items: [
            { finding: 'Maximal tenderness at McBurney\'s point', relevance: 'Classic appendicitis localisation' },
            { finding: 'Rovsing\'s sign', relevance: 'LIF pressure → RIF pain (peritoneal irritation)' },
            { finding: 'Psoas sign', relevance: 'Retrocaecal appendix' },
            { finding: 'Obturator sign', relevance: 'Pelvic appendix / pelvic pathology' },
            { finding: 'Rebound tenderness', relevance: 'Peritonism — consider perforation' },
            { finding: 'Rigidity / guarding', relevance: 'Perforation / generalised peritonitis' },
          ],
        },
        {
          system: 'Pelvic / rectal (if indicated)',
          items: [
            { finding: 'Cervical excitation (women)', relevance: 'PID / ectopic differential' },
            { finding: 'Rectal tenderness (PR)', relevance: 'Pelvic appendix' },
          ],
        },
      ],
      redFlags: [
        'Diffuse rigidity → perforation, operative emergency',
        'Pulsatile RIF mass in >55yo → AAA until proven otherwise',
        'Pregnancy: fundal height + BHCG if childbearing age → ectopic',
      ],
    },
  },
  {
    match: ['hernia', 'inguinal', 'groin lump', 'groin swelling'],
    guide: {
      headline: 'Groin / hernia examination',
      sections: [
        {
          system: 'Groin',
          items: [
            { finding: 'Location: above or below inguinal ligament', relevance: 'Above → inguinal; below → femoral (higher strangulation risk)' },
            { finding: 'Reducibility', relevance: 'Irreducible → incarcerated; palpate for impulse on cough' },
            { finding: 'Overlying skin (erythema, warmth)', relevance: 'Strangulation → emergency' },
            { finding: 'Direct vs indirect (finger through deep ring)', relevance: 'Indirect → lateral to inferior epigastric; direct → medial' },
            { finding: 'Contralateral side', relevance: 'Bilateral hernias — address simultaneously?' },
          ],
        },
        {
          system: 'Abdomen',
          items: [
            { finding: 'Distension, bowel sounds', relevance: 'Obstruction from hernia' },
            { finding: 'Cough impulse', relevance: 'Confirm hernial orifice' },
          ],
        },
      ],
      redFlags: [
        'Non-reducible + overlying erythema / tenderness → strangulation, emergency surgery',
        'Obstruction features (distension, vomiting, no flatus) → immediate review',
      ],
    },
  },
  {
    match: ['bowel obstruction', 'obstruction', 'vomiting bile', 'absolute constipation', 'distension'],
    guide: {
      headline: 'Bowel obstruction / ileus',
      sections: [
        {
          system: 'General',
          items: [
            { finding: 'Hydration status (skin turgor, mucous membranes)', relevance: 'Fluid resuscitation priority' },
            { finding: 'Haemodynamic stability', relevance: 'Closed loop obstruction → rapid deterioration' },
          ],
        },
        {
          system: 'Abdomen',
          items: [
            { finding: 'Degree of distension', relevance: 'Large bowel obstruction typically more marked' },
            { finding: 'Visible peristalsis', relevance: 'High small bowel obstruction' },
            { finding: 'Bowel sounds character', relevance: 'Tinkling / high-pitched → mechanical; absent → ileus or advanced obstruction' },
            { finding: 'Tenderness / localised guarding', relevance: 'Strangulation / perforation' },
            { finding: 'All hernial orifices (inguinal, femoral, umbilical)', relevance: 'Missed hernia as cause of obstruction' },
            { finding: 'Rectal examination (empty rectum)', relevance: 'Colonic obstruction — empty rectum above obstruction' },
          ],
        },
      ],
      redFlags: [
        'Tachycardia + peritonism → strangulation, emergency laparotomy',
        'Absent bowel sounds + distension + fever → ischaemia / perforation',
      ],
    },
  },
  {
    match: ['breast lump', 'breast mass', 'breast cancer', 'mastalgia', 'nipple discharge'],
    guide: {
      headline: 'Breast examination',
      sections: [
        {
          system: 'Breast',
          items: [
            { finding: 'Inspection: symmetry, skin changes, peau d\'orange', relevance: 'Inflammatory/locally advanced carcinoma' },
            { finding: 'Nipple: inversion, discharge (character, unilateral)', relevance: 'Bloody discharge → malignancy / intraductal papilloma' },
            { finding: 'Mass: size, shape, consistency, mobility, tenderness', relevance: 'Hard, fixed, irregular → malignancy until proven otherwise' },
            { finding: 'Skin tethering', relevance: 'Ligament of Cooper infiltration → carcinoma' },
            { finding: 'Chest wall fixity', relevance: 'T4 disease' },
          ],
        },
        {
          system: 'Nodal',
          items: [
            { finding: 'Ipsilateral axillary nodes: levels I–III', relevance: 'Nodal staging — N1–N3' },
            { finding: 'Supraclavicular / infraclavicular nodes', relevance: 'N3 disease — advanced staging' },
            { finding: 'Contralateral axilla', relevance: 'Bilateral disease / synchronous' },
          ],
        },
      ],
      redFlags: [
        'Hard, fixed mass + skin changes + axillary nodes → expedited triple assessment',
        'Peau d\'orange + erythema → inflammatory carcinoma, urgent oncology review',
      ],
    },
  },
  {
    match: ['dysphagia', 'swallowing', 'oesophageal', 'oesophagus'],
    guide: {
      headline: 'Dysphagia — upper GI focus',
      sections: [
        {
          system: 'General',
          items: [
            { finding: 'Weight loss (quantify)', relevance: 'Malignancy — progressive dysphagia + weight loss = cancer until proven otherwise' },
            { finding: 'Nutritional status (BMI, muscle wasting)', relevance: 'Surgical risk, need for pre-op optimisation' },
            { finding: 'Hoarse voice', relevance: 'Recurrent laryngeal nerve involvement — mediastinal spread' },
          ],
        },
        {
          system: 'Head and neck',
          items: [
            { finding: 'Cervical lymphadenopathy', relevance: 'Nodal metastasis from oesophageal / pharyngeal cancer' },
            { finding: 'Virchow\'s node (left supraclavicular)', relevance: 'GI malignancy metastasis' },
          ],
        },
        {
          system: 'Abdomen',
          items: [
            { finding: 'Epigastric mass / tenderness', relevance: 'Gastric / GEJ pathology' },
            { finding: 'Hepatomegaly / ascites', relevance: 'Metastatic disease' },
          ],
        },
      ],
      redFlags: [
        'Progressive dysphagia to solids → liquids → urgent endoscopy',
        'Dysphagia + weight loss > 10% → staging CT urgently',
        'Odynophagia + fever → oesophageal perforation until proven otherwise',
      ],
    },
  },
  {
    match: ['thyroid', 'goitre', 'neck lump', 'thyroid nodule'],
    guide: {
      headline: 'Thyroid / neck examination',
      sections: [
        {
          system: 'Neck',
          items: [
            { finding: 'Mass: moves with swallowing (thyroid) vs tongue protrusion (thyroglossal)', relevance: 'Differentiates thyroid from non-thyroid midline mass' },
            { finding: 'Size, consistency, single vs multinodular', relevance: 'Hard irregular nodule → malignancy risk' },
            { finding: 'Fixity to trachea / skin', relevance: 'Local invasion — T4 disease' },
            { finding: 'Tracheal deviation', relevance: 'Retrosternal extension / large goitre' },
            { finding: 'Pemberton\'s sign (arms raised — facial plethora)', relevance: 'Superior vena cava compression from retrosternal goitre' },
            { finding: 'Voice — hoarseness', relevance: 'Recurrent laryngeal nerve involvement' },
          ],
        },
        {
          system: 'Nodal',
          items: [
            { finding: 'Central compartment (level VI)', relevance: 'PTC nodal spread' },
            { finding: 'Lateral nodes (levels II–V)', relevance: 'N1b disease — lateral neck dissection required' },
          ],
        },
        {
          system: 'Thyroid status',
          items: [
            { finding: 'Resting tremor, AF, exophthalmos, lid lag', relevance: 'Hyperthyroidism — anaesthetic risk' },
            { finding: 'Dry skin, bradycardia, slow relaxing reflexes', relevance: 'Hypothyroidism — perioperative risk' },
          ],
        },
      ],
      redFlags: [
        'Stridor → airway compromise from goitre — urgent airway assessment',
        'Hard fixed mass + voice change → malignancy with nerve invasion',
      ],
    },
  },
  {
    match: ['rectal bleeding', 'pr bleed', 'haematochezia', 'per rectum', 'haemorrhoid', 'colorectal'],
    guide: {
      headline: 'Colorectal / lower GI examination',
      sections: [
        {
          system: 'General',
          items: [
            { finding: 'Pallor (conjunctival / palmar)', relevance: 'Anaemia from chronic blood loss' },
            { finding: 'Weight loss', relevance: 'Colorectal malignancy' },
          ],
        },
        {
          system: 'Abdomen',
          items: [
            { finding: 'Palpable mass (RIF / LIF)', relevance: 'Caecal tumour (RIF) / sigmoid (LIF)' },
            { finding: 'Hepatomegaly', relevance: 'Metastatic disease' },
            { finding: 'Ascites', relevance: 'Peritoneal dissemination' },
          ],
        },
        {
          system: 'Perianal / rectal',
          items: [
            { finding: 'External haemorrhoids, skin tags, fistula orifices', relevance: 'Proctological pathology' },
            { finding: 'Digital rectal exam: sphincter tone, mass, tenderness', relevance: 'Low rectal tumour — distance from dentate, fixity' },
            { finding: 'Stool on glove (character)', relevance: 'Melaena → upper GI; bright red → colorectal/anorectal' },
          ],
        },
      ],
      redFlags: [
        'Massive PR bleeding + haemodynamic instability → resuscitate + urgent endoscopy',
        'Change in bowel habit + rectal mass + weight loss → expedited staging',
      ],
    },
  },
];

function getGuides(symptoms: string[], assessment: string): ExamGuide[] {
  const corpus = [...symptoms, assessment].join(' ').toLowerCase();
  return GUIDES.filter(g => g.match.some(kw => corpus.includes(kw))).map(g => g.guide);
}

export default function ExamGuidePanel() {
  const { symptoms, assessment } = useAppContext();

  const guides = useMemo(() => getGuides(symptoms, assessment), [symptoms, assessment]);

  if (guides.length === 0) return null;

  return (
    <CollapsibleCard title={`AI examination guide (${guides.length} suggestion${guides.length > 1 ? 's' : ''})`} defaultOpen>
      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
        Based on the recorded symptoms and assessment. The surgeon retains full clinical judgment.
      </p>

      {guides.map((guide, gi) => (
        <div key={gi} style={{ marginBottom: gi < guides.length - 1 ? 20 : 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 10, padding: '6px 10px', background: '#f1f5f9', borderRadius: 6 }}>
            {guide.headline}
          </div>

          {guide.sections.map(sec => (
            <div key={sec.system} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#64748b', marginBottom: 5 }}>
                {sec.system}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {sec.items.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '5px 8px 5px 0', fontSize: 12, fontWeight: 600, color: '#0f172a', width: '45%', verticalAlign: 'top' }}>
                        {item.finding}
                      </td>
                      <td style={{ padding: '5px 0 5px 8px', fontSize: 12, color: '#475569', verticalAlign: 'top' }}>
                        {item.relevance}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {guide.redFlags.length > 0 && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '8px 12px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                Red flags — act if present
              </div>
              {guide.redFlags.map((flag, i) => (
                <div key={i} style={{ fontSize: 12, color: '#991b1b', marginBottom: 2 }}>• {flag}</div>
              ))}
            </div>
          )}
        </div>
      ))}
    </CollapsibleCard>
  );
}
