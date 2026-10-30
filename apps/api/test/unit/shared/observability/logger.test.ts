import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { ejecutarConContexto } from '../../../../src/shared/http/contexto.js';
import { crearLogger } from '../../../../src/shared/observability/logger.js';

function capturar() {
  const lineas: string[] = [];
  const destino = new Writable({
    write(fragmento: Buffer, _codificacion, listo) {
      lineas.push(fragmento.toString());
      listo();
    },
  });
  return { logger: crearLogger({ instancia: 'api-1', destino }), lineas };
}

describe('logger', () => {
  it('redacta contraseñas, tarjeta, CVV, authorization y cookies, también anidados', () => {
    const { logger, lineas } = capturar();

    logger.info(
      {
        contrasena: 'Secreta123',
        pago: { numeroTarjeta: '4111111111111111', cvv: '123' },
        req: { headers: { authorization: 'Bearer abc.def', cookie: 'refresh=xyz' } },
      },
      'prueba',
    );

    const linea = lineas.join('');
    for (const secreto of ['Secreta123', '4111111111111111', '"123"', 'abc.def', 'refresh=xyz']) {
      expect(linea).not.toContain(secreto);
    }
    expect(linea).toContain('[REDACTADO]');
  });

  it('agrega la instancia, el requestId y el usuario de la petición en curso', () => {
    const { logger, lineas } = capturar();

    ejecutarConContexto(
      { requestId: '8f1c2e9a-0000-4000-8000-000000000001', idUsuario: 7, rol: 'Cliente' },
      () => {
        logger.info('dentro de una petición');
      },
    );

    expect(lineas[0]).toContain('"instancia":"api-1"');
    expect(lineas[0]).toContain('"requestId":"8f1c2e9a-0000-4000-8000-000000000001"');
    expect(lineas[0]).toContain('"idUsuario":7');
  });
});
