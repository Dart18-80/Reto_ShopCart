import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { renderizar } from '../../test/renderizar';
import { useParametrosUrl } from './useParametrosUrl';

const consultaSchema = z
  .object({
    pagina: z.coerce.number().int().min(1).default(1),
    tamano: z.coerce.number().int().min(1).max(100).default(20),
    estado: z.enum(['Pagado', 'Entregado']).optional(),
    desde: z.string().optional(),
    hasta: z.string().optional(),
    disponible: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
  })
  .refine(({ desde, hasta }) => !desde || !hasta || desde <= hasta, { path: ['desde'] });

function Valores() {
  const { valores, hayFiltros, cambiar } = useParametrosUrl(consultaSchema);
  return (
    <>
      <p>{JSON.stringify(valores)}</p>
      <p>{hayFiltros ? 'con filtros' : 'sin filtros'}</p>
      <button
        type="button"
        onClick={() => {
          cambiar({ estado: 'Pagado', tamano: 20, disponible: true });
        }}
      >
        Filtrar
      </button>
    </>
  );
}

describe('useParametrosUrl', () => {
  it('sin URL da los valores por defecto del esquema y no hay filtros', () => {
    renderizar(<Valores />, { ruta: '/' });

    expect(screen.getByText('{"pagina":1,"tamano":20}')).toBeInTheDocument();
    expect(screen.getByText('sin filtros')).toBeInTheDocument();
  });

  it('un campo inválido cae a su valor por defecto sin tirar los demás', () => {
    renderizar(<Valores />, { ruta: '/?pagina=-3&estado=Pagado&tamano=500' });

    expect(screen.getByText('{"pagina":1,"tamano":20,"estado":"Pagado"}')).toBeInTheDocument();
    expect(screen.getByText('con filtros')).toBeInTheDocument();
  });

  it('si falla una regla del objeto, se descarta el campo que señala', () => {
    renderizar(<Valores />, { ruta: '/?desde=2026-11-05&hasta=2026-11-01' });

    expect(screen.getByText('{"pagina":1,"tamano":20,"hasta":"2026-11-01"}')).toBeInTheDocument();
  });

  it('escribe en la URL solo lo que difiere del valor por defecto, booleanos incluidos', async () => {
    const { usuario, router } = renderizar(<Valores />, { ruta: '/?pagina=2' });

    await usuario.click(screen.getByRole('button', { name: 'Filtrar' }));

    expect(router.state.location.search).toBe('?estado=Pagado&disponible=true');
  });
});
