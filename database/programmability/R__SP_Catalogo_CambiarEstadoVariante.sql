-- N-14: activa o desactiva una variante (una inactiva no se muestra en la tienda; con historial es la
-- única salida). Orden de bloqueo (01 §6.6): el producto y después la variante. Devuelve el producto.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_CambiarEstadoVariante
    @IDVariante     INT,
    @Activo         BIT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    DECLARE @IDProducto INT = (SELECT IDProducto FROM dbo.Variante WHERE IDVariante = @IDVariante);
    IF @IDProducto IS NULL
        THROW 50001, N'La variante no existe.', 1;

    BEGIN TRY
        BEGIN TRAN;

        DECLARE @Bloqueado INT, @ActivoActual BIT;
        SELECT @Bloqueado = p.IDProducto FROM dbo.Producto AS p WITH (UPDLOCK, ROWLOCK)
        WHERE  p.IDProducto = @IDProducto;
        SELECT @ActivoActual = v.Activo FROM dbo.Variante AS v WITH (UPDLOCK, ROWLOCK)
        WHERE  v.IDVariante = @IDVariante;

        IF @ActivoActual IS NULL
            THROW 50001, N'La variante no existe.', 1;

        IF @ActivoActual <> @Activo
            UPDATE dbo.Variante
            SET    Activo = @Activo, FechaActualizacion = SYSUTCDATETIME()
            WHERE  IDVariante = @IDVariante;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    EXEC dbo.SP_Catalogo_ObtenerProductoAdmin @IDProducto = @IDProducto;
END
GO
