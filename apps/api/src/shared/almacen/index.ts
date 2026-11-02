import type { Readable } from 'node:stream';

/**
 * Puerto de almacenamiento de los archivos generados (A-24). En Docker lo implementa un volumen compartido por
 * las dos réplicas; en producción se sustituye por S3 o Azure Blob sin tocar el servicio. Los nombres los genera
 * el servidor, nunca el cliente.
 */
export interface AlmacenArchivos {
  /** Guarda todo lo que llegue por `origen`; si el origen falla, no queda nada guardado. */
  guardar(nombre: string, origen: Readable): Promise<{ tamanoBytes: number }>;
  /** El contenido como stream; ArchivoNoEncontrado si no existe. */
  leer(nombre: string): Promise<Readable>;
  /** Idempotente: borrar un archivo que ya no existe no falla. */
  borrar(nombre: string): Promise<void>;
  /** Los archivos guardados (solo los nombres que genera el servidor) con su fecha de modificación. */
  listar(): Promise<{ nombre: string; modificado: Date }[]>;
}

export class ArchivoNoEncontrado extends Error {
  constructor(nombre: string) {
    super(`El archivo ${nombre} no existe en el almacén`);
    this.name = 'ArchivoNoEncontrado';
  }
}
