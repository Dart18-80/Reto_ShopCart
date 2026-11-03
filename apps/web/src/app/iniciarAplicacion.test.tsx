import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { sesion, type Respuesta } from '../shared/api';
import { sesionDePrueba } from '../test/sesion';
import { servidor } from '../test/servidor';
import { iniciarAplicacion } from './iniciarAplicacion';

type RespuestaRefresh = Respuesta<'/api/v1/auth/refresh', 'post'>;

function simularRefresh() {
  const llamadas = { total: 0 };
  servidor.use(
    http.post('/api/v1/auth/refresh', () => {
      llamadas.total += 1;
      return HttpResponse.json<RespuestaRefresh>({
        datos: { ...sesionDePrueba('token-rehidratado'), expiraEn: 900 },
      });
    }),
  );
  return llamadas;
}

function crearRaiz() {
  const raiz = document.createElement('div');
  document.body.append(raiz);
  return raiz;
}

const aplicaciones: { desmontar: () => void }[] = [];
afterEach(() => {
  aplicaciones.splice(0).forEach((aplicacion) => {
    aplicacion.desmontar();
  });
});

describe('iniciarAplicacion (main.tsx)', () => {
  it('con StrictMode, al cargar la aplicación hay un solo refresh', async () => {
    const refresh = simularRefresh();

    aplicaciones.push(iniciarAplicacion(crearRaiz()));
    await sesion.esperarRehidratacion();

    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(refresh.total).toBe(1);
    expect(sesion.estado()).toMatchObject({ tipo: 'activa' });
  });

  it('cuando cambia el usuario, la caché queda vacía', async () => {
    simularRefresh();
    const aplicacion = iniciarAplicacion(crearRaiz());
    aplicaciones.push(aplicacion);
    await sesion.esperarRehidratacion();
    aplicacion.queryClient.setQueryData(['pedidos', 'lista'], { datos: ['pedido de Ana'] });

    sesion.establecer(sesionDePrueba('token-de-luis', 'Operador'));

    expect(aplicacion.queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});
