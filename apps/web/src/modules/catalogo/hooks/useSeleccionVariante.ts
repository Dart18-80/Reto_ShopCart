import { useMemo, useState } from 'react';
import type { ProductoTienda } from '../catalogo.api';
import {
  atributosDe,
  estadoDeOpcion,
  seleccionDe,
  seleccionInicial,
  varianteElegida,
  type AtributoDelProducto,
  type Seleccion,
} from '../seleccionVariante';

type Variante = ProductoTienda['variantes'][number];

interface OpcionesSeleccion {
  variantes: Variante[];
  /** La variante que dice la URL; una que no es del producto se ignora. */
  idVarianteEnUrl: number | undefined;
  /** Escribe en la URL la variante resuelta, o la quita si la selección ya no forma una. */
  alResolver: (idVariante: number | undefined) => void;
}

/**
 * M2-H03: la variante elegida vive en la URL (`?variante=`) para poder compartirla; mientras falta un atributo, lo
 * elegido vive en el componente. Todo lo demás se deriva de la lista que mandó el backend.
 */
export function useSeleccionVariante({
  variantes,
  idVarianteEnUrl,
  alResolver,
}: OpcionesSeleccion) {
  const atributos = useMemo(() => atributosDe(variantes), [variantes]);
  const [parcial, setParcial] = useState<Seleccion>({});
  const deLaUrl = variantes.find((v) => v.idVariante === idVarianteEnUrl);
  const seleccion: Seleccion = deLaUrl
    ? seleccionDe(deLaUrl)
    : { ...seleccionInicial(atributos), ...parcial };
  const variante = varianteElegida(variantes, seleccion);

  const valorElegido = (atributo: AtributoDelProducto) =>
    atributo.valores.find((v) => v.idValorAtributo === seleccion[atributo.idAtributo])?.valor;

  return {
    atributos,
    seleccion,
    variante,
    valorElegido,
    faltan: atributos
      .filter((a) => seleccion[a.idAtributo] === undefined)
      .map((a) => a.nombre.toLowerCase()),
    opcionesDe: (atributo: AtributoDelProducto) =>
      atributo.valores.map((valor) => ({
        ...valor,
        estado: estadoDeOpcion(variantes, seleccion, atributo.idAtributo, valor.idValorAtributo),
      })),
    /** Lo elegido en los demás atributos, para explicar una opción deshabilitada («en Azul»). */
    elegidoEnLosDemas: (atributo: AtributoDelProducto) =>
      atributos
        .filter((otro) => otro.idAtributo !== atributo.idAtributo)
        .map(valorElegido)
        .filter((valor) => valor !== undefined),
    elegir: (idAtributo: number, idValorAtributo: number) => {
      const nueva = { ...seleccion, [idAtributo]: idValorAtributo };
      setParcial(nueva);
      alResolver(varianteElegida(variantes, nueva)?.idVariante);
    },
  };
}
