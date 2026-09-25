/**
 * Social History → structured lifestyle history: religious or ritual fasting, complementary
 * therapies, night-shift work and usual sleep. Record only: no advice is generated here, and
 * the safety prompts shown below the fields are dismissible and change nothing.
 *
 * Stored in patients.pathway_data_json → lifestyle (lib/lifestyle-history-db.ts), shared with
 * the iOS app. Rules: @workspace/triage-engine/lifestyle-practices.
 */
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import { LifestyleSafetyPrompts } from '@/components/LifestylePracticesPanel';
import {
  COMPLEMENTARY_THERAPIES, FASTING_LABELS, FASTING_PRACTICES, FASTING_STATUSES, FASTING_STATUS_LABELS,
  THERAPY_LABELS, isLifestyleRecorded, normaliseSleepHours, recordsFasting, toggleFasting, toggleTherapy,
} from '@workspace/triage-engine/lifestyle-practices';

export default function LifestyleHistoryCard() {
  const { lifestyleHistory: h, setLifestyleHistory, lifestyleStorageAvailable, patientId } = useAppContext();

  return (
    <CollapsibleCard title="Fasting, complementary therapies and sleep" badge={isLifestyleRecorded(h) ? '✓' : undefined}>
      <div className="fld">
        <label>Religious or ritual fasting</label>
        <div className="chips">
          {FASTING_PRACTICES.map(f => (
            <button key={f} type="button" className={`chip ${h.fasting.includes(f) ? 'on' : ''}`}
              onClick={() => setLifestyleHistory(toggleFasting(h, f))}>
              {FASTING_LABELS[f]}
            </button>
          ))}
        </div>
        {h.fasting.includes('other') && (
          <input type="text" value={h.fastingOther} placeholder="Which fast?"
            onChange={e => setLifestyleHistory({ ...h, fastingOther: e.target.value })} style={{ marginTop: 6 }} />
        )}
        {recordsFasting(h) && (
          <div style={{ marginTop: 6 }}>
            <div className="chips">
              {FASTING_STATUSES.map(st => (
                <button key={st} type="button" className={`chip ${h.fastingStatus === st ? 'on' : ''}`}
                  onClick={() => setLifestyleHistory({ ...h, fastingStatus: h.fastingStatus === st ? null : st })}>
                  {FASTING_STATUS_LABELS[st]}
                </button>
              ))}
            </div>
            <input type="text" value={h.fastingWhen} placeholder="When is the next fast planned? (e.g. Ramadan, February)"
              onChange={e => setLifestyleHistory({ ...h, fastingWhen: e.target.value })} style={{ marginTop: 6 }} />
          </div>
        )}
      </div>

      <div className="fld" style={{ marginTop: 10 }}>
        <label>Complementary therapies used</label>
        <div className="chips">
          {COMPLEMENTARY_THERAPIES.map(t => (
            <button key={t} type="button" className={`chip ${h.therapies.includes(t) ? 'on' : ''}`}
              onClick={() => setLifestyleHistory(toggleTherapy(h, t))}>
              {THERAPY_LABELS[t]}
            </button>
          ))}
        </div>
        {h.therapies.includes('other') && (
          <input type="text" value={h.therapiesOther} placeholder="Which therapy?"
            onChange={e => setLifestyleHistory({ ...h, therapiesOther: e.target.value })} style={{ marginTop: 6 }} />
        )}
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
        <div className="fld">
          <label>Night-shift work</label>
          <div className="chips">
            {([['Yes', true], ['No', false]] as const).map(([label, v]) => (
              <button key={label} type="button" className={`chip ${h.nightShift === v ? 'on' : ''}`}
                onClick={() => setLifestyleHistory({ ...h, nightShift: h.nightShift === v ? null : v })}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="fld">
          <label>Usual sleep (hours a night)</label>
          <input type="number" min={0} max={24} step={0.5} style={{ width: 90 }}
            value={h.sleepHours ?? ''}
            onChange={e => setLifestyleHistory({ ...h, sleepHours: normaliseSleepHours(e.target.value) })} />
        </div>
      </div>

      {patientId && lifestyleStorageAvailable === false && (
        <p style={{ marginTop: 8, fontSize: 11, color: '#92400e' }}>
          Saved in this browser only: the server is not yet updated for this record (patients.pathway_data_json).
        </p>
      )}
      <div style={{ marginTop: 10 }}>
        <LifestyleSafetyPrompts />
      </div>
    </CollapsibleCard>
  );
}
