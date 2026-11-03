import { http, HttpResponse } from 'msw';
import { api, type Cuerpo, type Respuesta } from '../../shared/api';
import { servidor } from '../servidor';

const RUTA = '/api/v1/direcciones';
export type CuerpoCrearDireccion = Cuerpo<'/api/v1/direcciones', 'post'>;
type RespuestaCrearDireccion = Respuesta<'/api/v1/direcciones', 'post'>;

/** La llamada que haría `direcciones.api.ts` (llega con el módulo Checkout); un componente no importa `api`. */
export async function crearDireccionDePrueba(cuerpo: CuerpoCrearDireccion) {
  const { data } = await api.POST(RUTA, { body: cuerpo });
  if (!data)
    throw new Error('El middleware de errores convierte toda respuesta de error en ErrorApi.');
  return data;
}

/** `POST /api/v1/direcciones` que responde un error con el formato de A-06; guarda los cuerpos recibidos. */
export function simularErrorAlCrearDireccion(
  status: number,
  error: { codigo: string; mensaje: string; detalles?: unknown },
) {
  const cuerpos: unknown[] = [];
  servidor.use(
    http.post(RUTA, async ({ request }) => {
      cuerpos.push(await request.json());
      return HttpResponse.json({ error: { ...error, requestId: 'req-form-1' } }, { status });
    }),
  );
  return cuerpos;
}

const DIRECCION_CREADA: RespuestaCrearDireccion = {
  datos: {
    idDireccion: 7,
    alias: null,
    nombreRecibe: 'Ana Pérez',
    telefonoRecibe: '55551234',
    municipio: {
      idMunicipio: 101,
      nombre: 'Guatemala',
      departamento: { idDepartamento: 1, nombre: 'Guatemala' },
    },
    direccionLinea: '5a avenida 10-20, zona 1',
    referencia: null,
    esPredeterminada: false,
  },
};

/** `POST /api/v1/direcciones` que no responde hasta que la prueba llama a `responder()`. */
export function simularCreacionPendiente() {
  let responder: () => void = () => undefined;
  servidor.use(
    http.post(
      RUTA,
      () =>
        new Promise<Response>((resolver) => {
          responder = () => {
            resolver(HttpResponse.json(DIRECCION_CREADA, { status: 201 }));
          };
        }),
    ),
  );
  return {
    responder: () => {
      responder();
    },
  };
}
