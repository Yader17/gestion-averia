import Constants from 'expo-constants';
import { clearSessionToken, readSessionToken } from './sessionStore';

const extra = (Constants.expoConfig?.extra ?? {}) as { backend?: { url?: string } };
const BASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL || extra.backend?.url || '').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public detail?: unknown
  ) {
    super(message);
  }
}

let unauthorizedHandler: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  unauthorizedHandler = fn;
}

export const isBackendConfigured = () => BASE_URL.length > 0;

export async function callApi<T = Record<string, unknown>>(
  action: string,
  params: Record<string, unknown> = {},
  options: { token?: string | null } = {}
): Promise<T> {
  if (!BASE_URL) throw new ApiError(0, 'not_configured', 'El servidor no está configurado en esta aplicación.');
  const token = options.token === undefined ? await readSessionToken() : options.token;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/functions/v1/api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'x-session-token': token } : {}) },
      body: JSON.stringify({ action, params }),
    });
  } catch {
    throw new ApiError(0, 'network', 'No hay conexión con el servidor. Revisa tu conexión a internet.');
  }

  const payload = (await response.json().catch(() => null)) as
    | { error?: { code?: string; message?: string; detail?: unknown } }
    | null;

  if (!response.ok) {
    const err = payload?.error;
    if (response.status === 401 && err?.code === 'invalid_session') {
      await clearSessionToken();
      unauthorizedHandler?.();
    }
    throw new ApiError(response.status, err?.code ?? 'error', err?.message ?? 'Error del servidor', err?.detail);
  }

  return payload as T;
}

export function describeApiError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'rate_limited') return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
    return error.message;
  }
  return error instanceof Error ? error.message : 'Error desconocido';
}
