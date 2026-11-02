import { createWriteStream } from 'node:fs';
import { mkdir, open, readdir, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ArchivoNoEncontrado, type AlmacenArchivos } from '../almacen/index.js';

// Solo nombres generados por el servidor: sin rutas ni "..", así nadie escribe ni lee fuera del directorio.
const NOMBRE_VALIDO = /^[\w-]+\.(?:xlsx|pdf)$/;
const SUFIJO_TEMPORAL = '.tmp';

const noExiste = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT';

/**
 * A-24: el almacén sobre un directorio. En Docker es un volumen con nombre montado en las dos réplicas, así el
 * archivo que generó una se descarga desde la otra. Escribe en un temporal y renombra: nunca se lee un archivo a
 * medias. `guardar` siempre consume o destruye el origen: quien lo escribe nunca queda esperando.
 */
export function crearAlmacenEnDisco(directorio: string): AlmacenArchivos {
  function ruta(nombre: string): string {
    if (!NOMBRE_VALIDO.test(nombre)) throw new Error(`Nombre de archivo no válido: ${nombre}`);
    return join(directorio, nombre);
  }

  return {
    async guardar(nombre: string, origen: Readable) {
      let temporal: string | undefined;
      try {
        const destino = ruta(nombre);
        temporal = `${destino}${SUFIJO_TEMPORAL}`;
        await mkdir(directorio, { recursive: true });
        await pipeline(origen, createWriteStream(temporal));
        await rename(temporal, destino);
        return { tamanoBytes: (await stat(destino)).size };
      } catch (error) {
        origen.destroy(error instanceof Error ? error : new Error(String(error)));
        if (temporal !== undefined) await rm(temporal, { force: true });
        throw error;
      }
    },

    // Abrir primero: un archivo borrado justo después no llega como error a mitad de la descarga.
    async leer(nombre: string) {
      try {
        const archivo = await open(ruta(nombre), 'r');
        return archivo.createReadStream();
      } catch (error) {
        if (noExiste(error)) throw new ArchivoNoEncontrado(nombre);
        throw error;
      }
    },

    async borrar(nombre: string) {
      await rm(ruta(nombre), { force: true });
    },

    async listar() {
      let nombres: string[];
      try {
        nombres = await readdir(directorio);
      } catch (error) {
        if (noExiste(error)) return [];
        throw error;
      }
      const archivos = await Promise.all(
        nombres
          .filter((nombre) => NOMBRE_VALIDO.test(nombre))
          .map(async (nombre) => ({
            nombre,
            modificado: (await stat(join(directorio, nombre))).mtime,
          })),
      );
      return archivos;
    },
  };
}
