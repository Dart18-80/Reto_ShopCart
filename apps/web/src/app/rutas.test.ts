import { matchRoutes } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { Rol } from '../shared/api';
import { conId, RUTAS } from '../shared/rutas';
import { ACCESO_DE_AREA, PAGINAS, RAIZ_DE_AREA } from './rutas';
import { crearRutas } from './router';

const ROLES: readonly Rol[] = ['Cliente', 'Operador', 'Administrador'];

describe('las rutas compartidas (revisión de la Fase 2)', () => {
  it('cada ruta de shared/rutas es una página o la raíz de un área: un enlace no puede apuntar a la nada', () => {
    const existentes = new Set([...PAGINAS.map((p) => p.ruta), ...Object.values(RAIZ_DE_AREA)]);

    for (const [nombre, ruta] of Object.entries(RUTAS)) {
      expect(existentes.has(ruta), `${nombre}: ${ruta}`).toBe(true);
    }
  });

  it('conId pone el número en lugar de :id', () => {
    expect(conId(RUTAS.pedido, 7)).toBe('/pedidos/7');
    expect(conId(RUTAS.productoAdmin, 31)).toBe('/backoffice/catalogo/productos/31');
  });
});

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
