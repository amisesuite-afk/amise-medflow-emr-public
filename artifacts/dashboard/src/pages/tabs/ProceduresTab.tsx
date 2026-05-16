import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';

const PROCEDURE_CHIPS = [
  'ERCP', 'Upper GI endoscopy (OGD)', 'Colonoscopy', 'Flexible sigmoidoscopy',
  'USS-guided biopsy', 'CT-guided biopsy', 'Core needle biopsy (breast)',
  'FNA / fine needle aspiration', 'Drain insertion', 'Wound debridement',
  'VAC dressing', 'Abscess I&D', 'Hernia repair (laparoscopic)',
  'Hernia repair (open)', 'Laparoscopic cholecystectomy', 'Appendicectomy',
  'Sentinel node biopsy', 'Skin lesion excision', 'Minor surgical procedure',
];

export default function ProceduresTab() {
  const { procedures, setProcedures } = useAppContext();

  return (
    <div className="gap-y">
      <CollapsibleCard title="Planned / completed procedures">
        <div className="chips" style={{ marginBottom: 10 }}>
          {PROCEDURE_CHIPS.map(p => (
            <button
              key={p}
              type="button"
              className="chip"
              onClick={() => setProcedures(procedures ? `${procedures}\n${p}` : p)}
            >
              + {p}
            </button>
          ))}
        </div>
        <div className="fld">
          <label>Procedure notes</label>
          <textarea
            value={procedures}
            onChange={e => setProcedures(e.target.value)}
            placeholder="Procedure name, date, consent obtained, grade of operator, any complications…"
            style={{ minHeight: 140 }}
          />
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Consent documentation" defaultOpen={false}>
        <div className="fld">
          <label>Consent notes</label>
          <textarea
            placeholder="Patient informed of risks/benefits. Signed consent form completed. Interpreter used: No…"
            style={{ minHeight: 80 }}
          />
        </div>
      </CollapsibleCard>
    </div>
  );
}
