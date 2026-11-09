import { screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { crearRutas } from '../../../app/router';
import { simularRegistro, simularRegistroFallido } from '../../../test/handlers/auth';
import { PLAZO_DE_PRECARGA_MS, precargarDashboard } from '../../../test/precargar';
import { renderizarRutas } from '../../../test/renderizar';
import { estadoDeLaSesion } from '../../../test/sesion';

type Usuario = ReturnType<typeof renderizarRutas>['usuario'];

async function llenar(usuario: Usuario, datos: { contrasena: string; correo?: string }) {
  await usuario.type(await screen.findByLabelText('Nombre'), 'Ana Pérez');
  await usuario.type(screen.getByLabelText('Correo electrónico'), datos.correo ?? 'ana@prueba.gt');
  await usuario.type(screen.getByLabelText('Contraseña'), datos.contrasena);
}

// Un Administrador que ya tenía sesión termina en el dashboard.
beforeAll(precargarDashboard, PLAZO_DE_PRECARGA_MS);

describe('RegistroPagina (M1-H01)', () => {
  it('una contraseña sin números se rechaza en el navegador con el mismo mensaje del backend', async () => {
    const cuerpos = simularRegistro();
    const { usuario } = renderizarRutas(crearRutas(), { ruta: '/registro' });

    await llenar(usuario, { contrasena: 'SoloLetras' });
    await usuario.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByLabelText('Contraseña')).toHaveAccessibleDescription(
      'Debe incluir al menos un número.',
    );
    expect(cuerpos).toHaveLength(0);
  });

  it('un correo ya registrado (409) marca el campo correo con el mensaje del backend', async () => {
    simularRegistroFallido(409, 'CORREO_EN_USO', 'El correo ya está registrado.');
    const { usuario } = renderizarRutas(crearRutas(), { ruta: '/registro' });

    await llenar(usuario, { contrasena: 'Secreta2026' });
    await usuario.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByLabelText('Correo electrónico')).toHaveAccessibleDescription(
      'El correo ya está registrado.',
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('el teléfono es opcional; al registrarse abre la sesión y va a la tienda', async () => {
    const cuerpos = simularRegistro();
    const { usuario, router } = renderizarRutas(crearRutas(), { ruta: '/registro' });

    await llenar(usuario, { contrasena: 'Secreta2026' });
    await usuario.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    await waitFor(() => {
      expect(estadoDeLaSesion()).toMatchObject({ tipo: 'activa' });
    });
    expect(router.state.location.pathname).toBe('/');
    expect(cuerpos).toEqual([
      { nombre: 'Ana Pérez', correo: 'ana@prueba.gt', contrasena: 'Secreta2026' },
    ]);
  });

  it('con sesión activa, abrir /registro lleva al destino', async () => {
    const { router } = renderizarRutas(crearRutas(), { ruta: '/registro', rol: 'Administrador' });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/backoffice/dashboard');
    });
  });
});
