import { randomUUID } from 'node:crypto';
import sql from 'mssql';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { crearApp } from '../../../src/app.js';
import { crearPasarelaSimulada } from '../../../src/shared/adapters/pasarela-simulada.js';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import type { PasarelaPago } from '../../../src/shared/pasarela/index.js';
import { leerError } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { comoCliente, varianteVendible } from '../carrito/apoyo-carrito.js';
import { comoActor } from '../datos-de-prueba.js';
import {
  clienteConCarrito,
  estadoEnPasarela,
  iniciarPago,
  intentosDe,
  leerSesionPago,
  metodoEnvio,
  moverArrendamiento,
  pagar,
  pagoDe,
  TARJETA_TIEMPO_AGOTADO,
} from './apoyo-checkout.js';

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());
let estandar: number;

beforeAll(async () => {
  estandar = await metodoEnvio(app);
});

const vencerSesion = (idSesion: number) =>
  ejecutarSP('SP_Pruebas_VencerSesionCheckout', {
    IDSesionCheckout: { tipo: sql.Int, valor: idSesion },
  });
const vencerReservas = (idSesion: number) =>
  ejecutarSP('SP_Pruebas_VencerReservasSesion', {
    IDSesionCheckout: { tipo: sql.Int, valor: idSesion },
  });

async function sesionDePago(aplicacion = app) {
  const { IDVariante } = await varianteVendible('40.00', 10);
  const cliente = await clienteConCarrito(aplicacion, [{ idVariante: IDVariante, cantidad: 1 }]);
  const { idSesion } = leerSesionPago(await iniciarPago(aplicacion, cliente, estandar));
  return { cliente, idSesion };
}

/** La pasarela simulada que cuenta cuántas veces se le pidió autorizar. */
function pasarelaQueCuenta(): { pasarela: PasarelaPago; autorizaciones: () => number } {
  const real = crearPasarelaSimulada();
  let veces = 0;
  return {
    pasarela: {
      ...real,
      autorizar: (solicitud) => {
        veces += 1;
        return real.autorizar(solicitud);
      },
    },
    autorizaciones: () => veces,
  };
}

describe('el pago empieza dentro de la vigencia de la sesión (cierre de E5, N-03)', () => {
  it('una llave nueva con la sesión vencida (sin que el job la marque) → 409 SESION_VENCIDA sin intento ni pasarela', async () => {
    const { cliente, idSesion } = await sesionDePago();
    await vencerSesion(idSesion);
    const llave = randomUUID();

    const respuesta = await pagar(app, cliente.token, llave);

    expect(respuesta.status).toBe(409);
    expect(leerError(respuesta).codigo).toBe('SESION_VENCIDA');
    expect(await intentosDe(idSesion)).toEqual([]);
    expect(await estadoEnPasarela(llave)).toBeUndefined();
  });

  it('una sesión que vence durante un pago en curso se acepta: el pedido se crea re-reservando bajo bloqueo', async () => {
    const real = crearPasarelaSimulada();
    let idSesionEnCurso = 0;
    const venceAlAutorizar = crearApp(
      dependenciasDePrueba({
        pasarela: {
          ...real,
          autorizar: async (solicitud) => {
            const resultado = await real.autorizar(solicitud);
            await vencerSesion(idSesionEnCurso);
            await vencerReservas(idSesionEnCurso);
            return resultado;
          },
        },
      }),
    );
    const { cliente, idSesion } = await sesionDePago(venceAlAutorizar);
    idSesionEnCurso = idSesion;

    const respuesta = await pagar(venceAlAutorizar, cliente.token, randomUUID());

    expect(respuesta.status).toBe(201);
    expect(await pagoDe(idSesion)).toMatchObject({ Pedidos: 1, EstadoSesion: 'Pagada' });
  });

  it('retomar un intento de una sesión vencida nunca autoriza: anula la autorización y responde SESION_VENCIDA', async () => {
    const { cliente, idSesion } = await sesionDePago();
    const llave = randomUUID();
    expect((await pagar(app, cliente.token, llave, TARJETA_TIEMPO_AGOTADO)).status).toBe(504);
    const [intento] = await intentosDe(idSesion);
    await vencerSesion(idSesion);
    await moverArrendamiento(intento?.IDIntentoPago ?? '0', -1);
    const { pasarela, autorizaciones } = pasarelaQueCuenta();
    const otraReplica = crearApp(dependenciasDePrueba({ pasarela }));

    const reintento = await pagar(otraReplica, cliente.token, llave, TARJETA_TIEMPO_AGOTADO);
    const repetido = await pagar(otraReplica, cliente.token, llave, TARJETA_TIEMPO_AGOTADO);

    expect(reintento.status).toBe(409);
    expect(leerError(reintento).codigo).toBe('SESION_VENCIDA');
    expect(autorizaciones()).toBe(0);
    expect(await intentosDe(idSesion)).toMatchObject([
      { Estado: 'Anulado', CodigoRespuesta: 'SESION_VENCIDA', Arrendado: false },
    ]);
    expect(await estadoEnPasarela(llave)).toBe('Anulada');
    expect((await pagoDe(idSesion)).Pedidos).toBe(0);
    expect(leerError(repetido).codigo).toBe('SESION_VENCIDA');
  });

  it('retomar un Pendiente que la pasarela nunca recibió, con la sesión vencida, lo deja Fallido sin autorizar', async () => {
    const sinRespuesta = crearApp(
      dependenciasDePrueba({
        pasarela: {
          ...crearPasarelaSimulada(),
          autorizar: () => Promise.reject(new Error('red caída')),
        },
      }),
    );
    const { cliente, idSesion } = await sesionDePago(sinRespuesta);
    const llave = randomUUID();
    await pagar(sinRespuesta, cliente.token, llave);
    const [intento] = await intentosDe(idSesion);
    await vencerSesion(idSesion);
    await moverArrendamiento(intento?.IDIntentoPago ?? '0', -1);

    const reintento = await pagar(app, cliente.token, llave);

    expect(leerError(reintento).codigo).toBe('SESION_VENCIDA');
    expect(await intentosDe(idSesion)).toMatchObject([
      { Estado: 'Fallido', CodigoRespuesta: 'SESION_VENCIDA' },
    ]);
    expect(await estadoEnPasarela(llave)).toBeUndefined();
  });
});

describe('tarjeta vencida (cierre de E5)', () => {
  it('una fecha de vencimiento pasada responde 400 en el campo, sin llegar a la pasarela', async () => {
    const { pasarela, autorizaciones } = pasarelaQueCuenta();
    const enNoviembre = crearApp(
      dependenciasDePrueba({ pasarela, reloj: { ahora: () => new Date('2026-11-15T12:00:00Z') } }),
    );
    const { cliente } = await sesionDePago(enNoviembre);

    const respuesta = await request(enNoviembre)
      .post('/api/v1/checkout/sesion/pagos')
      .set({ ...comoCliente(cliente.token), 'Idempotency-Key': randomUUID() })
      .send({
        numeroTarjeta: '4242424242424242',
        mesVencimiento: 10,
        anioVencimiento: 2026,
        cvv: '731',
      });

    expect(respuesta.status).toBe(400);
    expect(JSON.stringify(leerError(respuesta).detalles)).toContain('body.anioVencimiento');
    expect(autorizaciones()).toBe(0);
  });
});

describe('los SPs de los jobs solo corren como Sistema (cierre de E5, A-18)', () => {
  it.each(['SP_Checkout_ExpirarSesiones', 'SP_Carrito_ExpirarInvitados'] as const)(
    '%s llamado por un Cliente → INVARIANTE_INTERNA',
    async (nombre) => {
      const resultado = comoActor(1, 'Cliente', () => ejecutarSP(nombre));

      await expect(resultado).rejects.toMatchObject({ codigo: 'INVARIANTE_INTERNA' });
    },
  );
});
