import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';

/** Inline name/DOB/age/sex quickstart form shown when a consultation has no
 * patient loaded yet — lets front-desk/doctor start an encounter without
 * leaving the page to search or register a full patient record first. */
export default function NoPatientQuickstart() {
  const { topSection, patientId, patientName, setPatientName, setAge, setDob, setSex } = useAppContext();
  const [qsName, setQsName] = useState('');
  const [qsAge, setQsAge]   = useState('');
  const [qsSex, setQsSex]   = useState('');
  const [qsDob, setQsDob]   = useState('');

  if (topSection !== 'consultation' || patientId || patientName) return null;

  return (
    <div style={{ background: '#fef9c3', border: '1.5px solid #fbbf24', borderRadius: 10, padding: '14px 18px', color: '#92400e' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>👤</span>
        <span style={{ fontSize: 13, fontWeight: 700 }}>No patient loaded — enter details to begin</span>
      </div>
      <form
        onSubmit={e => {
          e.preventDefault();
          if (!qsName.trim()) return;
          setPatientName(qsName.trim());
          const resolvedAge = qsAge || (qsDob
            ? String(Math.floor((Date.now() - new Date(qsDob).getTime()) / (365.25 * 24 * 3600 * 1000)))
            : '');
          if (resolvedAge) setAge(resolvedAge);
          if (qsDob) setDob(qsDob);
          if (qsSex && qsSex !== 'unknown') setSex(qsSex as 'male' | 'female' | 'other' | 'unknown');
          setQsName(''); setQsAge(''); setQsSex(''); setQsDob('');
        }}
        style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '2 1 160px' }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Patient name *</label>
          <input
            autoFocus
            value={qsName}
            onChange={e => setQsName(e.target.value)}
            placeholder="e.g. Marie Joseph"
            style={{ padding: '7px 10px', borderRadius: 7, border: '1.5px solid #f59e0b', fontSize: 13, background: '#fff', color: '#0f172a', outline: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Date of birth</label>
          <input
            type="date"
            value={qsDob}
            onChange={e => {
              setQsDob(e.target.value);
              if (e.target.value) {
                const yrs = Math.floor((Date.now() - new Date(e.target.value).getTime()) / (365.25 * 24 * 3600 * 1000));
                if (yrs >= 0) setQsAge(String(yrs));
              }
            }}
            style={{ padding: '7px 10px', borderRadius: 7, border: '1.5px solid #f59e0b', fontSize: 13, background: '#fff', color: '#0f172a', outline: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Age (yrs)</label>
          <input
            type="number"
            inputMode="numeric"
            min={0} max={130}
            value={qsAge}
            onChange={e => { setQsAge(e.target.value.replace(/[^0-9]/g, '')); setQsDob(''); }}
            placeholder="e.g. 45"
            style={{ padding: '7px 10px', borderRadius: 7, border: '1.5px solid #f59e0b', fontSize: 13, background: '#fff', color: '#0f172a', width: 72, outline: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sex</label>
          <select
            value={qsSex}
            onChange={e => setQsSex(e.target.value)}
            style={{ padding: '7px 8px', borderRadius: 7, border: '1.5px solid #f59e0b', fontSize: 13, background: '#fff', color: '#0f172a', outline: 'none' }}
          >
            <option value="">—</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={!qsName.trim()}
          style={{
            padding: '7px 18px', borderRadius: 7, border: 'none',
            background: qsName.trim() ? '#d97706' : '#94a3b8',
            color: '#fff', fontSize: 13, fontWeight: 700,
            cursor: qsName.trim() ? 'pointer' : 'not-allowed',
            flexShrink: 0,
          }}
        >
          → Start
        </button>
      </form>
    </div>
  );
}
