-- N-14: borrado físico de una categoría sin productos (activos o no) y que ningún cupón ni pedido usa
-- (50209: los pedidos copian la categoría y los cupones la filtran). Mismo orden de bloqueo que
-- SP_Catalogo_CambiarEstadoCategoria: la categoría y después el rango de sus productos, así nadie crea
-- un producto en ella mientras se borra. Las FKs son la última defensa y se traducen por su nombre.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_EliminarCategoria
    @IDCategoria    INT,
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

        IF NOT EXISTS (SELECT 1 FROM dbo.Categoria WITH (UPDLOCK, ROWLOCK) WHERE IDCategoria = @IDCategoria)
            THROW 50001, N'La categoría no existe.', 1;

        IF EXISTS (SELECT 1 FROM dbo.Producto WITH (UPDLOCK, HOLDLOCK) WHERE IDCategoria = @IDCategoria)
            THROW 50204, N'La categoría tiene productos: solo se puede desactivar.', 1;
        IF EXISTS (SELECT 1 FROM dbo.Cupon WHERE IDCategoria = @IDCategoria)
           OR EXISTS (SELECT 1 FROM dbo.DetallePedido WHERE IDCategoria = @IDCategoria)
            THROW 50209, N'La categoría está en cupones o en pedidos: solo se puede desactivar.', 1;

        DELETE FROM dbo.Categoria WHERE IDCategoria = @IDCategoria;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        IF ERROR_NUMBER() = 547 AND ERROR_MESSAGE() LIKE N'%FK_Producto_Categoria%'
            THROW 50204, N'La categoría tiene productos: solo se puede desactivar.', 1;
        IF ERROR_NUMBER() = 547 AND (ERROR_MESSAGE() LIKE N'%FK_Cupon_Categoria%'
                                     OR ERROR_MESSAGE() LIKE N'%FK_DetallePedido_Categoria%')
            THROW 50209, N'La categoría está en cupones o en pedidos: solo se puede desactivar.', 1;
        THROW;
    END CATCH
END
GO
