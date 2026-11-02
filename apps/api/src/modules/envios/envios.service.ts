import { hashearTokenOpaco } from '../../shared/http/index.js';
import type { EnviosRepository } from './envios.repository.js';
import type { ActualizarMetodo } from './envios.schemas.js';
import type { MetodoEnvio, MetodosParaCarrito } from './envios.types.js';

interface Dependencias {
  repositorio: EnviosRepository;
}

export function crearEnviosService({ repositorio }: Dependencias) {
  return {
    // N-05: con sesión de Cliente manda su carrito y el SP ignora la cookie; sin sesión, el de la cookie.
    listarParaCarrito: (tokenInvitado: string | undefined): Promise<MetodosParaCarrito> =>
      repositorio.listarParaCarrito(
        tokenInvitado === undefined ? null : hashearTokenOpaco(tokenInvitado),
      ),

    actualizarMetodo: (idMetodoEnvio: number, datos: ActualizarMetodo): Promise<MetodoEnvio> =>
      repositorio.actualizarMetodo(idMetodoEnvio, datos),
  };
}

export type EnviosService = ReturnType<typeof crearEnviosService>;
