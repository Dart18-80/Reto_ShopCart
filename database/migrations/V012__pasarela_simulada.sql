-- V012: estado propio de la pasarela simulada (N-03, E5-H02). Simula la base de un sistema externo: solo la
-- usa el adaptador PasarelaSimulada, solo por SP_Pasarela_*, y nunca dentro de una transacción del checkout.
-- Así la misma llave recibe la misma respuesta aunque el reintento caiga en la otra réplica (sin Redis, RNF-2).

CREATE TABLE dbo.PasarelaAutorizacion (
    IDPasarelaAutorizacion INT IDENTITY(1,1) NOT NULL,
    LlaveIdempotencia      UNIQUEIDENTIFIER  NOT NULL,
    IDTransaccion          VARCHAR(64)       NOT NULL,
    Monto                  DECIMAL(12,2)     NOT NULL,
    Marca                  VARCHAR(20)       NOT NULL,
    UltimosDigitos         CHAR(4)           NOT NULL,
    Estado                 VARCHAR(12)       NOT NULL,
    CodigoRespuesta        VARCHAR(30)       NULL,
    MensajeRespuesta       NVARCHAR(200)     NULL,
    FechaCreacion          DATETIME2(3)      NOT NULL CONSTRAINT DF_PasarelaAutorizacion_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion     DATETIME2(3)      NOT NULL CONSTRAINT DF_PasarelaAutorizacion_FechaActualizacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_PasarelaAutorizacion PRIMARY KEY (IDPasarelaAutorizacion),
    -- La misma llave recibe siempre la misma respuesta.
    CONSTRAINT UQ_PasarelaAutorizacion_LlaveIdempotencia UNIQUE (LlaveIdempotencia),
    CONSTRAINT UQ_PasarelaAutorizacion_IDTransaccion UNIQUE (IDTransaccion),
    CONSTRAINT CK_PasarelaAutorizacion_Monto CHECK (Monto > 0),
    CONSTRAINT CK_PasarelaAutorizacion_Estado CHECK (Estado IN ('Autorizada', 'Rechazada', 'Capturada', 'Anulada')),
    CONSTRAINT CK_PasarelaAutorizacion_UltimosDigitos CHECK (UltimosDigitos LIKE '[0-9][0-9][0-9][0-9]')
);

CREATE TABLE dbo.PasarelaReembolso (
    IDPasarelaReembolso INT IDENTITY(1,1) NOT NULL,
    LlaveIdempotencia   UNIQUEIDENTIFIER  NOT NULL,
    IDTransaccion       VARCHAR(64)       NOT NULL,
    IDReembolso         VARCHAR(64)       NOT NULL,
    Monto               DECIMAL(12,2)     NOT NULL,
    FechaCreacion       DATETIME2(3)      NOT NULL CONSTRAINT DF_PasarelaReembolso_FechaCreacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_PasarelaReembolso PRIMARY KEY (IDPasarelaReembolso),
    CONSTRAINT UQ_PasarelaReembolso_LlaveIdempotencia UNIQUE (LlaveIdempotencia),
    CONSTRAINT UQ_PasarelaReembolso_IDReembolso UNIQUE (IDReembolso),
    CONSTRAINT FK_PasarelaReembolso_PasarelaAutorizacion FOREIGN KEY (IDTransaccion)
        REFERENCES dbo.PasarelaAutorizacion (IDTransaccion),
    CONSTRAINT CK_PasarelaReembolso_Monto CHECK (Monto > 0)
);

CREATE INDEX IX_PasarelaReembolso_Transaccion ON dbo.PasarelaReembolso (IDTransaccion) INCLUDE (Monto);
GO
