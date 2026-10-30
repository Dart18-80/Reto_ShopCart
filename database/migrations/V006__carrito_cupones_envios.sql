-- V006: cupones, carrito, métodos de envío y parámetros del sistema (02-modelo-datos.md §3.5–3.7).

CREATE TABLE dbo.Cupon (
    IDCupon              INT IDENTITY(1,1) NOT NULL,
    Codigo               VARCHAR(30)       NOT NULL,
    Descripcion          NVARCHAR(200)     NOT NULL,
    Tipo                 VARCHAR(10)       NOT NULL,
    Valor                DECIMAL(12,2)     NOT NULL,
    MontoMaximoDescuento DECIMAL(12,2)     NULL,
    MontoMinimoCompra    DECIMAL(12,2)     NOT NULL CONSTRAINT DF_Cupon_MontoMinimoCompra DEFAULT 0,
    IDCategoria          INT               NULL,
    FechaInicio          DATETIME2(3)      NOT NULL,
    FechaFin             DATETIME2(3)      NOT NULL,
    LimiteUsosTotal      INT               NOT NULL,
    LimiteUsosPorCliente INT               NOT NULL,
    -- Reservados + confirmados. El CHECK es la última defensa del límite total (A-13).
    UsosComprometidos    INT               NOT NULL CONSTRAINT DF_Cupon_UsosComprometidos DEFAULT 0,
    Activo               BIT               NOT NULL CONSTRAINT DF_Cupon_Activo DEFAULT 1,
    VersionFila          ROWVERSION        NOT NULL,
    FechaCreacion        DATETIME2(3)      NOT NULL CONSTRAINT DF_Cupon_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion   DATETIME2(3)      NOT NULL CONSTRAINT DF_Cupon_FechaActualizacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Cupon PRIMARY KEY (IDCupon),
    CONSTRAINT UQ_Cupon_Codigo UNIQUE (Codigo),
    CONSTRAINT FK_Cupon_Categoria FOREIGN KEY (IDCategoria) REFERENCES dbo.Categoria (IDCategoria),
    -- Con la collation por defecto (CI) 'abc' = 'ABC' y el CHECK nunca fallaría: se compara en CS.
    CONSTRAINT CK_Cupon_CodigoMayusculas CHECK (Codigo = UPPER(Codigo) COLLATE Latin1_General_CS_AS),
    CONSTRAINT CK_Cupon_Tipo CHECK (Tipo IN ('Porcentaje', 'MontoFijo')),
    CONSTRAINT CK_Cupon_Valor CHECK (Valor > 0 AND (Tipo <> 'Porcentaje' OR Valor <= 100)),
    CONSTRAINT CK_Cupon_MontoMaximoDescuento CHECK (
        MontoMaximoDescuento IS NULL OR (MontoMaximoDescuento > 0 AND Tipo = 'Porcentaje')),
    CONSTRAINT CK_Cupon_MontoMinimoCompra CHECK (MontoMinimoCompra >= 0),
    CONSTRAINT CK_Cupon_Vigencia CHECK (FechaFin > FechaInicio),
    CONSTRAINT CK_Cupon_LimiteUsosTotal CHECK (LimiteUsosTotal > 0),
    CONSTRAINT CK_Cupon_LimiteUsosPorCliente CHECK (LimiteUsosPorCliente > 0),
    CONSTRAINT CK_Cupon_UsosComprometidos CHECK (UsosComprometidos BETWEEN 0 AND LimiteUsosTotal)
);

CREATE TABLE dbo.Carrito (
    IDCarrito            INT IDENTITY(1,1) NOT NULL,
    IDUsuario            INT               NULL,
    HashTokenInvitado    BINARY(32)        NULL,
    Estado               VARCHAR(12)       NOT NULL,
    -- N-12: cupón aplicado como vista previa; se reserva al iniciar el pago.
    IDCupon              INT               NULL,
    -- N-13: solo cambia cuando el carrito cambia.
    FechaUltimaActividad DATETIME2(3)      NOT NULL CONSTRAINT DF_Carrito_FechaUltimaActividad DEFAULT SYSUTCDATETIME(),
    FechaCierre          DATETIME2(3)      NULL,
    FechaCreacion        DATETIME2(3)      NOT NULL CONSTRAINT DF_Carrito_FechaCreacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Carrito PRIMARY KEY (IDCarrito),
    CONSTRAINT FK_Carrito_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario (IDUsuario),
    CONSTRAINT FK_Carrito_Cupon FOREIGN KEY (IDCupon) REFERENCES dbo.Cupon (IDCupon),
    CONSTRAINT CK_Carrito_Estado CHECK (Estado IN ('Activo', 'Fusionado', 'Convertido', 'Expirado')),
    -- Un carrito es de un cliente o de un invitado, nunca de ambos ni de ninguno.
    CONSTRAINT CK_Carrito_DuenoUnico CHECK (
        (IDUsuario IS NOT NULL AND HashTokenInvitado IS NULL)
        OR (IDUsuario IS NULL AND HashTokenInvitado IS NOT NULL))
);

CREATE UNIQUE INDEX UX_Carrito_ActivoPorUsuario
    ON dbo.Carrito (IDUsuario) WHERE Estado = 'Activo' AND IDUsuario IS NOT NULL;
CREATE UNIQUE INDEX UX_Carrito_TokenInvitado
    ON dbo.Carrito (HashTokenInvitado) WHERE HashTokenInvitado IS NOT NULL;
CREATE INDEX IX_Carrito_Abandono ON dbo.Carrito (Estado, FechaUltimaActividad);

CREATE TABLE dbo.LineaCarrito (
    IDLineaCarrito              INT IDENTITY(1,1) NOT NULL,
    IDCarrito                   INT               NOT NULL,
    IDVariante                  INT               NOT NULL,
    Cantidad                    INT               NOT NULL,
    -- N-02: precio garantizado por DiasGarantiaPrecio desde que se agregó la línea.
    IDPrecioVarianteGarantizado INT               NOT NULL,
    FechaGarantiaHasta          DATETIME2(3)      NOT NULL,
    PrecioAnteriorAviso         DECIMAL(12,2)     NULL,
    FechaAgregado               DATETIME2(3)      NOT NULL CONSTRAINT DF_LineaCarrito_FechaAgregado DEFAULT SYSUTCDATETIME(),
    FechaCreacion               DATETIME2(3)      NOT NULL CONSTRAINT DF_LineaCarrito_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion          DATETIME2(3)      NOT NULL CONSTRAINT DF_LineaCarrito_FechaActualizacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_LineaCarrito PRIMARY KEY (IDLineaCarrito),
    CONSTRAINT UQ_LineaCarrito_IDCarritoIDVariante UNIQUE (IDCarrito, IDVariante),
    CONSTRAINT FK_LineaCarrito_Carrito FOREIGN KEY (IDCarrito) REFERENCES dbo.Carrito (IDCarrito),
    CONSTRAINT FK_LineaCarrito_Variante FOREIGN KEY (IDVariante) REFERENCES dbo.Variante (IDVariante),
    CONSTRAINT FK_LineaCarrito_PrecioVariante FOREIGN KEY (IDPrecioVarianteGarantizado)
        REFERENCES dbo.PrecioVariante (IDPrecioVariante),
    CONSTRAINT CK_LineaCarrito_CantidadPositiva CHECK (Cantidad > 0)
);

CREATE TABLE dbo.MetodoEnvio (
    IDMetodoEnvio      INT IDENTITY(1,1) NOT NULL,
    Codigo             VARCHAR(20)       NOT NULL,
    Nombre             NVARCHAR(50)      NOT NULL,
    Costo              DECIMAL(12,2)     NOT NULL,
    DiasMin            TINYINT           NOT NULL,
    DiasMax            TINYINT           NOT NULL,
    Activo             BIT               NOT NULL CONSTRAINT DF_MetodoEnvio_Activo DEFAULT 1,
    FechaCreacion      DATETIME2(3)      NOT NULL CONSTRAINT DF_MetodoEnvio_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion DATETIME2(3)      NOT NULL CONSTRAINT DF_MetodoEnvio_FechaActualizacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_MetodoEnvio PRIMARY KEY (IDMetodoEnvio),
    CONSTRAINT UQ_MetodoEnvio_Codigo UNIQUE (Codigo),
    CONSTRAINT CK_MetodoEnvio_Costo CHECK (Costo >= 0),
    CONSTRAINT CK_MetodoEnvio_Dias CHECK (DiasMax >= DiasMin)
);

-- A-14: una sola fila tipada; cada parámetro con su tipo y su rango.
CREATE TABLE dbo.ParametroSistema (
    IDParametroSistema            INT IDENTITY(1,1) NOT NULL,
    DiasGarantiaPrecio            TINYINT           NOT NULL CONSTRAINT DF_ParametroSistema_DiasGarantiaPrecio DEFAULT 3,
    MinutosReserva                SMALLINT          NOT NULL CONSTRAINT DF_ParametroSistema_MinutosReserva DEFAULT 15,
    HorasCarritoAbandonado        SMALLINT          NOT NULL CONSTRAINT DF_ParametroSistema_HorasCarritoAbandonado DEFAULT 24,
    DiasExpiracionCarritoInvitado SMALLINT          NOT NULL CONSTRAINT DF_ParametroSistema_DiasExpiracionCarritoInvitado DEFAULT 30,
    UmbralUltimasUnidades         SMALLINT          NOT NULL CONSTRAINT DF_ParametroSistema_UmbralUltimasUnidades DEFAULT 5,
    -- NULL = sin envío gratis.
    MontoEnvioGratis              DECIMAL(12,2)     NULL     CONSTRAINT DF_ParametroSistema_MontoEnvioGratis DEFAULT 500.00,
    MaxIntentosPagoRechazados     TINYINT           NOT NULL CONSTRAINT DF_ParametroSistema_MaxIntentosPagoRechazados DEFAULT 5,
    DiasPlazoDevolucion           SMALLINT          NOT NULL CONSTRAINT DF_ParametroSistema_DiasPlazoDevolucion DEFAULT 30,
    MaxLineasCarrito              SMALLINT          NOT NULL CONSTRAINT DF_ParametroSistema_MaxLineasCarrito DEFAULT 50,
    IDUsuarioActualizacion        INT               NULL,
    FechaCreacion                 DATETIME2(3)      NOT NULL CONSTRAINT DF_ParametroSistema_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion            DATETIME2(3)      NOT NULL CONSTRAINT DF_ParametroSistema_FechaActualizacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_ParametroSistema PRIMARY KEY (IDParametroSistema),
    CONSTRAINT FK_ParametroSistema_Usuario FOREIGN KEY (IDUsuarioActualizacion) REFERENCES dbo.Usuario (IDUsuario),
    CONSTRAINT CK_ParametroSistema_UnaSolaFila CHECK (IDParametroSistema = 1),
    CONSTRAINT CK_ParametroSistema_DiasGarantiaPrecio CHECK (DiasGarantiaPrecio BETWEEN 1 AND 30),
    CONSTRAINT CK_ParametroSistema_MinutosReserva CHECK (MinutosReserva BETWEEN 5 AND 60),
    CONSTRAINT CK_ParametroSistema_HorasCarritoAbandonado CHECK (HorasCarritoAbandonado BETWEEN 1 AND 720),
    CONSTRAINT CK_ParametroSistema_DiasExpiracionCarritoInvitado CHECK (DiasExpiracionCarritoInvitado BETWEEN 1 AND 365),
    CONSTRAINT CK_ParametroSistema_UmbralUltimasUnidades CHECK (UmbralUltimasUnidades BETWEEN 1 AND 100),
    CONSTRAINT CK_ParametroSistema_MontoEnvioGratis CHECK (MontoEnvioGratis > 0),
    CONSTRAINT CK_ParametroSistema_MaxIntentosPagoRechazados CHECK (MaxIntentosPagoRechazados BETWEEN 1 AND 10),
    CONSTRAINT CK_ParametroSistema_DiasPlazoDevolucion CHECK (DiasPlazoDevolucion BETWEEN 1 AND 365),
    CONSTRAINT CK_ParametroSistema_MaxLineasCarrito CHECK (MaxLineasCarrito BETWEEN 1 AND 200)
);
