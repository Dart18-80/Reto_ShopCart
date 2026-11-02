import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import sql from 'mssql';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import { agregar, comoCliente, varianteVendible } from '../carrito/apoyo-carrito.js';
import {
  clienteConCarrito,
  iniciarPago,
  leerPedido,
  leerSesionPago,
  pagar,
  type ClienteDePrueba,
} from '../checkout/apoyo-checkout.js';

/** Un pedido pagado del cliente (uno nuevo si no se pasa) con las líneas dadas. */
export async function pedidoPagado(
  app: Express,
  idMetodoEnvio: number,
  {
    cliente,
    lineas,
  }: { cliente?: ClienteDePrueba; lineas?: { precio: string; cantidad: number }[] } = {},
) {
  const variantes = await Promise.all(
    (lineas ?? [{ precio: '50.00', cantidad: 2 }]).map(async ({ precio, cantidad }) => ({
      idVariante: (await varianteVendible(precio, 20)).IDVariante,
      cantidad,
    })),
  );
  let comprador = cliente;
  if (comprador === undefined) {
    comprador = await clienteConCarrito(app, variantes);
  } else {
    for (const { idVariante, cantidad } of variantes) {
      await agregar(app, comoCliente(comprador.token), idVariante, cantidad);
    }
  }
  leerSesionPago(await iniciarPago(app, comprador, idMetodoEnvio));
  const pedido = leerPedido(await pagar(app, comprador.token, randomUUID()));
  return { cliente: comprador, pedido, variantes };
}

/** Lleva el pedido a un día de pago de Guatemala (FechaPagoLocal) dado. */
export function moverFechaPedido(idPedido: number, fechaLocal: string) {
  return ejecutarSP('SP_Pruebas_MoverFechaPedido', {
    IDPedido: { tipo: sql.Int, valor: idPedido },
    FechaLocal: { tipo: sql.Date, valor: fechaLocal },
  });
}
