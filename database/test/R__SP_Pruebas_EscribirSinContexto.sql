-- Solo existe en shopcart_test: limpia SESSION_CONTEXT y crea una categoría, como lo haría una escritura
-- manual que olvidó SP_Sistema_EstablecerContexto. El trigger de bitácora debe rechazarla (A-18).
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_EscribirSinContexto
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto NULL, NULL, NULL;

    BEGIN TRY
        BEGIN TRAN;
        INSERT INTO dbo.Categoria (Nombre) VALUES (N'Sin contexto ' + CONVERT(NVARCHAR(36), NEWID()));
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
