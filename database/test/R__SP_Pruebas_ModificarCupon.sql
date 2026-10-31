-- Solo existe en shopcart_test: cambia la descripción de un cupón, o solo su contador de usos, con
-- el actor de la petición, para comprobar qué registra la bitácora de cupones.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_ModificarCupon
    @IDCupon           INT,
    @Descripcion       NVARCHAR(200),
    @UsosComprometidos INT,
    @IDUsuarioActor    INT              = NULL,
    @RolActor          VARCHAR(20)      = NULL,
    @RequestId         UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    BEGIN TRY
        BEGIN TRAN;
        UPDATE dbo.Cupon
        SET    Descripcion = @Descripcion, UsosComprometidos = @UsosComprometidos, FechaActualizacion = SYSUTCDATETIME()
        WHERE  IDCupon = @IDCupon;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
