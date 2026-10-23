import { useState, useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Averia, AveriaFormData, AveriaPhoto } from '../types/averia';
import { generateId } from '../utils/idGenerator';
import { ApiError, callApi, describeApiError } from '../services/api/apiClient';
import { readPhotoUriAsBytes } from '../services/photoService';

// Copia de lectura del servidor. NO es la clave de datos antigua (@gestion_averias/data),
// que se conserva intacta hasta que el administrador complete la migración.
const CACHE_KEY = '@gestion_averias/cache_v2';
const POLL_INTERVAL_MS = 30_000;
const IMPORT_BATCH = 200;

type UseAveriasReturn = {
  averias: Averia[];
  isLoaded: boolean;
  cloudSyncError: string | null;
  lastSyncAt: number | null;
  refresh: () => Promise<void>;
  addAveria: (formData: AveriaFormData) => Promise<void>;
  updateAveria: (id: string, formData: AveriaFormData) => Promise<void>;
  deleteAveria: (id: string) => Promise<void>;
  setAverias: (averias: Averia[]) => Promise<void>;
  clearAverias: () => Promise<void>;
};

type ServerPhoto = AveriaPhoto & { storagePath?: string; remoteUrl?: string };
type ServerAveria = Omit<Averia, 'fotos'> & { fotos: ServerPhoto[] };

function fromServer(row: ServerAveria): Averia {
  return {
    ...row,
    fotos: (row.fotos ?? []).map((f) => ({ ...f, uri: f.remoteUrl ?? f.uri ?? '' })),
  };
}

function normalizeMime(mime: string): string {
  const m = (mime || '').toLowerCase().replace('image/jpg', 'image/jpeg');
  return ['image/jpeg', 'image/png', 'image/webp', 'image/heic'].includes(m) ? m : 'image/jpeg';
}

// Sube al almacén privado las fotos que solo existen en el dispositivo.
async function uploadPendingPhotos(photos: AveriaPhoto[]): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (const photo of photos) {
    const meta = { id: photo.id, fileName: photo.fileName, mimeType: photo.mimeType, width: photo.width, height: photo.height };
    if (photo.storagePath) {
      out.push({ ...meta, storagePath: photo.storagePath });
      continue;
    }
    if (/^https:\/\//i.test(photo.uri)) {
      out.push({ ...meta, remoteUrl: photo.uri });
      continue;
    }
    const mimeType = normalizeMime(photo.mimeType);
    const slot = await callApi<{ path: string; signedUrl: string }>('fotos.subir', { fileName: photo.fileName, mimeType });
    const bytes = await readPhotoUriAsBytes(photo.uri);
    const put = await fetch(slot.signedUrl, { method: 'PUT', headers: { 'Content-Type': mimeType }, body: bytes as unknown as BodyInit });
    if (!put.ok) throw new Error('No se pudo subir una de las fotos. Inténtalo de nuevo.');
    out.push({ ...meta, mimeType, storagePath: slot.path });
  }
  return out;
}

const contentKey = (a: Averia) =>
  JSON.stringify([a.fecha, a.numeroBastidor, a.tipoAveria, a.intervencion, a.lugar, a.ubicacion ?? null, a.observacion, a.solucionado]);

async function toPayload(a: AveriaFormData | Averia, id?: string) {
  return {
    ...(id ? { id } : {}),
    fecha: a.fecha,
    numeroBastidor: a.numeroBastidor,
    tipoAveria: a.tipoAveria,
    intervencion: a.intervencion,
    lugar: a.lugar,
    ubicacion: a.ubicacion ?? null,
    observacion: a.observacion,
    solucionado: a.solucionado,
    fotos: await uploadPendingPhotos(a.fotos ?? []),
  };
}

export function useAverias(): UseAveriasReturn {
  const [averias, setAveriasState] = useState<Averia[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const ref = useRef<Averia[]>([]);
  const busyRef = useRef(false);

  const commit = useCallback((next: Averia[]) => {
    ref.current = next;
    setAveriasState(next);
    void AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next)).catch(() => undefined);
  }, []);

  const refresh = useCallback(async () => {
    if (busyRef.current) return;
    try {
      const { averias: rows } = await callApi<{ averias: ServerAveria[] }>('averias.list');
      commit(rows.map(fromServer));
      setCloudSyncError(null);
      setLastSyncAt(Date.now());
    } catch (e) {
      if (!(e instanceof ApiError && e.code === 'invalid_session')) setCloudSyncError(describeApiError(e));
    }
  }, [commit]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached && active) {
          const parsed = JSON.parse(cached) as Averia[];
          ref.current = parsed;
          setAveriasState(parsed);
        }
      } catch {
        // Caché ilegible: se ignora y se recarga del servidor.
      }
      await refresh();
      if (active) setIsLoaded(true);
    })();

    const timer = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refresh();
    });
    return () => {
      active = false;
      clearInterval(timer);
      sub.remove();
    };
  }, [refresh]);

  const guarded = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    busyRef.current = true;
    try {
      const result = await fn();
      setCloudSyncError(null);
      return result;
    } finally {
      busyRef.current = false;
    }
  }, []);

  const addAveria = useCallback(
    async (formData: AveriaFormData) => {
      await guarded(async () => {
        const { averia } = await callApi<{ averia: ServerAveria }>('averias.create', { averia: await toPayload(formData, generateId()) });
        commit([fromServer(averia), ...ref.current]);
      });
    },
    [commit, guarded]
  );

  const updateAveria = useCallback(
    async (id: string, formData: AveriaFormData) => {
      const current = ref.current.find((a) => a.id === id);
      if (!current) throw new Error('La avería ya no existe.');
      try {
        await guarded(async () => {
          const { averia } = await callApi<{ averia: ServerAveria }>('averias.update', {
            id,
            expectedVersion: current.version ?? 1,
            changes: await toPayload(formData),
          });
          commit(ref.current.map((a) => (a.id === id ? fromServer(averia) : a)));
        });
      } catch (e) {
        if (e instanceof ApiError && e.code === 'conflict') {
          await refresh();
          throw new Error('Otra persona modificó esta avería mientras la editabas. Se han cargado sus cambios; revisa la ficha y vuelve a aplicar los tuyos.');
        }
        throw e;
      }
    },
    [commit, guarded, refresh]
  );

  const deleteAveria = useCallback(
    async (id: string) => {
      const current = ref.current.find((a) => a.id === id);
      try {
        await guarded(async () => {
          await callApi('averias.delete', { id, expectedVersion: current?.version });
          commit(ref.current.filter((a) => a.id !== id));
        });
      } catch (e) {
        if (e instanceof ApiError && e.code === 'conflict') {
          await refresh();
          throw new Error('Otra persona modificó esta avería. Revisa los cambios antes de eliminarla.');
        }
        throw e;
      }
    },
    [commit, guarded, refresh]
  );

  // Fusiona: añade los registros nuevos y actualiza los existentes que cambiaron. Nunca elimina.
  const setAverias = useCallback(
    async (incoming: Averia[]) => {
      try {
        await guarded(async () => {
          const byId = new Map(ref.current.map((a) => [a.id, a]));
          const toCreate = incoming.filter((a) => !byId.has(a.id));
          const toUpdate = incoming.filter((a) => {
            const c = byId.get(a.id);
            return c && contentKey(c) !== contentKey(a);
          });

          for (let i = 0; i < toCreate.length; i += IMPORT_BATCH) {
            const batch = await Promise.all(toCreate.slice(i, i + IMPORT_BATCH).map((a) => toPayload(a, a.id)));
            await callApi('averias.import', { averias: batch, origen: 'importacion' });
          }
          for (const a of toUpdate) {
            const c = byId.get(a.id)!;
            try {
              await callApi('averias.update', {
                id: a.id,
                expectedVersion: c.version ?? 1,
                changes: await toPayload({ ...a, fotos: a.fotos?.length ? a.fotos : c.fotos ?? [] }),
              });
            } catch (e) {
              if (!(e instanceof ApiError && e.code === 'conflict')) throw e;
            }
          }
        });
      } catch (e) {
        setCloudSyncError(describeApiError(e));
        throw e;
      }
      await refresh();
    },
    [guarded, refresh]
  );

  const clearAverias = useCallback(async () => {
    await guarded(async () => {
      await callApi('averias.vaciar', { confirm: 'VACIAR' });
      commit([]);
    });
  }, [commit, guarded]);

  return { averias, isLoaded, cloudSyncError, lastSyncAt, refresh, addAveria, updateAveria, deleteAveria, setAverias, clearAverias };
}
