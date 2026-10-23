import AsyncStorage from '@react-native-async-storage/async-storage';
import { Averia, AveriaLocation, AveriaPhoto, getAveriaPhotos } from '../types/averia';

const STORAGE_KEYS = {
  AVERIAS: '@gestion_averias/data',
  CUSTOM_INTERVENCION_TYPES: '@gestion_averias/custom_intervencion',
  CUSTOM_AVERIA_TYPES: '@gestion_averias/custom_averia_types',
  LOCATION_CACHE: '@gestion_averias/location_cache',
} as const;

export async function saveAverias(averias: Averia[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.AVERIAS, JSON.stringify(averias));
}

export async function loadAverias(): Promise<Averia[]> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.AVERIAS);
  if (!data) return [];
  try {
    const parsed = JSON.parse(data) as Averia[];
    return parsed.map(normalizeAveria);
  } catch {
    return [];
  }
}

export async function clearAverias(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEYS.AVERIAS);
}

export async function saveCustomIntervencionTypes(types: string[]): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEYS.CUSTOM_INTERVENCION_TYPES,
    JSON.stringify(types)
  );
}

export async function loadCustomIntervencionTypes(): Promise<string[]> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.CUSTOM_INTERVENCION_TYPES);
  if (!data) return [];
  try {
    return JSON.parse(data) as string[];
  } catch {
    return [];
  }
}

export async function saveCustomAveriaTypes(types: string[]): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEYS.CUSTOM_AVERIA_TYPES,
    JSON.stringify(types)
  );
}

export async function loadCustomAveriaTypes(): Promise<string[]> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.CUSTOM_AVERIA_TYPES);
  if (!data) return [];
  try {
    return JSON.parse(data) as string[];
  } catch {
    return [];
  }
}

export async function saveLocationCache(
  cache: Record<string, AveriaLocation>
): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.LOCATION_CACHE, JSON.stringify(cache));
}

export async function loadLocationCache(): Promise<Record<string, AveriaLocation>> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.LOCATION_CACHE);
  if (!data) {
    return {};
  }

  try {
    const parsed = JSON.parse(data) as Record<string, AveriaLocation>;
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([key, value]) => [key, normalizeLocation(value)])
        .filter((entry): entry is [string, AveriaLocation] => entry[1] !== null)
    );
  } catch {
    return {};
  }
}

// Geocoding cache only: regenerated on demand, never touches fault records.
export async function clearLocationCache(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEYS.LOCATION_CACHE);
}

function normalizeAveria(averia: Averia): Averia {
  return {
    ...averia,
    ubicacion: normalizeLocation(averia.ubicacion),
    fotos: getAveriaPhotos(averia)
      .filter(isValidPhoto)
      .map((photo) => ({
        ...photo,
        fileName: photo.fileName || 'foto.jpg',
        mimeType: photo.mimeType || 'image/jpeg',
      })),
  };
}

function isValidPhoto(photo: AveriaPhoto): boolean {
  return Boolean(photo?.id && photo?.uri);
}

function normalizeLocation(location: Averia['ubicacion']): AveriaLocation | null {
  if (!location) {
    return null;
  }

  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    latitude,
    longitude,
    displayName: String(location.displayName || '').trim() || 'Ubicación sin nombre',
  };
}
