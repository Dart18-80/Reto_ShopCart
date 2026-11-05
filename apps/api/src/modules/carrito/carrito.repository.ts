import type { IlustracionPrenda } from '@shopcart/shared';
import sql from 'mssql';
import {
  bigintANumero,
  ejecutarSP,
  ejecutarSPConjuntos,
  type NombreSP,
  type ParametrosSP,
} from '../../shared/db/index.js';
import { aMonto } from '../../shared/dinero/index.js';
import { codigoPorNumeroSql } from '../../shared/errors/index.js';
import type { EstadoExistencia } from '../catalogo/index.js';
import type {
  AjusteFusion,
  AvisoPrecio,
  Carrito,
  CookieInvitado,
  EstadoLinea,
  NuevaLinea,
  ResumenCarrito,
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
  // CK_Categoria_Ilustracion garantiza que es una de la lista.
  Ilustracion: IlustracionPrenda;
  Color: string | null;
  Cantidad: number;
  PrecioUnitario: number;
  TotalLinea: number;
  TotalComprable: number;
  DescuentoLinea: number;
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
  CodigoCupon: string | null;
  DescripcionCupon: string | null;
  CuponRetiradoCodigo: string | null;
  CuponRetiradoNumero: number | null;
  CuponRetiradoMensaje: string | null;
  EnvioGratisMinimo: number | null;
  EnvioGratisFaltante: number | null;
  EnvioGratisAlcanzado: boolean | null;
}

interface FilaAvisoFusion {
  IDVariante: number;
  Producto: string;
  Tipo: AjusteFusion['tipo'];
  CantidadSolicitada: number;
  CantidadFinal: number;
}

const aAjusteFusion = (fila: FilaAvisoFusion): AjusteFusion => ({
  tipo: fila.Tipo,
  idVariante: fila.IDVariante,
  producto: fila.Producto,
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
    ilustracion: fila.Ilustracion,
    color: fila.Color,
    cantidad: fila.Cantidad,
    precioUnitario: aMonto(fila.PrecioUnitario),
    totalLinea: aMonto(fila.TotalLinea),
    totalComprable: aMonto(fila.TotalComprable),
    descuentoLinea: aMonto(fila.DescuentoLinea),
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
    cupon:
      resumen.CodigoCupon === null || resumen.DescripcionCupon === null
        ? null
        : { codigo: resumen.CodigoCupon, descripcion: resumen.DescripcionCupon },
    cuponRetirado: aCuponRetirado(resumen),
    envioGratis: aEnvioGratis(resumen),
  },
});

function aEnvioGratis(resumen: FilaResumen): ResumenCarrito['envioGratis'] {
  const {
    EnvioGratisMinimo: minimo,
    EnvioGratisFaltante: faltante,
    EnvioGratisAlcanzado: alcanzado,
  } = resumen;
  if (minimo === null || faltante === null || alcanzado === null) return null;
  return { montoMinimo: aMonto(minimo), faltante: aMonto(faltante), alcanzado };
}

function aCuponRetirado(resumen: FilaResumen): ResumenCarrito['cuponRetirado'] {
  const {
    CuponRetiradoCodigo: codigo,
    CuponRetiradoNumero: numero,
    CuponRetiradoMensaje: mensaje,
  } = resumen;
  if (codigo === null || numero === null || mensaje === null) return null;
  const motivo = codigoPorNumeroSql(numero);
  if (motivo === undefined)
    throw new Error(`SP_Carrito_Obtener devolvió un motivo sin catalogar: ${String(numero)}`);
  return { codigo, motivo, mensaje };
}

/** Los SPs de carrito devuelven el carrito completo, o ningún conjunto si no hay carrito Activo. */
async function carritoDe(nombre: NombreSP, parametros: ParametrosSP): Promise<Carrito | null> {
  const [lineas, resumenes] = await ejecutarSPConjuntos<[FilaLinea[], FilaResumen[]]>(
    nombre,
    parametros,
  );
  if (lineas === undefined && resumenes === undefined) return null;
  // Un carrito a medias es un error del SP, nunca "no hay carrito": eso borraría la cookie del invitado.
  const resumen = resumenes?.[0];
  if (lineas === undefined || resumen === undefined) {
    throw new Error(`${nombre} devolvió un carrito incompleto`);
  }
  return aCarrito(lineas, resumen);
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

  /** N-12: aplica el cupón como vista previa. Sin carrito o vacío, el SP responde 50403. */
  async aplicarCupon(codigo: string, hash: Buffer | null): Promise<Carrito> {
    const carrito = await carritoDe('SP_Carrito_AplicarCupon', {
      Codigo: { tipo: sql.VarChar(30), valor: codigo },
      HashTokenInvitado: hashInvitado(hash),
    });
    return existente(carrito, 'SP_Carrito_AplicarCupon');
  },

  /** null si quien pide no tiene un carrito Activo. */
  quitarCupon(hash: Buffer | null): Promise<Carrito | null> {
    return carritoDe('SP_Carrito_QuitarCupon', { HashTokenInvitado: hashInvitado(hash) });
  },

  /** N-05: el carrito del invitado se fusiona con el del cliente de la petición. */
  async fusionar(hash: Buffer): Promise<AjusteFusion[]> {
    const filas = await ejecutarSP<FilaAvisoFusion>('SP_Carrito_Fusionar', {
      HashTokenInvitado: hashInvitado(hash),
    });
    return filas.map(aAjusteFusion);
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

  /** Job (A-04, N-05). null si la otra réplica tenía el sp_getapplock. */
  async expirarInvitados(): Promise<number | null> {
    const [fila] = await ejecutarSP<{ Ejecutada: boolean; CarritosExpirados: number }>(
      'SP_Carrito_ExpirarInvitados',
    );
    if (fila === undefined) throw new Error('SP_Carrito_ExpirarInvitados no devolvió el resultado');
    return fila.Ejecutada ? fila.CarritosExpirados : null;
  },
};

export type CarritoRepository = typeof carritoRepository;
