import { AsyncLocalStorage } from 'node:async_hooks';

export type Rol = 'Cliente' | 'Operador' | 'Administrador';

export interface ContextoPeticion {
  requestId: string;
  idUsuario: number | null;
  rol: Rol | null;
}

// A-18: el contexto viaja con la petición sin pasarlo a mano por las capas. Vive solo durante la
// petición, así que no rompe la API stateless (RNF-2).
const almacen = new AsyncLocalStorage<ContextoPeticion>();

export function ejecutarConContexto<T>(contexto: ContextoPeticion, funcion: () => T): T {
  return almacen.run(contexto, funcion);
}

/**
 * Ejecuta fuera de la petición en curso, aunque se llame desde un handler: ejecutarSP lo trata como un job
 * (rol Sistema, A-18). Lo usa el trabajo en segundo plano que dispara una petición (E7-H05).
 */
export function fueraDeLaPeticion<T>(funcion: () => T): T {
  return almacen.exit(funcion);
}

/** undefined en un job o fuera de una petición. */
// Solo lectura: el usuario de la petición solo lo cambia establecerUsuario (RF-01).
export function obtenerContexto(): Readonly<ContextoPeticion> | undefined {
  return almacen.getStore();
}

/** Lo usa el middleware `autenticar` (E2) al validar el token. */
export function establecerUsuario(idUsuario: number, rol: Rol): void {
  const contexto = almacen.getStore();
  if (contexto === undefined) {
    throw new Error('establecerUsuario se llamó fuera de una petición');
  }
  contexto.idUsuario = idUsuario;
  contexto.rol = rol;
}
