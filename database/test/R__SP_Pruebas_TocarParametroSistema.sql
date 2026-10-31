-- Solo existe en shopcart_test: sube MinutosReserva en uno y lo devuelve a su valor, en una sola
-- transacción (el parámetro queda como estaba), para comprobar la bitácora de Configuración.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_TocarParametroSistema
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
        DECLARE @Original SMALLINT =
            (SELECT MinutosReserva FROM dbo.ParametroSistema WITH (UPDLOCK) WHERE IDParametroSistema = 1);

        UPDATE dbo.ParametroSistema SET MinutosReserva = @Original + 1 WHERE IDParametroSistema = 1;
        UPDATE dbo.ParametroSistema SET MinutosReserva = @Original WHERE IDParametroSistema = 1;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT @Original AS MinutosReserva;
END
GO
