-- Verificación de salud de la base para GET /api/v1/health: versión y hora del servidor.
-- Es de solo lectura: declara los parámetros estándar (A-18) porque la API los envía siempre, pero no los usa.
CREATE OR ALTER PROCEDURE dbo.SP_Sistema_Health
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SELECT  CAST(SERVERPROPERTY('ProductVersion') AS VARCHAR(32)) AS VersionServidor,
            CAST(SYSUTCDATETIME() AS DATETIME2(3))                AS FechaHoraUtc;
END
GO
