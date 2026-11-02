import { Router, type Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { leerDatos, leerError } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import {
  agregar,
  clienteNuevo,
  comoCliente,
  leerCarrito,
  primeraLinea,
  varianteVendible,
  verCarrito,
} from '../carrito/apoyo-carrito.js';
import {
  clienteConDireccion,
  metodoEnvio,
  type ClienteDePrueba,
} from '../checkout/apoyo-checkout.js';
import { pedidoPagado } from '../pedidos/apoyo-pedidos.js';

// Verificación de entrega (RF-01): recorre las rutas registradas en el router real. Para saber quién protege cada
// ruta y con qué esquemas valida, autorizar y manejar se envuelven y dejan anotados sus argumentos en el handler.
vi.mock(import('../../../src/shared/http/autenticar.js'), async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    autorizar: (...roles: Parameters<typeof original.autorizar>) =>
      Object.assign(original.autorizar(...roles), { roles }),
    autorizarSiHaySesion: (...roles: Parameters<typeof original.autorizarSiHaySesion>) =>
      Object.assign(original.autorizarSiHaySesion(...roles), { roles }),
  };
});
vi.mock(import('../../../src/shared/http/manejar.js'), async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    manejar: ((esquemas, handler) =>
      Object.assign(original.manejar(esquemas, handler), { esquemas })) as typeof original.manejar,
  };
});

usarBaseDePruebas();

const PREFIJO = '/api/v1';
const ID_INEXISTENTE = 2_147_483_647;

// Rutas sin rol: no tienen datos de un usuario. Agregar una aquí es una decisión explícita.
const RUTAS_PUBLICAS = new Set([
  'GET /api/docs/openapi.json',
  'GET /api/v1/health',
  'POST /api/v1/auth/registro',
  'POST /api/v1/auth/login',
  'POST /api/v1/auth/refresh',
  'POST /api/v1/auth/logout',
  'GET /api/v1/categorias',
  'GET /api/v1/productos',
  'GET /api/v1/productos/:id',
  'GET /api/v1/departamentos',
  'GET /api/v1/departamentos/:id/municipios',
  'GET /api/v1/envios/metodos',
]);

// --- Recorrido del router -------------------------------------------------------------------------------------

interface ConUse {
  use: (...argumentos: unknown[]) => unknown;
}
const tieneUse = (valor: unknown): valor is ConUse =>
  (typeof valor === 'function' || (typeof valor === 'object' && valor !== null)) &&
  typeof Reflect.get(valor, 'use') === 'function';

// Los tipos de Express declaran Router.prototype como any: se verifica su forma antes de espiarlo.
const prototipoRouter: unknown = Router.prototype;
if (!tieneUse(prototipoRouter)) throw new Error('Router.prototype.use no existe');
const montajes = new Map<object, { padre: object; ruta: string }>();
const usarOriginal = prototipoRouter.use;
vi.spyOn(prototipoRouter, 'use').mockImplementation(function (this: object, ...argumentos) {
  const [primero] = argumentos;
  const ruta = typeof primero === 'string' ? primero : '';
  for (const manejador of argumentos.flat(Infinity)) {
    if (typeof manejador === 'function' && 'stack' in manejador) {
      montajes.set(manejador, { padre: this, ruta });
    }
  }
  return usarOriginal.apply(this, argumentos);
});

const capasSchema = z.array(
  z.object({
    handle: z.unknown(),
    route: z
      .object({
        path: z.string(),
        methods: z.record(z.string(), z.boolean()),
        stack: z.array(z.object({ handle: z.unknown() })),
      })
      .optional(),
  }),
);

const rolesDe = (manejador: unknown): string[] => {
  const roles = z.array(z.string()).safeParse(Reflect.get(Object(manejador), 'roles'));
  return roles.success ? roles.data : [];
};

const esquemasDe = (manejador: unknown): Record<string, z.ZodType> | undefined => {
  const esquemas: unknown = Reflect.get(Object(manejador), 'esquemas');
  return z.record(z.string(), z.instanceof(z.ZodType)).optional().parse(esquemas);
};

function prefijoDe(router: object): string {
  const montaje = montajes.get(router);
  return montaje === undefined ? '' : `${prefijoDe(montaje.padre)}${montaje.ruta}`;
}

interface RutaRegistrada {
  clave: string;
  ruta: string;
  metodo: string;
  roles: string[];
  manejadores: unknown[];
}

function rutasDe(router: object): RutaRegistrada[] {
  const rutas: RutaRegistrada[] = [];
  // Un router.use(autorizar(...)) sin ruta protege todas las rutas que el router registra después.
  const rolesDelRouter: string[] = [];
  for (const capa of capasSchema.parse(Reflect.get(router, 'stack'))) {
    if (capa.route === undefined) {
      rolesDelRouter.push(...rolesDe(capa.handle));
      continue;
    }
    const manejadores = capa.route.stack.map((c) => c.handle);
    const roles = [...rolesDelRouter, ...manejadores.flatMap(rolesDe)];
    const ruta = `${prefijoDe(router)}${capa.route.path}`;
    for (const metodo of Object.keys(capa.route.methods)) {
      const verbo = metodo.toUpperCase();
      rutas.push({ clave: `${verbo} ${ruta}`, ruta, metodo: verbo, roles, manejadores });
    }
  }
  return rutas;
}

/** Todos los objetos de un esquema (desenvuelve pipe, optional, default, union…), con su forma y si es estricto. */
function objetosDe(esquema: z.core.$ZodType): { claves: string[]; estricto: boolean }[] {
  if (esquema instanceof z.ZodObject) {
    const estricto = esquema.def.catchall instanceof z.ZodNever;
    const anidados = Object.values(esquema.shape).flatMap((campo) =>
      campo instanceof z.ZodType ? objetosDe(campo) : [],
    );
    return [{ claves: Object.keys(esquema.shape), estricto }, ...anidados];
  }
  if (esquema instanceof z.ZodPipe) return [...objetosDe(esquema.in), ...objetosDe(esquema.out)];
  if (esquema instanceof z.ZodUnion) return esquema.options.flatMap(objetosDe);
  if (esquema instanceof z.ZodArray) return objetosDe(esquema.element);
  const interno: unknown = Reflect.get(esquema._zod.def, 'innerType');
  return interno instanceof z.ZodType ? objetosDe(interno) : [];
}

// --- Datos: el cliente A es dueño de cada recurso; el cliente B intenta usarlo ---------------------------------

const app: Express = crearApp(dependenciasDePrueba());
const routers = new Set([...montajes.keys(), ...[...montajes.values()].map((m) => m.padre)]);
const rutas = [...routers].flatMap(rutasDe);
const rutasDeCliente = rutas.filter((r) => r.roles.includes('Cliente'));

interface Recursos {
  idPedido: number;
  idDireccion: number;
  idLinea: number;
}

interface CasoAislamiento {
  recurso: keyof Recursos;
  cuerpo?: object;
}

// Cada ruta de cliente que recibe un ID tiene aquí su caso. Una ruta nueva sin caso hace fallar la prueba.
const CASOS: Record<string, CasoAislamiento> = {
  'GET /api/v1/pedidos/:id': { recurso: 'idPedido' },
  'POST /api/v1/pedidos/:id/cancelar': { recurso: 'idPedido', cuerpo: { motivo: 'Intento ajeno' } },
  'GET /api/v1/direcciones/:id': { recurso: 'idDireccion' },
  'PATCH /api/v1/direcciones/:id': { recurso: 'idDireccion', cuerpo: { nombreRecibe: 'Intruso' } },
  'DELETE /api/v1/direcciones/:id': { recurso: 'idDireccion' },
  'PATCH /api/v1/carrito/lineas/:idLinea': { recurso: 'idLinea', cuerpo: { cantidad: 2 } },
  'DELETE /api/v1/carrito/lineas/:idLinea': { recurso: 'idLinea' },
};

let duenio: ClienteDePrueba;
let intruso: string;
let recursos: Recursos;

beforeAll(async () => {
  duenio = await clienteConDireccion(app);
  const { pedido } = await pedidoPagado(app, await metodoEnvio(app), { cliente: duenio });
  await agregar(app, comoCliente(duenio.token), (await varianteVendible()).IDVariante);
  const linea = primeraLinea(leerCarrito(await verCarrito(app, comoCliente(duenio.token))));
  recursos = { idPedido: pedido.idPedido, idDireccion: duenio.idDireccion, idLinea: linea.idLinea };
  intruso = (await clienteNuevo(app)).token;
});

function pedir(metodo: string, ruta: string, id: number, cuerpo?: object) {
  const url = ruta.replace(/:\w+/, String(id));
  const peticion = request(app)
    [z.enum(['get', 'post', 'patch', 'put', 'delete']).parse(metodo.toLowerCase())](url)
    .set(comoCliente(intruso));
  return cuerpo === undefined ? peticion : peticion.send(cuerpo);
}

describe('barrido de aislamiento entre clientes (verificación de entrega, RF-01)', () => {
  it('el recorrido encuentra las rutas del router real', () => {
    expect(rutas.map((r) => r.clave)).toContain(`GET ${PREFIJO}/pedidos/:id`);
    expect(rutasDeCliente.length).toBeGreaterThan(Object.keys(CASOS).length);
  });

  it('toda ruta declara sus roles o es una de las públicas conocidas', () => {
    const sinRoles = rutas.filter((r) => r.roles.length === 0).map((r) => r.clave);

    expect(sinRoles.toSorted()).toEqual([...RUTAS_PUBLICAS].toSorted());
  });

  it('cada ruta de cliente que recibe un ID tiene su caso de aislamiento, y ningún caso sobra', () => {
    const conId = rutasDeCliente.filter((r) => r.ruta.includes(':')).map((r) => r.clave);

    expect(conId.toSorted()).toEqual(Object.keys(CASOS).toSorted());
  });

  it.each(Object.entries(CASOS))(
    '%s: el recurso de otro cliente responde 404, igual que uno inexistente',
    async (clave, { recurso, cuerpo }) => {
      const [metodo = '', ruta = ''] = clave.split(' ');

      const ajeno = await pedir(metodo, ruta, recursos[recurso], cuerpo);
      const inexistente = await pedir(metodo, ruta, ID_INEXISTENTE, cuerpo);

      expect([ajeno.status, inexistente.status]).toEqual([404, 404]);
      expect(leerError(ajeno).codigo).toBe(leerError(inexistente).codigo);
    },
  );

  it('los intentos del otro cliente no cambiaron nada del dueño', async () => {
    const comoDuenio = comoCliente(duenio.token);
    const pedido = await request(app)
      .get(`${PREFIJO}/pedidos/${String(recursos.idPedido)}`)
      .set(comoDuenio);
    const direccion = await request(app)
      .get(`${PREFIJO}/direcciones/${String(recursos.idDireccion)}`)
      .set(comoDuenio);
    const carrito = leerCarrito(await verCarrito(app, comoDuenio));

    expect(leerDatos(pedido, z.object({ estado: z.string() })).estado).toBe('Pagado');
    expect(leerDatos(direccion, z.object({ nombreRecibe: z.string() })).nombreRecibe).not.toBe(
      'Intruso',
    );
    expect(carrito.lineas.map((l) => [l.idLinea, l.cantidad])).toEqual([[recursos.idLinea, 1]]);
  });

  it('ninguna ruta de cliente acepta idUsuario en su entrada y todos sus cuerpos son estrictos', () => {
    const hallazgos = rutasDeCliente.flatMap(({ clave, manejadores }) => {
      const esquemas = manejadores.map(esquemasDe).find((e) => e !== undefined);
      if (esquemas === undefined) return [`${clave}: sin validación de entrada (A-20)`];
      return Object.entries(esquemas).flatMap(([parte, esquema]) =>
        objetosDe(esquema).flatMap(({ claves, estricto }) => [
          ...claves
            .filter((c) => c.toLowerCase() === 'idusuario')
            .map(() => `${clave}: ${parte}.idUsuario`),
          ...(parte === 'body' && !estricto ? [`${clave}: body sin .strict()`] : []),
        ]),
      );
    });

    expect(hallazgos).toEqual([]);
  });
});
