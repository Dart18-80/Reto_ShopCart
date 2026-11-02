-- RF-09: la bitácora para el Admin, la más reciente primero, con filtros opcionales por módulo, entidad y rango
-- de días de Guatemala (A-12: UTC−6 sin horario de verano, igual que FU_Sistema_FechaLocal), paginada en el
-- servidor. Dos conjuntos (sqlserver-sp §5): la página y el total del filtro.
-- Índices: IX_Bitacora_Modulo (módulo), IX_Bitacora_Entidad (entidad) e IX_Bitacora_Fecha (sin filtros).
-- OPTION (RECOMPILE): cada combinación de filtros usa el plan de su índice.
CREATE OR ALTER PROCEDURE dbo.SP_Bitacora_Listar
    @Modulo         VARCHAR(30)      = NULL,
    @Entidad        VARCHAR(50)      = NULL,
    @Desde          DATE             = NULL,
    @Hasta          DATE             = NULL,
    @Pagina         INT              = 1,
    @Tamano         INT              = 20,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @RolActor IS NULL OR @RolActor <> 'Administrador'
        THROW 50005, N'Solo el Administrador consulta la bitácora.', 1;
    IF @Pagina < 1 OR @Tamano NOT BETWEEN 1 AND 100
        THROW 50003, N'Los parámetros de paginación no son válidos.', 1;
    IF @Desde > @Hasta
        THROW 50003, N'La fecha inicial no puede ser posterior a la final.', 1;

    -- El día local de Guatemala empieza a las 06:00 UTC.
    DECLARE @HorasUtcGuatemala INT = 6;
    DECLARE @DesdeUtc DATETIME2(3) = DATEADD(HOUR, @HorasUtcGuatemala, CONVERT(DATETIME2(3), @Desde)),
            @HastaUtc DATETIME2(3) = DATEADD(HOUR, @HorasUtcGuatemala, CONVERT(DATETIME2(3), DATEADD(DAY, 1, @Hasta)));

    SELECT b.IDBitacora, b.Modulo, b.Entidad, b.IDEntidad, b.Accion, b.ValorAnterior, b.ValorNuevo,
           b.IDUsuario, u.Nombre AS NombreUsuario, b.RequestId, b.Fecha
    FROM   dbo.Bitacora AS b
    LEFT JOIN dbo.Usuario AS u ON u.IDUsuario = b.IDUsuario
    WHERE  (@Modulo IS NULL OR b.Modulo = @Modulo)
      AND  (@Entidad IS NULL OR b.Entidad = @Entidad)
      AND  (@DesdeUtc IS NULL OR b.Fecha >= @DesdeUtc)
      AND  (@HastaUtc IS NULL OR b.Fecha < @HastaUtc)
    ORDER BY b.Fecha DESC, b.IDBitacora DESC
    OFFSET (@Pagina - 1) * @Tamano ROWS
    FETCH NEXT @Tamano ROWS ONLY
    OPTION (RECOMPILE);

    SELECT COUNT(*) AS Total
    FROM   dbo.Bitacora AS b
    WHERE  (@Modulo IS NULL OR b.Modulo = @Modulo)
      AND  (@Entidad IS NULL OR b.Entidad = @Entidad)
      AND  (@DesdeUtc IS NULL OR b.Fecha >= @DesdeUtc)
      AND  (@HastaUtc IS NULL OR b.Fecha < @HastaUtc)
    OPTION (RECOMPILE);
END
GO
