import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import CptPicker from '@/components/CptPicker';

const BMI_NOTES: Record<string, string> = {
  'Obese class I':  'BMI 30–34.9 (Obese I): Increased DVT risk — prescribe LMWH (e.g. enoxaparin 40mg SC od) + TED stockings. Laparoscopic access may be technically difficult. Monitor wound site closely post-op.',
  'Obese class II': 'BMI 35–39.9 (Obese II): High anaesthetic risk — senior anaesthetist review. Difficult airway management. Bariatric positioning required. Post-op HDU consideration.',
  'Obese class III':'BMI ≥ 40 (Obese III): Extreme surgical risk. Mandatory pre-op anaesthetic review, echocardiogram, and pulmonary function test. Bariatric hospital bed and equipment. ICU/HDU post-op plan.',
  'Overweight':     'BMI 25–29.9 (Overweight): Prescribe VTE prophylaxis if surgical duration > 60 min. Monitor wound site.',
  'Underweight':    'BMI < 18.5 (Underweight): Pre-op nutritional support (dietitian review). Increased risk of poor wound healing and anastomotic complications. Consider pre-op optimisation.',
};

function calcBmiClass(weightKg: string, heightCm: string): { bmi: number; class: string; color: string } | null {
  const w = parseFloat(weightKg);
  const h = parseFloat(heightCm);
  if (!w || !h || h < 50) return null;
  const bmi = w / Math.pow(h / 100, 2);
  if (bmi < 18.5) return { bmi, class: 'Underweight',    color: '#3b82f6' };
  if (bmi < 25)   return { bmi, class: 'Normal',         color: '#16a34a' };
  if (bmi < 30)   return { bmi, class: 'Overweight',     color: '#ca8a04' };
  if (bmi < 35)   return { bmi, class: 'Obese class I',  color: '#ea580c' };
  if (bmi < 40)   return { bmi, class: 'Obese class II', color: '#dc2626' };
  return           { bmi, class: 'Obese class III',      color: '#7f1d1d' };
}

const PLAN_TEMPLATES: Record<string, string> = {
  emergency: `1. Resuscitate — IV access x2, O2 supplementation\n2. Bloods: FBC, U&E, LFTs, coagulation, cultures\n3. Imaging: USS / CT\n4. NPO\n5. IV antibiotics (specify)\n6. Surgical / specialty consult\n7. Admit under surgical team`,
  cholangitis: `1. IV access, fluid resuscitation\n2. FBC, LFTs, bilirubin, amylase, blood cultures\n3. IV antibiotics: pip-tazo 4.5g TDS\n4. NPO\n5. USS abdomen (CBD diameter, stones)\n6. ERCP planning — contact endoscopy\n7. Admit under surgical team`,
  breast: `1. Triple assessment: clinical + mammogram + USS\n2. Core biopsy if suspicious\n3. Breast clinic follow-up\n4. MDT discussion if malignancy confirmed\n5. Patient information and support`,
  diabetic_foot: `1. Wound swab for MCS\n2. X-ray foot (osteomyelitis)\n3. FBC, CRP, HbA1c, glucose, renal function\n4. IV antibiotics if systemically unwell\n5. Vascular assessment (ABI, Doppler)\n6. Surgical debridement if Wagner 3+\n7. Podiatry and diabetic foot team referral\n8. Tight glycaemic control`,
};

export default function PlanTab() {
  const { plan, setPlan, triageResult, weightKg, heightCm } = useAppContext();
  const acuity = triageResult.acuity;
  const apptType = triageResult.appointmentType;
  const bmiData = calcBmiClass(weightKg, heightCm);

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

      {bmiData && bmiData.class !== 'Normal' && (
        <CollapsibleCard title="Obesity / BMI considerations" defaultOpen={false} badge={`BMI ${bmiData.bmi.toFixed(1)} — ${bmiData.class}`} badgeVariant="warn">
          <div style={{ padding: '8px 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: bmiData.color }}>BMI {bmiData.bmi.toFixed(1)}</span>
              <span style={{ fontWeight: 600, color: bmiData.color, fontSize: 13 }}>{bmiData.class}</span>
            </div>
            <div style={{ background: `${bmiData.color}10`, border: `1px solid ${bmiData.color}30`, borderRadius: 8, padding: '10px 14px' }}>
              <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.6 }}>
                {BMI_NOTES[bmiData.class]}
              </p>
            </div>
          </div>
        </CollapsibleCard>
      )}

      <CollapsibleCard title="Follow-up / discharge instructions" defaultOpen={false}>
        <div className="fld">
          <label>Follow-up plan and patient instructions</label>
          <textarea
            placeholder="Review in OPD in 2 weeks…&#10;Return immediately if: fever, increasing pain, vomiting…"
            style={{ minHeight: 100 }}
          />
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="CPT codes — Insurance & billing">
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 10px' }}>
          Select procedures performed or planned. CPT codes are required for insurance pre-authorisation, claims, and reimbursement.
        </p>
        <CptPicker />
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
