import { Averia, AveriaLocation } from '../types/averia';
import { loadLocationCache, saveLocationCache } from './storageService';
import { Platform } from 'react-native';
import * as Location from 'expo-location';

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const PHOTON_SEARCH_URL = 'https://photon.komoot.io/api';
const REQUEST_TIMEOUT_MS = 8000;

export type GeocodingResult = AveriaLocation;

export type HydrateLocationsResult = {
  averias: Averia[];
  resolvedCount: number;
  unresolvedCount: number;
};

type NominatimItem = {
  addresstype?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
  };
  display_name?: string;
  importance?: number;
  lat?: string;
  lon?: string;
  name?: string;
  type?: string;
};

type PhotonFeature = {
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: {
    name?: string;
    city?: string;
    state?: string;
    country?: string;
    street?: string;
    housenumber?: string;
  };
};

type PhotonResponse = {
  features?: PhotonFeature[];
};

const inMemoryLocationCache = new Map<string, AveriaLocation>();
let cacheLoadPromise: Promise<void> | null = null;
let nativeGeocoderPermissionPromise: Promise<boolean> | null = null;
const LOCATION_CACHE_VERSION = 'v2';

export async function searchRealLocations(query: string): Promise<GeocodingResult[]> {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 3) {
    return [];
  }

  await ensureLocationCacheLoaded();
  const cacheKey = normalizeLocationKey(normalizedQuery);
  const cached = inMemoryLocationCache.get(cacheKey);
  if (cached) {
    return [cached];
  }

  let lastError: unknown = null;

  const providers = [
    () => searchWithNominatimStructured(normalizedQuery),
    () => searchWithNominatim(normalizedQuery),
    () => searchWithPhoton(normalizedQuery),
  ];

  for (const provider of providers) {
    try {
      const results = dedupeLocations(await provider());
      if (results.length > 0) {
        await rememberLocation(cacheKey, results[0]);
        return results;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (Platform.OS !== 'web') {
    try {
      const nativeResults = dedupeLocations(await searchWithNativeGeocoder(normalizedQuery));
      if (nativeResults.length > 0) {
        await rememberLocation(cacheKey, nativeResults[0]);
        return nativeResults;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw new Error(lastError.message);
  }

  throw new Error('No se pudo consultar el servicio de mapas.');
}

async function searchWithNativeGeocoder(query: string): Promise<GeocodingResult[]> {
  try {
    const hasPermission = await ensureNativeGeocoderPermission();
    if (!hasPermission) {
      return [];
    }

    const results = await Location.geocodeAsync(query);
    const mappedResults = await Promise.all(
      results.map(async (item) => {
        if (!Number.isFinite(item.latitude) || !Number.isFinite(item.longitude)) {
          return null;
        }

        const displayName = await buildNativeDisplayName(query, item.latitude, item.longitude);

        return {
          latitude: item.latitude,
          longitude: item.longitude,
          displayName,
        } satisfies GeocodingResult;
      })
    );

    return mappedResults.filter((item): item is GeocodingResult => item !== null);
  } catch (error) {
    if (error instanceof Error && error.message) {
      throw new Error(error.message);
    }

    throw new Error('No se pudo consultar el geocoder del dispositivo.');
  }
}

async function buildNativeDisplayName(
  fallbackQuery: string,
  latitude: number,
  longitude: number
): Promise<string> {
  try {
    const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
    const formatted = formatReverseGeocodedAddress(address);

    if (formatted) {
      return formatted;
    }
  } catch {
    return fallbackQuery;
  }

  return fallbackQuery;
}

function formatReverseGeocodedAddress(
  address: Location.LocationGeocodedAddress | null | undefined
): string {
  if (!address) {
    return '';
  }

  const parts = [
    address.city,
    address.subregion,
    address.region,
    address.country,
  ]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);

  return Array.from(new Set(parts)).join(', ');
}

async function ensureNativeGeocoderPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  if (!nativeGeocoderPermissionPromise) {
    nativeGeocoderPermissionPromise = (async () => {
      const current = await Location.getForegroundPermissionsAsync();
      if (current.granted) {
        return true;
      }

      if (!current.canAskAgain) {
        return false;
      }

      const requested = await Location.requestForegroundPermissionsAsync();
      return requested.granted;
    })().finally(() => {
      nativeGeocoderPermissionPromise = null;
    });
  }

  return nativeGeocoderPermissionPromise;
}

export async function hydrateAveriasLocations(
  averias: Averia[]
): Promise<HydrateLocationsResult> {
  const cache = new Map<string, AveriaLocation | null>();
  const uniquePlaces = Array.from(
    new Set(
      averias
        .filter((averia) => !averia.ubicacion)
        .map((averia) => averia.lugar.trim())
        .filter((lugar) => lugar.length >= 3)
    )
  );

  for (const lugar of uniquePlaces) {
    try {
      const [firstMatch] = await searchRealLocations(lugar);
      cache.set(lugar, firstMatch ?? null);
    } catch {
      cache.set(lugar, null);
    }
  }

  let resolvedCount = 0;
  let unresolvedCount = 0;

  const enriched = averias.map((averia) => {
    if (averia.ubicacion) {
      return averia;
    }

    const lugar = averia.lugar.trim();
    if (lugar.length < 3) {
      unresolvedCount += 1;
      return averia;
    }

    const location = cache.get(lugar) ?? null;
    if (!location) {
      unresolvedCount += 1;
      return averia;
    }

    resolvedCount += 1;
    return {
      ...averia,
      ubicacion: location,
    };
  });

  return {
    averias: enriched,
    resolvedCount,
    unresolvedCount,
  };
}

async function searchWithNominatim(query: string): Promise<GeocodingResult[]> {

  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '6',
    countrycodes: 'es,pt',
  });

  const response = await fetchWithTimeout(
    `${NOMINATIM_SEARCH_URL}?${params.toString()}`,
    buildRequestInit({
      Accept: 'application/json',
      'Accept-Language': 'es',
    })
  );

  if (!response.ok) {
    throw new Error('No se pudo consultar el servicio de mapas.');
  }

  const payload = (await response.json()) as NominatimItem[];
  return mapNominatimResults(payload, query);
}

async function searchWithNominatimStructured(query: string): Promise<GeocodingResult[]> {
  const params = new URLSearchParams({
    city: query,
    country: 'Spain',
    format: 'jsonv2',
    addressdetails: '1',
    limit: '6',
  });

  const response = await fetchWithTimeout(
    `${NOMINATIM_SEARCH_URL}?${params.toString()}`,
    buildRequestInit({
      Accept: 'application/json',
      'Accept-Language': 'es',
    })
  );

  if (!response.ok) {
    throw new Error('No se pudo consultar el servicio de mapas.');
  }

  const payload = (await response.json()) as NominatimItem[];
  return mapNominatimResults(payload, query);
}

async function searchWithPhoton(query: string): Promise<GeocodingResult[]> {
  const params = new URLSearchParams({
    q: query,
    lang: 'es',
    limit: '6',
  });

  const response = await fetchWithTimeout(
    `${PHOTON_SEARCH_URL}?${params.toString()}`,
    buildRequestInit({
      Accept: 'application/json',
    })
  );

  if (!response.ok) {
    throw new Error('No se pudo consultar el servicio de mapas.');
  }

  const payload = (await response.json()) as PhotonResponse;
  return (payload.features ?? [])
    .map((feature) => {
      const coordinates = feature.geometry?.coordinates;
      if (!coordinates || coordinates.length < 2) {
        return null;
      }

      const [longitude, latitude] = coordinates;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null;
      }

      const props = feature.properties;
      const displayName = [
        [props?.street, props?.housenumber].filter(Boolean).join(' ').trim(),
        props?.name,
        props?.city,
        props?.state,
        props?.country,
      ]
        .filter((value): value is string => Boolean(value && value.trim()))
        .join(', ');

      return {
        latitude,
        longitude,
        displayName: displayName || query,
      } satisfies GeocodingResult;
    })
    .filter((item): item is GeocodingResult => item !== null);
}

async function fetchWithTimeout(
  input: string,
  init?: RequestInit
): Promise<Response> {
  if (Platform.OS !== 'web') {
    return fetchWithTimeoutNative(input, init);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('La búsqueda de ubicación tardó demasiado. Inténtalo de nuevo.');
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWithTimeoutNative(
  input: string,
  init?: RequestInit
): Promise<Response> {
  const timeoutPromise = new Promise<Response>((_resolve, reject) => {
    setTimeout(() => {
      reject(new Error('La búsqueda de ubicación tardó demasiado. Inténtalo de nuevo.'));
    }, REQUEST_TIMEOUT_MS);
  });

  return Promise.race([
    fetch(input, init),
    timeoutPromise,
  ]);
}

async function ensureLocationCacheLoaded(): Promise<void> {
  if (cacheLoadPromise) {
    await cacheLoadPromise;
    return;
  }

  if (inMemoryLocationCache.size > 0) {
    return;
  }

  cacheLoadPromise = loadLocationCache()
    .then((cache) => {
      Object.entries(cache).forEach(([key, value]) => {
        inMemoryLocationCache.set(key, value);
      });
    })
    .finally(() => {
      cacheLoadPromise = null;
    });

  await cacheLoadPromise;
}

async function rememberLocation(
  cacheKey: string,
  location: AveriaLocation
): Promise<void> {
  inMemoryLocationCache.set(cacheKey, location);
  await saveLocationCache(Object.fromEntries(inMemoryLocationCache.entries()));
}

function normalizeLocationKey(value: string): string {
  return `${LOCATION_CACHE_VERSION}:${value.trim().toLowerCase()}`;
}

function buildRequestInit(headers: Record<string, string>): RequestInit | undefined {
  return {
    headers,
  };
}

function dedupeLocations(locations: GeocodingResult[]): GeocodingResult[] {
  const seen = new Set<string>();

  return locations.filter((location) => {
    const key = `${location.latitude.toFixed(6)}:${location.longitude.toFixed(6)}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function mapNominatimResults(
  payload: NominatimItem[],
  fallbackQuery: string
): GeocodingResult[] {
  return payload
    .map((item) => {
      const latitude = Number(item.lat);
      const longitude = Number(item.lon);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null;
      }

      return {
        latitude,
        longitude,
        displayName: formatNominatimDisplayName(item, fallbackQuery),
        score: scoreNominatimItem(item, fallbackQuery),
      };
    })
    .filter((item): item is GeocodingResult & { score: number } => item !== null)
    .sort((left, right) => right.score - left.score)
    .map(({ score: _score, ...location }) => location);
}

function formatNominatimDisplayName(item: NominatimItem, fallbackQuery: string): string {
  const cityName = firstNonEmpty(
    item.address?.city,
    item.address?.town,
    item.address?.village,
    item.address?.municipality,
    item.name
  );

  const parts = [
    cityName,
    item.address?.county,
    item.address?.state,
    item.address?.country,
  ]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);

  const formatted = Array.from(new Set(parts)).join(', ');
  return formatted || String(item.display_name || '').trim() || fallbackQuery;
}

function scoreNominatimItem(item: NominatimItem, query: string): number {
  let score = Number(item.importance ?? 0);
  const normalizedQuery = stripAccents(query.trim().toLowerCase());
  const normalizedName = stripAccents(
    firstNonEmpty(
      item.address?.city,
      item.address?.town,
      item.address?.village,
      item.address?.municipality,
      item.name,
      ''
    ).toLowerCase()
  );

  if (normalizedName === normalizedQuery) {
    score += 5;
  } else if (normalizedName.startsWith(normalizedQuery)) {
    score += 2;
  }

  if (isCityLikeNominatimItem(item)) {
    score += 3;
  }

  return score;
}

function isCityLikeNominatimItem(item: NominatimItem): boolean {
  const value = `${item.addresstype || ''}:${item.type || ''}`.toLowerCase();
  return (
    value.includes('city') ||
    value.includes('town') ||
    value.includes('village') ||
    value.includes('municipality') ||
    value.includes('administrative')
  );
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  return values.find((value) => typeof value === 'string' && value.trim())?.trim() || '';
}

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
