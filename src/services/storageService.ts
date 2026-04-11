import AsyncStorage from '@react-native-async-storage/async-storage';
import { Averia } from '../types/averia';

const STORAGE_KEYS = {
  AVERIAS: '@gestion_averias/data',
  CUSTOM_INTERVENCION_TYPES: '@gestion_averias/custom_intervencion',
  CUSTOM_AVERIA_TYPES: '@gestion_averias/custom_averia_types',
} as const;

export async function saveAverias(averias: Averia[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.AVERIAS, JSON.stringify(averias));
}

export async function loadAverias(): Promise<Averia[]> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.AVERIAS);
  if (!data) return [];
  try {
    return JSON.parse(data) as Averia[];
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
