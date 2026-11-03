import { z } from 'zod';

const ENCABEZADO_REQUEST_ID = 'X-Request-Id';

/** Formato de error de la API (A-06): `{ error: { codigo, mensaje, detalles?, requestId } }`. */
const cuerpoDeErrorSchema = z.object({
  error: z.object({
    codigo: z.string(),
    mensaje: z.string(),
    detalles: z.unknown().optional(),
    requestId: z.string(),
  }),
});

export const CODIGO_RED = 'RED';
export const CODIGO_RESPUESTA_INESPERADA = 'RESPUESTA_INESPERADA';
const STATUS_SIN_RESPUESTA = 0;

const MENSAJE_RED = 'No pudimos conectar con la tienda. Revisa tu conexión e intenta de nuevo.';
const MENSAJE_INESPERADO = 'Algo salió mal de nuestro lado. Intenta de nuevo en un momento.';

interface DatosErrorApi {
  status: number;
  codigo: string;
  mensaje: string;
  detalles: unknown;
  requestId: string | null;
}

/** FE-13: la única forma en que un error del backend o de la red llega a los hooks y a la vista. */
export class ErrorApi extends Error {
  readonly status: number;
  readonly codigo: string;
  readonly mensaje: string;
  readonly detalles: unknown;
  readonly requestId: string | null;

  constructor({ status, codigo, mensaje, detalles, requestId }: DatosErrorApi) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.status = status;
    this.codigo = codigo;
    this.mensaje = mensaje;
    this.detalles = detalles;
    this.requestId = requestId;
  }

  get esDeRed(): boolean {
    return this.status === STATUS_SIN_RESPUESTA;
  }

  static deRed(): ErrorApi {
    return new ErrorApi({
      status: STATUS_SIN_RESPUESTA,
      codigo: CODIGO_RED,
      mensaje: MENSAJE_RED,
      detalles: undefined,
      requestId: null,
    });
  }

  /** Una respuesta sin el formato de A-06 (un 502 de nginx, un cuerpo vacío) conserva su status y su requestId. */
  static async desdeRespuesta(respuesta: Response): Promise<ErrorApi> {
    const cuerpo = cuerpoDeErrorSchema.safeParse(await leerJson(respuesta));
    if (cuerpo.success) {
      const { codigo, mensaje, detalles, requestId } = cuerpo.data.error;
      return new ErrorApi({ status: respuesta.status, codigo, mensaje, detalles, requestId });
    }
    return new ErrorApi({
      status: respuesta.status,
      codigo: CODIGO_RESPUESTA_INESPERADA,
      mensaje: MENSAJE_INESPERADO,
      detalles: undefined,
      requestId: respuesta.headers.get(ENCABEZADO_REQUEST_ID),
    });
  }
}

async function leerJson(respuesta: Response): Promise<unknown> {
  try {
    return await respuesta.clone().json();
  } catch {
    // Un cuerpo vacío o que no es JSON no tiene el formato de A-06: se trata como respuesta inesperada.
    return undefined;
  }
}
