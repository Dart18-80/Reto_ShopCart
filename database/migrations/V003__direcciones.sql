-- V003: geografía de Guatemala y direcciones del cliente (02-modelo-datos.md §3.2).

CREATE TABLE dbo.Departamento (
    IDDepartamento INT IDENTITY(1,1) NOT NULL,
    Nombre         NVARCHAR(50)      NOT NULL,
    FechaCreacion  DATETIME2(3)      NOT NULL CONSTRAINT DF_Departamento_FechaCreacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Departamento PRIMARY KEY (IDDepartamento),
    CONSTRAINT UQ_Departamento_Nombre UNIQUE (Nombre)
);

CREATE TABLE dbo.Municipio (
    IDMunicipio    INT IDENTITY(1,1) NOT NULL,
    IDDepartamento INT               NOT NULL,
    Nombre         NVARCHAR(80)      NOT NULL,
    FechaCreacion  DATETIME2(3)      NOT NULL CONSTRAINT DF_Municipio_FechaCreacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Municipio PRIMARY KEY (IDMunicipio),
    CONSTRAINT UQ_Municipio_IDDepartamentoNombre UNIQUE (IDDepartamento, Nombre),
    CONSTRAINT FK_Municipio_Departamento FOREIGN KEY (IDDepartamento) REFERENCES dbo.Departamento (IDDepartamento)
);

-- Se permite el borrado físico: el pedido y la sesión de checkout copian la dirección (M-04).
CREATE TABLE dbo.Direccion (
    IDDireccion        INT IDENTITY(1,1) NOT NULL,
    IDUsuario          INT               NOT NULL,
    Alias              NVARCHAR(50)      NULL,
    NombreRecibe       NVARCHAR(100)     NOT NULL,
    TelefonoRecibe     VARCHAR(8)        NOT NULL,
    IDMunicipio        INT               NOT NULL,
    DireccionLinea     NVARCHAR(200)     NOT NULL,
    Referencia         NVARCHAR(200)     NULL,
    EsPredeterminada   BIT               NOT NULL CONSTRAINT DF_Direccion_EsPredeterminada DEFAULT 0,
    FechaCreacion      DATETIME2(3)      NOT NULL CONSTRAINT DF_Direccion_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion DATETIME2(3)      NOT NULL CONSTRAINT DF_Direccion_FechaActualizacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Direccion PRIMARY KEY (IDDireccion),
    CONSTRAINT FK_Direccion_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario (IDUsuario),
    CONSTRAINT FK_Direccion_Municipio FOREIGN KEY (IDMunicipio) REFERENCES dbo.Municipio (IDMunicipio),
    CONSTRAINT CK_Direccion_TelefonoRecibe CHECK (TelefonoRecibe LIKE '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]')
);

-- N-17: una sola dirección predeterminada por usuario.
CREATE UNIQUE INDEX UX_Direccion_PredeterminadaPorUsuario
    ON dbo.Direccion (IDUsuario) WHERE EsPredeterminada = 1;
CREATE INDEX IX_Direccion_IDUsuario ON dbo.Direccion (IDUsuario);
