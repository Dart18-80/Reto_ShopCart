import { matchRoutes } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { Rol } from '../shared/api';
import { ACCESO_DE_AREA, PAGINAS, RAIZ_DE_AREA } from './rutas';
import { crearRutas } from './router';

const ROLES: readonly Rol[] = ['Cliente', 'Operador', 'Administrador'];

describe('definición de rutas (una sola fuente para el guardián y los menús)', () => {
  it('cada entrada de menú apunta a una ruta del router con los mismos roles', () => {
    const rutas = crearRutas();

    for (const pagina of PAGINAS.filter((p) => p.menu)) {
      const coincidencias = matchRoutes(rutas, pagina.ruta) ?? [];
      const destino = coincidencias.at(-1)?.route;

      expect(destino?.path, pagina.ruta).toBe(pagina.ruta);
      expect(destino?.handle, pagina.ruta).toEqual({ acceso: pagina.acceso });
    }
  });

  it('cada página vive dentro de su área y no admite a nadie que el área no admita', () => {
    for (const pagina of PAGINAS) {
      const area = ACCESO_DE_AREA[pagina.area];

      expect(pagina.ruta.startsWith(RAIZ_DE_AREA[pagina.area]), pagina.ruta).toBe(true);
      if (pagina.acceso.invitado) expect(area.invitado, pagina.ruta).toBe(true);
      for (const rol of pagina.acceso.roles) expect(area.roles, pagina.ruta).toContain(rol);
    }
  });

  it('no hay dos páginas con la misma ruta', () => {
    const rutas = PAGINAS.map((p) => p.ruta);

    expect(new Set(rutas).size).toBe(rutas.length);
  });

  it('todo rol tiene al menos una página en el menú de cada área en que entra', () => {
    for (const [area, acceso] of Object.entries(ACCESO_DE_AREA)) {
      for (const rol of ROLES.filter((r) => acceso.roles.includes(r))) {
        const visibles = PAGINAS.filter(
          (p) => p.area === area && p.menu && p.acceso.roles.includes(rol),
        );
        expect(visibles.length, `${rol} en ${area}`).toBeGreaterThan(0);
      }
    }
  });
});
