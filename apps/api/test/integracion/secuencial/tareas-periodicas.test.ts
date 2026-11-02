import { randomUUID } from 'node:crypto';
import sql from 'mssql';
import pino from 'pino';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { checkoutRepository } from '../../../src/modules/checkout/checkout.repository.js';
import { crearTareasDeCarrito } from '../../../src/modules/carrito/index.js';
import { crearTareasDeCheckout } from '../../../src/modules/checkout/index.js';
import { crearTareasDePedidos, pedidosParaCheckout } from '../../../src/modules/pedidos/index.js';
import { crearTareasDeSistema } from '../../../src/modules/sistema/index.js';
import { crearPasarelaSimulada } from '../../../src/shared/adapters/pasarela-simulada.js';
import { ejecutarSP, ejecutarSPConjuntos } from '../../../src/shared/db/index.js';
import type { ResultadoTarea, Tarea } from '../../../src/shared/jobs/index.js';
import { PasarelaSinRespuesta, type PasarelaPago } from '../../../src/shared/pasarela/index.js';
import { leerError } from '../../unit/respuestas.js';
import { dependenciasDePrueba, SIN_CACHE } from '../../app-de-prueba.js';
import { crearInvalidadorReportes } from '../../../src/modules/reportes/index.js';
import { iniciarSesion, leerSesion } from '../auth/apoyo-auth.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { comoCliente, hashDe, varianteVendible } from '../carrito/apoyo-carrito.js';
import {
  clienteConCarrito,
  crearCupon,
  estadoEnPasarela,
  iniciarPago,
  intentosDe,
  leerSesionPago,
  metodoEnvio,
  moverArrendamiento,
  pagar,
  pagoDe,
  TARJETA_RECHAZADA,
  TARJETA_TIEMPO_AGOTADO,
} from '../checkout/apoyo-checkout.js';
import { comoActor, unaFila } from '../datos-de-prueba.js';
import { pedidoPagado } from '../pedidos/apoyo-pedidos.js';

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());
const tareas = [
  ...crearTareasDeCheckout({
    pasarela: crearPasarelaSimulada(),
    logger: pino({ level: 'silent' }),
  }),
  ...crearTareasDeCarrito(crearInvalidadorReportes(SIN_CACHE)),
  ...crearTareasDeSistema(),
];
// 01 §6.2: la conciliación espera 2 minutos después del vencimiento del arrendamiento.
const VENCIDO_HACE_MAS_DE_GRACIA_S = -130;
const VENCIDO_DENTRO_DE_GRACIA_S = -30;

let tokenAdmin: string;
let estandar: number;

beforeAll(async () => {
  tokenAdmin = leerSesion(await iniciarSesion(app, 'admin@shopcart.gt', 'Admin2026!')).accessToken;
  estandar = await metodoEnvio(app);
});

function ejecutar(nombre: string): Promise<ResultadoTarea> {
  const tarea: Tarea | undefined = tareas.find((t) => t.nombre === nombre);
  if (tarea === undefined) throw new Error(`No existe la tarea ${nombre}`);
  return tarea.ejecutar();
}

const conciliar = () => ejecutar('Checkout.ConciliarPagos');
const expirarSesiones = () => ejecutar('Checkout.ExpirarSesiones');

interface EstadoSesion {
  Estado: string;
  IntentosRechazados: number;
  EstadoReserva: string | null;
  EstadoUsoCupon: string | null;
  UsosComprometidosCupon: number | null;
}

const sesion = (idSesion: number) =>
  unaFila<EstadoSesion>('SP_Pruebas_LeerSesionCheckout', {
    IDSesionCheckout: { tipo: sql.Int, valor: idSesion },
  });

const vencerSesion = (idSesion: number) =>
  ejecutarSP('SP_Pruebas_VencerSesionCheckout', {
    IDSesionCheckout: { tipo: sql.Int, valor: idSesion },
  });

/** Simula la otra réplica: retiene el sp_getapplock del job mientras se ejecuta `accion`. */
async function conBloqueoTomado<T>(recurso: string, accion: () => Promise<T>): Promise<T> {
  const retencion = ejecutarSP('SP_Pruebas_RetenerBloqueo', {
    Recurso: { tipo: sql.NVarChar(255), valor: recurso },
    Milisegundos: { tipo: sql.Int, valor: 1500 },
  });
  // Se marca como manejada ya: si falla antes del finally, no queda un rechazo suelto; el await la relanza.
  retencion.catch(() => undefined);
  // Margen para que el SP de prueba tome el bloqueo antes de ejecutar el job.
  await new Promise((listo) => setTimeout(listo, 300));
  try {
    return await accion();
  } finally {
    await retencion;
  }
}

async function sesionDePago(aplicacion = app, codigoCupon?: string) {
  const { IDVariante } = await varianteVendible('40.00', 10);
  const cliente = await clienteConCarrito(aplicacion, [{ idVariante: IDVariante, cantidad: 1 }]);
  if (codigoCupon !== undefined) {
    await request(aplicacion)
      .put('/api/v1/carrito/cupon')
      .set(comoCliente(cliente.token))
      .send({ codigo: codigoCupon });
  }
  const { idSesion } = leerSesionPago(await iniciarPago(aplicacion, cliente, estandar));
  return { cliente, idSesion };
}

async function abandonarIntento(idSesion: number, segundos = VENCIDO_HACE_MAS_DE_GRACIA_S) {
  const [intento] = await intentosDe(idSesion);
  if (intento === undefined) throw new Error('La sesión no tiene intento de pago');
  await moverArrendamiento(intento.IDIntentoPago, segundos);
  return intento;
}

const ESPERA_SONDEO_MS = 50;
const MAX_SONDEOS = 100;

/** Espera a que la condición se cumpla (la conciliación corre en paralelo a la prueba). */
async function hastaQue(condicion: () => Promise<boolean>): Promise<void> {
  for (let sondeo = 0; sondeo < MAX_SONDEOS; sondeo++) {
    if (await condicion()) return;
    await new Promise((listo) => setTimeout(listo, ESPERA_SONDEO_MS));
  }
  throw new Error('La condición no se cumplió a tiempo');
}

function pasarelaCon(cambios: Partial<PasarelaPago>): PasarelaPago {
  return { ...crearPasarelaSimulada(), ...cambios };
}

describe('expiración de sesiones de checkout (E5-H04, RF-07)', () => {
  it('una sesión vencida pasa a Expirada y libera sus reservas y el uso del cupón', async () => {
    const { codigo } = await crearCupon(app, tokenAdmin, { limiteUsosTotal: 3 });
    const { idSesion } = await sesionDePago(app, codigo);
    await vencerSesion(idSesion);

    const resultado = await expirarSesiones();

    expect(resultado).toMatchObject({ sesionesExpiradas: expect.any(Number) as number });
    expect(await sesion(idSesion)).toMatchObject({
      Estado: 'Expirada',
      EstadoReserva: 'Liberada',
      EstadoUsoCupon: 'Liberado',
      UsosComprometidosCupon: 0,
    });
  });

  it('ejecutarla dos veces no cambia nada la segunda', async () => {
    const { idSesion } = await sesionDePago();
    await vencerSesion(idSesion);
    await expirarSesiones();

    const segunda = await expirarSesiones();

    expect(segunda).toEqual({ sesionesExpiradas: 0 });
    expect((await sesion(idSesion)).Estado).toBe('Expirada');
  });

  it('no vence una sesión con un pago en curso mientras su arrendamiento sigue vivo', async () => {
    const sinRespuesta = crearApp(
      dependenciasDePrueba({
        pasarela: pasarelaCon({ autorizar: () => Promise.reject(new Error('red caída')) }),
      }),
    );
    const { cliente, idSesion } = await sesionDePago(sinRespuesta);
    await pagar(sinRespuesta, cliente.token, randomUUID());
    const intento = await abandonarIntento(idSesion, 60);
    await vencerSesion(idSesion);

    await expirarSesiones();
    const conArrendamiento = (await sesion(idSesion)).Estado;
    await moverArrendamiento(intento.IDIntentoPago, -1);
    await expirarSesiones();

    expect(conArrendamiento).toBe('Activa');
    expect(await sesion(idSesion)).toMatchObject({ Estado: 'Expirada', EstadoReserva: 'Liberada' });
  });

  it('si la otra réplica tiene el bloqueo, retorna sin hacer nada', async () => {
    const { idSesion } = await sesionDePago();
    await vencerSesion(idSesion);

    const resultado = await conBloqueoTomado('Job_Checkout_ExpirarSesiones', expirarSesiones);

    expect(resultado).toBeNull();
    expect((await sesion(idSesion)).Estado).toBe('Activa');
  });
});

describe('conciliación de pagos (E5-H04, N-03)', () => {
  it('Pendiente que la pasarela nunca recibió → Fallido sin cobro; la misma llave responde PAGO_NO_COMPLETADO', async () => {
    const sinRespuesta = crearApp(
      dependenciasDePrueba({
        pasarela: pasarelaCon({ autorizar: () => Promise.reject(new Error('red caída')) }),
      }),
    );
    const { cliente, idSesion } = await sesionDePago(sinRespuesta);
    const llave = randomUUID();
    await pagar(sinRespuesta, cliente.token, llave);
    await abandonarIntento(idSesion);

    await conciliar();

    expect(await intentosDe(idSesion)).toMatchObject([
      { Estado: 'Fallido', CodigoRespuesta: 'PAGO_NO_COMPLETADO', Arrendado: false },
    ]);
    expect(await estadoEnPasarela(llave)).toBeUndefined();
    const reintento = await pagar(app, cliente.token, llave);
    expect(reintento.status).toBe(409);
    expect(leerError(reintento).codigo).toBe('PAGO_NO_COMPLETADO');
  });

  it('Pendiente que la pasarela autorizó sin pedido → se anula; después la sesión expira y libera', async () => {
    const { cliente, idSesion } = await sesionDePago();
    const llave = randomUUID();
    await pagar(app, cliente.token, llave, TARJETA_TIEMPO_AGOTADO);
    await abandonarIntento(idSesion);

    await conciliar();
    await vencerSesion(idSesion);
    await expirarSesiones();

    expect(await intentosDe(idSesion)).toMatchObject([{ Estado: 'Anulado' }]);
    expect(await estadoEnPasarela(llave)).toBe('Anulada');
    expect(await sesion(idSesion)).toMatchObject({ Estado: 'Expirada', EstadoReserva: 'Liberada' });
  });

  it('Pendiente que la pasarela rechazó → Rechazado y cuenta como rechazo de la sesión', async () => {
    const real = crearPasarelaSimulada();
    const rechazoSinRespuesta = crearApp(
      dependenciasDePrueba({
        pasarela: pasarelaCon({
          autorizar: async (solicitud) => {
            await real.autorizar(solicitud);
            throw new PasarelaSinRespuesta('autorizar');
          },
        }),
      }),
    );
    const { cliente, idSesion } = await sesionDePago(rechazoSinRespuesta);
    await pagar(rechazoSinRespuesta, cliente.token, randomUUID(), TARJETA_RECHAZADA);
    await abandonarIntento(idSesion);

    await conciliar();

    expect(await intentosDe(idSesion)).toMatchObject([
      { Estado: 'Rechazado', CodigoRespuesta: 'FONDOS_INSUFICIENTES' },
    ]);
    expect(await sesion(idSesion)).toMatchObject({ Estado: 'Activa', IntentosRechazados: 1 });
  });

  it('Autorizado sin pedido (falló el pedido y la anulación) → se anula', async () => {
    const anulacionCaida = crearApp(
      dependenciasDePrueba({
        pasarela: pasarelaCon({ anular: () => Promise.reject(new Error('pasarela caída')) }),
      }),
    );
    const { IDVariante } = await varianteVendible('50.00', 10);
    await request(app)
      .patch(`/api/v1/admin/variantes/${String(IDVariante)}`)
      .set(comoCliente(tokenAdmin))
      .send({ sku: `FALLA-${randomUUID().slice(0, 8)}` });
    const cliente = await clienteConCarrito(anulacionCaida, [
      { idVariante: IDVariante, cantidad: 1 },
    ]);
    const { idSesion } = leerSesionPago(await iniciarPago(anulacionCaida, cliente, estandar));
    const llave = randomUUID();
    await pagar(anulacionCaida, cliente.token, llave);
    await abandonarIntento(idSesion);

    await conciliar();

    expect(await intentosDe(idSesion)).toMatchObject([{ Estado: 'Anulado' }]);
    expect(await estadoEnPasarela(llave)).toBe('Anulada');
    expect((await pagoDe(idSesion)).Pedidos).toBe(0);
  });

  it('Autorizado con pedido sin capturar (la API murió entre CrearPedido y la captura) → se captura', async () => {
    const capturaCaida = crearApp(
      dependenciasDePrueba({
        pasarela: pasarelaCon({ capturar: () => Promise.reject(new Error('pasarela caída')) }),
      }),
    );
    const { cliente, idSesion } = await sesionDePago(capturaCaida);
    const llave = randomUUID();
    expect((await pagar(capturaCaida, cliente.token, llave)).status).toBe(201);
    await abandonarIntento(idSesion);

    await conciliar();

    expect(await intentosDe(idSesion)).toMatchObject([{ Estado: 'Capturado', Arrendado: false }]);
    expect(await estadoEnPasarela(llave)).toBe('Capturada');
  });

  it('capturado en la pasarela pero sin actualizar el intento (la API murió después de capturar) → Capturado', async () => {
    const real = crearPasarelaSimulada();
    const muereTrasCapturar = crearApp(
      dependenciasDePrueba({
        pasarela: pasarelaCon({
          capturar: async (idTransaccion) => {
            await real.capturar(idTransaccion);
            throw new Error('la API murió');
          },
        }),
      }),
    );
    const { cliente, idSesion } = await sesionDePago(muereTrasCapturar);
    const llave = randomUUID();
    await pagar(muereTrasCapturar, cliente.token, llave);
    await abandonarIntento(idSesion);

    await conciliar();

    expect(await intentosDe(idSesion)).toMatchObject([{ Estado: 'Capturado' }]);
    expect(await estadoEnPasarela(llave)).toBe('Capturada');
    expect((await pagoDe(idSesion)).Pedidos).toBe(1);
  });

  it('Autorizado con pedido y la autorización ya anulada en la pasarela → EnRevision, una sola vez', async () => {
    const real = crearPasarelaSimulada();
    const capturaCaida = crearApp(
      dependenciasDePrueba({
        pasarela: pasarelaCon({ capturar: () => Promise.reject(new Error('pasarela caída')) }),
      }),
    );
    const { cliente, idSesion } = await sesionDePago(capturaCaida);
    const llave = randomUUID();
    expect((await pagar(capturaCaida, cliente.token, llave)).status).toBe(201);
    const enPasarela = await real.consultar(llave);
    if (enPasarela.estado !== 'Autorizada') throw new Error('La autorización no quedó viva');
    await real.anular(enPasarela.idTransaccion);
    await abandonarIntento(idSesion);

    await conciliar();
    const segunda = await conciliar();

    expect(await intentosDe(idSesion)).toMatchObject([{ Estado: 'EnRevision', Arrendado: false }]);
    expect(segunda).toMatchObject({ EnRevision: 0 });
    expect((await pagoDe(idSesion)).Pedidos).toBe(1);
  });

  it('un cobro en revisión sin pedido: el reintento con la misma llave responde PAGO_EN_REVISION con un mensaje claro', async () => {
    const { cliente, idSesion } = await sesionDePago();
    const llave = randomUUID();
    await pagar(app, cliente.token, llave, TARJETA_TIEMPO_AGOTADO);
    await abandonarIntento(idSesion);
    const toma = await checkoutRepository.tomarIntentoPorConciliar(120, 60);
    if (!toma.ejecutada || toma.intento === null)
      throw new Error('La conciliación no tomó el intento');
    await checkoutRepository.resolverIntentoConciliado(toma.intento, { estado: 'EnRevision' });

    const reintento = await pagar(app, cliente.token, llave, TARJETA_TIEMPO_AGOTADO);

    expect(reintento.status).toBe(409);
    expect(leerError(reintento)).toMatchObject({
      codigo: 'PAGO_EN_REVISION',
      mensaje: expect.stringContaining('no vuelvas a pagar') as unknown,
    });
    expect(await intentosDe(idSesion)).toMatchObject([{ Estado: 'EnRevision' }]);
  });

  it('no toca un intento cuyo arrendamiento venció hace menos de 2 minutos', async () => {
    const { cliente, idSesion } = await sesionDePago();
    await pagar(app, cliente.token, randomUUID(), TARJETA_TIEMPO_AGOTADO);
    await abandonarIntento(idSesion, VENCIDO_DENTRO_DE_GRACIA_S);

    await conciliar();

    expect(await intentosDe(idSesion)).toMatchObject([{ Estado: 'Pendiente' }]);
  });

  it('correrla dos veces no cambia nada la segunda', async () => {
    const { cliente, idSesion } = await sesionDePago();
    const llave = randomUUID();
    await pagar(app, cliente.token, llave, TARJETA_TIEMPO_AGOTADO);
    await abandonarIntento(idSesion);
    await conciliar();

    const segunda = await conciliar();

    expect(segunda).toEqual({
      Fallido: 0,
      Rechazado: 0,
      Anulado: 0,
      Capturado: 0,
      EnRevision: 0,
      SinCambio: 0,
      errores: 0,
    });
    expect(await intentosDe(idSesion)).toMatchObject([{ Estado: 'Anulado' }]);
    expect(await estadoEnPasarela(llave)).toBe('Anulada');
  });

  it('si la otra réplica tiene el bloqueo, retorna sin hacer nada', async () => {
    const { cliente, idSesion } = await sesionDePago();
    await pagar(app, cliente.token, randomUUID(), TARJETA_TIEMPO_AGOTADO);
    await abandonarIntento(idSesion);

    const resultado = await conBloqueoTomado('Job_Checkout_Conciliar', conciliar);

    expect(resultado).toBeNull();
    expect(await intentosDe(idSesion)).toMatchObject([{ Estado: 'Pendiente' }]);
    await conciliar();
  });
});

describe('cierre de E5: vigencia y fencing (N-03)', () => {
  it('con la sesión ya expirada por el job, una llave nueva responde 409 SESION_VENCIDA', async () => {
    const { cliente, idSesion } = await sesionDePago();
    await vencerSesion(idSesion);
    await expirarSesiones();

    const respuesta = await pagar(app, cliente.token, randomUUID());

    expect(respuesta.status).toBe(409);
    expect(leerError(respuesta).codigo).toBe('SESION_VENCIDA');
  });

  it('una petición cuyo arrendamiento retomó la conciliación no puede crear el pedido; no queda pedido sin cobro', async () => {
    // Autorizado sin pedido: falló el pedido y la anulación; la petición "zombi" conserva su token.
    const anulacionCaida = crearApp(
      dependenciasDePrueba({
        pasarela: pasarelaCon({ anular: () => Promise.reject(new Error('pasarela caída')) }),
      }),
    );
    const { IDVariante } = await varianteVendible('50.00', 10);
    const cambiarSku = (sku: string) =>
      request(app)
        .patch(`/api/v1/admin/variantes/${String(IDVariante)}`)
        .set(comoCliente(tokenAdmin))
        .send({ sku });
    await cambiarSku(`FALLA-${randomUUID().slice(0, 8)}`);
    const cliente = await clienteConCarrito(anulacionCaida, [
      { idVariante: IDVariante, cantidad: 1 },
    ]);
    const { idSesion } = leerSesionPago(await iniciarPago(anulacionCaida, cliente, estandar));
    const llave = randomUUID();
    await pagar(anulacionCaida, cliente.token, llave);
    const zombi = await abandonarIntento(idSesion);
    // Sin la falla, la petición zombi sí podría crear el pedido: solo la detiene el token.
    expect((await cambiarSku(`SANA-${randomUUID().slice(0, 8)}`)).status).toBe(200);
    let soltarAnulacion: () => void = () => undefined;
    const anulacionEnPausa = new Promise<void>((listo) => {
      soltarAnulacion = listo;
    });
    const real = crearPasarelaSimulada();
    const [, conciliacionLenta] = crearTareasDeCheckout({
      pasarela: pasarelaCon({
        anular: async (idTransaccion) => {
          await anulacionEnPausa;
          await real.anular(idTransaccion);
        },
      }),
      logger: pino({ level: 'silent' }),
    });
    if (conciliacionLenta === undefined) throw new Error('Falta la tarea de conciliación');

    const enCurso = conciliacionLenta.ejecutar();
    await hastaQue(
      async () => (await intentosDe(idSesion))[0]?.TokenArrendamiento !== zombi.TokenArrendamiento,
    );
    const intentoZombi = comoActor(cliente.idUsuario, 'Cliente', () =>
      pedidosParaCheckout.crearDeIntento(
        Number(zombi.IDIntentoPago),
        zombi.TokenArrendamiento ?? '',
      ),
    );
    await expect(intentoZombi).rejects.toMatchObject({ codigo: 'PAGO_EN_CURSO' });
    soltarAnulacion();
    await enCurso;

    expect((await pagoDe(idSesion)).Pedidos).toBe(0);
    expect(await intentosDe(idSesion)).toMatchObject([{ Estado: 'Anulado' }]);
    expect(await estadoEnPasarela(llave)).toBe('Anulada');
  });
});

describe('reintento de reembolsos y cancelaciones (E6-H03, N-09)', () => {
  const intentosDeLlave = (llave: string) =>
    ejecutarSP<{
      IDIntentoPago: string;
      IDSesionCheckout: number;
      Estado: string;
      CodigoRespuesta: string | null;
      TokenArrendamiento: string | null;
    }>('SP_Pruebas_LeerIntentosPago', {
      LlaveIdempotencia: { tipo: sql.UniqueIdentifier, valor: llave },
    });
  const reembolsosDe = async (idPedido: number) => {
    const [, reembolsos] = await ejecutarSPConjuntos<
      [unknown[], { IDReembolso: number; Estado: string; Intentos: number }[]]
    >('SP_Pruebas_LeerCancelacion', { IDPedido: { tipo: sql.Int, valor: idPedido } });
    return reembolsos ?? [];
  };
  const adelantar = (idReembolso: number) =>
    ejecutarSP('SP_Pruebas_AdelantarReembolso', {
      IDReembolso: { tipo: sql.Int, valor: idReembolso },
    });
  const cancelar = (aplicacion: typeof app, token: string, idPedido: number) =>
    request(aplicacion)
      .post(`/api/v1/pedidos/${String(idPedido)}/cancelar`)
      .set(comoCliente(token))
      .send({ motivo: 'Ya no lo necesito' });
  const sinReembolsos = pasarelaCon({
    reembolsar: () => Promise.reject(new Error('pasarela caída')),
  });
  const tareaReembolsos = (pasarela: PasarelaPago) => {
    const [tarea] = crearTareasDePedidos({
      pasarela,
      logger: pino({ level: 'silent' }),
      reportes: crearInvalidadorReportes(SIN_CACHE),
    });
    if (tarea === undefined) throw new Error('Falta la tarea de reembolsos');
    return tarea;
  };

  it('el job reintenta; al quinto fallo el reembolso queda Fallido en la lista del Admin, que lo resuelve', async () => {
    const { cliente, pedido } = await pedidoPagado(app, estandar);
    await cancelar(
      crearApp(dependenciasDePrueba({ pasarela: sinReembolsos })),
      cliente.token,
      pedido.idPedido,
    );
    const [reembolso] = await reembolsosDe(pedido.idPedido);
    if (reembolso === undefined) throw new Error('La cancelación no dejó reembolso');
    const jobCaido = tareaReembolsos(sinReembolsos);

    for (let intento = 2; intento <= 5; intento++) {
      await adelantar(reembolso.IDReembolso);
      await jobCaido.ejecutar();
    }

    expect(await reembolsosDe(pedido.idPedido)).toMatchObject([{ Estado: 'Fallido', Intentos: 5 }]);
    const fallidos = z
      .object({ datos: z.array(z.object({ idReembolso: z.number() })) })
      .parse(
        (
          await request(app)
            .get('/api/v1/admin/reembolsos?estado=Fallido&tamano=100')
            .set(comoCliente(tokenAdmin))
        ).body,
      );
    expect(fallidos.datos.map((r) => r.idReembolso)).toContain(reembolso.IDReembolso);
    await request(app)
      .post(`/api/v1/admin/reembolsos/${String(reembolso.IDReembolso)}/reintentar`)
      .set(comoCliente(tokenAdmin));
    expect(await reembolsosDe(pedido.idPedido)).toMatchObject([{ Estado: 'Completado' }]);
  });

  it('el job completa un reembolso pendiente cuando la pasarela vuelve', async () => {
    const { cliente, pedido } = await pedidoPagado(app, estandar);
    await cancelar(
      crearApp(dependenciasDePrueba({ pasarela: sinReembolsos })),
      cliente.token,
      pedido.idPedido,
    );
    const [reembolso] = await reembolsosDe(pedido.idPedido);
    await adelantar(reembolso?.IDReembolso ?? 0);

    const resultado = await tareaReembolsos(crearPasarelaSimulada()).ejecutar();

    expect(resultado).toMatchObject({ Completado: expect.any(Number) as number });
    expect(await reembolsosDe(pedido.idPedido)).toMatchObject([
      { Estado: 'Completado', Intentos: 1 },
    ]);
  });

  it('si la otra réplica tiene el bloqueo, el job retorna sin hacer nada', async () => {
    const resultado = await conBloqueoTomado('Job_Pedidos_ReintentarReembolsos', () =>
      tareaReembolsos(crearPasarelaSimulada()).ejecutar(),
    );

    expect(resultado).toBeNull();
  });

  it('la conciliación nunca captura el cobro de un pedido cancelado con la captura pendiente', async () => {
    const capturaCaida = crearApp(
      dependenciasDePrueba({
        pasarela: pasarelaCon({ capturar: () => Promise.reject(new Error('pasarela caída')) }),
      }),
    );
    const anulacionCaida = crearApp(
      dependenciasDePrueba({
        pasarela: pasarelaCon({ anular: () => Promise.reject(new Error('pasarela caída')) }),
      }),
    );
    const { cliente, pedido, llave } = await pedidoPagado(capturaCaida, estandar);
    const idSesion = (await intentosDeLlave(llave))[0]?.IDSesionCheckout ?? 0;
    // La cancelación no logra anular: la autorización sigue viva en la pasarela y el reembolso Pendiente.
    await cancelar(anulacionCaida, cliente.token, pedido.idPedido);
    await abandonarIntento(idSesion);

    await conciliar();

    expect(await estadoEnPasarela(llave)).toBe('Autorizada');
    expect(await intentosDeLlave(llave)).toMatchObject([
      { Estado: 'Anulado', CodigoRespuesta: 'PEDIDO_CANCELADO' },
    ]);
    const [reembolso] = await reembolsosDe(pedido.idPedido);
    await adelantar(reembolso?.IDReembolso ?? 0);
    await tareaReembolsos(crearPasarelaSimulada()).ejecutar();
    expect(await estadoEnPasarela(llave)).toBe('Anulada');
    expect(await reembolsosDe(pedido.idPedido)).toMatchObject([{ Estado: 'Completado' }]);
  });

  it('Resolver con un token que ya no es el vigente no cambia el intento (Resuelto = 0)', async () => {
    const capturaCaida = crearApp(
      dependenciasDePrueba({
        pasarela: pasarelaCon({ capturar: () => Promise.reject(new Error('pasarela caída')) }),
      }),
    );
    const { llave } = await pedidoPagado(capturaCaida, estandar);
    const [intento] = await intentosDeLlave(llave);
    if (intento === undefined) throw new Error('Falta el intento');

    const [fila] = await ejecutarSP<{ Resuelto: boolean }>(
      'SP_Checkout_ResolverIntentoConciliado',
      {
        IDIntentoPago: { tipo: sql.BigInt, valor: intento.IDIntentoPago },
        EstadoEsperado: { tipo: sql.VarChar(12), valor: 'Autorizado' },
        Estado: { tipo: sql.VarChar(12), valor: 'Capturado' },
        TokenArrendamiento: { tipo: sql.UniqueIdentifier, valor: randomUUID() },
      },
    );

    expect(fila?.Resuelto).toBe(false);
    expect(await intentosDeLlave(llave)).toMatchObject([
      { Estado: 'Autorizado', TokenArrendamiento: intento.TokenArrendamiento },
    ]);
  });
});

describe('expiración de carritos de invitado (E5-H04, N-05)', () => {
  const carritoDeInvitado = async (diasSinActividad: number) => {
    const hash = hashDe(randomUUID());
    const { IDCarrito } = await unaFila<{ IDCarrito: number }>('SP_Pruebas_InsertarCarrito', {
      HashTokenInvitado: { tipo: sql.Binary, valor: hash },
    });
    await ejecutarSP('SP_Pruebas_EnvejecerCarrito', {
      IDCarrito: { tipo: sql.Int, valor: IDCarrito },
      Dias: { tipo: sql.Int, valor: diasSinActividad },
    });
    return hash;
  };
  const estadoDe = async (hash: Buffer) =>
    (
      await unaFila<{ Estado: string }>('SP_Pruebas_LeerCarritos', {
        HashTokenInvitado: { tipo: sql.Binary, valor: hash },
      })
    ).Estado;

  it('con 30 días sin actividad pasa a Expirado; con menos sigue Activo; repetir no cambia nada', async () => {
    const viejo = await carritoDeInvitado(31);
    const reciente = await carritoDeInvitado(29);

    await ejecutar('Carrito.ExpirarInvitados');
    const segunda = await ejecutar('Carrito.ExpirarInvitados');

    expect(await estadoDe(viejo)).toBe('Expirado');
    expect(await estadoDe(reciente)).toBe('Activo');
    expect(segunda).toEqual({ carritosExpirados: 0 });
  });
});

describe('purga de llaves de idempotencia (E5-H04, E5-H03)', () => {
  it('borra las llaves de más de 24 h y conserva las recientes', async () => {
    const operador = leerSesion(await iniciarSesion(app, 'operador@shopcart.gt', 'Operador2026!'));
    const { IDVariante } = await varianteVendible('10.00', 0);
    const entrada = async (horas: number) => {
      const llave = randomUUID();
      await request(app)
        .post('/api/v1/inventario/entradas')
        .set({ ...comoCliente(operador.accessToken), 'Idempotency-Key': llave })
        .send({ idVariante: IDVariante, cantidad: 1, motivo: 'Compra' });
      await ejecutarSP('SP_Pruebas_EnvejecerSolicitudIdempotente', {
        LlaveIdempotencia: { tipo: sql.UniqueIdentifier, valor: llave },
        Horas: { tipo: sql.Int, valor: horas },
      });
      return llave;
    };
    const filas = async (llave: string) =>
      (
        await unaFila<{ Filas: number }>('SP_Pruebas_LeerSolicitudIdempotente', {
          LlaveIdempotencia: { tipo: sql.UniqueIdentifier, valor: llave },
        })
      ).Filas;
    const vieja = await entrada(25);
    const reciente = await entrada(23);

    await ejecutar('Sistema.PurgarSolicitudesIdempotentes');

    expect(await filas(vieja)).toBe(0);
    expect(await filas(reciente)).toBe(1);
  });
});
