-- E7-H05 (A-24): consumidor en competencia. Toma UNA exportación Pendiente, o Procesando con el arrendamiento
-- vencido (la réplica que la procesaba murió), y la arrienda @SegundosArrendamiento con un token nuevo
-- (fencing): la réplica que la tenía ya no puede completarla. READPAST salta la que otra réplica está tomando,
-- así las dos réplicas consumen la cola a la vez sin sp_getapplock. Antes, una Procesando vencida que ya agotó
-- sus intentos pasa a Fallida en lugar de retomarse.
-- Devuelve la solicitud tomada con su token, o ninguna fila. Solo el rol Sistema.
-- IDs de estado fijos de V021: 1 Pendiente, 2 Procesando, 4 Fallida.
CREATE OR ALTER PROCEDURE dbo.SP_Exportaciones_Tomar
    @SegundosArrendamiento INT,
    @MaxIntentos           TINYINT,
    @IDUsuarioActor        INT              = NULL,
    @RolActor              VARCHAR(20)      = NULL,
    @RequestId             UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF @RolActor IS NULL OR @RolActor <> 'Sistema'
        THROW 50005, N'Solo el procesador de exportaciones toma la cola.', 1;
    IF @SegundosArrendamiento IS NULL OR @SegundosArrendamiento <= 0 OR @MaxIntentos IS NULL OR @MaxIntentos < 1
        THROW 50005, N'SP_Exportaciones_Tomar recibió un arrendamiento o un máximo de intentos inválidos.', 1;

    DECLARE @Pendiente TINYINT = 1, @Procesando TINYINT = 2, @Fallida TINYINT = 4,
            @IDSolicitud INT, @Token UNIQUEIDENTIFIER = NEWID(), @Ahora DATETIME2(3) = SYSUTCDATETIME();

    BEGIN TRY
        BEGIN TRAN;

        UPDATE s
        SET    IDEstadoExportacion = @Fallida,
               UltimoError = N'Se agotaron los intentos: la réplica que la procesaba no terminó.',
               FechaFinalizacion = @Ahora, TokenArrendamiento = NULL, ArrendadoHasta = NULL,
               FechaActualizacion = @Ahora
        FROM   dbo.SolicitudExportacion AS s WITH (UPDLOCK, ROWLOCK, READPAST)
        WHERE  s.IDEstadoExportacion = @Procesando AND s.ArrendadoHasta < @Ahora AND s.Intentos >= @MaxIntentos;

        SELECT TOP (1) @IDSolicitud = s.IDSolicitudExportacion
        FROM   dbo.SolicitudExportacion AS s WITH (UPDLOCK, ROWLOCK, READPAST)
        WHERE  s.IDEstadoExportacion = @Pendiente
           OR  (s.IDEstadoExportacion = @Procesando AND s.ArrendadoHasta < @Ahora)
        ORDER BY s.IDSolicitudExportacion;

        IF @IDSolicitud IS NOT NULL
            UPDATE dbo.SolicitudExportacion
            SET    IDEstadoExportacion = @Procesando, TokenArrendamiento = @Token,
                   ArrendadoHasta = DATEADD(SECOND, @SegundosArrendamiento, @Ahora), Intentos = Intentos + 1,
                   FechaActualizacion = @Ahora
            WHERE  IDSolicitudExportacion = @IDSolicitud;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT v.IDSolicitudExportacion, v.IDUsuario, v.Reporte, v.Formato, v.Filtros, v.Intentos,
           s.TokenArrendamiento
    FROM   dbo.VW_Exportaciones_Solicitudes AS v
    JOIN   dbo.SolicitudExportacion AS s ON s.IDSolicitudExportacion = v.IDSolicitudExportacion
    WHERE  v.IDSolicitudExportacion = @IDSolicitud;
END
GO
