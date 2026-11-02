-- Job (A-04, E5-H03): cada hora borra las llaves de idempotencia de entradas y ajustes de inventario con más
-- de @Horas horas. Pasado ese plazo, un reintento con la misma llave se procesa como una solicitud nueva.
-- Idempotente. sp_getapplock: si la otra réplica lo está ejecutando, retorna sin hacer nada (Ejecutada = 0).
CREATE OR ALTER PROCEDURE dbo.SP_Sistema_PurgarSolicitudesIdempotentes
    @Horas          INT,
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

    IF @Horas IS NULL OR @Horas <= 0
        THROW 50005, N'SP_Sistema_PurgarSolicitudesIdempotentes recibió un plazo inválido.', 1;

    DECLARE @Bloqueo INT, @Purgadas INT;

    BEGIN TRY
        BEGIN TRAN;

        EXEC @Bloqueo = sys.sp_getapplock @Resource = N'Job_Sistema_PurgarSolicitudesIdempotentes',
                                          @LockMode = N'Exclusive', @LockOwner = N'Transaction', @LockTimeout = 0;
        IF @Bloqueo < 0
        BEGIN
            ROLLBACK;
            SELECT CONVERT(BIT, 0) AS Ejecutada, 0 AS SolicitudesPurgadas;
            RETURN;
        END

        -- IX_SolicitudIdempotente_Fecha.
        DELETE FROM dbo.SolicitudIdempotente
        WHERE  FechaCreacion < DATEADD(HOUR, -@Horas, SYSUTCDATETIME());
        SET @Purgadas = @@ROWCOUNT;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT CONVERT(BIT, 1) AS Ejecutada, @Purgadas AS SolicitudesPurgadas;
END
GO
