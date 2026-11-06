import type { Existencia } from './inventario.api';

/** «Camisa Oxford, Azul / M»; una variante sin atributos se nombra solo con su producto. */
export const nombreDeVariante = ({ producto, descripcionAtributos }: Existencia) =>
  descripcionAtributos === '' ? producto : `${producto}, ${descripcionAtributos}`;
