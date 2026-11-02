import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  api,
  clientesSembrados,
  datos,
  error,
  existenciaDe,
  limpiarCarritos,
  metodoEstandar,
  tokenDeAdmin,
  varianteConExistencia,
  type Cliente,
} from '../concurrencia/apoyo-concurrencia.js';
import { compose, esperar, levantar } from './apoyo-entorno.js';

// RNF-2: la API sigue atendiendo con una réplica detenida y vende sin Redis. Detiene contenedores del
// entorno de Docker y los vuelve a levantar al terminar.

const PETICIONES = 20;
const TARJETA_APROBADA = '4242424242424242';

const pedidoSchema = z.object({ idPedido: z.number() });

const pagar = (cliente: Cliente, llave: string) =>
  api('POST', '/checkout/sesion/pagos', {
    token: cliente.token,
    encabezados: { 'Idempotency-Key': llave },
    cuerpo: {
      numeroTarjeta: TARJETA_APROBADA,
      mesVencimiento: 12,
      anioVencimiento: 2030,
      cvv: '123',
    },
  });

describe('RNF-2 en el entorno real (verificación de entrega)', () => {
  it(
    `con api-1 detenida, ${String(PETICIONES)} peticiones seguidas a través de nginx responden 200 desde api-2`,
    {
      timeout: 180_000,
    },
    async () => {
      await compose('stop', 'api-1');
      let respuestas: Awaited<ReturnType<typeof api>>[] = [];
      try {
        for (let i = 0; i < PETICIONES; i++) {
          respuestas.push(await api('GET', '/productos?tamano=1'));
        }
      } finally {
        await levantar('api-1');
      }

      expect(respuestas.map((r) => r.status)).toEqual(Array<number>(PETICIONES).fill(200));
      expect(new Set(respuestas.map((r) => r.instancia))).toEqual(new Set(['api-2']));
      // nginx la reincorpora sola al volver.
      await esperar(async () => {
        respuestas = await Promise.all(
          Array.from({ length: 4 }, () => api('GET', '/productos?tamano=1')),
        );
        return respuestas.some((r) => r.instancia === 'api-1');
      }, 'nginx vuelve a enviar peticiones a api-1');
    },
  );

  it(
    'con Redis detenido, un checkout completo vende la última unidad una sola vez y cobra una sola vez',
    {
      timeout: 180_000,
    },
    async () => {
      const tokenAdmin = await tokenDeAdmin();
      const idMetodoEnvio = await metodoEstandar();
      const clientes = await clientesSembrados(2);
      await limpiarCarritos(clientes);
      const variante = await varianteConExistencia(tokenAdmin, 1);

      await compose('stop', 'redis');
      try {
        const salud = await api('GET', '/health');
        for (const cliente of clientes) {
          const agregado = await api('POST', '/carrito/lineas', {
            token: cliente.token,
            cuerpo: { idVariante: variante.idVariante, cantidad: 1 },
          });
          expect([200, 201]).toContain(agregado.status);
        }
        const sesiones = await Promise.all(
          clientes.map((cliente) =>
            api('POST', '/checkout/sesion', {
              token: cliente.token,
              cuerpo: { idDireccion: cliente.idDireccion, idMetodoEnvio },
            }),
          ),
        );
        const ganador = clientes[sesiones.findIndex((s) => s.status === 201)];
        if (ganador === undefined) throw new Error('Ninguna sesión de pago se creó');
        const llave = randomUUID();

        const pago = await pagar(ganador, llave);
        const reintento = await pagar(ganador, llave);

        expect(
          z.object({ datos: z.object({ redis: z.string() }) }).parse(salud.cuerpo).datos.redis,
        ).toBe('degradado');
        expect(sesiones.map((s) => s.status).toSorted()).toEqual([201, 409]);
        expect(sesiones.map((s) => error(s)?.codigo).filter(Boolean)).toEqual([
          'STOCK_INSUFICIENTE',
        ]);
        expect(pago.status).toBe(201);
        expect(reintento.status).toBe(200); // N-03: la misma llave devuelve el mismo pedido, sin volver a cobrar
        expect(datos(reintento, pedidoSchema).idPedido).toBe(datos(pago, pedidoSchema).idPedido);
      } finally {
        await levantar('redis');
      }

      expect(await existenciaDe(tokenAdmin, variante)).toMatchObject({
        existenciaFisica: 0,
        disponible: 0,
      });
      const conciliacion = await api('GET', '/inventario/conciliacion', { token: tokenAdmin });
      expect(datos(conciliacion, z.array(z.unknown()))).toEqual([]);
    },
  );
});
