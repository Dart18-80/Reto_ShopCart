-- RF-04, N-06: cambia la cantidad de una línea del carrito de quien pide (resuelto como en
-- SP_Carrito_Obtener). Una línea de otro carrito responde 404, igual que una inexistente (RF-01). Una línea
-- NoDisponible solo se puede eliminar (50402). La cantidad nueva se valida contra el disponible bajo el
-- bloqueo del carrito y de la variante (01 §6.6). Conserva el precio y la garantía de la línea (N-02).
-- Devuelve el carrito completo (SP_Carrito_Obtener).
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_ActualizarCantidad
    @IDLineaCarrito    INT,
    @Cantidad          INT,
    @HashTokenInvitado BINARY(32)       = NULL,
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
    DECLARE @HashDelCarrito BINARY(32) = CASE WHEN @IDCliente IS NULL THEN @HashTokenInvitado END;
    DECLARE @IDCarrito INT, @IDVariante INT, @EnCarrito INT, @Disponible INT, @Error NVARCHAR(2048);

    BEGIN TRY
        BEGIN TRAN;

        EXEC dbo.SP_Carrito_BloquearActivo @IDCliente, @HashDelCarrito, @IDCarrito OUTPUT;

        SELECT @IDVariante = l.IDVariante, @EnCarrito = l.Cantidad
        FROM   dbo.LineaCarrito AS l
        WHERE  l.IDLineaCarrito = @IDLineaCarrito AND l.IDCarrito = @IDCarrito;

        IF @IDVariante IS NULL
            THROW 50001, N'La línea no existe en tu carrito.', 1;

        IF NOT EXISTS (SELECT 1
                       FROM   dbo.Variante AS v WITH (UPDLOCK, ROWLOCK)
                       JOIN   dbo.Producto AS p ON p.IDProducto = v.IDProducto
                       WHERE  v.IDVariante = @IDVariante AND v.Activo = 1 AND p.Activo = 1)
            THROW 50402, N'Este producto ya no está disponible: solo puedes eliminarlo del carrito.', 1;

        SELECT @Disponible = d.Disponible FROM dbo.FU_Carrito_Disponible(@IDCarrito, @IDVariante) AS d;

        IF @Cantidad > @Disponible
        BEGIN
            SET @Error = (SELECT N'No hay existencia suficiente para esa cantidad.' AS mensaje,
                                 JSON_QUERY((SELECT @IDVariante AS idVariante,
                                                    IIF(@Disponible < 0, 0, @Disponible) AS disponible,
                                                    @EnCarrito AS enCarrito
                                             FOR JSON PATH)) AS detalles
                          FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
            THROW 50301, @Error, 1;
        END

        UPDATE dbo.LineaCarrito
        SET    Cantidad = @Cantidad, FechaActualizacion = SYSUTCDATETIME()
        WHERE  IDLineaCarrito = @IDLineaCarrito;

        UPDATE dbo.Carrito SET FechaUltimaActividad = SYSUTCDATETIME() WHERE IDCarrito = @IDCarrito;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    EXEC dbo.SP_Carrito_Obtener @HashTokenInvitado = @HashDelCarrito, @IDUsuarioActor = @IDUsuarioActor,
                                @RolActor = @RolActor, @RequestId = @RequestId;
END
GO
