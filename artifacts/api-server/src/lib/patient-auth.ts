/**
 * Patient authentication helpers.
 *
 * Passwords use Node's built-in scrypt (no external deps).
 * Sessions are signed JWTs using HMAC-SHA256 with SESSION_SECRET.
 * Temp passwords are 8 uppercase chars (no ambiguous 0/O/1/I/L), split XXXX-XXXX.
 */
import {
  scrypt,
  randomBytes,
  timingSafeEqual,
  createHmac,
} from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

// ── Temp password generation ──────────────────────────────────────────────────

const TEMP_PW_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateTempPassword(): string {
  const bytes = randomBytes(8);
  const raw = Array.from(bytes)
    .map(b => TEMP_PW_CHARS[b % TEMP_PW_CHARS.length])
    .join('');
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

// ── Password hashing ──────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password.normalize('NFKC'), salt, 64)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const derived = (await scryptAsync(password.normalize('NFKC'), salt, 64)) as Buffer;
    const stored_buf = Buffer.from(hash, 'hex');
    if (derived.length !== stored_buf.length) return false;
    return timingSafeEqual(derived, stored_buf);
  } catch {
    return false;
  }
}

// ── JWT (HMAC-SHA256, no external deps) ──────────────────────────────────────

export interface PatientJwtPayload {
  sub: string;      // patient_account id
  patientId: string;
  email: string;
  iat: number;
  exp: number;
}

function b64url(buf: Buffer | string): string {
  return Buffer.isBuffer(buf)
    ? buf.toString('base64url')
    : Buffer.from(buf).toString('base64url');
}

const JWT_HEADER = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));

function jwtSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET is not set');
  return s;
}

export function signPatientJwt(payload: Omit<PatientJwtPayload, 'iat' | 'exp'>, expiresInDays = 90): string {
  const now = Math.floor(Date.now() / 1000);
  const full: PatientJwtPayload = { ...payload, iat: now, exp: now + expiresInDays * 86400 };
  const body = b64url(JSON.stringify(full));
  const sig = createHmac('sha256', jwtSecret()).update(`${JWT_HEADER}.${body}`).digest('base64url');
  return `${JWT_HEADER}.${body}.${sig}`;
}

export function verifyPatientJwt(token: string): PatientJwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expected = createHmac('sha256', jwtSecret())
      .update(`${header}.${body}`)
      .digest('base64url');
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as PatientJwtPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
