import sql from 'mssql';
import {
  bigintANumero,
  ejecutarSP,
  ejecutarSPConjuntos,
  type NombreSP,
  type ParametrosSP,
} from '../../shared/db/index.js';
import { aMonto } from '../../shared/dinero/index.js';
import type { EstadoExistencia } from '../catalogo/index.js';
import type {
  AvisoFusion,
  AvisoPrecio,
  Carrito,
  CookieInvitado,
  EstadoLinea,
  NuevaLinea,
  TipoAviso,
} from './carrito.types.js';

interface FilaLinea {
  IDLineaCarrito: number;
  IDVariante: number;
  IDProducto: number;
  Producto: string;
  SKU: string;
  DescripcionAtributos: string;
  Imagen: string | null;
  Cantidad: number;
  PrecioUnitario: number;
  TotalLinea: number;
  Estado: EstadoLinea;
  AjustarA: number | null;
  EstadoExistencia: EstadoExistencia;
  UnidadesRestantes: number | null;
  FechaGarantiaHasta: Date;
  Aviso: TipoAviso | null;
  AvisoPrecioAnterior: number | null;
}

interface FilaResumen {
  Lineas: number;
  Unidades: string | number;
  Subtotal: number;
  Descuento: number;
  Total: number;
  PuedePagar: boolean;
}

interface FilaAvisoFusion {
  IDVariante: number;
  Producto: string;
  Tipo: AvisoFusion['tipo'];
  CantidadSolicitada: number;
  CantidadFinal: number;
}

const aAvisoFusion = (fila: FilaAvisoFusion): AvisoFusion => ({
  idVariante: fila.IDVariante,
  producto: fila.Producto,
  tipo: fila.Tipo,
  cantidadSolicitada: fila.CantidadSolicitada,
  cantidadFinal: fila.CantidadFinal,
});

const aAviso = (tipo: TipoAviso | null, precioAnterior: number | null): AvisoPrecio | null =>
  tipo === null
    ? null
    : { tipo, precioAnterior: precioAnterior === null ? null : aMonto(precioAnterior) };

const aCarrito = (lineas: FilaLinea[], resumen: FilaResumen): Carrito => ({
  lineas: lineas.map((fila) => ({
    idLinea: fila.IDLineaCarrito,
    idVariante: fila.IDVariante,
    idProducto: fila.IDProducto,
    producto: fila.Producto,
    sku: fila.SKU,
    descripcionAtributos: fila.DescripcionAtributos,
    imagen: fila.Imagen,
    cantidad: fila.Cantidad,
    precioUnitario: aMonto(fila.PrecioUnitario),
    totalLinea: aMonto(fila.TotalLinea),
    estado: fila.Estado,
    ajustarA: fila.AjustarA,
    existencia: { estado: fila.EstadoExistencia, unidadesRestantes: fila.UnidadesRestantes },
    garantiaHasta: fila.FechaGarantiaHasta,
    aviso: aAviso(fila.Aviso, fila.AvisoPrecioAnterior),
  })),
  resumen: {
    lineas: resumen.Lineas,
    unidades: bigintANumero(resumen.Unidades, 'Unidades'),
    subtotal: aMonto(resumen.Subtotal),
    descuento: aMonto(resumen.Descuento),
    total: aMonto(resumen.Total),
    puedePagar: resumen.PuedePagar,
  },
});

/** Los SPs de carrito devuelven el carrito completo, o ningún conjunto si no hay carrito Activo. */
async function carritoDe(nombre: NombreSP, parametros: ParametrosSP): Promise<Carrito | null> {
  const [lineas, resumenes] = await ejecutarSPConjuntos<[FilaLinea[], FilaResumen[]]>(
    nombre,
    parametros,
  );
  const resumen = resumenes?.[0];
  return lineas === undefined || resumen === undefined ? null : aCarrito(lineas, resumen);
}

function existente(carrito: Carrito | null, nombre: NombreSP): Carrito {
  if (carrito === null) throw new Error(`${nombre} no devolvió el carrito`);
  return carrito;
}

const hashInvitado = (hash: Buffer | null) => ({ tipo: sql.Binary, valor: hash });

// RF-01: el cliente sale de @IDUsuarioActor (el token); el invitado, del hash de su cookie. El repositorio
// nunca recibe ni devuelve el ID del carrito.
export const carritoRepository = {
  /** null si quien pide no tiene un carrito Activo. */
  obtener(hash: Buffer | null): Promise<Carrito | null> {
    return carritoDe('SP_Carrito_Obtener', { HashTokenInvitado: hashInvitado(hash) });
  },

  /** null si es un invitado cuya cookie no tiene un carrito Activo (y no se pidió crear uno). */
  agregarLinea(linea: NuevaLinea, cookie: CookieInvitado): Promise<Carrito | null> {
    return carritoDe('SP_Carrito_AgregarLinea', {
      IDVariante: { tipo: sql.Int, valor: linea.idVariante },
      Cantidad: { tipo: sql.Int, valor: linea.cantidad },
      HashTokenInvitado: hashInvitado(cookie.hashActual),
      HashTokenNuevo: hashInvitado(cookie.hashNuevo),
    });
  },

  /** null si quien pide no tiene un carrito Activo. */
  marcarAvisosVistos(hash: Buffer | null): Promise<Carrito | null> {
    return carritoDe('SP_Carrito_MarcarAvisosVistos', { HashTokenInvitado: hashInvitado(hash) });
  },

  /** N-05: el carrito del invitado se fusiona con el del cliente de la petición. */
  async fusionar(hash: Buffer): Promise<AvisoFusion[]> {
    const filas = await ejecutarSP<FilaAvisoFusion>('SP_Carrito_Fusionar', {
      HashTokenInvitado: hashInvitado(hash),
    });
    return filas.map(aAvisoFusion);
  },

  /** N-05: el carrito del invitado pasa a ser del cliente nuevo de la petición. */
  async asignarInvitado(hash: Buffer): Promise<void> {
    await ejecutarSP('SP_Carrito_AsignarInvitado', { HashTokenInvitado: hashInvitado(hash) });
  },

  async actualizarCantidad(
    idLinea: number,
    cantidad: number,
    hash: Buffer | null,
  ): Promise<Carrito> {
    const carrito = await carritoDe('SP_Carrito_ActualizarCantidad', {
      IDLineaCarrito: { tipo: sql.Int, valor: idLinea },
      Cantidad: { tipo: sql.Int, valor: cantidad },
      HashTokenInvitado: hashInvitado(hash),
    });
    return existente(carrito, 'SP_Carrito_ActualizarCantidad');
  },

  async eliminarLinea(idLinea: number, hash: Buffer | null): Promise<Carrito> {
    const carrito = await carritoDe('SP_Carrito_EliminarLinea', {
      IDLineaCarrito: { tipo: sql.Int, valor: idLinea },
      HashTokenInvitado: hashInvitado(hash),
    });
    return existente(carrito, 'SP_Carrito_EliminarLinea');
  },
};

export type CarritoRepository = typeof carritoRepository;
