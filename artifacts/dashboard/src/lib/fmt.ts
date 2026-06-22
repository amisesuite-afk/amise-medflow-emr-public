import { formatSlPhone } from '@/data/st-lucia';

export function fmtPhone(raw: string | null | undefined): string {
  if (!raw) return '';
  const sl = formatSlPhone(raw);
  if (sl !== raw) return sl;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 ${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+1 ${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
}
