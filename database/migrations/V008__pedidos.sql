-- V008: estados, transiciones, pedidos, historial (ledger), devoluciones y reembolsos (02-modelo-datos.md §3.9).
-- Al final agrega las FKs que esperaban a Pedido y Devolucion (kardex y uso de cupón).

CREATE TABLE dbo.EstadoPedido (
    IDEstadoPedido INT IDENTITY(1,1) NOT NULL,
    Codigo         VARCHAR(20)       NOT NULL,
    Nombre         NVARCHAR(40)      NOT NULL,
    EsFinal        BIT               NOT NULL,
    Orden          TINYINT           NOT NULL,
    FechaCreacion  DATETIME2(3)      NOT NULL CONSTRAINT DF_EstadoPedido_FechaCreacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_EstadoPedido PRIMARY KEY (IDEstadoPedido),
    CONSTRAINT UQ_EstadoPedido_Codigo UNIQUE (Codigo),
    CONSTRAINT CK_EstadoPedido_Codigo CHECK (Codigo IN (
        'Pagado', 'EnPreparacion', 'Despachado', 'Entregado', 'Cancelado', 'DevueltoParcial', 'Devuelto'))
);

-- N-08: transiciones permitidas por rol. Una transición nueva es una fila, no código.
CREATE TABLE dbo.TransicionEstadoPedido (
    IDTransicionEstadoPedido INT IDENTITY(1,1) NOT NULL,
    IDEstadoOrigen           INT               NOT NULL,
    IDEstadoDestino          INT               NOT NULL,
    IDRol                    INT               NOT NULL,
    FechaCreacion            DATETIME2(3)      NOT NULL CONSTRAINT DF_TransicionEstadoPedido_FechaCreacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_TransicionEstadoPedido PRIMARY KEY (IDTransicionEstadoPedido),
    CONSTRAINT UQ_TransicionEstadoPedido_OrigenDestinoRol UNIQUE (IDEstadoOrigen, IDEstadoDestino, IDRol),
    CONSTRAINT FK_TransicionEstadoPedido_EstadoOrigen FOREIGN KEY (IDEstadoOrigen)
        REFERENCES dbo.EstadoPedido (IDEstadoPedido),
    CONSTRAINT FK_TransicionEstadoPedido_EstadoDestino FOREIGN KEY (IDEstadoDestino)
        REFERENCES dbo.EstadoPedido (IDEstadoPedido),
    CONSTRAINT FK_TransicionEstadoPedido_Rol FOREIGN KEY (IDRol) REFERENCES dbo.Rol (IDRol),
    CONSTRAINT CK_TransicionEstadoPedido_DestinoDistinto CHECK (IDEstadoDestino <> IDEstadoOrigen)
);

CREATE TABLE dbo.Pedido (
    IDPedido              INT IDENTITY(1,1) NOT NULL,
    NumeroPedido          AS ('SC-' + RIGHT('000000' + CAST(IDPedido AS VARCHAR(10)), 6)) PERSISTED,
    IDUsuario             INT               NOT NULL,
    IDSesionCheckout      INT               NOT NULL,
    IDIntentoPago         BIGINT            NOT NULL,
    IDEstadoPedido        INT               NOT NULL,
    Subtotal              DECIMAL(12,2)     NOT NULL,
    Descuento             DECIMAL(12,2)     NOT NULL,
    CostoEnvio            DECIMAL(12,2)     NOT NULL,
    Total                 DECIMAL(12,2)     NOT NULL,
    -- N-18: precios con IVA incluido; BaseImponible = ROUND(Total / 1.12, 2), la calcula el SP.
    BaseImponible         DECIMAL(12,2)     NOT NULL,
    IVA                   DECIMAL(12,2)     NOT NULL,
    -- Aumenta al crear cada reembolso: nunca se compromete más de lo cobrado (A-13).
    MontoReembolsado      DECIMAL(12,2)     NOT NULL CONSTRAINT DF_Pedido_MontoReembolsado DEFAULT 0,
    IDCupon               INT               NULL,
    CodigoCupon           VARCHAR(30)       NULL,
    IDMetodoEnvio         INT               NOT NULL,
    NombreMetodoEnvio     NVARCHAR(50)      NOT NULL,
    FechaEstimadaEntrega  DATE              NOT NULL,
    -- N-17: copia de la dirección.
    NombreRecibe          NVARCHAR(100)     NOT NULL,
    TelefonoRecibe        VARCHAR(8)        NOT NULL,
    IDMunicipio           INT               NOT NULL,
    Departamento          NVARCHAR(50)      NOT NULL,
    Municipio             NVARCHAR(80)      NOT NULL,
    DireccionLinea        NVARCHAR(200)     NOT NULL,
    Referencia            NVARCHAR(200)     NULL,
    -- N-03: para reembolsar contra la transacción original.
    IDTransaccionPasarela VARCHAR(64)       NOT NULL,
    MarcaTarjeta          VARCHAR(20)       NOT NULL,
    UltimosDigitos        CHAR(4)           NOT NULL,
    FechaPago             DATETIME2(3)      NOT NULL,
    -- A-12: fecha de pago en Guatemala; agrupa los reportes.
    FechaPagoLocal        DATE              NOT NULL,
    VersionFila           ROWVERSION        NOT NULL,
    FechaCreacion         DATETIME2(3)      NOT NULL CONSTRAINT DF_Pedido_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion    DATETIME2(3)      NOT NULL CONSTRAINT DF_Pedido_FechaActualizacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Pedido PRIMARY KEY (IDPedido),
    CONSTRAINT UQ_Pedido_NumeroPedido UNIQUE (NumeroPedido),
    -- Idempotencia en la base: un pedido por sesión y por intento de pago.
    CONSTRAINT UQ_Pedido_IDSesionCheckout UNIQUE (IDSesionCheckout),
    CONSTRAINT UQ_Pedido_IDIntentoPago UNIQUE (IDIntentoPago),
    CONSTRAINT FK_Pedido_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario (IDUsuario),
    CONSTRAINT FK_Pedido_SesionCheckout FOREIGN KEY (IDSesionCheckout) REFERENCES dbo.SesionCheckout (IDSesionCheckout),
    CONSTRAINT FK_Pedido_IntentoPago FOREIGN KEY (IDIntentoPago) REFERENCES dbo.IntentoPago (IDIntentoPago),
    CONSTRAINT FK_Pedido_EstadoPedido FOREIGN KEY (IDEstadoPedido) REFERENCES dbo.EstadoPedido (IDEstadoPedido),
    CONSTRAINT FK_Pedido_Cupon FOREIGN KEY (IDCupon) REFERENCES dbo.Cupon (IDCupon),
    CONSTRAINT FK_Pedido_MetodoEnvio FOREIGN KEY (IDMetodoEnvio) REFERENCES dbo.MetodoEnvio (IDMetodoEnvio),
    CONSTRAINT FK_Pedido_Municipio FOREIGN KEY (IDMunicipio) REFERENCES dbo.Municipio (IDMunicipio),
    CONSTRAINT CK_Pedido_Subtotal CHECK (Subtotal >= 0),
    CONSTRAINT CK_Pedido_Descuento CHECK (Descuento >= 0 AND Descuento <= Subtotal),
    CONSTRAINT CK_Pedido_CostoEnvio CHECK (CostoEnvio >= 0),
    CONSTRAINT CK_Pedido_Total CHECK (Total = Subtotal - Descuento + CostoEnvio),
    CONSTRAINT CK_Pedido_IVA CHECK (BaseImponible + IVA = Total),
    CONSTRAINT CK_Pedido_MontoReembolsado CHECK (MontoReembolsado BETWEEN 0 AND Total),
    CONSTRAINT CK_Pedido_TelefonoRecibe CHECK (TelefonoRecibe LIKE '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]')
);

CREATE INDEX IX_Pedido_Cliente ON dbo.Pedido (IDUsuario, FechaPago DESC);
CREATE INDEX IX_Pedido_Reportes
    ON dbo.Pedido (FechaPagoLocal) INCLUDE (IDEstadoPedido, Subtotal, Descuento, CostoEnvio, Total);
CREATE INDEX IX_Pedido_Gestion ON dbo.Pedido (IDEstadoPedido, FechaPago DESC) INCLUDE (IDUsuario, Total);

CREATE TABLE dbo.DetallePedido (
    IDDetallePedido     INT IDENTITY(1,1) NOT NULL,
    IDPedido            INT               NOT NULL,
    IDVariante          INT               NOT NULL,
    IDPrecioVariante    INT               NOT NULL,
    -- M-04: copias al momento de la venta.
    SKU                 VARCHAR(40)       NOT NULL,
    NombreProducto      NVARCHAR(150)     NOT NULL,
    DescripcionVariante NVARCHAR(200)     NOT NULL,
    -- Los reportes por categoría usan la categoría que tenía el producto al venderse.
    IDCategoria         INT               NOT NULL,
    NombreCategoria     NVARCHAR(80)      NOT NULL,
    Cantidad            INT               NOT NULL,
    PrecioUnitario      DECIMAL(12,2)     NOT NULL,
    DescuentoLinea      DECIMAL(12,2)     NOT NULL,
    TotalLinea          DECIMAL(12,2)     NOT NULL,
    -- N-10: nunca se devuelve más de lo vendido.
    CantidadDevuelta    INT               NOT NULL CONSTRAINT DF_DetallePedido_CantidadDevuelta DEFAULT 0,
    FechaCreacion       DATETIME2(3)      NOT NULL CONSTRAINT DF_DetallePedido_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion  DATETIME2(3)      NOT NULL CONSTRAINT DF_DetallePedido_FechaActualizacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_DetallePedido PRIMARY KEY (IDDetallePedido),
    CONSTRAINT UQ_DetallePedido_IDPedidoIDVariante UNIQUE (IDPedido, IDVariante),
    CONSTRAINT FK_DetallePedido_Pedido FOREIGN KEY (IDPedido) REFERENCES dbo.Pedido (IDPedido),
    CONSTRAINT FK_DetallePedido_Variante FOREIGN KEY (IDVariante) REFERENCES dbo.Variante (IDVariante),
    CONSTRAINT FK_DetallePedido_PrecioVariante FOREIGN KEY (IDPrecioVariante)
        REFERENCES dbo.PrecioVariante (IDPrecioVariante),
    CONSTRAINT FK_DetallePedido_Categoria FOREIGN KEY (IDCategoria) REFERENCES dbo.Categoria (IDCategoria),
    CONSTRAINT CK_DetallePedido_CantidadPositiva CHECK (Cantidad > 0),
    CONSTRAINT CK_DetallePedido_PrecioUnitario CHECK (PrecioUnitario > 0),
    CONSTRAINT CK_DetallePedido_DescuentoLinea CHECK (DescuentoLinea >= 0 AND DescuentoLinea <= Cantidad * PrecioUnitario),
    CONSTRAINT CK_DetallePedido_TotalLinea CHECK (TotalLinea = Cantidad * PrecioUnitario - DescuentoLinea),
    CONSTRAINT CK_DetallePedido_CantidadDevuelta CHECK (CantidadDevuelta BETWEEN 0 AND Cantidad)
);

CREATE INDEX IX_DetallePedido_Variante ON dbo.DetallePedido (IDVariante) INCLUDE (Cantidad, TotalLinea);
CREATE INDEX IX_DetallePedido_Categoria ON dbo.DetallePedido (IDCategoria) INCLUDE (IDPedido, TotalLinea, Cantidad);

-- M-01: ledger append-only.
CREATE TABLE dbo.HistorialEstadoPedido (
    IDHistorialEstadoPedido BIGINT IDENTITY(1,1) NOT NULL,
    IDPedido                INT                  NOT NULL,
    IDEstadoAnterior        INT                  NULL,
    IDEstadoNuevo           INT                  NOT NULL,
    IDUsuario               INT                  NOT NULL,
    Motivo                  NVARCHAR(250)        NULL,
    RequestId               UNIQUEIDENTIFIER     NULL,
    Fecha                   DATETIME2(3)         NOT NULL CONSTRAINT DF_HistorialEstadoPedido_Fecha DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_HistorialEstadoPedido PRIMARY KEY (IDHistorialEstadoPedido),
    CONSTRAINT FK_HistorialEstadoPedido_Pedido FOREIGN KEY (IDPedido) REFERENCES dbo.Pedido (IDPedido),
    CONSTRAINT FK_HistorialEstadoPedido_EstadoAnterior FOREIGN KEY (IDEstadoAnterior)
        REFERENCES dbo.EstadoPedido (IDEstadoPedido),
    CONSTRAINT FK_HistorialEstadoPedido_EstadoNuevo FOREIGN KEY (IDEstadoNuevo)
        REFERENCES dbo.EstadoPedido (IDEstadoPedido),
    CONSTRAINT FK_HistorialEstadoPedido_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario (IDUsuario)
) WITH (LEDGER = ON (APPEND_ONLY = ON));

CREATE INDEX IX_HistorialEstadoPedido_Pedido ON dbo.HistorialEstadoPedido (IDPedido, Fecha);

CREATE TABLE dbo.Devolucion (
    IDDevolucion   INT IDENTITY(1,1) NOT NULL,
    IDPedido       INT               NOT NULL,
    -- El Operador que la registró.
    IDUsuario      INT               NOT NULL,
    Motivo         NVARCHAR(250)     NOT NULL,
    MontoReembolso DECIMAL(12,2)     NOT NULL,
    Fecha          DATETIME2(3)      NOT NULL CONSTRAINT DF_Devolucion_Fecha DEFAULT SYSUTCDATETIME(),
    -- N-11: las devoluciones se restan en su propia fecha local.
    FechaLocal     DATE              NOT NULL,
    FechaCreacion  DATETIME2(3)      NOT NULL CONSTRAINT DF_Devolucion_FechaCreacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Devolucion PRIMARY KEY (IDDevolucion),
    CONSTRAINT FK_Devolucion_Pedido FOREIGN KEY (IDPedido) REFERENCES dbo.Pedido (IDPedido),
    CONSTRAINT FK_Devolucion_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario (IDUsuario),
    CONSTRAINT CK_Devolucion_MontoReembolso CHECK (MontoReembolso > 0)
);

CREATE INDEX IX_Devolucion_FechaLocal ON dbo.Devolucion (FechaLocal) INCLUDE (MontoReembolso);

CREATE TABLE dbo.DetalleDevolucion (
    IDDetalleDevolucion INT IDENTITY(1,1) NOT NULL,
    IDDevolucion        INT               NOT NULL,
    IDDetallePedido     INT               NOT NULL,
    Cantidad            INT               NOT NULL,
    MontoReembolso      DECIMAL(12,2)     NOT NULL,
    FechaCreacion       DATETIME2(3)      NOT NULL CONSTRAINT DF_DetalleDevolucion_FechaCreacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_DetalleDevolucion PRIMARY KEY (IDDetalleDevolucion),
    CONSTRAINT UQ_DetalleDevolucion_IDDevolucionIDDetallePedido UNIQUE (IDDevolucion, IDDetallePedido),
    CONSTRAINT FK_DetalleDevolucion_Devolucion FOREIGN KEY (IDDevolucion) REFERENCES dbo.Devolucion (IDDevolucion),
    CONSTRAINT FK_DetalleDevolucion_DetallePedido FOREIGN KEY (IDDetallePedido)
        REFERENCES dbo.DetallePedido (IDDetallePedido),
    CONSTRAINT CK_DetalleDevolucion_CantidadPositiva CHECK (Cantidad > 0),
    CONSTRAINT CK_DetalleDevolucion_MontoReembolso CHECK (MontoReembolso >= 0)
);

CREATE TABLE dbo.Reembolso (
    IDReembolso            INT IDENTITY(1,1) NOT NULL,
    IDPedido               INT               NOT NULL,
    IDDevolucion           INT               NULL,
    Origen                 VARCHAR(12)       NOT NULL,
    Monto                  DECIMAL(12,2)     NOT NULL,
    Estado                 VARCHAR(10)       NOT NULL,
    Intentos               TINYINT           NOT NULL CONSTRAINT DF_Reembolso_Intentos DEFAULT 0,
    -- Se envía a la pasarela: reintentar un reembolso nunca lo duplica.
    LlaveIdempotencia      UNIQUEIDENTIFIER  NOT NULL,
    IDTransaccionReembolso VARCHAR(64)       NULL,
    UltimoError            NVARCHAR(500)     NULL,
    FechaProximoIntento    DATETIME2(3)      NULL,
    FechaCompletado        DATETIME2(3)      NULL,
    FechaCreacion          DATETIME2(3)      NOT NULL CONSTRAINT DF_Reembolso_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion     DATETIME2(3)      NOT NULL CONSTRAINT DF_Reembolso_FechaActualizacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Reembolso PRIMARY KEY (IDReembolso),
    CONSTRAINT UQ_Reembolso_LlaveIdempotencia UNIQUE (LlaveIdempotencia),
    CONSTRAINT FK_Reembolso_Pedido FOREIGN KEY (IDPedido) REFERENCES dbo.Pedido (IDPedido),
    CONSTRAINT FK_Reembolso_Devolucion FOREIGN KEY (IDDevolucion) REFERENCES dbo.Devolucion (IDDevolucion),
    CONSTRAINT CK_Reembolso_Origen CHECK (
        (Origen = 'Devolucion' AND IDDevolucion IS NOT NULL) OR (Origen = 'Cancelacion' AND IDDevolucion IS NULL)),
    CONSTRAINT CK_Reembolso_Monto CHECK (Monto > 0),
    CONSTRAINT CK_Reembolso_Estado CHECK (Estado IN ('Pendiente', 'Completado', 'Fallido'))
);

CREATE UNIQUE INDEX UX_Reembolso_CancelacionPorPedido ON dbo.Reembolso (IDPedido) WHERE Origen = 'Cancelacion';
CREATE UNIQUE INDEX UX_Reembolso_PorDevolucion ON dbo.Reembolso (IDDevolucion) WHERE IDDevolucion IS NOT NULL;
CREATE INDEX IX_Reembolso_Pendientes ON dbo.Reembolso (FechaProximoIntento) WHERE Estado = 'Pendiente';

ALTER TABLE dbo.MovimientoKardex
    ADD CONSTRAINT FK_MovimientoKardex_Pedido FOREIGN KEY (IDPedido) REFERENCES dbo.Pedido (IDPedido),
        CONSTRAINT FK_MovimientoKardex_Devolucion FOREIGN KEY (IDDevolucion) REFERENCES dbo.Devolucion (IDDevolucion);

ALTER TABLE dbo.UsoCupon
    ADD CONSTRAINT FK_UsoCupon_Pedido FOREIGN KEY (IDPedido) REFERENCES dbo.Pedido (IDPedido);
