-- Solo existe en shopcart_test: retiene el sp_getapplock de un job durante @Milisegundos, como si la otra
-- réplica lo estuviera ejecutando, para probar que el job retorna sin hacer nada (A-04).
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_RetenerBloqueo
    @Recurso        NVARCHAR(255),
    @Milisegundos   INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Bloqueo INT,
            @Espera  VARCHAR(12) = CONVERT(VARCHAR(12), DATEADD(MILLISECOND, @Milisegundos, CONVERT(TIME(3), '00:00')));

    BEGIN TRY
        BEGIN TRAN;
        EXEC @Bloqueo = sys.sp_getapplock @Resource = @Recurso, @LockMode = N'Exclusive',
                                          @LockOwner = N'Transaction', @LockTimeout = 10000;
        IF @Bloqueo < 0
            THROW 59997, N'No se pudo tomar el bloqueo de prueba.', 1;
        WAITFOR DELAY @Espera;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
