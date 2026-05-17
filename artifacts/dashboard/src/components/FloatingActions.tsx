import { useAppContext } from '@/context/AppContext';

export default function FloatingActions() {
  const { clearPatient, patientName } = useAppContext();

  function handlePrint() {
    window.print();
  }

  function handleNew() {
    if (patientName && !window.confirm(`Clear all data for "${patientName}" and start a new patient?`)) return;
    clearPatient();
  }

  return (
    <div className="floating-actions" role="toolbar" aria-label="Patient actions">
      <button className="fa-btn fa-btn--secondary" onClick={handleNew} title="Clear form and start a new patient">
        <span className="fa-icon">＋</span>
        <span className="fa-label">New patient</span>
      </button>
      <button className="fa-btn fa-btn--primary" onClick={handlePrint} title="Print / save to PDF">
        <span className="fa-icon">🖨</span>
        <span className="fa-label">Print / PDF</span>
      </button>
    </div>
  );
}
