-- E7-H05 (A-24): registra el archivo generado, con compare-and-set del token (fencing): si otra réplica retomó
-- la exportación, no cambia nada y devuelve Aplicado = 0 (quien la generó borra su archivo). El archivo vence
-- a las @HorasVigencia. Solo el rol Sistema.
-- IDs de estado fijos de V021: 2 Procesando, 3 Completada.
CREATE OR ALTER PROCEDURE dbo.SP_Exportaciones_Completar
    @IDSolicitudExportacion INT,
    @TokenArrendamiento     UNIQUEIDENTIFIER,
    @ReferenciaArchivo      VARCHAR(100),
    @TamanoBytes            INT,
    @HorasVigencia          INT,
    @IDUsuarioActor         INT              = NULL,
    @RolActor               VARCHAR(20)      = NULL,
    @RequestId              UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF @RolActor IS NULL OR @RolActor <> 'Sistema'
        THROW 50005, N'Solo el procesador de exportaciones completa una exportación.', 1;
    IF @HorasVigencia IS NULL OR @HorasVigencia <= 0 OR @ReferenciaArchivo IS NULL OR @TamanoBytes IS NULL
        THROW 50005, N'SP_Exportaciones_Completar recibió un archivo o una vigencia inválidos.', 1;

    DECLARE @Procesando TINYINT = 2, @Completada TINYINT = 3, @Aplicado BIT = 0,
            @Ahora DATETIME2(3) = SYSUTCDATETIME();

    BEGIN TRY
        BEGIN TRAN;

        UPDATE dbo.SolicitudExportacion
        SET    IDEstadoExportacion = @Completada, ReferenciaArchivo = @ReferenciaArchivo,
               TamanoBytes = @TamanoBytes, UltimoError = NULL, FechaFinalizacion = @Ahora,
               FechaExpiracion = DATEADD(HOUR, @HorasVigencia, @Ahora), TokenArrendamiento = NULL,
               ArrendadoHasta = NULL, FechaActualizacion = @Ahora
        WHERE  IDSolicitudExportacion = @IDSolicitudExportacion AND IDEstadoExportacion = @Procesando
          AND  TokenArrendamiento = @TokenArrendamiento;
        SET @Aplicado = IIF(@@ROWCOUNT = 1, 1, 0);

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT @Aplicado AS Aplicado;
END
GO
