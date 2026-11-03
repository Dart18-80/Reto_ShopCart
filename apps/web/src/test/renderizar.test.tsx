import { useQuery } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Link, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { renderizar } from './renderizar';
import { servidor } from './servidor';

function RutaActual() {
  const { pathname, search } = useLocation();
  return (
    <>
      <p>{`${pathname}${search}`}</p>
      <Link to="/otra">Ir a otra</Link>
    </>
  );
}

const RUTA_PRUEBA = '/api/v1/prueba';

function ConsultaQueFalla() {
  const consulta = useQuery({
    queryKey: ['prueba-renderizar'],
    queryFn: async () => {
      const respuesta = await fetch(RUTA_PRUEBA);
      if (!respuesta.ok) throw new Error(String(respuesta.status));
      return 'ok';
    },
  });
  return <p>{consulta.status}</p>;
}

describe('renderizar()', () => {
  it('monta el router en memoria en la ruta indicada', async () => {
    const { usuario } = renderizar(<RutaActual />, { ruta: '/catalogo?pagina=2' });

    expect(screen.getByText('/catalogo?pagina=2')).toBeInTheDocument();
    await usuario.click(screen.getByRole('link', { name: 'Ir a otra' }));
    expect(await screen.findByText('/otra')).toBeInTheDocument();
  });

  it('monta un QueryClient sin reintentos: un error se muestra en el primer intento', async () => {
    let llamadas = 0;
    servidor.use(
      http.get(RUTA_PRUEBA, () => {
        llamadas += 1;
        return new HttpResponse(null, { status: 503 });
      }),
    );

    renderizar(<ConsultaQueFalla />);

    expect(await screen.findByText('error')).toBeInTheDocument();
    expect(llamadas).toBe(1);
  });
});
