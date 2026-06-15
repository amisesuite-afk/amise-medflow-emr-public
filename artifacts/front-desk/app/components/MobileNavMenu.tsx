'use client';

import { useState } from 'react';
import Link from 'next/link';

export function MobileNavMenu({ links }: { links: readonly { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="amise-nav-hamburger">
      <button
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5,
          width: 38, height: 38, padding: 0,
          background: 'none', border: 'none', cursor: 'pointer',
        }}
      >
        <span style={{ display: 'block', width: 22, height: 2, background: '#0f172a', borderRadius: 1, transition: 'transform 0.15s', transform: open ? 'translateY(7px) rotate(45deg)' : 'none' }} />
        <span style={{ display: 'block', width: 22, height: 2, background: '#0f172a', borderRadius: 1, opacity: open ? 0 : 1, transition: 'opacity 0.15s' }} />
        <span style={{ display: 'block', width: 22, height: 2, background: '#0f172a', borderRadius: 1, transition: 'transform 0.15s', transform: open ? 'translateY(-7px) rotate(-45deg)' : 'none' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 66, left: 0, right: 0,
          background: '#fff', borderBottom: '1px solid #e8f0ef',
          boxShadow: '0 8px 16px rgba(0,0,0,0.08)',
          display: 'flex', flexDirection: 'column', padding: '8px 24px 16px',
          zIndex: 99,
        }}>
          {links.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              style={{
                padding: '12px 0', fontSize: 15, fontWeight: 600,
                color: '#374151', textDecoration: 'none',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              {label}
            </a>
          ))}
          <Link
            href="/patient/request"
            onClick={() => setOpen(false)}
            style={{
              padding: '12px 0', fontSize: 15, fontWeight: 700,
              color: '#0d9488', textDecoration: 'none',
            }}
          >
            New Patient?
          </Link>
        </div>
      )}
    </div>
  );
}
