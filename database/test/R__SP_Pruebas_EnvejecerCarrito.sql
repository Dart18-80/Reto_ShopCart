-- Solo existe en shopcart_test: lleva la última actividad de un carrito @Dias días atrás, para probar la
-- expiración de los carritos de invitado (N-05) sin esperar. La hora la decide la base.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_EnvejecerCarrito
    @IDCarrito      INT,
    @Dias           INT,
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
        UPDATE dbo.Carrito
        SET    FechaUltimaActividad = DATEADD(DAY, -@Dias, SYSUTCDATETIME())
        WHERE  IDCarrito = @IDCarrito;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
