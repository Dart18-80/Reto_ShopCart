/**
 * El largo máximo del texto de búsqueda del catálogo: el parámetro @Texto NVARCHAR(150) de los SPs de búsqueda. La
 * API lo valida con textoNvarchar y la web lo pone como maxLength del buscador.
 */
export const LARGO_MAXIMO_TEXTO_BUSQUEDA = 150;

/**
 * FE-15: las ilustraciones de prenda con que la tienda dibuja los productos de cada categoría. Es la misma lista del
 * CHECK CK_Categoria_Ilustracion (V025); la web tiene un dibujo por cada una.
 */
export const ILUSTRACIONES_PRENDA = [
  'Camisa',
  'Pantalon',
  'Vestido',
  'Chaqueta',
  'Tenis',
  'Gorra',
] as const;
export type IlustracionPrenda = (typeof ILUSTRACIONES_PRENDA)[number];
