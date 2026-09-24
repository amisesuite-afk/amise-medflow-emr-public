/**
 * QR code rendered entirely in the browser (`qrcode` package, MIT).
 *
 * Replaces an <img> that sent the patient's questionnaire URL — including its
 * access token — to a free third-party QR service, goQR.me's "qrserver" API
 * (compliance S-4 / A-7). Never point this at a third-party QR or chart
 * service: the encoded value is often a bearer link to patient data.
 * `pnpm --filter @workspace/scripts run lint:no-external-qr` enforces this in CI.
 */
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface LocalQrCodeProps {
  value: string;
  size?: number;
  alt?: string;
}

export function LocalQrCode({ value, size = 180, alt = 'QR code' }: LocalQrCodeProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setFailed(false);
    QRCode.toString(value, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', width: size })
      .then(svg => {
        if (!cancelled) setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => { cancelled = true; };
  }, [value, size]);

  if (failed) {
    return (
      <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, color: '#6b7280', textAlign: 'center', padding: 8 }}>
        QR code unavailable — copy or text the link instead
      </div>
    );
  }
  if (!src) return <div style={{ width: size, height: size }} aria-busy="true" />;
  return <img src={src} alt={alt} width={size} height={size} style={{ display: 'block', borderRadius: 4 }} />;
}
