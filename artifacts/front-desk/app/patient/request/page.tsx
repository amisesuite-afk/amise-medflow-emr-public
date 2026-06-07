'use client';

// Public page — no account needed.
// Three-question personality routing guides the visitor to the right path,
// then captures minimal contact info and submits to the front desk.

import { useState } from 'react';

const TEAL   = '#0d9488';
const SLATE  = '#0f172a';
const MUTED  = '#64748b';
const BORDER = '#e2e8f0';
const API    = process.env.NEXT_PUBLIC_API_URL ?? 'https://amise-medflow-api.onrender.com';

// Direct-contact channels — for visitors who would rather skip the form.
const DIRECT_PHONE_TEL = 'tel:+17582840557';
const DIRECT_PHONE_LBL = '284-0557';
const DIRECT_WHATSAPP  = 'https://wa.me/17582840557';
const DIRECT_EMAIL     = 'mailto:info@amisemedical.com';

// ── Data ──────────────────────────────────────────────────────────────────────

type Path        = 'surgical' | 'symptoms' | 'explore';
type ContactPref = 'phone' | 'whatsapp' | 'email';
interface Opt    { id: string; emoji: string; label: string; sub: string }

const Q1: Opt[] = [
  { id: 'surgical', emoji: '🏥', label: 'I need to see a surgeon',    sub: 'Consultation, procedure, or follow-up'  },
  { id: 'symptoms', emoji: '🔍', label: 'I have symptoms to discuss',  sub: "Something has been bothering me"        },
  { id: 'explore',  emoji: '💭', label: 'Not sure where to start',     sub: 'Just exploring my options'             },
];

const Q2: Record<Path, Opt[]> = {
  surgical: [
    { id: 'new_consult', emoji: '🆕', label: 'First-time consultation',    sub: 'New patient, never seen Dr. Kabiye'     },
    { id: 'follow_up',  emoji: '🔄', label: 'Follow-up visit',             sub: 'Continuing care after a previous visit'  },
    { id: 'endoscopy',  emoji: '🩻', label: 'Endoscopy or colonoscopy',     sub: 'Scope procedure, ERCP, or work-up'      },
    { id: 'not_sure',   emoji: '❓', label: "Not sure what I need",         sub: 'Happy for the team to guide me'         },
  ],
  symptoms: [
    { id: 'abdominal',  emoji: '🫃', label: 'Stomach or abdominal pain',    sub: 'Upper or lower abdomen'                 },
    { id: 'digestive',  emoji: '🍽',  label: 'Swallowing or digestion',      sub: 'Heartburn, reflux, bloating'            },
    { id: 'bowel',      emoji: '🩸', label: 'Bowel or rectal concern',       sub: 'Bleeding or change in habits'           },
    { id: 'other_sx',   emoji: '🤔', label: 'Something else',                sub: "I will explain when we speak"          },
  ],
  explore: [
    { id: 'for_self',   emoji: '👤', label: 'This is for me',                sub: 'I want to understand my options'        },
    { id: 'for_family', emoji: '👪', label: 'For a family member',           sub: 'Helping someone I care for'             },
    { id: 'research',   emoji: '📚', label: 'Just researching',              sub: 'Learning what the practice offers'      },
  ],
};

const Q3: Opt[] = [
  { id: 'phone',    emoji: '📞', label: 'Phone call',   sub: 'We will call during office hours'      },
  { id: 'whatsapp', emoji: '💬', label: 'WhatsApp',      sub: 'Quick, easy, and informal'             },
  { id: 'email',    emoji: '✉️', label: 'Email',         sub: 'We will reply within 1 working day'    },
];

const STEP_LABEL: Record<number, string> = {
  0: 'About your visit',
  1: 'A little more detail',
  2: 'How to reach you',
  3: 'Your details',
};

// ── Main component ────────────────────────────────────────────────────────────

export default function RequestPage() {
  const [screen, setScreen]           = useState(0);
  const [visible, setVisible]         = useState(true);
  const [picking, setPicking]         = useState<string | null>(null);

  const [path, setPath]               = useState<Path | null>(null);
  const [q2Answer, setQ2Answer]       = useState('');
  const [contactPref, setContactPref] = useState<ContactPref | null>(null);

  const [name, setName]               = useState('');
  const [contact, setContact]         = useState('');
  const [note, setNote]               = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [errMsg, setErrMsg]           = useState('');

  function fade(fn: () => void) {
    setVisible(false);
    setTimeout(() => { fn(); setVisible(true); setPicking(null); }, 140);
  }

  function pickAndAdvance(id: string, next: () => void) {
    if (picking) return;
    setPicking(id);
    setTimeout(() => fade(next), 220);
  }

  function back() {
    fade(() => setScreen(s => Math.max(0, s - 1)));
  }

  async function submit() {
    if (!name.trim() || !contact.trim()) return;
    setSubmitting(true);
    setErrMsg('');
    try {
      const visitType = path === 'explore' ? 'unsure' : 'surgical';
      const parts = [
        path        && `Intent: ${path}`,
        q2Answer    && `Detail: ${q2Answer}`,
        contactPref && `Prefers: ${contactPref}`,
        note.trim(),
      ].filter(Boolean);

      const isEmail = contactPref === 'email';
      const r = await fetch(`${API}/api/patient/request-consult`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name:   name.trim(),
          phone:       isEmail ? null : contact.trim(),
          email:       isEmail ? contact.trim() : null,
          visit_type:  visitType,
          description: parts.join(' · '),
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? 'Request failed');
      }
      fade(() => setScreen(4));
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const showChrome = screen < 4;
  const dotActive  = screen === 0 ? 0 : screen <= 2 ? 1 : 2;
  const canSubmit  = name.trim().length > 0 && contact.trim().length > 0 && !submitting;

  return (
    <div style={{
      background: '#fff', borderRadius: 16, overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
      padding: '24px 20px 28px',
    }}>

      {/* Progress + step label */}
      {showChrome && (
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: TEAL, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {STEP_LABEL[screen] ?? ''}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  height: 7, borderRadius: 4,
                  width: i === dotActive ? 20 : 7,
                  background: i === dotActive ? TEAL : i < dotActive ? `${TEAL}55` : '#e2e8f0',
                  transition: 'all 0.3s',
                }} />
              ))}
            </div>
          </div>
          {screen > 0 && (
            <button onClick={back} style={{
              background: 'none', border: 'none', color: '#94a3b8',
              fontSize: 13, cursor: 'pointer', padding: 0,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              ← Back
            </button>
          )}
        </div>
      )}

      {/* Fading content area */}
      <div style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.14s ease', willChange: 'opacity' }}>

        {/* Q1 — Personality */}
        {screen === 0 && (
          <>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: SLATE, lineHeight: 1.2, margin: '0 0 6px' }}>
              How can we help you today?
            </h1>
            <p style={{ fontSize: 14, color: MUTED, margin: '0 0 22px' }}>
              Choose the one that fits — we will guide you from there.
            </p>
            <OptionCards options={Q1} picking={picking}
              onPick={id => pickAndAdvance(id, () => { setPath(id as Path); setScreen(1); })} />
          </>
        )}

        {/* Q2 — Context */}
        {screen === 1 && path && (
          <>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: SLATE, lineHeight: 1.3, margin: '0 0 6px' }}>
              {path === 'surgical' ? 'What type of visit is this?' :
               path === 'symptoms' ? "What's your main concern?" :
               'A little more about you…'}
            </h2>
            <p style={{ fontSize: 14, color: MUTED, margin: '0 0 22px' }}>
              This helps us prepare before we reach out.
            </p>
            <OptionCards options={Q2[path]} picking={picking}
              onPick={id => pickAndAdvance(id, () => { setQ2Answer(id); setScreen(2); })} />
          </>
        )}

        {/* Q3 — Contact preference */}
        {screen === 2 && (
          <>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: SLATE, lineHeight: 1.3, margin: '0 0 6px' }}>
              How do you prefer we reach you?
            </h2>
            <p style={{ fontSize: 14, color: MUTED, margin: '0 0 22px' }}>
              We follow up within one working day.
            </p>
            <OptionCards options={Q3} picking={picking}
              onPick={id => pickAndAdvance(id, () => { setContactPref(id as ContactPref); setScreen(3); })} />
          </>
        )}

        {/* Details form */}
        {screen === 3 && (
          <>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: SLATE, lineHeight: 1.3, margin: '0 0 6px' }}>
              Last step — how do we find you?
            </h2>
            <p style={{ fontSize: 14, color: MUTED, margin: '0 0 22px' }}>
              Only two fields required.
            </p>

            <FieldLabel label="Your full name *">
              <input type="text" autoFocus value={name} onChange={e => setName(e.target.value)}
                placeholder="First and last name" style={inputCss} />
            </FieldLabel>

            <FieldLabel label={
              contactPref === 'email'    ? 'Email address *' :
              contactPref === 'whatsapp' ? 'WhatsApp number *' : 'Phone number *'
            }>
              <input
                type={contactPref === 'email' ? 'email' : 'tel'}
                value={contact}
                onChange={e => setContact(e.target.value)}
                placeholder={contactPref === 'email' ? 'you@example.com' : '+1 758 …'}
                style={inputCss}
              />
            </FieldLabel>

            <FieldLabel label="Anything you'd like to add? (optional)">
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
                placeholder="e.g. Referred by Dr. Pierre, or I have had this for 3 weeks…"
                style={{ ...inputCss, resize: 'vertical', minHeight: 76 } as React.CSSProperties} />
            </FieldLabel>

            {errMsg && (
              <div style={{ padding: '12px 14px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>
                {errMsg}
              </div>
            )}

            <button type="button" onClick={() => void submit()} disabled={!canSubmit}
              style={{
                width: '100%', padding: '17px', borderRadius: 12, border: 'none', marginTop: 6,
                background: canSubmit ? TEAL : '#e2e8f0',
                color: canSubmit ? '#fff' : '#94a3b8',
                fontSize: 16, fontWeight: 800, letterSpacing: '0.01em',
                cursor: canSubmit ? 'pointer' : 'not-allowed', transition: 'background 0.15s',
              }}
            >
              {submitting ? 'Sending…' : 'Send my request →'}
            </button>

            <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 18, lineHeight: 1.6 }}>
              Already have an account?{' '}
              <a href="/patient/login" style={{ color: TEAL, textDecoration: 'none', fontWeight: 600 }}>Sign in →</a>
            </p>
          </>
        )}

        {/* Success */}
        {screen === 4 && (
          <div style={{ textAlign: 'center', padding: '24px 0 8px' }}>
            <div style={{ fontSize: 60, lineHeight: 1, marginBottom: 20 }}>✅</div>
            <h2 style={{ fontSize: 24, fontWeight: 900, color: SLATE, margin: '0 0 12px' }}>
              Request received{name ? `, ${name.split(' ')[0]}` : ''}!
            </h2>
            <p style={{ fontSize: 15, color: MUTED, lineHeight: 1.75, margin: '0 auto 28px', maxWidth: 300 }}>
              Our front desk will{' '}
              {contactPref === 'email'    ? 'email you'     :
               contactPref === 'whatsapp' ? 'WhatsApp you'  : 'call you'}{' '}
              within one working day to confirm your appointment.
            </p>
            <div style={{ padding: '14px 16px', borderRadius: 12, background: '#f8fafc', border: `1px solid ${BORDER}`, fontSize: 13, color: MUTED, lineHeight: 1.9 }}>
              For urgent concerns:<br />
              <strong style={{ color: '#475569' }}>Tapion Hospital</strong><br />
              <a href="tel:+17584592227" style={{ color: TEAL, textDecoration: 'none', fontWeight: 700 }}>459-2227</a>
              {' · '}
              <a href="tel:+17582840557" style={{ color: TEAL, textDecoration: 'none', fontWeight: 700 }}>284-0557</a>
              <br />
              <span style={{ fontSize: 11 }}>or visit your nearest emergency department</span>
            </div>
          </div>
        )}

      </div>

      {/* Direct-contact channels — skip the form and reach us straight away */}
      {showChrome && screen < 3 && <DirectContactStrip />}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function OptionCards({ options, picking, onPick }: {
  options: Opt[];
  picking: string | null;
  onPick: (id: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {options.map(opt => {
        const active = picking === opt.id;
        return (
          <button key={opt.id} type="button" onClick={() => onPick(opt.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 16,
              width: '100%', minHeight: 70, padding: '13px 16px',
              background: active ? `${TEAL}08` : '#fff',
              border: `2px solid ${active ? TEAL : BORDER}`,
              borderRadius: 14, cursor: picking ? 'default' : 'pointer',
              textAlign: 'left', boxSizing: 'border-box',
              boxShadow: active ? `0 0 0 3px ${TEAL}22` : '0 1px 2px rgba(0,0,0,0.04)',
              transform: active ? 'scale(0.986)' : 'scale(1)',
              transition: 'all 0.15s',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span style={{ fontSize: 26, lineHeight: 1, flexShrink: 0, userSelect: 'none' }}>{opt.emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: SLATE, lineHeight: 1.3, marginBottom: 2 }}>{opt.label}</div>
              <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.3 }}>{opt.sub}</div>
            </div>
            <span style={{ color: active ? TEAL : '#d1d5db', fontSize: 18, flexShrink: 0, transition: 'color 0.15s' }}>›</span>
          </button>
        );
      })}
    </div>
  );
}

function DirectContactStrip() {
  const channels: { emoji: string; label: string; href: string; external?: boolean }[] = [
    { emoji: '📞', label: 'Call',     href: DIRECT_PHONE_TEL },
    { emoji: '💬', label: 'WhatsApp', href: DIRECT_WHATSAPP, external: true },
    { emoji: '✉️', label: 'Email',    href: DIRECT_EMAIL },
  ];

  return (
    <div style={{ marginTop: 28, paddingTop: 20, borderTop: `1px solid ${BORDER}` }}>
      <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', margin: '0 0 12px' }}>
        Prefer to skip the form? Reach us directly —
      </p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
        {channels.map(c => (
          <a key={c.label} href={c.href}
            target={c.external ? '_blank' : undefined}
            rel={c.external ? 'noopener noreferrer' : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
              padding: '10px 14px', borderRadius: 999,
              border: `1.5px solid ${BORDER}`, background: '#f8fafc',
              color: '#475569', fontSize: 13, fontWeight: 700,
              textDecoration: 'none', WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>{c.emoji}</span>
            {c.label === 'Call' ? DIRECT_PHONE_LBL : c.label}
          </a>
        ))}
      </div>
    </div>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCss: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '14px 16px', borderRadius: 10,
  border: `2px solid ${BORDER}`,
  background: '#fff', color: SLATE,
  fontSize: 16, fontFamily: 'inherit',
  outline: 'none', WebkitAppearance: 'none',
};
