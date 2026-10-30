---
name: modulo-express
description: Cómo construir y probar un módulo del backend de ShopCart (Express 5 + TypeScript strict) de punta a punta — estructura de archivos, ejecutarSP, repositorio, servicio con puertos, controlador, rutas, esquemas Zod con OpenAPI, errores, dinero, aislamiento entre clientes y pruebas unitarias, de integración y de concurrencia. Úsala siempre que crees o modifiques código en apps/api/.
---

# Módulos del backend de ShopCart

Esta skill concreta `docs/01-arquitectura.md` §4–5. Si algo aquí contradice los documentos, **mandan los documentos** y debes avisar a Diego. Para los scripts de base de datos usa la skill `sqlserver-sp`.

## 1. Estructura de un módulo

```
apps/api/src/modules/direcciones/
  direcciones.routes.ts       # rutas: método, path, middlewares; registra OpenAPI
  direcciones.controller.ts   # HTTP ↔ caso de uso. Sin lógica de negocio
  direcciones.service.ts      # casos de uso: reglas, orquestación, puertos
  direcciones.repository.ts   # SOLO ejecutarSP; mapea filas a tipos del dominio
  direcciones.schemas.ts      # esquemas Zod de entrada y salida
  direcciones.types.ts        # tipos del dominio del módulo
  direcciones.errors.ts       # errores de negocio del módulo
  index.ts                    # API pública del módulo: lo único que otros importan
```

**Reglas de dependencia:** `routes → controller → service → repository`. Otro módulo solo importa desde `index.ts`. El lint lo verifica (regla de fronteras A-01).

## 2. Recorrido de una petición

```
requestId → (autenticar → autorizar) → controller: manejar(Zod) → service → repository → ejecutarSP → SP
                                                                                   ↓
                         middleware de errores ← AppError ← THROW 5xxxx del SP
```

- **Express 5 propaga solo los errores de los handlers `async`** al middleware de errores. No escribas `try/catch` en los controladores para responder errores.
- **Contexto de la petición** (`shared/http/contexto.ts`): un `AsyncLocalStorage` con `{ requestId, idUsuario, rol }`. Lo abre el middleware `requestId` y lo completa `autenticar`. `ejecutarSP` y el logger lo leen solos, así que **no se pasa a mano** por las capas.

## 3. `ejecutarSP` (A-18)

```ts
// shared/db/ejecutar-sp.ts (firma de referencia)
type NombreSP = `SP_${string}_${string}`;                 // la nomenclatura se verifica por tipos

interface ParametroSP {
  tipo: sql.ISqlTypeFactory | sql.ISqlType;               // tipo SQL explícito, siempre
  valor: string | number | boolean | Date | Buffer | null;
}

export async function ejecutarSP<T>(nombre: NombreSP, parametros?: Record<string, ParametroSP>): Promise<T[]>;
export async function ejecutarSPMultiple(nombre: NombreSP, parametros?: Record<string, ParametroSP>): Promise<unknown[][]>;
```

Qué hace por dentro:
1. Agrega `@IDUsuarioActor`, `@RolActor` y `@RequestId` desde el contexto de la petición (en los jobs van en `null`).
2. Ejecuta el SP con `request.execute(nombre)`. **Nunca acepta texto SQL.**
3. Si el error está entre 50000 y 59999, lo convierte en `AppError` con el catálogo (`shared/errors/catalogo.ts`). Si el mensaje es un JSON (`{ mensaje, detalles }`), separa los detalles (A-19).
4. Reintenta hasta 3 veces ante un deadlock (error 1205), con espera breve y creciente.
5. Registra en el log la duración y el nombre del SP, nunca los valores de los parámetros.
6. Devuelve las filas como `T[]` **sin validarlas**: es el único cast del backend y vive solo aquí. Cada repositorio declara su interfaz `Fila…` con las columnas del SP y la mapea a los tipos del dominio (§4); los montos se convierten en ese mapeo (§10).

## 4. Repositorio

```ts
// direcciones.repository.ts
import sql from 'mssql';
import { ejecutarSP } from '../../shared/db/index.js';
import type { CrearDireccion } from './direcciones.schemas.js';
import type { Direccion } from './direcciones.types.js';

interface FilaDireccion {
  IDDireccion: number;
  NombreRecibe: string;
  TelefonoRecibe: string;
  IDMunicipio: number;
  Municipio: string;
  Departamento: string;
  DireccionLinea: string;
  Referencia: string | null;
  EsPredeterminada: boolean;
}

const aDireccion = (f: FilaDireccion): Direccion => ({
  idDireccion: f.IDDireccion,
  nombreRecibe: f.NombreRecibe,
  telefonoRecibe: f.TelefonoRecibe,
  municipio: { idMunicipio: f.IDMunicipio, nombre: f.Municipio, departamento: f.Departamento },
  direccionLinea: f.DireccionLinea,
  referencia: f.Referencia,
  esPredeterminada: f.EsPredeterminada,
});

export const direccionesRepository = {
  // El dueño sale de @IDUsuarioActor (contexto): el repositorio no recibe el ID del cliente.
  async listarPropias(): Promise<Direccion[]> {
    const filas = await ejecutarSP<FilaDireccion>('SP_Direcciones_Listar');
    return filas.map(aDireccion);
  },

  async obtenerPropia(idDireccion: number): Promise<Direccion | null> {
    const [fila] = await ejecutarSP<FilaDireccion>('SP_Direcciones_Obtener', {
      IDDireccion: { tipo: sql.Int, valor: idDireccion },
    });
    return fila ? aDireccion(fila) : null;
  },

  async crear(datos: CrearDireccion): Promise<Direccion> {
    const [fila] = await ejecutarSP<FilaDireccion>('SP_Direcciones_Crear', {
      NombreRecibe: { tipo: sql.NVarChar(100), valor: datos.nombreRecibe },
      TelefonoRecibe: { tipo: sql.VarChar(8), valor: datos.telefonoRecibe },
      IDMunicipio: { tipo: sql.Int, valor: datos.idMunicipio },
      DireccionLinea: { tipo: sql.NVarChar(200), valor: datos.direccionLinea },
      Referencia: { tipo: sql.NVarChar(200), valor: datos.referencia ?? null },
      EsPredeterminada: { tipo: sql.Bit, valor: datos.esPredeterminada },
    });
    if (!fila) throw new Error('SP_Direcciones_Crear no devolvió la dirección creada');
    return aDireccion(fila);
  },
};

export type DireccionesRepository = typeof direccionesRepository;
```

- Los tipos SQL coinciden **exactamente** con los del parámetro en el SP (`NVARCHAR(100)` ↔ `sql.NVarChar(100)`).
- El mapeo de columnas `PascalCase` de la base a `camelCase` del dominio vive solo aquí.
- Nada de lógica de negocio en el repositorio.

## 5. Servicio

```ts
// direcciones.service.ts
import type { DireccionesRepository } from './direcciones.repository.js';
import type { CrearDireccion } from './direcciones.schemas.js';
import type { Direccion } from './direcciones.types.js';
import { erroresDirecciones } from './direcciones.errors.js';

interface Dependencias {
  repositorio: DireccionesRepository;
}

export function crearDireccionesService({ repositorio }: Dependencias) {
  return {
    listar: (): Promise<Direccion[]> => repositorio.listarPropias(),

    async obtener(idDireccion: number): Promise<Direccion> {
      const direccion = await repositorio.obtenerPropia(idDireccion);
      // RF-01: una dirección ajena responde igual que una inexistente (404).
      if (!direccion) throw erroresDirecciones.noEncontrada();
      return direccion;
    },

    crear: (datos: CrearDireccion): Promise<Direccion> => repositorio.crear(datos),
  };
}

export type DireccionesService = ReturnType<typeof crearDireccionesService>;
```

- **Las dependencias se inyectan** (repositorio y puertos: `PasarelaPago`, `Cache`, `ListaRevocados`, `Reloj`). Así el servicio se prueba sin base ni Redis.
- **El servicio no conoce Express**: no recibe `req` ni `res`.
- **Prevalidación (A-02):** el servicio puede validar antes para dar un mensaje claro, pero el SP vuelve a validar bajo bloqueo y es la autoridad. Usa los mismos códigos del catálogo.
- **Coordinación con sistemas externos** (pasarela, caché): aquí, en el orden de `01-arquitectura.md` §6. Una llamada externa **nunca** va dentro de una transacción de la base.

## 6. Controlador y manejar

`manejar` (A-20, `shared/http/manejar.ts`) valida la entrada con Zod y llama al handler con los valores ya transformados y **tipados por los propios esquemas**:

```ts
// firma de referencia
function manejar<E extends { params?: ZodType; body?: ZodType; query?: ZodType }>(
  esquemas: E,
  handler: (entrada: { params: z.infer<E['params']>; body: z.infer<E['body']>; query: z.infer<E['query']> },
            res: Response) => void | Promise<void>,
): RequestHandler;   // una parte sin esquema llega como undefined
```

- Si algo no valida, responde `400 VALIDACION_FALLIDA` con `detalles.errores: [{ campo: 'body.nombre', mensaje }]` (todas las partes a la vez) y el handler no se ejecuta.
- **No modifica `req`**: en Express 5 `req.query` es de solo lectura. El handler no recibe `req`; si necesita algo más, se agrega a `manejar` con su propia validación.

```ts
// direcciones.controller.ts
import type { RequestHandler } from 'express';
import { manejar } from '../../shared/http/index.js';
import { crearDireccionSchema, paramsIdSchema } from './direcciones.schemas.js';
import type { DireccionesService } from './direcciones.service.js';

export interface DireccionesController {
  listar: RequestHandler;
  obtener: RequestHandler;
  crear: RequestHandler;
}

export function crearDireccionesController(servicio: DireccionesService): DireccionesController {
  return {
    listar: manejar({}, async (_entrada, res) => {
      res.json({ datos: await servicio.listar() });
    }),

    obtener: manejar({ params: paramsIdSchema }, async ({ params }, res) => {
      res.json({ datos: await servicio.obtener(params.id) });   // params.id ya es number
    }),

    crear: manejar({ body: crearDireccionSchema }, async ({ body }, res) => {
      res.status(201).json({ datos: await servicio.crear(body) });
    }),
  };
}
```

- Los tipos de `params`, `body` y `query` salen de `z.infer` de los esquemas: **sin `as` ni genéricos escritos a mano**, que podrían no coincidir con lo validado.
- El controlador declara su interfaz (`DireccionesController`) con el tipo de retorno explícito.
- Respuesta estándar: `{ datos }` y, en listados, `{ datos, paginacion: { pagina, tamano, total, totalPaginas } }`.

## 7. Rutas y OpenAPI

```ts
// direcciones.routes.ts
import { Router } from 'express';
import { autenticar, autorizar } from '../../shared/http/index.js';
import { registroOpenApi, respuestasError } from '../../shared/openapi/index.js';
import type { DireccionesController } from './direcciones.controller.js';
import { crearDireccionSchema, direccionSchema } from './direcciones.schemas.js';

export function crearDireccionesRouter(controller: DireccionesController): Router {
  const router = Router();
  router.use(autenticar, autorizar('Cliente'));

  router.get('/', controller.listar);
  router.get('/:id', controller.obtener);
  router.post('/', controller.crear);

  registroOpenApi.registerPath({
    method: 'post',
    path: '/api/v1/direcciones',
    tags: ['Direcciones'],
    security: [{ bearer: [] }],
    request: { body: { content: { 'application/json': { schema: crearDireccionSchema } } } },
    responses: {
      201: { description: 'Dirección creada', content: { 'application/json': { schema: direccionSchema } } },
      ...respuestasError(400, 401, 403),
    },
  });

  return router;
}
```

- **Cada ruta declara quién puede usarla** (`autenticar` + `autorizar(...)`). Una ruta pública lo indica con un comentario explícito.
- **La validación no va en las rutas: la hace `manejar` en el controlador** (A-20). Las rutas solo aplican `autenticar`/`autorizar` y registran OpenAPI.
- **Cada endpoint se registra en OpenAPI** en el mismo archivo de rutas, con sus respuestas de error.

## 8. Esquemas Zod

```ts
// direcciones.schemas.ts
import { z } from '../../shared/openapi/zod.js';   // z extendido con .openapi()

export const crearDireccionSchema = z
  .object({
    nombreRecibe: z.string().trim().min(1).max(100),
    telefonoRecibe: z.string().regex(/^\d{8}$/, 'El teléfono debe tener 8 dígitos.'),
    idMunicipio: z.number().int().positive(),
    direccionLinea: z.string().trim().min(1).max(200),
    referencia: z.string().trim().max(200).optional(),
    esPredeterminada: z.boolean().default(false),
  })
  .strict()                                       // rechaza campos no esperados (p. ej. idUsuario)
  .openapi('CrearDireccion');

export const paramsIdSchema = z.object({ id: z.coerce.number().int().positive() });

export type CrearDireccion = z.infer<typeof crearDireccionSchema>;
export type ParamsId = z.infer<typeof paramsIdSchema>;
```

- Los esquemas que también usa el frontend van en `packages/shared`.
- `.strict()` en los cuerpos: un `idUsuario` colado en el body responde `400` en lugar de ignorarse en silencio.
- Los límites de longitud coinciden con los del SP y la tabla.

## 9. Errores del módulo

```ts
// direcciones.errors.ts
import { AppError } from '../../shared/errors/index.js';

export const erroresDirecciones = {
  noEncontrada: () => new AppError('NO_ENCONTRADO', { mensaje: 'La dirección no existe.' }),
  limiteAlcanzado: () => new AppError('LIMITE_DIRECCIONES', { mensaje: 'Solo puedes registrar hasta 10 direcciones.' }),
};
```

- `AppError` recibe un código **que existe en `catalogo.ts`**, y el catálogo define su HTTP. Nunca `throw new Error(...)` para una regla de negocio.
- Un error inesperado sí es `Error`: el middleware lo registra con su `requestId` y responde `500` sin detalles.

## 10. Dinero

```ts
import Decimal from 'decimal.js';

// tedious devuelve DECIMAL como number. Con DECIMAL(12,2) (≤ 12 dígitos) la conversión es exacta,
// pero nunca se opera con ese number: se convierte a Decimal de inmediato.
export const aMonto = (valor: number | string): string => new Decimal(valor).toFixed(2);
```

- **En JSON los montos son texto** (`"149.90"`). El esquema compartido es `montoSchema = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/)`.
- Para enviar un monto a un SP: `{ tipo: sql.Decimal(12, 2), valor: monto.toFixed(2) }`.
- **Al leer un monto de un SP:** la interfaz `Fila…` lo declara como `number` (así lo entrega el driver), y la función de mapeo del repositorio lo convierte de inmediato con `aMonto` (texto para JSON) o `new Decimal(...)` (para operar). Ninguna capa por encima del repositorio ve ese `number`.
- Los cálculos de dinero (descuentos, totales, reembolsos) se hacen en el SP. En TypeScript solo se formatea o se compara, siempre con `Decimal`.

## 11. Aislamiento entre clientes (RF-01)

- El cliente **nunca** envía su ID. Los SPs de recursos propios filtran con `@IDUsuarioActor`, que `ejecutarSP` toma del token.
- Un recurso ajeno o inexistente responde **`404`**, nunca `403`: no se confirma que existe.
- Cualquier ID que llegue en la URL o en el body (`idPedido`, `idDireccion`, `idLinea`) **se verifica contra el dueño dentro del SP**.
- Todo endpoint de cliente nuevo lleva una prueba de integración con dos clientes: el cliente B intenta leer y modificar un recurso del cliente A y recibe `404`.

## 12. Pruebas

Cada criterio de aceptación de la historia se convierte en una prueba **antes** de escribir el código (TDD).

| Tipo | Dónde | Qué prueba | Cómo |
|---|---|---|---|
| Unitaria | `test/unit/<modulo>/*.test.ts` | Reglas y orquestación del servicio | Vitest con repositorio y puertos falsos (objetos que cumplen el tipo) |
| Integración | `test/integracion/<modulo>/*.test.ts` | SPs y reglas críticas en la base real | Contra `shopcart_test`; se recrea desde cero al inicio de cada corrida; cada prueba crea sus propios datos |
| API | `test/integracion/<modulo>/*.api.test.ts` | Contrato HTTP, códigos, aislamiento entre clientes | Supertest sobre la app real con `shopcart_test` |
| Concurrencia | `test/concurrencia/*.test.ts` | RNF-3 | Contra el entorno de Docker, a través de nginx |

- **Las pruebas tampoco escriben SQL.** Preparan los datos con SPs de prueba que solo existen en `shopcart_test` (`database/test/R__SP_Pruebas_*.sql`, que el migrador aplica únicamente a esa base).
- **Nada se borra entre pruebas:** las tablas ledger no admiten `DELETE` ni `TRUNCATE`; por eso `pnpm test:integracion` recrea `shopcart_test` al empezar y cada prueba crea datos únicos.
- **La prueba de concurrencia** corre contra el entorno de Docker con datos propios (por ejemplo, una variante nueva con existencia 1), sin reiniciar nada.
- Una prueba de integración por cada regla que vive en un SP (límites, transiciones, idempotencia, atomicidad).
- **Patrón de concurrencia:**

```ts
const resultados = await Promise.all(
  clientes.map((c) => fetch(`${URL_BASE}/checkout/sesion`, { method: 'POST', headers: c.headers, body })),
);
const exitos = resultados.filter((r) => r.status === 201);
expect(exitos).toHaveLength(1);
expect(resultados.filter((r) => r.status === 409)).toHaveLength(clientes.length - 1);
// y verificar en la base: existencia final y VW_Inventario_Conciliacion vacía (vía SP de prueba)
```

## 13. Logs

- `logger.child({ modulo: 'direcciones' })`; el `requestId`, el `traceId` y la instancia se agregan solos.
- Nunca `console.log`. Nunca registres contraseñas, tokens, cookies, número de tarjeta ni CVV (pino los redacta, pero no los pases).

## 14. Checklist antes de terminar

- [ ] La estructura del módulo está completa y otros módulos solo usan su `index.ts`.
- [ ] El repositorio solo usa `ejecutarSP` con tipos SQL explícitos; no hay texto SQL en ningún archivo (tampoco en las pruebas).
- [ ] El servicio no importa Express y recibe sus dependencias inyectadas.
- [ ] Los controladores no tienen `if` de negocio ni `try/catch`.
- [ ] Cada ruta tiene `autenticar`/`autorizar` (o un comentario que justifica que es pública) y registro en OpenAPI.
- [ ] Cada handler del controlador valida su entrada con `manejar` (A-20).
- [ ] Los cuerpos usan `.strict()` y ningún endpoint de cliente recibe un ID de usuario.
- [ ] Los montos son texto en JSON y `Decimal` en TypeScript.
- [ ] Hay pruebas para cada criterio de aceptación, incluida la de aislamiento si el endpoint es de cliente.
- [ ] `pnpm lint`, `pnpm typecheck` y las pruebas pasan, y se muestra su salida real.
- [ ] Cumple la subsección SOLID y clean code de CLAUDE.md, sin abstracciones que ninguna
  historia necesite.
