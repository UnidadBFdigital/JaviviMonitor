"use client";

// Preferencias de interfaz guardadas en localStorage —el riel contraído, el
// filtro por perfil— leídas con useSyncExternalStore.
//
// localStorage es un store externo: leerlo con este patrón evita el render
// extra de un useEffect y mantiene sincronizadas dos pestañas del terminal.
// La instantánea se cachea porque useSyncExternalStore exige el MISMO valor
// mientras el store no cambie: decodificar en cada lectura devolvería un
// arreglo nuevo cada vez y React entraría en bucle.

export type PrefStore<T> = {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => T;
  getServerSnapshot: () => T;
  set: (next: T) => void;
};

export function createPrefStore<T>(
  key: string,
  fallback: T,
  decode: (raw: string) => T,
  encode: (value: T) => string
): PrefStore<T> {
  const listeners = new Set<() => void>();
  let snapshot: T | null = null;

  const read = (): T => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallback : decode(raw);
    } catch {
      // navegador con almacenamiento bloqueado: se usa el valor por defecto
      return fallback;
    }
  };

  return {
    subscribe(onChange) {
      listeners.add(onChange);
      const onStorage = (event: StorageEvent) => {
        if (event.key !== key) return;
        snapshot = null;
        listeners.forEach((listener) => listener());
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(onChange);
        window.removeEventListener("storage", onStorage);
      };
    },
    getSnapshot() {
      if (snapshot === null) snapshot = read();
      return snapshot;
    },
    /** En el servidor no hay preferencia: el cliente corrige tras hidratar. */
    getServerSnapshot() {
      return fallback;
    },
    set(next) {
      snapshot = next;
      try {
        window.localStorage.setItem(key, encode(next));
      } catch {
        // la preferencia no persiste, pero la sesión sigue funcionando
      }
      listeners.forEach((listener) => listener());
    },
  };
}
