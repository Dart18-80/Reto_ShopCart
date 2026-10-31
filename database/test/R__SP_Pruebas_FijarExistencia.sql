-- Solo existe en shopcart_test: cambia ExistenciaFisica directamente (en producción solo lo hace
-- SP_Inventario_RegistrarMovimiento) para comprobar que la bitácora lo registra en Inventario.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_FijarExistencia
    @IDVariante       INT,
    @ExistenciaFisica INT,
    @IDUsuarioActor   INT              = NULL,
    @RolActor         VARCHAR(20)      = NULL,
    @RequestId        UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    BEGIN TRY
        BEGIN TRAN;
        UPDATE dbo.Variante
        SET    ExistenciaFisica = @ExistenciaFisica, FechaActualizacion = SYSUTCDATETIME()
        WHERE  IDVariante = @IDVariante;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
