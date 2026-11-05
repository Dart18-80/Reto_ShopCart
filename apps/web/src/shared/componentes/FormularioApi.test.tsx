import { telefonoSchema, textoNvarchar } from '@shopcart/shared';
import { onlineManager, useMutation } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  crearDireccionDePrueba,
  simularCreacionPendiente,
  simularErrorAlCrearDireccion,
} from '../../test/handlers/direcciones';
import { renderizar } from '../../test/renderizar';
import { servidor } from '../../test/servidor';
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

type Usuario = ReturnType<typeof renderizar>['usuario'];

// Pegar en lugar de teclear: la misma interacción para el formulario y no depende de la carga de la máquina.
async function escribirEn(usuario: Usuario, etiqueta: string, texto: string) {
  await usuario.click(screen.getByLabelText(etiqueta));
  await usuario.paste(texto);
}

async function llenarYEnviar(usuario: Usuario) {
  await escribirEn(usuario, 'Quién recibe', 'Ana Pérez');
  await escribirEn(usuario, 'Teléfono', '55551234');
  await escribirEn(usuario, 'Municipio', '101');
  await escribirEn(usuario, 'Dirección', '5a avenida 10-20, zona 1');
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

describe('useFormularioApi: casos borde del 400', () => {
  it.each([
    ['un campo de la query', [{ campo: 'query.pagina', mensaje: 'Página inválida.' }]],
    ['un campo que el formulario no tiene', [{ campo: 'body.inexistente', mensaje: 'No va.' }]],
    ['detalles vacíos', []],
    ['detalles que no son una lista', { campo: 'body.nombreRecibe' }],
  ])('con %s, el mensaje del backend va al aviso general', async (_caso, detalles) => {
    simularErrorAlCrearDireccion(400, {
      codigo: 'PARAMETRO_INVALIDO',
      mensaje: 'Los datos enviados no son válidos.',
      detalles,
    });
    const { usuario } = renderizar(<FormularioDireccion />);

    await llenarYEnviar(usuario);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Los datos enviados no son válidos.',
    );
  });

  it('si un detalle tiene campo y otro no, marca el campo y además muestra el aviso', async () => {
    simularErrorAlCrearDireccion(400, {
      codigo: 'PARAMETRO_INVALIDO',
      mensaje: 'Los datos enviados no son válidos.',
      detalles: [
        { campo: 'body.nombreRecibe', mensaje: 'Escribe el nombre completo.' },
        { campo: 'query.otro', mensaje: 'No va.' },
      ],
    });
    const { usuario } = renderizar(<FormularioDireccion />);

    await llenarYEnviar(usuario);

    expect(await screen.findByText('Escribe el nombre completo.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Los datos enviados no son válidos.');
  });

  it('un nombre con tildes, ñ y emoji llega íntegro al backend', async () => {
    const cuerpos = simularErrorAlCrearDireccion(422, { codigo: 'X', mensaje: 'Rechazado.' });
    const { usuario } = renderizar(<FormularioDireccion />);

    await escribirEn(usuario, 'Quién recibe', '  Begoña Núñez 🌋  ');
    await escribirEn(usuario, 'Teléfono', '55551234');
    await escribirEn(usuario, 'Municipio', '101');
    await escribirEn(usuario, 'Dirección', 'Zona 1');
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));
    await screen.findByRole('alert');

    // textoNvarchar recorta y normaliza (NFC) antes de enviar, igual que la API.
    expect(cuerpos).toEqual([expect.objectContaining({ nombreRecibe: 'Begoña Núñez 🌋' })]);
  });
});

describe('useFormularioApi: un error que no es del backend', () => {
  it('un 201 con un cuerpo que no es JSON muestra el aviso genérico, nunca nada', async () => {
    servidor.use(
      http.post(
        '/api/v1/direcciones',
        () =>
          new HttpResponse('<html>creada</html>', {
            status: 201,
            headers: { 'Content-Type': 'text/html' },
          }),
      ),
    );
    const { usuario } = renderizar(<FormularioDireccion />);

    await llenarYEnviar(usuario);

    expect(await screen.findByRole('alert')).toHaveTextContent('Algo salió mal de nuestro lado');
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
  });
});

describe('useFormularioApi: doble envío', () => {
  it('un doble clic en Guardar envía una sola vez', async () => {
    const creacion = simularCreacionPendiente();
    const { usuario } = renderizar(<FormularioDireccion />);
    await escribirEn(usuario, 'Quién recibe', 'Ana Pérez');
    await escribirEn(usuario, 'Teléfono', '55551234');
    await escribirEn(usuario, 'Municipio', '101');
    await escribirEn(usuario, 'Dirección', 'Zona 1');

    await usuario.dblClick(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    });
    creacion.responder();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
    });
    expect(creacion.envios()).toBe(1);
  });
});

describe('useFormularioApi sin conexión (FE-02: networkMode always)', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
    vi.restoreAllMocks();
  });

  it('sin red el envío no queda pausado: muestra «Sin conexión» y Guardar vuelve a estar disponible', async () => {
    onlineManager.setOnline(false);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    servidor.use(http.post('/api/v1/direcciones', () => HttpResponse.error()));
    const { usuario } = renderizar(<FormularioDireccion />);

    await llenarYEnviar(usuario);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sin conexión. Revisa tu internet e intenta de nuevo.',
    );
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
  });
});

describe('useFormularioApi: la forma real del 400 de la API', () => {
  it('un 400 VALIDACION_FALLIDA con detalles.errores (manejar, A-20) marca cada campo', async () => {
    simularErrorAlCrearDireccion(400, {
      codigo: 'VALIDACION_FALLIDA',
      mensaje: 'Los datos enviados no son válidos.',
      detalles: { errores: [{ campo: 'body.direccionLinea', mensaje: 'No puede estar vacío.' }] },
    });
    const { usuario } = renderizar(<FormularioDireccion />);

    await llenarYEnviar(usuario);

    expect(await screen.findByLabelText('Dirección')).toHaveAccessibleDescription(
      'No puede estar vacío.',
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
