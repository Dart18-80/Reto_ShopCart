-- E7-H05, job de purga (A-04, cada hora): las exportaciones Completada vencidas pasan a Expirada (ya no se
-- descargan) y devuelve hasta @Maximo Expirada que todavía tienen archivo, para que el servicio los borre del
-- almacén. Una que no se pudo borrar vuelve a salir en la siguiente purga. Solo el rol Sistema.
-- Devuelve dos conjuntos: Ejecutada (0 si la otra réplica tiene el sp_getapplock) y los archivos por borrar.
-- IDs de estado fijos de V021: 3 Completada, 5 Expirada.
CREATE OR ALTER PROCEDURE dbo.SP_Exportaciones_Expirar
    @Maximo         INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF @RolActor IS NULL OR @RolActor <> 'Sistema'
        THROW 50005, N'Solo los jobs ejecutan esta tarea.', 1;
    IF @Maximo IS NULL OR @Maximo < 1
        THROW 50005, N'SP_Exportaciones_Expirar recibió un máximo inválido.', 1;

    DECLARE @Completada TINYINT = 3, @Expirada TINYINT = 5, @Bloqueo INT, @Ahora DATETIME2(3) = SYSUTCDATETIME();

    BEGIN TRY
        BEGIN TRAN;

        EXEC @Bloqueo = sys.sp_getapplock @Resource = N'Job_Exportaciones_Purgar', @LockMode = N'Exclusive',
                                          @LockOwner = N'Transaction', @LockTimeout = 0;
        IF @Bloqueo < 0
        BEGIN
            ROLLBACK;
            SELECT CONVERT(BIT, 0) AS Ejecutada;
            SELECT TOP (0) CONVERT(INT, NULL) AS IDSolicitudExportacion, CONVERT(VARCHAR(100), NULL) AS ReferenciaArchivo;
            RETURN;
        END

        UPDATE dbo.SolicitudExportacion
        SET    IDEstadoExportacion = @Expirada, FechaActualizacion = @Ahora
        WHERE  IDEstadoExportacion = @Completada AND FechaExpiracion <= @Ahora;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT CONVERT(BIT, 1) AS Ejecutada;
    SELECT TOP (@Maximo) s.IDSolicitudExportacion, s.ReferenciaArchivo
    FROM   dbo.SolicitudExportacion AS s
    WHERE  s.IDEstadoExportacion = @Expirada AND s.ReferenciaArchivo IS NOT NULL
    ORDER BY s.IDSolicitudExportacion;
END
GO
