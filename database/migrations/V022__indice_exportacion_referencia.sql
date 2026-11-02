-- V022 (barrido de archivos huérfanos, decisión del PO al cierre de la Fase 1): SP_Exportaciones_ReferenciasExistentes
-- busca por el nombre del archivo en el almacén.
CREATE INDEX IX_SolicitudExportacion_Referencia
    ON dbo.SolicitudExportacion (ReferenciaArchivo) WHERE ReferenciaArchivo IS NOT NULL;
GO
