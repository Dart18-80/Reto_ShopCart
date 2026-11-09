# Base de datos

## Qué decide

SQL Server es la autoridad de las reglas críticas: el backend **no contiene SQL**, solo llama stored procedures por nombre con parámetros tipados. Cada SP que escribe sigue una plantilla con transacción y `XACT_ABORT`, lanza errores de negocio con `THROW 5xxxx` y deja el actor en `SESSION_CONTEXT` para los triggers de bitácora. Tres tablas son ledger append-only. El esquema se despliega con un migrador propio (`V###`, `R__`, `S###`) con checksum. La API se conecta con un login que solo puede ejecutar SPs.

## Sin SQL en el backend: `ejecutarSP`

- La única puerta a la base desde los repositorios es `ejecutarSP(nombre, parámetros)` ([index.ts:34](../../../apps/api/src/shared/db/index.ts#L34 "export async function ejecutarSP")).
- El tipo del nombre solo admite la nomenclatura del enunciado, así que un texto SQL ni siquiera compila ([ejecutar-sp.ts:13](../../../apps/api/src/shared/db/ejecutar-sp.ts#L13 "export type NombreSP = `SP_${string}_${string}`")); la prueba: [ejecutar-sp.test.ts:313](../../../apps/api/test/unit/shared/db/ejecutar-sp.test.ts#L313 "su firma solo acepta nombres SP_Modulo_Proceso, nunca texto SQL").
- El adaptador de `mssql` usa `request.execute(nombre)`, que ejecuta un procedimiento, nunca un texto ([pool.ts:31](../../../apps/api/src/shared/db/pool.ts#L31 "await solicitud.execute(nombre)")). Cada parámetro va con su tipo SQL explícito ([pool.ts:29](../../../apps/api/src/shared/db/pool.ts#L29 "solicitud.input(parametro, tipo, valor)")), por ejemplo `sql.NVarChar(100)` en [direcciones.repository.ts:39](../../../apps/api/src/modules/direcciones/direcciones.repository.ts#L39 "NombreRecibe: { tipo: sql.NVarChar(100), valor: datos.nombreRecibe }").
- La prueba de penalizaciones recorre todo el TypeScript de `apps/api/src`, `apps/api/test`, `packages/shared/src` y `database/migrator/src` buscando sentencias SQL ([penalizaciones.test.ts:185](../../../database/migrator/test/penalizaciones.test.ts#L185 "ningún archivo TypeScript del backend contiene una sentencia SQL")) y llamadas `.query(`/`.batch(` en la API ([penalizaciones.test.ts:193](../../../database/migrator/test/penalizaciones.test.ts#L193 "la API nunca pasa texto a mssql (ni query ni batch)")).
- Las pruebas de integración tampoco escriben SQL: preparan datos con SPs `SP_Pruebas_*` que el migrador solo instala en `shopcart_test` ([scripts.ts:39](../../../database/migrator/src/scripts.ts#L39 "Solo en shopcart_test y al final")).

### Parámetros estándar y `SESSION_CONTEXT` (A-18)

- `ejecutarSP` agrega a todo SP `@IDUsuarioActor`, `@RolActor` y `@RequestId` desde el contexto de la petición ([ejecutar-sp.ts:29](../../../apps/api/src/shared/db/ejecutar-sp.ts#L29 "const PARAMETROS_ESTANDAR = ['IDUsuarioActor', 'RolActor', 'RequestId']")).
- Nunca los acepta del llamador: si un repositorio intenta pasarlos (aunque cambie mayúsculas), lanza ([ejecutar-sp.ts:104](../../../apps/api/src/shared/db/ejecutar-sp.ts#L104 "lo agrega ejecutarSP desde el contexto; no se pasa a mano")). Prueba: [ejecutar-sp.test.ts:75](../../../apps/api/test/unit/shared/db/ejecutar-sp.test.ts#L75 "RF-01: rechaza que el llamador envíe un parámetro estándar").
- Fuera de una petición (un job) el rol es `Sistema` ([ejecutar-sp.ts:110](../../../apps/api/src/shared/db/ejecutar-sp.ts#L110 "contexto === undefined ? ROL_SISTEMA : contexto.rol")).
- Todo SP que escribe llama primero a `SP_Sistema_EstablecerContexto`, que fija `SESSION_CONTEXT` en cada llamada, también con `NULL`, porque las conexiones del pool se reutilizan ([R__SP_Sistema_EstablecerContexto.sql:13](../../../database/programmability/R__SP_Sistema_EstablecerContexto.sql#L13 "sp_set_session_context @key = N'IDUsuario'")). Prueba contra la base: [contexto-de-sesion.test.ts:38](../../../apps/api/test/integracion/shared/contexto-de-sesion.test.ts#L38 "una llamada sin actor (job) limpia el contexto que dejó la petición anterior").
- Los triggers de bitácora exigen el rol: sin él, `THROW 50004` y nada se escribe ([R__TR_Catalogo_ProductoBitacora.sql:13](../../../database/programmability/R__TR_Catalogo_ProductoBitacora.sql#L13 "THROW 50004")). Prueba: [bitacora.test.ts:119](../../../apps/api/test/integracion/esquema/bitacora.test.ts#L119 "una escritura auditada sin contexto falla con CONTEXTO_NO_ESTABLECIDO").

## Nomenclatura y tipos

| Regla | Dónde se ve | Cómo se verifica |
| --- | --- | --- |
| `SP_Modulo_Proceso`, `FU_`, `VW_`, `TR_`, un objeto por archivo `R__` | [scripts.ts:33](../../../database/migrator/src/scripts.ts#L33 "patron: /^R__(?:FU") | el migrador rechaza un archivo con otro nombre |
| PK `IDTabla` y prefijos `PK_`, `CK_`, `UQ_`, `DF_` | [V005__inventario.sql:11](../../../database/migrations/V005__inventario.sql#L11 "CONSTRAINT PK_TipoMovimiento PRIMARY KEY (IDTipoMovimiento)") | revisión |
| Fechas `DATETIME2(3)` en UTC | [V009__bitacora.sql:15](../../../database/migrations/V009__bitacora.sql#L15 "DATETIME2(3)         NOT NULL CONSTRAINT DF_Bitacora_Fecha DEFAULT SYSUTCDATETIME()") | prueba de tipos prohibidos |
| Sin `FLOAT`, `REAL`, `MONEY`, `DATETIME`, `TEXT`, `NTEXT`, `IMAGE` | todos los scripts | [penalizaciones.test.ts:130](../../../database/migrator/test/penalizaciones.test.ts#L130 "ningún FLOAT, REAL, MONEY, DATETIME, TEXT, NTEXT ni IMAGE") |
| Montos `DECIMAL(12,2)` (agregados en `DECIMAL(15,2)`) | [V007__checkout.sql:28](../../../database/migrations/V007__checkout.sql#L28 "Total              DECIMAL(12,2)") | prueba de tipos prohibidos |

## Plantilla de un SP que escribe

Ejemplo, `SP_Checkout_IniciarSesion`:

| Pieza | Línea |
| --- | --- |
| `SET XACT_ABORT ON`: cualquier error revierte toda la transacción | [R__SP_Checkout_IniciarSesion.sql:23](../../../database/programmability/R__SP_Checkout_IniciarSesion.sql#L23 "SET XACT_ABORT ON;") |
| Contexto del actor antes de escribir | [R__SP_Checkout_IniciarSesion.sql:25](../../../database/programmability/R__SP_Checkout_IniciarSesion.sql#L25 "EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;") |
| `BEGIN TRY` + `BEGIN TRAN` | [R__SP_Checkout_IniciarSesion.sql:50](../../../database/programmability/R__SP_Checkout_IniciarSesion.sql#L50 "BEGIN TRAN;") |
| `COMMIT` | [R__SP_Checkout_IniciarSesion.sql:170](../../../database/programmability/R__SP_Checkout_IniciarSesion.sql#L170 "COMMIT;") |
| `IF @@TRANCOUNT > 0 ROLLBACK` en el `CATCH` | [R__SP_Checkout_IniciarSesion.sql:173](../../../database/programmability/R__SP_Checkout_IniciarSesion.sql#L173 "IF @@TRANCOUNT > 0 ROLLBACK;") |
| `THROW;` relanza el error original | [R__SP_Checkout_IniciarSesion.sql:177](../../../database/programmability/R__SP_Checkout_IniciarSesion.sql#L177 "THROW;") |

- Una prueba recorre todos los SPs que escriben (salvo los internos, que corren dentro de la transacción de quien los llama) y exige las cuatro piezas ([convenciones-sql.test.ts:44](../../../database/migrator/test/convenciones-sql.test.ts#L44 "SET XACT_ABORT ON, TRY/CATCH con transacción y SP_Sistema_EstablecerContexto")).
- Un SP interno exige estar dentro de una transacción para no abrir una anidada que revierta la del llamador ([R__SP_Inventario_RegistrarMovimiento.sql:25](../../../database/programmability/R__SP_Inventario_RegistrarMovimiento.sql#L25 "THROW 50005, N'SP_Inventario_RegistrarMovimiento debe ejecutarse dentro de una transacción.'")).
- `SP_Inventario_RegistrarMovimiento` es el único que modifica `ExistenciaFisica` y escribe el kardex, en el mismo paso ([R__SP_Inventario_RegistrarMovimiento.sql:1](../../../database/programmability/R__SP_Inventario_RegistrarMovimiento.sql#L1 "N-07: único punto que modifica Variante.ExistenciaFisica")). Del mismo modo, `SP_Inventario_ReservarExistencia` es el único que inserta en `Reserva`, y una prueba lo verifica ([penalizaciones.test.ts:281](../../../database/migrator/test/penalizaciones.test.ts#L281 "SP_Inventario_ReservarExistencia es el único que inserta en Reserva")).

## Errores de negocio: `THROW 5xxxx` y JSON con detalles (A-06, A-19)

- Cada módulo tiene un rango (50300–50399 inventario, 50600–50699 checkout…) y cada número está en el catálogo con su HTTP (ver [arquitectura.md](arquitectura.md)).
- Si el error necesita datos estructurados, el mensaje del `THROW` es un JSON `{ mensaje, detalles }`: por ejemplo, qué líneas no tienen existencia ([R__SP_Inventario_ReservarExistencia.sql:42](../../../database/programmability/R__SP_Inventario_ReservarExistencia.sql#L42 "SET @Error = (SELECT @MensajeError AS mensaje")) y [R__SP_Inventario_ReservarExistencia.sql:52](../../../database/programmability/R__SP_Inventario_ReservarExistencia.sql#L52 "THROW 50301, @Error, 1;").
- La API lo separa en `mensaje` y `detalles` ([traducir-sql.ts:33](../../../apps/api/src/shared/errors/traducir-sql.ts#L33 "separarMensaje(error instanceof Error ? error.message")); un JSON mal formado no se muestra: cae al mensaje del catálogo y se registra como error del SP ([ejecutar-sp.ts:73](../../../apps/api/src/shared/db/ejecutar-sp.ts#L73 "A-19: el SP lanzó un mensaje JSON inválido")). Pruebas: [traducir-sql.test.ts:25](../../../apps/api/test/unit/shared/errors/traducir-sql.test.ts#L25 "A-19: separa un mensaje JSON en mensaje y detalles") y contra la base [ejecutar-sp.test.ts:33](../../../apps/api/test/integracion/shared/ejecutar-sp.test.ts#L33 "A-19: un THROW con mensaje JSON llega separado en mensaje y detalles").

## Ledger append-only (M-01)

| Tabla | Declaración |
| --- | --- |
| `MovimientoKardex` | [V005__inventario.sql:47](../../../database/migrations/V005__inventario.sql#L47 "WITH (LEDGER = ON (APPEND_ONLY = ON))") |
| `HistorialEstadoPedido` | [V008__pedidos.sql:153](../../../database/migrations/V008__pedidos.sql#L153 "WITH (LEDGER = ON (APPEND_ONLY = ON))") |
| `Bitacora` | [V009__bitacora.sql:24](../../../database/migrations/V009__bitacora.sql#L24 "WITH (LEDGER = ON (APPEND_ONLY = ON))") |

- El motor rechaza `UPDATE` y `DELETE` con el error 37359, incluso a un administrador ([V005__inventario.sql:21](../../../database/migrations/V005__inventario.sql#L21 "El motor rechaza UPDATE y DELETE (error 37359)")). Prueba con las tres tablas y las dos operaciones: [ledger.test.ts:19](../../../apps/api/test/integracion/esquema/ledger.test.ts#L19 "%s rechaza %s").
- Si ocurriera dentro de la API, 37359 no es un número de negocio y termina en `500` ([traducir-sql.test.ts:99](../../../apps/api/test/unit/shared/errors/traducir-sql.test.ts#L99 "M-01: el rechazo de UPDATE o DELETE sobre una tabla ledger (37359)")).
- `sp_verify_database_ledger` exige `ALLOW_SNAPSHOT_ISOLATION`, que el migrador activa al preparar la base ([preparar-servidor.sql:28](../../../database/migrator/sql/preparar-servidor.sql#L28 "SET ALLOW_SNAPSHOT_ISOLATION ON")).

## Migrador: `V###`, `R__`, `S###` con checksum (A-09)

| Tipo | Carpeta | Regla | Línea |
| --- | --- | --- | --- |
| `V###` | `migrations/` | estructura; se aplica una vez y es inmutable | [scripts.ts:29](../../../database/migrator/src/scripts.ts#L29 "carpeta: 'migrations'") |
| `R__` | `programmability/` | SPs, vistas, funciones, triggers con `CREATE OR ALTER`; se reaplica si su checksum cambia | [plan.ts:45](../../../database/migrator/src/plan.ts#L45 "script.tipo === 'R' && !script.checksum.equals(aplicado.checksum)") |
| `S###` | `seeds/` | datos semilla; inmutable como los `V###` | [scripts.ts:36](../../../database/migrator/src/scripts.ts#L36 "carpeta: 'seeds'") |

- **Checksum:** SHA-256 del contenido normalizado (sin BOM, CRLF → LF), para que un checkout en Windows no cuente como cambio ([scripts.ts:65](../../../database/migrator/src/scripts.ts#L65 "createHash('sha256')")).
- **Por qué un `V###` aplicado no se edita:** si su archivo cambió o desapareció, la base ya no se puede reconstruir desde el repositorio; el migrador se detiene antes de aplicar nada ([plan.ts:22](../../../database/migrator/src/plan.ts#L22 "!script.checksum.equals(aplicado.checksum)") y [plan.ts:34](../../../database/migrator/src/plan.ts#L34 "Los V### y S### son inmutables")). Prueba: [migrador.test.ts:62](../../../database/migrator/test/integracion/migrador.test.ts#L62 "modificar un V### ya aplicado hace fallar el migrador con un mensaje claro").
- **Atomicidad:** cada script corre en su propia transacción junto con su fila de historial ([migrador.ts:87](../../../database/migrator/src/migrador.ts#L87 "Cada script corre en su propia transacción")). Prueba: [migrador.test.ts:71](../../../database/migrator/test/integracion/migrador.test.ts#L71 "un script que falla a la mitad no deja nada aplicado ni registrado").
- **Dos migradores a la vez:** `sp_getapplock` de sesión ([adquirir-bloqueo.sql:4](../../../database/migrator/sql/adquirir-bloqueo.sql#L4 "EXEC @Resultado = sys.sp_getapplock")) y, como última defensa, un índice único filtrado ([preparar-base.sql:30](../../../database/migrator/sql/preparar-base.sql#L30 "CREATE UNIQUE INDEX UX_HistorialMigracion_VersionadoUnaVez")). Prueba: [migrador.test.ts:83](../../../database/migrator/test/integracion/migrador.test.ts#L83 "dos migradores a la vez").
- El migrador escribe como `Sistema` antes de cada script, para que los triggers de bitácora tengan contexto ([establecer-contexto-sistema.sql:5](../../../database/migrator/sql/establecer-contexto-sistema.sql#L5 "@value = N'Sistema'")).
- El migrador es una herramienta de despliegue, no parte del backend: sus propias consultas viven en `database/migrator/sql/*.sql` ([consultas.ts:4](../../../database/migrator/src/consultas.ts#L4 "Las consultas propias del migrador viven en sql/")).

## Login `shopcart_app`: solo `EXECUTE`

- `GRANT EXECUTE` sobre el esquema y `DENY SELECT, INSERT, UPDATE, DELETE` ([V001__base.sql:5](../../../database/migrations/V001__base.sql#L5 "GRANT EXECUTE ON SCHEMA::dbo TO shopcart_app") y [V001__base.sql:9](../../../database/migrations/V001__base.sql#L9 "DENY SELECT, INSERT, UPDATE, DELETE ON SCHEMA::dbo TO shopcart_app")).
- Los SPs funcionan por *ownership chaining*: SP y tablas son de `dbo`, así que SQL Server no revisa permisos de tabla dentro del SP.
- Aunque hubiera una inyección, el login no podría leer una tabla. Prueba con el login real: [migrador.test.ts:103](../../../database/migrator/test/integracion/migrador.test.ts#L103 "un SELECT directo a una tabla devuelve error de permisos").
- La API usa ese login ([pool.ts:8](../../../apps/api/src/shared/db/pool.ts#L8 "DB_USUARIO es shopcart_app")); el migrador usa otro, `shopcart_migrator`, `db_owner` solo de esa base ([preparar-base.sql:13](../../../database/migrator/sql/preparar-base.sql#L13 "ALTER ROLE db_owner ADD MEMBER shopcart_migrator")).

## SQL dinámico seguro (A-23)

Solo hay uno: la búsqueda del catálogo.

- Ordenamiento de lista blanca: valores fuera de la lista → `50003` ([R__SP_Catalogo_BuscarProductos.sql:30](../../../database/programmability/R__SP_Catalogo_BuscarProductos.sql#L30 "@Orden NOT IN ('relevancia', 'precio', 'nombre', 'recientes')")) y resuelto con `CASE` dentro del SQL, nunca concatenado ([R__SP_Catalogo_BuscarProductos.sql:59](../../../database/programmability/R__SP_Catalogo_BuscarProductos.sql#L59 "CASE WHEN @Orden = ''precio''")).
- Solo se concatenan fragmentos constantes; los valores viajan como parámetros ([R__SP_Catalogo_BuscarProductos.sql:47](../../../database/programmability/R__SP_Catalogo_BuscarProductos.sql#L47 "SET @Filtro += N' AND p.IDCategoria = @IDCategoria'")) de `sp_executesql` ([R__SP_Catalogo_BuscarProductos.sql:69](../../../database/programmability/R__SP_Catalogo_BuscarProductos.sql#L69 "EXEC sys.sp_executesql @Sql,")).
- `sp_executesql` corre con los permisos de quien llama, y `shopcart_app` tiene `DENY SELECT`. Por eso el SP corre como `shopcart_busqueda` ([R__SP_Catalogo_BuscarProductos.sql:24](../../../database/programmability/R__SP_Catalogo_BuscarProductos.sql#L24 "WITH EXECUTE AS 'shopcart_busqueda'")), un usuario sin login ([V011__usuario_busqueda.sql:4](../../../database/migrations/V011__usuario_busqueda.sql#L4 "CREATE USER shopcart_busqueda WITHOUT LOGIN")) cuyo único permiso es leer la vista de la tienda ([R__VW_Catalogo_ProductosTienda.sql:64](../../../database/programmability/R__VW_Catalogo_ProductosTienda.sql#L64 "GRANT SELECT ON dbo.VW_Catalogo_ProductosTienda TO shopcart_busqueda")). Prueba: [migrador.test.ts:157](../../../database/migrator/test/integracion/migrador.test.ts#L157 "shopcart_busqueda lee la vista de la tienda y nada más").
- El migrador también arma texto, pero solo con `QUOTENAME` para identificadores y contraseñas de login, que no aceptan parámetros ([preparar-servidor.sql:40](../../../database/migrator/sql/preparar-servidor.sql#L40 "QUOTENAME(@ContrasenaApp, '''')")).

## La prueba de penalizaciones

[penalizaciones.test.ts](../../../database/migrator/test/penalizaciones.test.ts) automatiza la checklist del enunciado sobre todos los scripts y el código:

| Penalización | Prueba |
| --- | --- |
| Tipos prohibidos (`FLOAT`, `MONEY`…) | [penalizaciones.test.ts:130](../../../database/migrator/test/penalizaciones.test.ts#L130 "ningún FLOAT, REAL, MONEY, DATETIME, TEXT, NTEXT ni IMAGE") |
| SQL dinámico con `EXEC(...)` | [penalizaciones.test.ts:138](../../../database/migrator/test/penalizaciones.test.ts#L138 "el SQL dinámico solo corre con sp_executesql, nunca con EXEC(...)") |
| Concatenar valores en SQL dinámico | [penalizaciones.test.ts:146](../../../database/migrator/test/penalizaciones.test.ts#L146 "el texto de un SQL dinámico nunca concatena valores") |
| Concatenación en el migrador (solo `QUOTENAME`) | [penalizaciones.test.ts:154](../../../database/migrator/test/penalizaciones.test.ts#L154 "en el migrador solo se concatena un identificador o una contraseña con QUOTENAME") |
| SQL en el backend | [penalizaciones.test.ts:185](../../../database/migrator/test/penalizaciones.test.ts#L185 "ningún archivo TypeScript del backend contiene una sentencia SQL") |
| Texto a `mssql` (`query`/`batch`) | [penalizaciones.test.ts:193](../../../database/migrator/test/penalizaciones.test.ts#L193 "la API nunca pasa texto a mssql") |

Cada regla tiene además su prueba de que **no está vacía** (detecta un caso inseguro a propósito), por ejemplo [penalizaciones.test.ts:162](../../../database/migrator/test/penalizaciones.test.ts#L162 "detecta una concatenación insegura (la regla no es vacía)").

## Alternativas descartadas

- **ORM o consultas en el código** → penalización directa del enunciado; además, las reglas de concurrencia deben vivir bajo bloqueo en la base (A-02).
- **Fijar `SESSION_CONTEXT` desde Node antes de cada SP** → con el pool, el `sp_set_session_context` y el SP pueden correr en conexiones distintas (A-18).
- **Devolver un conjunto de resultados con el error** → formato de salida doble en cada SP; se usa `THROW` con JSON (A-19).
- **Inmutabilidad solo con triggers** → un administrador puede deshabilitarlos; el ledger lo impone el motor (M-01).
- **Flyway** → agrega Java a la imagen; **scripts sin control** → no reproducible (A-09).
- **`EXECUTE AS OWNER` en la búsqueda** → el SQL dinámico tendría el alcance de `dbo`; **firma con certificado** → re-firmar tras cada `ALTER` (A-23).
- **TVP para listas** → tipo de objeto fuera de la nomenclatura; se usa JSON con `OPENJSON ... WITH` (A-22).

## Preguntas probables

### ¿Hay alguna consulta SQL en el backend?

No. Los repositorios solo llaman `ejecutarSP` con el nombre del SP; el tipo `NombreSP` no admite texto y una prueba recorre todo el TypeScript buscando sentencias.
**Muéstralo en:** [penalizaciones.test.ts:185](../../../database/migrator/test/penalizaciones.test.ts#L185 "ningún archivo TypeScript del backend contiene una sentencia SQL")

### ¿Y si alguien inyecta SQL en un parámetro?

Cada valor va como parámetro tipado de `request.execute`; nunca se arma texto. Y aunque lo lograra, `shopcart_app` tiene `DENY SELECT` sobre las tablas.
**Muéstralo en:** [V001__base.sql:9](../../../database/migrations/V001__base.sql#L9 "DENY SELECT, INSERT, UPDATE, DELETE ON SCHEMA::dbo TO shopcart_app")

### Si `shopcart_app` no puede leer tablas, ¿cómo funcionan los SPs?

Por *ownership chaining*: SP y tablas pertenecen a `dbo`, así que dentro del SP no se revisan permisos de tabla. Solo `sp_executesql` rompe la cadena, y por eso la búsqueda corre como `shopcart_busqueda`.
**Muéstralo en:** [migrador.test.ts:126](../../../database/migrator/test/integracion/migrador.test.ts#L126 "shopcart_app no lee la vista de la tienda, pero la búsqueda funciona")

### ¿Dónde hay SQL dinámico y por qué no es inyectable?

Solo en `SP_Catalogo_BuscarProductos`: se concatenan fragmentos constantes, los valores van como parámetros de `sp_executesql` y el orden sale de una lista blanca con `CASE`.
**Muéstralo en:** [R__SP_Catalogo_BuscarProductos.sql:69](../../../database/programmability/R__SP_Catalogo_BuscarProductos.sql#L69 "EXEC sys.sp_executesql @Sql,")

### ¿Qué pasa si un SP falla a la mitad?

`XACT_ABORT ON` revierte toda la transacción y el `CATCH` hace `ROLLBACK` y relanza: nunca quedan datos a medias. Una prueba exige esa plantilla en todos los SPs que escriben.
**Muéstralo en:** [convenciones-sql.test.ts:44](../../../database/migrator/test/convenciones-sql.test.ts#L44 "SET XACT_ABORT ON, TRY/CATCH con transacción y SP_Sistema_EstablecerContexto")

### ¿Cómo sabe la bitácora quién hizo el cambio si el trigger no recibe parámetros?

Cada SP que escribe llama a `SP_Sistema_EstablecerContexto`, que deja usuario, rol y `RequestId` en `SESSION_CONTEXT`; el trigger los lee y falla con 50004 si falta el rol.
**Muéstralo en:** [R__TR_Catalogo_ProductoBitacora.sql:13](../../../database/programmability/R__TR_Catalogo_ProductoBitacora.sql#L13 "THROW 50004")

### ¿Puede un administrador borrar una fila del kardex o de la bitácora?

No: son tablas ledger append-only y el motor rechaza `UPDATE` y `DELETE` con 37359, también al administrador.
**Muéstralo en:** [ledger.test.ts:19](../../../apps/api/test/integracion/esquema/ledger.test.ts#L19 "%s rechaza %s")

### ¿Por qué no se puede editar un `V###` ya aplicado?

Porque la base dejaría de poder reconstruirse desde el repositorio. El migrador guarda el SHA-256 de cada script y se detiene si un `V###` aplicado cambió; el cambio va en un `V###` nuevo.
**Muéstralo en:** [plan.ts:22](../../../database/migrator/src/plan.ts#L22 "!script.checksum.equals(aplicado.checksum)")

### ¿Cómo devuelven al cliente qué productos no tienen existencia?

El SP lanza un `THROW` cuyo mensaje es un JSON `{ mensaje, detalles }`; `ejecutarSP` lo separa y la API responde con `detalles`.
**Muéstralo en:** [R__SP_Inventario_ReservarExistencia.sql:42](../../../database/programmability/R__SP_Inventario_ReservarExistencia.sql#L42 "SET @Error = (SELECT @MensajeError AS mensaje")

### ¿Un cliente puede pasar otro `IDUsuario` al SP?

No: `@IDUsuarioActor` lo agrega `ejecutarSP` desde el token, y si un repositorio intenta pasarlo a mano, `ejecutarSP` lanza.
**Muéstralo en:** [ejecutar-sp.ts:104](../../../apps/api/src/shared/db/ejecutar-sp.ts#L104 "lo agrega ejecutarSP desde el contexto; no se pasa a mano")

### ¿Por qué no usan `FLOAT` ni `MONEY`?

`FLOAT` no representa exactamente los centavos y `MONEY` redondea en multiplicaciones y divisiones. Montos en `DECIMAL(12,2)`; una prueba prohíbe esos tipos en todos los scripts.
**Muéstralo en:** [penalizaciones.test.ts:130](../../../database/migrator/test/penalizaciones.test.ts#L130 "ningún FLOAT, REAL, MONEY, DATETIME, TEXT, NTEXT ni IMAGE")
