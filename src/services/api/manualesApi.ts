import { callApi } from './apiClient';
import { readPhotoUriAsBytes } from '../photoService';
import { Linking } from 'react-native';

export const MAX_MANUAL_BYTES = 20 * 1024 * 1024;

export type TechnicalManual = {
  id: string;
  titulo: string;
  equipo: string;
  nombre_archivo: string;
  tamano_bytes: number;
  estado: 'pendiente' | 'listo' | 'error';
  paginas: number;
  error_indexacion: string | null;
  subido_por_nombre: string | null;
  creado_en: string;
  indexado_en: string | null;
};

export type ManualAsset = {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
};

export async function uploadTechnicalManual(
  asset: ManualAsset,
  titulo: string,
  equipo: string
): Promise<void> {
  if (!asset.name.toLowerCase().endsWith('.pdf') || (asset.mimeType && asset.mimeType !== 'application/pdf')) {
    throw new Error('Selecciona un archivo PDF.');
  }
  const bytes = await readPhotoUriAsBytes(asset.uri);
  const size = bytes.byteLength;
  if (!Number.isSafeInteger(size) || size < 8 || size > MAX_MANUAL_BYTES) {
    throw new Error('El PDF debe pesar como máximo 20 MB.');
  }
  if (asset.size && asset.size !== size) throw new Error('El archivo cambió mientras se preparaba la subida. Selecciónalo de nuevo.');

  const prepared = await callApi<{ id: string; path: string; signedUrl: string }>('manuales.preparar', {
    titulo,
    equipo,
    nombreArchivo: asset.name,
    tamanoBytes: size,
  });

  let uploaded = false;
  try {
    const response = await fetch(prepared.signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      body: bytes as unknown as BodyInit,
    });
    if (!response.ok) throw new Error('No se pudo subir el PDF. Comprueba la conexión e inténtalo otra vez.');
    uploaded = true;
    await callApi('manuales.indexar', { id: prepared.id });
  } catch (error) {
    if (!uploaded) {
      try {
        await callApi('manuales.eliminar', { id: prepared.id });
      } catch (cleanupError) {
        console.error('No se pudo limpiar el manual pendiente:', cleanupError);
      }
    }
    throw error;
  }
}

export async function listTechnicalManuals(): Promise<TechnicalManual[]> {
  const result = await callApi<{ manuales: TechnicalManual[] }>('manuales.list');
  return result.manuales;
}

export async function openTechnicalManual(id: string, page = 1): Promise<void> {
  const result = await callApi<{ url: string }>('manuales.abrir', { id });
  const separator = result.url.includes('#') ? '&' : '#';
  await Linking.openURL(`${result.url}${separator}page=${Math.max(1, Math.floor(page))}`);
}
