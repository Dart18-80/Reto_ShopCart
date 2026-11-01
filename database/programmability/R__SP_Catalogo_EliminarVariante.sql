-- N-14: borrado físico de una variante sin historial, con sus líneas de carrito, sus valores y sus precios
-- en la misma transacción. Con ventas, kardex, reservas o checkout responde 50203: la prevalidación da el
-- mensaje y la autoridad son las FKs de esas tablas (547, traducido a 50203). Si era la última variante,
-- el conjunto de atributos del producto queda libre. Orden de bloqueo (01 §6.6): el producto y después
-- la variante.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_EliminarVariante
    @IDVariante     INT,
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

        DECLARE @Bloqueado INT, @Existe INT;
        SELECT @Bloqueado = p.IDProducto FROM dbo.Producto AS p WITH (UPDLOCK, ROWLOCK)
        WHERE  p.IDProducto = @IDProducto;
        SELECT @Existe = v.IDVariante FROM dbo.Variante AS v WITH (UPDLOCK, ROWLOCK)
        WHERE  v.IDVariante = @IDVariante;

        IF @Existe IS NULL
            THROW 50001, N'La variante no existe.', 1;
        IF (SELECT h.TieneHistorial FROM dbo.FU_Catalogo_HistorialVariante(@IDVariante) AS h) = 1
            THROW 50203, N'La variante tiene ventas, movimientos o reservas: solo se puede desactivar.', 1;

        DELETE FROM dbo.LineaCarrito          WHERE IDVariante = @IDVariante;
        DELETE FROM dbo.VarianteValorAtributo WHERE IDVariante = @IDVariante;
        DELETE FROM dbo.PrecioVariante        WHERE IDVariante = @IDVariante;
        DELETE FROM dbo.Variante              WHERE IDVariante = @IDVariante;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        -- Las FKs de DetallePedido, MovimientoKardex, Reserva y LineaSesionCheckout son la autoridad.
        IF ERROR_NUMBER() = 547
            THROW 50203, N'La variante tiene ventas, movimientos o reservas: solo se puede desactivar.', 1;
        THROW;
    END CATCH
END
GO
