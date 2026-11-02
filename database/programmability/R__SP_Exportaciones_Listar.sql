-- E7-H05: las exportaciones propias del Administrador de la petición, las más recientes primero, y el total.
-- IX_SolicitudExportacion_Usuario sostiene el filtro y el orden.
CREATE OR ALTER PROCEDURE dbo.SP_Exportaciones_Listar
    @Pagina         INT,
    @Tamano         INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @RolActor IS NULL OR @RolActor <> 'Administrador'
        THROW 50005, N'Solo un Administrador consulta exportaciones.', 1;
    IF @Pagina IS NULL OR @Tamano IS NULL OR @Pagina < 1 OR @Tamano NOT BETWEEN 1 AND 100
        THROW 50003, N'Los parámetros de paginación no son válidos.', 1;

    SELECT v.IDSolicitudExportacion, v.Reporte, v.Formato, v.Filtros, v.Estado, v.Intentos, v.UltimoError,
           v.ReferenciaArchivo, v.TamanoBytes, v.FechaCreacion, v.FechaFinalizacion, v.FechaExpiracion
    FROM   dbo.VW_Exportaciones_Solicitudes AS v
    WHERE  v.IDUsuario = @IDUsuarioActor
    ORDER BY v.FechaCreacion DESC, v.IDSolicitudExportacion DESC
    OFFSET (@Pagina - 1) * @Tamano ROWS
    FETCH NEXT @Tamano ROWS ONLY;

    SELECT COUNT(*) AS Total FROM dbo.SolicitudExportacion AS s WHERE s.IDUsuario = @IDUsuarioActor;
END
GO
