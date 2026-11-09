/*
 * D1: el mismo marco para todos los controles de la tienda y del backoffice (campos de texto, `<select>` y fechas
 * nativos, buscadores): 44 px de alto, borde de 1 px que se oscurece al pasar el cursor y, con foco, anillo de 3 px
 * del color de foco al 30 % más el borde del mismo color. Los controles nativos se quedan nativos: solo se estilizan.
 */
const MARCO =
  'rounded-control border border-borde-control bg-card transition-[color,border-color,box-shadow] hover:border-muted-foreground aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20';

/** El foco del propio control (campos, `<select>`, fechas y botones). */
export const FOCO_VISIBLE =
  'outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30';

/** El marco de un grupo que contiene el campo (buscadores con ícono): el foco de adentro enciende el anillo. */
export const CLASE_GRUPO_CONTROL = `${MARCO} flex h-11 items-center gap-2 px-3 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30`;

const CAMPO = `${MARCO} ${FOCO_VISIBLE} texto-base h-11 w-full min-w-0 placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50`;

/** Campo de texto y fecha nativa. */
export const CLASE_CONTROL = `${CAMPO} px-3`;

/** `<select>` nativo, con el mismo chevron de «Relevancia» y espacio a la derecha para él. */
export const CLASE_SELECT = `${CAMPO} chevron-select pr-9 pl-3`;

/** Checkbox nativo con el color principal (`accent-color`). */
export const CLASE_CASILLA = 'size-4 shrink-0 accent-primary';
