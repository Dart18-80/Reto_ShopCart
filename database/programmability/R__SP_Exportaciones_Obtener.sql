-- E7-H05: una exportación del Administrador de la petición. Una ajena no devuelve filas, igual que una
-- inexistente (RF-01: la API responde 404 en los dos casos).
CREATE OR ALTER PROCEDURE dbo.SP_Exportaciones_Obtener
    @IDSolicitudExportacion INT,
    @IDUsuarioActor         INT              = NULL,
    @RolActor               VARCHAR(20)      = NULL,
    @RequestId              UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @RolActor IS NULL OR @RolActor <> 'Administrador'
        THROW 50005, N'Solo un Administrador consulta exportaciones.', 1;

    SELECT v.IDSolicitudExportacion, v.Reporte, v.Formato, v.Filtros, v.Estado, v.Intentos, v.UltimoError,
           v.ReferenciaArchivo, v.TamanoBytes, v.FechaCreacion, v.FechaFinalizacion, v.FechaExpiracion
    FROM   dbo.VW_Exportaciones_Solicitudes AS v
    WHERE  v.IDSolicitudExportacion = @IDSolicitudExportacion AND v.IDUsuario = @IDUsuarioActor;
END
GO
