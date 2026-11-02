-- E7-H05 (A-24): registra una exportación para el Administrador de la petición. Si ya tiene una igual (mismo
-- reporte, formato y filtros) Pendiente, Procesando o Completada vigente, devuelve esa (Nueva = 0). Con
-- @MaxPendientes solicitudes en curso responde 50801 (429). Bloquear la fila del usuario serializa sus
-- solicitudes: dos clics iguales a la vez dan una sola.
-- IDs de estado fijos de V021: 1 Pendiente, 2 Procesando, 3 Completada.
CREATE OR ALTER PROCEDURE dbo.SP_Exportaciones_Solicitar
    @Reporte        VARCHAR(30),
    @Formato        VARCHAR(5),
    @Filtros        NVARCHAR(1000),
    @HashFiltros    BINARY(32),
    @MaxPendientes  INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF @RolActor IS NULL OR @RolActor <> 'Administrador' OR @IDUsuarioActor IS NULL
        THROW 50005, N'Solo un Administrador solicita exportaciones.', 1;
    IF @MaxPendientes IS NULL OR @MaxPendientes < 1
        THROW 50005, N'SP_Exportaciones_Solicitar recibió un máximo de pendientes inválido.', 1;

    DECLARE @Pendiente TINYINT = 1, @Procesando TINYINT = 2, @Completada TINYINT = 3,
            @IDSolicitud INT, @Nueva BIT = 0, @Ahora DATETIME2(3) = SYSUTCDATETIME();

    BEGIN TRY
        BEGIN TRAN;

        IF NOT EXISTS (SELECT 1 FROM dbo.Usuario AS u WITH (UPDLOCK, ROWLOCK) WHERE u.IDUsuario = @IDUsuarioActor)
            THROW 50005, N'El usuario de la petición no existe.', 1;

        SELECT TOP (1) @IDSolicitud = s.IDSolicitudExportacion
        FROM   dbo.SolicitudExportacion AS s
        WHERE  s.IDUsuario = @IDUsuarioActor AND s.Reporte = @Reporte AND s.Formato = @Formato
          AND  s.HashFiltros = @HashFiltros
          AND  (s.IDEstadoExportacion IN (@Pendiente, @Procesando)
                OR (s.IDEstadoExportacion = @Completada AND s.FechaExpiracion > @Ahora))
        ORDER BY s.IDSolicitudExportacion DESC;

        IF @IDSolicitud IS NULL
        BEGIN
            IF (SELECT COUNT(*) FROM dbo.SolicitudExportacion AS s
                WHERE s.IDUsuario = @IDUsuarioActor AND s.IDEstadoExportacion IN (@Pendiente, @Procesando))
               >= @MaxPendientes
                THROW 50801, N'Ya tienes el máximo de exportaciones en curso. Espera a que terminen.', 1;

            INSERT INTO dbo.SolicitudExportacion (IDUsuario, Reporte, Formato, Filtros, HashFiltros)
            VALUES (@IDUsuarioActor, @Reporte, @Formato, @Filtros, @HashFiltros);
            SET @IDSolicitud = SCOPE_IDENTITY();
            SET @Nueva = 1;
        END

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT v.IDSolicitudExportacion, v.Reporte, v.Formato, v.Filtros, v.Estado, v.Intentos, v.UltimoError,
           v.ReferenciaArchivo, v.TamanoBytes, v.FechaCreacion, v.FechaFinalizacion, v.FechaExpiracion, @Nueva AS Nueva
    FROM   dbo.VW_Exportaciones_Solicitudes AS v
    WHERE  v.IDSolicitudExportacion = @IDSolicitud;
END
GO
