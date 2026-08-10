import { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getProtocol, getProtocolByIcd } from '@workspace/pane-engine';
import { detectDxVariants } from '@/lib/dx-variants';
import CollapsibleCard from '@/components/CollapsibleCard';
import { errMsg } from '@/lib/err';
import CptPicker from '@/components/CptPicker';
import { getApiOrigin } from '@/lib/api-origin';
import NarrativeInput from '@/components/NarrativeInput';
import { getMatrix } from '@/lib/cc-matrices';

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

const QUICK_TEMPLATES: Record<string, string> = {
  emergency: `1. Resuscitate — IV access x2, O2 supplementation\n2. Bloods: FBC, U&E, LFTs, coagulation, cultures\n3. Imaging: USS / CT\n4. NPO\n5. IV antibiotics (specify)\n6. Surgical / specialty consult\n7. Admit under surgical team`,
  cholangitis: `1. IV access, fluid resuscitation\n2. FBC, LFTs, bilirubin, amylase, blood cultures\n3. IV antibiotics: pip-tazo 4.5g TDS\n4. NPO\n5. USS abdomen (CBD diameter, stones)\n6. ERCP planning — contact endoscopy\n7. Admit under surgical team`,
  breast: `1. Triple assessment: clinical + mammogram + USS\n2. Core biopsy if suspicious\n3. Breast clinic follow-up\n4. MDT discussion if malignancy confirmed\n5. Patient information and support`,
  diabetic_foot: `1. Wound swab for MCS\n2. X-ray foot (osteomyelitis)\n3. FBC, CRP, HbA1c, glucose, renal function\n4. IV antibiotics if systemically unwell\n5. Vascular assessment (ABI, Doppler)\n6. Surgical debridement if Wagner 3+\n7. Podiatry and diabetic foot team referral\n8. Tight glycaemic control`,
};

const PHASE_LABELS: Record<string, string> = {
  immediate:    'IMMEDIATE',
  conservative: 'CONSERVATIVE MANAGEMENT',
  surgical:     'SURGICAL MANAGEMENT',
  followup:     'FOLLOW-UP',
};

// ── Review / follow-up scheduling ───────────────────────────────────────────

const REVIEW_OPTIONS: { value: string; label: string; days: number | null }[] = [
  { value: '1w',     label: '1 week',     days: 7 },
  { value: '2w',     label: '2 weeks',    days: 14 },
  { value: '4w',     label: '4 weeks',    days: 28 },
  { value: '6w',     label: '6 weeks',    days: 42 },
  { value: '3m',     label: '3 months',   days: 90 },
  { value: 'custom', label: 'Custom date', days: null },
];

// Today's date in America/St_Lucia (UTC-4, no DST), as YYYY-MM-DD
function stLuciaTodayISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/St_Lucia' });
}

function addDaysISO(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().split('T')[0];
}

function buildPlanText(
  protocol: NonNullable<ReturnType<typeof getProtocol>>,
  isInpatient: boolean,
  surgeon: string,
  allowedPhases?: string[],
  planPrefix?: string,
): string {
  const lines: string[] = [];

  if (planPrefix) {
    lines.push(planPrefix, '');
  }

  if (isInpatient) {
    lines.push(
      '## Admission orders',
      `- Admit under ${surgeon} — General / Endoscopic Surgery`,
      '- Monitoring: VS q4h, I&O charting, daily weights',
      '- DVT prophylaxis: LMWH (if not contraindicated)',
      '- VTE risk assessment documented',
      '',
    );
  }

  // Group management steps by phase, filtered by allowedPhases when set
  const byPhase = new Map<string, string[]>();
  for (const step of protocol.management) {
    if (allowedPhases && !allowedPhases.includes(step.phase)) continue;
    if (!byPhase.has(step.phase)) byPhase.set(step.phase, []);
    byPhase.get(step.phase)!.push(step.step);
  }

  for (const [phase, steps] of byPhase) {
    lines.push(`## ${protocol.label} — ${PHASE_LABELS[phase] ?? phase.toUpperCase()}`);
    steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    lines.push('');
  }

  if (protocol.investigations.length > 0) {
    lines.push('## Investigations');
    for (const inv of protocol.investigations) {
      lines.push(`- ${inv.label} (${inv.urgency})`);
    }
    lines.push('');
  }

  if (protocol.referral) {
    lines.push('## Referral');
    lines.push(protocol.referral);
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

function buildNursingOrders(isPreOp: boolean, isPostOp: boolean): string {
  const lines: string[] = ['## Nursing Directives'];

  if (isPreOp) {
    lines.push(
      '- NPO from midnight',
      '- Obtain and file signed consent form',
      '- IV access (minimum 18G), pre-op bloods drawn',
      '- Surgical site marking by operating surgeon',
      '- Pre-op checklist completed',
    );
  } else if (isPostOp) {
    lines.push(
      '- VS q1h × 4 then q4h',
      '- Wound check and drain output every shift',
      '- PCA / analgesia — pain score q2h',
      '- Encourage deep breathing, early mobilisation',
      '- Strict I&O, urinary output ≥ 0.5 mL/kg/hr',
    );
  } else {
    lines.push(
      '- VS q4h, I&O charting',
      '- Wound inspection daily',
      '- Analgesia per surgical team order',
      '- DVT prophylaxis — TED stockings + LMWH',
      '- Patient education on diagnosis and expected course',
    );
  }

  return lines.join('\n');
}

export default function PlanTab() {
  const {
    plan, setPlan,
    followUpNotes, setFollowUpNotes,
    referralNotes, setReferralNotes,
    triageResult,
    weightKg, heightCm,
    paneTop, paneConverged,
    icdCodes,
    encounterMode,
    symptoms,
    patientId, patientName, phone, currentSite,
    activeCcKey,
    admittingSurgeon,
    assessment,
  } = useAppContext();

  const ccMatrix = activeCcKey ? getMatrix(activeCcKey) : null;
  const ccContext = ccMatrix ? {
    ccKey: ccMatrix.id,
    ccLabel: ccMatrix.name,
    icd10Hint: ccMatrix.icd10Hint,
    ddx: ccMatrix.ddx,
    pearl: ccMatrix.pearl,
  } : null;

  const acuity = triageResult.acuity;
  const bmiData = calcBmiClass(weightKg, heightCm);

  // Sub-diagnosis variant detection state (hook must be declared before any early return)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  // Review / follow-up scheduling
  const [reviewIn, setReviewIn] = useState('');
  const [reviewCustomDate, setReviewCustomDate] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [scheduleErr, setScheduleErr] = useState<string | null>(null);
  const [scheduleOk, setScheduleOk] = useState<string | null>(null);

  // "Book to calendar" state
  const [bookingCal, setBookingCal] = useState(false);
  const [bookCalErr, setBookCalErr] = useState<string | null>(null);
  const [bookCalOk, setBookCalOk] = useState<{ eventId: string; eventLink: string | null } | null>(null);

  // Derived follow-up target date (shared by both booking actions)
  const reviewOpt = REVIEW_OPTIONS.find(o => o.value === reviewIn);
  const followUpTargetDate = reviewIn
    ? (reviewOpt?.days != null ? addDaysISO(stLuciaTodayISO(), reviewOpt.days) : reviewCustomDate)
    : '';

  async function handleScheduleReview() {
    if (!followUpTargetDate) return;

    setScheduling(true);
    setScheduleErr(null);
    setScheduleOk(null);
    try {
      const apiOrigin = getApiOrigin();
      const url = apiOrigin ? `${apiOrigin}/api/booking/request` : '/api/booking/request';
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_name:     patientName.trim() || 'Unnamed patient',
          patient_email:    `manual.${Date.now()}@noreply.amise.internal`,
          patient_phone:    phone.trim() || null,
          appointment_type: 'follow_up',
          location:         currentSite,
          preferred_slot:   followUpTargetDate,
          reason:           followUpNotes.trim() || 'Doctor-requested review following consultation',
          source:           'manual',
        }),
      });
      if (!r.ok) {
        const d = await r.json() as { error?: string };
        throw new Error(d.error ?? `HTTP ${r.status}`);
      }
      setScheduleOk(followUpTargetDate);
    } catch (e) {
      setScheduleErr(errMsg(e));
    } finally {
      setScheduling(false);
    }
  }

  async function handleBookToCalendar() {
    if (!followUpTargetDate || !patientId) return;
    setBookingCal(true);
    setBookCalErr(null);
    setBookCalOk(null);
    try {
      const apiOrigin = getApiOrigin();
      const url = apiOrigin
        ? `${apiOrigin}/api/scheduling/book-followup`
        : '/api/scheduling/book-followup';
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          patientName: patientName.trim() || 'Unknown patient',
          followUpDate: followUpTargetDate,
          followUpNotes: followUpNotes.trim() || undefined,
          visitType: 'follow_up',
        }),
      });
      if (!r.ok) {
        const d = await r.json() as { error?: string };
        throw new Error(d.error ?? `HTTP ${r.status}`);
      }
      const d = await r.json() as { eventId: string; eventLink: string | null; calendarId: string };
      setBookCalOk({ eventId: d.eventId, eventLink: d.eventLink });
    } catch (e) {
      setBookCalErr(errMsg(e));
    } finally {
      setBookingCal(false);
    }
  }

  const activeDiseaseId = (paneConverged && paneTop[0]?.probability >= 0.85)
    ? paneTop[0].disease.id
    : null;
  const activeIcdCode = icdCodes[0]?.split(' — ')[0]?.trim() ?? null;

  const protocol = activeDiseaseId
    ? getProtocol(activeDiseaseId)
    : activeIcdCode
      ? getProtocolByIcd(activeIcdCode)
      : null;

  // Detect sub-diagnosis variants from assessment text
  const variantMatch = useMemo(
    () => detectDxVariants(assessment, activeIcdCode ?? undefined, activeDiseaseId ?? undefined),
    [assessment, activeIcdCode, activeDiseaseId],
  );
  // Auto-select detected variant; reset when diagnosis group changes
  useEffect(() => {
    if (variantMatch?.detectedVariant) {
      setSelectedVariantId(variantMatch.detectedVariant.id);
    } else {
      setSelectedVariantId(null);
    }
  }, [variantMatch]);

  const selectedVariant = variantMatch?.group.variants.find(v => v.id === selectedVariantId) ?? null;

  const isInpatient = encounterMode === 'inpatient';
  const isPreOp  = symptoms.some(s => s === 'Pre-operative visit');
  const isPostOp = symptoms.some(s => s === 'Post-operative review');

  function handleGeneratePlan() {
    if (!protocol) return;
    setPlan(buildPlanText(
      protocol,
      isInpatient,
      admittingSurgeon,
      selectedVariant?.allowedPhases,
      selectedVariant?.planPrefix,
    ));
  }

  function handleGenerateNursing() {
    const nursing = buildNursingOrders(isPreOp, isPostOp);
    setPlan(plan ? `${plan}\n\n${nursing}` : nursing);
  }

  const quickTemplates = [
    { label: 'Emergency', key: 'emergency' as const },
    { label: 'Cholangitis', key: 'cholangitis' as const },
    { label: 'Breast', key: 'breast' as const },
    { label: 'Diabetic foot', key: 'diabetic_foot' as const },
  ];

  return (
    <div className="gap-y">
      <CollapsibleCard title="Management plan">
        {/* Narrative dictation → plan fields */}
        <div style={{ marginBottom: 14 }}>
          <NarrativeInput
            section="plan"
            placeholder="Dictate or paste the management plan — AI will extract structured steps, investigations, prescriptions, and follow-up…"
            label="Dictate management plan"
            ccContext={ccContext}
            onParsed={data => {
              const p = data.plan as string | undefined;
              if (p?.trim()) setPlan(p.trim());
            }}
          />
        </div>

        {/* Dynamic plan generation from active diagnosis */}
        {protocol && (
          <div style={{
            marginBottom: 12,
            padding: '10px 14px',
            background: '#0c2233',
            border: '1px solid #0d9488',
            borderRadius: 8,
          }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#5eead4', fontWeight: 600 }}>
                Protocol matched: {protocol.label}
              </span>
              <button
                type="button"
                className="chip"
                onClick={handleGeneratePlan}
                style={{ background: '#0d9488', color: '#fff', borderColor: '#0d9488' }}
              >
                Generate plan{selectedVariant ? ` — ${selectedVariant.label}` : ` from ${protocol.label}`}
              </button>
              {isInpatient && (
                <button
                  type="button"
                  className="chip"
                  onClick={handleGenerateNursing}
                  title="Append nursing directives to plan"
                >
                  + Nursing directives
                </button>
              )}
            </div>

            {/* Sub-diagnosis variant selector */}
            {variantMatch && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                  {variantMatch.group.differentiatorQuery}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {variantMatch.group.variants.map(v => {
                    const isSelected = v.id === selectedVariantId;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        className="chip"
                        onClick={() => setSelectedVariantId(v.id)}
                        title={v.description}
                        style={isSelected ? {
                          background: '#0f766e',
                          color: '#fff',
                          borderColor: '#0d9488',
                          fontWeight: 700,
                        } : {
                          background: '#1e3a4a',
                          color: '#7dd3d0',
                          borderColor: '#2d6a70',
                        }}
                      >
                        {v.label}
                      </button>
                    );
                  })}
                </div>

                {/* Urgency note for selected variant */}
                {selectedVariant?.urgencyNote && (
                  <div style={{
                    marginTop: 8,
                    padding: '6px 10px',
                    background: '#7c1d1d22',
                    border: '1px solid #ef444444',
                    borderRadius: 6,
                    fontSize: 11.5,
                    color: '#fca5a5',
                    lineHeight: 1.5,
                  }}>
                    ⚠ {selectedVariant.urgencyNote}
                  </div>
                )}

                {/* Examination queries when variant not confirmed */}
                {selectedVariant?.examQueries && selectedVariant.examQueries.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 10, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                      Examination / imaging — confirm sub-diagnosis
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {selectedVariant.examQueries.map((q, i) => (
                        <div key={i} style={{ fontSize: 11.5, color: '#fde68a', paddingLeft: 10, lineHeight: 1.5 }}>
                          • {q}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Red flags */}
            {protocol.redFlags.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {protocol.redFlags.slice(0, 3).map((rf, i) => (
                  <span key={i} style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 12,
                    background: '#7f1d1d22', border: '1px solid #ef444455', color: '#fca5a5',
                  }}>
                    ⚑ {rf.length > 60 ? rf.slice(0, 57) + '…' : rf}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {!protocol && acuity === 'urgent' && (
          <div style={{ marginBottom: 10, padding: '8px 12px', background: '#7f1d1d22', border: '1px solid #ef444455', borderRadius: 6, fontSize: 12, color: '#fca5a5' }}>
            Urgent acuity — no matched protocol. Use emergency template below or enter plan manually.
          </div>
        )}

        <div className="fld">
          <label>Plan</label>
          <textarea
            value={plan}
            onChange={e => setPlan(e.target.value)}
            placeholder="Management steps in order…"
            style={{ minHeight: 200 }}
          />
        </div>

        {/* Quick templates fallback */}
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quick templates</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {quickTemplates.map(t => (
              <button
                key={t.key}
                type="button"
                className="chip"
                onClick={() => setPlan(QUICK_TEMPLATES[t.key])}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </CollapsibleCard>

      {/* Nursing directives — inpatient */}
      {isInpatient && (
        <CollapsibleCard title="Nursing Directives" defaultOpen={false}>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>
            Standard inpatient nursing orders. Click to append to plan, or customise below.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { label: 'Pre-operative orders', onClick: () => { const t = buildNursingOrders(true, false); setPlan(plan ? `${plan}\n\n${t}` : t); } },
              { label: 'Post-operative orders', onClick: () => { const t = buildNursingOrders(false, true); setPlan(plan ? `${plan}\n\n${t}` : t); } },
              { label: 'General surgical ward orders', onClick: () => { const t = buildNursingOrders(false, false); setPlan(plan ? `${plan}\n\n${t}` : t); } },
            ].map(item => (
              <button
                key={item.label}
                type="button"
                className="chip"
                onClick={item.onClick}
              >
                + Append {item.label}
              </button>
            ))}
          </div>
          <div className="fld" style={{ marginTop: 10 }}>
            <label>Custom nursing notes</label>
            <textarea
              placeholder="Additional nursing instructions…"
              style={{ minHeight: 80 }}
            />
          </div>
        </CollapsibleCard>
      )}

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
            value={followUpNotes}
            onChange={e => setFollowUpNotes(e.target.value)}
            placeholder="Review in OPD in 2 weeks…&#10;Return immediately if: fever, increasing pain, vomiting…"
            style={{ minHeight: 100 }}
          />
        </div>

        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #e5e7eb' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
            To be reviewed
          </label>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 10px' }}>
            Choosing a review timeframe creates a pending request in the Booking Inbox for staff to confirm a slot — it does not book the appointment automatically.
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {REVIEW_OPTIONS.map(o => (
              <button
                key={o.value}
                type="button"
                className="chip"
                onClick={() => {
                  setReviewIn(o.value);
                  setScheduleOk(null); setScheduleErr(null);
                  setBookCalOk(null); setBookCalErr(null);
                }}
                style={reviewIn === o.value ? { background: '#0d9488', color: '#fff', borderColor: '#0d9488' } : undefined}
              >
                {o.label}
              </button>
            ))}
          </div>

          {reviewIn === 'custom' && (
            <div className="fld" style={{ marginBottom: 10, maxWidth: 220 }}>
              <label>Review date</label>
              <input
                type="date"
                value={reviewCustomDate}
                onChange={e => {
                  setReviewCustomDate(e.target.value);
                  setScheduleOk(null); setScheduleErr(null);
                  setBookCalOk(null); setBookCalErr(null);
                }}
                min={stLuciaTodayISO()}
              />
            </div>
          )}

          {scheduleErr && (
            <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 6, background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', fontSize: 12 }}>
              {scheduleErr}
            </div>
          )}
          {scheduleOk && (
            <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 6, background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d', fontSize: 12, fontWeight: 600 }}>
              ✓ Review request added to Booking Inbox — staff will confirm a slot around {scheduleOk}.
            </div>
          )}

          {bookCalErr && (
            <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 6, background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', fontSize: 12 }}>
              Calendar booking failed: {bookCalErr}
            </div>
          )}
          {bookCalOk && (
            <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 6, background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d', fontSize: 12, fontWeight: 600 }}>
              Booked ✓ — added to Google Calendar.
              {bookCalOk.eventLink && (
                <>
                  {' '}
                  <a
                    href={bookCalOk.eventLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#15803d', textDecoration: 'underline' }}
                  >
                    View event
                  </a>
                </>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="chip"
              disabled={!reviewIn || (reviewIn === 'custom' && !reviewCustomDate) || scheduling || !!scheduleOk}
              onClick={() => void handleScheduleReview()}
              style={{
                background: scheduleOk ? '#9ca3af' : '#0d9488',
                color: '#fff', borderColor: scheduleOk ? '#9ca3af' : '#0d9488',
                opacity: (!reviewIn || (reviewIn === 'custom' && !reviewCustomDate) || scheduling) && !scheduleOk ? 0.6 : 1,
              }}
            >
              {scheduling ? 'Adding to Booking Inbox…' : scheduleOk ? '✓ Added to Booking Inbox' : 'Schedule review → Booking Inbox'}
            </button>

            <button
              type="button"
              className="chip"
              disabled={!followUpTargetDate || !patientId || bookingCal || !!bookCalOk}
              title={!patientId ? 'Select a patient first' : !followUpTargetDate ? 'Choose a follow-up date first' : 'Book this follow-up directly to Google Calendar'}
              onClick={() => void handleBookToCalendar()}
              style={{
                background: bookCalOk ? '#9ca3af' : '#2563eb',
                color: '#fff', borderColor: bookCalOk ? '#9ca3af' : '#2563eb',
                opacity: (!followUpTargetDate || !patientId || bookingCal) && !bookCalOk ? 0.6 : 1,
              }}
            >
              {bookingCal ? 'Booking…' : bookCalOk ? 'Booked ✓' : 'Book to calendar'}
            </button>
          </div>
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
            value={referralNotes}
            onChange={e => setReferralNotes(e.target.value)}
            placeholder="Gastroenterology — urgent ERCP&#10;Dietitian&#10;Physiotherapy&#10;Diabetes team…"
            style={{ minHeight: 80 }}
          />
        </div>
      </CollapsibleCard>
    </div>
  );
}
