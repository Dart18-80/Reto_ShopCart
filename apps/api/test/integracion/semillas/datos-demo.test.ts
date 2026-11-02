import sql from 'mssql';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import { leerDatos, leerError } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { iniciarSesion, leerSesion } from '../auth/apoyo-auth.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { agregar, comoCliente, varianteVendible } from '../carrito/apoyo-carrito.js';
import { clienteConCarrito } from '../checkout/apoyo-checkout.js';
import { unaFila } from '../datos-de-prueba.js';

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());
let tokenAdmin: string;
let idAdmin: number;

beforeAll(async () => {
  const sesion = leerSesion(await iniciarSesion(app, 'admin@shopcart.gt', 'Admin2026!'));
  tokenAdmin = sesion.accessToken;
  idAdmin = sesion.usuario.idUsuario;
});

interface ResumenDemo {
  Pedidos: number;
  Clientes: number;
  DiasDelMasAntiguo: number;
  PedidosEnElFuturo: number;
  Cancelados: number;
  ConDevolucion: number;
  Entregados: number;
  VentasSinKardexEnSuFecha: number;
  ReingresosFueraDeFecha: number;
  HistorialFueraDeFecha: number;
  HistorialEnElFuturo: number;
  CobrosFueraDeLaPasarela: number;
  KardexConOtroAutor: number;
  AltasDeClientesSinActor: number;
  CuponesDelAdmin: number;
  ReembolsosFueraDeLaPasarela: number;
  CarritosAbandonados: number;
  FilasConciliacion: number;
}

describe('datos demo de S006 (E7-H03, RNF-1)', () => {
  it('1,500 pedidos de ~200 clientes en los últimos 90 días, con cancelaciones, devoluciones y carritos abandonados', async () => {
    const resumen = await unaFila<ResumenDemo>('SP_Pruebas_ResumenDatosDemo');

    expect(resumen).toMatchObject({ Pedidos: 1500, Clientes: 200, PedidosEnElFuturo: 0 });
    expect(resumen.DiasDelMasAntiguo).toBeLessThanOrEqual(90);
    expect(resumen.DiasDelMasAntiguo).toBeGreaterThanOrEqual(85);
    expect(resumen.Cancelados).toBeGreaterThan(0);
    expect(resumen.ConDevolucion).toBeGreaterThan(0);
    expect(resumen.Entregados).toBeGreaterThan(resumen.Cancelados);
    expect(resumen.CarritosAbandonados).toBeGreaterThan(0);
  });

  it('kardex, pedidos e historial coinciden en el tiempo y la conciliación de inventario queda vacía', async () => {
    const resumen = await unaFila<ResumenDemo>('SP_Pruebas_ResumenDatosDemo');

    expect(resumen).toMatchObject({
      VentasSinKardexEnSuFecha: 0,
      ReingresosFueraDeFecha: 0,
      HistorialFueraDeFecha: 0,
      HistorialEnElFuturo: 0,
      FilasConciliacion: 0,
    });
  });

  it('la pasarela simulada conoce cada cobro y cada reembolso demo, para poder cancelar o devolver en la demo', async () => {
    const resumen = await unaFila<ResumenDemo>('SP_Pruebas_ResumenDatosDemo');

    expect(resumen).toMatchObject({ CobrosFueraDeLaPasarela: 0, ReembolsosFueraDeLaPasarela: 0 });
  });

  it('atribuye cada acción a quien la registraría: compras a su cliente, entradas y cupones al Admin, altas sin actor', async () => {
    const resumen = await unaFila<ResumenDemo>('SP_Pruebas_ResumenDatosDemo');

    expect(resumen).toMatchObject({
      KardexConOtroAutor: 0,
      AltasDeClientesSinActor: 200,
      CuponesDelAdmin: 8,
    });
  });

  it('N-07: en toda la base, el kardex ordenado por fecha o por ID da el mismo orden y los mismos saldos', async () => {
    const kardex = await unaFila<{
      Movimientos: number;
      FueraDeOrden: number;
      SaldosDistintos: number;
    }>('SP_Pruebas_KardexFueraDeOrden');

    expect(kardex.Movimientos).toBeGreaterThan(1500);
    expect(kardex).toMatchObject({ FueraDeOrden: 0, SaldosDistintos: 0 });
  });

  it('el dashboard muestra los últimos 90 días desde el primer arranque', async () => {
    const hoy = new Date();
    const hace89 = new Date(hoy.getTime() - 89 * 24 * 3600 * 1000);
    const dia = (fecha: Date) => fecha.toISOString().slice(0, 10);

    const resumen = leerDatos(
      await request(app)
        .get(`/api/v1/dashboard/resumen?desde=${dia(hace89)}&hasta=${dia(hoy)}`)
        .set(comoCliente(tokenAdmin)),
      z.object({ pedidos: z.number(), ventas: z.string() }),
    );
    const meses = leerDatos(
      await request(app)
        .get(`/api/v1/dashboard/ventas?agrupacion=mes&desde=${dia(hace89)}&hasta=${dia(hoy)}`)
        .set(comoCliente(tokenAdmin)),
      z.array(z.object({ periodo: z.string(), pedidos: z.number() })),
    );

    expect(resumen.pedidos).toBeGreaterThan(1300);
    expect(Number(resumen.ventas)).toBeGreaterThan(0);
    expect(meses.length).toBeGreaterThanOrEqual(3);
  });

  it('hay un cupón para demostrar cada mensaje de rechazo de RF-05', async () => {
    const { IDVariante } = await varianteVendible('40.00', 10);
    const cliente = await clienteConCarrito(app, [{ idVariante: IDVariante, cantidad: 1 }]);
    const aplicar = (codigo: string, token = cliente.token) =>
      request(app).put('/api/v1/carrito/cupon').set(comoCliente(token)).send({ codigo });
    const demo = leerSesion(
      await iniciarSesion(app, 'cliente@shopcart.gt', 'Cliente2026!'),
    ).accessToken;
    await agregar(app, comoCliente(demo), IDVariante);

    const codigos = {
      NOEXISTE: leerError(await aplicar('NOEXISTE')).codigo,
      DEMOVENCIDO: leerError(await aplicar('DEMOVENCIDO')).codigo,
      DEMOFUTURO: leerError(await aplicar('DEMOFUTURO')).codigo,
      DEMOINACTIVO: leerError(await aplicar('DEMOINACTIVO')).codigo,
      DEMOAGOTADO: leerError(await aplicar('DEMOAGOTADO')).codigo,
      DEMOMINIMO: leerError(await aplicar('DEMOMINIMO')).codigo,
      DEMOCATEGORIA: leerError(await aplicar('DEMOCATEGORIA')).codigo,
      DEMOUNAVEZ: leerError(await aplicar('DEMOUNAVEZ', demo)).codigo,
    };
    const vigente = await aplicar('DEMO10');

    expect(codigos).toEqual({
      NOEXISTE: 'CUPON_NO_EXISTE',
      DEMOVENCIDO: 'CUPON_VENCIDO',
      DEMOFUTURO: 'CUPON_NO_VIGENTE_AUN',
      DEMOINACTIVO: 'CUPON_INACTIVO',
      DEMOAGOTADO: 'CUPON_AGOTADO',
      DEMOMINIMO: 'CUPON_MINIMO_NO_ALCANZADO',
      DEMOCATEGORIA: 'CUPON_SIN_PRODUCTOS_CATEGORIA',
      DEMOUNAVEZ: 'CUPON_LIMITE_CLIENTE',
    });
    expect(vigente.status).toBe(200);
  });
});

describe('fecha propia de un movimiento de inventario (E7-H03, N-07)', () => {
  // Sin existencia inicial, la variante no tiene movimientos previos que acoten la fecha.
  const movimientoConFecha = async (rol: string, fecha: Date, existencia = 0) => {
    const { IDVariante } = await varianteVendible('10.00', existencia);
    return ejecutarSP<{ Fecha: Date }>('SP_Pruebas_MovimientoConFecha', {
      IDVariante: { tipo: sql.Int, valor: IDVariante },
      FechaMovimiento: { tipo: sql.DateTime2(3), valor: fecha },
      Rol: { tipo: sql.VarChar(20), valor: rol },
      IDUsuario: { tipo: sql.Int, valor: idAdmin },
    });
  };

  it('el rol Sistema registra el movimiento con la fecha dada', async () => {
    const fecha = new Date('2026-01-15T10:00:00.000Z');

    const [movimiento] = await movimientoConFecha('Sistema', fecha);

    expect(movimiento?.Fecha.toISOString()).toBe(fecha.toISOString());
  });

  it('otro rol no puede fijar la fecha (INVARIANTE_INTERNA) y nadie puede usar una fecha futura', async () => {
    const pasado = new Date('2026-01-15T10:00:00.000Z');
    const futuro = new Date(Date.now() + 24 * 3600 * 1000);

    await expect(movimientoConFecha('Operador', pasado)).rejects.toMatchObject({
      codigo: 'INVARIANTE_INTERNA',
    });
    await expect(movimientoConFecha('Sistema', futuro)).rejects.toMatchObject({
      codigo: 'PARAMETRO_INVALIDO',
    });
  });

  it('una fecha anterior al último movimiento de la variante se rechaza (las fechas nunca retroceden)', async () => {
    const antesDeLaEntrada = new Date('2026-01-15T10:00:00.000Z');

    await expect(movimientoConFecha('Sistema', antesDeLaEntrada, 5)).rejects.toMatchObject({
      codigo: 'PARAMETRO_INVALIDO',
    });
  });
});
