'use client';
import { useState } from 'react';
import type { ConversationThread, AppointmentSlot, TriageSnapshot } from '@/types';

interface Props {
  thread: ConversationThread;
  secret: string;
  onAction: () => void;
}

const ACUITY_COLORS: Record<string, string> = {
  urgent:   '#ef4444',
  priority: '#f97316',
  review:   '#fbbf24',
  routine:  '#34d399',
};

function buildConfirmation(patientName: string | null, slot: AppointmentSlot): string {
  const LOCATION_LABELS: Record<string, string> = {
    rodney_bay: 'Rodney Bay (Providence Building)',
    castries:   'Castries',
    tapion:     'Tapion Hospital',
    remote:     'Telephone consultation',
  };
  const firstName = patientName ? patientName.split(' ')[0] : null;
  const greeting  = firstName ? `Good day ${firstName},` : 'Good day,';
  const locLabel  = LOCATION_LABELS[slot.location] ?? slot.location;
  return [
    greeting,
    '',
    'Your appointment with Dr Kabiye has been confirmed:',
    `Date & time: ${slot.display}`,
    `Location: ${locLabel}`,
    '',
    'Please arrive 10 minutes early with a valid photo ID. For urgent enquiries, please call Tapion Hospital on 459-2227 / 284-0557.',
    '',
    'Front Desk, Amise Medical Services',
  ].join('\n');
}

export default function DraftApproval({ thread, secret, onAction }: Props) {
  // Extract triage snapshot and appointment slots from system messages
  let triageSnap: TriageSnapshot | null = null;
  let appointmentSlots: AppointmentSlot[] | null = null;
  for (const msg of thread.messages) {
    if (msg.role === 'system' && msg.meta?.type === 'triage_result')      triageSnap      = msg.meta.payload;
    if (msg.role === 'system' && msg.meta?.type === 'appointment_slots')  appointmentSlots = msg.meta.payload;
  }

  const [draft, setDraft]               = useState(thread.draft_reply ?? '');
  const [selectedSlotIdx, setSlotIdx]   = useState(0);
  const [loading, setLoading]           = useState(false);
  const [msg, setMsg]                   = useState('');

  function pickSlot(i: number) {
    setSlotIdx(i);
    if (appointmentSlots) {
      setDraft(buildConfirmation(thread.patient_name, appointmentSlots[i]));
    }
  }

  async function call(endpoint: string, body: Record<string, unknown>) {
    setLoading(true);
    setMsg('');
    try {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': secret },
        body: JSON.stringify(body),
      });
      const data = await r.json() as { success?: boolean; error?: string; calendarEventId?: string };
      if (data.success) {
        const calNote = data.calendarEventId ? ' — calendar event created.' : '';
        setMsg(`Done${calNote}`);
        onAction();
      } else {
        setMsg(`Error: ${data.error ?? 'unknown'}`);
      }
    } catch {
      setMsg('Network error');
    } finally {
      setLoading(false);
    }
  }

  const acuityColor = triageSnap ? (ACUITY_COLORS[triageSnap.acuity] ?? '#6b7280') : '#6b7280';

  return (
    <div style={{ padding: '12px 14px', background: '#0c1a2e', border: '1px solid #0d9488', borderRadius: 8, marginTop: 12 }}>

      {/* Triage panel — staff only, never sent to patient */}
      {triageSnap && (
        <div style={{
          marginBottom: 10, padding: '8px 10px', borderRadius: 6,
          background: '#0f172a', border: `1px solid ${acuityColor}44`,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: acuityColor, textTransform: 'uppercase', marginBottom: 4 }}>
            PANE Triage — Staff Only
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: acuityColor, fontWeight: 700 }}>
              {triageSnap.acuity.toUpperCase()}
            </span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>Score: {triageSnap.score}</span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{triageSnap.recommendedAction.replace(/_/g, ' ')}</span>
          </div>
          {triageSnap.reasons.length > 0 && (
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>
              {triageSnap.reasons.slice(0, 3).join(' · ')}
            </div>
          )}
          {triageSnap.frontDeskScript && (
            <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic', borderTop: '1px solid #1e293b', paddingTop: 4, marginTop: 4 }}>
              {triageSnap.frontDeskScript}
            </div>
          )}
          {triageSnap.questionsToAsk.length > 0 && (
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
              Ask: {triageSnap.questionsToAsk.slice(0, 3).join(' / ')}
            </div>
          )}
        </div>
      )}

      {/* Appointment slot selector */}
      {appointmentSlots && appointmentSlots.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#5eead4', textTransform: 'uppercase', marginBottom: 6 }}>
            Select Appointment Slot
          </div>
          {appointmentSlots.map((slot, i) => (
            <label
              key={i}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6,
                cursor: 'pointer', padding: '6px 8px', borderRadius: 4,
                background: selectedSlotIdx === i ? '#0d948822' : 'transparent',
                border: `1px solid ${selectedSlotIdx === i ? '#0d948844' : '#374151'}`,
              }}
            >
              <input
                type="radio"
                name={`slot-${thread.id}`}
                value={i}
                checked={selectedSlotIdx === i}
                onChange={() => pickSlot(i)}
                style={{ marginTop: 2 }}
              />
              <span style={{ fontSize: 12, color: '#e2e8f0' }}>{slot.display}</span>
            </label>
          ))}
        </div>
      )}

      <div style={{ fontSize: 11, fontWeight: 700, color: '#5eead4', marginBottom: 6, textTransform: 'uppercase' }}>
        {appointmentSlots ? 'Appointment Confirmation — Pending Approval' : 'Draft Reply — Pending Approval'}
      </div>

      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        rows={5}
        style={{
          width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 6,
          background: '#1e293b', border: '1px solid #374151', color: '#e2e8f0', fontSize: 13,
          resize: 'vertical', fontFamily: 'inherit',
        }}
      />

      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <button
          disabled={loading}
          onClick={() => void call('/api/nurse/approve', {
            threadId: thread.id,
            nurseId: 'nurse',
            draft,
            selectedSlotIndex: appointmentSlots ? selectedSlotIdx : undefined,
          })}
          style={{
            padding: '6px 14px', borderRadius: 6, border: 'none',
            background: '#0d9488', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
          }}
        >
          {loading ? '…' : appointmentSlots ? '✓ Confirm Appointment & Send' : '✓ Approve & Send'}
        </button>

        <button
          disabled={loading}
          onClick={() => void call('/api/nurse/reject', { threadId: thread.id, nurseId: 'nurse', editedReply: draft })}
          style={{
            padding: '6px 14px', borderRadius: 6, border: '1px solid #374151',
            background: '#1e293b', color: '#e2e8f0', fontWeight: 600, fontSize: 12, cursor: 'pointer',
          }}
        >
          Save Edit
        </button>

        <button
          disabled={loading}
          onClick={() => void call('/api/nurse/reject', { threadId: thread.id, nurseId: 'nurse', editedReply: '' })}
          style={{
            padding: '6px 14px', borderRadius: 6, border: '1px solid #374151',
            background: 'transparent', color: '#9ca3af', fontSize: 12, cursor: 'pointer',
          }}
        >
          Discard Draft
        </button>

        {msg && (
          <span style={{
            alignSelf: 'center', fontSize: 12,
            color: msg.startsWith('Done') ? '#34d399' : '#f87171',
          }}>{msg}</span>
        )}
      </div>
    </div>
  );
}
