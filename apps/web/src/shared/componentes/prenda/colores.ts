// FE-15, FE-16: el color de la variante es presentación, no una regla de negocio. Los nombres son los de la
// semilla (S004) y cada uno usa su variable de la colección Prenda de Figma (--prenda-*). Las clases van
// completas para que Tailwind las encuentre en el código.
const CLASES_DEL_COLOR: Record<string, { texto: string; fondo: string }> = {
  Negro: { texto: 'text-prenda-negro', fondo: 'bg-prenda-negro' },
  Blanco: { texto: 'text-prenda-blanco', fondo: 'bg-prenda-blanco' },
  Gris: { texto: 'text-prenda-gris', fondo: 'bg-prenda-gris' },
  Azul: { texto: 'text-prenda-azul', fondo: 'bg-prenda-azul' },
  'Azul marino': { texto: 'text-prenda-azul-marino', fondo: 'bg-prenda-azul-marino' },
  Celeste: { texto: 'text-prenda-celeste', fondo: 'bg-prenda-celeste' },
  Rojo: { texto: 'text-prenda-rojo', fondo: 'bg-prenda-rojo' },
  Vino: { texto: 'text-prenda-vino', fondo: 'bg-prenda-vino' },
  Rosado: { texto: 'text-prenda-rosado', fondo: 'bg-prenda-rosado' },
  Verde: { texto: 'text-prenda-verde', fondo: 'bg-prenda-verde' },
  Mostaza: { texto: 'text-prenda-mostaza', fondo: 'bg-prenda-mostaza' },
  Beige: { texto: 'text-prenda-beige', fondo: 'bg-prenda-beige' },
  Café: { texto: 'text-prenda-cafe', fondo: 'bg-prenda-cafe' },
};

// FE-16: un color que el mapa no conoce (o ninguno) se ve en un tono neutro; su nombre sigue visible en el texto.
const NEUTRO = { texto: 'text-muted-foreground', fondo: 'bg-muted-foreground' };

export const clasesDelColor = (color: string | undefined) =>
  (color === undefined ? undefined : CLASES_DEL_COLOR[color]) ?? NEUTRO;
