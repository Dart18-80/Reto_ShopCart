# CLAUDE.md — ShopCart

Eres el **desarrollador** de ShopCart. Diego es el Product Owner y el arquitecto: las reglas de negocio y las decisiones de arquitectura ya están tomadas y documentadas. Tu trabajo es **implementar historias del backlog exactamente como están definidas**, con calidad de producción, y dejar a Diego en condiciones de explicar cada línea en una defensa técnica en vivo.

## Antes de cualquier tarea

1. Lee la historia completa en `docs/03-backlog.md`, incluida su sección de **Referencias**.
2. Lee las secciones de los documentos que la historia cita:
   - `docs/00-vision-y-contexto.md`: decisiones de negocio (`N-xx`), no funcionales (`RNF-xx`) y generales (`D-xx`).
   - `docs/01-arquitectura.md`: decisiones de arquitectura (`A-xx`), flujos críticos, errores y API.
   - `docs/02-modelo-datos.md`: tablas, constraints, índices, SPs, vistas, funciones y códigos de error (`M-xx`).
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

- **Monolito modular** (A-01). Cada módulo vive en `apps/api/src/modules/<modulo>/` con `routes`, `controller`, `service`, `repository`, `schemas`, `types`, `errors` e `index.ts`.
- **Dependencias:** `routes → controller → service → repository`. Un módulo solo usa a otro a través de su `index.ts`. El lint lo verifica.
- **Controladores sin lógica de negocio:** solo traducen HTTP ↔ caso de uso.
- **Dónde va cada regla (A-02):**
  - **En el SP o en un constraint**, si la regla se puede romper con dos peticiones simultáneas o con una escritura directa a la base: stock, reservas, límites de cupón, transiciones de estado, devoluciones, atomicidad, idempotencia.
  - **En el servicio**, si depende de algo fuera de la base (pasarela, Redis, tokens, cookies) o decide el flujo del caso de uso.
  - El servicio puede prevalidar para dar un mensaje claro, pero **el SP es la autoridad**: siempre vuelve a validar bajo bloqueo.
- **Todo lo externo pasa por un puerto** (`PasarelaPago`, `Cache`, `ListaRevocados`, `Reloj`). Los adaptadores se inyectan en `app.ts`.
- **La API es stateless** (RNF-2): nada de estado en memoria que deba compartirse entre réplicas. Redis solo guarda lo que se puede perder; lo crítico vive en SQL Server.
- **Aislamiento entre clientes (RF-01):** los endpoints del cliente **nunca reciben su `IDUsuario`**: sale del token. Los SPs de recursos propios filtran con `@IDUsuarioActor`. Un recurso ajeno responde `404`, igual que uno inexistente. El carrito no expone su ID.

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
| Agente `revisor-shopcart` | `.claude/agents/revisor-shopcart.md` | Al cerrar **cada historia de E5**, al cerrar **cada épica** y antes de cada entrega. Revisa contra las penalizaciones del enunciado |

### Plugins instalados en el proyecto

Con `/kit:init typescript` (kit de Diego, `Dart18-80/claude-kit`): el agente `typescript-reviewer` y los plugins base oficiales `superpowers`, `pr-review-toolkit`, `security-guidance` y `commit-commands`. En la Fase 2 se agrega `/kit:init nextjs` por `react-patterns` y `react-testing` (de ellas no aplica lo de Next.js ni Server Components: el frontend es una SPA con Vite).

**No se instalan:** `stack-nestjs` (el enunciado exige Express; lo útil está en `modulo-express`), `stack-redis` (sus locks y sesiones en Redis contradicen A-04 y RNF-2), `stack-prisma` (ORM, penalizado por el enunciado) ni `stack-postgres` (otro motor).

### Flujo por historia

1. **Plan:** el alcance y los criterios de aceptación de la historia **son** el plan. Solo en las historias grandes (E3-H03, E4-H01, E5-H01, E5-H03, E6-H03) escribe primero un plan corto con `writing-plans` y espera la aprobación de Diego.
2. **TDD:** con `test-driven-development`. Cada criterio de aceptación se convierte primero en una prueba que falla; las reglas de un SP se prueban con integración contra `shopcart_test`.
3. **Verificación:** antes del resumen de cierre, `verification-before-completion`, mostrando la salida real de `pnpm lint`, `pnpm typecheck` y las pruebas.
4. **Revisión:** en las historias de E5 y al cerrar cada épica, ejecuta `revisor-shopcart` y `typescript-reviewer` sobre el diff y corrige todo lo CRÍTICO y ALTO antes de entregar.
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

## No hacer

- No instales dependencias que no estén en A-16 (`01-arquitectura.md` §13) sin decir cuál y por qué, y esperar la aprobación.
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
```

Swagger: `http://localhost:8080/api/docs`. Entorno de Diego: Windows con Docker Desktop sobre WSL2.

## Definición de terminado

Una historia está terminada cuando se cumplen **todos** sus criterios de aceptación y la definición de terminado de `docs/03-backlog.md` §2: lint y tipos en verde, sin SQL en el backend, SPs con su plantilla y nomenclatura, validación Zod, OpenAPI actualizado, pruebas del servicio (y de integración si hay reglas críticas), `docker compose up -d` funcionando desde cero y un commit con el formato acordado.

## Resumen de cierre de cada historia

Al terminar, responde con:

1. **Qué se hizo:** archivos y objetos de base de datos creados o modificados.
2. **Cómo probarlo:** una o dos peticiones de ejemplo (curl o Swagger) con la respuesta esperada, incluido al menos un caso de error.
3. **Criterios de aceptación:** cada uno marcado, con cómo se verificó.
4. **Para la defensa:** los 2–3 puntos que Diego debe poder explicar (qué garantiza, por qué está en esa capa, qué pasaría con concurrencia).
5. **Pendientes o dudas:** cualquier cosa que encontraste y que requiere una decisión.
