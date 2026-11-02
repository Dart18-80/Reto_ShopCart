-- E7-H05 (decisión del PO al cierre de la Fase 1): de los nombres de archivo que hay en el almacén, cuáles todavía
-- tienen una solicitud que los referencia (en cualquier estado). El barrido de la purga borra solo los demás:
-- nunca uno referenciado. La lista llega como un arreglo JSON de textos (A-22). Solo el rol Sistema.
CREATE OR ALTER PROCEDURE dbo.SP_Exportaciones_ReferenciasExistentes
    @Referencias    NVARCHAR(MAX),
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @RolActor IS NULL OR @RolActor <> 'Sistema'
        THROW 50005, N'Solo los jobs ejecutan esta tarea.', 1;
    IF @Referencias IS NULL OR ISJSON(@Referencias) <> 1
        THROW 50005, N'SP_Exportaciones_ReferenciasExistentes recibió una lista inválida.', 1;

    SELECT DISTINCT s.ReferenciaArchivo
    FROM   OPENJSON(@Referencias) WITH (Referencia VARCHAR(100) '$') AS j
    JOIN   dbo.SolicitudExportacion AS s ON s.ReferenciaArchivo = j.Referencia;
END
GO
