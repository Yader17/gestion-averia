import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { Averia, AveriaPhoto, getAveriaPhotos } from '../types/averia';
import {
  ensureFirebaseSession,
  isCloudPhotoSyncEnabled,
  getCloudSyncWorkspaceId,
  getFirestoreClient,
  getStorageClient,
  isCloudSyncConfigured,
} from './firebaseApp';
import { readPhotoUriAsBytes } from './photoService';

type CloudSettings = {
  customIntervencionTypes: string[];
};

type CloudAveriaPayload = Omit<Averia, 'id'>;

const SETTINGS_DOC_ID = 'shared';

export async function subscribeToCloudAverias(
  onChange: (averias: Averia[]) => void,
  onError?: (error: unknown) => void
): Promise<() => void> {
  if (!isCloudSyncConfigured()) {
    return () => undefined;
  }

  const ready = await ensureFirebaseSession();
  const firestore = getFirestoreClient();
  const workspaceId = getCloudSyncWorkspaceId();

  if (!ready || !firestore || !workspaceId) {
    return () => undefined;
  }

  const averiasQuery = query(collection(firestore, 'workspaces', workspaceId, 'averias'));

  return onSnapshot(
    averiasQuery,
    (snapshot) => {
      const averias = snapshot.docs.map((entry) =>
        deserializeCloudAveria(entry.id, entry.data() as Partial<CloudAveriaPayload>)
      );
      onChange(averias);
    },
    (error) => {
      onError?.(error);
    }
  );
}

export async function subscribeToCloudSettings(
  onChange: (settings: CloudSettings) => void,
  onError?: (error: unknown) => void
): Promise<() => void> {
  if (!isCloudSyncConfigured()) {
    return () => undefined;
  }

  const ready = await ensureFirebaseSession();
  const firestore = getFirestoreClient();
  const workspaceId = getCloudSyncWorkspaceId();

  if (!ready || !firestore || !workspaceId) {
    return () => undefined;
  }

  const settingsRef = doc(firestore, 'workspaces', workspaceId, 'settings', SETTINGS_DOC_ID);
  return onSnapshot(
    settingsRef,
    (snapshot) => {
      const payload = snapshot.data() as Partial<CloudSettings> | undefined;
      onChange({
        customIntervencionTypes: Array.isArray(payload?.customIntervencionTypes)
          ? payload?.customIntervencionTypes.filter((item): item is string => typeof item === 'string').sort()
          : [],
      });
    },
    (error) => {
      onError?.(error);
    }
  );
}

export async function saveCloudCustomIntervencionTypes(types: string[]): Promise<void> {
  if (!isCloudSyncConfigured()) {
    return;
  }

  const ready = await ensureFirebaseSession();
  const firestore = getFirestoreClient();
  const workspaceId = getCloudSyncWorkspaceId();

  if (!ready || !firestore || !workspaceId) {
    return;
  }

  const settingsRef = doc(firestore, 'workspaces', workspaceId, 'settings', SETTINGS_DOC_ID);
  await setDoc(
    settingsRef,
    {
      customIntervencionTypes: [...types].sort(),
    },
    { merge: true }
  );
}

export async function upsertCloudAveria(
  averia: Averia,
  previousAveria?: Averia | null
): Promise<Averia> {
  if (!isCloudSyncConfigured()) {
    return averia;
  }

  const ready = await ensureFirebaseSession();
  const firestore = getFirestoreClient();
  const workspaceId = getCloudSyncWorkspaceId();

  if (!ready || !firestore || !workspaceId) {
    return averia;
  }

  const syncedAveria = await uploadAveriaPhotos(averia, workspaceId);
  const averiaRef = doc(firestore, 'workspaces', workspaceId, 'averias', averia.id);

  await setDoc(averiaRef, serializeCloudAveria(syncedAveria), { merge: true });
  await deleteStoragePaths(getRemovedStoragePaths(previousAveria ?? null, syncedAveria));

  return syncedAveria;
}

export async function replaceCloudAverias(averias: Averia[]): Promise<Averia[]> {
  if (!isCloudSyncConfigured()) {
    return averias;
  }

  const ready = await ensureFirebaseSession();
  const firestore = getFirestoreClient();
  const workspaceId = getCloudSyncWorkspaceId();

  if (!ready || !firestore || !workspaceId) {
    return averias;
  }

  const syncedAverias: Averia[] = [];
  for (const averia of averias) {
    syncedAverias.push(await uploadAveriaPhotos(averia, workspaceId));
  }

  const collectionRef = collection(firestore, 'workspaces', workspaceId, 'averias');
  const existingSnapshot = await getDocs(collectionRef);
  const nextIds = new Set(syncedAverias.map((item) => item.id));

  const batch = writeBatch(firestore);
  const removedStoragePaths: string[] = [];

  existingSnapshot.docs.forEach((entry) => {
    if (!nextIds.has(entry.id)) {
      batch.delete(entry.ref);
      removedStoragePaths.push(...getStoragePathsFromPayload(entry.data() as Partial<CloudAveriaPayload>));
    }
  });

  syncedAverias.forEach((averia) => {
    const averiaRef = doc(firestore, 'workspaces', workspaceId, 'averias', averia.id);
    batch.set(averiaRef, serializeCloudAveria(averia), { merge: true });
  });

  await batch.commit();
  await deleteStoragePaths(removedStoragePaths);

  return syncedAverias;
}

export async function deleteCloudAveria(averia: Averia): Promise<void> {
  if (!isCloudSyncConfigured()) {
    return;
  }

  const ready = await ensureFirebaseSession();
  const firestore = getFirestoreClient();
  const workspaceId = getCloudSyncWorkspaceId();

  if (!ready || !firestore || !workspaceId) {
    return;
  }

  const averiaRef = doc(firestore, 'workspaces', workspaceId, 'averias', averia.id);
  await deleteDoc(averiaRef);
  await deleteStoragePaths(getStoragePathsFromAveria(averia));
}

export async function clearCloudAverias(): Promise<void> {
  if (!isCloudSyncConfigured()) {
    return;
  }

  const ready = await ensureFirebaseSession();
  const firestore = getFirestoreClient();
  const workspaceId = getCloudSyncWorkspaceId();

  if (!ready || !firestore || !workspaceId) {
    return;
  }

  const collectionRef = collection(firestore, 'workspaces', workspaceId, 'averias');
  const snapshot = await getDocs(collectionRef);
  const batch = writeBatch(firestore);
  const storagePaths: string[] = [];

  snapshot.docs.forEach((entry) => {
    batch.delete(entry.ref);
    storagePaths.push(...getStoragePathsFromPayload(entry.data() as Partial<CloudAveriaPayload>));
  });

  await batch.commit();
  await deleteStoragePaths(storagePaths);
}

async function uploadAveriaPhotos(averia: Averia, workspaceId: string): Promise<Averia> {
  const photos = getAveriaPhotos(averia);
  if (photos.length === 0) {
    return averia;
  }

  const storage = getStorageClient();
  if (!storage) {
    return averia;
  }

  const syncedPhotos: AveriaPhoto[] = [];
  for (const photo of photos) {
    if (photo.storagePath && photo.remoteUrl) {
      syncedPhotos.push(photo);
      continue;
    }

    const extension = inferRemoteExtension(photo);
    const storagePath = photo.storagePath || `workspaces/${workspaceId}/averias/${averia.id}/${photo.id}.${extension}`;
    const bytes = await readPhotoUriAsBytes(photo.remoteUrl || photo.uri);
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, bytes, {
      contentType: photo.mimeType || `image/${extension}`,
    });
    const remoteUrl = await getDownloadURL(storageRef);

    syncedPhotos.push({
      ...photo,
      remoteUrl,
      storagePath,
    });
  }

  return {
    ...averia,
    fotos: syncedPhotos,
  };
}

function serializeCloudAveria(averia: Averia): CloudAveriaPayload {
  const shouldSyncPhotos = isCloudPhotoSyncEnabled();

  return {
    fecha: averia.fecha,
    numeroBastidor: averia.numeroBastidor,
    tipoAveria: averia.tipoAveria,
    intervencion: averia.intervencion,
    lugar: averia.lugar,
    ubicacion: averia.ubicacion ?? null,
    observacion: averia.observacion,
    solucionado: averia.solucionado,
    fotos: shouldSyncPhotos
      ? getAveriaPhotos(averia).map((photo) => ({
          ...photo,
          uri: photo.remoteUrl || photo.uri,
        }))
      : [],
  };
}

function deserializeCloudAveria(id: string, payload: Partial<CloudAveriaPayload>): Averia {
  return {
    id,
    fecha: String(payload.fecha || ''),
    numeroBastidor: String(payload.numeroBastidor || ''),
    tipoAveria: (payload.tipoAveria as Averia['tipoAveria']) || 'Otro',
    intervencion: String(payload.intervencion || ''),
    lugar: String(payload.lugar || ''),
    ubicacion: payload.ubicacion ?? null,
    observacion: String(payload.observacion || ''),
    solucionado: Boolean(payload.solucionado),
    fotos: Array.isArray(payload.fotos)
      ? payload.fotos
          .filter((item): item is AveriaPhoto => Boolean(item && typeof item === 'object'))
          .map((photo) => ({
            id: String(photo.id || ''),
            uri: String(photo.remoteUrl || photo.uri || ''),
            remoteUrl: typeof photo.remoteUrl === 'string' ? photo.remoteUrl : undefined,
            storagePath: typeof photo.storagePath === 'string' ? photo.storagePath : undefined,
            fileName: String(photo.fileName || 'foto.jpg'),
            mimeType: String(photo.mimeType || 'image/jpeg'),
            width: Number.isFinite(photo.width) ? Number(photo.width) : undefined,
            height: Number.isFinite(photo.height) ? Number(photo.height) : undefined,
          }))
      : [],
  };
}

async function deleteStoragePaths(storagePaths: string[]): Promise<void> {
  const storage = getStorageClient();
  if (!storage || storagePaths.length === 0) {
    return;
  }

  const uniquePaths = Array.from(new Set(storagePaths.filter(Boolean)));
  await Promise.all(
    uniquePaths.map(async (storagePath) => {
      try {
        await deleteObject(ref(storage, storagePath));
      } catch {
        // Ignore missing cloud files to keep record deletion resilient.
      }
    })
  );
}

function getRemovedStoragePaths(previousAveria: Averia | null, nextAveria: Averia): string[] {
  if (!previousAveria) {
    return [];
  }

  const nextPhotoIds = new Set(getAveriaPhotos(nextAveria).map((photo) => photo.id));
  return getAveriaPhotos(previousAveria)
    .filter((photo) => !nextPhotoIds.has(photo.id))
    .map((photo) => photo.storagePath)
    .filter((path): path is string => Boolean(path));
}

function getStoragePathsFromAveria(averia: Averia): string[] {
  return getAveriaPhotos(averia)
    .map((photo) => photo.storagePath)
    .filter((path): path is string => Boolean(path));
}

function getStoragePathsFromPayload(payload: Partial<CloudAveriaPayload>): string[] {
  if (!Array.isArray(payload.fotos)) {
    return [];
  }

  return payload.fotos
    .map((photo) => photo?.storagePath)
    .filter((path): path is string => typeof path === 'string' && path.length > 0);
}

function inferRemoteExtension(photo: AveriaPhoto): string {
  const fileNameMatch = photo.fileName.match(/\.([a-zA-Z0-9]+)$/);
  if (fileNameMatch) {
    return fileNameMatch[1].toLowerCase();
  }

  const mimeMatch = photo.mimeType.match(/image\/(.+)$/);
  if (mimeMatch) {
    return mimeMatch[1].toLowerCase();
  }

  return 'jpg';
}