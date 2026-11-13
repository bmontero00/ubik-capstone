import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Guarda la sesión y la dirección del servidor de forma segura en el celular (llavero / Keystore).
// En la versión web (solo para probar en el computador) se usa localStorage.
const web = Platform.OS === 'web';

export async function leer(clave: string): Promise<string | null> {
  if (web) return globalThis.localStorage?.getItem(clave) ?? null;
  return SecureStore.getItemAsync(clave);
}

export async function guardar(clave: string, valor: string): Promise<void> {
  if (web) return void globalThis.localStorage?.setItem(clave, valor);
  await SecureStore.setItemAsync(clave, valor);
}

export async function borrar(clave: string): Promise<void> {
  if (web) return void globalThis.localStorage?.removeItem(clave);
  await SecureStore.deleteItemAsync(clave);
}
