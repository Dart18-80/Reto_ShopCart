-- Solo existe en shopcart_test: aplica valores a la fila única de ParametroSistema dentro de una
-- transacción que siempre se revierte. Sirve para probar los CHECK en sus límites sin dejar cambios.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_ProbarParametroSistema
    @MinutosReserva   SMALLINT,
    @MontoEnvioGratis DECIMAL(12,2),
    @IDUsuarioActor   INT              = NULL,
    @RolActor         VARCHAR(20)      = NULL,
    @RequestId        UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- A-18: los triggers de bitácora exigen el contexto (en una prueba sin petición, Rol = 'Sistema').
    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    BEGIN TRY
        BEGIN TRAN;
        UPDATE dbo.ParametroSistema
        SET    MinutosReserva = @MinutosReserva, MontoEnvioGratis = @MontoEnvioGratis
        WHERE  IDParametroSistema = 1;
        ROLLBACK;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
