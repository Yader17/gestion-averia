import { Platform } from 'react-native';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { AveriaPhoto } from '../types/averia';
import { generateId } from '../utils/idGenerator';

const PHOTO_DIRECTORY = LegacyFileSystem.documentDirectory
  ? `${LegacyFileSystem.documentDirectory}averia-photos/`
  : null;

export async function persistAveriaPhotos(
  photos: AveriaPhoto[]
): Promise<AveriaPhoto[]> {
  if (Platform.OS === 'web' || !PHOTO_DIRECTORY) {
    return photos;
  }

  await ensurePhotoDirectory();

  const persistedPhotos: AveriaPhoto[] = [];

  for (const photo of photos) {
    if (
      photo.uri.startsWith(PHOTO_DIRECTORY) ||
      photo.uri.startsWith('data:') ||
      isRemoteUri(photo.uri)
    ) {
      persistedPhotos.push(photo);
      continue;
    }

    const extension = inferExtension(photo);
    const nextFileName = `${generateId()}.${extension}`;
    const destination = `${PHOTO_DIRECTORY}${nextFileName}`;

    await LegacyFileSystem.copyAsync({
      from: photo.uri,
      to: destination,
    });

    persistedPhotos.push({
      ...photo,
      uri: destination,
      fileName: nextFileName,
      mimeType: photo.mimeType || `image/${extension}`,
    });
  }

  return persistedPhotos;
}

export async function deleteAveriaPhotos(photos: AveriaPhoto[]): Promise<void> {
  if (Platform.OS === 'web' || !PHOTO_DIRECTORY || photos.length === 0) {
    return;
  }

  await Promise.all(
    photos.map(async (photo) => {
      if (!photo.uri.startsWith(PHOTO_DIRECTORY)) {
        return;
      }

      try {
        const info = await LegacyFileSystem.getInfoAsync(photo.uri);
        if (info.exists) {
          await LegacyFileSystem.deleteAsync(photo.uri);
        }
      } catch {
        // Ignore cleanup failures to avoid blocking the main flow.
      }
    })
  );
}

export async function photoUriToDataUri(
  uri: string,
  mimeType: string
): Promise<string> {
  if (uri.startsWith('data:')) {
    return uri;
  }

  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    return blobToDataUri(blob);
  }

  if (isRemoteUri(uri)) {
    const response = await fetch(uri);
    const buffer = await response.arrayBuffer();
    return `data:${mimeType || 'image/jpeg'};base64,${uint8ArrayToBase64(new Uint8Array(buffer))}`;
  }

  const base64 = await LegacyFileSystem.readAsStringAsync(uri, {
    encoding: LegacyFileSystem.EncodingType.Base64,
  });

  return `data:${mimeType || 'image/jpeg'};base64,${base64}`;
}

export async function readPhotoUriAsBytes(uri: string): Promise<Uint8Array> {
  if (uri.startsWith('data:')) {
    const [, base64 = ''] = uri.split(',', 2);
    return base64ToUint8Array(base64);
  }

  if (Platform.OS === 'web' || isRemoteUri(uri)) {
    const response = await fetch(uri);
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }

  const base64 = await LegacyFileSystem.readAsStringAsync(uri, {
    encoding: LegacyFileSystem.EncodingType.Base64,
  });

  return base64ToUint8Array(base64);
}

async function ensurePhotoDirectory(): Promise<void> {
  if (!PHOTO_DIRECTORY) {
    return;
  }

  const info = await LegacyFileSystem.getInfoAsync(PHOTO_DIRECTORY);
  if (!info.exists) {
    await LegacyFileSystem.makeDirectoryAsync(PHOTO_DIRECTORY, {
      intermediates: true,
    });
  }
}

function inferExtension(photo: AveriaPhoto): string {
  const fileNameMatch = photo.fileName.match(/\.([a-zA-Z0-9]+)$/);
  if (fileNameMatch) {
    return fileNameMatch[1].toLowerCase();
  }

  const mimeMatch = photo.mimeType.match(/image\/(.+)$/);
  if (mimeMatch) {
    return mimeMatch[1].toLowerCase();
  }

  const uriMatch = photo.uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  if (uriMatch) {
    return uriMatch[1].toLowerCase();
  }

  return 'jpg';
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('No se pudo convertir la imagen.'));
    reader.readAsDataURL(blob);
  });
}

function isRemoteUri(uri: string): boolean {
  return /^https?:\/\//i.test(uri);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}