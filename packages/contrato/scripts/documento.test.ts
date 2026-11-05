import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { FOTO, generarArchivos, leerSiExiste, TIPOS } from './documento.ts';

const huella = (archivos: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(archivos).map(([ruta, contenido]) => [
      ruta,
      createHash('sha256').update(contenido).digest('hex'),
    ]),
  );

// Carga la API completa con el module runner de Vite: más lento que una prueba unitaria.
const CARGA_DE_LA_API_MS = 60_000;

describe('exportación del contrato (F1-H02)', () => {
  it(
    'exportar dos veces seguidas produce exactamente los mismos archivos, y son los que están en disco',
    async () => {
      const primera = await generarArchivos();
      const segunda = await generarArchivos();

      expect(huella(segunda)).toEqual(huella(primera));
      expect(primera[FOTO]).toBe(await leerSiExiste(FOTO));
      expect(primera[TIPOS]).toBe(await leerSiExiste(TIPOS));
    },
    CARGA_DE_LA_API_MS,
  );
});
