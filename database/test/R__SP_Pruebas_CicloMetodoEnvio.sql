-- Solo existe en shopcart_test: crea un método de envío, cambia su costo y lo elimina en una sola
-- transacción (la tabla queda como estaba para las demás pruebas). Devuelve su ID para leer la bitácora.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_CicloMetodoEnvio
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    DECLARE @IDMetodoEnvio INT;

    BEGIN TRY
        BEGIN TRAN;
        INSERT INTO dbo.MetodoEnvio (Codigo, Nombre, Costo, DiasMin, DiasMax)
        VALUES (LEFT('P' + REPLACE(CONVERT(VARCHAR(36), NEWID()), '-', ''), 20), N'Envío de prueba', 40, 2, 4);
        SET @IDMetodoEnvio = SCOPE_IDENTITY();

        UPDATE dbo.MetodoEnvio
        SET    Costo = 45, FechaActualizacion = SYSUTCDATETIME()
        WHERE  IDMetodoEnvio = @IDMetodoEnvio;

        DELETE FROM dbo.MetodoEnvio WHERE IDMetodoEnvio = @IDMetodoEnvio;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT @IDMetodoEnvio AS IDMetodoEnvio;
END
GO
