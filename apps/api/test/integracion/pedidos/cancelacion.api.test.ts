import sql from 'mssql';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { crearPasarelaSimulada } from '../../../src/shared/adapters/pasarela-simulada.js';
import { ejecutarSP, ejecutarSPConjuntos } from '../../../src/shared/db/index.js';
import type { PasarelaPago } from '../../../src/shared/pasarela/index.js';
import { leerDatos, leerError } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { iniciarSesion, leerSesion } from '../auth/apoyo-auth.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { comoCliente } from '../carrito/apoyo-carrito.js';
import { crearCupon, metodoEnvio } from '../checkout/apoyo-checkout.js';
import { unaFila } from '../datos-de-prueba.js';
import { pedidosRepository } from '../../../src/modules/pedidos/pedidos.repository.js';
import { pedidoPagado } from './apoyo-pedidos.js';

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());
let tokenOperador: string;
let tokenAdmin: string;
let estandar: number;

beforeAll(async () => {
  tokenOperador = leerSesion(
    await iniciarSesion(app, 'operador@shopcart.gt', 'Operador2026!'),
  ).accessToken;
  tokenAdmin = leerSesion(await iniciarSesion(app, 'admin@shopcart.gt', 'Admin2026!')).accessToken;
  estandar = await metodoEnvio(app);
});

interface Cancelacion {
  Estado: string;
  Total: number;
  MontoReembolsado: number;
  EstadoUsoCupon: string | null;
  Reingresos: number;
  EstadoIntento: string;
  CodigoIntento: string | null;
  LlaveIntento: string;
  IDTransaccionPasarela: string | null;
}
interface FilaReembolso {
  IDReembolso: number;
  Origen: string;
  Monto: number;
  Estado: string;
  Intentos: number;
  LlaveIdempotencia: string;
  IDTransaccionReembolso: string | null;
}

async function cancelacionDe(idPedido: number) {
  const [pedidos, reembolsos] = await ejecutarSPConjuntos<[Cancelacion[], FilaReembolso[]]>(
    'SP_Pruebas_LeerCancelacion',
    { IDPedido: { tipo: sql.Int, valor: idPedido } },
  );
  const pedido = pedidos?.[0];
  if (pedido === undefined || reembolsos === undefined) throw new Error('El pedido no existe');
  return { pedido, reembolsos };
}

async function enPasarela(llave: string) {
  const fila = await unaFila<{ Estado: string; Reembolsos: string | null }>(
    'SP_Pruebas_LeerPasarela',
    { LlaveIdempotencia: { tipo: sql.UniqueIdentifier, valor: llave } },
  );
  const reembolsos = z
    .array(z.object({ IDReembolso: z.string(), Monto: z.number() }))
    .parse(JSON.parse(fila.Reembolsos ?? '[]'));
  return { estado: fila.Estado, reembolsos };
}

const kardexDe = (idVariante: number) =>
  unaFila<{ ExistenciaFisica: number }>('SP_Pruebas_LeerKardex', {
    IDVariante: { tipo: sql.Int, valor: idVariante },
  });

const cancelarComoCliente = (
  aplicacion: typeof app,
  token: string,
  idPedido: number,
  motivo = 'Ya no lo necesito',
) =>
  request(aplicacion)
    .post(`/api/v1/pedidos/${String(idPedido)}/cancelar`)
    .set(comoCliente(token))
    .send({ motivo });
const cancelarDesdeGestion = (idPedido: number, motivo = 'Sin existencia en bodega') =>
  request(app)
    .post(`/api/v1/admin/pedidos/${String(idPedido)}/cancelar`)
    .set(comoCliente(tokenOperador))
    .send({ motivo });
const cambiar = (idPedido: number, estadoEsperado: string, estadoNuevo: string) =>
  request(app)
    .post(`/api/v1/admin/pedidos/${String(idPedido)}/estado`)
    .set(comoCliente(tokenOperador))
    .send({ estadoEsperado, estadoNuevo });

function pasarelaCon(cambios: Partial<PasarelaPago>): PasarelaPago {
  return { ...crearPasarelaSimulada(), ...cambios };
}

const cancelacionSchema = z.object({
  pedido: z.looseObject({ estado: z.string(), montoReembolsado: z.string() }),
  reembolso: z.object({ idReembolso: z.number(), estado: z.string() }),
});

describe('cancelación con reembolso (E6-H03, N-09)', () => {
  it('desde Pagado: Cancelado, reingreso al kardex, cupón revertido y reembolso del total con envío', async () => {
    const { codigo, idCupon } = await crearCupon(app, tokenAdmin, { limiteUsosTotal: 3 });
    const { cliente, pedido, variantes } = await pedidoPagado(app, estandar, {
      codigoCupon: codigo,
    });
    const [linea] = variantes;
    const existenciaVendida = (await kardexDe(linea?.idVariante ?? 0)).ExistenciaFisica;

    const respuesta = await cancelarComoCliente(app, cliente.token, pedido.idPedido);

    expect(respuesta.status).toBe(200);
    const datos = leerDatos(respuesta, cancelacionSchema);
    expect(datos.pedido.estado).toBe('Cancelado');
    expect(datos.reembolso.estado).toBe('Completado');
    expect((await kardexDe(linea?.idVariante ?? 0)).ExistenciaFisica).toBe(existenciaVendida + 2);
    const { pedido: guardado, reembolsos } = await cancelacionDe(pedido.idPedido);
    expect(guardado).toMatchObject({
      Estado: 'Cancelado',
      EstadoUsoCupon: 'Revertido',
      Reingresos: 1,
      EstadoIntento: 'Capturado',
    });
    expect(guardado.MontoReembolsado).toBe(guardado.Total);
    expect(reembolsos).toMatchObject([
      { Origen: 'Cancelacion', Estado: 'Completado', Monto: guardado.Total, Intentos: 0 },
    ]);
    expect((await enPasarela(guardado.LlaveIntento)).reembolsos).toEqual([
      expect.objectContaining({ Monto: guardado.Total }),
    ]);
    const cupon = leerDatos(
      await request(app)
        .get(`/api/v1/admin/cupones/${String(idCupon)}`)
        .set(comoCliente(tokenAdmin)),
      z.object({ usosComprometidos: z.number() }),
    );
    expect(cupon.usosComprometidos).toBe(0);
  });

  it('desde EnPreparacion, desde la gestión, con el motivo en el historial', async () => {
    const { cliente, pedido } = await pedidoPagado(app, estandar);
    await cambiar(pedido.idPedido, 'Pagado', 'EnPreparacion');

    const respuesta = await cancelarDesdeGestion(pedido.idPedido, 'Producto dañado en bodega');

    expect(respuesta.status).toBe(200);
    const detalle = leerDatos(
      await request(app)
        .get(`/api/v1/pedidos/${String(pedido.idPedido)}`)
        .set(comoCliente(cliente.token)),
      z.object({
        historial: z.array(
          z.looseObject({ estadoNuevo: z.string(), motivo: z.string().nullable() }),
        ),
      }),
    );
    expect(detalle.historial.at(-1)).toMatchObject({
      estadoNuevo: 'Cancelado',
      motivo: 'Producto dañado en bodega',
      rol: 'Operador',
    });
  });

  it('desde Despachado responde 409 NO_CANCELABLE; sin motivo, 400; el pedido de otro cliente, 404', async () => {
    const { cliente, pedido } = await pedidoPagado(app, estandar);
    const { cliente: otro } = await pedidoPagado(app, estandar);
    const sinMotivo = await cancelarComoCliente(app, cliente.token, pedido.idPedido, '   ');
    const ajeno = await cancelarComoCliente(app, otro.token, pedido.idPedido);
    await cambiar(pedido.idPedido, 'Pagado', 'EnPreparacion');
    await cambiar(pedido.idPedido, 'EnPreparacion', 'Despachado');

    const despachado = await cancelarComoCliente(app, cliente.token, pedido.idPedido);

    expect([sinMotivo.status, ajeno.status, despachado.status]).toEqual([400, 404, 409]);
    expect(leerError(despachado).codigo).toBe('NO_CANCELABLE');
    expect((await cancelacionDe(pedido.idPedido)).reembolsos).toEqual([]);
  });

  it('si la pasarela falla al reembolsar, la cancelación se mantiene y el reembolso queda Pendiente', async () => {
    const sinReembolsos = crearApp(
      dependenciasDePrueba({
        pasarela: pasarelaCon({ reembolsar: () => Promise.reject(new Error('pasarela caída')) }),
      }),
    );
    const { cliente, pedido } = await pedidoPagado(app, estandar);

    const respuesta = await cancelarComoCliente(sinReembolsos, cliente.token, pedido.idPedido);

    expect(respuesta.status).toBe(200);
    expect(leerDatos(respuesta, cancelacionSchema).reembolso.estado).toBe('Pendiente');
    const { pedido: guardado, reembolsos } = await cancelacionDe(pedido.idPedido);
    expect(guardado.Estado).toBe('Cancelado');
    expect(reembolsos).toMatchObject([{ Estado: 'Pendiente', Intentos: 1 }]);
    expect((await enPasarela(guardado.LlaveIntento)).reembolsos).toEqual([]);
  });

  it('el reintento del Admin completa el reembolso con la misma llave: la pasarela reembolsa una sola vez', async () => {
    const sinReembolsos = crearApp(
      dependenciasDePrueba({
        pasarela: pasarelaCon({ reembolsar: () => Promise.reject(new Error('pasarela caída')) }),
      }),
    );
    const { cliente, pedido } = await pedidoPagado(app, estandar);
    const { reembolso } = leerDatos(
      await cancelarComoCliente(sinReembolsos, cliente.token, pedido.idPedido),
      cancelacionSchema,
    );
    const reintentar = () =>
      request(app)
        .post(`/api/v1/admin/reembolsos/${String(reembolso.idReembolso)}/reintentar`)
        .set(comoCliente(tokenAdmin));

    const primero = await reintentar();
    const segundo = await reintentar();

    expect([primero.status, segundo.status]).toEqual([200, 200]);
    expect(leerDatos(segundo, z.object({ estado: z.string() })).estado).toBe('Completado');
    const { pedido: guardado, reembolsos } = await cancelacionDe(pedido.idPedido);
    expect(reembolsos).toMatchObject([{ Estado: 'Completado' }]);
    expect((await enPasarela(guardado.LlaveIntento)).reembolsos).toHaveLength(1);
  });

  it('si la pasarela reembolsó pero la respuesta se perdió, el reintento usa la misma llave: un solo reembolso', async () => {
    const real = crearPasarelaSimulada();
    const respuestaPerdida = crearApp(
      dependenciasDePrueba({
        pasarela: pasarelaCon({
          reembolsar: async (solicitud) => {
            await real.reembolsar(solicitud);
            throw new Error('la respuesta se perdió');
          },
        }),
      }),
    );
    const { cliente, pedido } = await pedidoPagado(app, estandar);
    const { reembolso } = leerDatos(
      await cancelarComoCliente(respuestaPerdida, cliente.token, pedido.idPedido),
      cancelacionSchema,
    );
    expect(reembolso.estado).toBe('Pendiente');

    await request(app)
      .post(`/api/v1/admin/reembolsos/${String(reembolso.idReembolso)}/reintentar`)
      .set(comoCliente(tokenAdmin));

    const { pedido: guardado, reembolsos } = await cancelacionDe(pedido.idPedido);
    expect(reembolsos).toMatchObject([{ Estado: 'Completado', Intentos: 1 }]);
    const enLaPasarela = await enPasarela(guardado.LlaveIntento);
    expect(enLaPasarela.reembolsos).toHaveLength(1);
    expect(reembolsos[0]?.IDTransaccionReembolso).toBe(enLaPasarela.reembolsos[0]?.IDReembolso);
  });

  it('reintentar el pago con su llave después de cancelar responde el pedido (200), no un error', async () => {
    const capturaCaida = crearApp(
      dependenciasDePrueba({
        pasarela: pasarelaCon({ capturar: () => Promise.reject(new Error('pasarela caída')) }),
      }),
    );
    const { cliente, pedido, llave } = await pedidoPagado(capturaCaida, estandar);
    await cancelarComoCliente(app, cliente.token, pedido.idPedido);

    const reintento = await request(app)
      .post('/api/v1/checkout/sesion/pagos')
      .set({ ...comoCliente(cliente.token), 'Idempotency-Key': llave })
      .send({
        numeroTarjeta: '4242424242424242',
        mesVencimiento: 12,
        anioVencimiento: 2030,
        cvv: '731',
      });

    expect(reintento.status).toBe(200);
    expect(
      leerDatos(reintento, z.looseObject({ idPedido: z.number(), estado: z.string() })),
    ).toMatchObject({
      idPedido: pedido.idPedido,
      estado: 'Cancelado',
    });
  });

  it('un proceso desplazado no suma intentos y un éxito de la pasarela deja Completado incluso un Fallido', async () => {
    const sinReembolsos = crearApp(
      dependenciasDePrueba({
        pasarela: pasarelaCon({ reembolsar: () => Promise.reject(new Error('pasarela caída')) }),
      }),
    );
    const { cliente, pedido } = await pedidoPagado(app, estandar);
    const { reembolso } = leerDatos(
      await cancelarComoCliente(sinReembolsos, cliente.token, pedido.idPedido),
      cancelacionSchema,
    );
    const adelantar = () =>
      ejecutarSP('SP_Pruebas_AdelantarReembolso', {
        IDReembolso: { tipo: sql.Int, valor: reembolso.idReembolso },
      });
    const reglas = { maxIntentos: 3, segundosEntreIntentos: 300 };
    await adelantar();
    const desplazado = await pedidosRepository.tomarReembolso(reembolso.idReembolso, 60);
    await adelantar();
    const vigente = await pedidosRepository.tomarReembolso(reembolso.idReembolso, 60);
    if (desplazado === null || vigente === null) throw new Error('No se tomó el reembolso');

    await pedidosRepository.actualizarReembolso(
      desplazado,
      { exito: false, error: 'tarde' },
      reglas,
    );
    const trasDesplazado = (await cancelacionDe(pedido.idPedido)).reembolsos;
    await pedidosRepository.actualizarReembolso(vigente, { exito: false, error: 'caída' }, reglas);
    await adelantar();
    const ultimo = await pedidosRepository.tomarReembolso(reembolso.idReembolso, 60);
    if (ultimo === null) throw new Error('No se tomó el reembolso');
    await pedidosRepository.actualizarReembolso(ultimo, { exito: false, error: 'caída' }, reglas);
    const fallido = (await cancelacionDe(pedido.idPedido)).reembolsos;
    await pedidosRepository.actualizarReembolso(
      desplazado,
      { exito: true, idTransaccionReembolso: 'SIMR-tardio' },
      reglas,
    );

    expect(trasDesplazado).toMatchObject([{ Estado: 'Pendiente', Intentos: 1 }]);
    expect(fallido).toMatchObject([{ Estado: 'Fallido', Intentos: 3 }]);
    expect((await cancelacionDe(pedido.idPedido)).reembolsos).toMatchObject([
      { Estado: 'Completado', IDTransaccionReembolso: 'SIMR-tardio' },
    ]);
  });

  it('repetir la cancelación responde 409 y no genera un segundo reembolso', async () => {
    const { cliente, pedido } = await pedidoPagado(app, estandar);
    await cancelarComoCliente(app, cliente.token, pedido.idPedido);

    const repetida = await cancelarComoCliente(app, cliente.token, pedido.idPedido);

    expect(repetida.status).toBe(409);
    expect(leerError(repetida).codigo).toBe('NO_CANCELABLE');
    expect((await cancelacionDe(pedido.idPedido)).reembolsos).toHaveLength(1);
  });

  it('dos cancelaciones simultáneas: una cancela, la otra 409, y hay un solo reembolso', async () => {
    const { cliente, pedido } = await pedidoPagado(app, estandar);

    const respuestas = await Promise.all([
      cancelarComoCliente(app, cliente.token, pedido.idPedido),
      cancelarDesdeGestion(pedido.idPedido),
    ]);

    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 409]);
    const { pedido: guardado, reembolsos } = await cancelacionDe(pedido.idPedido);
    expect(reembolsos).toHaveLength(1);
    expect(guardado.Reingresos).toBe(1);
    expect((await enPasarela(guardado.LlaveIntento)).reembolsos).toHaveLength(1);
  });

  it('con la captura pendiente (Autorizado), cancelar anula la autorización en vez de reembolsar', async () => {
    const capturaCaida = crearApp(
      dependenciasDePrueba({
        pasarela: pasarelaCon({ capturar: () => Promise.reject(new Error('pasarela caída')) }),
      }),
    );
    const { cliente, pedido } = await pedidoPagado(capturaCaida, estandar);
    expect((await cancelacionDe(pedido.idPedido)).pedido.EstadoIntento).toBe('Autorizado');

    const respuesta = await cancelarComoCliente(app, cliente.token, pedido.idPedido);

    expect(leerDatos(respuesta, cancelacionSchema).reembolso.estado).toBe('Completado');
    const { pedido: guardado, reembolsos } = await cancelacionDe(pedido.idPedido);
    expect(guardado).toMatchObject({ EstadoIntento: 'Anulado', CodigoIntento: 'PEDIDO_CANCELADO' });
    expect(reembolsos).toMatchObject([{ Estado: 'Completado', IDTransaccionReembolso: null }]);
    expect(await enPasarela(guardado.LlaveIntento)).toEqual({ estado: 'Anulada', reembolsos: [] });
  });

  it('si el cobro se capturó justo antes de cancelar (carrera con la conciliación), se reembolsa', async () => {
    const real = crearPasarelaSimulada();
    const capturaCaida = crearApp(
      dependenciasDePrueba({
        pasarela: pasarelaCon({ capturar: () => Promise.reject(new Error('pasarela caída')) }),
      }),
    );
    const { cliente, pedido } = await pedidoPagado(capturaCaida, estandar);
    const { IDTransaccionPasarela, LlaveIntento } = (await cancelacionDe(pedido.idPedido)).pedido;
    // La conciliación capturó en la pasarela pero todavía no registró el intento.
    await real.capturar(IDTransaccionPasarela ?? '');

    await cancelarComoCliente(app, cliente.token, pedido.idPedido);

    const { reembolsos } = await cancelacionDe(pedido.idPedido);
    expect(reembolsos).toMatchObject([{ Estado: 'Completado' }]);
    expect(reembolsos[0]?.IDTransaccionReembolso).not.toBeNull();
    expect(await enPasarela(LlaveIntento)).toMatchObject({
      estado: 'Capturada',
      reembolsos: [expect.objectContaining({ Monto: Number(pedido.total) })],
    });
  });

  it('solo el Admin consulta y reintenta reembolsos (un Operador recibe 403)', async () => {
    const lista = await request(app)
      .get('/api/v1/admin/reembolsos')
      .set(comoCliente(tokenOperador));
    const reintento = await request(app)
      .post('/api/v1/admin/reembolsos/1/reintentar')
      .set(comoCliente(tokenOperador));

    expect([lista.status, reintento.status]).toEqual([403, 403]);
  });

  it('el CHECK impide que MontoReembolsado supere el total (A-13)', async () => {
    const { pedido } = await pedidoPagado(app, estandar);

    const exceso = ejecutarSP('SP_Pruebas_ProbarMontoReembolsado', {
      IDPedido: { tipo: sql.Int, valor: pedido.idPedido },
      MontoReembolsado: { tipo: sql.Decimal(12, 2), valor: Number(pedido.total) + 1 },
    });

    await expect(exceso).rejects.toThrow(/CK_Pedido_MontoReembolsado/);
  });
});

describe('cancelar un pedido con el pago en revisión (cierre de la Fase 1)', () => {
  it('se cancela y reintegra la existencia, pero no se reembolsa: el cobro ya se anuló', async () => {
    const { cliente, pedido } = await pedidoPagado(app, estandar);
    await ejecutarSP('SP_Pruebas_PonerPagoEnRevision', {
      IDPedido: { tipo: sql.Int, valor: pedido.idPedido },
    });

    const respuesta = await cancelarComoCliente(app, cliente.token, pedido.idPedido);
    const { pedido: guardado, reembolsos } = await cancelacionDe(pedido.idPedido);

    expect(respuesta.status).toBe(200);
    expect(
      leerDatos(
        respuesta,
        z.object({ reembolso: z.null(), pedido: z.looseObject({ estado: z.string() }) }),
      ),
    ).toMatchObject({ reembolso: null, pedido: { estado: 'Cancelado' } });
    expect(guardado).toMatchObject({ Estado: 'Cancelado', MontoReembolsado: 0 });
    expect(reembolsos).toEqual([]);
  });
});
