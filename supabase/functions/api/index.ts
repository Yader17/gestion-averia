// Edge Function "api": único punto de acceso a los datos. Valida sesión y rol en el servidor.
// Despliegue: supabase functions deploy api --no-verify-jwt (la autenticación es propia: sesiones por código).
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  CODE_VALIDITY_DAYS,
  canWriteFaults,
  codeState,
  daysUntil,
  decryptDelivery,
  encryptForDelivery,
  expiryFrom,
  generateAccessCode,
  generateSessionToken,
  hashAccessCode,
  hashSecret,
  isAdmin,
  isWellFormedCode,
  warningThreshold,
  type Role,
} from '../_shared/codes.ts';

const env = (k: string) => Deno.env.get(k) ?? '';
const db = createClient(env('SUPABASE_URL'), env('SB_SECRET_KEY') || env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
});

const PEPPER = env('CODE_PEPPER');
const DELIVERY_KEY = env('DELIVERY_KEY');
const SESSION_DAYS = 30;
const MAX_FAILS_PER_ORIGIN = 5;
const MAX_FAILS_GLOBAL = 100;
const LOGIN_WINDOW_MIN = 15;
const MAX_BATCH = 500;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-session-token, x-cron-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public extra?: unknown) {
    super(message);
  }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

type Actor = { id: string; nombre: string; rol: Role; sessionId: string; sessionExpires: string };
type Params = Record<string, unknown>;

const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.slice(0, max) : '');
const dayMs = 86_400_000;

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function audit(actor: { id?: string | null; nombre?: string | null } | null, accion: string, objetivo: string | null, detalle: Params = {}) {
  await db.from('auditoria').insert({ actor_id: actor?.id ?? null, actor_nombre: actor?.nombre ?? null, accion, objetivo, detalle });
}

async function authenticate(req: Request): Promise<Actor> {
  const token = req.headers.get('x-session-token');
  if (!token) throw new HttpError(401, 'no_session', 'Sesión no iniciada');
  const hash = await hashSecret(token, PEPPER);
  const { data: s } = await db
    .from('sesiones')
    .select('id, expira_en, revocada_en, tecnico_id, tecnicos(id, nombre, rol, activo)')
    .eq('token_hash', hash)
    .maybeSingle();
  // deno-lint-ignore no-explicit-any
  const t = (s as any)?.tecnicos;
  if (!s || s.revocada_en || new Date(s.expira_en).getTime() <= Date.now() || !t?.activo) {
    throw new HttpError(401, 'invalid_session', 'Sesión caducada o no válida');
  }
  await db.from('sesiones').update({ ultima_actividad: new Date().toISOString() }).eq('id', s.id);
  return { id: t.id, nombre: t.nombre, rol: t.rol as Role, sessionId: s.id, sessionExpires: s.expira_en };
}

const requireAdmin = (a: Actor) => {
  if (!isAdmin(a.rol)) throw new HttpError(403, 'forbidden', 'Requiere rol de administrador');
};
const requireWriter = (a: Actor) => {
  if (!canWriteFaults(a.rol)) throw new HttpError(403, 'forbidden', 'Tu rol es de solo consulta');
};

async function issueCode(tecnicoId: string, origen: string, opts: { encryptForPickup?: boolean } = {}) {
  for (let i = 0; i < 5; i++) {
    const code = generateAccessCode();
    const hash = await hashAccessCode(code, PEPPER);
    const now = new Date();
    const { data, error } = await db
      .from('codigos_acceso')
      .insert({
        tecnico_id: tecnicoId,
        code_hash: hash,
        emitido_en: now.toISOString(),
        expira_en: expiryFrom(now).toISOString(),
        origen,
        entrega_cifrada: opts.encryptForPickup ? await encryptForDelivery(code, DELIVERY_KEY) : null,
      })
      .select('id, expira_en')
      .single();
    if (!error && data) return { code, id: data.id as string, expiresAt: data.expira_en as string };
    if (error && error.code !== '23505') throw new HttpError(500, 'db', 'No se pudo generar el código');
  }
  throw new HttpError(500, 'db', 'No se pudo generar un código único');
}

async function revokeCodesAndSessions(tecnicoId: string, motivo: string, keepSessionId?: string, keepCodeId?: string) {
  const now = new Date().toISOString();
  let cq = db.from('codigos_acceso').update({ revocado_en: now, motivo_revocacion: motivo, entrega_cifrada: null })
    .eq('tecnico_id', tecnicoId).is('revocado_en', null);
  if (keepCodeId) cq = cq.neq('id', keepCodeId);
  await cq;
  let q = db.from('sesiones').update({ revocada_en: now }).eq('tecnico_id', tecnicoId).is('revocada_en', null);
  if (keepSessionId) q = q.neq('id', keepSessionId);
  await q;
}

// ---------- Modelo de averías ----------
// deno-lint-ignore no-explicit-any
const toClient = (r: any, urls?: Map<string, string>) => ({
  id: r.id,
  fecha: r.fecha,
  numeroBastidor: r.numero_bastidor,
  tipoAveria: r.tipo_averia,
  intervencion: r.intervencion,
  lugar: r.lugar,
  ubicacion: r.ubicacion,
  observacion: r.observacion,
  solucionado: r.solucionado,
  fotos: (r.fotos ?? []).map((f: Params) => (f.storagePath && urls?.get(f.storagePath as string) ? { ...f, remoteUrl: urls.get(f.storagePath as string) } : f)),
  version: r.version,
  creadoEn: r.creado_en,
  creadoPor: r.creado_por,
  creadoPorNombre: r.creado_por_nombre,
  actualizadoEn: r.actualizado_en,
  actualizadoPor: r.actualizado_por,
  actualizadoPorNombre: r.actualizado_por_nombre,
});

const FIELD_MAP: Record<string, string> = {
  fecha: 'fecha',
  numeroBastidor: 'numero_bastidor',
  tipoAveria: 'tipo_averia',
  intervencion: 'intervencion',
  lugar: 'lugar',
  ubicacion: 'ubicacion',
  observacion: 'observacion',
  solucionado: 'solucionado',
  fotos: 'fotos',
};

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

function sanitizeLocation(v: unknown): Params | null {
  const o = v as Params | null;
  if (!o || typeof o !== 'object') return null;
  const latitude = num(o.latitude);
  const longitude = num(o.longitude);
  if (latitude === undefined || longitude === undefined) return null;
  return { latitude, longitude, displayName: str(o.displayName, 500) };
}

// Solo metadatos de foto. Si hay storagePath, la URL firmada temporal nunca se persiste.
function sanitizePhotos(v: unknown): Params[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 20).filter((x) => x && typeof x === 'object').map((x: Params) => {
    const out: Params = { id: str(x.id, 100), fileName: str(x.fileName, 200), mimeType: str(x.mimeType, 60) };
    if (num(x.width)) out.width = num(x.width);
    if (num(x.height)) out.height = num(x.height);
    const sp = str(x.storagePath, 300);
    if (sp) out.storagePath = sp;
    else if (/^https:\/\//i.test(str(x.remoteUrl, 2000))) out.remoteUrl = str(x.remoteUrl, 2000);
    return out;
  });
}

async function urlMap(rows: Params[]): Promise<Map<string, string>> {
  const paths = [...new Set(rows.flatMap((r) => ((r.fotos as Params[]) ?? []).map((f) => f.storagePath as string).filter(Boolean)))];
  const map = new Map<string, string>();
  for (let i = 0; i < paths.length; i += 200) {
    const { data } = await db.storage.from('fotos').createSignedUrls(paths.slice(i, i + 200), 3600);
    for (const d of data ?? []) if (d.signedUrl && d.path) map.set(d.path, d.signedUrl);
  }
  return map;
}

// deno-lint-ignore no-explicit-any
const one = async (r: any) => toClient(r, await urlMap([r]));

function sanitizeFields(input: Params): Params {
  const out: Params = {};
  for (const [k, col] of Object.entries(FIELD_MAP)) {
    if (!(k in input)) continue;
    const v = input[k];
    if (col === 'solucionado') out[col] = v === true;
    else if (col === 'fotos') out[col] = sanitizePhotos(v);
    else if (col === 'ubicacion') out[col] = sanitizeLocation(v);
    else out[col] = str(v, 5000);
  }
  return out;
}

async function actionAveriasList() {
  const { data, error } = await db.from('averias').select('*').order('creado_en', { ascending: false }).limit(20000);
  if (error) throw new HttpError(500, 'db', 'No se pudieron leer las averías');
  const urls = await urlMap(data ?? []);
  return { averias: (data ?? []).map((r) => toClient(r, urls)) };
}

async function actionAveriasCreate(a: Actor, p: Params) {
  requireWriter(a);
  const fields = sanitizeFields((p.averia ?? {}) as Params);
  const id = str((p.averia as Params)?.id, 100) || crypto.randomUUID();
  const now = new Date().toISOString();
  const row = { ...fields, id, version: 1, creado_por: a.id, creado_por_nombre: a.nombre, creado_en: now,
    actualizado_por: a.id, actualizado_por_nombre: a.nombre, actualizado_en: now };
  const { data, error } = await db.from('averias').insert(row).select('*').single();
  if (error) {
    if (error.code === '23505') throw new HttpError(409, 'duplicate', 'Ya existe una avería con ese identificador');
    throw new HttpError(500, 'db', 'No se pudo crear la avería');
  }
  await db.from('averias_historial').insert({ averia_id: id, version: 1, accion: 'crear', cambios: fields, tecnico_id: a.id, tecnico_nombre: a.nombre });
  return { averia: await one(data) };
}

async function actionAveriasUpdate(a: Actor, p: Params) {
  requireWriter(a);
  const id = str(p.id, 100);
  const expected = Number(p.expectedVersion);
  if (!id || !Number.isInteger(expected)) throw new HttpError(400, 'bad_request', 'Falta id o versión esperada');
  const changes = sanitizeFields((p.changes ?? {}) as Params);
  const { data: current } = await db.from('averias').select('*').eq('id', id).maybeSingle();
  if (!current) throw new HttpError(404, 'not_found', 'La avería no existe (puede haberse eliminado)');
  if (current.version !== expected) {
    throw new HttpError(409, 'conflict', 'La avería fue modificada por otra persona', { actual: await one(current) });
  }
  const diff: Params = {};
  for (const [col, val] of Object.entries(changes)) {
    if (JSON.stringify(current[col]) !== JSON.stringify(val)) {
      diff[col] = col === 'fotos' ? { antes: (current.fotos ?? []).length, despues: (val as unknown[]).length } : { antes: current[col], despues: val };
    }
  }
  if (Object.keys(diff).length === 0) return { averia: await one(current) };
  const { data, error } = await db
    .from('averias')
    .update({ ...changes, version: expected + 1, actualizado_por: a.id, actualizado_por_nombre: a.nombre, actualizado_en: new Date().toISOString() })
    .eq('id', id)
    .eq('version', expected)
    .select('*');
  if (error) throw new HttpError(500, 'db', 'No se pudo actualizar la avería');
  if (!data || data.length === 0) {
    const { data: latest } = await db.from('averias').select('*').eq('id', id).maybeSingle();
    throw new HttpError(409, 'conflict', 'La avería fue modificada por otra persona', { actual: latest ? await one(latest) : null });
  }
  await db.from('averias_historial').insert({ averia_id: id, version: expected + 1, accion: 'modificar', cambios: diff, tecnico_id: a.id, tecnico_nombre: a.nombre });
  return { averia: await one(data[0]) };
}

async function actionAveriasDelete(a: Actor, p: Params) {
  requireWriter(a);
  const id = str(p.id, 100);
  const { data: current } = await db.from('averias').select('*').eq('id', id).maybeSingle();
  if (!current) return { ok: true };
  if (p.expectedVersion !== undefined && current.version !== Number(p.expectedVersion)) {
    throw new HttpError(409, 'conflict', 'La avería fue modificada por otra persona', { actual: await one(current) });
  }
  const { error } = await db.from('averias').delete().eq('id', id).eq('version', current.version);
  if (error) throw new HttpError(500, 'db', 'No se pudo eliminar la avería');
  const snapshot = { ...current, fotos: (current.fotos ?? []).length };
  await db.from('averias_historial').insert({ averia_id: id, version: current.version + 1, accion: 'eliminar', cambios: snapshot, tecnico_id: a.id, tecnico_nombre: a.nombre });
  return { ok: true };
}

async function actionPhotoUploadUrl(a: Actor, p: Params) {
  requireWriter(a);
  const mime = str(p.mimeType, 60);
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic'].includes(mime)) throw new HttpError(400, 'bad_request', 'Tipo de imagen no permitido');
  const safe = str(p.fileName, 100).replace(/[^a-zA-Z0-9._-]/g, '_') || 'foto.jpg';
  const path = `${crypto.randomUUID()}/${safe}`;
  const { data, error } = await db.storage.from('fotos').createSignedUploadUrl(path);
  if (error || !data) throw new HttpError(500, 'storage', 'No se pudo preparar la subida de la foto');
  return { path, signedUrl: data.signedUrl, token: data.token };
}

async function actionTypesGet() {
  const { data } = await db.from('configuracion').select('valor').eq('clave', 'tipos_intervencion').maybeSingle();
  try { return { tiposIntervencion: JSON.parse(data?.valor ?? '[]') as string[] }; } catch { return { tiposIntervencion: [] }; }
}

async function actionTypesSet(a: Actor, p: Params) {
  requireWriter(a);
  const list = Array.isArray(p.tiposIntervencion) ? [...new Set((p.tiposIntervencion as unknown[]).map((x) => str(x, 80).trim()).filter(Boolean))].slice(0, 200) : [];
  await db.from('configuracion').upsert({ clave: 'tipos_intervencion', valor: JSON.stringify(list) });
  await audit(a, 'config.tipos_intervencion', null, { total: list.length });
  return { ok: true };
}

// Vaciado total (antigua "Nueva plantilla"): solo administrador; cada registro queda en el historial.
async function actionAveriasClear(a: Actor, p: Params) {
  requireAdmin(a);
  if (p.confirm !== 'VACIAR') throw new HttpError(400, 'bad_request', 'Falta la confirmaci?n expl?cita');
  const { data } = await db.from('averias').select('*').limit(20000);
  const rows = data ?? [];
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    await db.from('averias_historial').insert(chunk.map((r) => ({ averia_id: r.id, version: r.version + 1, accion: 'eliminar', cambios: { ...r, fotos: (r.fotos ?? []).length }, tecnico_id: a.id, tecnico_nombre: a.nombre })));
    await db.from('averias').delete().in('id', chunk.map((r) => r.id));
  }
  await audit(a, 'averias.vaciar', null, { total: rows.length });
  return { deleted: rows.length };
}

async function actionAveriasHistory(_a: Actor, p: Params) {
  const { data, error } = await db.from('averias_historial').select('*').eq('averia_id', str(p.id, 100)).order('en', { ascending: false }).limit(200);
  if (error) throw new HttpError(500, 'db', 'No se pudo leer el historial');
  return { historial: data ?? [] };
}

// Migración: solo inserta registros que no existen; jamás sobrescribe.
async function actionAveriasImport(a: Actor, p: Params) {
  requireWriter(a);
  const records = Array.isArray(p.averias) ? (p.averias as Params[]) : [];
  if (records.length > MAX_BATCH) throw new HttpError(400, 'too_large', `Máximo ${MAX_BATCH} registros por lote`);
  const origen = str(p.origen, 40) || 'cliente';
  let inserted = 0;
  let skipped = 0;
  for (const rec of records) {
    const id = str(rec.id, 100);
    if (!id) { skipped++; continue; }
    const fields = sanitizeFields(rec);
    const now = new Date().toISOString();
    const { data, error } = await db
      .from('averias')
      .upsert({ ...fields, id, version: 1, origen_migracion: origen, creado_en: now, actualizado_en: now,
        creado_por: a.id, creado_por_nombre: a.nombre, actualizado_por: a.id, actualizado_por_nombre: a.nombre },
        { onConflict: 'id', ignoreDuplicates: true })
      .select('id');
    if (error) throw new HttpError(500, 'db', 'Error durante la importación');
    if (data && data.length) {
      inserted++;
      await db.from('averias_historial').insert({ averia_id: id, version: 1, accion: 'importar', cambios: { origen }, tecnico_id: a.id, tecnico_nombre: a.nombre });
    } else skipped++;
  }
  await audit(a, 'averias.importar', null, { origen, inserted, skipped });
  return { inserted, skipped };
}

// ---------- Autenticación ----------
async function originHash(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') ?? 'desconocido').split(',')[0].trim();
  return hashSecret(`ip:${ip}`, PEPPER);
}

async function actionLogin(req: Request, p: Params) {
  const origin = await originHash(req);
  const since = new Date(Date.now() - LOGIN_WINDOW_MIN * 60_000).toISOString();
  const [{ count: failsOrigin }, { count: failsGlobal }] = await Promise.all([
    db.from('intentos_login').select('id', { count: 'exact', head: true }).eq('origen_hash', origin).eq('exito', false).gte('en', since),
    db.from('intentos_login').select('id', { count: 'exact', head: true }).eq('exito', false).gte('en', since),
  ]);
  if ((failsOrigin ?? 0) >= MAX_FAILS_PER_ORIGIN || (failsGlobal ?? 0) >= MAX_FAILS_GLOBAL) {
    throw new HttpError(429, 'rate_limited', 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.');
  }

  const fail = async () => {
    await db.from('intentos_login').insert({ origen_hash: origin, exito: false });
    throw new HttpError(401, 'invalid_code', 'Código no válido, caducado o revocado');
  };

  const raw = str(p.code, 64);
  if (!isWellFormedCode(raw)) return fail();
  const hash = await hashAccessCode(raw, PEPPER);
  const { data: c } = await db
    .from('codigos_acceso')
    .select('id, expira_en, revocado_en, tecnico_id, tecnicos(id, nombre, rol, activo)')
    .eq('code_hash', hash)
    .maybeSingle();
  // deno-lint-ignore no-explicit-any
  const t = (c as any)?.tecnicos;
  if (!c || !t?.activo || codeState(c) !== 'activo') return fail();

  const token = generateSessionToken();
  const sessionExpires = new Date(Math.min(Date.now() + SESSION_DAYS * dayMs, new Date(c.expira_en).getTime()));
  await db.from('sesiones').insert({
    tecnico_id: t.id,
    token_hash: await hashSecret(token, PEPPER),
    expira_en: sessionExpires.toISOString(),
    dispositivo: str(req.headers.get('user-agent') ?? '', 200),
  });
  await db.from('intentos_login').insert({ origen_hash: origin, exito: true });
  await audit({ id: t.id, nombre: t.nombre }, 'auth.login', t.id);
  return { token, sessionExpiresAt: sessionExpires.toISOString(), ...(await profile(t.id)) };
}

async function profile(tecnicoId: string) {
  const { data: t } = await db.from('tecnicos').select('id, nombre, email, rol').eq('id', tecnicoId).single();
  const { data: codes } = await db.from('codigos_acceso').select('expira_en, revocado_en').eq('tecnico_id', tecnicoId).order('emitido_en', { ascending: false });
  const active = (codes ?? []).find((c) => codeState(c) === 'activo');
  const left = active ? daysUntil(active.expira_en) : 0;
  return {
    tecnico: t,
    codigo: active ? { expiraEn: active.expira_en, diasRestantes: left, aviso: warningThreshold(left) } : null,
  };
}

async function actionRenew(a: Actor) {
  const issued = await issueCode(a.id, 'renovacion_usuario');
  await revokeCodesAndSessions(a.id, 'Sustituido por renovación', a.sessionId, issued.id);
  await db.from('sesiones').update({ expira_en: new Date(Math.min(Date.now() + SESSION_DAYS * dayMs, new Date(issued.expiresAt).getTime())).toISOString() }).eq('id', a.sessionId);
  await audit(a, 'codigo.renovar', a.id);
  return { code: issued.code, expiraEn: issued.expiresAt };
}

// ---------- Administración ----------
async function actionTecnicosList() {
  const [{ data: ts }, { data: codes }] = await Promise.all([
    db.from('tecnicos').select('*').order('created_at'),
    db.from('codigos_acceso').select('id, tecnico_id, expira_en, revocado_en, origen, entrega_cifrada, emitido_en'),
  ]);
  return {
    tecnicos: (ts ?? []).map((t) => {
      const mine = (codes ?? []).filter((c) => c.tecnico_id === t.id).sort((x, y) => y.emitido_en.localeCompare(x.emitido_en));
      const active = mine.find((c) => codeState(c) === 'activo');
      const pending = mine.find((c) => c.entrega_cifrada && !c.revocado_en);
      return {
        ...t,
        codigo: active
          ? { estado: 'activo', expiraEn: active.expira_en, diasRestantes: daysUntil(active.expira_en), pendienteEntrega: !!active.entrega_cifrada, codigoId: active.id }
          : { estado: mine[0] ? codeState(mine[0]) : 'sin_codigo', expiraEn: mine[0]?.expira_en ?? null, diasRestantes: 0, pendienteEntrega: !!pending, codigoId: pending?.id ?? null },
      };
    }),
  };
}

async function actionTecnicoCreate(a: Actor, p: Params) {
  const nombre = str(p.nombre, 120).trim();
  const rol = str(p.rol, 20) as Role;
  const email = str(p.email, 200).trim().toLowerCase() || null;
  if (!nombre || !['administrador', 'tecnico', 'consulta'].includes(rol)) throw new HttpError(400, 'bad_request', 'Nombre o rol no válidos');
  const { data, error } = await db.from('tecnicos').insert({ nombre, email, rol, created_by: a.id }).select('id').single();
  if (error) throw new HttpError(error.code === '23505' ? 409 : 500, 'db', error.code === '23505' ? 'Ya existe un técnico con ese correo' : 'No se pudo crear el técnico');
  const issued = await issueCode(data.id, 'alta');
  await audit(a, 'tecnico.crear', data.id, { nombre, rol });
  return { tecnicoId: data.id, code: issued.code, expiraEn: issued.expiresAt };
}

async function activeAdminCount() {
  const { count } = await db.from('tecnicos').select('id', { count: 'exact', head: true }).eq('rol', 'administrador').eq('activo', true);
  return count ?? 0;
}

async function actionTecnicoUpdate(a: Actor, p: Params) {
  const id = str(p.id, 60);
  const { data: t } = await db.from('tecnicos').select('*').eq('id', id).maybeSingle();
  if (!t) throw new HttpError(404, 'not_found', 'Técnico no encontrado');
  const patch: Params = {};
  if (typeof p.nombre === 'string' && p.nombre.trim()) patch.nombre = str(p.nombre, 120).trim();
  if (typeof p.rol === 'string') {
    if (!['administrador', 'tecnico', 'consulta'].includes(p.rol)) throw new HttpError(400, 'bad_request', 'Rol no válido');
    patch.rol = p.rol;
  }
  if (typeof p.activo === 'boolean') patch.activo = p.activo;
  const losesAdmin = t.rol === 'administrador' && t.activo && (patch.rol && patch.rol !== 'administrador' || patch.activo === false);
  if (losesAdmin && (await activeAdminCount()) <= 1) throw new HttpError(409, 'last_admin', 'No se puede dejar el sistema sin administrador activo');
  const { error } = await db.from('tecnicos').update(patch).eq('id', id);
  if (error) throw new HttpError(500, 'db', 'No se pudo actualizar el técnico');
  if (patch.activo === false || (patch.rol && patch.rol !== t.rol)) {
    await db.from('sesiones').update({ revocada_en: new Date().toISOString() }).eq('tecnico_id', id).is('revocada_en', null);
  }
  await audit(a, 'tecnico.actualizar', id, { antes: { rol: t.rol, activo: t.activo }, despues: patch });
  return { ok: true };
}

async function actionCodeReissue(a: Actor, p: Params) {
  const id = str(p.tecnicoId, 60);
  const { data: t } = await db.from('tecnicos').select('id, activo').eq('id', id).maybeSingle();
  if (!t || !t.activo) throw new HttpError(404, 'not_found', 'Técnico no encontrado o inactivo');
  await revokeCodesAndSessions(id, str(p.motivo, 200) || 'Reemisión por administrador');
  const issued = await issueCode(id, 'reemision_admin');
  await audit(a, 'codigo.reemitir', id, { motivo: str(p.motivo, 200) });
  return { code: issued.code, expiraEn: issued.expiresAt };
}

async function actionCodeRevoke(a: Actor, p: Params) {
  const id = str(p.tecnicoId, 60);
  await revokeCodesAndSessions(id, str(p.motivo, 200) || 'Revocado por administrador (posible compromiso)');
  await audit(a, 'codigo.revocar', id, { motivo: str(p.motivo, 200) });
  return { ok: true };
}

// Recoge una sola vez el código generado por rotación automática y borra el cifrado.
async function actionCodeCollect(a: Actor, p: Params) {
  const { data: c } = await db.from('codigos_acceso').select('id, tecnico_id, entrega_cifrada, revocado_en, expira_en').eq('id', str(p.codigoId, 60)).maybeSingle();
  if (!c || !c.entrega_cifrada || c.revocado_en) throw new HttpError(404, 'not_found', 'No hay un código pendiente de entrega');
  const code = await decryptDelivery(c.entrega_cifrada, DELIVERY_KEY);
  await db.from('codigos_acceso').update({ entrega_cifrada: null }).eq('id', c.id);
  await audit(a, 'codigo.recoger_entrega', c.tecnico_id);
  return { code, expiraEn: c.expira_en };
}

async function actionAuditList(_a: Actor, p: Params) {
  const limit = Math.min(Math.max(Number(p.limit) || 100, 1), 500);
  const { data } = await db.from('auditoria').select('*').order('en', { ascending: false }).limit(limit);
  return { eventos: data ?? [] };
}

async function actionConfigSet(a: Actor, p: Params) {
  const valor = str(p.contacto, 200).trim();
  if (!valor) throw new HttpError(400, 'bad_request', 'Contacto vacío');
  await db.from('configuracion').upsert({ clave: 'contacto_codigos', valor });
  await audit(a, 'config.contacto', 'contacto_codigos', { valor });
  return { ok: true };
}

// ---------- Tareas programadas ----------
async function actionRotate(req: Request) {
  const cron = env('CRON_TOKEN');
  const given = req.headers.get('x-cron-token') ?? '';
  if (!cron || !timingSafeEqual(cron, given)) throw new HttpError(403, 'forbidden', 'No autorizado');
  const [{ data: ts }, { data: codes }] = await Promise.all([
    db.from('tecnicos').select('id, nombre').eq('activo', true),
    db.from('codigos_acceso').select('tecnico_id, expira_en, revocado_en'),
  ]);
  let generated = 0;
  for (const t of ts ?? []) {
    const mine = (codes ?? []).filter((c) => c.tecnico_id === t.id);
    if (mine.some((c) => codeState(c) === 'activo')) continue;
    await db.from('codigos_acceso').update({ revocado_en: new Date().toISOString(), motivo_revocacion: 'Caducado: sustituido por rotación', entrega_cifrada: null })
      .eq('tecnico_id', t.id).is('revocado_en', null);
    await issueCode(t.id, 'rotacion_automatica', { encryptForPickup: true });
    await audit(null, 'codigo.rotacion_automatica', t.id, { nombre: t.nombre, validezDias: CODE_VALIDITY_DAYS });
    generated++;
  }
  return { generated };
}

async function actionBootstrap(p: Params) {
  const expected = env('BOOTSTRAP_TOKEN');
  if (!expected || !timingSafeEqual(expected, str(p.token, 200))) throw new HttpError(403, 'forbidden', 'No autorizado');
  const { count } = await db.from('tecnicos').select('id', { count: 'exact', head: true }).eq('rol', 'administrador');
  if ((count ?? 0) > 0) throw new HttpError(409, 'already_initialized', 'Ya existe un administrador');
  const nombre = str(p.nombre, 120).trim();
  const email = str(p.email, 200).trim().toLowerCase();
  if (!nombre || !email) throw new HttpError(400, 'bad_request', 'Nombre y correo obligatorios');
  const { data, error } = await db.from('tecnicos').insert({ nombre, email, rol: 'administrador' }).select('id').single();
  if (error) throw new HttpError(500, 'db', 'No se pudo crear el administrador');
  const issued = await issueCode(data.id, 'bootstrap');
  await audit({ id: data.id, nombre }, 'sistema.bootstrap', data.id);
  return { tecnicoId: data.id, code: issued.code, expiraEn: issued.expiresAt };
}

async function actionPublicConfig() {
  const { data } = await db.from('configuracion').select('valor').eq('clave', 'contacto_codigos').maybeSingle();
  return { contacto: data?.valor ?? '' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    if (!PEPPER || !DELIVERY_KEY) throw new HttpError(500, 'misconfigured', 'Servidor sin configurar (faltan secretos)');
    if (req.method !== 'POST') throw new HttpError(405, 'method', 'Método no permitido');
    const body = (await req.json().catch(() => ({}))) as { action?: string; params?: Params };
    const action = body.action ?? '';
    const p = body.params ?? {};

    // Acciones sin sesión (con sus propios controles)
    if (action === 'config.public') return json(200, await actionPublicConfig());
    if (action === 'auth.login') return json(200, await actionLogin(req, p));
    if (action === 'system.bootstrap') return json(200, await actionBootstrap(p));
    if (action === 'system.rotate') return json(200, await actionRotate(req));

    const a = await authenticate(req);
    switch (action) {
      case 'auth.me': return json(200, { ...(await profile(a.id)), sessionExpiresAt: a.sessionExpires });
      case 'auth.logout':
        await db.from('sesiones').update({ revocada_en: new Date().toISOString() }).eq('id', a.sessionId);
        return json(200, { ok: true });
      case 'auth.renew': return json(200, await actionRenew(a));
      case 'averias.list': return json(200, await actionAveriasList());
      case 'averias.create': return json(200, await actionAveriasCreate(a, p));
      case 'averias.update': return json(200, await actionAveriasUpdate(a, p));
      case 'averias.delete': return json(200, await actionAveriasDelete(a, p));
      case 'averias.history': return json(200, await actionAveriasHistory(a, p));
      case 'averias.import': return json(200, await actionAveriasImport(a, p));
      case 'fotos.subir': return json(200, await actionPhotoUploadUrl(a, p));
      case 'tipos.get': return json(200, await actionTypesGet());
      case 'tipos.set': return json(200, await actionTypesSet(a, p));
    }
    requireAdmin(a);
    switch (action) {
      case 'averias.vaciar': return json(200, await actionAveriasClear(a, p));
      case 'tecnicos.list': return json(200, await actionTecnicosList());
      case 'tecnicos.create': return json(200, await actionTecnicoCreate(a, p));
      case 'tecnicos.update': return json(200, await actionTecnicoUpdate(a, p));
      case 'codigos.reemitir': return json(200, await actionCodeReissue(a, p));
      case 'codigos.revocar': return json(200, await actionCodeRevoke(a, p));
      case 'codigos.recoger': return json(200, await actionCodeCollect(a, p));
      case 'auditoria.list': return json(200, await actionAuditList(a, p));
      case 'config.set': return json(200, await actionConfigSet(a, p));
    }
    throw new HttpError(404, 'unknown_action', 'Acción desconocida');
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: { code: e.code, message: e.message, ...(e.extra ? { detail: e.extra } : {}) } });
    console.error(e);
    return json(500, { error: { code: 'internal', message: 'Error interno del servidor' } });
  }
});
