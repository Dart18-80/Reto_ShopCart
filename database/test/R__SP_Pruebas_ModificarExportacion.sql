-- Solo existe en shopcart_test: lleva una exportación a un momento dado para probar E7-H05 sin esperar.
--   VencerArrendamiento: la réplica que la procesaba "murió" (el arrendamiento ya venció).
--   VencerArchivo:       el archivo ya pasó sus 24 h (la purga lo expira).
-- Devuelve la fila completa (con el token y la referencia del archivo).
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_ModificarExportacion
    @IDSolicitudExportacion INT,
    @Cambio                 VARCHAR(20),
    @IDUsuarioActor         INT              = NULL,
    @RolActor               VARCHAR(20)      = NULL,
    @RequestId              UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF @Cambio NOT IN ('VencerArrendamiento', 'VencerArchivo', 'Ninguno')
        THROW 50003, N'Cambio de prueba desconocido.', 1;

    BEGIN TRY
        BEGIN TRAN;
        UPDATE dbo.SolicitudExportacion
        SET    ArrendadoHasta = CASE WHEN @Cambio = 'VencerArrendamiento'
                                     THEN DATEADD(SECOND, -1, SYSUTCDATETIME()) ELSE ArrendadoHasta END,
               FechaExpiracion = CASE WHEN @Cambio = 'VencerArchivo'
                                      THEN DATEADD(SECOND, -1, SYSUTCDATETIME()) ELSE FechaExpiracion END
        WHERE  IDSolicitudExportacion = @IDSolicitudExportacion;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT s.IDSolicitudExportacion, e.Codigo AS Estado, s.Intentos, s.TokenArrendamiento, s.ReferenciaArchivo,
           s.UltimoError
    FROM   dbo.SolicitudExportacion AS s
    JOIN   dbo.EstadoExportacion AS e ON e.IDEstadoExportacion = s.IDEstadoExportacion
    WHERE  s.IDSolicitudExportacion = @IDSolicitudExportacion;
END
GO
