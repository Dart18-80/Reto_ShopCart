import type { PasarelaPago } from '../pasarela/index.js';
import { ATRIBUTOS, enSpan } from './trazas.js';

const OK = 'Ok';

/**
 * E9-H01: cada operación de la pasarela es un span propio, hijo del pago o de la tarea que la llama. Solo
 * lleva la operación y su resultado: nunca la tarjeta, que no sale del puerto (N-03).
 */
export function conTrazas(pasarela: PasarelaPago): PasarelaPago {
  return {
    autorizar: (solicitud) =>
      enSpan('pasarela.autorizar', {}, async (span) => {
        const resultado = await pasarela.autorizar(solicitud);
        span.setAttribute(ATRIBUTOS.resultadoPasarela, resultado.tipo);
        return resultado;
      }),
    capturar: (idTransaccion) =>
      enSpan('pasarela.capturar', {}, async (span) => {
        await pasarela.capturar(idTransaccion);
        span.setAttribute(ATRIBUTOS.resultadoPasarela, OK);
      }),
    anular: (idTransaccion) =>
      enSpan('pasarela.anular', {}, async (span) => {
        await pasarela.anular(idTransaccion);
        span.setAttribute(ATRIBUTOS.resultadoPasarela, OK);
      }),
    reembolsar: (solicitud) =>
      enSpan('pasarela.reembolsar', {}, async (span) => {
        const resultado = await pasarela.reembolsar(solicitud);
        span.setAttribute(ATRIBUTOS.resultadoPasarela, OK);
        return resultado;
      }),
    consultar: (llave) =>
      enSpan('pasarela.consultar', {}, async (span) => {
        const estado = await pasarela.consultar(llave);
        span.setAttribute(ATRIBUTOS.resultadoPasarela, estado.estado);
        return estado;
      }),
    consultarReembolso: (llave) =>
      enSpan('pasarela.consultarReembolso', {}, async (span) => {
        const reembolso = await pasarela.consultarReembolso(llave);
        span.setAttribute(ATRIBUTOS.resultadoPasarela, reembolso.estado);
        return reembolso;
      }),
  };
}
