import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { sesion, type Respuesta } from '../api';
import { renderizar } from '../../test/renderizar';
import { sesionDePrueba } from '../../test/sesion';
import { servidor } from '../../test/servidor';
import { useSesion } from './useSesion';

type RespuestaRefresh = Respuesta<'/api/v1/auth/refresh', 'post'>;

function QuienSoy() {
  const { usuario, rol, rehidratando, errorDeVerificacion, tieneRol, reintentarVerificacion } =
    useSesion();
  if (rehidratando) return <p>Verificando la sesión</p>;
  if (errorDeVerificacion) {
    return (
      <>
        <p>{errorDeVerificacion.mensaje}</p>
        <button type="button" onClick={reintentarVerificacion}>
          Reintentar
        </button>
      </>
    );
  }
  return (
    <>
      <p>{usuario ? `${usuario.nombre} (${String(rol)})` : 'Invitado'}</p>
      <p>{tieneRol('Operador', 'Administrador') ? 'Ve el backoffice' : 'No ve el backoffice'}</p>
    </>
  );
}

describe('useSesion', () => {
  it('sin sesión es un invitado sin rol', () => {
    renderizar(<QuienSoy />);

    expect(screen.getByText('Invitado')).toBeInTheDocument();
    expect(screen.getByText('No ve el backoffice')).toBeInTheDocument();
  });

  it('con sesión expone el usuario, su rol y tieneRol()', () => {
    renderizar(<QuienSoy />, { rol: 'Operador' });

    expect(screen.getByText('Luis Operador (Operador)')).toBeInTheDocument();
    expect(screen.getByText('Ve el backoffice')).toBeInTheDocument();
  });

  it('se actualiza cuando la sesión cambia fuera de React', async () => {
    renderizar(<QuienSoy />, { rol: 'Cliente' });

    sesion.establecer(sesionDePrueba('token-de-marta', 'Administrador'));

    expect(await screen.findByText('Marta Administradora (Administrador)')).toBeInTheDocument();
  });

  it('si la rehidratación falla por red queda no verificada, con el error y Reintentar', async () => {
    let intentos = 0;
    servidor.use(
      http.post('/api/v1/auth/refresh', () => {
        intentos += 1;
        if (intentos === 1) return HttpResponse.error();
        return HttpResponse.json<RespuestaRefresh>({
          datos: { ...sesionDePrueba('token-rehidratado'), expiraEn: 900 },
        });
      }),
    );
    void sesion.rehidratar();
    const { usuario } = renderizar(<QuienSoy />);

    expect(screen.getByText('Verificando la sesión')).toBeInTheDocument();
    expect(await screen.findByText(/No pudimos conectar con la tienda/)).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Ana Cliente (Cliente)')).toBeInTheDocument();
  });
});
