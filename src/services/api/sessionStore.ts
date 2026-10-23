import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'gestion_averias_session_token';

// En Android/iOS el token va al almacén seguro del sistema. En web no existe un equivalente:
// se usa el almacenamiento del navegador (limitación documentada en SEGURIDAD.md).
export async function readSessionToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return await AsyncStorage.getItem(KEY);
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function writeSessionToken(token: string): Promise<void> {
  if (Platform.OS === 'web') await AsyncStorage.setItem(KEY, token);
  else await SecureStore.setItemAsync(KEY, token);
}

export async function clearSessionToken(): Promise<void> {
  try {
    if (Platform.OS === 'web') await AsyncStorage.removeItem(KEY);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Nada que limpiar.
  }
}
