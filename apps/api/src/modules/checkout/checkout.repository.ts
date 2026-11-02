import sql from 'mssql';
import { ejecutarSP, ejecutarSPConjuntos } from '../../shared/db/index.js';
import { aMonto } from '../../shared/dinero/index.js';
import type { DatosInicioPago, SesionIniciada, SesionPago } from './checkout.types.js';

interface FilaSesion {
  IDSesionCheckout: number;
  FechaExpiracion: Date;
  NombreRecibe: string;
  TelefonoRecibe: string;
  IDMunicipio: number;
  Municipio: string;
  Departamento: string;
  DireccionLinea: string;
  Referencia: string | null;
  IDMetodoEnvio: number;
  NombreMetodoEnvio: string;
  DiasMin: number;
  DiasMax: number;
  CodigoCupon: string | null;
  Subtotal: number;
  Descuento: number;
  CostoEnvio: number;
  Total: number;
  IntentosRechazados: number;
}

interface FilaLineaSesion {
  IDVariante: number;
  IDProducto: number;
  Producto: string;
  SKU: string;
  DescripcionAtributos: string;
  Cantidad: number;
  PrecioUnitario: number;
  DescuentoLinea: number;
  TotalLinea: number;
}

const aSesion = (fila: FilaSesion, lineas: FilaLineaSesion[]): SesionPago => ({
  idSesion: fila.IDSesionCheckout,
  expiraEn: fila.FechaExpiracion,
  direccion: {
    nombreRecibe: fila.NombreRecibe,
    telefonoRecibe: fila.TelefonoRecibe,
    idMunicipio: fila.IDMunicipio,
    municipio: fila.Municipio,
    departamento: fila.Departamento,
    direccionLinea: fila.DireccionLinea,
    referencia: fila.Referencia,
  },
  envio: {
    idMetodoEnvio: fila.IDMetodoEnvio,
    nombre: fila.NombreMetodoEnvio,
    diasMin: fila.DiasMin,
    diasMax: fila.DiasMax,
    costo: aMonto(fila.CostoEnvio),
  },
  codigoCupon: fila.CodigoCupon,
  lineas: lineas.map((linea) => ({
    idVariante: linea.IDVariante,
    idProducto: linea.IDProducto,
    producto: linea.Producto,
    sku: linea.SKU,
    descripcionAtributos: linea.DescripcionAtributos,
    cantidad: linea.Cantidad,
    precioUnitario: aMonto(linea.PrecioUnitario),
    descuentoLinea: aMonto(linea.DescuentoLinea),
    totalLinea: aMonto(linea.TotalLinea),
  })),
  subtotal: aMonto(fila.Subtotal),
  descuento: aMonto(fila.Descuento),
  total: aMonto(fila.Total),
  intentosRechazados: fila.IntentosRechazados,
});

// RF-01: el cliente sale de @IDUsuarioActor (el token); ni la sesión ni el carrito llegan de la petición.
export const checkoutRepository = {
  async iniciarSesion(datos: DatosInicioPago): Promise<SesionIniciada> {
    const [resultado, sesiones, lineas] = await ejecutarSPConjuntos<
      [{ Creada: boolean }[], FilaSesion[], FilaLineaSesion[]]
    >('SP_Checkout_IniciarSesion', {
      IDDireccion: { tipo: sql.Int, valor: datos.idDireccion },
      IDMetodoEnvio: { tipo: sql.Int, valor: datos.idMetodoEnvio },
    });
    const creada = resultado?.[0]?.Creada;
    const sesion = sesiones?.[0];
    if (creada === undefined || sesion === undefined || lineas === undefined) {
      throw new Error('SP_Checkout_IniciarSesion no devolvió la sesión');
    }
    return { sesion: aSesion(sesion, lineas), creada };
  },

  /** null si el cliente no tiene una sesión de pago Activa. */
  async obtenerSesion(): Promise<SesionPago | null> {
    const [sesiones, lineas] = await ejecutarSPConjuntos<[FilaSesion[], FilaLineaSesion[]]>(
      'SP_Checkout_ObtenerSesion',
    );
    const sesion = sesiones?.[0];
    if (sesion === undefined) return null;
    if (lineas === undefined)
      throw new Error('SP_Checkout_ObtenerSesion devolvió una sesión incompleta');
    return aSesion(sesion, lineas);
  },

  async cancelarSesion(): Promise<void> {
    await ejecutarSP('SP_Checkout_CancelarSesion');
  },
};

export type CheckoutRepository = typeof checkoutRepository;
