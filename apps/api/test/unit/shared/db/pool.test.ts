import { describe, expect, it } from 'vitest';
import { opcionesDelPool } from '../../../../src/shared/db/pool.js';

const CONFIG = {
  servidor: 'sqlserver',
  puerto: 1433,
  nombre: 'ShopCart',
  usuario: 'shopcart_app',
  contrasena: 'x',
  confiarCertificado: true,
  tiempoMaximoConexionMs: 2000,
  tiempoMaximoConsultaMs: 15000,
};

describe('opcionesDelPool (A-26)', () => {
  it('mantiene dos conexiones abiertas por réplica, hasta diez', () => {
    expect(opcionesDelPool(CONFIG).pool).toEqual({ min: 2, max: 10 });
  });

  it('los plazos salen de la configuración (DB_TIMEOUT_CONEXION_MS y DB_TIMEOUT_CONSULTA_MS)', () => {
    expect(opcionesDelPool(CONFIG)).toMatchObject({
      connectionTimeout: 2000,
      requestTimeout: 15000,
    });
  });
});
