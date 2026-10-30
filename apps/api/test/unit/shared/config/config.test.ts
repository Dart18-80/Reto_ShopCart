import { describe, expect, it } from 'vitest';
import { cargarConfiguracion, ErrorConfiguracion } from '../../../../src/shared/config/index.js';

const ENTORNO_VALIDO = {
  DB_APP_CONTRASENA: 'EJEMPLO_Cambiar_App_2026!',
  REDIS_URL: 'redis://:EJEMPLO_Cambiar_Redis_2026@localhost:6379',
  CORS_ORIGINS: 'http://localhost:5173, http://localhost:8080',
};

describe('cargarConfiguracion', () => {
  it('aplica los valores por defecto y separa la lista de orígenes CORS', () => {
    const config = cargarConfiguracion(ENTORNO_VALIDO);

    expect(config.puerto).toBe(3000);
    expect(config.entorno).toBe('development');
    expect(config.baseDatos.nombre).toBe('ShopCart');
    expect(config.origenesCors).toEqual(['http://localhost:5173', 'http://localhost:8080']);
  });

  it('falla con un mensaje que nombra la variable que falta', () => {
    const incompleto = { ...ENTORNO_VALIDO, DB_APP_CONTRASENA: undefined };

    expect(() => cargarConfiguracion(incompleto)).toThrow(ErrorConfiguracion);
    expect(() => cargarConfiguracion(incompleto)).toThrow(/DB_APP_CONTRASENA/);
  });

  it('rechaza una REDIS_URL que no es redis://', () => {
    expect(() =>
      cargarConfiguracion({ ...ENTORNO_VALIDO, REDIS_URL: 'http://localhost:6379' }),
    ).toThrow(/REDIS_URL/);
  });

  it('§10: en producción rechaza los secretos de ejemplo', () => {
    expect(() => cargarConfiguracion({ ...ENTORNO_VALIDO, NODE_ENV: 'production' })).toThrow(
      /EJEMPLO/,
    );
  });

  it('en producción acepta secretos propios', () => {
    const config = cargarConfiguracion({
      ...ENTORNO_VALIDO,
      NODE_ENV: 'production',
      DB_APP_CONTRASENA: 'Una_Contrasena_Real_9',
      REDIS_URL: 'redis://:OtraContrasenaReal@redis:6379',
    });

    expect(config.entorno).toBe('production');
  });
});
