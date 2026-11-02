-- N-09: el Admin reintenta un reembolso Fallido: vuelve a Pendiente con sus intentos en cero y disponible ya;
-- después el servicio lo procesa con la misma llave (la pasarela nunca reembolsa dos veces). Un Pendiente queda
-- disponible ya; uno Completado no cambia. Devuelve el reembolso; ninguna fila si no existe.
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_ReintentarReembolso
    @IDReembolso    INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF @RolActor IS NULL OR @RolActor <> 'Administrador'
        THROW 50005, N'Solo el Administrador reintenta un reembolso.', 1;

    BEGIN TRY
        BEGIN TRAN;

        UPDATE dbo.Reembolso
        SET    Estado = 'Pendiente', Intentos = IIF(Estado = 'Fallido', 0, Intentos),
               FechaProximoIntento = SYSUTCDATETIME(), FechaActualizacion = SYSUTCDATETIME()
        WHERE  IDReembolso = @IDReembolso AND Estado IN ('Pendiente', 'Fallido');

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT r.IDReembolso, r.Estado FROM dbo.Reembolso AS r WHERE r.IDReembolso = @IDReembolso;
END
GO
