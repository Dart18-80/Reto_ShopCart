-- V007: sesión de checkout, resumen congelado, intentos de pago y uso de cupones (02-modelo-datos.md §3.6 y §3.8).
-- La FK de UsoCupon a Pedido se agrega en V008.

CREATE TABLE dbo.SesionCheckout (
    IDSesionCheckout   INT IDENTITY(1,1) NOT NULL,
    IDUsuario          INT               NOT NULL,
    IDCarrito          INT               NOT NULL,
    Estado             VARCHAR(10)       NOT NULL,
    -- N-02: hash de líneas, cantidades, cupón, envío y dirección; si coincide, la sesión se reutiliza.
    HashContenido      BINARY(32)        NOT NULL,
    -- M-04: copia de la dirección confirmada.
    NombreRecibe       NVARCHAR(100)     NOT NULL,
    TelefonoRecibe     VARCHAR(8)        NOT NULL,
    IDMunicipio        INT               NOT NULL,
    Departamento       NVARCHAR(50)      NOT NULL,
    Municipio          NVARCHAR(80)      NOT NULL,
    DireccionLinea     NVARCHAR(200)     NOT NULL,
    Referencia         NVARCHAR(200)     NULL,
    IDMetodoEnvio      INT               NOT NULL,
    NombreMetodoEnvio  NVARCHAR(50)      NOT NULL,
    DiasMin            TINYINT           NOT NULL,
    DiasMax            TINYINT           NOT NULL,
    IDCupon            INT               NULL,
    CodigoCupon        VARCHAR(30)       NULL,
    Subtotal           DECIMAL(12,2)     NOT NULL,
    Descuento          DECIMAL(12,2)     NOT NULL,
    CostoEnvio         DECIMAL(12,2)     NOT NULL,
    Total              DECIMAL(12,2)     NOT NULL,
    IntentosRechazados TINYINT           NOT NULL CONSTRAINT DF_SesionCheckout_IntentosRechazados DEFAULT 0,
    FechaExpiracion    DATETIME2(3)      NOT NULL,
    FechaCierre        DATETIME2(3)      NULL,
    FechaCreacion      DATETIME2(3)      NOT NULL CONSTRAINT DF_SesionCheckout_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion DATETIME2(3)      NOT NULL CONSTRAINT DF_SesionCheckout_FechaActualizacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_SesionCheckout PRIMARY KEY (IDSesionCheckout),
    CONSTRAINT FK_SesionCheckout_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario (IDUsuario),
    CONSTRAINT FK_SesionCheckout_Carrito FOREIGN KEY (IDCarrito) REFERENCES dbo.Carrito (IDCarrito),
    CONSTRAINT FK_SesionCheckout_Municipio FOREIGN KEY (IDMunicipio) REFERENCES dbo.Municipio (IDMunicipio),
    CONSTRAINT FK_SesionCheckout_MetodoEnvio FOREIGN KEY (IDMetodoEnvio) REFERENCES dbo.MetodoEnvio (IDMetodoEnvio),
    CONSTRAINT FK_SesionCheckout_Cupon FOREIGN KEY (IDCupon) REFERENCES dbo.Cupon (IDCupon),
    CONSTRAINT CK_SesionCheckout_Estado CHECK (Estado IN ('Activa', 'Pagada', 'Expirada', 'Cancelada')),
    CONSTRAINT CK_SesionCheckout_TelefonoRecibe CHECK (TelefonoRecibe LIKE '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
    CONSTRAINT CK_SesionCheckout_Dias CHECK (DiasMax >= DiasMin),
    CONSTRAINT CK_SesionCheckout_Subtotal CHECK (Subtotal >= 0),
    CONSTRAINT CK_SesionCheckout_Descuento CHECK (Descuento >= 0 AND Descuento <= Subtotal),
    CONSTRAINT CK_SesionCheckout_CostoEnvio CHECK (CostoEnvio >= 0),
    CONSTRAINT CK_SesionCheckout_Total CHECK (Total = Subtotal - Descuento + CostoEnvio)
);

-- N-02: una sola sesión activa por usuario.
CREATE UNIQUE INDEX UX_SesionCheckout_ActivaPorUsuario
    ON dbo.SesionCheckout (IDUsuario) WHERE Estado = 'Activa';
CREATE INDEX IX_SesionCheckout_PorExpirar
    ON dbo.SesionCheckout (FechaExpiracion) WHERE Estado = 'Activa';

CREATE TABLE dbo.LineaSesionCheckout (
    IDLineaSesionCheckout INT IDENTITY(1,1) NOT NULL,
    IDSesionCheckout      INT               NOT NULL,
    IDVariante            INT               NOT NULL,
    -- La versión de precio que se cobró.
    IDPrecioVariante      INT               NOT NULL,
    Cantidad              INT               NOT NULL,
    PrecioUnitario        DECIMAL(12,2)     NOT NULL,
    DescuentoLinea        DECIMAL(12,2)     NOT NULL,
    TotalLinea            DECIMAL(12,2)     NOT NULL,
    FechaCreacion         DATETIME2(3)      NOT NULL CONSTRAINT DF_LineaSesionCheckout_FechaCreacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_LineaSesionCheckout PRIMARY KEY (IDLineaSesionCheckout),
    CONSTRAINT UQ_LineaSesionCheckout_IDSesionCheckoutIDVariante UNIQUE (IDSesionCheckout, IDVariante),
    CONSTRAINT FK_LineaSesionCheckout_SesionCheckout FOREIGN KEY (IDSesionCheckout)
        REFERENCES dbo.SesionCheckout (IDSesionCheckout),
    CONSTRAINT FK_LineaSesionCheckout_Variante FOREIGN KEY (IDVariante) REFERENCES dbo.Variante (IDVariante),
    CONSTRAINT FK_LineaSesionCheckout_PrecioVariante FOREIGN KEY (IDPrecioVariante)
        REFERENCES dbo.PrecioVariante (IDPrecioVariante),
    CONSTRAINT CK_LineaSesionCheckout_CantidadPositiva CHECK (Cantidad > 0),
    CONSTRAINT CK_LineaSesionCheckout_PrecioUnitario CHECK (PrecioUnitario > 0),
    CONSTRAINT CK_LineaSesionCheckout_DescuentoLinea CHECK (
        DescuentoLinea >= 0 AND DescuentoLinea <= Cantidad * PrecioUnitario),
    CONSTRAINT CK_LineaSesionCheckout_TotalLinea CHECK (TotalLinea = Cantidad * PrecioUnitario - DescuentoLinea)
);

CREATE TABLE dbo.IntentoPago (
    IDIntentoPago         BIGINT IDENTITY(1,1) NOT NULL,
    IDSesionCheckout      INT                  NOT NULL,
    LlaveIdempotencia     UNIQUEIDENTIFIER     NOT NULL,
    -- Detecta "misma llave, otro contenido" (422).
    HashSolicitud         BINARY(32)           NOT NULL,
    Monto                 DECIMAL(12,2)        NOT NULL,
    Estado                VARCHAR(12)          NOT NULL,
    IDTransaccionPasarela VARCHAR(64)          NULL,
    CodigoRespuesta       VARCHAR(30)          NULL,
    MensajeRespuesta      NVARCHAR(200)        NULL,
    MarcaTarjeta          VARCHAR(20)          NULL,
    UltimosDigitos        CHAR(4)              NULL,
    FechaCreacion         DATETIME2(3)         NOT NULL CONSTRAINT DF_IntentoPago_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion    DATETIME2(3)         NOT NULL CONSTRAINT DF_IntentoPago_FechaActualizacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_IntentoPago PRIMARY KEY (IDIntentoPago),
    -- Candado de idempotencia: la misma llave no se procesa dos veces.
    CONSTRAINT UQ_IntentoPago_LlaveIdempotencia UNIQUE (LlaveIdempotencia),
    CONSTRAINT FK_IntentoPago_SesionCheckout FOREIGN KEY (IDSesionCheckout)
        REFERENCES dbo.SesionCheckout (IDSesionCheckout),
    CONSTRAINT CK_IntentoPago_Monto CHECK (Monto > 0),
    CONSTRAINT CK_IntentoPago_Estado CHECK (
        Estado IN ('Pendiente', 'Autorizado', 'Capturado', 'Rechazado', 'Anulado', 'Error')),
    CONSTRAINT CK_IntentoPago_UltimosDigitos CHECK (UltimosDigitos LIKE '[0-9][0-9][0-9][0-9]')
);

-- N-03: un solo intento en curso por sesión, garantizado por la base (409).
CREATE UNIQUE INDEX UX_IntentoPago_EnCursoPorSesion
    ON dbo.IntentoPago (IDSesionCheckout) WHERE Estado IN ('Pendiente', 'Autorizado');
CREATE UNIQUE INDEX UX_IntentoPago_Transaccion
    ON dbo.IntentoPago (IDTransaccionPasarela) WHERE IDTransaccionPasarela IS NOT NULL;
CREATE INDEX IX_IntentoPago_PorConciliar
    ON dbo.IntentoPago (Estado, FechaActualizacion) WHERE Estado = 'Autorizado';

CREATE TABLE dbo.UsoCupon (
    IDUsoCupon         INT IDENTITY(1,1) NOT NULL,
    IDCupon            INT               NOT NULL,
    IDUsuario          INT               NOT NULL,
    IDSesionCheckout   INT               NOT NULL,
    IDPedido           INT               NULL,
    Estado             VARCHAR(10)       NOT NULL,
    MontoDescuento     DECIMAL(12,2)     NOT NULL,
    FechaCreacion      DATETIME2(3)      NOT NULL CONSTRAINT DF_UsoCupon_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion DATETIME2(3)      NOT NULL CONSTRAINT DF_UsoCupon_FechaActualizacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_UsoCupon PRIMARY KEY (IDUsoCupon),
    -- Un cupón por sesión.
    CONSTRAINT UQ_UsoCupon_IDSesionCheckout UNIQUE (IDSesionCheckout),
    CONSTRAINT FK_UsoCupon_Cupon FOREIGN KEY (IDCupon) REFERENCES dbo.Cupon (IDCupon),
    CONSTRAINT FK_UsoCupon_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario (IDUsuario),
    CONSTRAINT FK_UsoCupon_SesionCheckout FOREIGN KEY (IDSesionCheckout)
        REFERENCES dbo.SesionCheckout (IDSesionCheckout),
    CONSTRAINT CK_UsoCupon_Estado CHECK (Estado IN ('Reservado', 'Confirmado', 'Liberado', 'Revertido')),
    CONSTRAINT CK_UsoCupon_MontoDescuento CHECK (MontoDescuento >= 0)
);

-- El límite por cliente cuenta los usos Reservado (vigentes) + Confirmado.
CREATE INDEX IX_UsoCupon_PorCliente ON dbo.UsoCupon (IDCupon, IDUsuario, Estado);

ALTER TABLE dbo.Reserva
    ADD CONSTRAINT FK_Reserva_SesionCheckout FOREIGN KEY (IDSesionCheckout)
        REFERENCES dbo.SesionCheckout (IDSesionCheckout);
