import { actualizarDireccionSchema, crearDireccionSchema } from '@shopcart/shared';
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
  let envios = 0;
  servidor.use(
    http.post(
      RUTA,
      () =>
        new Promise<Response>((resolver) => {
          envios += 1;
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
    envios: () => envios,
  };
}

type DireccionGuardada = RespuestaCrearDireccion['datos'];

const DEPARTAMENTOS = [
  { idDepartamento: 1, nombre: 'Guatemala' },
  { idDepartamento: 2, nombre: 'Sacatepéquez' },
];
const MUNICIPIOS: Record<number, { idMunicipio: number; nombre: string }[]> = {
  1: [
    { idMunicipio: 101, nombre: 'Guatemala' },
    { idMunicipio: 102, nombre: 'Mixco' },
  ],
  2: [{ idMunicipio: 201, nombre: 'Antigua Guatemala' }],
};
const departamentoDe = (idMunicipio: number) =>
  DEPARTAMENTOS.find((d) =>
    MUNICIPIOS[d.idDepartamento]?.some((m) => m.idMunicipio === idMunicipio),
  ) ?? { idDepartamento: 0, nombre: '' };
const municipioCompleto = (idMunicipio: number) => {
  const departamento = departamentoDe(idMunicipio);
  const municipio = MUNICIPIOS[departamento.idDepartamento]?.find(
    (m) => m.idMunicipio === idMunicipio,
  );
  return { idMunicipio, nombre: municipio?.nombre ?? '', departamento };
};

export const direccionDePrueba = (cambios: Partial<DireccionGuardada> = {}): DireccionGuardada => ({
  ...DIRECCION_CREADA.datos,
  ...cambios,
});

/**
 * La libreta de direcciones del Cliente, como la haría el backend: la lista, crear, editar (la predeterminada es
 * una sola, N-17) y eliminar, más los departamentos y municipios. Guarda cada cuerpo recibido.
 */
export function simularLibretaDeDirecciones(iniciales: DireccionGuardada[] = []) {
  let lista = [...iniciales];
  let siguiente = 100;
  const recibidos: { metodo: string; cuerpo: unknown }[] = [];
  const conUnaPredeterminada = (elegida: number) =>
    lista.map((d) => ({ ...d, esPredeterminada: d.idDireccion === elegida }));
  servidor.use(
    http.get(RUTA, () => HttpResponse.json({ datos: lista })),
    http.post(RUTA, async ({ request }) => {
      const cuerpo = crearDireccionSchema.parse(await request.json());
      recibidos.push({ metodo: 'POST', cuerpo });
      siguiente += 1;
      const nueva: DireccionGuardada = {
        idDireccion: siguiente,
        alias: cuerpo.alias ?? null,
        nombreRecibe: cuerpo.nombreRecibe,
        telefonoRecibe: cuerpo.telefonoRecibe,
        municipio: municipioCompleto(cuerpo.idMunicipio),
        direccionLinea: cuerpo.direccionLinea,
        referencia: cuerpo.referencia ?? null,
        esPredeterminada: cuerpo.esPredeterminada || lista.length === 0,
      };
      lista = [...(nueva.esPredeterminada ? conUnaPredeterminada(-1) : lista), nueva];
      return HttpResponse.json({ datos: nueva }, { status: 201 });
    }),
    http.patch(`${RUTA}/:id`, async ({ params, request }) => {
      const cuerpo = actualizarDireccionSchema.parse(await request.json());
      recibidos.push({ metodo: 'PATCH', cuerpo });
      const id = Number(params.id);
      if (cuerpo.esPredeterminada === true) lista = conUnaPredeterminada(id);
      lista = lista.map((d) =>
        d.idDireccion === id
          ? {
              ...d,
              ...(cuerpo.nombreRecibe === undefined ? {} : { nombreRecibe: cuerpo.nombreRecibe }),
            }
          : d,
      );
      return HttpResponse.json({ datos: lista.find((d) => d.idDireccion === id) });
    }),
    http.delete(`${RUTA}/:id`, ({ params }) => {
      recibidos.push({ metodo: 'DELETE', cuerpo: Number(params.id) });
      lista = lista.filter((d) => d.idDireccion !== Number(params.id));
      return new HttpResponse(null, { status: 204 });
    }),
    http.get('/api/v1/departamentos', () => HttpResponse.json({ datos: DEPARTAMENTOS })),
    http.get('/api/v1/departamentos/:id/municipios', ({ params }) =>
      HttpResponse.json({ datos: MUNICIPIOS[Number(params.id)] ?? [] }),
    ),
  );
  return recibidos;
}
