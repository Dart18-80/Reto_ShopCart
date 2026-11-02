-- V021 (E7-H05, A-24): cola de exportaciones de reportes en SQL Server. Las dos réplicas la consumen en
-- competencia (UPDLOCK, READPAST) con un arrendamiento y un token de fencing, como IntentoPago (N-03): una réplica
-- que muere a mitad de un reporte la retoma otra cuando vence el arrendamiento, y la muerta ya no puede escribir.

-- A-15: catálogo de estados. IDs fijos: los CHECK de coherencia de SolicitudExportacion los usan.
CREATE TABLE dbo.EstadoExportacion (
    IDEstadoExportacion TINYINT       NOT NULL,
    Codigo              VARCHAR(12)   NOT NULL,
    Nombre              NVARCHAR(40)  NOT NULL,
    EsFinal             BIT           NOT NULL,
    CONSTRAINT PK_EstadoExportacion PRIMARY KEY (IDEstadoExportacion),
    CONSTRAINT UQ_EstadoExportacion_Codigo UNIQUE (Codigo)
);

INSERT INTO dbo.EstadoExportacion (IDEstadoExportacion, Codigo, Nombre, EsFinal) VALUES
    (1, 'Pendiente',  N'Pendiente',   0),
    (2, 'Procesando', N'Procesando',  0),
    (3, 'Completada', N'Completada',  0),
    (4, 'Fallida',    N'Fallida',     1),
    (5, 'Expirada',   N'Expirada',    1);

CREATE TABLE dbo.SolicitudExportacion (
    IDSolicitudExportacion INT IDENTITY(1,1)    NOT NULL,
    IDUsuario              INT                  NOT NULL,
    Reporte                VARCHAR(30)          NOT NULL,
    Formato                VARCHAR(5)           NOT NULL,
    Filtros                NVARCHAR(1000)       NOT NULL,
    -- SHA-256 de los filtros normalizados: agrupa las solicitudes iguales del mismo usuario.
    HashFiltros            BINARY(32)           NOT NULL,
    IDEstadoExportacion    TINYINT              NOT NULL CONSTRAINT DF_SolicitudExportacion_Estado DEFAULT 1,
    Intentos               TINYINT              NOT NULL CONSTRAINT DF_SolicitudExportacion_Intentos DEFAULT 0,
    TokenArrendamiento     UNIQUEIDENTIFIER     NULL,
    ArrendadoHasta         DATETIME2(3)         NULL,
    UltimoError            NVARCHAR(500)        NULL,
    -- Nombre del archivo en el almacén, generado por el servidor (nunca una ruta ni un nombre del cliente).
    ReferenciaArchivo      VARCHAR(100)         NULL,
    TamanoBytes            INT                  NULL,
    FechaCreacion          DATETIME2(3)         NOT NULL CONSTRAINT DF_SolicitudExportacion_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaFinalizacion      DATETIME2(3)         NULL,
    FechaExpiracion        DATETIME2(3)         NULL,
    FechaActualizacion     DATETIME2(3)         NOT NULL CONSTRAINT DF_SolicitudExportacion_FechaActualizacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_SolicitudExportacion PRIMARY KEY (IDSolicitudExportacion),
    CONSTRAINT FK_SolicitudExportacion_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario (IDUsuario),
    CONSTRAINT FK_SolicitudExportacion_EstadoExportacion FOREIGN KEY (IDEstadoExportacion)
        REFERENCES dbo.EstadoExportacion (IDEstadoExportacion),
    CONSTRAINT CK_SolicitudExportacion_Reporte CHECK (
        Reporte IN ('resumen', 'ventas', 'ventas-por-categoria', 'top-productos', 'carritos-abandonados')),
    CONSTRAINT CK_SolicitudExportacion_Formato CHECK (Formato IN ('xlsx', 'pdf')),
    CONSTRAINT CK_SolicitudExportacion_Filtros CHECK (ISJSON(Filtros) = 1),
    CONSTRAINT CK_SolicitudExportacion_Intentos CHECK (Intentos BETWEEN 0 AND 10),
    CONSTRAINT CK_SolicitudExportacion_TamanoBytes CHECK (TamanoBytes >= 0),
    -- Coherencia por estado: 2 Procesando (arrendada), 3 Completada (con su archivo), 4 Fallida (con su causa).
    CONSTRAINT CK_SolicitudExportacion_Procesando CHECK (
        IDEstadoExportacion <> 2 OR (TokenArrendamiento IS NOT NULL AND ArrendadoHasta IS NOT NULL)),
    CONSTRAINT CK_SolicitudExportacion_Completada CHECK (
        IDEstadoExportacion <> 3 OR (ReferenciaArchivo IS NOT NULL AND TamanoBytes IS NOT NULL
                                     AND FechaFinalizacion IS NOT NULL AND FechaExpiracion IS NOT NULL)),
    CONSTRAINT CK_SolicitudExportacion_Fallida CHECK (
        IDEstadoExportacion <> 4 OR (UltimoError IS NOT NULL AND FechaFinalizacion IS NOT NULL))
);

-- La toma de la cola (Pendiente, o Procesando con el arrendamiento vencido).
CREATE INDEX IX_SolicitudExportacion_Cola
    ON dbo.SolicitudExportacion (IDEstadoExportacion, ArrendadoHasta, IDSolicitudExportacion);
-- La agrupación de solicitudes iguales y el máximo de pendientes por usuario.
CREATE INDEX IX_SolicitudExportacion_Agrupacion
    ON dbo.SolicitudExportacion (IDUsuario, Reporte, Formato, HashFiltros)
    INCLUDE (IDEstadoExportacion, FechaExpiracion);
-- El listado de las propias, las más recientes primero.
CREATE INDEX IX_SolicitudExportacion_Usuario
    ON dbo.SolicitudExportacion (IDUsuario, FechaCreacion DESC, IDSolicitudExportacion DESC);
-- La purga de las completadas vencidas.
CREATE INDEX IX_SolicitudExportacion_Vencimiento
    ON dbo.SolicitudExportacion (FechaExpiracion) WHERE IDEstadoExportacion = 3;
GO
