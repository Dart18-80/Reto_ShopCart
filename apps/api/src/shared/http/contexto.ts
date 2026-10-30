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

/** undefined en un job o fuera de una petición. */
export function obtenerContexto(): ContextoPeticion | undefined {
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
