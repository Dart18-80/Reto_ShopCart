import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { text } from 'node:stream/consumers';
import { describe, expect, it } from 'vitest';
import { crearAlmacenEnDisco } from '../../../../src/shared/adapters/almacen-disco.js';
import { ArchivoNoEncontrado } from '../../../../src/shared/almacen/index.js';

async function preparar() {
  const directorio = await mkdtemp(join(tmpdir(), 'almacen-'));
  return { almacen: crearAlmacenEnDisco(directorio), directorio };
}

describe('almacén en disco (E7-H05, A-24)', () => {
  it('guarda, devuelve el tamaño y lee el mismo contenido', async () => {
    const { almacen } = await preparar();

    const { tamanoBytes } = await almacen.guardar('1-abc.xlsx', Readable.from(['hola']));
    const leido = await text(await almacen.leer('1-abc.xlsx'));

    expect(tamanoBytes).toBe(4);
    expect(leido).toBe('hola');
  });

  it.each(['../fuera.xlsx', 'a/b.xlsx', 'archivo.exe', '..\\fuera.pdf', ''])(
    'rechaza un nombre que no generó el servidor: %j',
    async (nombre) => {
      const { almacen } = await preparar();

      await expect(almacen.leer(nombre)).rejects.toThrow('Nombre de archivo no válido');
    },
  );

  it('si el origen falla, no queda nada guardado (ni el temporal)', async () => {
    const { almacen, directorio } = await preparar();
    const origen = new Readable({
      read() {
        this.destroy(new Error('el generador falló'));
      },
    });

    await expect(almacen.guardar('2-abc.pdf', origen)).rejects.toThrow('el generador falló');
    expect(await readdir(directorio)).toEqual([]);
  });

  it('leer uno que no existe es ArchivoNoEncontrado; borrarlo dos veces no falla', async () => {
    const { almacen } = await preparar();
    await almacen.guardar('3-abc.pdf', Readable.from(['x']));

    await almacen.borrar('3-abc.pdf');
    await almacen.borrar('3-abc.pdf');

    await expect(almacen.leer('3-abc.pdf')).rejects.toBeInstanceOf(ArchivoNoEncontrado);
  });

  it('listar devuelve solo los archivos del servidor, con su fecha; sin directorio, ninguno', async () => {
    const { almacen, directorio } = await preparar();
    await almacen.guardar('4-abc.xlsx', Readable.from(['x']));
    await writeFile(join(directorio, 'ajeno.txt'), 'no es nuestro');

    const archivos = await almacen.listar();
    const vacio = await crearAlmacenEnDisco(join(directorio, 'no-existe')).listar();

    expect(archivos.map((a) => a.nombre)).toEqual(['4-abc.xlsx']);
    expect(archivos[0]?.modificado).toBeInstanceOf(Date);
    expect(vacio).toEqual([]);
  });
});
