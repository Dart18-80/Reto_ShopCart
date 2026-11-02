import { AppError } from '../../shared/errors/index.js';
import {
  sesionRevocada,
  tokenDeAutorizacion,
  type TokensAcceso,
  type VersionesSesion,
} from '../../shared/http/index.js';
import type { DifusorDeVersiones } from './reportes.eventos.js';

/** Hacia dónde escribe el stream: el controlador lo traduce a la respuesta HTTP. */
export interface SalidaDeEventos {
  escribir(texto: string): void;
  cerrar(): void;
}

interface Dependencias {
  difusor: DifusorDeVersiones;
  tokens: Pick<TokensAcceso, 'verificar'>;
  versiones: Pick<VersionesSesion, 'vigente'>;
}

/**
 * E9-H02 (A-25): conecta el stream del dashboard de un Admin. `autenticar` ya verificó el token; aquí se vuelve a
 * leer para saber cuándo vence y con qué versión de sesión: el stream se cierra al vencer o si la sesión se revoca.
 */
export function crearTiempoRealService({ difusor, tokens, versiones }: Dependencias) {
  return {
    async conectar(
      autorizacion: string | undefined,
      ultimoEventoId: string | undefined,
      salida: SalidaDeEventos,
    ): Promise<() => void> {
      const token = tokenDeAutorizacion(autorizacion);
      const verificado = token === undefined ? null : await tokens.verificar(token);
      if (verificado === null) throw new AppError('NO_AUTENTICADO');
      return difusor.conectar(
        {
          idUsuario: verificado.idUsuario,
          venceEn: verificado.venceEn,
          sesionVigente: async () => !(await sesionRevocada(verificado, versiones)),
          escribir: (texto) => {
            salida.escribir(texto);
          },
          cerrar: () => {
            salida.cerrar();
          },
        },
        ultimoEventoId,
      );
    },
  };
}

export type TiempoRealService = ReturnType<typeof crearTiempoRealService>;
