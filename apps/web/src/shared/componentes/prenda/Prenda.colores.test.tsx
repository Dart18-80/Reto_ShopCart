import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Prenda } from './Prenda';
import { TIPOS_DE_PRENDA } from './trazos';

// Los 13 colores de la semilla (S004) y el nombre de su variable en la colección Prenda de Figma (FE-15).
const COLORES_DE_LA_SEMILLA: Record<string, string> = {
  Negro: 'negro',
  Blanco: 'blanco',
  Gris: 'gris',
  Azul: 'azul',
  'Azul marino': 'azul-marino',
  Celeste: 'celeste',
  Rojo: 'rojo',
  Vino: 'vino',
  Rosado: 'rosado',
  Verde: 'verde',
  Mostaza: 'mostaza',
  Beige: 'beige',
  Café: 'cafe',
};

const TEMA = readFileSync(resolve(import.meta.dirname, '../../../app/tema.css'), 'utf8');

describe('Prenda: los seis tipos con todos los colores del mapa', () => {
  it.each(Object.entries(COLORES_DE_LA_SEMILLA))(
    '«%s» tiñe los seis tipos con text-prenda-%s',
    (color, variable) => {
      for (const tipo of TIPOS_DE_PRENDA) {
        const { unmount } = render(<Prenda tipo={tipo} color={color} />);
        const figura = screen.getByRole('img', { name: `${tipo} color ${color}` });
        expect(figura).toHaveClass(`text-prenda-${variable}`);
        expect(figura.querySelector('[data-capa="tela"]')).toHaveAttribute('fill', 'currentColor');
        unmount();
      }
    },
  );

  it.each(Object.values(COLORES_DE_LA_SEMILLA))(
    'la variable --prenda-%s existe en el tema y tiene su utilidad de Tailwind',
    (variable) => {
      expect(TEMA).toMatch(new RegExp(`--prenda-${variable}: #[0-9a-f]{6};`));
      expect(TEMA).toContain(`--color-prenda-${variable}: var(--prenda-${variable});`);
    },
  );
});
