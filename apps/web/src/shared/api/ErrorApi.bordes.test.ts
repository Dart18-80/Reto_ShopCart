import { describe, expect, it } from 'vitest';
import { ErrorApi } from './ErrorApi';

const respuesta = (
  cuerpo: BodyInit | null,
  status: number,
  encabezados: Record<string, string> = {},
) => new Response(cuerpo, { status, headers: encabezados });

describe('ErrorApi.desdeRespuesta: casos borde', () => {
  it('un 502 de nginx con HTML es una respuesta inesperada que conserva status y X-Request-Id', async () => {
    const error = await ErrorApi.desdeRespuesta(
      respuesta('<html><body>502 Bad Gateway</body></html>', 502, {
        'Content-Type': 'text/html',
        'X-Request-Id': 'req-nginx',
      }),
    );

    expect(error).toMatchObject({
      status: 502,
      codigo: 'RESPUESTA_INESPERADA',
      requestId: 'req-nginx',
    });
  });

  it('un JSON que no tiene el formato de A-06 (sin requestId) es una respuesta inesperada', async () => {
    const error = await ErrorApi.desdeRespuesta(
      respuesta(JSON.stringify({ error: { codigo: 'X', mensaje: 'Y' } }), 409),
    );

    expect(error.codigo).toBe('RESPUESTA_INESPERADA');
    expect(error.status).toBe(409);
  });

  it('un arreglo o un texto en lugar del objeto de error es una respuesta inesperada', async () => {
    for (const cuerpo of ['[]', '"error"', 'null']) {
      const error = await ErrorApi.desdeRespuesta(respuesta(cuerpo, 400));
      expect(error.codigo).toBe('RESPUESTA_INESPERADA');
    }
  });

  it('un error de A-06 sin detalles deja detalles en undefined', async () => {
    const error = await ErrorApi.desdeRespuesta(
      respuesta(
        JSON.stringify({
          error: { codigo: 'NO_ENCONTRADO', mensaje: 'No existe.', requestId: 'r1' },
        }),
        404,
      ),
    );

    expect(error).toMatchObject({ status: 404, codigo: 'NO_ENCONTRADO', detalles: undefined });
    expect(error.esDeRed).toBe(false);
  });

  it('la respuesta inesperada no es «de red»: no se confunde con una falla de conexión', () => {
    expect(ErrorApi.inesperado().esDeRed).toBe(false);
    expect(ErrorApi.deRed().esDeRed).toBe(true);
  });
});
