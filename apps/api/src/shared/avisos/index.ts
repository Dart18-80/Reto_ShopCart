/** Cambió la versión de un dominio de los reportes (A-11): solo el aviso, nunca los datos. */
export interface AvisoDeVersion {
  dominio: string;
  version: number;
}

export interface OyenteDeAvisos {
  alRecibir(aviso: AvisoDeVersion): void;
  /** El canal volvió después de una caída: lo que se publicó mientras tanto se perdió. */
  alReconectar(): void;
}

/**
 * Puerto (E9-H02, A-25): el canal entre réplicas para el dashboard en tiempo real. Adaptador: Redis pub/sub, con
 * una conexión de suscripción propia por réplica.
 */
export interface AvisosDeVersion {
  /** Nunca lanza: con el canal caído, el aviso se pierde y los clientes recargan al reconectar. */
  publicar(aviso: AvisoDeVersion): Promise<void>;
  suscribir(oyente: OyenteDeAvisos): void;
}

/** Sin canal (pruebas que no lo usan): no publica ni avisa nada. */
export const SIN_AVISOS: AvisosDeVersion = {
  publicar: () => Promise.resolve(),
  suscribir: () => undefined,
};
