import sql from 'mssql';
import { bigintANumero, ejecutarSP, ejecutarSPConjuntos } from '../../shared/db/index.js';
import { aMonto } from '../../shared/dinero/index.js';
import type {
  Arrendamiento,
  CambioIntento,
  DatosInicioPago,
  IntentoPorConciliar,
  RegistroIntento,
  ResolucionConciliada,
  SesionIniciada,
  SesionPago,
  TomaConciliacion,
} from './checkout.types.js';

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

interface FilaRegistro {
  Accion: RegistroIntento['accion'];
  IDIntentoPago: string | number | null;
  Monto: number | null;
  IDTransaccion: string | null;
  IDPedido: number | null;
  CodigoRespuesta: string | null;
  MensajeRespuesta: string | null;
  TokenArrendamiento: string | null;
  SegundosParaReintentar: number | null;
  IntentosRestantes: number;
}

function presente<T>(valor: T | null, columna: string): T {
  if (valor === null) throw new Error(`SP_Checkout_RegistrarIntentoPago devolvió ${columna} vacío`);
  return valor;
}

function aRegistro(fila: FilaRegistro): RegistroIntento {
  const arrendamiento = () => ({
    idIntento: bigintANumero(presente(fila.IDIntentoPago, 'IDIntentoPago'), 'IDIntentoPago'),
    token: presente(fila.TokenArrendamiento, 'TokenArrendamiento'),
  });
  switch (fila.Accion) {
    case 'Autorizar':
      return {
        accion: 'Autorizar',
        ...arrendamiento(),
        monto: aMonto(presente(fila.Monto, 'Monto')),
      };
    case 'CrearPedido':
      return {
        accion: 'CrearPedido',
        ...arrendamiento(),
        idTransaccion: presente(fila.IDTransaccion, 'IDTransaccion'),
      };
    case 'Capturar':
      return {
        accion: 'Capturar',
        ...arrendamiento(),
        idTransaccion: presente(fila.IDTransaccion, 'IDTransaccion'),
        idPedido: presente(fila.IDPedido, 'IDPedido'),
      };
    case 'Cerrar':
      return { accion: 'Cerrar', ...arrendamiento() };
    case 'Pedido':
      return { accion: 'Pedido', idPedido: presente(fila.IDPedido, 'IDPedido') };
    case 'EnCurso':
      return {
        accion: 'EnCurso',
        segundosParaReintentar: presente(fila.SegundosParaReintentar, 'SegundosParaReintentar'),
      };
    case 'Rechazado':
      return {
        accion: 'Rechazado',
        mensaje: fila.MensajeRespuesta ?? 'El pago fue rechazado.',
        intentosRestantes: fila.IntentosRestantes,
      };
    case 'Error':
      return {
        accion: 'Error',
        codigo: fila.CodigoRespuesta ?? 'ERROR_INTERNO',
        mensaje: fila.MensajeRespuesta,
      };
    default:
      throw new Error(
        `SP_Checkout_RegistrarIntentoPago devolvió una acción desconocida: ${String(fila.Accion satisfies never)}`,
      );
  }
}

interface FilaPorConciliar {
  Ejecutada: boolean;
  IDIntentoPago: string | number | null;
  Estado: IntentoPorConciliar['estado'] | null;
  LlaveIdempotencia: string | null;
  IDTransaccion: string | null;
  IDPedido: number | null;
  TokenArrendamiento: string | null;
}

function aToma(fila: FilaPorConciliar): TomaConciliacion {
  if (!fila.Ejecutada) return { ejecutada: false };
  if (fila.IDIntentoPago === null) return { ejecutada: true, intento: null };
  if (fila.Estado === null || fila.LlaveIdempotencia === null || fila.TokenArrendamiento === null)
    throw new Error('SP_Checkout_TomarIntentosPorConciliar devolvió un intento incompleto');
  return {
    ejecutada: true,
    intento: {
      idIntento: bigintANumero(fila.IDIntentoPago, 'IDIntentoPago'),
      estado: fila.Estado,
      llave: fila.LlaveIdempotencia,
      idTransaccion: fila.IDTransaccion,
      idPedido: fila.IDPedido,
      token: fila.TokenArrendamiento,
    },
  };
}

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

  async registrarIntento(datos: {
    llave: string;
    marca: string;
    ultimosDigitos: string;
    segundosArrendamiento: number;
  }): Promise<RegistroIntento> {
    const [fila] = await ejecutarSP<FilaRegistro>('SP_Checkout_RegistrarIntentoPago', {
      LlaveIdempotencia: { tipo: sql.UniqueIdentifier, valor: datos.llave },
      MarcaTarjeta: { tipo: sql.VarChar(20), valor: datos.marca },
      UltimosDigitos: { tipo: sql.Char(4), valor: datos.ultimosDigitos },
      SegundosArrendamiento: { tipo: sql.Int, valor: datos.segundosArrendamiento },
    });
    if (fila === undefined)
      throw new Error('SP_Checkout_RegistrarIntentoPago no devolvió la acción');
    return aRegistro(fila);
  },

  async actualizarIntento(
    { idIntento, token }: Arrendamiento,
    cambio: CambioIntento,
  ): Promise<{ intentosRestantes: number; sesionCancelada: boolean }> {
    const [fila] = await ejecutarSP<{ IntentosRestantes: number; SesionCancelada: boolean }>(
      'SP_Checkout_ActualizarIntentoPago',
      {
        IDIntentoPago: { tipo: sql.BigInt, valor: idIntento },
        Estado: { tipo: sql.VarChar(12), valor: cambio.estado },
        IDTransaccion: {
          tipo: sql.VarChar(64),
          valor: cambio.estado === 'Autorizado' ? cambio.idTransaccion : null,
        },
        CodigoRespuesta: {
          tipo: sql.VarChar(30),
          valor:
            cambio.estado === 'Rechazado' ||
            cambio.estado === 'Anulado' ||
            cambio.estado === 'Fallido'
              ? cambio.codigo
              : null,
        },
        MensajeRespuesta: {
          tipo: sql.NVarChar(200),
          valor:
            cambio.estado === 'Rechazado' || cambio.estado === 'Anulado' ? cambio.mensaje : null,
        },
        TokenArrendamiento: { tipo: sql.UniqueIdentifier, valor: token },
      },
    );
    if (fila === undefined)
      throw new Error('SP_Checkout_ActualizarIntentoPago no devolvió el resultado');
    return { intentosRestantes: fila.IntentosRestantes, sesionCancelada: fila.SesionCancelada };
  },

  async liberarArrendamiento({ idIntento, token }: Arrendamiento): Promise<void> {
    await ejecutarSP('SP_Checkout_LiberarArrendamiento', {
      IDIntentoPago: { tipo: sql.BigInt, valor: idIntento },
      TokenArrendamiento: { tipo: sql.UniqueIdentifier, valor: token },
    });
  },

  // Jobs (A-04): corren con RolActor = 'Sistema'. null si la otra réplica tenía el sp_getapplock.
  async expirarSesiones(): Promise<number | null> {
    const [fila] = await ejecutarSP<{ Ejecutada: boolean; SesionesExpiradas: number }>(
      'SP_Checkout_ExpirarSesiones',
    );
    if (fila === undefined) throw new Error('SP_Checkout_ExpirarSesiones no devolvió el resultado');
    return fila.Ejecutada ? fila.SesionesExpiradas : null;
  },

  async tomarIntentoPorConciliar(
    segundosGracia: number,
    segundosArrendamiento: number,
  ): Promise<TomaConciliacion> {
    const [fila] = await ejecutarSP<FilaPorConciliar>('SP_Checkout_TomarIntentosPorConciliar', {
      SegundosGracia: { tipo: sql.Int, valor: segundosGracia },
      SegundosArrendamiento: { tipo: sql.Int, valor: segundosArrendamiento },
    });
    if (fila === undefined)
      throw new Error('SP_Checkout_TomarIntentosPorConciliar no devolvió el resultado');
    return aToma(fila);
  },

  /** false si el intento ya no estaba como lo tomó la conciliación (otra petición lo resolvió). */
  async resolverIntentoConciliado(
    intento: IntentoPorConciliar,
    resolucion: ResolucionConciliada,
  ): Promise<boolean> {
    const [fila] = await ejecutarSP<{ Resuelto: boolean }>(
      'SP_Checkout_ResolverIntentoConciliado',
      {
        IDIntentoPago: { tipo: sql.BigInt, valor: intento.idIntento },
        EstadoEsperado: { tipo: sql.VarChar(12), valor: intento.estado },
        Estado: { tipo: sql.VarChar(12), valor: resolucion.estado },
        IDTransaccion: {
          tipo: sql.VarChar(64),
          valor:
            resolucion.estado === 'Anulado' || resolucion.estado === 'Capturado'
              ? resolucion.idTransaccion
              : null,
        },
        CodigoRespuesta: {
          tipo: sql.VarChar(30),
          valor: resolucion.estado === 'Rechazado' ? resolucion.codigo : null,
        },
        MensajeRespuesta: {
          tipo: sql.NVarChar(200),
          valor: resolucion.estado === 'Rechazado' ? resolucion.mensaje : null,
        },
        TokenArrendamiento: { tipo: sql.UniqueIdentifier, valor: intento.token },
      },
    );
    if (fila === undefined)
      throw new Error('SP_Checkout_ResolverIntentoConciliado no devolvió el resultado');
    return fila.Resuelto;
  },
};

export type CheckoutRepository = typeof checkoutRepository;
