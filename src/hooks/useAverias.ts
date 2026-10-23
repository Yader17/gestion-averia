import { useState, useCallback, useEffect, useRef } from 'react';
import { Averia, AveriaFormData } from '../types/averia';
import { generateId } from '../utils/idGenerator';
import { saveAverias, loadAverias, clearAverias as clearStorage } from '../services/storageService';
import {
  clearCloudAverias,
  deleteCloudAveria,
  replaceCloudAverias,
  subscribeToCloudAverias,
  upsertCloudAveria,
} from '../services/cloudSyncService';
import { isCloudPhotoSyncEnabled, isCloudSyncConfigured } from '../services/firebaseApp';

type UseAveriasReturn = {
  averias: Averia[];
  isLoaded: boolean;
  cloudSyncError: string | null;
  addAveria: (formData: AveriaFormData) => Promise<void>;
  updateAveria: (id: string, formData: AveriaFormData) => Promise<void>;
  deleteAveria: (id: string) => Promise<void>;
  setAverias: (averias: Averia[]) => Promise<void>;
  clearAverias: () => Promise<void>;
};

export function useAverias(): UseAveriasReturn {
  const [averias, setAveriasState] = useState<Averia[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);
  const skipSaveRef = useRef(true);
  const averiasRef = useRef<Averia[]>([]);
  const hasSeededCloudRef = useRef(false);

  useEffect(() => {
    averiasRef.current = averias;
  }, [averias]);

  // Load persisted data on mount
  useEffect(() => {
    loadAverias().then((saved) => {
      if (saved.length > 0) {
        setAveriasState(saved);
        averiasRef.current = saved;
      }
      skipSaveRef.current = false;
      setIsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!isLoaded || !isCloudSyncConfigured()) {
      return;
    }

    let isActive = true;
    let unsubscribe: (() => void) | null = null;

    void subscribeToCloudAverias(
      async (remoteAverias) => {
        if (!isActive) {
          return;
        }

        setCloudSyncError(null);

        const nextRemoteAverias = isCloudPhotoSyncEnabled()
          ? remoteAverias
          : mergeRemoteAveriasWithLocalPhotos(remoteAverias, averiasRef.current);

        if (
          nextRemoteAverias.length === 0 &&
          averiasRef.current.length > 0 &&
          !hasSeededCloudRef.current
        ) {
          hasSeededCloudRef.current = true;

          try {
            const seededAverias = await replaceCloudAverias(averiasRef.current);
            if (!isActive) {
              return;
            }

            setCloudSyncError(null);
            setAveriasState(seededAverias);
            averiasRef.current = seededAverias;
            await saveAverias(seededAverias);
          } catch (error) {
            setCloudSyncError(getCloudSyncErrorMessage(error));
            console.error('Cloud seed failed:', error);
          }

          return;
        }

        setAveriasState(nextRemoteAverias);
        averiasRef.current = nextRemoteAverias;
        await saveAverias(nextRemoteAverias);
      },
      (error) => {
        setCloudSyncError(getCloudSyncErrorMessage(error));
        console.error('Cloud subscription error:', error);
      }
    ).then((nextUnsubscribe) => {
      if (!isActive) {
        nextUnsubscribe();
        return;
      }

      unsubscribe = nextUnsubscribe;
    });

    return () => {
      isActive = false;
      unsubscribe?.();
    };
  }, [isLoaded]);

  // Auto-save whenever averias change (skip initial load)
  useEffect(() => {
    if (skipSaveRef.current) return;
    void saveAverias(averias);
  }, [averias]);

  const addAveria = useCallback(async (formData: AveriaFormData) => {
    const newAveria: Averia = {
      ...formData,
      id: generateId(),
    };

    setAveriasState((prev) => {
      const next = [...prev, newAveria];
      averiasRef.current = next;
      return next;
    });

    if (!isCloudSyncConfigured()) {
      return;
    }

    try {
      const syncedAveria = await upsertCloudAveria(newAveria);
      setCloudSyncError(null);
      setAveriasState((prev) => replaceAveria(prev, syncedAveria));
      averiasRef.current = replaceAveria(averiasRef.current, syncedAveria);
    } catch (error) {
      setCloudSyncError(getCloudSyncErrorMessage(error));
      console.error('Cloud add sync failed:', error);
    }
  }, []);

  const updateAveria = useCallback(async (id: string, formData: AveriaFormData) => {
    const nextAveria: Averia = { ...formData, id };
    const previousAveria = averiasRef.current.find((item) => item.id === id) ?? null;

    setAveriasState((prev) => {
      const next = replaceAveria(prev, nextAveria);
      averiasRef.current = next;
      return next;
    });

    if (!isCloudSyncConfigured()) {
      return;
    }

    try {
      const syncedAveria = await upsertCloudAveria(nextAveria, previousAveria);
      setCloudSyncError(null);
      setAveriasState((prev) => replaceAveria(prev, syncedAveria));
      averiasRef.current = replaceAveria(averiasRef.current, syncedAveria);
    } catch (error) {
      setCloudSyncError(getCloudSyncErrorMessage(error));
      console.error('Cloud update sync failed:', error);
    }
  }, []);

  const deleteAveria = useCallback(async (id: string) => {
    const removedAveria = averiasRef.current.find((item) => item.id === id) ?? null;

    setAveriasState((prev) => {
      const next = prev.filter((averia) => averia.id !== id);
      averiasRef.current = next;
      return next;
    });

    if (!isCloudSyncConfigured() || !removedAveria) {
      return;
    }

    try {
      await deleteCloudAveria(removedAveria);
      setCloudSyncError(null);
    } catch (error) {
      setCloudSyncError(getCloudSyncErrorMessage(error));
      console.error('Cloud delete sync failed:', error);
    }
  }, []);

  const setAverias = useCallback(async (newAverias: Averia[]) => {
    setAveriasState(newAverias);
    averiasRef.current = newAverias;

    if (!isCloudSyncConfigured()) {
      return;
    }

    try {
      const syncedAverias = await replaceCloudAverias(newAverias);
      setCloudSyncError(null);
      setAveriasState(syncedAverias);
      averiasRef.current = syncedAverias;
    } catch (error) {
      setCloudSyncError(getCloudSyncErrorMessage(error));
      console.error('Cloud replace sync failed:', error);
    }
  }, []);

  const clearAverias = useCallback(async () => {
    setAveriasState([]);
    averiasRef.current = [];
    await clearStorage();

    if (!isCloudSyncConfigured()) {
      return;
    }

    try {
      await clearCloudAverias();
      setCloudSyncError(null);
    } catch (error) {
      setCloudSyncError(getCloudSyncErrorMessage(error));
      console.error('Cloud clear sync failed:', error);
    }
  }, []);

  return {
    averias,
    isLoaded,
    cloudSyncError,
    addAveria,
    updateAveria,
    deleteAveria,
    setAverias,
    clearAverias,
  };
}

function replaceAveria(averias: Averia[], target: Averia): Averia[] {
  return averias.map((averia) => (averia.id === target.id ? target : averia));
}

function mergeRemoteAveriasWithLocalPhotos(remoteAverias: Averia[], localAverias: Averia[]): Averia[] {
  return remoteAverias.map((remoteAveria) => {
    if ((remoteAveria.fotos?.length ?? 0) > 0) {
      return remoteAveria;
    }

    const localAveria = localAverias.find((item) => item.id === remoteAveria.id);
    if (!localAveria || (localAveria.fotos?.length ?? 0) === 0) {
      return remoteAveria;
    }

    return {
      ...remoteAveria,
      fotos: localAveria.fotos,
    };
  });
}

function getCloudSyncErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : '';

  if (code === 'permission-denied') {
    return 'Firebase esta rechazando el acceso. Revisa las reglas de Firestore.';
  }

  if (code === 'auth/admin-restricted-operation' || code === 'auth/operation-not-allowed') {
    return 'Firebase no permite el acceso anonimo. Activa Anonymous Authentication.';
  }

  if (code === 'unavailable') {
    return 'No se pudo conectar con Firebase. Revisa la conexion a internet.';
  }

  return 'No se pudo sincronizar con Firebase.';
}
