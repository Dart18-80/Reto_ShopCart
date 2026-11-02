import sql from 'mssql';
import { ejecutarSP } from '../db/index.js';
import {
  PasarelaSinRespuesta,
  type EstadoEnPasarela,
  type PasarelaPago,
  type ResultadoAutorizacion,
  type TarjetaPago,
} from '../pasarela/index.js';

// N-03: tarjetas de prueba de la pasarela simulada.
const APROBADA = '4242424242424242';
const FONDOS_INSUFICIENTES = '4000000000000002';
// Autoriza, pero la respuesta "se pierde": el reintento con la misma llave recibe esa misma autorización.
const TIEMPO_AGOTADO = '4000000000000119';
const DIGITOS_VISIBLES = 4;

const MARCAS: Readonly<Record<string, string>> = { '3': 'Amex', '4': 'Visa', '5': 'Mastercard' };

interface Decision {
  aprobada: boolean;
  codigo: string | null;
  mensaje: string | null;
}

// El "banco" de la simulación: decide con el número, que nunca sale de este archivo.
function decidir(tarjeta: TarjetaPago): Decision {
  if (tarjeta.numero === APROBADA || tarjeta.numero === TIEMPO_AGOTADO) {
    return { aprobada: true, codigo: null, mensaje: null };
  }
  if (tarjeta.numero === FONDOS_INSUFICIENTES) {
    return { aprobada: false, codigo: 'FONDOS_INSUFICIENTES', mensaje: 'Fondos insuficientes.' };
  }
  return { aprobada: false, codigo: 'TARJETA_NO_SOPORTADA', mensaje: 'La tarjeta no es válida.' };
}

interface FilaAutorizacion {
  IDTransaccion: string;
  Estado: 'Autorizada' | 'Rechazada' | 'Capturada' | 'Anulada';
  Marca: string;
  UltimosDigitos: string;
  CodigoRespuesta: string | null;
  MensajeRespuesta: string | null;
}

function aEstado(fila: FilaAutorizacion): EstadoEnPasarela {
  const tarjeta = { marca: fila.Marca, ultimosDigitos: fila.UltimosDigitos };
  return fila.Estado === 'Rechazada'
    ? {
        estado: 'Rechazada',
        codigo: fila.CodigoRespuesta ?? 'RECHAZADA',
        mensaje: fila.MensajeRespuesta ?? 'El pago fue rechazado.',
        ...tarjeta,
      }
    : { estado: fila.Estado, idTransaccion: fila.IDTransaccion, ...tarjeta };
}

/**
 * N-03 (E5-H02): pasarela simulada con estado propio en SQL Server (SP_Pasarela_*), como la base de un
 * sistema externo: idempotente por llave aunque el reintento caiga en la otra réplica (sin Redis, RNF-2).
 * Nunca participa en una transacción del checkout: cada SP es su propia transacción.
 */
export function crearPasarelaSimulada(): PasarelaPago {
  async function cambiarEstado(idTransaccion: string, estado: 'Capturada' | 'Anulada') {
    await ejecutarSP('SP_Pasarela_CambiarEstado', {
      IDTransaccion: { tipo: sql.VarChar(64), valor: idTransaccion },
      Estado: { tipo: sql.VarChar(12), valor: estado },
    });
  }

  return {
    async autorizar({ llave, monto, tarjeta }): Promise<ResultadoAutorizacion> {
      const decision = decidir(tarjeta);
      const [fila] = await ejecutarSP<FilaAutorizacion & { Nueva: boolean }>(
        'SP_Pasarela_Autorizar',
        {
          LlaveIdempotencia: { tipo: sql.UniqueIdentifier, valor: llave },
          Monto: { tipo: sql.Decimal(12, 2), valor: monto },
          Marca: { tipo: sql.VarChar(20), valor: MARCAS[tarjeta.numero.charAt(0)] ?? 'Otra' },
          UltimosDigitos: { tipo: sql.Char(4), valor: tarjeta.numero.slice(-DIGITOS_VISIBLES) },
          Aprobada: { tipo: sql.Bit, valor: decision.aprobada },
          CodigoRechazo: { tipo: sql.VarChar(30), valor: decision.codigo },
          MensajeRechazo: { tipo: sql.NVarChar(200), valor: decision.mensaje },
        },
      );
      if (fila === undefined) throw new Error('SP_Pasarela_Autorizar no devolvió la autorización');
      if (fila.Nueva && tarjeta.numero === TIEMPO_AGOTADO)
        throw new PasarelaSinRespuesta('autorizar');

      const estado = aEstado(fila);
      if (estado.estado === 'Rechazada') return { ...estado, tipo: 'Rechazada' };
      if (estado.estado === 'NoExiste')
        throw new Error('La autorización recién guardada no existe');
      return {
        tipo: 'Autorizada',
        idTransaccion: estado.idTransaccion,
        marca: estado.marca,
        ultimosDigitos: estado.ultimosDigitos,
      };
    },

    capturar: (idTransaccion) => cambiarEstado(idTransaccion, 'Capturada'),

    anular: (idTransaccion) => cambiarEstado(idTransaccion, 'Anulada'),

    async reembolsar({ llave, idTransaccion, monto }) {
      const [fila] = await ejecutarSP<{ IDReembolso: string }>('SP_Pasarela_Reembolsar', {
        LlaveIdempotencia: { tipo: sql.UniqueIdentifier, valor: llave },
        IDTransaccion: { tipo: sql.VarChar(64), valor: idTransaccion },
        Monto: { tipo: sql.Decimal(12, 2), valor: monto },
      });
      if (fila === undefined) throw new Error('SP_Pasarela_Reembolsar no devolvió el reembolso');
      return { idReembolso: fila.IDReembolso };
    },

    async consultar(llave) {
      const [fila] = await ejecutarSP<FilaAutorizacion>('SP_Pasarela_Consultar', {
        LlaveIdempotencia: { tipo: sql.UniqueIdentifier, valor: llave },
      });
      return fila === undefined ? { estado: 'NoExiste' } : aEstado(fila);
    },
  };
}
