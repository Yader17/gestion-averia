import { useEffect, useState } from 'react';
import Constants from 'expo-constants';
import { callApi, isBackendConfigured } from './apiClient';

// Contacto del administrador (configurable desde Administración). Es público por diseño.
export function useSupportContact(): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as { supportContact?: string };
  const [contact, setContact] = useState(extra.supportContact?.trim() ?? '');

  useEffect(() => {
    if (!isBackendConfigured()) return;
    let active = true;
    callApi<{ contacto: string }>('config.public', {}, { token: null })
      .then((r) => {
        if (active && r.contacto) setContact(r.contacto);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return contact;
}
