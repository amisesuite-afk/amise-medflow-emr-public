import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';

const DIFFERENTIAL_PROMPTS: Record<string, string[]> = {
  'ercp_workup': ['Choledocholithiasis', 'Cholangiocarcinoma', 'Pancreatic head carcinoma', 'Primary sclerosing cholangitis', 'Acute cholangitis', 'Acute hepatitis'],
  'breast':      ['Fibroadenoma', 'Fibrocystic change', 'Breast carcinoma', 'Phyllodes tumour', 'Mastitis / abscess', 'Fat necrosis', 'Ductal carcinoma in situ'],
  'post_op':     ['Surgical site infection', 'Wound dehiscence', 'Intra-abdominal collection', 'Anastomotic leak', 'Pulmonary embolism', 'Deep vein thrombosis', 'Ileus / obstruction'],
  'diabetic_foot':['Diabetic foot ulcer (Wagner grade?)', 'Necrotising fasciitis', 'Osteomyelitis', 'Peripheral arterial disease', 'Cellulitis', 'Abscess'],
  'new_consult': ['Acute appendicitis', 'Cholecystitis', 'Diverticulitis', 'Bowel obstruction', 'Hernia (complicated)', 'Peptic ulcer disease', 'Pancreatitis'],
};

export default function AssessmentTab() {
  const { assessment, setAssessment, differentials, setDifferentials, triageResult } = useAppContext();
  const apptType = triageResult.appointmentType;
  const ddxSuggestions = DIFFERENTIAL_PROMPTS[apptType] || DIFFERENTIAL_PROMPTS['new_consult'];

  return (
    <div className="gap-y">
      <CollapsibleCard title="Working diagnosis / assessment">
        <div className="fld">
          <label>Primary assessment</label>
          <textarea
            value={assessment}
            onChange={e => setAssessment(e.target.value)}
            placeholder="Most likely diagnosis, clinical impression, and reasoning…"
            style={{ minHeight: 100 }}
          />
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Differential diagnoses">
        <div className="fld">
          <label>Differentials (free text or use prompts below)</label>
          <textarea
            value={differentials}
            onChange={e => setDifferentials(e.target.value)}
            placeholder="1. …\n2. …\n3. …"
            style={{ minHeight: 80 }}
          />
        </div>
        <div style={{ marginTop: 10 }}>
          <div className="section-head">Suggested for {apptType.replace(/_/g, ' ')}</div>
          <div className="chips compact">
            {ddxSuggestions.map(d => (
              <button
                key={d}
                type="button"
                className="chip"
                onClick={() => setDifferentials(differentials ? `${differentials}\n${d}` : d)}
              >
                + {d}
              </button>
            ))}
          </div>
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Investigations ordered / results" defaultOpen={false}>
        <div className="fld">
          <label>Lab / imaging results or requests</label>
          <textarea
            placeholder="FBC: Hb 9.2, WBC 14.3, CRP 180…&#10;USS abdomen: CBD 12mm, multiple gallstones…"
            style={{ minHeight: 120 }}
          />
        </div>
      </CollapsibleCard>
    </div>
  );
}
