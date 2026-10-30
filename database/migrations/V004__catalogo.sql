-- V004: catálogo, atributos, variantes y precios versionados (02-modelo-datos.md §3.3).

CREATE TABLE dbo.Categoria (
    IDCategoria        INT IDENTITY(1,1) NOT NULL,
    Nombre             NVARCHAR(80)      NOT NULL,
    Descripcion        NVARCHAR(300)     NULL,
    Activo             BIT               NOT NULL CONSTRAINT DF_Categoria_Activo DEFAULT 1,
    FechaCreacion      DATETIME2(3)      NOT NULL CONSTRAINT DF_Categoria_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion DATETIME2(3)      NOT NULL CONSTRAINT DF_Categoria_FechaActualizacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Categoria PRIMARY KEY (IDCategoria),
    CONSTRAINT UQ_Categoria_Nombre UNIQUE (Nombre)
);

CREATE TABLE dbo.Producto (
    IDProducto         INT IDENTITY(1,1) NOT NULL,
    IDCategoria        INT               NOT NULL,
    Nombre             NVARCHAR(150)     NOT NULL,
    -- A-10: búsqueda sin distinguir mayúsculas ni tildes ("camion" encuentra "Camión").
    NombreBusqueda     AS (Nombre COLLATE Latin1_General_CI_AI) PERSISTED,
    Descripcion        NVARCHAR(2000)    NULL,
    Activo             BIT               NOT NULL CONSTRAINT DF_Producto_Activo DEFAULT 1,
    FechaCreacion      DATETIME2(3)      NOT NULL CONSTRAINT DF_Producto_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion DATETIME2(3)      NOT NULL CONSTRAINT DF_Producto_FechaActualizacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Producto PRIMARY KEY (IDProducto),
    CONSTRAINT FK_Producto_Categoria FOREIGN KEY (IDCategoria) REFERENCES dbo.Categoria (IDCategoria)
);

CREATE INDEX IX_Producto_Categoria_Activo ON dbo.Producto (IDCategoria, Activo) INCLUDE (Nombre);

CREATE TABLE dbo.ImagenProducto (
    IDImagenProducto   INT IDENTITY(1,1) NOT NULL,
    IDProducto         INT               NOT NULL,
    Url                NVARCHAR(500)     NOT NULL,
    TextoAlternativo   NVARCHAR(150)     NOT NULL,
    Orden              SMALLINT          NOT NULL,
    EsPrincipal        BIT               NOT NULL CONSTRAINT DF_ImagenProducto_EsPrincipal DEFAULT 0,
    FechaCreacion      DATETIME2(3)      NOT NULL CONSTRAINT DF_ImagenProducto_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion DATETIME2(3)      NOT NULL CONSTRAINT DF_ImagenProducto_FechaActualizacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_ImagenProducto PRIMARY KEY (IDImagenProducto),
    CONSTRAINT UQ_ImagenProducto_IDProductoOrden UNIQUE (IDProducto, Orden),
    CONSTRAINT FK_ImagenProducto_Producto FOREIGN KEY (IDProducto) REFERENCES dbo.Producto (IDProducto)
);

CREATE UNIQUE INDEX UX_ImagenProducto_Principal ON dbo.ImagenProducto (IDProducto) WHERE EsPrincipal = 1;

CREATE TABLE dbo.Atributo (
    IDAtributo         INT IDENTITY(1,1) NOT NULL,
    Nombre             NVARCHAR(50)      NOT NULL,
    Orden              SMALLINT          NOT NULL,
    FechaCreacion      DATETIME2(3)      NOT NULL CONSTRAINT DF_Atributo_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion DATETIME2(3)      NOT NULL CONSTRAINT DF_Atributo_FechaActualizacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Atributo PRIMARY KEY (IDAtributo),
    CONSTRAINT UQ_Atributo_Nombre UNIQUE (Nombre)
);

CREATE TABLE dbo.ValorAtributo (
    IDValorAtributo    INT IDENTITY(1,1) NOT NULL,
    IDAtributo         INT               NOT NULL,
    Valor              NVARCHAR(50)      NOT NULL,
    Orden              SMALLINT          NOT NULL,
    FechaCreacion      DATETIME2(3)      NOT NULL CONSTRAINT DF_ValorAtributo_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion DATETIME2(3)      NOT NULL CONSTRAINT DF_ValorAtributo_FechaActualizacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_ValorAtributo PRIMARY KEY (IDValorAtributo),
    CONSTRAINT UQ_ValorAtributo_IDAtributoValor UNIQUE (IDAtributo, Valor),
    -- Destino de la FK compuesta de VarianteValorAtributo: el valor tiene que pertenecer a su atributo.
    CONSTRAINT UQ_ValorAtributo_IDValorAtributoIDAtributo UNIQUE (IDValorAtributo, IDAtributo),
    CONSTRAINT FK_ValorAtributo_Atributo FOREIGN KEY (IDAtributo) REFERENCES dbo.Atributo (IDAtributo)
);

CREATE TABLE dbo.Variante (
    IDVariante           INT IDENTITY(1,1) NOT NULL,
    IDProducto           INT               NOT NULL,
    SKU                  VARCHAR(40)       NOT NULL,
    -- IDs de ValorAtributo ordenados por IDAtributo (p. ej. '3|17'); la calcula el SP.
    FirmaAtributos       VARCHAR(200)      NOT NULL,
    DescripcionAtributos NVARCHAR(200)     NOT NULL,
    -- Solo la modifica SP_Inventario_RegistrarMovimiento (N-07).
    ExistenciaFisica     INT               NOT NULL CONSTRAINT DF_Variante_ExistenciaFisica DEFAULT 0,
    Activo               BIT               NOT NULL CONSTRAINT DF_Variante_Activo DEFAULT 1,
    VersionFila          ROWVERSION        NOT NULL,
    FechaCreacion        DATETIME2(3)      NOT NULL CONSTRAINT DF_Variante_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion   DATETIME2(3)      NOT NULL CONSTRAINT DF_Variante_FechaActualizacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Variante PRIMARY KEY (IDVariante),
    CONSTRAINT UQ_Variante_SKU UNIQUE (SKU),
    -- N-14: no puede haber dos variantes del mismo producto con la misma combinación.
    CONSTRAINT UQ_Variante_IDProductoFirmaAtributos UNIQUE (IDProducto, FirmaAtributos),
    CONSTRAINT FK_Variante_Producto FOREIGN KEY (IDProducto) REFERENCES dbo.Producto (IDProducto),
    CONSTRAINT CK_Variante_ExistenciaNoNegativa CHECK (ExistenciaFisica >= 0)
);

CREATE TABLE dbo.VarianteValorAtributo (
    IDVariante      INT          NOT NULL,
    -- Parte de la PK: un solo valor por atributo en cada variante.
    IDAtributo      INT          NOT NULL,
    IDValorAtributo INT          NOT NULL,
    FechaCreacion   DATETIME2(3) NOT NULL CONSTRAINT DF_VarianteValorAtributo_FechaCreacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_VarianteValorAtributo PRIMARY KEY (IDVariante, IDAtributo),
    CONSTRAINT FK_VarianteValorAtributo_Variante FOREIGN KEY (IDVariante) REFERENCES dbo.Variante (IDVariante),
    CONSTRAINT FK_VarianteValorAtributo_ValorAtributo FOREIGN KEY (IDValorAtributo, IDAtributo)
        REFERENCES dbo.ValorAtributo (IDValorAtributo, IDAtributo)
);

-- N-02: precios versionados. Cambiar un precio cierra la versión vigente e inserta otra.
CREATE TABLE dbo.PrecioVariante (
    IDPrecioVariante INT IDENTITY(1,1) NOT NULL,
    IDVariante       INT               NOT NULL,
    Precio           DECIMAL(12,2)     NOT NULL,
    VigenteDesde     DATETIME2(3)      NOT NULL,
    VigenteHasta     DATETIME2(3)      NULL,
    IDUsuario        INT               NOT NULL,
    FechaCreacion    DATETIME2(3)      NOT NULL CONSTRAINT DF_PrecioVariante_FechaCreacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_PrecioVariante PRIMARY KEY (IDPrecioVariante),
    CONSTRAINT FK_PrecioVariante_Variante FOREIGN KEY (IDVariante) REFERENCES dbo.Variante (IDVariante),
    CONSTRAINT FK_PrecioVariante_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario (IDUsuario),
    CONSTRAINT CK_PrecioVariante_PrecioPositivo CHECK (Precio > 0),
    CONSTRAINT CK_PrecioVariante_Vigencia CHECK (VigenteHasta > VigenteDesde)
);

-- Un solo precio vigente por variante.
CREATE UNIQUE INDEX UX_PrecioVariante_Vigente ON dbo.PrecioVariante (IDVariante) WHERE VigenteHasta IS NULL;
CREATE INDEX IX_PrecioVariante_Historial
    ON dbo.PrecioVariante (IDVariante, VigenteDesde DESC) INCLUDE (Precio, VigenteHasta);
