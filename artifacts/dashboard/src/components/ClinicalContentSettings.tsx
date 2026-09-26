import { useEffect, useState } from 'react';
import { loadApprovedContent, SHARED_RULE_FILES, type ApprovedContentLoad } from '@/lib/approved-content';

/**
 * Settings → Clinical rule files (every staff role; display only). Each shared rule file
 * (clinical-content/rules/*.json) with the copy in force: "Bundled 1.0.0", or "Approved release
 * 1.0.1 · sha 1a2b3c4d" for a verified release published through the approved-content channel
 * (docs/APPROVED-CONTENT-CHANNEL.md, Migration 98), plus any release that was refused and why.
 * The iOS equivalent is Settings → Diagnostics → Shared clinical rules.
 */

const cell: React.CSSProperties = { padding: '6px 10px', borderTop: '1px solid #e2e8f0', fontSize: 12, verticalAlign: 'top' };

const REASON_TEXT: Record<string, string> = {
  'wrong-content': 'another file',
  revoked: 'revoked',
  'bad-version': 'version not MAJOR.MINOR.PATCH',
  'not-newer': 'not newer than this build',
  malformed: 'malformed',
  'hash-mismatch': 'hash does not match (changed after publishing)',
  'id-mismatch': 'wrong file id',
  'version-mismatch': 'version does not match its content',
  'schema-invalid': 'fails the schema of this build',
  'pinned-field-changed': 'changes content that needs an app update',
};

export default function ClinicalContentSettings() {
  const [load, setLoad] = useState<ApprovedContentLoad | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void loadApprovedContent().then(r => { if (live) setLoad(r); });
    return () => { live = false; };
  }, []);

  async function recheck() {
    setBusy(true);
    const r = await loadApprovedContent(true);
    setLoad(r);
    setBusy(false);
  }

  const byId = new Map((load?.files ?? []).map(f => [f.contentId, f]));

  return (
    <div style={{ marginBottom: 28 }} data-testid="clinical-content-settings">
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted, #64748b)', marginBottom: 12 }}>
        Clinical rule files
      </div>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '10px 12px', fontSize: 12, color: '#475569' }}>
          Rule files shared with the iPhone and iPad app. Zebra rules and the supplement catalogue can be updated by a
          signed-off release published by the practice; a release is used only after it passes every check, otherwise
          the file built into this version is used.
          {load && !load.available && (
            <div style={{ marginTop: 6, color: '#64748b' }}>Published releases become available after the database update (Migration 98). The built-in files are in use.</div>
          )}
          {load?.error && <div style={{ marginTop: 6, color: '#b91c1c' }}>Could not check for releases: {load.error}. The built-in files are in use.</div>}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', fontSize: 11, color: '#64748b' }}>
              <th style={{ ...cell, borderTop: 'none' }}>File</th>
              <th style={{ ...cell, borderTop: 'none' }}>In use</th>
            </tr>
          </thead>
          <tbody>
            {SHARED_RULE_FILES.map(f => {
              const a = byId.get(f.contentId);
              const inUse = a?.source === 'release' && a.release
                ? `Approved release ${a.release.version} · sha ${a.release.sha256.slice(0, 8)} (bundled ${a.bundledVersion})`
                : `Bundled ${f.version}`;
              return (
                <tr key={f.file}>
                  <td style={cell}>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{f.file}.json</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{f.contentId}{a ? '' : ' · built in only'}</div>
                  </td>
                  <td style={cell}>
                    <div style={{ color: a?.source === 'release' ? '#0f766e' : '#1e293b' }}>{inUse}</div>
                    {a?.release?.signoffRef && <div style={{ fontSize: 11, color: '#64748b' }}>Sign-off: {a.release.signoffRef}</div>}
                    {a?.rejected.filter(r => r.reason !== 'not-newer').map(r => (
                      <div key={`${r.version}-${r.reason}`} style={{ fontSize: 11, color: r.reason === 'revoked' ? '#64748b' : '#b45309' }}>
                        Release {r.version} not used: {REASON_TEXT[r.reason] ?? r.reason}
                      </div>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ padding: '8px 12px', borderTop: '1px solid #e2e8f0' }}>
          <button type="button" onClick={() => void recheck()} disabled={busy}
            style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: busy ? 'default' : 'pointer' }}>
            {busy ? 'Checking…' : 'Check again'}
          </button>
        </div>
      </div>
    </div>
  );
}
