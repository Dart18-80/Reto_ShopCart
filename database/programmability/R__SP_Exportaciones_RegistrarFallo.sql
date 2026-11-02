-- E7-H05 (A-24): registra que la generación falló, con compare-and-set del token. Un error definitivo (por
-- ejemplo, el reporte pasa el límite de filas del formato) o el último intento la dejan Fallida con su causa;
-- si no, vuelve a Pendiente para otro intento. Devuelve el estado resultante y si se aplicó. Solo el rol Sistema.
-- IDs de estado fijos de V021: 1 Pendiente, 2 Procesando, 4 Fallida.
CREATE OR ALTER PROCEDURE dbo.SP_Exportaciones_RegistrarFallo
    @IDSolicitudExportacion INT,
    @TokenArrendamiento     UNIQUEIDENTIFIER,
    @Error                  NVARCHAR(500),
    @Definitivo             BIT,
    @MaxIntentos            TINYINT,
    @IDUsuarioActor         INT              = NULL,
    @RolActor               VARCHAR(20)      = NULL,
    @RequestId              UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF @RolActor IS NULL OR @RolActor <> 'Sistema'
        THROW 50005, N'Solo el procesador de exportaciones registra un fallo.', 1;
    IF @Error IS NULL OR @Definitivo IS NULL OR @MaxIntentos IS NULL OR @MaxIntentos < 1
        THROW 50005, N'SP_Exportaciones_RegistrarFallo recibió un error o un máximo de intentos inválidos.', 1;

    DECLARE @Pendiente TINYINT = 1, @Procesando TINYINT = 2, @Fallida TINYINT = 4, @Aplicado BIT = 0,
            @Ahora DATETIME2(3) = SYSUTCDATETIME();

    BEGIN TRY
        BEGIN TRAN;

        UPDATE dbo.SolicitudExportacion
        SET    IDEstadoExportacion = IIF(@Definitivo = 1 OR Intentos >= @MaxIntentos, @Fallida, @Pendiente),
               FechaFinalizacion = IIF(@Definitivo = 1 OR Intentos >= @MaxIntentos, @Ahora, NULL),
               UltimoError = LEFT(@Error, 500), TokenArrendamiento = NULL, ArrendadoHasta = NULL,
               FechaActualizacion = @Ahora
        WHERE  IDSolicitudExportacion = @IDSolicitudExportacion AND IDEstadoExportacion = @Procesando
          AND  TokenArrendamiento = @TokenArrendamiento;
        SET @Aplicado = IIF(@@ROWCOUNT = 1, 1, 0);

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT v.Estado, @Aplicado AS Aplicado
    FROM   dbo.VW_Exportaciones_Solicitudes AS v
    WHERE  v.IDSolicitudExportacion = @IDSolicitudExportacion;
END
GO
