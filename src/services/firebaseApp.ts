import Constants from 'expo-constants';
import { FirebaseApp, FirebaseOptions, getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { Firestore, getFirestore, initializeFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';

type CloudSyncExtraConfig = {
  firebaseApiKey?: string;
  firebaseAuthDomain?: string;
  firebaseProjectId?: string;
  firebaseStorageBucket?: string;
  firebaseMessagingSenderId?: string;
  firebaseAppId?: string;
  workspaceId?: string;
  photoSyncEnabled?: boolean;
};

type CloudSyncRuntimeConfig = {
  firebaseOptions: FirebaseOptions;
  workspaceId: string;
  photoSyncEnabled: boolean;
};

const DEFAULT_CLOUD_SYNC_CONFIG: Required<CloudSyncExtraConfig> = {
  firebaseApiKey: 'AIzaSyAHGL3Ou0g-NkOSH5kO1iFY5ZzTh7uZCrs',
  firebaseAuthDomain: 'averias-2026yj.firebaseapp.com',
  firebaseProjectId: 'averias-2026yj',
  firebaseStorageBucket: 'averias-2026yj.firebasestorage.app',
  firebaseMessagingSenderId: '987360820448',
  firebaseAppId: '1:987360820448:web:01e5228f87ec6e1274a485',
  workspaceId: 'averias-2026yj',
  photoSyncEnabled: false,
};

let firestoreInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;

export function isCloudSyncConfigured(): boolean {
  return getCloudSyncRuntimeConfig() !== null;
}

export function getCloudSyncWorkspaceId(): string | null {
  return getCloudSyncRuntimeConfig()?.workspaceId ?? null;
}

export function isCloudPhotoSyncEnabled(): boolean {
  return getCloudSyncRuntimeConfig()?.photoSyncEnabled ?? false;
}

export function getFirebaseAppClient(): FirebaseApp | null {
  const config = getCloudSyncRuntimeConfig();
  if (!config) {
    return null;
  }

  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp(config.firebaseOptions);
}

export function getFirestoreClient(): Firestore | null {
  const app = getFirebaseAppClient();
  if (!app) {
    return null;
  }

  if (firestoreInstance) {
    return firestoreInstance;
  }

  try {
    firestoreInstance = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    });
  } catch {
    firestoreInstance = getFirestore(app);
  }

  return firestoreInstance;
}

export function getStorageClient(): FirebaseStorage | null {
  if (!isCloudPhotoSyncEnabled()) {
    return null;
  }

  const app = getFirebaseAppClient();
  if (!app) {
    return null;
  }

  if (!storageInstance) {
    storageInstance = getStorage(app);
  }

  return storageInstance;
}

export async function ensureFirebaseSession(): Promise<boolean> {
  const app = getFirebaseAppClient();
  if (!app) {
    return false;
  }

  const auth = getAuth(app);
  if (auth.currentUser) {
    return true;
  }

  await signInAnonymously(auth);
  return true;
}

function getCloudSyncRuntimeConfig(): CloudSyncRuntimeConfig | null {
  const extra = ((Constants.expoConfig?.extra ?? {}) as { cloudSync?: CloudSyncExtraConfig }).cloudSync;
  const resolvedConfig = {
    ...DEFAULT_CLOUD_SYNC_CONFIG,
    ...(extra ?? {}),
  } satisfies CloudSyncExtraConfig;

  const apiKey = sanitize(resolvedConfig.firebaseApiKey);
  const authDomain = sanitize(resolvedConfig.firebaseAuthDomain);
  const projectId = sanitize(resolvedConfig.firebaseProjectId);
  const storageBucket = sanitize(resolvedConfig.firebaseStorageBucket);
  const messagingSenderId = sanitize(resolvedConfig.firebaseMessagingSenderId);
  const appId = sanitize(resolvedConfig.firebaseAppId);
  const workspaceId = sanitize(resolvedConfig.workspaceId);

  if (!apiKey || !authDomain || !projectId || !storageBucket || !messagingSenderId || !appId || !workspaceId) {
    return null;
  }

  return {
    firebaseOptions: {
      apiKey,
      authDomain,
      projectId,
      storageBucket,
      messagingSenderId,
      appId,
    },
    workspaceId,
    photoSyncEnabled: resolvedConfig.photoSyncEnabled === true,
  };
}

function sanitize(value?: string): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('__')) {
    return null;
  }

  return trimmed;
}