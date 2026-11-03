import { telefonoSchema, textoNvarchar } from '@shopcart/shared';
import { useMutation } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  crearDireccionDePrueba,
  simularCreacionPendiente,
  simularErrorAlCrearDireccion,
} from '../../test/handlers/direcciones';
import { renderizar } from '../../test/renderizar';
import { AvisoFormulario } from './AvisoFormulario';
import { CampoFormulario } from './CampoFormulario';
import { Button } from '../ui/button';
import { Form } from '../ui/form';
import { useFormularioApi } from '../hooks/useFormularioApi';

// Subconjunto del esquema de la API (direcciones.schemas.ts); el real pasa a packages/shared con el módulo
// Checkout (05 §16).
const crearDireccionSchema = z.object({
  nombreRecibe: textoNvarchar(100),
  telefonoRecibe: telefonoSchema,
  idMunicipio: z.coerce.number().int().positive(),
  direccionLinea: textoNvarchar(200),
  esPredeterminada: z.boolean().default(false),
});

function FormularioDireccion({ alTerminar }: { alTerminar?: () => void }) {
  const formulario = useFormularioApi({
    esquema: crearDireccionSchema,
    mutacion: useMutation({ mutationFn: crearDireccionDePrueba }),
    valoresIniciales: {
      nombreRecibe: '',
      telefonoRecibe: '',
      idMunicipio: '',
      direccionLinea: '',
    },
    alTerminar,
  });
  return (
    <Form {...formulario.form}>
      <form onSubmit={formulario.enviar} noValidate>
        <AvisoFormulario error={formulario.errorGeneral} />
        <CampoFormulario nombre="nombreRecibe" etiqueta="Quién recibe" />
        <CampoFormulario nombre="telefonoRecibe" etiqueta="Teléfono" inputMode="tel" />
        <CampoFormulario nombre="idMunicipio" etiqueta="Municipio" inputMode="numeric" />
        <CampoFormulario nombre="direccionLinea" etiqueta="Dirección" />
        <Button type="submit" disabled={formulario.enviando}>
          Guardar
        </Button>
      </form>
    </Form>
  );
}

async function llenarYEnviar(usuario: ReturnType<typeof renderizar>['usuario']) {
  await usuario.type(screen.getByLabelText('Quién recibe'), 'Ana Pérez');
  await usuario.type(screen.getByLabelText('Teléfono'), '55551234');
  await usuario.type(screen.getByLabelText('Municipio'), '101');
  await usuario.type(screen.getByLabelText('Dirección'), '5a avenida 10-20, zona 1');
  await usuario.click(screen.getByRole('button', { name: 'Guardar' }));
}

describe('useFormularioApi (FE-03)', () => {
  it('un 400 con detalles marca cada campo (body.nombreRecibe → nombreRecibe)', async () => {
    simularErrorAlCrearDireccion(400, {
      codigo: 'PARAMETRO_INVALIDO',
      mensaje: 'Los datos enviados no son válidos.',
      detalles: [{ campo: 'body.nombreRecibe', mensaje: 'Escribe el nombre completo.' }],
    });
    const { usuario } = renderizar(<FormularioDireccion />);

    await llenarYEnviar(usuario);

    expect(await screen.findByText('Escribe el nombre completo.')).toBeInTheDocument();
    expect(screen.getByLabelText('Quién recibe')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Teléfono')).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('un 422 muestra el mensaje del backend en el aviso del formulario', async () => {
    simularErrorAlCrearDireccion(422, {
      codigo: 'MUNICIPIO_INEXISTENTE',
      mensaje: 'Ese municipio no existe.',
    });
    const { usuario } = renderizar(<FormularioDireccion />);

    await llenarYEnviar(usuario);

    expect(await screen.findByRole('alert')).toHaveTextContent('Ese municipio no existe.');
    expect(screen.getByRole('alert')).not.toHaveTextContent('req-form-1');
  });

  it('un 5xx muestra el aviso con el requestId', async () => {
    simularErrorAlCrearDireccion(500, {
      codigo: 'ERROR_INTERNO',
      mensaje: 'Algo salió mal de nuestro lado. Intenta de nuevo en un momento.',
    });
    const { usuario } = renderizar(<FormularioDireccion />);

    await llenarYEnviar(usuario);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Código de la solicitud: req-form-1',
    );
  });

  it('valida en el navegador con el mismo esquema antes de enviar', async () => {
    const cuerpos = simularErrorAlCrearDireccion(500, { codigo: 'X', mensaje: 'X' });
    const { usuario } = renderizar(<FormularioDireccion />);

    await usuario.type(screen.getByLabelText('Teléfono'), '123');
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByLabelText('Quién recibe')).toHaveAccessibleDescription(
      'No puede estar vacío.',
    );
    expect(cuerpos).toHaveLength(0);
  });

  it('deshabilita Guardar mientras la mutación está en curso y avisa al terminar', async () => {
    const creacion = simularCreacionPendiente();
    const alTerminar = vi.fn();
    const { usuario } = renderizar(<FormularioDireccion alTerminar={alTerminar} />);

    await llenarYEnviar(usuario);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    });
    creacion.responder();
    await waitFor(() => {
      expect(alTerminar).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
  });
});
