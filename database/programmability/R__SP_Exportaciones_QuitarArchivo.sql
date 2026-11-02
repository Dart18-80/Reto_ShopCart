-- E7-H05: el archivo de una exportación Expirada ya se borró del almacén; la solicitud queda sin referencia.
-- Solo el rol Sistema (la purga).
-- ID de estado fijo de V021: 5 Expirada.
CREATE OR ALTER PROCEDURE dbo.SP_Exportaciones_QuitarArchivo
    @IDSolicitudExportacion INT,
    @IDUsuarioActor         INT              = NULL,
    @RolActor               VARCHAR(20)      = NULL,
    @RequestId              UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF @RolActor IS NULL OR @RolActor <> 'Sistema'
        THROW 50005, N'Solo los jobs ejecutan esta tarea.', 1;

    DECLARE @Expirada TINYINT = 5;

    BEGIN TRY
        BEGIN TRAN;

        UPDATE dbo.SolicitudExportacion
        SET    ReferenciaArchivo = NULL, FechaActualizacion = SYSUTCDATETIME()
        WHERE  IDSolicitudExportacion = @IDSolicitudExportacion AND IDEstadoExportacion = @Expirada;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
