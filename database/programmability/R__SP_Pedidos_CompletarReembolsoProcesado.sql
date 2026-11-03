-- E9-H04 (decisión del PO): antes de resolver a mano un reembolso Fallido, el servicio consulta su llave en la
-- pasarela. Si la pasarela ya lo procesó (el dinero volvió, pero se perdió la respuesta), el reembolso queda
-- Completado con la transacción de la pasarela, en lugar de devolver el dinero otra vez a mano. Bajo bloqueo:
-- solo desde Fallido (50709); repetirlo sobre un Completado no cambia nada (dos Admins a la vez). Mientras está
-- Fallido nadie lo procesa: el job y el reintento solo toman un Pendiente. Solo el Administrador.
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_CompletarReembolsoProcesado
    @IDReembolso            INT,
    @IDTransaccionReembolso VARCHAR(64),
    @IDUsuarioActor         INT              = NULL,
    @RolActor               VARCHAR(20)      = NULL,
    @RequestId              UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF @RolActor IS NULL OR @RolActor <> 'Administrador' OR @IDUsuarioActor IS NULL
        THROW 50005, N'Solo el Administrador completa un reembolso que la pasarela ya procesó.', 1;
    IF NULLIF(LTRIM(RTRIM(@IDTransaccionReembolso)), '') IS NULL
        THROW 50003, N'Falta la transacción del reembolso en la pasarela.', 1;

    DECLARE @Estado VARCHAR(14);

    BEGIN TRY
        BEGIN TRAN;

        SELECT @Estado = r.Estado
        FROM   dbo.Reembolso AS r WITH (UPDLOCK, ROWLOCK)
        WHERE  r.IDReembolso = @IDReembolso;

        IF @Estado IS NULL
            THROW 50001, N'El reembolso no existe.', 1;
        IF @Estado NOT IN ('Fallido', 'Completado')
            THROW 50709, N'Solo se resuelve a mano un reembolso Fallido; este ya no lo está.', 1;

        IF @Estado = 'Fallido'
            UPDATE dbo.Reembolso
            SET    Estado = 'Completado', IDTransaccionReembolso = @IDTransaccionReembolso, UltimoError = NULL,
                   TokenReclamo = NULL, FechaCompletado = SYSUTCDATETIME(), FechaProximoIntento = NULL,
                   FechaActualizacion = SYSUTCDATETIME()
            WHERE  IDReembolso = @IDReembolso;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
