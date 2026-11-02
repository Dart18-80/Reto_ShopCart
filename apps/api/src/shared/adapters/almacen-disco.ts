import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ArchivoNoEncontrado, type AlmacenArchivos } from '../almacen/index.js';

// Solo nombres generados por el servidor: sin rutas ni "..", así nadie escribe ni lee fuera del directorio.
const NOMBRE_VALIDO = /^[\w-]+\.(?:xlsx|pdf)$/;
const SUFIJO_TEMPORAL = '.tmp';

/**
 * A-24: el almacén sobre un directorio. En Docker es un volumen con nombre montado en las dos réplicas, así el
 * archivo que generó una se descarga desde la otra. Escribe en un temporal y renombra: nunca se lee un archivo a
 * medias.
 */
export function crearAlmacenEnDisco(directorio: string): AlmacenArchivos {
  function ruta(nombre: string): string {
    if (!NOMBRE_VALIDO.test(nombre)) throw new Error(`Nombre de archivo no válido: ${nombre}`);
    return join(directorio, nombre);
  }

  return {
    async guardar(nombre: string, origen: Readable) {
      const destino = ruta(nombre);
      const temporal = `${destino}${SUFIJO_TEMPORAL}`;
      await mkdir(directorio, { recursive: true });
      try {
        await pipeline(origen, createWriteStream(temporal));
        await rename(temporal, destino);
      } catch (error) {
        await rm(temporal, { force: true });
        throw error;
      }
      return { tamanoBytes: (await stat(destino)).size };
    },

    async leer(nombre: string) {
      const archivo = ruta(nombre);
      try {
        await stat(archivo);
      } catch {
        throw new ArchivoNoEncontrado(nombre);
      }
      return createReadStream(archivo);
    },

    borrar: (nombre: string) => rm(ruta(nombre), { force: true }),
  };
}
