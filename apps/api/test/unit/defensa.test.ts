import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// E9-H03: la guía de defensa no afirma nada que el código no respalde. Cada cita a una línea lleva como título un
// fragmento literal de esa línea: si el código se mueve, esta prueba lo detecta.

const RAIZ = resolve(import.meta.dirname, '../../../..');
const DEFENSA = join(RAIZ, 'docs/defensa');
// Un módulo es una carpeta con su index.ts: fronteras.test.ts crea a la vez carpetas temporales sin él.
const MODULOS = readdirSync(join(RAIZ, 'apps/api/src/modules')).filter((m) =>
  existsSync(join(RAIZ, 'apps/api/src/modules', m, 'index.ts')),
);
const TRANSVERSALES = [
  'arquitectura',
  'base-de-datos',
  'concurrencia',
  'seguridad',
  'pruebas',
  'infraestructura',
  'observabilidad',
];
const SECCIONES_DE_MODULO = [
  '## Qué hace',
  '## Flujo crítico',
  '## Reglas: dónde vive cada una',
  '## Concurrencia y réplicas',
  '## Modos de falla',
  '## Alternativas descartadas',
  '## Preguntas probables',
];
const PREGUNTAS_POR_MODULO = { minimo: 10, maximo: 15 };
const PREGUNTAS_DIFICILES = 30;
const ENLACE = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g;

interface Enlace {
  archivo: string;
  texto: string;
  destino: string;
  titulo: string | undefined;
}

function archivosMarkdown(carpeta: string): string[] {
  return readdirSync(carpeta).flatMap((nombre) => {
    const ruta = join(carpeta, nombre);
    if (statSync(ruta).isDirectory()) return archivosMarkdown(ruta);
    return nombre.endsWith('.md') ? [ruta] : [];
  });
}

const leer = (ruta: string) => readFileSync(ruta, 'utf8');
const lineas = (ruta: string) => leer(ruta).split(/\r?\n/);

function enlacesInternos(archivo: string): Enlace[] {
  return [...leer(archivo).matchAll(ENLACE)]
    .map(([, texto = '', destino = '', titulo]) => ({ archivo, texto, destino, titulo }))
    .filter(({ destino }) => !/^(https?:|mailto:|#)/.test(destino));
}

/** Las preguntas de una sección: cada una es un encabezado `###` hasta la siguiente sección `##`. */
function preguntasDeSeccion(texto: string, seccion: string): number {
  const desde = texto.indexOf(seccion);
  if (desde === -1) return 0;
  const resto = texto.slice(desde + seccion.length);
  const fin = resto.search(/^## /m);
  return (fin === -1 ? resto : resto.slice(0, fin)).match(/^### /gm)?.length ?? 0;
}

const existeLaGuia = existsSync(DEFENSA);
const documentos = existeLaGuia ? archivosMarkdown(DEFENSA) : [];
const enlaces = documentos.flatMap(enlacesInternos);
const nombre = (archivo: string) => relative(DEFENSA, archivo);

describe('guía de defensa (E9-H03)', () => {
  it('tiene un índice, un archivo por módulo, los transversales, las 30 preguntas difíciles y el guion de demo', () => {
    const esperados = [
      'README.md',
      ...MODULOS.map((m) => `modulos/${m}.md`),
      ...TRANSVERSALES.map((t) => `transversal/${t}.md`),
      'preguntas-dificiles.md',
      'guion-demo.md',
    ];

    const faltantes = esperados.filter((ruta) => !existsSync(join(DEFENSA, ruta)));

    expect(faltantes).toEqual([]);
  });

  it('el índice enlaza todos los documentos de la guía', () => {
    const indice = join(DEFENSA, 'README.md');
    const enlazados = new Set(
      enlacesInternos(indice).map((e) => resolve(dirname(indice), e.destino.split('#')[0] ?? '')),
    );

    const sinEnlace = documentos.filter((d) => d !== indice && !enlazados.has(d)).map(nombre);

    expect(sinEnlace).toEqual([]);
  });

  it('cada módulo tiene todas sus secciones, un diagrama de secuencia y de 10 a 15 preguntas', () => {
    const problemas = MODULOS.flatMap((modulo) => {
      const archivo = join(DEFENSA, `modulos/${modulo}.md`);
      if (!existsSync(archivo)) return [`${modulo}: no existe`];
      const texto = leer(archivo);
      const preguntas = preguntasDeSeccion(texto, '## Preguntas probables');
      return [
        ...SECCIONES_DE_MODULO.filter((s) => !texto.includes(`\n${s}`)).map(
          (s) => `${modulo}: falta ${s}`,
        ),
        ...(/```mermaid\s+sequenceDiagram/.test(texto)
          ? []
          : [`${modulo}: sin diagrama de secuencia`]),
        ...(preguntas >= PREGUNTAS_POR_MODULO.minimo && preguntas <= PREGUNTAS_POR_MODULO.maximo
          ? []
          : [`${modulo}: ${String(preguntas)} preguntas`]),
      ];
    });

    expect(problemas).toEqual([]);
  });

  it('las preguntas difíciles son exactamente 30', () => {
    const archivo = join(DEFENSA, 'preguntas-dificiles.md');

    expect(existsSync(archivo) ? leer(archivo).match(/^### /gm)?.length : 0).toBe(
      PREGUNTAS_DIFICILES,
    );
  });

  it('cada enlace interno apunta a un archivo que existe', () => {
    const rotos = enlaces
      .filter((e) => !existsSync(resolve(dirname(e.archivo), e.destino.split('#')[0] ?? '')))
      .map((e) => `${nombre(e.archivo)}: ${e.destino}`);

    expect(rotos).toEqual([]);
  });

  it('cada cita a una línea dice archivo:línea, lleva un fragmento de esa línea como título y el fragmento está ahí', () => {
    const citas = enlaces.filter((e) => /#L\d+$/.test(e.destino));
    const problemas = citas.flatMap((e) => {
      const [ruta = '', ancla = ''] = e.destino.split('#');
      const numero = Number(ancla.slice(1));
      const destino = resolve(dirname(e.archivo), ruta);
      const donde = `${nombre(e.archivo)}: ${e.destino}`;
      if (!existsSync(destino)) return [];
      if (!e.texto.replaceAll('`', '').endsWith(`${basename(ruta)}:${String(numero)}`)) {
        return [`${donde}: el texto «${e.texto}» no es ${basename(ruta)}:${String(numero)}`];
      }
      if (e.titulo === undefined || e.titulo.trim() === '') return [`${donde}: sin fragmento`];
      const linea = lineas(destino)[numero - 1];
      if (linea === undefined) return [`${donde}: la línea no existe`];
      return linea.includes(e.titulo)
        ? []
        : [`${donde}: «${e.titulo}» no está en «${linea.trim()}»`];
    });

    expect(citas.length).toBeGreaterThan(0);
    expect(problemas).toEqual([]);
  });
});
