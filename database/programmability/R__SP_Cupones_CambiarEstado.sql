-- RF-05: el Admin activa o desactiva un cupón. Idempotente: si ya está en ese estado no escribe (ni deja
-- una fila en la bitácora). Devuelve el cupón.
CREATE OR ALTER PROCEDURE dbo.SP_Cupones_CambiarEstado
    @IDCupon        INT,
    @Activo         BIT,
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

        IF NOT EXISTS (SELECT 1 FROM dbo.Cupon AS c WITH (UPDLOCK, ROWLOCK) WHERE c.IDCupon = @IDCupon)
            THROW 50001, N'El cupón no existe.', 1;

        UPDATE dbo.Cupon
        SET    Activo = @Activo, FechaActualizacion = SYSUTCDATETIME()
        WHERE  IDCupon = @IDCupon AND Activo <> @Activo;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    EXEC dbo.SP_Cupones_Obtener @IDCupon = @IDCupon;
END
GO
