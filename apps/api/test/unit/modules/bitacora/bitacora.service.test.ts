import { describe, expect, it, vi } from 'vitest';
import { crearBitacoraService } from '../../../../src/modules/bitacora/bitacora.service.js';

describe('bitacora.service (E7-H02)', () => {
  it('lista con los filtros y la página pedidos; el SP valida el rango y el rol', async () => {
    const pagina = { filas: [], total: 0 };
    const repositorio = { listar: vi.fn(() => Promise.resolve(pagina)) };
    const consulta = { modulo: 'Cupones' as const, pagina: 1, tamano: 20 };

    const resultado = await crearBitacoraService({ repositorio }).listar(consulta);

    expect(resultado).toBe(pagina);
    expect(repositorio.listar).toHaveBeenCalledWith(consulta);
  });
});
