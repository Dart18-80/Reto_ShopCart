import { Router } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { generarDocumentoOpenApi } from '../../src/shared/openapi/index.js';
import { dependenciasDePrueba } from '../app-de-prueba.js';

// E8-H02: ninguna ruta de la API queda sin documentar, y nada documentado deja de existir. Express 5 no guarda
// el prefijo con el que se monta un router, así que se registra cada get/post/put/patch/delete/use del
// prototipo de Router mientras se arma la app y después se reconstruyen las rutas completas.

const METODOS = ['get', 'post', 'put', 'patch', 'delete'] as const;
type Funcion = (this: object, ...argumentos: unknown[]) => unknown;

// router@2: cada router es una función cuyo prototipo es una instancia de Router; los métodos viven en
// Router.prototype, un nivel más arriba.
const prototipo = Object.getPrototypeOf(Object.getPrototypeOf(Router())) as Record<string, Funcion>;
const rutasPorRouter = new Map<object, string[]>();
const montajesPorRouter = new Map<object, { ruta: string; hijo: object }[]>();
const originales = new Map<string, Funcion>();

const esRouter = (valor: unknown): valor is object => valor instanceof Router;

function agregar<T>(mapa: Map<object, T[]>, dueno: object, valor: T): void {
  mapa.set(dueno, [...(mapa.get(dueno) ?? []), valor]);
}

function espiar(nombre: string, registrar: (dueno: object, argumentos: unknown[]) => void): void {
  const original = prototipo[nombre];
  if (original === undefined) throw new Error(`Router no tiene ${nombre}`);
  originales.set(nombre, original);
  prototipo[nombre] = function (this: object, ...argumentos: unknown[]) {
    registrar(this, argumentos);
    return original.apply(this, argumentos);
  };
}

/** Rutas completas, `METODO /api/v1/pedidos/{id}`, a partir de los routers que nadie monta (la raíz). */
function rutasRegistradas(): Set<string> {
  const hijos = new Set([...montajesPorRouter.values()].flat().map((m) => m.hijo));
  const raices = [...rutasPorRouter.keys(), ...montajesPorRouter.keys()].filter(
    (r) => !hijos.has(r),
  );
  const rutas = new Set<string>();
  const recorrer = (router: object, prefijo: string): void => {
    for (const ruta of rutasPorRouter.get(router) ?? []) {
      const [metodo, camino] = ruta.split(' ');
      // Express trata /usuarios y /usuarios/ igual; OpenAPI usa {id} donde Express usa :id.
      const completa = (prefijo + (camino ?? ''))
        .replace(/(.)\/$/, '$1')
        .replace(/:(\w+)/g, '{$1}');
      rutas.add(`${metodo ?? ''} ${completa}`);
    }
    for (const { ruta, hijo } of montajesPorRouter.get(router) ?? []) {
      recorrer(hijo, prefijo + (ruta === '/' ? '' : ruta));
    }
  };
  for (const raiz of new Set(raices)) recorrer(raiz, '');
  return rutas;
}

beforeAll(() => {
  for (const metodo of METODOS) {
    espiar(metodo, (dueno, [ruta]) => {
      if (typeof ruta === 'string')
        agregar(rutasPorRouter, dueno, `${metodo.toUpperCase()} ${ruta}`);
    });
  }
  espiar('use', (dueno, argumentos) => {
    const [primero] = argumentos;
    const ruta = typeof primero === 'string' ? primero : '/';
    for (const hijo of argumentos.filter(esRouter))
      agregar(montajesPorRouter, dueno, { ruta, hijo });
  });
  crearApp(dependenciasDePrueba());
});

afterAll(() => {
  for (const [nombre, original] of originales) prototipo[nombre] = original;
});

describe('OpenAPI completo (E8-H02, A-08)', () => {
  it('cada ruta de /api/v1 está en el documento y cada operación documentada existe', () => {
    const documento = generarDocumentoOpenApi();
    const documentadas = new Set(
      Object.entries(documento.paths ?? {}).flatMap(([camino, operaciones]) =>
        Object.keys(operaciones)
          .filter((metodo) => (METODOS as readonly string[]).includes(metodo))
          .map((metodo) => `${metodo.toUpperCase()} ${camino}`),
      ),
    );
    const registradas = new Set([...rutasRegistradas()].filter((r) => r.includes(' /api/v1/')));

    expect(registradas.size).toBeGreaterThan(80);
    expect([...registradas].filter((r) => !documentadas.has(r))).toEqual([]);
    expect([...documentadas].filter((r) => !registradas.has(r))).toEqual([]);
  });
});
