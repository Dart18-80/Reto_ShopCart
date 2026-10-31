-- Solo existe en shopcart_test: agrega un sufijo a la descripción de dos cupones en un solo UPDATE,
-- para comprobar que la bitácora registra una fila por cupón con su propio valor anterior (RF-09).
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_ModificarCupones
    @IDCupon1       INT,
    @IDCupon2       INT,
    @Sufijo         NVARCHAR(20),
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
        UPDATE dbo.Cupon
        SET    Descripcion = Descripcion + @Sufijo, FechaActualizacion = SYSUTCDATETIME()
        WHERE  IDCupon IN (@IDCupon1, @IDCupon2);
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
