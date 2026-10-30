-- V005: tipos de movimiento, kardex (ledger) y reservas (02-modelo-datos.md §3.4).
-- Las FKs del kardex a Pedido y Devolucion se agregan en V008; la de Reserva a SesionCheckout, en V007.

CREATE TABLE dbo.TipoMovimiento (
    IDTipoMovimiento INT IDENTITY(1,1) NOT NULL,
    Codigo           VARCHAR(30)       NOT NULL,
    Nombre           NVARCHAR(60)      NOT NULL,
    Signo            SMALLINT          NOT NULL,
    EsManual         BIT               NOT NULL,
    FechaCreacion    DATETIME2(3)      NOT NULL CONSTRAINT DF_TipoMovimiento_FechaCreacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_TipoMovimiento PRIMARY KEY (IDTipoMovimiento),
    CONSTRAINT UQ_TipoMovimiento_Codigo UNIQUE (Codigo),
    -- Destino de la FK compuesta del kardex: el signo del movimiento no puede contradecir su tipo.
    CONSTRAINT UQ_TipoMovimiento_IDTipoMovimientoSigno UNIQUE (IDTipoMovimiento, Signo),
    CONSTRAINT CK_TipoMovimiento_Signo CHECK (Signo IN (1, -1)),
    CONSTRAINT CK_TipoMovimiento_Codigo CHECK (Codigo IN (
        'EntradaCompra', 'SalidaVenta', 'AjustePositivo', 'AjusteNegativo',
        'ReingresoCancelacion', 'ReingresoDevolucion'))
);

-- M-01: ledger append-only. El motor rechaza UPDATE y DELETE (error 37359), incluso a un administrador.
CREATE TABLE dbo.MovimientoKardex (
    IDMovimientoKardex   BIGINT IDENTITY(1,1) NOT NULL,
    IDVariante           INT                  NOT NULL,
    IDTipoMovimiento     INT                  NOT NULL,
    Signo                SMALLINT             NOT NULL,
    Cantidad             INT                  NOT NULL,
    ExistenciaAnterior   INT                  NOT NULL,
    ExistenciaResultante INT                  NOT NULL,
    Motivo               NVARCHAR(250)        NOT NULL,
    Referencia           NVARCHAR(100)        NULL,
    IDPedido             INT                  NULL,
    IDDevolucion         INT                  NULL,
    IDUsuario            INT                  NOT NULL,
    RequestId            UNIQUEIDENTIFIER     NULL,
    Fecha                DATETIME2(3)         NOT NULL CONSTRAINT DF_MovimientoKardex_Fecha DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_MovimientoKardex PRIMARY KEY (IDMovimientoKardex),
    CONSTRAINT FK_MovimientoKardex_Variante FOREIGN KEY (IDVariante) REFERENCES dbo.Variante (IDVariante),
    CONSTRAINT FK_MovimientoKardex_TipoMovimiento FOREIGN KEY (IDTipoMovimiento, Signo)
        REFERENCES dbo.TipoMovimiento (IDTipoMovimiento, Signo),
    CONSTRAINT FK_MovimientoKardex_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario (IDUsuario),
    CONSTRAINT CK_MovimientoKardex_CantidadPositiva CHECK (Cantidad > 0),
    CONSTRAINT CK_MovimientoKardex_ExistenciaAnterior CHECK (ExistenciaAnterior >= 0),
    -- El saldo de cada movimiento cuadra con su cantidad: la base rechaza un kardex incoherente.
    CONSTRAINT CK_MovimientoKardex_ExistenciaResultante CHECK (
        ExistenciaResultante >= 0 AND ExistenciaResultante = ExistenciaAnterior + Signo * Cantidad)
) WITH (LEDGER = ON (APPEND_ONLY = ON));

CREATE INDEX IX_MovimientoKardex_Variante ON dbo.MovimientoKardex (IDVariante, IDMovimientoKardex DESC);
CREATE INDEX IX_MovimientoKardex_Fecha ON dbo.MovimientoKardex (Fecha);

CREATE TABLE dbo.Reserva (
    IDReserva        BIGINT IDENTITY(1,1) NOT NULL,
    IDSesionCheckout INT                  NOT NULL,
    IDVariante       INT                  NOT NULL,
    Cantidad         INT                  NOT NULL,
    Estado           VARCHAR(10)          NOT NULL,
    FechaExpiracion  DATETIME2(3)         NOT NULL,
    FechaCierre      DATETIME2(3)         NULL,
    FechaCreacion    DATETIME2(3)         NOT NULL CONSTRAINT DF_Reserva_FechaCreacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Reserva PRIMARY KEY (IDReserva),
    CONSTRAINT UQ_Reserva_IDSesionCheckoutIDVariante UNIQUE (IDSesionCheckout, IDVariante),
    CONSTRAINT FK_Reserva_Variante FOREIGN KEY (IDVariante) REFERENCES dbo.Variante (IDVariante),
    CONSTRAINT CK_Reserva_CantidadPositiva CHECK (Cantidad > 0),
    CONSTRAINT CK_Reserva_Estado CHECK (Estado IN ('Activa', 'Consumida', 'Liberada'))
);

-- El cálculo del disponible solo lee las reservas activas (N-06).
CREATE INDEX IX_Reserva_Activas
    ON dbo.Reserva (IDVariante, FechaExpiracion) INCLUDE (Cantidad) WHERE Estado = 'Activa';
