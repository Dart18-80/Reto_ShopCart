import { randomUUID } from 'node:crypto';
import { Decimal } from 'decimal.js';
import sql from 'mssql';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { crearPasarelaSimulada } from '../../../src/shared/adapters/pasarela-simulada.js';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import { leerDatos, leerError } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { iniciarSesion, leerSesion } from '../auth/apoyo-auth.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { comoCliente, varianteVendible } from '../carrito/apoyo-carrito.js';
import {
  clienteConCarrito,
  enPasarela,
  estadoEnPasarela,
  iniciarPago,
  leerSesionPago,
  metodoEnvio,
  TARJETA_APROBADA,
} from '../checkout/apoyo-checkout.js';
import { comoActor, leerBitacora, unaFila } from '../datos-de-prueba.js';
import { pedidosRepository } from '../../../src/modules/pedidos/pedidos.repository.js';
import { pedidoPagado } from './apoyo-pedidos.js';

// E9-H04 (decisión del PO): el Admin resuelve con evidencia un pago EnRevision y un reembolso Fallido.

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());
let tokenAdmin = '';
let idAdmin = 0;
let tokenOperador = '';
let estandar = 0;

beforeAll(async () => {
  const admin = leerSesion(await iniciarSesion(app, 'admin@shopcart.gt', 'Admin2026!'));
  tokenAdmin = admin.accessToken;
  idAdmin = admin.usuario.idUsuario;
  tokenOperador = leerSesion(
    await iniciarSesion(app, 'operador@shopcart.gt', 'Operador2026!'),
  ).accessToken;
  estandar = await metodoEnvio(app);
});

interface FilaIntento {
  IDIntentoPago: string;
  Estado: string;
  ResolucionManual: string | null;
  MotivoResolucion: string | null;
  IDUsuarioResolucion: number | null;
}

const intentoDePedido = (idPedido: number) =>
  unaFila<FilaIntento>('SP_Pruebas_LeerIntentoDePedido', {
    IDPedido: { tipo: sql.Int, valor: idPedido },
  });

const enRevision = (idPedido: number) =>
  ejecutarSP('SP_Pruebas_PonerPagoEnRevision', { IDPedido: { tipo: sql.Int, valor: idPedido } });

const cambiarEnPasarela = (llave: string, estado: string) =>
  ejecutarSP('SP_Pruebas_CambiarEstadoEnPasarela', {
    LlaveIdempotencia: { tipo: sql.UniqueIdentifier, valor: llave },
    Estado: { tipo: sql.VarChar(12), valor: estado },
  });

const resolverPago = (token: string, idIntento: string, resolucion: string, motivo = 'Revisado') =>
  request(app)
    .post(`/api/v1/admin/pagos/${idIntento}/resolver`)
    .set(comoCliente(token))
    .send({ resolucion, motivo });

const resolverReembolso = (token: string, idReembolso: number) =>
  request(app)
    .post(`/api/v1/admin/reembolsos/${String(idReembolso)}/resolver`)
    .set(comoCliente(token))
    .send({ motivo: 'Devuelto por transferencia', referencia: 'TRF-2026-001' });

/** Un pedido pagado cuyo intento quedó en revisión; la pasarela sigue con el cobro capturado. */
async function pagoConPedidoEnRevision() {
  const { cliente, pedido, llave } = await pedidoPagado(app, estandar);
  await enRevision(pedido.idPedido);
  const intento = await intentoDePedido(pedido.idPedido);
  return { cliente, pedido, llave, idIntento: intento.IDIntentoPago };
}

/** Un cobro capturado en la pasarela que no llegó a ser pedido, en revisión. */
async function cobroSinPedidoEnRevision() {
  const { IDVariante } = await varianteVendible('40.00', 5);
  const cliente = await clienteConCarrito(app, [{ idVariante: IDVariante, cantidad: 1 }]);
  const sesion = leerSesionPago(await iniciarPago(app, cliente, estandar));
  const llave = randomUUID();
  const pasarela = crearPasarelaSimulada();
  const autorizacion = await pasarela.autorizar({
    llave,
    monto: new Decimal(sesion.total),
    tarjeta: { numero: TARJETA_APROBADA, mesVencimiento: 12, anioVencimiento: 2030, cvv: '123' },
  });
  if (autorizacion.tipo !== 'Autorizada') throw new Error('La pasarela no autorizó');
  await pasarela.capturar(autorizacion.idTransaccion);
  const { IDIntentoPago } = await unaFila<{ IDIntentoPago: string }>(
    'SP_Pruebas_CrearCobroSinPedido',
    {
      IDSesionCheckout: { tipo: sql.Int, valor: sesion.idSesion },
      LlaveIdempotencia: { tipo: sql.UniqueIdentifier, valor: llave },
      Monto: { tipo: sql.Decimal(12, 2), valor: new Decimal(sesion.total).toNumber() },
      IDTransaccion: { tipo: sql.VarChar(64), valor: autorizacion.idTransaccion },
    },
  );
  return { llave, idIntento: IDIntentoPago, total: sesion.total };
}

const resolucionSchema = z.object({
  idIntentoPago: z.number(),
  estado: z.string(),
  resolucion: z.string(),
  motivo: z.string(),
  pedido: z.looseObject({ idPedido: z.number(), estado: z.string() }).nullable(),
  reembolso: z.object({ idReembolso: z.number(), estado: z.string() }).nullable(),
});

describe('pagos en revisión (E9-H04)', () => {
  it('el Admin los lista, con y sin pedido; Operador y Cliente reciben 403', async () => {
    const conPedido = await pagoConPedidoEnRevision();
    const sinPedido = await cobroSinPedidoEnRevision();

    const lista = await request(app)
      .get('/api/v1/admin/pagos/en-revision?tamano=100')
      .set(comoCliente(tokenAdmin));
    const operador = await request(app)
      .get('/api/v1/admin/pagos/en-revision')
      .set(comoCliente(tokenOperador));
    const cliente = await request(app)
      .get('/api/v1/admin/pagos/en-revision')
      .set(comoCliente(conPedido.cliente.token));

    const filas = leerDatos(
      lista,
      z.array(z.looseObject({ idIntentoPago: z.number(), causa: z.string() })),
    );
    expect(filas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          idIntentoPago: Number(conPedido.idIntento),
          causa: 'AutorizacionInexistente',
        }),
        expect.objectContaining({
          idIntentoPago: Number(sinPedido.idIntento),
          causa: 'CobroSinPedido',
        }),
      ]),
    );
    expect([operador.status, cliente.status]).toEqual([403, 403]);
  });

  it('CobroVerificado con la captura en la pasarela: el intento queda Capturado, el pedido avanza y queda en la bitácora', async () => {
    const { pedido, idIntento } = await pagoConPedidoEnRevision();

    const respuesta = await resolverPago(
      tokenAdmin,
      idIntento,
      'CobroVerificado',
      'Captura en el portal',
    );
    const avance = await request(app)
      .post(`/api/v1/admin/pedidos/${String(pedido.idPedido)}/estado`)
      .set(comoCliente(tokenAdmin))
      .send({ estadoEsperado: 'Pagado', estadoNuevo: 'EnPreparacion' });

    expect(leerDatos(respuesta, resolucionSchema)).toMatchObject({
      estado: 'Capturado',
      resolucion: 'CobroVerificado',
      pedido: { estado: 'Pagado' },
      reembolso: null,
    });
    expect(avance.status).toBe(200);
    const [bitacora] = await leerBitacora('IntentoPago', Number(idIntento));
    expect(bitacora).toMatchObject({ Modulo: 'Pedidos', Accion: 'CambioEstado' });
    expect(JSON.parse(bitacora?.ValorNuevo ?? '{}')).toMatchObject({
      Estado: 'Capturado',
      ResolucionManual: 'CobroVerificado',
      MotivoResolucion: 'Captura en el portal',
    });
    expect(bitacora?.IDUsuario).toBe(idAdmin);
  });

  it('CobroVerificado sin captura en la pasarela se rechaza y no cambia nada', async () => {
    const { pedido, llave, idIntento } = await pagoConPedidoEnRevision();
    await cambiarEnPasarela(llave, 'Anulada');

    const respuesta = await resolverPago(tokenAdmin, idIntento, 'CobroVerificado');

    expect(respuesta.status).toBe(409);
    expect(leerError(respuesta).codigo).toBe('COBRO_SIN_CAPTURA');
    expect(await intentoDePedido(pedido.idPedido)).toMatchObject({
      Estado: 'EnRevision',
      ResolucionManual: null,
    });
  });

  it('SinCobro cancela el pedido por el flujo de siempre, sin reembolso, con el motivo del Admin', async () => {
    const { pedido, llave, idIntento } = await pagoConPedidoEnRevision();
    await cambiarEnPasarela(llave, 'Anulada');

    const respuesta = await resolverPago(
      tokenAdmin,
      idIntento,
      'SinCobro',
      'La pasarela anuló el cobro',
    );

    expect(leerDatos(respuesta, resolucionSchema)).toMatchObject({
      estado: 'Anulado',
      resolucion: 'SinCobro',
      pedido: { idPedido: pedido.idPedido, estado: 'Cancelado' },
      reembolso: null,
    });
    expect(await intentoDePedido(pedido.idPedido)).toMatchObject({
      Estado: 'Anulado',
      ResolucionManual: 'SinCobro',
      MotivoResolucion: 'La pasarela anuló el cobro',
    });
  });

  it('SinCobro con una autorización vigente la anula en la pasarela: no queda dinero retenido', async () => {
    const { pedido, llave, idIntento } = await pagoConPedidoEnRevision();
    await cambiarEnPasarela(llave, 'Autorizada');

    const respuesta = await resolverPago(tokenAdmin, idIntento, 'SinCobro');

    expect(leerDatos(respuesta, resolucionSchema)).toMatchObject({
      estado: 'Anulado',
      pedido: { idPedido: pedido.idPedido, estado: 'Cancelado' },
    });
    expect(await estadoEnPasarela(llave)).toBe('Anulada');
  });

  it('SinCobro con el cobro capturado en la pasarela se rechaza: el dinero sí llegó', async () => {
    const { idIntento } = await pagoConPedidoEnRevision();

    const respuesta = await resolverPago(tokenAdmin, idIntento, 'SinCobro');

    expect(respuesta.status).toBe(409);
    expect(leerError(respuesta).codigo).toBe('COBRO_CAPTURADO');
  });

  it('Reembolsar un cobro sin pedido: reembolso por el monto del intento, devuelto en la pasarela', async () => {
    const { llave, idIntento, total } = await cobroSinPedidoEnRevision();
    const monto = new Decimal(total);

    const respuesta = await resolverPago(tokenAdmin, idIntento, 'Reembolsar', 'Cobro sin pedido');
    const resolucion = leerDatos(respuesta, resolucionSchema);
    const lista = await request(app)
      .get('/api/v1/admin/reembolsos?tamano=100')
      .set(comoCliente(tokenAdmin));
    const reembolso = leerDatos(
      lista,
      z.array(
        z.looseObject({
          idReembolso: z.number(),
          idIntentoPago: z.number().nullable(),
          idTransaccionReembolso: z.string().nullable(),
        }),
      ),
    ).find((r) => r.idReembolso === resolucion.reembolso?.idReembolso);

    expect(resolucion).toMatchObject({
      estado: 'Anulado',
      resolucion: 'Reembolsar',
      pedido: null,
      reembolso: { estado: 'Completado' },
    });
    expect(reembolso).toMatchObject({
      idIntentoPago: Number(idIntento),
      idPedido: null,
      origen: 'SinPedido',
      estado: 'Completado',
      monto: monto.toFixed(2),
    });
    expect(reembolso?.idTransaccionReembolso).not.toBeNull();
    expect((await enPasarela(llave)).reembolsos).toEqual([
      expect.objectContaining({ Monto: monto.toNumber() }),
    ]);
  });

  it('una resolución que no corresponde al caso responde 422; un intento inexistente, 404', async () => {
    const { idIntento: conPedido } = await pagoConPedidoEnRevision();
    const { idIntento: sinPedido } = await cobroSinPedidoEnRevision();

    const reembolsarConPedido = await resolverPago(tokenAdmin, conPedido, 'Reembolsar');
    const verificarSinPedido = await resolverPago(tokenAdmin, sinPedido, 'CobroVerificado');
    const inexistente = await resolverPago(tokenAdmin, '999999999', 'CobroVerificado');

    expect([reembolsarConPedido.status, verificarSinPedido.status]).toEqual([422, 422]);
    expect(leerError(reembolsarConPedido).codigo).toBe('RESOLUCION_NO_APLICA');
    expect(leerError(verificarSinPedido).codigo).toBe('RESOLUCION_NO_APLICA');
    expect(inexistente.status).toBe(404);
  });

  it('dos resoluciones simultáneas del mismo intento: una pasa y la otra recibe 409', async () => {
    const { idIntento } = await pagoConPedidoEnRevision();

    const respuestas = await Promise.all([
      resolverPago(tokenAdmin, idIntento, 'CobroVerificado'),
      resolverPago(tokenAdmin, idIntento, 'CobroVerificado'),
    ]);

    const rechazo = respuestas.find((r) => r.status === 409);

    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(rechazo && leerError(rechazo).codigo).toBe('PAGO_NO_EN_REVISION');
  });

  it('el SP, bajo bloqueo, rechaza la segunda resolución del mismo intento con 50707', async () => {
    const { idIntento } = await pagoConPedidoEnRevision();
    const resolver = () =>
      comoActor(idAdmin, 'Administrador', () =>
        pedidosRepository.resolverPago(Number(idIntento), 'CobroVerificado', 'Revisado', 'SIM-1'),
      );

    await resolver();

    await expect(resolver()).rejects.toMatchObject({ codigo: 'PAGO_NO_EN_REVISION' });
  });

  it('Operador y Cliente reciben 403 al resolver un pago', async () => {
    const { cliente, idIntento } = await pagoConPedidoEnRevision();

    const operador = await resolverPago(tokenOperador, idIntento, 'CobroVerificado');
    const propio = await resolverPago(cliente.token, idIntento, 'CobroVerificado');

    expect([operador.status, propio.status]).toEqual([403, 403]);
  });
});

describe('reembolsos Fallido resueltos a mano (E9-H04)', () => {
  async function reembolsoFallido() {
    const { cliente, pedido } = await pedidoPagado(app, estandar);
    const cancelacion = await request(app)
      .post(`/api/v1/admin/pedidos/${String(pedido.idPedido)}/cancelar`)
      .set(comoCliente(tokenAdmin))
      .send({ motivo: 'Prueba' });
    const { reembolso } = leerDatos(
      cancelacion,
      z.object({ reembolso: z.object({ idReembolso: z.number() }) }),
    );
    await ejecutarSP('SP_Pruebas_FallarReembolso', {
      IDReembolso: { tipo: sql.Int, valor: reembolso.idReembolso },
    });
    return { cliente, idReembolso: reembolso.idReembolso };
  }

  it('pasa a ResueltoManual con motivo, referencia, quién y cuándo, y queda en la bitácora', async () => {
    const { idReembolso } = await reembolsoFallido();

    const respuesta = await resolverReembolso(tokenAdmin, idReembolso);

    expect(
      leerDatos(
        respuesta,
        z.looseObject({
          estado: z.string(),
          motivoResolucion: z.string(),
          referenciaResolucion: z.string(),
          fechaResolucion: z.string(),
        }),
      ),
    ).toMatchObject({
      estado: 'ResueltoManual',
      motivoResolucion: 'Devuelto por transferencia',
      referenciaResolucion: 'TRF-2026-001',
    });
    const [bitacora] = await leerBitacora('Reembolso', idReembolso);
    expect(bitacora).toMatchObject({ Modulo: 'Pedidos', Accion: 'CambioEstado' });
    expect(JSON.parse(bitacora?.ValorAnterior ?? '{}')).toMatchObject({ Estado: 'Fallido' });
    expect(JSON.parse(bitacora?.ValorNuevo ?? '{}')).toMatchObject({
      Estado: 'ResueltoManual',
      ReferenciaResolucion: 'TRF-2026-001',
    });
  });

  it('el reintento del Admin ya no lo toca y resolverlo otra vez responde 409', async () => {
    const { idReembolso } = await reembolsoFallido();
    await resolverReembolso(tokenAdmin, idReembolso);

    const reintento = await request(app)
      .post(`/api/v1/admin/reembolsos/${String(idReembolso)}/reintentar`)
      .set(comoCliente(tokenAdmin));
    const otraVez = await resolverReembolso(tokenAdmin, idReembolso);

    expect(leerDatos(reintento, z.looseObject({ estado: z.string() })).estado).toBe(
      'ResueltoManual',
    );
    expect(otraVez.status).toBe(409);
    expect(leerError(otraVez).codigo).toBe('REEMBOLSO_NO_FALLIDO');
  });

  it('el reintento de un Fallido queda en la bitácora', async () => {
    const { idReembolso } = await reembolsoFallido();

    await request(app)
      .post(`/api/v1/admin/reembolsos/${String(idReembolso)}/reintentar`)
      .set(comoCliente(tokenAdmin));

    const cambios = (await leerBitacora('Reembolso', idReembolso)).map((b) => ({
      antes: JSON.parse(b.ValorAnterior ?? 'null') as { Estado?: string } | null,
      despues: JSON.parse(b.ValorNuevo ?? 'null') as { Estado?: string } | null,
    }));
    expect(cambios).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          antes: expect.objectContaining({ Estado: 'Fallido' }) as unknown,
          despues: expect.objectContaining({ Estado: 'Pendiente' }) as unknown,
        }),
      ]),
    );
  });

  it('dos resoluciones simultáneas del mismo reembolso: una pasa y la otra recibe 409', async () => {
    const { idReembolso } = await reembolsoFallido();

    const respuestas = await Promise.all([
      resolverReembolso(tokenAdmin, idReembolso),
      resolverReembolso(tokenAdmin, idReembolso),
    ]);

    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  it('Operador y Cliente reciben 403', async () => {
    const { cliente, idReembolso } = await reembolsoFallido();

    const operador = await resolverReembolso(tokenOperador, idReembolso);
    const propio = await resolverReembolso(cliente.token, idReembolso);

    expect([operador.status, propio.status]).toEqual([403, 403]);
  });
});
