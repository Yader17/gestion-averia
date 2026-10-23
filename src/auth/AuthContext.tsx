import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { callApi, setUnauthorizedHandler } from '../services/api/apiClient';
import { clearSessionToken, readSessionToken, writeSessionToken } from '../services/api/sessionStore';

export type Role = 'administrador' | 'tecnico' | 'consulta';

export type Tecnico = { id: string; nombre: string; email: string | null; rol: Role };
export type CodigoInfo = { expiraEn: string; diasRestantes: number; aviso: number | null } | null;

type Profile = { tecnico: Tecnico; codigo: CodigoInfo; sessionExpiresAt?: string };

type AuthContextValue = {
  status: 'loading' | 'signedOut' | 'signedIn';
  tecnico: Tecnico | null;
  codigo: CodigoInfo;
  sessionExpiresAt: string | null;
  isAdmin: boolean;
  canWrite: boolean;
  login: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  renewCode: () => Promise<{ code: string; expiraEn: string }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthContextValue['status']>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);

  const applyProfile = useCallback((p: Profile) => {
    setProfile(p);
    setStatus('signedIn');
  }, []);

  const signOutLocal = useCallback(() => {
    setProfile(null);
    setStatus('signedOut');
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(signOutLocal);
    return () => setUnauthorizedHandler(null);
  }, [signOutLocal]);

  const refresh = useCallback(async () => {
    const p = await callApi<Profile>('auth.me');
    applyProfile(p);
  }, [applyProfile]);

  useEffect(() => {
    let active = true;
    (async () => {
      const token = await readSessionToken();
      if (!token) {
        if (active) setStatus('signedOut');
        return;
      }
      try {
        const p = await callApi<Profile>('auth.me', {}, { token });
        if (active) applyProfile(p);
      } catch (e) {
        // Sin red mantenemos el token (la sesión puede seguir siendo válida); con rechazo ya se limpió.
        if (active) setStatus('signedOut');
      }
    })();
    return () => {
      active = false;
    };
  }, [applyProfile]);

  const login = useCallback(
    async (code: string) => {
      const res = await callApi<Profile & { token: string }>('auth.login', { code }, { token: null });
      await writeSessionToken(res.token);
      applyProfile({ tecnico: res.tecnico, codigo: res.codigo, sessionExpiresAt: res.sessionExpiresAt });
    },
    [applyProfile]
  );

  const logout = useCallback(async () => {
    try {
      await callApi('auth.logout');
    } catch {
      // Aunque el servidor no responda, la sesión local se cierra.
    }
    await clearSessionToken();
    signOutLocal();
  }, [signOutLocal]);

  const renewCode = useCallback(async () => {
    const res = await callApi<{ code: string; expiraEn: string }>('auth.renew');
    await refresh();
    return res;
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      tecnico: profile?.tecnico ?? null,
      codigo: profile?.codigo ?? null,
      sessionExpiresAt: profile?.sessionExpiresAt ?? null,
      isAdmin: profile?.tecnico.rol === 'administrador',
      canWrite: profile?.tecnico.rol === 'administrador' || profile?.tecnico.rol === 'tecnico',
      login,
      logout,
      refresh,
      renewCode,
    }),
    [status, profile, login, logout, refresh, renewCode]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
