-- E9-H01: la métrica shopcart.exportaciones.pendientes: las solicitudes que esperan o se están generando
-- (Pendiente = 1, Procesando = 2: IDs fijos del catálogo, A-15). La lee el SDK de métricas fuera de una petición,
-- así que solo el rol Sistema. Usa IX_SolicitudExportacion_Cola (IDEstadoExportacion primero).
CREATE OR ALTER PROCEDURE dbo.SP_Exportaciones_ContarPendientes
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @RolActor IS NULL OR @RolActor <> 'Sistema'
        THROW 50005, N'Solo los jobs ejecutan esta tarea.', 1;

    SELECT COUNT(*) AS Pendientes
    FROM   dbo.SolicitudExportacion AS s
    WHERE  s.IDEstadoExportacion IN (1, 2);
END
GO
