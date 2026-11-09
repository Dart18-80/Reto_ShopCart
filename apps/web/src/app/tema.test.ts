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

// D1: el contraste AA (4.5:1 para texto normal) de cada par de texto y superficie que usa la interfaz, en los dos
// temas. Fórmula de luminancia relativa de WCAG 2.
function luminancia(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((inicio) => {
    const canal = Number.parseInt(hex.slice(inicio, inicio + 2), 16) / 255;
    return canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(texto: string, fondo: string): number {
  const [clara, oscura] = [luminancia(texto), luminancia(fondo)].sort((a, b) => b - a);
  return ((clara ?? 0) + 0.05) / ((oscura ?? 0) + 0.05);
}

const PARES_DE_TEXTO: [texto: string, fondo: string][] = [
  ['--foreground', '--background'],
  ['--foreground', '--card'],
  ['--muted-foreground', '--background'],
  ['--muted-foreground', '--card'],
  ['--muted-foreground', '--muted'],
  ['--primary-foreground', '--primary'],
  ['--primary', '--card'],
  ['--primary', '--background'],
  ['--primary', '--accent'],
  ['--accent-foreground', '--accent'],
  ['--secondary-foreground', '--secondary'],
  // Lo destructivo (botones y errores) usa el rojo de texto, también sobre su fondo suave al pasar el cursor.
  ['--oferta', '--card'],
  ['--oferta', '--background'],
  ['--oferta', '--destructive-suave'],
  ['--exito', '--exito-suave'],
  ['--aviso', '--aviso-suave'],
  ['--info', '--info-suave'],
];

describe('contraste AA de los textos en los dos temas (D1)', () => {
  for (const [modo, colores] of Object.entries(figma.color)) {
    const valores: Record<string, string> = colores;
    it.each(PARES_DE_TEXTO)(`${modo}: %s sobre %s llega a 4.5:1`, (texto, fondo) => {
      expect(contraste(valores[texto] ?? '', valores[fondo] ?? '')).toBeGreaterThanOrEqual(4.5);
    });
  }
});
