-- E7-H05: una solicitud de exportación con el código de su estado. La usan los SPs del módulo; nunca expone el
-- token de arrendamiento.
CREATE OR ALTER VIEW dbo.VW_Exportaciones_Solicitudes
AS
SELECT  s.IDSolicitudExportacion,
        s.IDUsuario,
        s.Reporte,
        s.Formato,
        s.Filtros,
        e.Codigo AS Estado,
        s.Intentos,
        s.UltimoError,
        s.ReferenciaArchivo,
        s.TamanoBytes,
        s.FechaCreacion,
        s.FechaFinalizacion,
        s.FechaExpiracion
FROM    dbo.SolicitudExportacion AS s
JOIN    dbo.EstadoExportacion AS e ON e.IDEstadoExportacion = s.IDEstadoExportacion;
GO
