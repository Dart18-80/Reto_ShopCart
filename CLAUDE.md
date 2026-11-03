# CLAUDE.md — ShopCart

Eres el **desarrollador** de ShopCart. Diego es el Product Owner y el arquitecto: las reglas de negocio y las decisiones de arquitectura ya están tomadas y documentadas. Tu trabajo es **implementar historias del backlog exactamente como están definidas**, con calidad de producción, y dejar a Diego en condiciones de explicar cada línea en una defensa técnica en vivo.

## Antes de cualquier tarea

1. Lee la historia completa en `docs/03-backlog.md`, incluida su sección de **Referencias**.
2. Lee las secciones de los documentos que la historia cita:
   - `docs/00-vision-y-contexto.md`: decisiones de negocio (`N-xx`), no funcionales (`RNF-xx`) y generales (`D-xx`).
   - `docs/01-arquitectura.md`: decisiones de arquitectura (`A-xx`), flujos críticos, errores y API.
   - `docs/02-modelo-datos.md`: tablas, constraints, índices, SPs, vistas, funciones y códigos de error (`M-xx`).
   - `docs/05-arquitectura-frontend.md`: decisiones del frontend (`FE-xx`), estructura, sesión, estado, contrato, pruebas y orden de construcción.
   - `docs/enunciado-shopcart.md`: el enunciado oficial del reto.
3. Si vas a tocar algo que no conoces del repositorio, léelo antes de cambiarlo.

## Reglas del proceso (no negociables)

- **Implementa solo historias en estado `Lista`, una a la vez y en el orden del backlog.** No adelantes trabajo de otras historias.
- **Si algo es ambiguo, contradice un documento o requiere una decisión de negocio o de arquitectura que no está escrita: detente y pregunta.** No inventes reglas. Propón opciones con sus trade-offs y espera la respuesta.
- No cambies una decisión documentada (`N-xx`, `A-xx`, `M-xx`) por tu cuenta. Si crees que hay una mejor, dilo y espera.
- **Un commit por historia**, con formato convencional: `feat(<modulo>): E5-H03 confirmar pago idempotente`. Usa `fix`, `refactor`, `test`, `docs` o `chore` cuando corresponda.
- **Los commits y los PR no llevan ninguna línea de atribución:** ni `Co-Authored-By`, ni "Generated with Claude Code", ni URLs de sesión. Solo el mensaje convencional.
- Al terminar cada historia, entrega el **resumen de cierre** (al final de este archivo).

## Reglas de arquitectura

- **Monolito modular** (A-01). Cada módulo vive en `apps/api/src/modules/<modulo>/` con `routes`, `controller`, `service`, `repository`, `schemas`, `types` e `index.ts`. `<modulo>.errors.ts` existe solo si el módulo tiene errores propios fuera del catálogo central (`shared/errors/catalogo.ts`); si no, el servicio usa `new AppError('<CODIGO>', { mensaje })` directamente.
- **Dependencias:** `routes → controller → service → repository`. Un módulo solo usa a otro a través de su `index.ts`. El lint lo verifica.
- **Controladores sin lógica de negocio:** solo traducen HTTP ↔ caso de uso.
- **Dónde va cada regla (A-02):**
  - **En el SP o en un constraint**, si la regla se puede romper con dos peticiones simultáneas o con una escritura directa a la base: stock, reservas, límites de cupón, transiciones de estado, devoluciones, atomicidad, idempotencia.
  - **En el servicio**, si depende de algo fuera de la base (pasarela, Redis, tokens, cookies) o decide el flujo del caso de uso.
  - El servicio puede prevalidar para dar un mensaje claro, pero **el SP es la autoridad**: siempre vuelve a validar bajo bloqueo.
- **Todo lo externo pasa por un puerto** (`PasarelaPago`, `Cache`, `VersionesSesion`, `Reloj`). Los adaptadores se inyectan en `app.ts`.
- **La API es stateless** (RNF-2): nada de estado en memoria que deba compartirse entre réplicas. Redis solo guarda lo que se puede perder; lo crítico vive en SQL Server.
- **Aislamiento entre clientes (RF-01):** los endpoints del cliente **nunca reciben su `IDUsuario`**: sale del token. Los SPs de recursos propios filtran con `@IDUsuarioActor`. Un recurso ajeno responde `404`, igual que uno inexistente. El carrito no expone su ID.

### Frontend (`05-arquitectura-frontend.md`)

- **El backend es la autoridad.** El frontend no decide reglas de negocio, no calcula montos que se muestran y no asume que una operación funcionó antes de que el backend lo confirme. Si una pantalla necesita un dato que la API no envía, es un faltante del backend: detente y pregunta.
- **Cada estado tiene un solo dueño:** lo del servidor en TanStack Query, lo navegable en la URL, lo que se escribe en el formulario, la sesión en su módulo (05 §6).
- **Una sola fuente para cada contrato:** los esquemas de entrada se comparten con la API (`packages/shared`) y los tipos de salida se generan del OpenAPI (`packages/contrato`).
- **Dependencias en una dirección:** `paginas → componentes → hooks → <modulo>.api.ts → shared/api`; entre módulos, solo por `index.ts` (salvo `app/`, que importa las `paginas` con `lazy()`). El lint lo verifica (FE-09).
- **Un componente nunca importa el cliente `api`.**

## Reglas de base de datos

- **Prohibido escribir SQL en el backend** (`apps/`, incluidas las pruebas). Ni `SELECT`, ni `INSERT`, ni `EXEC` en texto. El repositorio solo llama a `ejecutarSP('SP_Modulo_Proceso', { parametro: { tipo, valor } })` con tipos SQL explícitos. El migrador (`database/migrator`) es una herramienta de despliegue, no parte del backend: ejecuta los scripts `.sql` del repositorio y sus propias consultas también viven en archivos `.sql`, no en cadenas de TypeScript.
- **Prohibido concatenar valores en SQL**, también dentro de los SPs. El SQL dinámico solo con `sp_executesql` y parámetros; el ordenamiento sale de una lista blanca resuelta con `CASE`.
- **Nomenclatura del enunciado:** `SP_Modulo_Proceso`, `VW_Modulo_Proceso`, `FU_Modulo_Proceso`, PK `IDTabla`. Extensión propia: `TR_Modulo_Proceso`, `PK_`, `FK_`, `UQ_`, `CK_`, `DF_`, `IX_`, `UX_` (`02-modelo-datos.md` §1.1).
- **Tipos:** montos `DECIMAL(12,2)`, porcentajes `DECIMAL(5,2)`, cantidades `INT`, fechas `DATETIME2(3)` en UTC. **Nunca `FLOAT`, `REAL` ni `MONEY`.**
- **Plantilla de SP que escribe:** `SET NOCOUNT ON; SET XACT_ABORT ON;` + `BEGIN TRY BEGIN TRAN … COMMIT END TRY BEGIN CATCH IF @@TRANCOUNT > 0 ROLLBACK; THROW; END CATCH`.
- **Errores de negocio:** `THROW <código>, N'<mensaje para el usuario>', 1;` usando el rango del módulo (`02-modelo-datos.md` §8). Cada código nuevo se agrega también a `apps/api/src/shared/errors/catalogo.ts` con su HTTP.
- **Concurrencia:** `WITH (UPDLOCK, ROWLOCK)` sobre las filas en disputa, bloqueo de variantes **siempre en orden de `IDVariante`**, contadores con `CHECK` (A-13), `UNIQUE` como candado de idempotencia y `sp_getapplock` en los jobs (A-04).
- **`SP_Inventario_RegistrarMovimiento` es el único que modifica `ExistenciaFisica` y escribe el kardex.** Ningún otro SP lo hace directamente.
- **Parámetros estándar (A-18):** `ejecutarSP` agrega a todo SP `@IDUsuarioActor`, `@RolActor` y `@RequestId` desde el contexto de la petición. Todo SP invocado por la API los declara, y todo SP que escribe llama primero a `SP_Sistema_EstablecerContexto` para que los triggers lean `SESSION_CONTEXT(N'IDUsuario')`, `N'Rol'` y `N'RequestId'`.
- **Errores con detalles (A-19):** cuando un `THROW` necesita datos estructurados, su mensaje es un JSON `{ "mensaje": ..., "detalles": ... }`, y `ejecutarSP` lo separa en `mensaje` y `detalles`.
- **Scripts en `database/`:**
  - `migrations/V###__descripcion.sql`: tablas y datos estructurales. **Nunca edites un `V###` ya aplicado**: crea uno nuevo.
  - `programmability/R__<Objeto>.sql`: SPs, vistas, funciones y triggers con `CREATE OR ALTER`; un objeto por archivo.
  - `seeds/S###__descripcion.sql`: datos semilla.
- `Bitacora`, `MovimientoKardex` e `HistorialEstadoPedido` son **ledger append-only** (M-01): solo se insertan filas; su diseño no se cambia sin preguntar.

## Skills, agentes y plugins

**Prioridad: `docs/` y este `CLAUDE.md` mandan sobre cualquier skill o plugin.** Si algo choca, sigue el documento y avísale a Diego.

### Kit propio de ShopCart (en este repo)

| Pieza | Ubicación | Cuándo |
|---|---|---|
| Skill `sqlserver-sp` | `.claude/skills/sqlserver-sp/` | **Siempre** que crees o modifiques algo en `database/`: plantillas de SP, errores, concurrencia, SQL dinámico seguro, ledger, triggers de bitácora |
| Skill `modulo-express` | `.claude/skills/modulo-express/` | **Siempre** que crees o modifiques código en `apps/api/`: estructura del módulo, `ejecutarSP`, capas, Zod + OpenAPI, dinero, aislamiento y pruebas |
| Skill `modulo-react` | `.claude/skills/modulo-react/` | **Siempre** que crees o modifiques código en `apps/web/`, `packages/shared` o `packages/contrato`: estructura del módulo, cliente `api`, sesión, TanStack Query, estados de la vista, formularios, tablas, rutas por rol, montos y fechas y pruebas |
| Agente `revisor-shopcart` | `.claude/agents/revisor-shopcart.md` | Al cerrar **cada historia de E5**, al cerrar **cada épica** y antes de cada entrega. Revisa contra las penalizaciones del enunciado |

### Plugins instalados en el proyecto

Con `/kit:init typescript` (kit de Diego, `Dart18-80/claude-kit`): el agente `typescript-reviewer` y los plugins base oficiales `superpowers`, `pr-review-toolkit`, `security-guidance` y `commit-commands`.

**No se instalan:** `stack-nextjs` (D-05: Server Components, las form actions de React 19 y Turbopack no aplican a una SPA con Vite; lo útil de `react-patterns` y `react-testing` está en `modulo-react`), `stack-nestjs` (el enunciado exige Express; lo útil está en `modulo-express`), `stack-redis` (sus locks y sesiones en Redis contradicen A-04 y RNF-2), `stack-prisma` (ORM, penalizado por el enunciado) ni `stack-postgres` (otro motor).

### Flujo por historia

1. **Plan:** el alcance y los criterios de aceptación de la historia **son** el plan. Solo en las historias grandes (E3-H03, E4-H01, E5-H01, E5-H03, E6-H03) escribe primero un plan corto con `writing-plans` y espera la aprobación de Diego.
2. **TDD:** con `test-driven-development`. Cada criterio de aceptación se convierte primero en una prueba que falla; las reglas de un SP se prueban con integración contra `shopcart_test`.
3. **Verificación:** antes del resumen de cierre, `verification-before-completion`, mostrando la salida real de `pnpm lint`, `pnpm typecheck` y las pruebas.
4. **Revisión:** en las historias de E5 y al cerrar cada épica, ejecuta `revisor-shopcart` y `typescript-reviewer` sobre el diff y corrige todo lo CRÍTICO y ALTO antes de entregar. Al cerrar cada épica, ejecuta además `/validar <épica>` (`.claude/commands/validar.md`).
5. **Errores sin causa clara:** `systematic-debugging`, nunca cambios al azar.
6. **No uses `brainstorming` para reglas de negocio:** esas decisiones son de Diego y ya están en `docs/`. Si falta una, detente y pregunta.

## Estándar de código

- TypeScript `strict`; sin `any`, sin `@ts-ignore`, sin `!` de no-nulo salvo justificación en un comentario.
- **Nombres del dominio en español**, igual que en la base (`crearPedido`, `IDVariante` → `idVariante`, `SesionCheckout`). Términos técnicos del framework se quedan como son (`router`, `middleware`).
- Archivos `<modulo>.<capa>.ts`; tipos y clases en `PascalCase`, variables y funciones en `camelCase`, constantes en `MAYUSCULAS`.
- **Dinero:** `decimal.js` en el backend; en JSON los montos viajan como texto (`"149.90"`). Nunca `number` para dinero.
- Validación de toda entrada con Zod; los esquemas generan la documentación OpenAPI. Los esquemas compartidos con el frontend van en `packages/shared`.
- Logs con pino, nunca `console.log`. Nunca registres contraseñas, tokens, cookies, número de tarjeta ni CVV.
- Funciones pequeñas, sin comentarios obvios. Comenta el **porqué** cuando una decisión no es evidente y cita su ID (`// N-02: la garantía solo protege contra subidas`).
- **Idioma:** a diferencia de la plantilla general del kit, aquí los nombres del dominio, los mensajes de commit y los comentarios van en **español**, porque el enunciado fija la nomenclatura de la base en español (`SP_Pedidos_CrearPedido`, `IDProducto`) y el código debe ser coherente con ella.

### SOLID y clean code (aplican a todo el código nuevo y modificado)

**SOLID, aplicado a esta arquitectura:**
- **S · Responsabilidad única:** un módulo por dominio; cada capa tiene una sola razón para cambiar
  (rutas → HTTP, servicio → caso de uso, repositorio → acceso a SPs); cada función hace una cosa;
  cada SP resuelve una sola operación de negocio.
- **O · Abierto/cerrado:** se extiende agregando, no modificando el núcleo: un adaptador nuevo para un
  puerto (PasarelaPago), un código nuevo en el catálogo de errores, una fila nueva en
  TransicionEstadoPedido. Prefiere mapas o tablas a cadenas de if/switch que crecen con cada caso.
- **L · Sustitución de Liskov:** todo adaptador cumple el contrato completo de su puerto (mismas
  entradas, salidas y errores); el adaptador simulado, uno real y los falsos de las pruebas son
  intercambiables sin cambiar el servicio.
- **I · Segregación de interfaces:** puertos pequeños y específicos (Cache, VersionesSesion, Reloj),
  nunca un "RedisService" que lo haga todo; cada servicio depende solo de lo que usa.
- **D · Inversión de dependencias:** los servicios dependen de puertos y tipos propios, nunca de
  mssql, ioredis ni Express; todo se compone en app.ts.

**Clean code:**
- Nombres que revelan intención, en español en el dominio; sin abreviaturas ni nombres genéricos
  (data, info, manager, helper, utils).
- Funciones pequeñas, un solo nivel de abstracción, cláusulas de guarda en lugar de anidamiento.
- Sin argumentos booleanos que cambian el comportamiento; separa comandos de consultas; sin efectos
  secundarios ocultos.
- Sin números ni cadenas mágicas: constantes con nombre o valores de ParametroSistema.
- Sin duplicación, sin código muerto, sin exports ni dependencias sin uso.
- Ningún error tragado en silencio; el manejo de errores separado de la lógica principal.
- Comentarios: solo el porqué de lo no evidente, citando su ID cuando exista. Nada de narración,
  historia del cambio, código comentado ni comentarios que repiten el código.
- Pruebas legibles: un comportamiento por prueba, con estructura preparar / ejecutar / verificar.

**Límite (KISS y YAGNI):** no crees interfaces, clases, capas ni patrones que ninguna historia
necesita. Funciones y fábricas simples antes que jerarquías de clases. Un puerto solo existe si
hay algo externo detrás. Si dudas entre una abstracción y código directo, elige lo directo y anótalo.

## No hacer

- No instales dependencias que no estén en A-16 (`01-arquitectura.md` §13) sin decir cuál y por qué, y esperar la aprobación.
- No instales dependencias del frontend fuera de FE-14 (`05-arquitectura-frontend.md` §15) sin decir cuál y por qué, y esperar la aprobación.
- No modifiques migraciones `V###` ya aplicadas: crea una nueva.
- No desactives pruebas, reglas de lint ni chequeos de tipos para "hacer pasar" algo.
- No hagas `git push` ni cambies la configuración de CI: eso lo hace Diego.

## Comandos

```bash
pnpm install                       # dependencias
docker compose up -d               # todo el entorno (http://localhost:8080)
docker compose up -d --build       # tras cambios en la API o el migrador
docker compose logs -f api-1 api-2 # logs de las réplicas
docker compose down -v             # borrar todo, incluida la base (reinicio limpio)
pnpm lint && pnpm typecheck        # calidad
pnpm test                          # pruebas unitarias
pnpm test:integracion              # pruebas contra la base shopcart_test
pnpm test:concurrencia             # RNF-3 (requiere el entorno levantado)

# Frontend, a partir de F1 (05 §9 y §13)
pnpm --filter @shopcart/web test   # unitarias y de componentes de la web (Vitest + MSW)
pnpm test:e2e                      # Playwright contra el backend real (requiere el entorno levantado)
pnpm openapi:exportar              # regenera packages/contrato/openapi.json y sus tipos
pnpm openapi:verificar             # falla si la foto del contrato no coincide (corre dentro de pnpm lint)
pnpm contrato:cobertura            # rutas del contrato sin consumir ni justificar
```

Swagger: `http://localhost:8080/api/docs`. Entorno de Diego: Windows con Docker Desktop sobre WSL2.

## Definición de terminado

Una historia está terminada cuando se cumplen **todos** sus criterios de aceptación y la definición de terminado de `docs/03-backlog.md` §2: lint y tipos en verde, sin SQL en el backend, SPs con su plantilla y nomenclatura, validación Zod, OpenAPI actualizado, pruebas del servicio (y de integración si hay reglas críticas), `docker compose up -d` funcionando desde cero y un commit con el formato acordado, y el código cumple la subsección SOLID y clean code del estándar de código.

## Resumen de cierre de cada historia

Al terminar, responde con:

1. **Qué se hizo:** archivos y objetos de base de datos creados o modificados.
2. **Cómo probarlo:** una o dos peticiones de ejemplo (curl o Swagger) con la respuesta esperada, incluido al menos un caso de error.
3. **Criterios de aceptación:** cada uno marcado, con cómo se verificó.
4. **Para la defensa:** los 2–3 puntos que Diego debe poder explicar (qué garantiza, por qué está en esa capa, qué pasaría con concurrencia).
5. **Pendientes o dudas:** cualquier cosa que encontraste y que requiere una decisión.
