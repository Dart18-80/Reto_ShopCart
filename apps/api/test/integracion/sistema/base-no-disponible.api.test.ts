import { pino } from 'pino';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { crearApp } from '../../../src/app.js';
import { cargarConfiguracion } from '../../../src/shared/config/index.js';
import { conectarPool, configurarBaseDatos } from '../../../src/shared/db/index.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';

// Un puerto en el que nadie escucha, en el mismo servidor de SQL Server de las pruebas: el pool no puede abrir
// la conexión, igual que con la base caída.
const PUERTO_SIN_SQL_SERVER = 1;
const PLAZO_DE_CONEXION_MS = 1000;

/**
 * A-26: ejecutarSP contra una base que no responde. Cada llamada intenta abrir una conexión con mssql y recibe su
 * ConnectionError real (el mismo de «Failed to connect to sqlserver:1433»): el SP nunca llega a correr.
 */
beforeAll(() => {
  const { baseDatos } = cargarConfiguracion(process.env);
  const caida = {
    ...baseDatos,
    puerto: PUERTO_SIN_SQL_SERVER,
    tiempoMaximoConexionMs: PLAZO_DE_CONEXION_MS,
  };
  configurarBaseDatos(
    {
      ejecutar: async () => {
        await conectarPool(caida);
        throw new Error('Se conectó a un puerto en el que no hay SQL Server');
      },
    },
    pino({ level: 'silent' }),
  );
});

describe('la base no disponible (A-26)', () => {
  it('no poder obtener una conexión responde 503 BASE_NO_DISPONIBLE con Retry-After, no 500', async () => {
    const app = crearApp(dependenciasDePrueba());

    const respuesta = await request(app)
      .post('/api/v1/auth/login')
      .send({ correo: 'cliente@shopcart.gt', contrasena: 'Cliente2026!' });

    expect(respuesta.status).toBe(503);
    expect(respuesta.headers['retry-after']).toBe('5');
    expect(respuesta.body).toMatchObject({
      error: {
        codigo: 'BASE_NO_DISPONIBLE',
        mensaje: 'La tienda no está disponible en este momento. Intenta de nuevo en unos segundos.',
      },
    });
  });

  it('también en una lectura pública', async () => {
    const app = crearApp(dependenciasDePrueba());

    const respuesta = await request(app).get('/api/v1/productos');

    expect(respuesta.status).toBe(503);
    expect(respuesta.headers['retry-after']).toBe('5');
  });
});
