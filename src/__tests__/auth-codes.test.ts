import { describe, expect, it } from 'vitest';
import {
  CODE_VALIDITY_DAYS,
  canWriteFaults,
  codeState,
  daysUntil,
  decryptDelivery,
  encryptForDelivery,
  expiryFrom,
  generateAccessCode,
  hashAccessCode,
  isAdmin,
  isWellFormedCode,
  normalizeAccessCode,
  warningThreshold,
} from '../../supabase/functions/_shared/codes';

describe('códigos de acceso', () => {
  it('genera códigos únicos con formato y 100 bits', () => {
    const set = new Set(Array.from({ length: 500 }, () => generateAccessCode()));
    expect(set.size).toBe(500);
    const code = [...set][0];
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}(-[0-9A-HJKMNP-TV-Z]{5}){3}$/);
    expect(isWellFormedCode(code)).toBe(true);
  });

  it('normaliza entradas con minúsculas, espacios y caracteres ambiguos', () => {
    const code = generateAccessCode();
    expect(normalizeAccessCode(code.toLowerCase().replace(/-/g, ' '))).toBe(normalizeAccessCode(code));
    expect(isWellFormedCode('abc')).toBe(false);
  });

  it('el verificador es estable, depende del secreto y no contiene el código', async () => {
    const code = generateAccessCode();
    const a = await hashAccessCode(code, 'pepper-1');
    expect(await hashAccessCode(code.toLowerCase(), 'pepper-1')).toBe(a);
    expect(await hashAccessCode(code, 'pepper-2')).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain(normalizeAccessCode(code));
  });

  it('vigencia de 120 días y estados', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const exp = expiryFrom(now);
    expect(CODE_VALIDITY_DAYS).toBe(120);
    expect(daysUntil(exp, now)).toBe(120);
    expect(codeState({ expira_en: exp.toISOString(), revocado_en: null }, now)).toBe('activo');
    expect(codeState({ expira_en: exp.toISOString(), revocado_en: null }, new Date(exp.getTime() + 1))).toBe('caducado');
    expect(codeState({ expira_en: exp.toISOString(), revocado_en: now.toISOString() }, now)).toBe('revocado');
  });

  it('avisos a 14, 7 y 1 días', () => {
    expect(warningThreshold(30)).toBeNull();
    expect(warningThreshold(14)).toBe(14);
    expect(warningThreshold(10)).toBe(14);
    expect(warningThreshold(7)).toBe(7);
    expect(warningThreshold(2)).toBe(7);
    expect(warningThreshold(1)).toBe(1);
    expect(warningThreshold(0)).toBeNull();
  });

  it('cifra y descifra la entrega pendiente; falla con otra clave', async () => {
    const enc = await encryptForDelivery('ABCDE-12345', 'k1');
    expect(enc).not.toContain('ABCDE');
    expect(await decryptDelivery(enc, 'k1')).toBe('ABCDE-12345');
    await expect(decryptDelivery(enc, 'k2')).rejects.toThrow();
  });

  it('permisos por rol', () => {
    expect(canWriteFaults('consulta')).toBe(false);
    expect(canWriteFaults('tecnico')).toBe(true);
    expect(isAdmin('tecnico')).toBe(false);
    expect(isAdmin('administrador')).toBe(true);
  });
});
