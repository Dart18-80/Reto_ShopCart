-- N-14: borrado físico de un producto sin historial: borra en la misma transacción sus líneas de carrito,
-- los valores y precios de sus variantes, sus variantes y sus imágenes. Con ventas, kardex, reservas o
-- checkout en alguna variante responde 50203: la prevalidación da el mensaje y la autoridad son las FKs
-- de esas tablas (547, traducido a 50203). Orden de bloqueo (01 §6.6): el producto y después sus
-- variantes en orden de IDVariante.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_EliminarProducto
    @IDProducto     INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    BEGIN TRY
        BEGIN TRAN;

        IF NOT EXISTS (SELECT 1 FROM dbo.Producto WITH (UPDLOCK, ROWLOCK) WHERE IDProducto = @IDProducto)
            THROW 50001, N'El producto no existe.', 1;

        -- sqlserver-sp §9.1: un ciclo explícito garantiza el orden de IDVariante.
        DECLARE @ID INT = (SELECT MIN(IDVariante) FROM dbo.Variante WHERE IDProducto = @IDProducto),
                @Bloqueada INT;
        WHILE @ID IS NOT NULL
        BEGIN
            SELECT @Bloqueada = v.IDVariante FROM dbo.Variante AS v WITH (UPDLOCK, ROWLOCK)
            WHERE  v.IDVariante = @ID;
            SELECT @ID = MIN(IDVariante) FROM dbo.Variante WHERE IDProducto = @IDProducto AND IDVariante > @ID;
        END

        IF EXISTS (SELECT 1 FROM dbo.Variante AS v
                   CROSS APPLY dbo.FU_Catalogo_HistorialVariante(v.IDVariante) AS h
                   WHERE v.IDProducto = @IDProducto AND h.TieneHistorial = 1)
            THROW 50203, N'El producto tiene ventas, movimientos o reservas: solo se puede desactivar.', 1;

        DELETE lc FROM dbo.LineaCarrito AS lc
        JOIN   dbo.Variante AS v ON v.IDVariante = lc.IDVariante
        WHERE  v.IDProducto = @IDProducto;

        DELETE vva FROM dbo.VarianteValorAtributo AS vva
        JOIN   dbo.Variante AS v ON v.IDVariante = vva.IDVariante
        WHERE  v.IDProducto = @IDProducto;

        DELETE pv FROM dbo.PrecioVariante AS pv
        JOIN   dbo.Variante AS v ON v.IDVariante = pv.IDVariante
        WHERE  v.IDProducto = @IDProducto;

        DELETE FROM dbo.Variante       WHERE IDProducto = @IDProducto;
        DELETE FROM dbo.ImagenProducto WHERE IDProducto = @IDProducto;
        DELETE FROM dbo.Producto       WHERE IDProducto = @IDProducto;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        -- Las FKs de DetallePedido, MovimientoKardex, Reserva y LineaSesionCheckout son la autoridad.
        IF ERROR_NUMBER() = 547
            THROW 50203, N'El producto tiene ventas, movimientos o reservas: solo se puede desactivar.', 1;
        THROW;
    END CATCH
END
GO
