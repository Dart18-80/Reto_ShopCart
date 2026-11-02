-- RF-05, N-12: aplica un cupón al carrito de quien pide (resuelto como en SP_Carrito_Obtener) como vista
-- previa: el uso se reserva al iniciar el pago (E5). Cada causa de rechazo responde su propio código
-- (FU_Cupones_Validar); el mínimo no alcanzado trae lo que falta en los detalles (A-19, monto como texto).
-- Un cupón nuevo reemplaza al anterior. Sin carrito o sin líneas: 50403. Devuelve el carrito completo.
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_AplicarCupon
    @Codigo            VARCHAR(30),
    @HashTokenInvitado BINARY(32)       = NULL,
    @IDUsuarioActor    INT              = NULL,
    @RolActor          VARCHAR(20)      = NULL,
    @RequestId         UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    DECLARE @IDCliente      INT        = CASE WHEN @RolActor = 'Cliente' THEN @IDUsuarioActor END;
    DECLARE @HashDelCarrito BINARY(32) = CASE WHEN @IDCliente IS NULL THEN @HashTokenInvitado END;
    DECLARE @IDCarrito INT, @IDCupon INT, @NumeroError INT, @Mensaje NVARCHAR(200), @Faltante DECIMAL(15,2),
            @Error NVARCHAR(2048);

    BEGIN TRY
        BEGIN TRAN;

        EXEC dbo.SP_Carrito_BloquearActivo @IDCliente, @HashDelCarrito, @IDCarrito OUTPUT;

        IF @IDCarrito IS NULL
           OR NOT EXISTS (SELECT 1 FROM dbo.LineaCarrito AS l WHERE l.IDCarrito = @IDCarrito)
            THROW 50403, N'Tu carrito está vacío: agrega productos antes de aplicar un cupón.', 1;

        -- El código es único sin distinguir mayúsculas (UQ_Cupon_Codigo con la collation CI).
        SET @IDCupon = (SELECT c.IDCupon FROM dbo.Cupon AS c WHERE c.Codigo = UPPER(LTRIM(RTRIM(@Codigo))));

        SELECT @NumeroError = v.NumeroError, @Mensaje = v.Mensaje, @Faltante = v.Faltante
        FROM   dbo.FU_Cupones_Validar(@IDCupon, @IDCliente, @IDCarrito) AS v;

        IF @NumeroError = 50507
        BEGIN
            SET @Error = (SELECT @Mensaje AS mensaje,
                                 JSON_QUERY((SELECT CONVERT(VARCHAR(20), @Faltante) AS faltante
                                             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)) AS detalles
                          FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
            THROW 50507, @Error, 1;
        END
        IF @NumeroError IS NOT NULL
            THROW @NumeroError, @Mensaje, 1;

        UPDATE dbo.Carrito
        SET    IDCupon = @IDCupon, FechaUltimaActividad = SYSUTCDATETIME()
        WHERE  IDCarrito = @IDCarrito;

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
