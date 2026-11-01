-- N-14: borrado físico de una categoría sin productos (activos o no). Mismo orden de bloqueo que
-- SP_Catalogo_CambiarEstadoCategoria: la categoría y después el rango de sus productos, así nadie crea
-- un producto en ella mientras se borra. La FK de Producto es la última defensa.
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

        DELETE FROM dbo.Categoria WHERE IDCategoria = @IDCategoria;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
