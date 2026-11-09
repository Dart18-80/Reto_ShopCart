-- N-09: el Admin reintenta un reembolso Fallido: vuelve a Pendiente con sus intentos en cero y disponible ya;
-- después el servicio lo procesa con la misma llave (la pasarela nunca reembolsa dos veces). Un Pendiente que
-- espera su próximo intento queda disponible ya; uno que otro proceso tiene tomado (reclamo vigente) no se toca,
-- y uno Completado tampoco. Devuelve el reembolso; ninguna fila si no existe.
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

        -- La regla de quién se puede reintentar vive en FU_Pedidos_ReembolsoReintentable (la misma que ofrece el botón).
        UPDATE r
        SET    Estado = 'Pendiente', Intentos = IIF(r.Estado = 'Fallido', 0, r.Intentos),
               FechaProximoIntento = SYSUTCDATETIME(), FechaActualizacion = SYSUTCDATETIME()
        FROM   dbo.Reembolso AS r
        CROSS APPLY dbo.FU_Pedidos_ReembolsoReintentable(r.Estado, r.TokenReclamo, r.FechaProximoIntento) AS a
        WHERE  r.IDReembolso = @IDReembolso AND a.PuedeReintentar = 1;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT r.IDReembolso, r.Estado FROM dbo.Reembolso AS r WHERE r.IDReembolso = @IDReembolso;
END
GO
