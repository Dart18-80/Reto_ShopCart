import sql from 'mssql';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { crearApp } from '../../../src/app.js';
import {
  TRANSICIONES,
  type Transicion,
} from '../../../src/modules/pedidos/pedidos.transiciones.js';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import { leerError } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { iniciarSesion, leerSesion } from '../auth/apoyo-auth.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { comoCliente } from '../carrito/apoyo-carrito.js';
import { metodoEnvio } from '../checkout/apoyo-checkout.js';
import { comoActor } from '../datos-de-prueba.js';
import { pedidoPagado } from './apoyo-pedidos.js';

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());
let operador: { token: string; idUsuario: number };
let estandar: number;

beforeAll(async () => {
  const sesion = leerSesion(await iniciarSesion(app, 'operador@shopcart.gt', 'Operador2026!'));
  operador = { token: sesion.accessToken, idUsuario: sesion.usuario.idUsuario };
  estandar = await metodoEnvio(app);
});

const cambiar = (
  idPedido: number,
  estadoEsperado: string,
  estadoNuevo: string,
  motivo?: string,
  token = operador.token,
) =>
  request(app)
    .post(`/api/v1/admin/pedidos/${String(idPedido)}/estado`)
    .set(comoCliente(token))
    .send({ estadoEsperado, estadoNuevo, motivo });

interface FilaHistorial {
  CodigoEstadoAnterior: string | null;
  CodigoEstadoNuevo: string;
  IDUsuario: number;
  RolUsuario: string;
  Motivo: string | null;
  Fecha: Date;
}

const historialDe = (idPedido: number) =>
  ejecutarSP<FilaHistorial>('SP_Pruebas_LeerHistorialPedido', {
    IDPedido: { tipo: sql.Int, valor: idPedido },
  });

describe('cambios de estado (E6-H02, N-08)', () => {
  it('recorre Pagado → EnPreparacion → Despachado → Entregado y registra quién, cuándo, de qué a qué y por qué', async () => {
    const { pedido } = await pedidoPagado(app, estandar);
    const antes = Date.now();

    const pasos = [
      await cambiar(pedido.idPedido, 'Pagado', 'EnPreparacion', 'Armando el paquete'),
      await cambiar(pedido.idPedido, 'EnPreparacion', 'Despachado'),
      await cambiar(pedido.idPedido, 'Despachado', 'Entregado'),
    ];

    expect(pasos.map((r) => r.status)).toEqual([200, 200, 200]);
    const historial = await historialDe(pedido.idPedido);
    expect(historial.map((h) => [h.CodigoEstadoAnterior, h.CodigoEstadoNuevo])).toEqual([
      [null, 'Pagado'],
      ['Pagado', 'EnPreparacion'],
      ['EnPreparacion', 'Despachado'],
      ['Despachado', 'Entregado'],
    ]);
    expect(
      historial
        .slice(1)
        .every((h) => h.IDUsuario === operador.idUsuario && h.RolUsuario === 'Operador'),
    ).toBe(true);
    expect(historial[1]?.Motivo).toBe('Armando el paquete');
    expect(historial[1]?.Fecha.getTime()).toBeGreaterThanOrEqual(antes - 1000);
  });

  it('primera capa (backend): saltar un estado responde 409 TRANSICION_INVALIDA sin tocar la base', async () => {
    const { pedido } = await pedidoPagado(app, estandar);

    const respuesta = await cambiar(pedido.idPedido, 'Pagado', 'Entregado');

    expect(respuesta.status).toBe(409);
    expect(leerError(respuesta).codigo).toBe('TRANSICION_INVALIDA');
    expect(await historialDe(pedido.idPedido)).toHaveLength(1);
  });

  it('el endpoint nunca alcanza Cancelado, DevueltoParcial ni Devuelto', async () => {
    const { pedido } = await pedidoPagado(app, estandar);
    await cambiar(pedido.idPedido, 'Pagado', 'EnPreparacion');
    await cambiar(pedido.idPedido, 'EnPreparacion', 'Despachado');
    await cambiar(pedido.idPedido, 'Despachado', 'Entregado');

    const respuestas = [
      await cambiar(pedido.idPedido, 'Entregado', 'DevueltoParcial'),
      await cambiar(pedido.idPedido, 'Entregado', 'Devuelto'),
    ];

    expect(respuestas.map((r) => [r.status, leerError(r).codigo])).toEqual([
      [409, 'TRANSICION_INVALIDA'],
      [409, 'TRANSICION_INVALIDA'],
    ]);
  });

  it('segunda capa (SP): sin pasar por el servicio, la base rechaza la transición y los estados derivados', async () => {
    const { pedido } = await pedidoPagado(app, estandar);
    const llamar = (esperado: string, nuevo: string) =>
      comoActor(operador.idUsuario, 'Operador', () =>
        ejecutarSP('SP_Pedidos_CambiarEstado', {
          IDPedido: { tipo: sql.Int, valor: pedido.idPedido },
          EstadoEsperado: { tipo: sql.VarChar(20), valor: esperado },
          EstadoNuevo: { tipo: sql.VarChar(20), valor: nuevo },
        }),
      );

    await expect(llamar('Pagado', 'Despachado')).rejects.toMatchObject({
      codigo: 'TRANSICION_INVALIDA',
    });
    await expect(llamar('Pagado', 'Cancelado')).rejects.toMatchObject({
      codigo: 'TRANSICION_INVALIDA',
    });
  });

  it('tercera defensa (trigger): un UPDATE directo con una transición inválida se revierte', async () => {
    const { pedido } = await pedidoPagado(app, estandar);

    const directo = comoActor(operador.idUsuario, 'Operador', () =>
      ejecutarSP('SP_Pruebas_CambiarEstadoPedido', {
        IDPedido: { tipo: sql.Int, valor: pedido.idPedido },
        CodigoEstado: { tipo: sql.VarChar(20), valor: 'Entregado' },
      }),
    );

    await expect(directo).rejects.toMatchObject({ codigo: 'TRANSICION_INVALIDA' });
    expect(await historialDe(pedido.idPedido)).toHaveLength(1);
  });

  it('con un estado esperado que ya no es el actual responde 409 CONFLICTO_CONCURRENCIA', async () => {
    const { pedido } = await pedidoPagado(app, estandar);
    await cambiar(pedido.idPedido, 'Pagado', 'EnPreparacion');

    const tarde = await cambiar(pedido.idPedido, 'Pagado', 'EnPreparacion');

    expect(tarde.status).toBe(409);
    expect(leerError(tarde)).toMatchObject({
      codigo: 'CONFLICTO_CONCURRENCIA',
      mensaje: 'El pedido cambió de estado. Recarga para ver el estado actual.',
    });
  });

  it('dos operadores a la vez sobre el mismo pedido: uno gana y el otro recibe 409', async () => {
    const { pedido } = await pedidoPagado(app, estandar);

    const respuestas = await Promise.all([
      cambiar(pedido.idPedido, 'Pagado', 'EnPreparacion'),
      cambiar(pedido.idPedido, 'Pagado', 'EnPreparacion'),
    ]);

    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await historialDe(pedido.idPedido)).toHaveLength(2);
  });

  it('un pedido inexistente responde 404 y un Cliente no puede cambiar estados (403)', async () => {
    const { cliente, pedido } = await pedidoPagado(app, estandar);

    const inexistente = await cambiar(2147483647, 'Pagado', 'EnPreparacion');
    const comoElCliente = await cambiar(
      pedido.idPedido,
      'Pagado',
      'EnPreparacion',
      undefined,
      cliente.token,
    );

    expect([inexistente.status, comoElCliente.status]).toEqual([404, 403]);
  });
});

describe('el mapa del servicio coincide con TransicionEstadoPedido (E6-H02, N-08)', () => {
  const aFilas = (transiciones: readonly Transicion[]) =>
    transiciones.flatMap((t) => t.roles.map((rol) => `${t.origen}→${t.destino}:${rol}`)).sort();
  const tabla = async () =>
    (
      await ejecutarSP<{ Origen: string; Destino: string; Rol: string }>(
        'SP_Pedidos_ListarTransiciones',
      )
    )
      .map((f) => `${f.Origen}→${f.Destino}:${f.Rol}`)
      .sort();

  it('cada (origen, destino, rol) del mapa está en la tabla y viceversa', async () => {
    expect(aFilas(TRANSICIONES)).toEqual(await tabla());
  });

  it('la comparación detecta una diferencia (quitar un rol del mapa la rompe)', async () => {
    const [primera, ...resto] = TRANSICIONES;
    if (primera === undefined) throw new Error('El mapa está vacío');
    const sinUnRol = [{ ...primera, roles: primera.roles.slice(1) }, ...resto];

    expect(aFilas(sinUnRol)).not.toEqual(await tabla());
  });
});
