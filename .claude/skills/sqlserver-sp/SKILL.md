---
name: sqlserver-sp
description: Plantillas y reglas para escribir cualquier script de SQL Server de ShopCart (stored procedures, vistas, funciones, triggers, migraciones V###, programabilidad R__ y semillas S###). Úsala siempre que crees o modifiques un archivo dentro de database/.
---

# SQL Server en ShopCart

Esta skill concreta las decisiones de `docs/02-modelo-datos.md` y `docs/01-arquitectura.md`. Si algo aquí contradice esos documentos, **mandan los documentos** y debes avisar a Diego.

## 1. Dónde va cada script

| Carpeta | Archivo | Contenido | Reglas |
|---|---|---|---|
| `database/migrations/` | `V###__descripcion.sql` | Tablas, constraints, índices, datos estructurales | Se aplica una sola vez. **Nunca edites un `V###` ya aplicado**: crea el siguiente número |
| `database/programmability/` | `R__<NombreObjeto>.sql` | Un SP, vista, función o trigger por archivo | `CREATE OR ALTER`. Se reaplica cuando cambia su checksum |
| `database/seeds/` | `S###__descripcion.sql` | Datos semilla | Se aplica una sola vez; idempotente cuando sea posible (`IF NOT EXISTS`) |

- Codificación UTF-8 con finales de línea LF (lo fuerza `.gitattributes`).
- Separa lotes con `GO` en una línea propia.
- Siempre con esquema: `dbo.Pedido`, `dbo.SP_Pedidos_CrearPedido`.
- **Orden de los `R__`:** el migrador los aplica por tipo (`FU_` → `VW_` → `SP_` → `TR_`) y, dentro de cada tipo, en orden alfabético. Si un objeto depende de otro **del mismo tipo**, declara la dependencia en la primera línea del archivo: `-- depende-de: R__FU_Catalogo_PrecioVigente.sql`.

## 2. Nomenclatura

| Objeto | Formato | Ejemplo |
|---|---|---|
| Stored procedure | `SP_Modulo_Proceso` | `SP_Checkout_IniciarSesion` |
| Vista | `VW_Modulo_Proceso` | `VW_Dashboard_HechosVenta` |
| Función tipo tabla | `FU_Modulo_Proceso` | `FU_Inventario_Disponible` |
| Trigger | `TR_Modulo_Proceso` | `TR_Pedidos_ValidarTransicion` |
| PK autoincrementable | `ID` + tabla | `IDPedido` |
| Constraints | `PK_Tabla`, `FK_Tabla_Referida`, `UQ_Tabla_Columnas`, `CK_Tabla_Regla`, `DF_Tabla_Columna` | `CK_Variante_ExistenciaNoNegativa` |
| Índices | `IX_Tabla_Columnas`; únicos filtrados `UX_Tabla_Regla` | `UX_Carrito_ActivoPorUsuario` |

Nombra **todas** las constraints e índices. Nunca dejes que SQL Server genere el nombre.

## 3. Tipos

| Dato | Tipo |
|---|---|
| Montos | `DECIMAL(12,2)` |
| Porcentajes | `DECIMAL(5,2)` |
| Cantidades | `INT` |
| PK maestras / alto volumen | `INT IDENTITY(1,1)` / `BIGINT IDENTITY(1,1)` |
| Fecha y hora | `DATETIME2(3)` en UTC con `SYSUTCDATETIME()` |
| Fecha local de Guatemala | `DATE`: `CONVERT(DATE, SWITCHOFFSET(SYSDATETIMEOFFSET(), '-06:00'))` (Guatemala no tiene horario de verano) |
| Texto visible / códigos técnicos | `NVARCHAR(n)` / `VARCHAR(n)` |
| Hashes / idempotencia / JSON | `BINARY(32)` / `UNIQUEIDENTIFIER` / `NVARCHAR(MAX)` con `CHECK (ISJSON(col) = 1)` |

**Prohibidos:** `FLOAT`, `REAL`, `MONEY`, `DATETIME`, `TEXT`, `NTEXT`.

**Montos que devuelve un SP (A-21):** se devuelven como `DECIMAL`, nunca convertidos a texto en la base (la API los convierte con `aMonto`). **Todo agregado de montos (`SUM`, `AVG`) se convierte a `DECIMAL(15,2)`** antes de devolverlo: `CONVERT(DECIMAL(15,2), SUM(p.Total))`. `AVG` de un `DECIMAL(12,2)` devuelve `DECIMAL(38,6)` y una suma puede crecer sin límite; con `DECIMAL(15,2)` un desborde hace fallar al SP en lugar de perder precisión en la API.

## 4. Parámetros estándar y contexto (A-18)

`ejecutarSP` agrega **siempre** estos tres parámetros, con los valores del token y de la petición. **Todo SP invocado desde la API los declara**, aunque no los use:

```sql
@IDUsuarioActor INT              = NULL,  -- quien hace la petición (NULL = anónimo o job)
@RolActor       VARCHAR(20)      = NULL,  -- 'Cliente' | 'Operador' | 'Administrador'
@RequestId      UNIQUEIDENTIFIER = NULL
```

- **Los recursos "propios" del cliente se filtran con `@IDUsuarioActor`**, nunca con un ID que llegue de la petición. Así es imposible que un cliente lea los datos de otro cambiando un parámetro (RF-01). Los filtros de administración usan un parámetro aparte (`@IDClienteFiltro`).
- **Todo SP que escribe** establece el contexto como primera instrucción, para que los triggers (bitácora y transiciones) sepan quién actúa:

```sql
EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;
```

`SP_Sistema_EstablecerContexto` llama a `sys.sp_set_session_context` para `IDUsuario`, `Rol` y `RequestId`. Se establece **en cada llamada** porque las conexiones del pool se reutilizan y el contexto anterior seguiría ahí. Los triggers lo leen con `SESSION_CONTEXT(N'IDUsuario')`.

## 5. Plantilla: SP de lectura con paginación

```sql
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_ListarPropios
    @Pagina         INT              = 1,
    @Tamano         INT              = 20,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @Pagina < 1 OR @Tamano NOT BETWEEN 1 AND 100
        THROW 50003, N'Los parámetros de paginación no son válidos.', 1;

    -- Conjunto 1: la página.
    SELECT  p.IDPedido,
            p.NumeroPedido,
            e.Codigo        AS Estado,
            p.Total,
            p.FechaPago
    FROM    dbo.Pedido       AS p
    JOIN    dbo.EstadoPedido AS e ON e.IDEstadoPedido = p.IDEstadoPedido
    WHERE   p.IDUsuario = @IDUsuarioActor        -- RF-01: solo lo propio
    ORDER BY p.FechaPago DESC, p.IDPedido DESC   -- siempre un desempate único
    OFFSET (@Pagina - 1) * @Tamano ROWS
    FETCH NEXT @Tamano ROWS ONLY;

    -- Conjunto 2: el total del filtro, con los mismos filtros.
    SELECT COUNT(*) AS Total
    FROM   dbo.Pedido AS p
    WHERE  p.IDUsuario = @IDUsuarioActor;
END
GO
```

- **El total va en su propio conjunto**, nunca como `COUNT(*) OVER ()` en la página: si la página pedida
  queda vacía (una página posterior a la última), `COUNT(*) OVER ()` no devuelve filas y el total se
  perdería. En la API, `ejecutarSPPaginado` lee los dos conjuntos.
- En SQL dinámico, el `FROM` y el `WHERE` se arman una vez y los usan las dos consultas.

- Nunca `SELECT *`: lista las columnas.
- **Nunca `WITH (NOLOCK)`**: la base usa `READ_COMMITTED_SNAPSHOT`, así que las lecturas no se bloquean y no hace falta leer datos sin confirmar.
- Cada filtro y cada orden debe tener un índice que lo soporte (RNF-1). Si agregas un filtro nuevo, revisa los índices en `02-modelo-datos.md` y, si falta uno, pregunta antes de crearlo.

## 6. Plantilla: SP de escritura

```sql
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_RegistrarAjuste
    @IDVariante     INT,
    @Cantidad       INT,              -- positiva o negativa
    @Motivo         NVARCHAR(250),
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;                -- cualquier error revierte toda la transacción

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    -- 1. Validaciones que no necesitan datos bloqueados
    IF NULLIF(LTRIM(RTRIM(@Motivo)), N'') IS NULL
        THROW 50304, N'El ajuste requiere un motivo.', 1;
    IF @Cantidad = 0
        THROW 50003, N'La cantidad del ajuste no puede ser cero.', 1;

    BEGIN TRY
        BEGIN TRAN;

        -- 2. Bloquear las filas en disputa y revalidar bajo bloqueo (el SP es la autoridad, A-02)
        DECLARE @Fisica INT, @Reservado INT;

        SELECT @Fisica = v.ExistenciaFisica
        FROM   dbo.Variante AS v WITH (UPDLOCK, ROWLOCK)
        WHERE  v.IDVariante = @IDVariante;

        IF @Fisica IS NULL
            THROW 50001, N'La variante no existe.', 1;

        SELECT @Reservado = d.Reservado FROM dbo.FU_Inventario_Disponible(@IDVariante) AS d;

        IF @Fisica + @Cantidad < 0
            THROW 50302, N'El ajuste dejaría la existencia en negativo.', 1;
        IF @Fisica + @Cantidad < @Reservado
            THROW 50303, N'Hay unidades reservadas en pagos en curso.', 1;

        -- 3. Escribir (siempre a través del SP interno dueño de la regla)
        DECLARE @Tipo VARCHAR(30) = CASE WHEN @Cantidad > 0 THEN 'AjustePositivo' ELSE 'AjusteNegativo' END,
                @Absoluta INT = ABS(@Cantidad);

        EXEC dbo.SP_Inventario_RegistrarMovimiento
             @IDVariante = @IDVariante, @CodigoTipo = @Tipo, @Cantidad = @Absoluta,
             @Motivo = @Motivo, @Referencia = NULL, @IDPedido = NULL, @IDDevolucion = NULL;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;                         -- relanza el error original con su número
    END CATCH

    -- 4. Devolver el resultado
    SELECT v.IDVariante, v.ExistenciaFisica
    FROM   dbo.Variante AS v
    WHERE  v.IDVariante = @IDVariante;
END
GO
```

## 7. SPs internos (invocados solo por otros SPs)

Ejemplos: `SP_Inventario_RegistrarMovimiento`, `SP_Inventario_ReservarExistencia`, `SP_Cupones_ReservarUso`.

- **No abren ni confirman transacciones propias.** Exigen la del llamador y fallan si no existe:

```sql
IF @@TRANCOUNT = 0
    THROW 50003, N'SP_Inventario_RegistrarMovimiento debe ejecutarse dentro de una transacción.', 1;
```

- No declaran los parámetros estándar: el contexto ya lo estableció el SP que los llama.
- La API **nunca** los invoca directamente.

> Por qué: una transacción anidada que hace `ROLLBACK` revierte también la del llamador, y el `COMMIT` posterior falla. Con una sola transacción, controlada por el SP de entrada, el comportamiento es predecible.

## 8. Errores de negocio (A-06, A-19)

```sql
THROW 50505, N'El cupón ya alcanzó su límite de usos.', 1;
```

- **El número sale del rango del módulo** (`02-modelo-datos.md` §8). Cada código nuevo se agrega en el mismo commit a `apps/api/src/shared/errors/catalogo.ts`, con su código estable y su HTTP.
- **El mensaje es para el usuario final**: en español, claro y sin detalles técnicos.
- **Cuando hacen falta detalles estructurados**, el mensaje es un JSON con `mensaje` y `detalles`. `ejecutarSP` lo detecta (empieza con `{`) y lo convierte en el campo `detalles` de la respuesta. El límite de `THROW` es de 2,048 caracteres.

```sql
DECLARE @Error NVARCHAR(2048) =
(
    SELECT N'No hay existencia suficiente para algunos productos.' AS mensaje,
           JSON_QUERY((SELECT l.IDVariante AS idVariante, d.Disponible AS disponible
                       FROM @Lineas AS l
                       CROSS APPLY dbo.FU_Inventario_Disponible(l.IDVariante) AS d
                       WHERE d.Disponible < l.Cantidad
                       FOR JSON PATH)) AS detalles
    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
);
THROW 50301, @Error, 1;
```

## 9. Patrones de concurrencia

### 9.0 Orden global de bloqueo en el catálogo (01 §6.6)

**Categoría → producto → variantes en orden de `IDVariante`**, siempre con `UPDLOCK`. Un SP que toca un producto bloquea antes la fila de su categoría aunque no la modifique; un SP que crea o edita una variante bloquea antes la fila del producto. Saltarse un nivel o invertirlo produce deadlocks con los SPs de los otros niveles.

### 9.1 Bloquear varias variantes siempre en el mismo orden

Evita deadlocks entre dos carritos que comparten variantes. Un ciclo explícito garantiza el orden, cosa que un `SELECT ... ORDER BY` no promete.

```sql
DECLARE @Lineas TABLE (IDVariante INT PRIMARY KEY, Cantidad INT NOT NULL);
-- ... llenar @Lineas ...

DECLARE @ID INT = (SELECT MIN(IDVariante) FROM @Lineas), @Bloqueada INT;
WHILE @ID IS NOT NULL
BEGIN
    SELECT @Bloqueada = v.IDVariante
    FROM   dbo.Variante AS v WITH (UPDLOCK, ROWLOCK)
    WHERE  v.IDVariante = @ID;

    SELECT @ID = MIN(IDVariante) FROM @Lineas WHERE IDVariante > @ID;
END

-- Con todas las variantes bloqueadas, la validación es estable: cualquier otro proceso
-- que quiera reservar o vender estas variantes está esperando el mismo bloqueo.
IF EXISTS (SELECT 1
           FROM @Lineas AS l
           CROSS APPLY dbo.FU_Inventario_Disponible(l.IDVariante) AS d
           WHERE d.Disponible < l.Cantidad)
    THROW 50301, @Error, 1;           -- todo o nada (N-06)
```

**Regla:** todo proceso que crea reservas o vende una variante toma primero el `UPDLOCK` de la fila de `Variante`. Liberar reservas no necesita el bloqueo, porque solo aumenta el disponible.

### 9.2 Contador con `CHECK` (A-13)

Una sola sentencia atómica. Si afecta cero filas, el límite ya se alcanzó.

```sql
UPDATE dbo.Cupon
SET    UsosComprometidos = UsosComprometidos + 1
WHERE  IDCupon = @IDCupon
  AND  UsosComprometidos < LimiteUsosTotal;

IF @@ROWCOUNT = 0
    THROW 50505, N'El cupón ya alcanzó su límite de usos.', 1;
```

El `CHECK (UsosComprometidos BETWEEN 0 AND LimiteUsosTotal)` es la última defensa si alguna vez falla esta lógica. Al liberar, haz `UsosComprometidos - 1` en la misma transacción que cambia el estado de `UsoCupon`.

Cuando además hay una regla por cliente (límite de usos por cliente), bloquea primero la fila del cupón con `UPDLOCK` y después cuenta los usos del cliente: así dos pestañas del mismo cliente no se saltan el límite.

### 9.3 Idempotencia con `UNIQUE`

```sql
SELECT @IDExistente = ip.IDIntentoPago, @HashExistente = ip.HashSolicitud
FROM   dbo.IntentoPago AS ip WITH (UPDLOCK, HOLDLOCK)   -- bloquea también el "hueco" de la llave
WHERE  ip.LlaveIdempotencia = @LlaveIdempotencia;

IF @IDExistente IS NOT NULL
BEGIN
    IF @HashExistente <> @HashSolicitud
        THROW 50603, N'La llave de idempotencia ya se usó con otra solicitud.', 1;
    -- misma solicitud: devolver el resultado guardado, sin repetir efectos
END
ELSE
    INSERT INTO dbo.IntentoPago (...) VALUES (...);  -- el UNIQUE es la última defensa
```

### 9.4 Concurrencia optimista en cambios de estado

```sql
UPDATE dbo.Pedido
SET    IDEstadoPedido = @IDEstadoNuevo
WHERE  IDPedido = @IDPedido
  AND  IDEstadoPedido = @IDEstadoEsperado;

IF @@ROWCOUNT = 0
    THROW 50002, N'El pedido cambió de estado. Recarga para ver el estado actual.', 1;
```

### 9.5 PATCH: la mezcla se hace en el SP, bajo bloqueo

Un PATCH nunca lee en la API y escribe los valores finales: dos PATCH simultáneos que tocan campos
distintos se pisarían (gana el último). El SP recibe solo lo que llegó y mezcla en el mismo `UPDATE`, que
corre con la fila bloqueada:

- **Campo obligatorio:** `NULL` significa "sin cambio" → `Col = COALESCE(@Col, Col)`.
- **Campo opcional que se puede vaciar:** un parámetro explícito `@Quitar<Col> BIT = 0` →
  `Col = CASE WHEN @QuitarCol = 1 THEN NULL ELSE COALESCE(@Col, Col) END`. Enviar el valor y `@Quitar = 1`
  a la vez es un error `50003`.
- **Banderas con efectos** (por ejemplo, la dirección predeterminada): `NULL` no las toca; el efecto
  (desmarcar la anterior) solo corre si el PATCH las incluye.
- Las validaciones de un campo (existencia de una FK, formato) solo corren si el campo llegó.
- En la API, el repositorio traduce el cuerpo del PATCH: un campo ausente va en `NULL` y un `null` explícito
  en un campo opcional enciende su `@Quitar…`. El servicio no lee antes de escribir.

```sql
UPDATE dbo.Direccion
SET    Alias          = CASE WHEN @QuitarAlias = 1 THEN NULL ELSE COALESCE(@Alias, Alias) END,
       NombreRecibe   = COALESCE(@NombreRecibe, NombreRecibe),
       EsPredeterminada = COALESCE(@EsPredeterminada, EsPredeterminada),
       FechaActualizacion = SYSUTCDATETIME()
WHERE  IDDireccion = @IDDireccion AND IDUsuario = @IDUsuarioActor;   -- RF-01: el dueño, en el mismo UPDATE
```

Referencias: `SP_Usuarios_ActualizarPerfil`, `SP_Direcciones_Actualizar`, `SP_Usuarios_Actualizar`.

### 9.6 Listas hacia un SP: JSON con `OPENJSON ... WITH` (A-22)

Una lista llega en un parámetro `NVARCHAR(MAX)` con JSON. Nunca TVP ni texto separado por comas.

```sql
IF ISJSON(@Valores) <> 1
    THROW 50003, N'La lista de valores no es válida.', 1;

DECLARE @Lista TABLE (IDValorAtributo INT NOT NULL PRIMARY KEY);
INSERT INTO @Lista (IDValorAtributo)
SELECT DISTINCT j.IDValorAtributo
FROM   OPENJSON(@Valores) WITH (IDValorAtributo INT '$') AS j;      -- WITH tipado: nada se concatena

IF (SELECT COUNT(*) FROM OPENJSON(@Valores)) <> (SELECT COUNT(*) FROM @Lista)
    THROW 50003, N'La lista tiene valores repetidos.', 1;     -- DISTINCT los habría ocultado
IF EXISTS (SELECT 1 FROM @Lista AS l
           LEFT JOIN dbo.ValorAtributo AS v ON v.IDValorAtributo = l.IDValorAtributo
           WHERE v.IDValorAtributo IS NULL)
    THROW 50003, N'Un valor no existe.', 1;                          -- pertenencia: el SP la valida
```

- El SP valida él mismo los duplicados, la existencia y la pertenencia; la constraint de la base sigue
  siendo la última defensa.
- En la API, Zod limita antes el tamaño del arreglo (`.max(n)`) y el repositorio envía
  `JSON.stringify(lista)` como `sql.NVarChar(sql.MAX)`.

### 9.7 Tareas periódicas con `sp_getapplock` (A-04)

```sql
BEGIN TRY
    BEGIN TRAN;

    DECLARE @Resultado INT;
    EXEC @Resultado = sys.sp_getapplock
         @Resource    = N'Job_Checkout_ExpirarSesiones',
         @LockMode    = N'Exclusive',
         @LockOwner   = N'Transaction',   -- se libera solo con el COMMIT o el ROLLBACK
         @LockTimeout = 0;                -- si otra réplica lo tiene, no esperar

    IF @Resultado < 0
    BEGIN
        ROLLBACK;
        RETURN;                           -- otra réplica ya está ejecutando esta tarea
    END

    -- ... trabajo idempotente: volver a ejecutarlo no debe cambiar nada ...

    COMMIT;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    THROW;
END CATCH
```

Los deadlocks (error 1205) los reintenta `ejecutarSP`. El SP no necesita hacer nada especial, porque `XACT_ABORT` ya revirtió todo.

## 10. Reglas de inventario

- **`SP_Inventario_RegistrarMovimiento` es el único que modifica `Variante.ExistenciaFisica` y escribe en `MovimientoKardex`.** Calcula `ExistenciaAnterior` y `ExistenciaResultante` y respeta el signo del tipo de movimiento.
- El disponible se calcula **siempre** con `FU_Inventario_Disponible`. Nunca repitas la fórmula: así las reservas vencidas se ignoran igual en todos lados.
- Después de cualquier cambio de inventario en una prueba, `VW_Inventario_Conciliacion` debe estar vacía.

## 11. SQL dinámico seguro

Solo cuando la consulta realmente cambia según los filtros (por ejemplo, `SP_Catalogo_BuscarProductos`). **Solo se concatenan fragmentos constantes, nunca valores.**

```sql
IF @Orden NOT IN (N'relevancia', N'precio', N'nombre', N'recientes')
   OR @Direccion NOT IN (N'asc', N'desc')
    THROW 50003, N'El ordenamiento no es válido.', 1;

-- Escapar comodines del LIKE para que "%" o "_" se busquen como texto
SET @Texto = REPLACE(REPLACE(REPLACE(@Texto, N'[', N'[[]'), N'%', N'[%]'), N'_', N'[_]');

DECLARE @Sql NVARCHAR(MAX) = N'
SELECT p.IDProducto, p.Nombre, p.PrecioMinimo
FROM   dbo.VW_Catalogo_ProductosTienda AS p
WHERE  1 = 1';

IF @Texto       IS NOT NULL SET @Sql += N' AND p.NombreBusqueda LIKE N''%'' + @Texto + N''%''';  -- referencia al parámetro
IF @IDCategoria IS NOT NULL SET @Sql += N' AND p.IDCategoria = @IDCategoria';
IF @PrecioMin   IS NOT NULL SET @Sql += N' AND p.PrecioMinimo >= @PrecioMin';

SET @Sql += N'
ORDER BY
    CASE WHEN @Orden = N''precio'' AND @Direccion = N''asc''  THEN p.PrecioMinimo END ASC,
    CASE WHEN @Orden = N''precio'' AND @Direccion = N''desc'' THEN p.PrecioMinimo END DESC,
    CASE WHEN @Orden = N''nombre'' AND @Direccion = N''asc''  THEN p.Nombre END ASC,
    CASE WHEN @Orden = N''nombre'' AND @Direccion = N''desc'' THEN p.Nombre END DESC,
    -- ... un par de CASE (asc y desc) por cada valor permitido en la lista blanca ...
    p.IDProducto
OFFSET (@Pagina - 1) * @Tamano ROWS FETCH NEXT @Tamano ROWS ONLY;';

EXEC sys.sp_executesql @Sql,
     N'@Texto NVARCHAR(100), @IDCategoria INT, @PrecioMin DECIMAL(12,2),
       @Orden NVARCHAR(20), @Direccion NVARCHAR(4), @Pagina INT, @Tamano INT',
     @Texto = @Texto, @IDCategoria = @IDCategoria, @PrecioMin = @PrecioMin,
     @Orden = @Orden, @Direccion = @Direccion, @Pagina = @Pagina, @Tamano = @Tamano;
```

**Permisos del SQL dinámico (A-23):** `sp_executesql` corre con los permisos de quien llama, y
`shopcart_app` tiene `DENY SELECT`. El SP se declara `WITH EXECUTE AS '<usuario>'` con un usuario
`WITHOUT LOGIN` creado en una migración `V###`, cuyo único permiso es `SELECT` sobre la vista que lee el SQL
dinámico (otorgado al final del `R__` de esa vista). El SQL dinámico solo lee esa vista: lo que necesite una
función se calcula antes, fuera de él, y entra como parámetro. Nunca `EXECUTE AS OWNER`, `TRUSTWORTHY` ni
permisos sobre tablas.

```sql
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_BuscarProductos
    @Texto NVARCHAR(150), /* … */
    @IDUsuarioActor INT = NULL, @RolActor VARCHAR(20) = NULL, @RequestId UNIQUEIDENTIFIER = NULL
WITH EXECUTE AS 'shopcart_busqueda'
AS
```

**Prohibido:** `EXEC(@Sql)`, `EXEC (N'...' + @Valor)` y cualquier `+ @Parametro +` fuera de un literal que solo referencia al parámetro.

**Única excepción documentada:** `CREATE LOGIN ... WITH PASSWORD` no acepta parámetros. Solo en el script de arranque del migrador (`preparar-servidor.sql`), la contraseña que viene de `.env` se concatena con `QUOTENAME(@Contrasena, '''')` validando antes que no supere 128 caracteres. Esta excepción **nunca** se usa en SPs ni en ningún otro script.

## 12. Tablas ledger (M-01)

`Bitacora`, `MovimientoKardex` e `HistorialEstadoPedido`:

```sql
CREATE TABLE dbo.Bitacora
(
    IDBitacora BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Bitacora PRIMARY KEY,
    -- ...
)
WITH (LEDGER = ON (APPEND_ONLY = ON));
```

- Solo `INSERT`. Ningún SP las actualiza ni las borra; el motor lo rechaza igualmente.
- No se puede `TRUNCATE`, cambiar el tipo de una columna ni agregar columnas `NOT NULL`. Cualquier cambio de diseño se consulta con Diego antes de escribir la migración.
- En desarrollo, para empezar de cero, se recrea la base completa (`docker compose down -v`).

## 13. Triggers de bitácora (RF-09)

Una fila de bitácora por fila afectada, con el valor anterior y el nuevo en JSON. **Todo trigger de bitácora exige `Rol` en `SESSION_CONTEXT`** y falla con `50004 CONTEXTO_NO_ESTABLECIDO` si falta (A-18): un SP que escribe en una tabla auditada siempre llama antes a `SP_Sistema_EstablecerContexto`. Lista las columnas explícitamente: así **nunca** se registra un dato sensible como `HashContrasena`.

```sql
CREATE OR ALTER TRIGGER dbo.TR_Cupones_Bitacora
ON dbo.Cupon
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    -- A-18: toda escritura auditada declara quién la hace (los jobs y el migrador, Rol = 'Sistema').
    IF NOT EXISTS (SELECT 1 FROM inserted) AND NOT EXISTS (SELECT 1 FROM deleted) RETURN;
    IF SESSION_CONTEXT(N'Rol') IS NULL
        THROW 50004, N'Falta el contexto de la operación: llama a SP_Sistema_EstablecerContexto.', 1;

    DECLARE @IDUsuario INT              = TRY_CONVERT(INT, SESSION_CONTEXT(N'IDUsuario')),
            @RequestId UNIQUEIDENTIFIER = TRY_CONVERT(UNIQUEIDENTIFIER, SESSION_CONTEXT(N'RequestId'));

    INSERT INTO dbo.Bitacora (Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, IDUsuario, RequestId)
    SELECT  'Cupones', 'Cupon',
            CONVERT(VARCHAR(50), COALESCE(i.IDCupon, d.IDCupon)),
            CASE
                WHEN d.IDCupon IS NULL               THEN 'Crear'
                WHEN i.IDCupon IS NULL               THEN 'Eliminar'
                WHEN d.Activo = 1 AND i.Activo = 0   THEN 'Desactivar'
                WHEN d.Activo = 0 AND i.Activo = 1   THEN 'Activar'
                ELSE 'Modificar'
            END,
            CASE WHEN d.IDCupon IS NULL THEN NULL ELSE
                (SELECT d.Codigo, d.Tipo, d.Valor, d.FechaInicio, d.FechaFin, d.LimiteUsosTotal,
                        d.LimiteUsosPorCliente, d.Activo
                 FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
            CASE WHEN i.IDCupon IS NULL THEN NULL ELSE
                (SELECT i.Codigo, i.Tipo, i.Valor, i.FechaInicio, i.FechaFin, i.LimiteUsosTotal,
                        i.LimiteUsosPorCliente, i.Activo
                 FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
            @IDUsuario, @RequestId
    FROM    inserted AS i
    FULL OUTER JOIN deleted AS d ON d.IDCupon = i.IDCupon;
END
GO
```

- `UsosComprometidos` es un contador técnico: no lo incluyas en el JSON, o cada pago llenaría la bitácora.
- En `Pedido`, registra solo cuando cambia `IDEstadoPedido` (`WHERE i.IDEstadoPedido <> d.IDEstadoPedido`).

## 14. Checklist antes de terminar

- [ ] Nombre y ubicación del archivo correctos; ningún `V###` aplicado fue modificado.
- [ ] Nomenclatura del enunciado y nombres explícitos para constraints e índices.
- [ ] Ningún `FLOAT`, `REAL`, `MONEY`, `NOLOCK` ni `SELECT *`.
- [ ] El SP declara los parámetros estándar; si escribe, llama a `SP_Sistema_EstablecerContexto` y usa `XACT_ABORT`, `TRY/CATCH` y una sola transacción.
- [ ] Los recursos del cliente se filtran con `@IDUsuarioActor`.
- [ ] Las filas en disputa se bloquean con `UPDLOCK, ROWLOCK`, y las variantes en orden de `IDVariante`.
- [ ] Ningún valor se concatena en SQL dinámico.
- [ ] Cada `THROW` usa el rango de su módulo y está en `catalogo.ts`.
- [ ] Hay una prueba de integración por cada regla crítica, contra `shopcart_test`.
