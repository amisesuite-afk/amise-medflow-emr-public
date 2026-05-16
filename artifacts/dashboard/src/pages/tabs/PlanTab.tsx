import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';

const PLAN_TEMPLATES: Record<string, string> = {
  emergency: `1. Resuscitate — IV access x2, O2 supplementation\n2. Bloods: FBC, U&E, LFTs, coagulation, cultures\n3. Imaging: USS / CT\n4. NPO\n5. IV antibiotics (specify)\n6. Surgical / specialty consult\n7. Admit under surgical team`,
  cholangitis: `1. IV access, fluid resuscitation\n2. FBC, LFTs, bilirubin, amylase, blood cultures\n3. IV antibiotics: pip-tazo 4.5g TDS\n4. NPO\n5. USS abdomen (CBD diameter, stones)\n6. ERCP planning — contact endoscopy\n7. Admit under surgical team`,
  breast: `1. Triple assessment: clinical + mammogram + USS\n2. Core biopsy if suspicious\n3. Breast clinic follow-up\n4. MDT discussion if malignancy confirmed\n5. Patient information and support`,
  diabetic_foot: `1. Wound swab for MCS\n2. X-ray foot (osteomyelitis)\n3. FBC, CRP, HbA1c, glucose, renal function\n4. IV antibiotics if systemically unwell\n5. Vascular assessment (ABI, Doppler)\n6. Surgical debridement if Wagner 3+\n7. Podiatry and diabetic foot team referral\n8. Tight glycaemic control`,
};

export default function PlanTab() {
  const { plan, setPlan, triageResult } = useAppContext();
  const acuity = triageResult.acuity;
  const apptType = triageResult.appointmentType;

  const templates = [
    { label: 'Emergency', key: 'emergency' as const },
    { label: 'Cholangitis', key: 'cholangitis' as const },
    { label: 'Breast', key: 'breast' as const },
    { label: 'Diabetic foot', key: 'diabetic_foot' as const },
  ];

  return (
    <div className="gap-y">
      <CollapsibleCard title="Management plan">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {templates.map(t => (
            <button
              key={t.key}
              type="button"
              className="chip"
              onClick={() => setPlan(PLAN_TEMPLATES[t.key])}
            >
              Use {t.label} template
            </button>
          ))}
        </div>
        <div className="fld">
          <label>Plan</label>
          <textarea
            value={plan}
            onChange={e => setPlan(e.target.value)}
            placeholder="Management steps in order…"
            style={{ minHeight: 200 }}
          />
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Follow-up / discharge instructions" defaultOpen={false}>
        <div className="fld">
          <label>Follow-up plan and patient instructions</label>
          <textarea
            placeholder="Review in OPD in 2 weeks…&#10;Return immediately if: fever, increasing pain, vomiting…"
            style={{ minHeight: 100 }}
          />
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Referrals" defaultOpen={false}>
        <div className="fld">
          <label>Referrals made / requested</label>
          <textarea
            placeholder="Gastroenterology — urgent ERCP&#10;Dietitian&#10;Physiotherapy&#10;Diabetes team…"
            style={{ minHeight: 80 }}
          />
        </div>
      </CollapsibleCard>
    </div>
  );
}
