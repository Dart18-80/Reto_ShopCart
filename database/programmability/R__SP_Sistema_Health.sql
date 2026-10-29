-- Verificación de salud de la base para GET /api/v1/health: versión y hora del servidor.
CREATE OR ALTER PROCEDURE dbo.SP_Sistema_Health
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SELECT
        CAST(SERVERPROPERTY('ProductVersion') AS VARCHAR(32)) AS VersionServidor,
        CAST(SYSUTCDATETIME() AS DATETIME2(3)) AS FechaHoraUtc;
END;
GO
