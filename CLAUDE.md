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
- **Aislamiento entre clientes (RF-01):** los endpoints del cliente **nunca reciben su `IDUsuario`**: sale del token. Los SPs filtran con `@IDUsuario`. Un recurso ajeno responde `404`, igual que uno inexistente. El carrito no expone su ID.

## Reglas de base de datos

- **Prohibido escribir SQL en el backend.** Ni `SELECT`, ni `INSERT`, ni `EXEC` en texto. El repositorio solo llama a `ejecutarSP('SP_Modulo_Proceso', { parametro: { tipo, valor } })` con tipos SQL explícitos.
- **Prohibido concatenar valores en SQL**, también dentro de los SPs. El SQL dinámico solo con `sp_executesql` y parámetros; el ordenamiento sale de una lista blanca resuelta con `CASE`.
- **Nomenclatura del enunciado:** `SP_Modulo_Proceso`, `VW_Modulo_Proceso`, `FU_Modulo_Proceso`, PK `IDTabla`. Extensión propia: `TR_Modulo_Proceso`, `PK_`, `FK_`, `UQ_`, `CK_`, `DF_`, `IX_`, `UX_` (`02-modelo-datos.md` §1.1).
- **Tipos:** montos `DECIMAL(12,2)`, porcentajes `DECIMAL(5,2)`, cantidades `INT`, fechas `DATETIME2(3)` en UTC. **Nunca `FLOAT`, `REAL` ni `MONEY`.**
- **Plantilla de SP que escribe:** `SET NOCOUNT ON; SET XACT_ABORT ON;` + `BEGIN TRY BEGIN TRAN … COMMIT END TRY BEGIN CATCH IF @@TRANCOUNT > 0 ROLLBACK; THROW; END CATCH`.
- **Errores de negocio:** `THROW <código>, N'<mensaje para el usuario>', 1;` usando el rango del módulo (`02-modelo-datos.md` §8). Cada código nuevo se agrega también a `apps/api/src/shared/errors/catalogo.ts` con su HTTP.
- **Concurrencia:** `WITH (UPDLOCK, ROWLOCK)` sobre las filas en disputa, bloqueo de variantes **siempre en orden de `IDVariante`**, contadores con `CHECK` (A-13), `UNIQUE` como candado de idempotencia y `sp_getapplock` en los jobs (A-04).
- **`SP_Inventario_RegistrarMovimiento` es el único que modifica `ExistenciaFisica` y escribe el kardex.** Ningún otro SP lo hace directamente.
- **Usuario y RequestId** llegan en `SESSION_CONTEXT(N'IDUsuario')` y `SESSION_CONTEXT(N'RequestId')`; `ejecutarSP` los establece.
- **Scripts en `database/`:**
  - `migrations/V###__descripcion.sql`: tablas y datos estructurales. **Nunca edites un `V###` ya aplicado**: crea uno nuevo.
  - `programmability/R__<Objeto>.sql`: SPs, vistas, funciones y triggers con `CREATE OR ALTER`; un objeto por archivo.
  - `seeds/S###__descripcion.sql`: datos semilla.
- `Bitacora`, `MovimientoKardex` e `HistorialEstadoPedido` son **ledger append-only** (M-01): solo se insertan filas; su diseño no se cambia sin preguntar.

## Estándar de código

- TypeScript `strict`; sin `any`, sin `@ts-ignore`, sin `!` de no-nulo salvo justificación en un comentario.
- **Nombres del dominio en español**, igual que en la base (`crearPedido`, `IDVariante` → `idVariante`, `SesionCheckout`). Términos técnicos del framework se quedan como son (`router`, `middleware`).
- Archivos `<modulo>.<capa>.ts`; tipos y clases en `PascalCase`, variables y funciones en `camelCase`, constantes en `MAYUSCULAS`.
- **Dinero:** `decimal.js` en el backend; en JSON los montos viajan como texto (`"149.90"`). Nunca `number` para dinero.
- Validación de toda entrada con Zod; los esquemas generan la documentación OpenAPI. Los esquemas compartidos con el frontend van en `packages/shared`.
- Logs con pino, nunca `console.log`. Nunca registres contraseñas, tokens, cookies, número de tarjeta ni CVV.
- Funciones pequeñas, sin comentarios obvios. Comenta el **porqué** cuando una decisión no es evidente y cita su ID (`// N-02: la garantía solo protege contra subidas`).

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
