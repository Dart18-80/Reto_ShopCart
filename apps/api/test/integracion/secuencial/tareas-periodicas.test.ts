import { randomUUID } from 'node:crypto';
import sql from 'mssql';
import pino from 'pino';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { crearApp } from '../../../src/app.js';
import { crearTareasDeCarrito } from '../../../src/modules/carrito/index.js';
import { crearTareasDeCheckout } from '../../../src/modules/checkout/index.js';
import { crearTareasDeSistema } from '../../../src/modules/sistema/index.js';
import { crearPasarelaSimulada } from '../../../src/shared/adapters/pasarela-simulada.js';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import type { ResultadoTarea, Tarea } from '../../../src/shared/jobs/index.js';
import { PasarelaSinRespuesta, type PasarelaPago } from '../../../src/shared/pasarela/index.js';
import { leerError } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
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
import { unaFila } from '../datos-de-prueba.js';

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());
const tareas = [
  ...crearTareasDeCheckout({
    pasarela: crearPasarelaSimulada(),
    logger: pino({ level: 'silent' }),
  }),
  ...crearTareasDeCarrito(),
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
