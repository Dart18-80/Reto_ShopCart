import { montoMenorOIgual } from '@shopcart/shared';
import type { ProductoTienda } from './catalogo.api';

// M2-H03: elegir una variante es una búsqueda sobre la lista que manda el backend, no una regla de negocio. La
// existencia la decide el backend (estadoExistencia); aquí solo se cruzan los valores.

type Variante = ProductoTienda['variantes'][number];

/** idAtributo → idValorAtributo elegido. */
export type Seleccion = Readonly<Partial<Record<number, number>>>;

export interface ValorDelAtributo {
  idValorAtributo: number;
  valor: string;
}

export interface AtributoDelProducto {
  idAtributo: number;
  nombre: string;
  valores: ValorDelAtributo[];
}

export type EstadoOpcion = 'disponible' | 'agotada' | 'inexistente';

/**
 * Los atributos y sus valores, sin repetir: los atributos en el orden en que llegan (el SP los ordena por
 * Atributo.Orden) y los valores de cada uno por su ValorAtributo.Orden (S, M, L, XL).
 */
export function atributosDe(variantes: readonly Variante[]): AtributoDelProducto[] {
  const porId = new Map<number, AtributoDelProducto & { ordenes: Map<number, number> }>();
  for (const { valores } of variantes) {
    for (const { idAtributo, atributo, idValorAtributo, valor, orden } of valores) {
      const encontrado = porId.get(idAtributo) ?? {
        idAtributo,
        nombre: atributo,
        valores: [],
        ordenes: new Map<number, number>(),
      };
      porId.set(idAtributo, encontrado);
      if (!encontrado.ordenes.has(idValorAtributo)) {
        encontrado.ordenes.set(idValorAtributo, orden);
        encontrado.valores.push({ idValorAtributo, valor });
      }
    }
  }
  return [...porId.values()].map(({ idAtributo, nombre, valores, ordenes }) => ({
    idAtributo,
    nombre,
    valores: valores.toSorted(
      (a, b) => (ordenes.get(a.idValorAtributo) ?? 0) - (ordenes.get(b.idValorAtributo) ?? 0),
    ),
  }));
}

const tieneValor = (variante: Variante, idAtributo: number, idValorAtributo: number) =>
  variante.valores.some(
    (v) => v.idAtributo === idAtributo && v.idValorAtributo === idValorAtributo,
  );

const cumple = (variante: Variante, seleccion: Seleccion) =>
  Object.entries(seleccion).every(
    ([idAtributo, idValor]) =>
      idValor === undefined || tieneValor(variante, Number(idAtributo), idValor),
  );

/** La variante que forma la selección, solo si tiene un valor elegido para cada uno de sus atributos. */
export function varianteElegida(
  variantes: readonly Variante[],
  seleccion: Seleccion,
): Variante | undefined {
  return variantes.find(
    (variante) =>
      variante.valores.every((v) => seleccion[v.idAtributo] === v.idValorAtributo) &&
      cumple(variante, seleccion),
  );
}

/**
 * Si un valor forma alguna variante con lo elegido en los demás atributos: disponible si alguna de ellas no está
 * agotada, agotada si todas lo están, o inexistente si ninguna lo tiene.
 */
export function estadoDeOpcion(
  variantes: readonly Variante[],
  seleccion: Seleccion,
  idAtributo: number,
  idValorAtributo: number,
): EstadoOpcion {
  const conLosDemas = { ...seleccion, [idAtributo]: idValorAtributo };
  const candidatas = variantes.filter((variante) => cumple(variante, conLosDemas));
  if (candidatas.length === 0) return 'inexistente';
  return candidatas.some((v) => v.estadoExistencia !== 'Agotado') ? 'disponible' : 'agotada';
}

export const seleccionDe = (variante: Variante): Seleccion =>
  Object.fromEntries(variante.valores.map((v) => [v.idAtributo, v.idValorAtributo]));

/** Un atributo con un solo valor no se pregunta: queda elegido. */
export const seleccionInicial = (atributos: readonly AtributoDelProducto[]): Seleccion =>
  Object.fromEntries(
    atributos.flatMap(({ idAtributo, valores }) =>
      valores.length === 1 && valores[0] ? [[idAtributo, valores[0].idValorAtributo]] : [],
    ),
  );

/**
 * El precio más bajo entre las variantes, para el «Desde» mientras no hay una elegida. Se compara el texto del
 * backend, sin pasar por `number` ni calcular nada (FE-10).
 */
export const precioMenor = (variantes: readonly Variante[]): string | undefined =>
  variantes.reduce<string | undefined>(
    (menor, { precio }) =>
      menor === undefined || montoMenorOIgual(precio, menor) ? precio : menor,
    undefined,
  );
