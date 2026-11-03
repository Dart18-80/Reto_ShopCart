// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import figma from './tema.figma.json';

// F1-H01 (FE-15): las variables CSS del tema coinciden una a una con las de Figma, con los mismos nombres de su
// code syntax. tema.figma.json es la lectura del archivo de Figma; si el diseño cambia, se vuelve a leer.

const CSS = readFileSync(resolve(import.meta.dirname, 'tema.css'), 'utf8');

/** Las declaraciones `--nombre: valor;` del primer bloque cuyo selector es exactamente `selector`. */
function variablesDelBloque(selector: string): Record<string, string> {
  const inicio = CSS.search(new RegExp(`(^|\\n)${selector.replace('.', '\\.')}\\s*\\{`));
  if (inicio < 0) throw new Error(`tema.css no tiene el bloque ${selector}`);
  const cuerpo = CSS.slice(CSS.indexOf('{', inicio) + 1, CSS.indexOf('}', inicio));
  return Object.fromEntries(
    [...cuerpo.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, nombre = '', valor = '']) => [
      nombre,
      valor.trim().toLowerCase(),
    ]),
  );
}

const subconjunto = (variables: Record<string, string>, nombres: string[]) =>
  Object.fromEntries(nombres.map((nombre) => [nombre, variables[nombre]]));

describe('tema.css contra las variables de Figma (FE-15)', () => {
  it('modo Claro: la colección Color completa en :root', () => {
    const raiz = variablesDelBloque(':root');

    expect(subconjunto(raiz, Object.keys(figma.color.claro))).toEqual(figma.color.claro);
  });

  it('modo Oscuro: la colección Color completa en .dark, con los mismos nombres', () => {
    const oscuro = variablesDelBloque('.dark');

    expect(oscuro).toEqual(figma.color.oscuro);
  });

  it('Prenda tiene un solo valor para los dos modos, en :root', () => {
    const raiz = variablesDelBloque(':root');

    expect(subconjunto(raiz, Object.keys(figma.prenda))).toEqual(figma.prenda);
  });

  it('Forma va en @theme: Tailwind la publica con el mismo nombre y sus utilidades la usan', () => {
    const tema = variablesDelBloque('@theme');

    expect(subconjunto(tema, Object.keys(figma.forma))).toEqual(figma.forma);
  });

  it(':root no define variables que Figma no tiene', () => {
    const esperadas = [...Object.keys(figma.color.claro), ...Object.keys(figma.prenda)].sort();

    expect(Object.keys(variablesDelBloque(':root')).sort()).toEqual(esperadas);
  });
});
