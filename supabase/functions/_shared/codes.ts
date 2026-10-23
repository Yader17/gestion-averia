// Lógica pura de códigos de acceso (sin dependencias de Deno ni de Node: solo Web APIs),
// compartida por la Edge Function y las pruebas.

export const CODE_VALIDITY_DAYS = 120;
export const WARNING_DAYS = [14, 7, 1] as const;
const DAY_MS = 86_400_000;

// Alfabeto Crockford (sin I, L, O, U): evita confusiones al dictar o copiar el código.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 20; // 20 x 5 bits = 100 bits de entropía

export function generateAccessCode(randomBytes?: Uint8Array): string {
  const bytes = randomBytes ?? crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  let raw = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    // 256 es múltiplo de 32, por lo que no hay sesgo de módulo.
    raw += ALPHABET[bytes[i] % 32];
  }
  return raw.match(/.{5}/g)!.join('-');
}

export function normalizeAccessCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

export function isWellFormedCode(input: string): boolean {
  const n = normalizeAccessCode(input);
  return n.length === CODE_LENGTH && [...n].every((c) => ALPHABET.includes(c));
}

const toHex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

// HMAC-SHA256 con secreto del servidor (pepper). El código ya tiene 100 bits de entropía,
// por lo que un hash rápido con pepper es adecuado y permite búsqueda directa por verificador.
export async function hashSecret(value: string, pepper: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(value)));
}

export function hashAccessCode(code: string, pepper: string): Promise<string> {
  return hashSecret(normalizeAccessCode(code), pepper);
}

export function generateSessionToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function expiryFrom(issuedAt: Date, days = CODE_VALIDITY_DAYS): Date {
  return new Date(issuedAt.getTime() + days * DAY_MS);
}

export type CodeState = 'activo' | 'caducado' | 'revocado';

export function codeState(c: { expira_en: string; revocado_en: string | null }, now = new Date()): CodeState {
  if (c.revocado_en) return 'revocado';
  return new Date(c.expira_en).getTime() <= now.getTime() ? 'caducado' : 'activo';
}

export function daysUntil(expiresAt: string | Date, now = new Date()): number {
  const diff = new Date(expiresAt).getTime() - now.getTime();
  return Math.ceil(diff / DAY_MS);
}

// Devuelve el umbral de aviso (14, 7 o 1) aplicable, o null si aún no toca avisar.
export function warningThreshold(daysLeft: number): number | null {
  if (daysLeft <= 0) return null;
  for (const t of [...WARNING_DAYS].sort((a, b) => a - b)) {
    if (daysLeft <= t) return t;
  }
  return null;
}

// AES-GCM para custodiar temporalmente un código pendiente de entrega.
async function aesKey(secret: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function encryptForDelivery(plain: string, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(secret), new TextEncoder().encode(plain)));
  return `${b64(iv)}.${b64(ct)}`;
}

export async function decryptDelivery(payload: string, secret: string): Promise<string> {
  const [iv, ct] = payload.split('.');
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await aesKey(secret), unb64(ct));
  return new TextDecoder().decode(plain);
}

export type Role = 'administrador' | 'tecnico' | 'consulta';
export const canWriteFaults = (r: Role) => r === 'administrador' || r === 'tecnico';
export const isAdmin = (r: Role) => r === 'administrador';
