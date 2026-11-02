-- RF-04, N-05, N-06: agrega una variante al carrito de quien pide, o suma la cantidad si ya está.
-- Cliente (@RolActor = 'Cliente'): su carrito Activo, que se crea si no existe; la cookie se ignora.
-- Invitado: con @HashTokenNuevo crea su carrito con ese hash; con @HashTokenInvitado usa el Activo. Si esa
-- cookie no tiene carrito Activo, no cambia nada ni devuelve conjuntos: la API crea otro con un token nuevo
-- (nunca adopta un token elegido por el cliente).
-- Bajo el bloqueo del carrito (01 §6.6) se validan la existencia y el límite de líneas: dos altas
-- simultáneas no los rebasan. Si la suma pasa de lo disponible, 50301 con el disponible y nada cambia.
-- Devuelve el carrito completo (SP_Carrito_Obtener).
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_AgregarLinea
    @IDVariante        INT,
    @Cantidad          INT,
    @HashTokenInvitado BINARY(32)       = NULL,
    @HashTokenNuevo    BINARY(32)       = NULL,
    @IDUsuarioActor    INT              = NULL,
    @RolActor          VARCHAR(20)      = NULL,
    @RequestId         UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF @Cantidad IS NULL OR @Cantidad <= 0
        THROW 50003, N'La cantidad debe ser mayor que cero.', 1;

    DECLARE @IDCliente      INT        = CASE WHEN @RolActor = 'Cliente' THEN @IDUsuarioActor END;
    DECLARE @HashDelCarrito BINARY(32) = CASE WHEN @IDCliente IS NULL
                                              THEN COALESCE(@HashTokenNuevo, @HashTokenInvitado) END;

    -- Un invitado sin cookie ni token nuevo no tiene carrito al cual agregar.
    IF @IDCliente IS NULL AND @HashDelCarrito IS NULL
        RETURN;

    DECLARE @IDCarrito INT, @IDPrecioVariante INT, @Disponible INT, @EnCarrito INT,
            @MaxLineas SMALLINT, @DiasGarantia SMALLINT, @Error NVARCHAR(2048);

    BEGIN TRY
        BEGIN TRAN;

        IF @IDCliente IS NULL AND @HashTokenNuevo IS NOT NULL
        BEGIN
            -- N-05: creación perezosa, con el primer producto.
            INSERT INTO dbo.Carrito (HashTokenInvitado, Estado) VALUES (@HashTokenNuevo, 'Activo');
            SET @IDCarrito = SCOPE_IDENTITY();
        END
        ELSE
            EXEC dbo.SP_Carrito_BloquearActivo @IDCliente, @HashDelCarrito, @IDCarrito OUTPUT;

        IF @IDCarrito IS NULL AND @IDCliente IS NULL
        BEGIN
            COMMIT;
            RETURN;
        END

        IF @IDCarrito IS NULL
        BEGIN
            INSERT INTO dbo.Carrito (IDUsuario, Estado) VALUES (@IDCliente, 'Activo');
            SET @IDCarrito = SCOPE_IDENTITY();
        END

        -- 01 §6.6: después del carrito, la variante.
        IF NOT EXISTS (SELECT 1
                       FROM   dbo.Variante AS v WITH (UPDLOCK, ROWLOCK)
                       JOIN   dbo.Producto AS p ON p.IDProducto = v.IDProducto
                       WHERE  v.IDVariante = @IDVariante AND v.Activo = 1 AND p.Activo = 1)
            THROW 50001, N'El producto no existe o ya no está disponible.', 1;

        SELECT @IDPrecioVariante = pv.IDPrecioVariante FROM dbo.FU_Catalogo_PrecioVigente(@IDVariante) AS pv;
        IF @IDPrecioVariante IS NULL
            THROW 50001, N'El producto no existe o ya no está disponible.', 1;

        SELECT @Disponible = d.Disponible FROM dbo.FU_Carrito_Disponible(@IDCarrito, @IDVariante) AS d;
        SELECT @EnCarrito = l.Cantidad
        FROM   dbo.LineaCarrito AS l
        WHERE  l.IDCarrito = @IDCarrito AND l.IDVariante = @IDVariante;

        -- N-06: la suma se valida completa; nunca se ajusta a lo disponible.
        IF CONVERT(BIGINT, COALESCE(@EnCarrito, 0)) + @Cantidad > @Disponible
        BEGIN
            SET @Error = (SELECT N'No hay existencia suficiente para esa cantidad.' AS mensaje,
                                 JSON_QUERY((SELECT @IDVariante AS idVariante,
                                                    IIF(@Disponible < 0, 0, @Disponible) AS disponible,
                                                    COALESCE(@EnCarrito, 0) AS enCarrito
                                             FOR JSON PATH)) AS detalles
                          FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
            THROW 50301, @Error, 1;
        END

        IF @EnCarrito IS NULL
        BEGIN
            SELECT TOP (1) @MaxLineas = ps.MaxLineasCarrito, @DiasGarantia = ps.DiasGarantiaPrecio
            FROM   dbo.ParametroSistema AS ps
            ORDER BY ps.IDParametroSistema;

            IF (SELECT COUNT(*) FROM dbo.LineaCarrito AS l WHERE l.IDCarrito = @IDCarrito) >= @MaxLineas
            BEGIN
                SET @Error = (SELECT N'El carrito alcanzó el límite de productos distintos.' AS mensaje,
                                     JSON_QUERY((SELECT @MaxLineas AS maximo
                                                 FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)) AS detalles
                              FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
                THROW 50401, @Error, 1;
            END

            -- N-02: la garantía cuenta desde que se agrega la línea.
            INSERT INTO dbo.LineaCarrito (IDCarrito, IDVariante, Cantidad, IDPrecioVarianteGarantizado,
                                          FechaGarantiaHasta)
            VALUES (@IDCarrito, @IDVariante, @Cantidad, @IDPrecioVariante,
                    DATEADD(DAY, @DiasGarantia, SYSUTCDATETIME()));
        END
        ELSE
            -- N-02: sumar conserva el precio de la línea y no renueva la garantía.
            UPDATE dbo.LineaCarrito
            SET    Cantidad = Cantidad + @Cantidad, FechaActualizacion = SYSUTCDATETIME()
            WHERE  IDCarrito = @IDCarrito AND IDVariante = @IDVariante;

        -- N-13: la actividad solo cambia cuando el carrito cambia.
        UPDATE dbo.Carrito SET FechaUltimaActividad = SYSUTCDATETIME() WHERE IDCarrito = @IDCarrito;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        -- UX_Carrito_ActivoPorUsuario es la autoridad de "un solo carrito activo por cliente". El HOLDLOCK de
        -- SP_Carrito_BloquearActivo ya serializa las primeras altas; si aun así llega la violación, se
        -- responde un conflicto, nunca un 500.
        IF ERROR_NUMBER() IN (2601, 2627) AND ERROR_MESSAGE() LIKE N'%UX_Carrito_ActivoPorUsuario%'
            THROW 50002, N'Tu carrito cambió al mismo tiempo en otra pestaña. Intenta de nuevo.', 1;
        THROW;
    END CATCH

    EXEC dbo.SP_Carrito_Obtener @HashTokenInvitado = @HashDelCarrito, @IDUsuarioActor = @IDUsuarioActor,
                                @RolActor = @RolActor, @RequestId = @RequestId;
END
GO
