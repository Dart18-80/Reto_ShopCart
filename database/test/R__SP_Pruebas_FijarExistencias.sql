-- Solo existe en shopcart_test: cambia la existencia de dos variantes en un solo UPDATE (en producción
-- solo lo hace SP_Inventario_RegistrarMovimiento), para comprobar la bitácora con varias filas.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_FijarExistencias
    @IDVariante1    INT,
    @Existencia1    INT,
    @IDVariante2    INT,
    @Existencia2    INT,
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
        UPDATE v
        SET    ExistenciaFisica = c.Existencia, FechaActualizacion = SYSUTCDATETIME()
        FROM   dbo.Variante AS v
        JOIN   (VALUES (@IDVariante1, @Existencia1), (@IDVariante2, @Existencia2)) AS c (IDVariante, Existencia)
               ON c.IDVariante = v.IDVariante;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
