import { describe, expect, it } from 'vitest';
import { cargarConfiguracion, ErrorConfiguracion } from '../../../../src/shared/config/index.js';

const ENTORNO_VALIDO = {
  DB_USUARIO: 'shopcart_app',
  DB_CONTRASENA: 'EJEMPLO_Cambiar_App_2026!',
  REDIS_CONTRASENA: 'EJEMPLO_Cambiar_Redis_2026',
  CORS_ORIGINS: 'http://localhost:5173, http://localhost:8080',
};

describe('cargarConfiguracion', () => {
  it('aplica los valores por defecto y separa la lista de orígenes CORS', () => {
    const config = cargarConfiguracion(ENTORNO_VALIDO);

    expect(config.puerto).toBe(3000);
    expect(config.entorno).toBe('development');
    expect(config.baseDatos).toMatchObject({
      servidor: 'localhost',
      puerto: 1433,
      nombre: 'ShopCart',
      usuario: 'shopcart_app',
    });
    expect(config.redis).toEqual({
      servidor: 'localhost',
      puerto: 6379,
      contrasena: 'EJEMPLO_Cambiar_Redis_2026',
    });
    expect(config.origenesCors).toEqual(['http://localhost:5173', 'http://localhost:8080']);
  });

  it('toma el host y el puerto de SQL Server y de Redis por separado', () => {
    const config = cargarConfiguracion({
      ...ENTORNO_VALIDO,
      DB_HOST: 'sqlserver',
      DB_PORT: '1434',
      REDIS_HOST: 'redis',
      REDIS_PORT: '6380',
    });

    expect(config.baseDatos).toMatchObject({ servidor: 'sqlserver', puerto: 1434 });
    expect(config.redis).toMatchObject({ servidor: 'redis', puerto: 6380 });
  });

  it.each(['DB_USUARIO', 'DB_CONTRASENA', 'REDIS_CONTRASENA', 'CORS_ORIGINS'])(
    'falla con un mensaje que nombra la variable que falta: %s',
    (variable) => {
      const incompleto = { ...ENTORNO_VALIDO, [variable]: undefined };

      expect(() => cargarConfiguracion(incompleto)).toThrow(ErrorConfiguracion);
      expect(() => cargarConfiguracion(incompleto)).toThrow(new RegExp(variable));
    },
  );

  it('rechaza un puerto que no es un número', () => {
    expect(() => cargarConfiguracion({ ...ENTORNO_VALIDO, REDIS_PORT: 'seis' })).toThrow(
      /REDIS_PORT/,
    );
  });

  it('§10: en producción rechaza los secretos de ejemplo', () => {
    expect(() => cargarConfiguracion({ ...ENTORNO_VALIDO, NODE_ENV: 'production' })).toThrow(
      /DB_CONTRASENA, REDIS_CONTRASENA/,
    );
  });

  it('en producción acepta secretos propios', () => {
    const config = cargarConfiguracion({
      ...ENTORNO_VALIDO,
      NODE_ENV: 'production',
      DB_CONTRASENA: 'Una_Contrasena_Real_9',
      REDIS_CONTRASENA: 'OtraContrasenaReal',
    });

    expect(config.entorno).toBe('production');
  });
});
